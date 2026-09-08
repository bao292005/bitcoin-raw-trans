// BUOC 2 & 8 (ban REGTEST): giao tiep truc tiep voi bitcoind qua JSON-RPC.
//
// bitcoind KHONG co endpoint kieu Esplora `/address/<addr>/utxo`. Thay vao do ta
// dung `scantxoutset` — quet thang tap UTXO hien tai theo mot "descriptor".
// Uu diem: khong can import vi, khong can rescan, khong can theo doi dia chi tu truoc.
//
// Luu y: scantxoutset chi thay UTXO DA VAO BLOCK (confirmed). Giao dich con nam
// trong mempool se khong xuat hien — tren regtest dieu nay khong thanh van de vi
// ta chu dong dao block sau moi lan gui.
import { rpc } from '../rpc.js';
import { FALLBACK_FEE_RATE } from '../config.js';

// Coinbase (thuong dao block) phai cho du 100 block moi duoc tieu.
const COINBASE_MATURITY = 100;

// bitcoind yeu cau descriptor kem checksum. `addr(<dia_chi>)` hop le cho moi
// loai dia chi (P2PKH / P2SH / bech32 / bech32m) nen khong can phan biet type.
async function addrDescriptor(address) {
  const info = await rpc('getdescriptorinfo', [`addr(${address})`]);
  return info.descriptor; // da kem checksum, vd "addr(bcrt1q...)#xxxxxxxx"
}

// Quet UTXO chua chi thuoc ve mot dia chi.
// Tra ve dung shape ma index.js dang mong doi: { txid, vout, value, status }.
export async function fetchUtxos(address) {
  const desc = await addrDescriptor(address);
  const res = await rpc('scantxoutset', ['start', [desc]]);

  if (!res?.success) {
    throw new Error(`scantxoutset that bai cho ${address}`);
  }

  const tipHeight = res.height;

  return (res.unspents || [])
    .filter((u) => {
      // Loai bo coinbase chua du 100 block — dua vao se bi tu choi khi broadcast.
      if (!u.coinbase) return true;
      return tipHeight - u.height + 1 >= COINBASE_MATURITY;
    })
    .map((u) => ({
      txid: u.txid,
      vout: u.vout,
      // scantxoutset tra ve BTC (so thuc) -> doi ve satoshi (so nguyen).
      value: Math.round(u.amount * 1e8),
      // Da nam trong UTXO set nghia la da confirmed.
      status: { confirmed: true, block_height: u.height },
    }));
}

// Lay raw transaction hex (lam nonWitnessUtxo cho input Legacy P2PKH).
// Can bitcoind chay voi -txindex=1 de tra cuu duoc giao dich bat ky.
export async function fetchTxHex(txid) {
  try {
    return await rpc('getrawtransaction', [txid, false]);
  } catch (err) {
    if (err.rpcCode === -5) {
      throw new Error(
        `Khong tim thay giao dich ${txid}. bitcoind can chay voi -txindex=1.`
      );
    }
    throw err;
  }
}

// Uoc luong phi. Tren regtest khong co lich su phi nen estimatesmartfee luon
// that bai -> dung thang FEE_RATE cau hinh san.
export async function fetchFeeRate() {
  try {
    const est = await rpc('estimatesmartfee', [6]);
    if (est?.feerate > 0) {
      // feerate tra ve BTC/kvB -> doi sang sat/vByte.
      return Math.max(1, Math.ceil((est.feerate * 1e8) / 1000));
    }
  } catch {
    // bo qua, dung fallback
  }
  return FALLBACK_FEE_RATE;
}

// Phat song raw hex. Tra ve txid.
export async function broadcast(txHex) {
  return rpc('sendrawtransaction', [txHex]);
}
