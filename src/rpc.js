// JSON-RPC client toi bitcoind (dung cho NETWORK=regtest).
//
// Khac voi REST Esplora (chi doc), RPC cho phep ta DIEU KHIEN mang luoi:
// tu dao block, tu tao vi miner, tu phat tien (faucet). Nho vay ca vong doi
// giao dich chay duoc offline, khong phu thuoc faucet cong cong.
import { RPC_URL, RPC_USER, RPC_PASS, RPC_WALLET } from './config.js';

const auth = 'Basic ' + Buffer.from(`${RPC_USER}:${RPC_PASS}`).toString('base64');

// Goi mot lenh RPC. walletName != null -> goi vao endpoint cua vi (/wallet/<ten>).
export async function rpc(method, params = [], walletName = null) {
  const url = walletName ? `${RPC_URL}/wallet/${walletName}` : RPC_URL;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'btc', method, params }),
      signal: AbortSignal.timeout(30000), // scantxoutset co the cham
    });
  } catch (err) {
    throw new Error(
      `Khong ket noi duoc bitcoind tai ${RPC_URL} (${err.message}).\n` +
        `  Kiem tra node da chay chua: npm run node:start`
    );
  }

  // bitcoind tra loi RPC trong body ke ca khi HTTP status 500 -> doc body truoc.
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`bitcoind tra ve phan hoi khong hop le (HTTP ${res.status}): ${text}`);
  }

  if (body.error) {
    const e = new Error(`RPC ${method} loi ${body.error.code}: ${body.error.message}`);
    e.rpcCode = body.error.code;
    throw e;
  }
  return body.result;
}

// Goi RPC tren vi miner.
export const rpcWallet = (method, params = []) => rpc(method, params, RPC_WALLET);

// Dam bao mot vi ton tai, da duoc nap, VA nam trong danh sach tu-nap khi
// bitcoind khoi dong lai. Goi nhieu lan van an toan.
//
// watchOnly=true -> vi khong giu private key (chi theo doi dia chi).
async function ensureWalletNamed(name, watchOnly = false) {
  const loaded = await rpc('listwallets');

  if (loaded.includes(name)) {
    // Vi dang nap nhung CHUA chac nam trong settings.json. Chi co loadwallet /
    // unloadwallet moi ghi duoc co load_on_startup, nen phai nha ra roi nap lai.
    // Neu khong, restart node la vi bien mat khoi listwallets.
    await rpc('unloadwallet', [name, /* load_on_startup */ true]);
  }

  try {
    await rpc('loadwallet', [name, /* load_on_startup */ true]);
  } catch (err) {
    // -18: chua ton tai tren dia -> tao moi.
    if (err.rpcCode === -18) {
      await rpc('createwallet', [
        name,
        /* disable_private_keys */ watchOnly,
        /* blank */ false,
        /* passphrase */ '',
        /* avoid_reuse */ false,
        /* descriptors */ true,
        /* load_on_startup */ true,
      ]);
    } else {
      throw err;
    }
  }
  return name;
}

// Vi miner: dao block va lam nguon tien cho faucet. Co private key.
export const ensureWallet = () => ensureWalletNamed(RPC_WALLET, false);

// Lay mot dia chi cua vi miner de nhan thuong dao block.
export async function getMinerAddress() {
  await ensureWallet();
  return rpcWallet('getnewaddress', ['miner']);
}

// Dao n block, thuong tra ve dia chi cho truoc (mac dinh: dia chi vi miner).
// Tra ve mang block hash.
export async function mineBlocks(n, address = null) {
  const target = address || (await getMinerAddress());
  return rpc('generatetoaddress', [n, target]);
}

// Thong tin chuoi hien tai (chieu cao block, ...).
export async function getChainInfo() {
  return rpc('getblockchaininfo');
}

// So du kha dung cua vi miner, don vi satoshi.
export async function getMinerBalance() {
  await ensureWallet();
  const btc = await rpcWallet('getbalance');
  return Math.round(btc * 1e8);
}

// --- Vi CHI-XEM (watch-only) ---------------------------------------------
//
// Muc dich: de Bitcoin Core (nhat la ban giao dien Bitcoin-Qt) nhin thay so du
// va lich su giao dich cua vi ma cong cu nay dang dung.
//
// "Chi-xem" = nap DESCRIPTOR suy tu PUBLIC key, khong co private key. Core theo
// doi duoc dia chi va hien giao dich, nhung khong ky duoc. Viec ky van do
// src/tx.js dam nhan.

// Vi CHI-XEM: khong co private key, chi theo doi dia chi de hien thi.
export const ensureWatchWallet = (name) => ensureWalletNamed(name, true);

// Them checksum cho descriptor (Core bat buoc phai co).
async function withChecksum(desc) {
  const info = await rpc('getdescriptorinfo', [desc]);
  return info.descriptor;
}

// Nap 4 descriptor ung voi 4 loai dia chi suy tu MOT public key.
// timestamp 0 -> Core quet lai tu block dau, nen thay ca giao dich cu.
export async function importWatchDescriptors(name, pubkeyHex) {
  const raw = [
    `pkh(${pubkeyHex})`,        // Legacy P2PKH
    `sh(wpkh(${pubkeyHex}))`,   // Nested SegWit
    `wpkh(${pubkeyHex})`,       // Native SegWit
    `tr(${pubkeyHex})`,         // Taproot
  ];

  const requests = [];
  for (const d of raw) {
    requests.push({
      desc: await withChecksum(d),
      timestamp: 0,
      active: false,
      internal: false,
      label: 'bitcoin-raw-trans',
    });
  }

  const results = await rpc('importdescriptors', [requests], name);
  const failed = results.filter((r) => !r.success);
  if (failed.length) {
    throw new Error(
      `Nap descriptor that bai: ${failed.map((f) => f.error?.message || '?').join('; ')}`
    );
  }
  return results.length;
}

// Tom tat vi chi-xem: so du (sat) va so giao dich da thay.
export async function watchSummary(name) {
  const balances = await rpc('getbalances', [], name);
  const txs = await rpc('listtransactions', ['*', 1000], name);
  return {
    balance: Math.round((balances.mine?.trusted ?? 0) * 1e8),
    pending: Math.round((balances.mine?.untrusted_pending ?? 0) * 1e8),
    txCount: txs.length,
  };
}

// Gui tien tu vi miner toi nhieu dia chi trong MOT giao dich.
// targets: { [address]: satoshi }. Tra ve txid.
export async function sendFromMiner(targets) {
  await ensureWallet();
  const outputs = Object.entries(targets).map(([address, sat]) => ({
    [address]: (sat / 1e8).toFixed(8),
  }));
  // send() tu chon coin + tra tien thoi ve vi miner.
  const res = await rpcWallet('send', [outputs]);
  return res.txid;
}
