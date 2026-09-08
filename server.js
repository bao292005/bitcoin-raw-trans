// HTTP API cho giao dien web. Chi la lop MONG boc quanh core trong src/ —
// khong chua logic Bitcoin nao, moi thu deu goi lai ham da co.
//
//   npm run web       -> phuc vu ca API + ban build san trong frontend/dist
//   npm run web:dev   -> chi chay API, Vite dev server tu proxy sang (hot reload)
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NETWORK_NAME, USE_RPC, API_BASE } from './src/config.js';
import { loadKeyPair, addressIndex } from './src/wallet.js';
import { fetchUtxos, fetchTxHex, fetchFeeRate, broadcast } from './src/api.js';
import { selectCoins, dustThreshold, DUST_BY_TYPE } from './src/coinselect.js';
import { requestLogger, logError, logShort } from './src/logger.js';
import { buildAndSign } from './src/tx.js';
import * as bitcoin from 'bitcoinjs-lib';
import { network } from './src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.WEB_PORT || 3000);

// Khoa dung trong deriveAddresses() — thu tu nay quyet dinh thu tu hien thi.
const ADDRESS_KEYS = ['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'];

// Private key di qua HTTP -> chi chap nhan khi KHONG phai tien that.
if (NETWORK_NAME === 'mainnet') {
  console.error(
    'TU CHOI KHOI DONG: giao dien web gui private key qua HTTP nen khong duoc\n' +
      'dung tren mainnet. Dat NETWORK=regtest hoac testnet trong .env.'
  );
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '1mb' }));
// Dat SAU express.json de con log duoc tham so trong body.
app.use(requestLogger());

// Bat loi cua handler -> luon tra JSON.
// Phai la ham async: neu chi lam Promise.resolve(fn(...)) thi loi nem DONG BO
// (vd WIF sai o handler khong async) se thoat ra truoc khi co .catch(),
// va Express tra ve trang HTML kem stack trace.
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    logError(err.message);
    res.status(400).json({ error: err.message });
  }
};

// Nap module rpc chi khi chay regtest (testnet khong co bitcoind).
async function requireRpc() {
  if (!USE_RPC) throw new Error(`Chi dung duoc tren regtest (dang la: ${NETWORK_NAME}).`);
  return import('./src/rpc.js');
}

// Doc WIF tu body/query, bao loi ro rang neu sai.
function keyFrom(source) {
  const wif = source?.wif || process.env.PRIVATE_KEY;
  if (!wif) throw new Error('Thieu private key (WIF).');
  try {
    return loadKeyPair(wif);
  } catch {
    throw new Error(`WIF khong hop le tren mang ${NETWORK_NAME}.`);
  }
}

function classifyAddress(addr) {
  try {
    bitcoin.address.toOutputScript(addr, network);
  } catch {
    throw new Error(`Dia chi khong hop le tren ${NETWORK_NAME}: ${addr}`);
  }
  if (/^(bc1p|tb1p|bcrt1p)/.test(addr)) return 'p2tr';
  if (/^(bc1q|tb1q|bcrt1q)/.test(addr)) return 'p2wpkh';
  if (/^[23]/.test(addr)) return 'p2sh-p2wpkh';
  return 'p2pkh';
}

// Quet UTXO tren ca 4 dia chi (giong scanAllUtxos trong CLI).
async function scanAllUtxos(index) {
  const all = [];
  for (const [address, meta] of Object.entries(index)) {
    for (const u of await fetchUtxos(address)) {
      all.push({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        confirmed: u.status?.confirmed ?? false,
        type: meta.type,
        address,
      });
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Thong tin mang luoi — khong can WIF.
// ---------------------------------------------------------------------------
app.get(
  '/api/network',
  wrap(async (req, res) => {
    const info = {
      network: NETWORK_NAME,
      useRpc: USE_RPC,
      apiBase: API_BASE,
      // De UI canh bao dust ngay khi go, khong phai doi goi /build.
      dust: DUST_BY_TYPE,
    };

    if (USE_RPC) {
      try {
        const { getChainInfo, getMinerBalance } = await requireRpc();
        const chain = await getChainInfo();
        info.blocks = chain.blocks;
        info.chain = chain.chain;
        info.minerBalance = await getMinerBalance();
        info.connected = true;
      } catch (err) {
        info.connected = false;
        info.error = err.message;
      }
    } else {
      info.connected = true;
    }

    info.feeRate = await fetchFeeRate().catch(() => null);
    req.log(
      info.connected
        ? `${info.network} · height ${info.blocks ?? '?'} · miner ${info.minerBalance ?? '?'} sat · phi ${info.feeRate} sat/vB`
        : `${info.network} · MAT KET NOI: ${info.error}`
    );
    res.json(info);
  })
);

// ---------------------------------------------------------------------------
// Buoc 1: private key -> 4 dia chi. Cung dung de xac thuc WIF o man dang nhap.
// ---------------------------------------------------------------------------
app.post(
  '/api/addresses',
  wrap((req, res) => {
    const kp = keyFrom(req.body);
    const { derived } = addressIndex(kp);
    req.log(`mo vi: pubkey ${logShort(Buffer.from(kp.publicKey).toString('hex'), 8, 4)} -> 4 dia chi`);
    res.json({
      network: NETWORK_NAME,
      publicKey: Buffer.from(kp.publicKey).toString('hex'),
      addresses: ADDRESS_KEYS.map((k) => ({
        key: k,
        type: derived[k].type,
        address: derived[k].address,
      })),
    });
  })
);

// Tao vi moi ngau nhien.
app.post(
  '/api/genkey',
  wrap((req, res) => {
    const kp = loadKeyPair();
    const { derived } = addressIndex(kp);
    req.log(`tao vi moi: ${derived.p2wpkh.address}`);
    res.json({
      wif: kp.toWIF(),
      publicKey: Buffer.from(kp.publicKey).toString('hex'),
      addresses: ADDRESS_KEYS.map((k) => ({
        key: k,
        type: derived[k].type,
        address: derived[k].address,
      })),
    });
  })
);

// ---------------------------------------------------------------------------
// Buoc 2: quet UTXO tren ca 4 dia chi.
// ---------------------------------------------------------------------------
app.post(
  '/api/utxos',
  wrap(async (req, res) => {
    const kp = keyFrom(req.body);
    const { index } = addressIndex(kp);
    const t = req.timer();
    const utxos = await scanAllUtxos(index);
    const byType = utxos.reduce((m, u) => ({ ...m, [u.type]: (m[u.type] || 0) + 1 }), {});
    req.log(
      `quet 4 dia chi: ${utxos.length} UTXO` +
        (utxos.length ? ` [${Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(' ')}]` : '') +
        ` = ${utxos.reduce((s, u) => s + u.value, 0)} sat (${t()}ms)`
    );
    res.json({
      utxos,
      total: utxos.reduce((s, u) => s + u.value, 0),
      confirmedTotal: utxos.filter((u) => u.confirmed).reduce((s, u) => s + u.value, 0),
    });
  })
);

// ---------------------------------------------------------------------------
// Buoc 3-8: dung + ky giao dich. broadcast=false -> chi xem truoc (dry-run).
// ---------------------------------------------------------------------------
app.post(
  '/api/build',
  wrap(async (req, res) => {
    const kp = keyFrom(req.body);
    const { derived, index } = addressIndex(kp);

    const recipients = (req.body.recipients || []).map((r) => {
      const value = Number(r.value);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`So sat khong hop le cho ${r.address}: ${r.value}`);
      }
      const type = classifyAddress(r.address);
      // Chan tu day thay vi de Bitcoin Core tu choi luc broadcast voi loi
      // "dust, tx with dust output must be 0-fee" — luc do da ky xong roi.
      const min = dustThreshold(type);
      if (value < min) {
        throw new Error(
          `${value} sat duoi nguong dust cho dia chi ${type} (toi thieu ${min} sat). ` +
            `Output nho hon nguong nay ton phi de tieu hon ca gia tri no mang, nen mang luoi tu choi.`
        );
      }
      return { address: r.address, value, type };
    });
    if (!recipients.length) throw new Error('Chua co nguoi nhan nao.');

    const target = recipients.reduce((s, r) => s + r.value, 0);
    req.log(
      `nguoi nhan: ${recipients.map((r) => `${r.value} sat -> ${r.type}`).join(', ')}` +
        ` (tong ${target} sat)`
    );

    const feeRate = Number(req.body.feeRate) || (await fetchFeeRate());
    req.log(`phi thi truong: ${feeRate} sat/vByte`);

    // Buoc 2
    let t = req.timer();
    const all = await scanAllUtxos(index);
    const spendable = all.filter((u) => u.confirmed);
    req.log(
      `quet UTXO: ${all.length} tim thay, ${spendable.length} confirmed (${t()}ms)`
    );
    if (!spendable.length) throw new Error('Khong co UTXO confirmed de chi tieu.');

    // Buoc 3 — tra ve ca .trace de UI hien thi ly do chon
    const selection = selectCoins({
      utxos: spendable,
      target,
      feeRate,
      changeType: 'p2wpkh',
      destOutputs: recipients,
    });
    req.log(
      `coin selection: ${selection.inputs.length} input sau ${selection.trace.steps.length} vong,` +
        ` phi ${selection.fee} sat, change ${selection.change} sat`
    );

    // Gan lai payment (selectCoins tra ve chinh object utxo, nhung ta doc tu
    // `all` da bo payment de JSON hoa duoc) va lay raw tx cho input Legacy.
    const inputs = selection.inputs.map((u) => ({ ...u, payment: index[u.address].payment }));
    for (const inp of inputs) {
      if (inp.type === 'p2pkh') {
        t = req.timer();
        inp.nonWitnessUtxo = await fetchTxHex(inp.txid);
        req.log(
          `raw tx cho input Legacy ${logShort(inp.txid, 8, 4)}:` +
            ` ${inp.nonWitnessUtxo.length / 2} byte (${t()}ms)`
        );
      }
    }

    const changeAddress = derived.p2wpkh.address;
    const outputs = recipients.map((r) => ({ address: r.address, value: r.value }));
    if (selection.change > 0) outputs.push({ address: changeAddress, value: selection.change });

    // Buoc 4-7
    t = req.timer();
    const signed = buildAndSign({ keyPair: kp, inputs, outputs });
    req.log(
      `ky ${inputs.length} input: ` +
        inputs.map((i) => `${i.type}(${i.type === 'p2tr' ? 'Schnorr' : 'ECDSA'})`).join(', ') +
        ` (${t()}ms)`
    );
    req.log(
      `txid ${logShort(signed.txid, 8, 4)}  vsize ${signed.vsize} vB  raw ${signed.hex.length / 2} byte`
    );

    const result = {
      feeRate,
      fee: selection.fee,
      change: selection.change,
      changeAddress,
      target,
      inputs: inputs.map(({ txid, vout, value, type, address }) => ({
        txid,
        vout,
        value,
        type,
        address,
      })),
      outputs: outputs.map((o, i) => ({
        ...o,
        isChange: selection.change > 0 && i === outputs.length - 1,
      })),
      trace: selection.trace,
      hex: signed.hex,
      txid: signed.txid,
      vsize: signed.vsize,
      weight: signed.weight,
      broadcast: false,
    };

    // Buoc 8
    if (req.body.broadcast) {
      t = req.timer();
      result.txid = await broadcast(signed.hex);
      result.broadcast = true;
      req.log(`PHAT SONG -> ${result.txid} (${t()}ms)`);

      if (USE_RPC) {
        // regtest khong ai dao ho -> tu dao 1 block de confirm.
        const { mineBlocks, getChainInfo } = await requireRpc();
        await mineBlocks(1);
        const info = await getChainInfo();
        result.mined = true;
        req.log(`dao 1 block de xac nhan -> height ${info.blocks}`);
      }
    } else {
      req.log('dry-run: khong phat song');
    }

    res.json(result);
  })
);

// ---------------------------------------------------------------------------
// Dieu khien node local (chi regtest).
// ---------------------------------------------------------------------------
app.post(
  '/api/mine',
  wrap(async (req, res) => {
    const { mineBlocks, getChainInfo } = await requireRpc();
    const n = Number(req.body.blocks || 1);
    if (!Number.isInteger(n) || n <= 0 || n > 1000) {
      throw new Error(`So block khong hop le: ${req.body.blocks} (1-1000).`);
    }
    const t = req.timer();
    const hashes = await mineBlocks(n, req.body.address || null);
    const info = await getChainInfo();
    req.log(`dao ${hashes.length} block -> height ${info.blocks} (${t()}ms)`);
    res.json({ mined: hashes.length, blocks: info.blocks, lastHash: hashes[hashes.length - 1] });
  })
);

app.post(
  '/api/faucet',
  wrap(async (req, res) => {
    const { getMinerBalance, sendFromMiner, mineBlocks } = await requireRpc();
    const kp = keyFrom(req.body);
    const { derived } = addressIndex(kp);

    // Hai cach goi:
    //   { targets: [{ key: 'p2tr', value: 500000 }, ...] }  -> rot co chon loc
    //   { value: 1000000 }                                  -> rot ca 4 (mac dinh)
    const requested = Array.isArray(req.body.targets) && req.body.targets.length
      ? req.body.targets
      : ADDRESS_KEYS.map((key) => ({ key, value: req.body.value }));

    const chosen = requested.map((t) => {
      if (!ADDRESS_KEYS.includes(t.key)) {
        throw new Error(`Loai dia chi khong hop le: ${t.key}. Chon: ${ADDRESS_KEYS.join(', ')}.`);
      }
      const value = Number(t.value ?? req.body.value ?? 1_000_000);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`So sat khong hop le cho ${t.key}: ${t.value}`);
      }
      return { key: t.key, type: derived[t.key].type, address: derived[t.key].address, value };
    });

    // Mot dia chi xuat hien 2 lan se ghi de nhau trong map gui tien -> chan tu dau.
    const seen = new Set();
    for (const c of chosen) {
      if (seen.has(c.key)) throw new Error(`Loai dia chi bi lap: ${c.key}`);
      seen.add(c.key);
    }

    const total = chosen.reduce((s, c) => s + c.value, 0);
    req.log(`rot vao: ${chosen.map((c) => `${c.key}:${c.value}`).join(' ')} (tong ${total} sat)`);

    const balance = await getMinerBalance();
    req.log(`so du vi miner: ${balance} sat`);
    if (balance < total) {
      throw new Error(
        `Vi miner chi co ${balance} sat, can ${total} sat. Hay dao them block truoc.`
      );
    }

    const targets = Object.fromEntries(chosen.map((c) => [c.address, c.value]));
    let t = req.timer();
    const txid = await sendFromMiner(targets);
    req.log(`gui tu vi miner -> ${txid} (${t()}ms)`);

    t = req.timer();
    await mineBlocks(1);
    req.log(`dao 1 block de xac nhan (${t()}ms)`);

    res.json({ txid, total, targets: chosen });
  })
);

// ---------------------------------------------------------------------------
// Phuc vu ban build cua giao dien (neu da chay `npm run web:build`).
// ---------------------------------------------------------------------------
const dist = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Bat loi phat sinh TRUOC khi vao handler (vd body khong phai JSON hop le,
// do express.json() nem ra). Khong co cai nay, Express tra ve trang HTML
// kem stack trace — UI khong doc duoc.
app.use((err, _req, res, _next) => {
  res.status(err.status || 400).json({ error: err.message || 'Yeu cau khong hop le.' });
});

// Chi lang nghe tren localhost — private key khong duoc ra khoi may.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API + web:  http://127.0.0.1:${PORT}`);
  console.log(`Mang     :  ${NETWORK_NAME}${USE_RPC ? ` (bitcoind ${API_BASE})` : ` (${API_BASE})`}`);
  if (!fs.existsSync(dist)) {
    console.log('\nChua co ban build cua giao dien.');
    console.log('  Dev  : mo them terminal chay  npm run web:dev   -> http://localhost:5173');
    console.log('  Build: npm run web:build  roi mo lai dia chi tren.');
  }
});
