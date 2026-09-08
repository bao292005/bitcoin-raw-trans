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

// Mac dinh chay tren testnet. Doi bien moi truong NETWORK=mainnet neu can (KHONG khuyen khich).
export const NETWORK_NAME = process.env.NETWORK || 'testnet';

export const network =
  NETWORK_NAME === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

// API REST mặc định: ưu tiên blockstream.info (ổn định, không bị chặn mạng VN/ISP)
const DEFAULT_BASES =
  NETWORK_NAME === 'mainnet'
    ? ['https://blockstream.info/api', 'https://mempool.space/api']
    : ['https://blockstream.info/testnet/api', 'https://mempool.space/testnet/api'];

export const API_BASE = process.env.API_BASE || DEFAULT_BASES[0];
export const API_FALLBACKS = DEFAULT_BASES;

// So xac nhan phi mac dinh (sat/vByte) neu API fee that bai.
export const FALLBACK_FEE_RATE = Number(process.env.FEE_RATE || 2);
