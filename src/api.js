// BUOC 2 & 8: Giao tiep voi mang luoi.
//
// Co 2 backend cung mot interface — phan con lai cua chuong trinh
// (index.js, tx.js) khong can biet dang chay tren backend nao:
//
//   regtest          -> bitcoind JSON-RPC  (mang local, tu dao block)
//   testnet/mainnet  -> REST Esplora       (blockstream.info / mempool.space)
import { USE_RPC } from './config.js';
import * as bitcoind from './backend/bitcoind.js';
import * as esplora from './backend/esplora.js';

const backend = USE_RPC ? bitcoind : esplora;

export const { fetchUtxos, fetchTxHex, fetchFeeRate, broadcast } = backend;
