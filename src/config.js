// Cau hinh mang luoi va API endpoint.
import * as bitcoin from 'bitcoinjs-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Tu dong load bien moi truong tu file .env (ho tro Node v20.6+)
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootEnv = path.resolve(__dirname, '../.env');
  if (fs.existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  } else {
    process.loadEnvFile();
  }
} catch {
  // Neu khong tim thấy .env hoac moi truong da duoc load, bo qua
}

// Mac dinh chay tren testnet.
//   NETWORK=regtest -> mang local tu dao block qua bitcoind RPC (khong can full node)
//   NETWORK=testnet -> mang thu nghiem cong cong, du lieu qua REST Esplora
//   NETWORK=mainnet -> tien that (KHONG khuyen khich)
export const NETWORK_NAME = process.env.NETWORK || 'testnet';

const NETWORKS = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

export const network = NETWORKS[NETWORK_NAME];
if (!network) {
  throw new Error(`NETWORK khong hop le: ${NETWORK_NAME}. Chon: mainnet | testnet | regtest.`);
}

// regtest khong co Esplora public -> phai noi truc tiep toi bitcoind qua JSON-RPC.
export const USE_RPC = NETWORK_NAME === 'regtest';

// --- Cau hinh JSON-RPC toi bitcoind (chi dung khi USE_RPC) ---
export const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:18443';
export const RPC_USER = process.env.RPC_USER || 'bitcoin';
export const RPC_PASS = process.env.RPC_PASS || 'bitcoin';
// Ten vi trong bitcoind dung lam "miner" (dao block + faucet).
export const RPC_WALLET = process.env.RPC_WALLET || 'miner';

// API REST mặc định: ưu tiên blockstream.info (ổn định, không bị chặn mạng VN/ISP)
const DEFAULT_BASES =
  NETWORK_NAME === 'mainnet'
    ? ['https://blockstream.info/api', 'https://mempool.space/api']
    : ['https://blockstream.info/testnet/api', 'https://mempool.space/testnet/api'];

export const API_BASE = USE_RPC ? RPC_URL : process.env.API_BASE || DEFAULT_BASES[0];
export const API_FALLBACKS = DEFAULT_BASES;

// So xac nhan phi mac dinh (sat/vByte) neu API fee that bai.
// Tren regtest, estimatesmartfee LUON that bai (khong co lich su phi) -> luon dung so nay.
export const FALLBACK_FEE_RATE = Number(process.env.FEE_RATE || 2);
