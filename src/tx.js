// BUOC 4-7: Tao giao dich chua ky -> Bam & Ky -> Ghep chu ky -> Serialize.
//
// Dung PSBT (Partially Signed Bitcoin Transaction, BIP174) lam khung chuan.
// PSBT tu dong lo phan tinh Sighash dung chuan cho tung loai input, ky
// canonical (low-S cho ECDSA, tranh malleability), va dat chu ky vao dung cho
// (scriptSig cho Legacy, witness cho SegWit/Taproot).
import * as bitcoin from 'bitcoinjs-lib';
import { network } from './config.js';
import { toXOnly } from './wallet.js';
import { explainManualPipeline } from './debug/inspect.js';

// Tao signer da "tweak" cho Taproot key-path spend (BIP341).
// Public key noi bo duoc tweak bang taggedHash('TapTweak', xOnlyPubkey).
function tweakTaprootSigner(keyPair) {
  const xOnly = toXOnly(Buffer.from(keyPair.publicKey));
  const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnly);
  return keyPair.tweak(tweak);
}

// inputs: [{ txid, vout, value, type, payment, nonWitnessUtxo? }]
// outputs: [{ address, value }]
// debug=true -> "mo nap" tung buoc (tu tinh sighash, tu ky, doi chieu voi PSBT).
export function buildAndSign({ keyPair, inputs, outputs, debug = false }) {
  const psbt = new bitcoin.Psbt({ network });

  // --- BUOC 4: Dinh hinh cau truc giao dich chua ky (inputs + outputs) ---
  for (const inp of inputs) {
    const base = { hash: inp.txid, index: inp.vout };

    if (inp.type === 'p2pkh') {
      // Legacy: bat buoc cung cap RAW tx truoc (nonWitnessUtxo) de tinh sighash.
      base.nonWitnessUtxo = Buffer.from(inp.nonWitnessUtxo, 'hex');
    } else if (inp.type === 'p2sh-p2wpkh') {
      // Nested SegWit: witnessUtxo + redeemScript (chinh la script p2wpkh).
      base.witnessUtxo = { script: inp.payment.output, value: inp.value };
      base.redeemScript = inp.payment.redeem.output;
    } else if (inp.type === 'p2wpkh') {
      // Native SegWit: chi can witnessUtxo (script + value).
      base.witnessUtxo = { script: inp.payment.output, value: inp.value };
    } else if (inp.type === 'p2tr') {
      // Taproot: witnessUtxo + internal pubkey (x-only) de ky Schnorr key-path.
      base.witnessUtxo = { script: inp.payment.output, value: inp.value };
      base.tapInternalKey = toXOnly(Buffer.from(keyPair.publicKey));
    } else {
      throw new Error(`Loai input khong ho tro: ${inp.type}`);
    }

    psbt.addInput(base);
  }

  for (const out of outputs) {
    psbt.addOutput({ address: out.address, value: out.value });
  }

  // --- BUOC 5 & 6: Bam (Sighash) + Ky + ghep chu ky vao dung cho ---
  inputs.forEach((inp, i) => {
    if (inp.type === 'p2tr') {
      // Schnorr signing voi khoa da tweak (key-path spend).
      psbt.signInput(i, tweakTaprootSigner(keyPair));
    } else {
      // ECDSA signing (Legacy / SegWit). bitcoinjs mac dinh ky low-S canonical.
      psbt.signInput(i, keyPair);
    }
  });

  // Xac minh chu ky truoc khi finalize (chan sai sot).
  // Luu y: chu ky ECDSA (compact) va Schnorr deu dai 64 byte -> khong the phan
  // biet qua do dai. Ta xac minh theo dung loai input da biet.
  inputs.forEach((inp, i) => {
    const v = inp.type === 'p2tr' ? schnorrValidator : ecdsaValidator;
    if (!psbt.validateSignaturesOfInput(i, v)) {
      throw new Error(`Chu ky input #${i} (${inp.type}) khong hop le.`);
    }
  });

  // Finalize: dong goi scriptSig / witness hoan chinh cho tung input.
  psbt.finalizeAllInputs();

  // --- BUOC 7: Serialize thanh raw hex hoan chinh ---
  const tx = psbt.extractTransaction();
  const hex = tx.toHex();

  // DEBUG SAU: tai dung ca pipeline bang tay va doi chieu voi ket qua PSBT o tren.
  if (debug) explainManualPipeline({ keyPair, inputs, outputs, psbtHex: hex });

  return {
    hex,
    txid: tx.getId(),
    vsize: tx.virtualSize(),
    weight: tx.weight(),
  };
}

// Ham xac minh chu ky.
import * as ecc from 'tiny-secp256k1';
import { ECPair } from './wallet.js';

// ECDSA: dung ECPair de kiem tra chu ky compact 64 byte voi public key 33 byte.
function ecdsaValidator(pubkey, msghash, signature) {
  return ECPair.fromPublicKey(pubkey).verify(msghash, signature);
}

// Schnorr (Taproot): public key rut ve x-only 32 byte.
function schnorrValidator(pubkey, msghash, signature) {
  return ecc.verifySchnorr(msghash, toXOnly(pubkey), signature);
}
