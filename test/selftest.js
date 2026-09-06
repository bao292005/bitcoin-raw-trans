// Self-test: ky & serialize giao dich chi tieu ca 4 loai input (khong can tien that).
// Tao cac UTXO "gia" (mock prev tx) roi chay buildAndSign, xac minh chu ky hop le.
import * as bitcoin from 'bitcoinjs-lib';
import { network } from '../src/config.js';
import { loadKeyPair, deriveAddresses } from '../src/wallet.js';
import { buildAndSign } from '../src/tx.js';

const kp = loadKeyPair();
const d = deriveAddresses(kp);
const types = [d.p2pkh, d.p2sh, d.p2wpkh, d.p2tr];

const VALUE = 100000; // 100k sat moi UTXO

// Tao mot prev tx gia tra tien vao 'output script' cho truoc.
function mockPrevTx(outputScript) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32, 0), 0xffffffff); // input rong (coinbase-like)
  tx.addOutput(outputScript, VALUE);
  return tx;
}

const inputs = types.map((t) => {
  const prev = mockPrevTx(t.payment.output);
  return {
    txid: prev.getId(),
    vout: 0,
    value: VALUE,
    type: t.type,
    payment: t.payment,
    nonWitnessUtxo: prev.toHex(), // chi Legacy dung, cac loai khac bo qua
  };
});

const totalIn = VALUE * inputs.length;
const fee = 2000;
const outputs = [{ address: d.p2wpkh.address, value: totalIn - fee }];

const res = buildAndSign({ keyPair: kp, inputs, outputs });

console.log('OK - Ky thanh cong ca 4 loai input:');
inputs.forEach((i) => console.log('   -', i.type));
console.log('txid :', res.txid);
console.log('vsize:', res.vsize, 'vByte');
console.log('hex  :', res.hex.slice(0, 80) + '...');
console.log('\nSelf-test PASSED.');
