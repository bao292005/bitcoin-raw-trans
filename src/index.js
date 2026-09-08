#!/usr/bin/env node
// CLI dieu phoi toan bo 8 buoc quy trinh tren testnet.
//
//   node src/index.js genkey                 -> tao private key (WIF) moi
//   node src/index.js addr <WIF>             -> in 4 loai dia chi tu private key
//   node src/index.js balance <WIF>          -> quet UTXO & so du tren cac dia chi
//   node src/index.js send <WIF> <to> <sat> [--broadcast]
//
// Rieng NETWORK=regtest (mang local qua bitcoind RPC) co them:
//   node src/index.js init                   -> tao vi miner + dao 101 block khoi dong
//   node src/index.js mine <n> [dia_chi]     -> dao n block
//   node src/index.js faucet <WIF> [sat]     -> rot tien vao CA 4 dia chi
//
// Private key co the truyen qua tham so hoac bien moi truong PRIVATE_KEY.
import { network, NETWORK_NAME, API_BASE, USE_RPC } from './config.js';
import { loadKeyPair, addressIndex } from './wallet.js';
import { fetchUtxos, fetchTxHex, fetchFeeRate, broadcast } from './api.js';
import { selectCoins, dustThreshold } from './coinselect.js';
import { buildAndSign } from './tx.js';
import {
  explainAddresses,
  explainUtxoScan,
  explainCoinSelection,
  explainBroadcastRequest,
} from './debug/inspect.js';
import * as bitcoin from 'bitcoinjs-lib';

const fmt = (sat) => `${sat} sat (${(sat / 1e8).toFixed(8)} BTC)`;

// Phan loai dia chi -> type de uoc luong kich thuoc output.
function classifyAddress(addr) {
  try {
    bitcoin.address.toOutputScript(addr, network); // xac minh hop le
  } catch {
    throw new Error(`Dia chi khong hop le tren ${NETWORK_NAME}: ${addr}`);
  }
  if (/^(bc1p|tb1p|bcrt1p)/.test(addr)) return 'p2tr';
  if (/^(bc1q|tb1q|bcrt1q)/.test(addr)) return 'p2wpkh';
  if (/^[2]/.test(addr) || /^3/.test(addr)) return 'p2sh-p2wpkh';
  return 'p2pkh';
}

// Quet UTXO tren ca 4 dia chi, gan them type + payment de biet cach ky.
async function scanAllUtxos(index) {
  const all = [];
  for (const [address, meta] of Object.entries(index)) {
    const utxos = await fetchUtxos(address);
    for (const u of utxos) {
      all.push({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        confirmed: u.status?.confirmed ?? false,
        type: meta.type,
        payment: meta.payment,
        address,
      });
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Cac lenh chi danh cho mang local (regtest): dieu khien node qua RPC.
// ---------------------------------------------------------------------------

// Nap lazy de testnet/mainnet khong phai dinh toi module rpc.
async function requireRegtest() {
  if (!USE_RPC) {
    throw new Error(
      `Lenh nay chi dung duoc tren mang local. Dat NETWORK=regtest trong .env (dang la: ${NETWORK_NAME}).`
    );
  }
  return import('./rpc.js');
}

// Coinbase phai cho 100 block moi tieu duoc -> dao 101 block la co tien ngay.
const INIT_BLOCKS = 101;

async function cmdInit() {
  const { ensureWallet, getMinerAddress, mineBlocks, getChainInfo, getMinerBalance } =
    await requireRegtest();

  console.log('== Khoi dong mang local (regtest) ==');
  const wallet = await ensureWallet();
  console.log(`  Vi miner: "${wallet}"`);

  const minerAddr = await getMinerAddress();
  console.log(`  Dia chi nhan thuong dao: ${minerAddr}`);

  const before = await getChainInfo();
  console.log(`  Chieu cao hien tai: ${before.blocks}`);

  const need = Math.max(0, INIT_BLOCKS - before.blocks);
  if (need > 0) {
    console.log(`  Dao ${need} block (coinbase can ${INIT_BLOCKS - 1} block de chin)...`);
    await mineBlocks(need, minerAddr);
  } else {
    console.log('  Da du block, khong can dao them.');
  }

  const after = await getChainInfo();
  console.log(`\n  Chieu cao moi : ${after.blocks}`);
  console.log(`  So du miner   : ${fmt(await getMinerBalance())}`);
  console.log('\nSan sang. Buoc tiep: node src/index.js faucet <WIF>');
}

async function cmdMine(nArg, address) {
  const { mineBlocks, getChainInfo } = await requireRegtest();
  const n = Number(nArg || 1);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`So block khong hop le: ${nArg}`);

  const hashes = await mineBlocks(n, address || null);
  const info = await getChainInfo();
  console.log(`Da dao ${hashes.length} block. Chieu cao: ${info.blocks}`);
  console.log(`  Block cuoi: ${hashes[hashes.length - 1]}`);
}

// Cac loai dia chi co the rot tien vao. Ten khoa nhu trong deriveAddresses().
const ADDRESS_KEYS = ['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'];

// Doc co --only=p2tr,p2wpkh (hoac --only p2tr,p2wpkh) -> danh sach khoa.
// Khong co co -> ca 4 loai.
function parseOnly(onlyArg) {
  if (!onlyArg) return ADDRESS_KEYS;

  const keys = onlyArg
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!keys.length) throw new Error('--only rong. Vi du: --only p2tr,p2wpkh');

  for (const k of keys) {
    if (!ADDRESS_KEYS.includes(k)) {
      throw new Error(`Loai dia chi khong hop le: "${k}". Chon: ${ADDRESS_KEYS.join(', ')}.`);
    }
  }
  return [...new Set(keys)];
}

async function cmdFaucet(wif, satArg, onlyArg) {
  const { getMinerBalance, sendFromMiner, mineBlocks } = await requireRegtest();

  const perAddress = Number(satArg || 1_000_000); // mac dinh 0.01 BTC moi dia chi
  if (!Number.isInteger(perAddress) || perAddress <= 0) {
    throw new Error(`So sat khong hop le: ${satArg}`);
  }

  const keys = parseOnly(onlyArg);
  const kp = loadKeyPair(wif);
  const { derived } = addressIndex(kp);

  const balance = await getMinerBalance();
  const total = perAddress * keys.length;
  if (balance < total) {
    throw new Error(
      `Vi miner chi co ${fmt(balance)}, can ${fmt(total)}. Chay 'node src/index.js init' hoac dao them block.`
    );
  }

  // Gui toi cac dia chi da chon trong MOT giao dich.
  const targets = {};
  for (const k of keys) targets[derived[k].address] = perAddress;

  console.log(
    `== Faucet: rot ${fmt(perAddress)} vao ${keys.length}/${ADDRESS_KEYS.length} dia chi ==`
  );
  for (const k of keys) {
    console.log(`  [${derived[k].type.padEnd(12)}] ${derived[k].address}`);
  }
  console.log(`  Tong: ${fmt(total)}`);

  const txid = await sendFromMiner(targets);
  console.log(`\n  txid: ${txid}`);

  // Dao 1 block de giao dich duoc confirm (scantxoutset chi thay UTXO da vao block).
  await mineBlocks(1);
  console.log('  Da dao 1 block de xac nhan.');
  console.log('\nKiem tra: node src/index.js balance <WIF>');
}

// Nap vi CHI-XEM vao Bitcoin Core de nhin thay so du/lich su tren giao dien Qt.
// Khong dua private key vao Core — chi descriptor suy tu public key.
async function cmdWatch(wif, nameArg) {
  const { ensureWatchWallet, importWatchDescriptors, watchSummary } = await requireRegtest();

  const kp = loadKeyPair(wif);
  const { derived } = addressIndex(kp);
  const pubkey = Buffer.from(kp.publicKey).toString('hex');
  const name = nameArg || `watch-${pubkey.slice(0, 8)}`;

  console.log('== Nap vi chi-xem vao Bitcoin Core ==');
  console.log(`  Ten vi   : ${name}`);
  console.log(`  Public key: ${pubkey}`);

  await ensureWatchWallet(name);
  console.log('\n  Dang nap 4 descriptor va quet lai chuoi...');
  const n = await importWatchDescriptors(name, pubkey);
  console.log(`  Da nap ${n} descriptor:`);
  for (const k of ADDRESS_KEYS) {
    console.log(`    [${derived[k].type.padEnd(12)}] ${derived[k].address}`);
  }

  const s = await watchSummary(name);
  console.log(`\n  So du    : ${fmt(s.balance)}`);
  if (s.pending) console.log(`  Cho xac nhan: ${fmt(s.pending)}`);
  console.log(`  Giao dich: ${s.txCount}`);

  console.log(`\nMo Bitcoin-Qt tren datadir du an de xem:  npm run node:qt`);
  console.log(`Trong Qt chon vi "${name}" o menu Window > Wallets.`);
}

async function cmdGenkey() {
  const kp = loadKeyPair();
  const { derived } = addressIndex(kp);
  console.log(`== Vi moi (${NETWORK_NAME}) ==`);
  console.log('Private key (WIF):', kp.toWIF());
  console.log('Public key       :', Buffer.from(kp.publicKey).toString('hex'));
  console.log('\nCac dia chi:');
  printAddresses(derived);
}

function printAddresses(derived) {
  console.log('  Legacy P2PKH        :', derived.p2pkh.address);
  console.log('  Nested P2SH-P2WPKH  :', derived.p2sh.address);
  console.log('  Native SegWit P2WPKH:', derived.p2wpkh.address);
  console.log('  Taproot P2TR        :', derived.p2tr.address);
}

async function cmdAddr(wif) {
  const kp = loadKeyPair(wif);
  const { derived } = addressIndex(kp);
  console.log('Public key:', Buffer.from(kp.publicKey).toString('hex'));
  printAddresses(derived);
}

async function cmdBalance(wif, flags = {}) {
  const kp = loadKeyPair(wif);
  const { derived, index } = addressIndex(kp);
  if (flags.debug) explainAddresses(kp, derived);
  console.log(`Dang quet UTXO tren ${API_BASE} ...\n`);
  const utxos = await scanAllUtxos(index);
  if (flags.debug) explainUtxoScan({ apiBase: API_BASE, index, utxos });
  let total = 0;
  for (const u of utxos) {
    total += u.value;
    console.log(
      `  [${u.type}] ${u.txid}:${u.vout}  ${fmt(u.value)}  ${u.confirmed ? 'confirmed' : 'MEMPOOL'}`
    );
  }
  if (!utxos.length) console.log('  (khong co UTXO)');
  console.log(`\nTong so du: ${fmt(total)} tu ${utxos.length} UTXO`);
}

// Chan output duoi nguong dust ngay tu dau, thay vi de mang luoi tu choi
// luc broadcast ("dust, tx with dust output must be 0-fee").
function checkDust(address, value, type) {
  const min = dustThreshold(type);
  if (value < min) {
    throw new Error(
      `${value} sat duoi nguong dust cho dia chi ${type} (toi thieu ${min} sat).\n` +
        `  ${address}\n` +
        `  Output nho hon nguong nay ton phi de tieu hon ca gia tri no mang, nen mang luoi tu choi.`
    );
  }
}

function parseRecipients(args) {
  const recipients = [];
  let i = 0;
  while (i < args.length) {
    const item = args[i];
    if (item.includes(':')) {
      const parts = item.split(':');
      const addr = parts[0];
      const val = Number(parts[1]);
      if (!addr || !Number.isInteger(val) || val <= 0) {
        throw new Error(`Dinh dang khong hop le: ${item}. Dinh dang dung: <dia_chi>:<so_sat>`);
      }
      {
        const type = classifyAddress(addr);
        checkDust(addr, val, type);
        recipients.push({ address: addr, value: val, type });
      }
      i++;
    } else if (i + 1 < args.length && !isNaN(Number(args[i + 1]))) {
      const addr = item;
      const val = Number(args[i + 1]);
      if (!Number.isInteger(val) || val <= 0) {
        throw new Error(`So sat khong hop le cho ${addr}: ${args[i + 1]}`);
      }
      {
        const type = classifyAddress(addr);
        checkDust(addr, val, type);
        recipients.push({ address: addr, value: val, type });
      }
      i += 2;
    } else {
      throw new Error(`Tham so nguoi nhan khong hop le: ${item}`);
    }
  }

  if (!recipients.length) {
    throw new Error('Thieu thong tin nguoi nhan. Vi du: node src/index.js send <WIF> <dia_chi> <so_sat> [dia_chi2 so_sat2 ...]');
  }

  return recipients;
}

async function cmdSend(wif, recipientArgs, flags) {
  const kp = loadKeyPair(wif);
  const { derived, index } = addressIndex(kp);
  const recipients = parseRecipients(recipientArgs);
  const totalTarget = recipients.reduce((s, r) => s + r.value, 0);
  const changeAddress = derived.p2wpkh.address; // tra tien thoi ve dia chi SegWit (output re)

  // DEBUG SAU (Buoc 1): mo nap phan khoa & dia chi truoc khi quet UTXO.
  if (flags.debug) explainAddresses(kp, derived);

  console.log('== Buoc 2: Quet UTXO ==');
  const utxos = await scanAllUtxos(index);
  if (flags.debug) explainUtxoScan({ apiBase: API_BASE, index, utxos });
  const spendable = utxos.filter((u) => u.confirmed);
  console.log(`  Tim thay ${utxos.length} UTXO (${spendable.length} da confirmed, dung de chi).`);
  if (!spendable.length) throw new Error('Khong co UTXO confirmed de chi tieu.');

  const feeRate = await fetchFeeRate();
  console.log(`  Phi thi truong: ${feeRate} sat/vByte`);

  console.log('\n== Buoc 3: Lua chon UTXO (coin selection) ==');
  const selection = selectCoins({
    utxos: spendable,
    target: totalTarget,
    feeRate,
    changeType: 'p2wpkh',
    destOutputs: recipients,
  });
  if (flags.debug) explainCoinSelection(selection.trace);
  console.log(`  Chon ${selection.inputs.length} input, phi ~${fmt(selection.fee)}`);
  selection.inputs.forEach((u) =>
    console.log(`    - [${u.type}] ${u.txid}:${u.vout} ${fmt(u.value)}`)
  );

  console.log('\n== Buoc 4: Lay raw tx cho input Legacy (neu co) ==');
  for (const inp of selection.inputs) {
    if (inp.type === 'p2pkh') {
      inp.nonWitnessUtxo = await fetchTxHex(inp.txid);
      console.log(`  Da lay raw tx ${inp.txid}`);
    }
  }

  const outputs = recipients.map((r) => ({ address: r.address, value: r.value }));
  console.log(`  Gui ${recipients.length} output nguoi nhan (tong: ${fmt(totalTarget)}):`);
  recipients.forEach((r, i) =>
    console.log(`    out[${i}]: ${fmt(r.value)} -> ${r.address} (${r.type})`)
  );

  if (selection.change > 0) {
    outputs.push({ address: changeAddress, value: selection.change });
    console.log(`  Output change: ${fmt(selection.change)} -> ${changeAddress}`);
  } else {
    console.log('  Khong co change (phan du < dust, gop vao phi).');
  }

  console.log('\n== Buoc 5-7: Ky (Sighash + ECDSA/Schnorr) & Serialize ==');
  const { hex, txid, vsize, weight } = buildAndSign({
    keyPair: kp,
    inputs: selection.inputs,
    outputs,
    debug: flags.debug,
  });
  console.log(`  txid (du kien): ${txid}`);
  console.log(`  vsize: ${vsize} vByte | weight: ${weight} WU`);
  console.log('\n  Raw transaction hex:');
  console.log('  ' + hex);

  console.log('\n== Buoc 8: Phat song (Broadcast) ==');
  if (flags.debug) explainBroadcastRequest({ apiBase: API_BASE, hex, willSend: flags.broadcast });
  if (flags.broadcast) {
    const sent = await broadcast(hex);
    console.log(`  DA PHAT SONG! txid: ${sent}`);
    if (USE_RPC) {
      // Tren mang local khong ai dao ho -> tu dao 1 block de giao dich confirm.
      const { mineBlocks } = await import('./rpc.js');
      await mineBlocks(1);
      console.log('  Da dao 1 block -> giao dich da confirmed.');
    } else {
      console.log(`  Xem: ${API_BASE.replace('/api', '')}/tx/${sent}`);
    }
  } else {
    console.log('  (dry-run) Them --broadcast de gui len mang luoi.');
    console.log(
      USE_RPC
        ? '  Hoac tu gui: npm run node:cli -- sendrawtransaction <raw_hex>'
        : `  Hoac tu broadcast hex o tren tai ${API_BASE.replace('/api', '')}/tx/push`
    );
  }
}

function extractWifAndRecipients(args) {
  let wif = process.env.PRIVATE_KEY;
  let recipientArgs = args;

  if (args[0]) {
    try {
      loadKeyPair(args[0]);
      wif = args[0];
      recipientArgs = args.slice(1);
    } catch {
      // args[0] khong phai WIF, dung PRIVATE_KEY tu env
    }
  }

  if (!wif) {
    throw new Error('Thieu private key (WIF). Truyen tham so hoac dat PRIVATE_KEY trong .env.');
  }

  return { wif, recipientArgs };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = { broadcast: rest.includes('--broadcast'), debug: rest.includes('--debug') };

  // Tach co co gia tri: ho tro ca "--only=a,b" lan "--only a,b".
  const args = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--only=')) {
      flags.only = a.slice('--only='.length);
    } else if (a === '--only') {
      flags.only = rest[++i];
    } else if (a.startsWith('--name=')) {
      flags.name = a.slice('--name='.length);
    } else if (a === '--name') {
      flags.name = rest[++i];
    } else if (!a.startsWith('--')) {
      args.push(a);
    }
  }

  try {
    switch (cmd) {
      case 'init':
        return await cmdInit();
      case 'mine':
        return await cmdMine(args[0], args[1]);
      case 'faucet': {
        const { wif, recipientArgs } = extractWifAndRecipients(args);
        return await cmdFaucet(wif, recipientArgs[0], flags.only);
      }
      case 'watch':
        return await cmdWatch(requireWif(args[0] || process.env.PRIVATE_KEY), flags.name);
      case 'genkey':
        return await cmdGenkey();
      case 'addr':
        return await cmdAddr(requireWif(args[0] || process.env.PRIVATE_KEY));
      case 'balance':
        return await cmdBalance(requireWif(args[0] || process.env.PRIVATE_KEY), flags);
      case 'send': {
        const { wif, recipientArgs } = extractWifAndRecipients(args);
        return await cmdSend(wif, recipientArgs, flags);
      }
      default:
        printHelp();
    }
  } catch (e) {
    console.error('\nLOI:', e.message);
    process.exit(1);
  }
}

function requireWif(wif) {
  if (!wif) throw new Error('Thieu private key (WIF). Truyen tham so hoac dat PRIVATE_KEY.');
  return wif;
}

function printHelp() {
  console.log(`bitcoin-raw-trans (mang: ${NETWORK_NAME})
${
  USE_RPC
    ? `
Mang local qua bitcoind RPC (${API_BASE}):
  node src/index.js init                  # tao vi miner + dao 101 block
  node src/index.js mine    <n> [dia_chi] # dao them n block
  node src/index.js faucet  <WIF> [sat]   # rot tien vao ca 4 dia chi
  node src/index.js faucet  <WIF> [sat] --only p2tr,p2wpkh
                                          # chi rot vao loai da chon
                                          # (p2pkh | p2sh | p2wpkh | p2tr)
  node src/index.js watch   <WIF> [--name X]
                                          # nap vi CHI-XEM vao Bitcoin Core
                                          # de xem so du/lich su tren Bitcoin-Qt
`
    : ''
}
Cach dung:
  node src/index.js genkey
  node src/index.js addr    <WIF>
  node src/index.js balance <WIF>
  node src/index.js send    <WIF> <dia_chi> <so_sat> [--broadcast] [--debug]
  node src/index.js send    <WIF> <dia_chi_1> <sat_1> <dia_chi_2> <sat_2> [...] [--broadcast] [--debug]
  node src/index.js send    <WIF> <dia_chi_1>:<sat_1> <dia_chi_2>:<sat_2> [...] [--broadcast] [--debug]

Co --debug: mo nap tung buoc (tu tinh sighash, tu ky, doi chieu voi PSBT).
Private key co the dat qua bien moi truong PRIVATE_KEY thay cho tham so.`);
}

main();
