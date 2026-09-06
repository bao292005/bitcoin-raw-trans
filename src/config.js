// Cau hinh mang luoi va API endpoint.
import * as bitcoin from 'bitcoinjs-lib';

// Mac dinh chay tren testnet. Doi bien moi truong NETWORK=mainnet neu can (KHONG khuyen khich).
export const NETWORK_NAME = process.env.NETWORK || 'testnet';

export const network =
  NETWORK_NAME === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

// mempool.space REST API. Testnet mac dinh dung /testnet (testnet3).
// Co the doi sang testnet4 hoac signet qua bien moi truong API_BASE.
const DEFAULT_BASE =
  NETWORK_NAME === 'mainnet'
    ? 'https://mempool.space/api'
    : 'https://mempool.space/testnet/api';

export const API_BASE = process.env.API_BASE || DEFAULT_BASE;

// So xac nhan phi mac dinh (sat/vByte) neu API fee that bai.
export const FALLBACK_FEE_RATE = Number(process.env.FEE_RATE || 2);
