// BUOC 2 & 8: Giao tiep voi mang luoi qua REST API (mempool.space).
//  - Quet UTXO thuoc ve dia chi
//  - Lay raw hex cua giao dich truoc (can cho input Legacy P2PKH)
//  - Uoc luong phi (sat/vByte)
//  - Phat song (broadcast) raw transaction
import { API_BASE, FALLBACK_FEE_RATE } from './config.js';

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function getText(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.text();
}

// Quet tat ca UTXO chua chi thuoc ve mot dia chi.
// Tra ve mang { txid, vout, value(sat), status }.
export async function fetchUtxos(address) {
  return getJson(`/address/${address}/utxo`);
}

// Lay raw transaction hex (dung lam nonWitnessUtxo cho input Legacy).
export async function fetchTxHex(txid) {
  return getText(`/tx/${txid}/hex`);
}

// Uoc luong phi de xac nhan trong ~vai block toi (sat/vByte).
export async function fetchFeeRate() {
  try {
    const fees = await getJson('/v1/fees/recommended');
    return fees.halfHourFee || fees.hourFee || FALLBACK_FEE_RATE;
  } catch {
    return FALLBACK_FEE_RATE;
  }
}

// Phat song raw hex len mang luoi. Tra ve txid.
export async function broadcast(txHex) {
  const res = await fetch(`${API_BASE}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Broadcast that bai (${res.status}): ${body}`);
  return body.trim(); // txid
}
