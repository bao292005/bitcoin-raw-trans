// BUOC 2 & 8: Giao tiep voi mang luoi qua REST API (blockstream.info / mempool.space).
//  - Quet UTXO thuoc ve dia chi
//  - Lay raw hex cua giao dich truoc (can cho input Legacy P2PKH)
//  - Uoc luong phi (sat/vByte)
//  - Phat song (broadcast) raw transaction
import { API_BASE, API_FALLBACKS, FALLBACK_FEE_RATE } from './config.js';

async function fetchWithFallback(path, options = {}) {
  const endpoints = process.env.API_BASE
    ? [process.env.API_BASE, ...API_FALLBACKS]
    : API_FALLBACKS;

  const uniqueEndpoints = [...new Set(endpoints)];

  let lastError;
  for (const base of uniqueEndpoints) {
    try {
      const res = await fetch(`${base}${path}`, {
        ...options,
        signal: AbortSignal.timeout(5000), // Timeout 5s tranh treo mạng
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Ket noi API that bai cho ${path}`);
}

async function getJson(path) {
  const res = await fetchWithFallback(path);
  return res.json();
}

async function getText(path) {
  const res = await fetchWithFallback(path);
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
  const res = await fetchWithFallback('/tx', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  });
  const body = await res.text();
  return body.trim(); // txid
}
