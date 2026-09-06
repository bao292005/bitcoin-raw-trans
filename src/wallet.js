// BUOC 1: Tu Private Key -> Public Key -> cac loai dia chi (Address Types).
//
// Tu MOT private key duy nhat, ta suy ra public key (dung secp256k1) roi ma hoa
// thanh 4 dinh dang dia chi khac nhau. Ban chat chung deu khoa cung 1 public key,
// chi khac cach dong goi script khoa (locking script).
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { network } from './config.js';

// Khoi tao thu vien: bitcoinjs can ecc de tinh toan tren duong cong elliptic,
// nhat la cho Taproot (tweak khoa, Schnorr).
bitcoin.initEccLib(ecc);
export const ECPair = ECPairFactory(ecc);

// Rut gon public key 33 byte -> 32 byte (x-only) dung cho Taproot/Schnorr.
export const toXOnly = (pubkey) => (pubkey.length === 33 ? pubkey.subarray(1) : pubkey);

// Tao vi tu WIF (Wallet Import Format) hoac tao moi ngau nhien.
export function loadKeyPair(wif) {
  if (wif) return ECPair.fromWIF(wif, network);
  return ECPair.makeRandom({ network });
}

// Sinh du lieu vi (payment) cho ca 4 loai dia chi tu 1 keypair.
export function deriveAddresses(keyPair) {
  const pubkey = Buffer.from(keyPair.publicKey);
  const xOnly = toXOnly(pubkey);

  // 1) Legacy P2PKH  -> dia chi bat dau bang 'm'/'n' (testnet)
  const p2pkh = bitcoin.payments.p2pkh({ pubkey, network });

  // 2) SegWit long trong P2SH (P2SH-P2WPKH) -> dia chi bat dau bang '2' (testnet)
  const p2wpkhForNested = bitcoin.payments.p2wpkh({ pubkey, network });
  const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkhForNested, network });

  // 3) Native SegWit bech32 (P2WPKH) -> dia chi bat dau bang 'tb1q'
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network });

  // 4) Taproot (P2TR, key-path) -> dia chi bat dau bang 'tb1p'
  const p2tr = bitcoin.payments.p2tr({ internalPubkey: xOnly, network });

  return {
    p2pkh: { type: 'p2pkh', payment: p2pkh, address: p2pkh.address },
    p2sh: { type: 'p2sh-p2wpkh', payment: p2sh, address: p2sh.address },
    p2wpkh: { type: 'p2wpkh', payment: p2wpkh, address: p2wpkh.address },
    p2tr: { type: 'p2tr', payment: p2tr, address: p2tr.address },
  };
}

// Tra ve map: address -> metadata (type + payment) de tra cuu khi ky UTXO.
export function addressIndex(keyPair) {
  const derived = deriveAddresses(keyPair);
  const index = {};
  for (const k of Object.keys(derived)) {
    index[derived[k].address] = derived[k];
  }
  return { derived, index };
}
