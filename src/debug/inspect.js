// DEBUG SAU - "Mo nap" tung buoc ma PSBT giau kin.
//
// Module nay TAI DUNG toan bo giao dich BANG TAY (khong qua PSBT):
//   Buoc 4: dung tx chua ky tu inputs/outputs
//   Buoc 5: tu tinh sighash (goi src/debug/sighash-manual.js) + doi chieu ham chuan
//   Buoc 6: tu ky (ECDSA/Schnorr) va tu ghep scriptSig / witness
//   Buoc 7: serialize + tach tung truong
// Cuoi cung so HEX tu tay voi HEX do PSBT tao ra -> phai TRUNG KHOP tung byte.
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { network } from '../config.js';
import { toXOnly } from '../wallet.js';
import {
  legacySighash,
  bip143Sighash,
  bip341Sighash,
  p2wpkhScriptCode,
  u32le,
  u64le,
  varint,
  varSlice,
} from './sighash-manual.js';
import { INPUT_VBYTES, OUTPUT_VBYTES, TX_OVERHEAD, DUST } from '../coinselect.js';

// ---------- Tien ich in an ----------
const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};
const hx = (b) => Buffer.from(b).toString('hex');
const line = (s = '') => console.log(s);
const rule = (title, src) => {
  line();
  line(C.bold(C.cyan(`──────── ${title} ────────`)));
  if (src) line(C.dim(`  ⌘ code: ${src}`));
};
const kv = (label, value) => line(`  ${label.padEnd(20)}: ${value}`);
// In preimage: tung truong co nhan + hex, giup thay ro cau truc chuoi byte.
const printParts = (parts) => {
  for (const p of parts) line(`    ${C.dim(p.label.padEnd(18))} ${p.hex}`);
};
const check = (ok, msg) =>
  line(`  ${ok ? C.green('✓') : C.red('✗')} ${msg}`);

// ======================================================================
// BUOC 1: Private key -> public key -> 4 loai dia chi (locking script).
// ======================================================================
export function explainAddresses(keyPair, derived, { revealSecret = false } = {}) {
  rule('BUOC 1 · Khoa & Dia chi (mot public key, bon cach khoa)',
    'src/wallet.js › loadKeyPair(), deriveAddresses()  (pubkey = d·G qua tiny-secp256k1)');
  const pub = Buffer.from(keyPair.publicKey);
  const xOnly = toXOnly(pub);

  // --- Buoc 1a: private key -> public key (nhan diem tren secp256k1) ---
  line(C.dim('  Buoc 1a: private key -> public key   (public_key = private_key · G)'));
  line(C.dim('           G = diem sinh chuan cua duong cong secp256k1; phep nhan mot chieu.'));
  if (revealSecret) {
    kv('private key (WIF)', keyPair.toWIF());
    kv('private key (32B)', hx(Buffer.from(keyPair.privateKey)));
  } else {
    kv('private key', C.yellow('(an - khong in khi debug tren khoa that)'));
  }
  const uncompressed = Buffer.from(ecc.pointCompress(pub, false)); // 65B: 04 || x || y
  kv('pubkey day du (65B)', '04 ' + hx(uncompressed.subarray(1, 33)) + ' ' + hx(uncompressed.subarray(33)));
  line(C.dim('                       prefix 04    x (32B)                          y (32B)'));
  kv('-> nen (33B)', hx(pub) + C.dim(`  (prefix ${pub[0] === 3 ? '03 = y LE' : '02 = y CHAN'}, bo toa do y)`));

  line();
  kv('public key (33B)', hx(pub));
  kv('x-only (32B)', hx(xOnly));
  kv('hash160(pubkey)', hx(bitcoin.crypto.hash160(pub)) + C.dim('  (dung cho P2PKH/P2WPKH)'));

  line();
  line(C.dim('  Moi dia chi = mot scriptPubKey (khoa) khac nhau cho CUNG public key:'));
  const rows = [
    ['P2PKH   (Legacy)', derived.p2pkh],
    ['P2SH-P2WPKH', derived.p2sh],
    ['P2WPKH  (SegWit)', derived.p2wpkh],
    ['P2TR    (Taproot)', derived.p2tr],
  ];
  for (const [name, d] of rows) {
    line(`  ${C.yellow(name.padEnd(18))} ${d.address}`);
    line(`    ${C.dim('scriptPubKey')} ${hx(d.payment.output)}`);
  }

  // Taproot: chung minh khoa dau ra = khoa noi bo da "tweak".
  line();
  line(C.dim('  Taproot tweak (BIP341): output_key = internal_key + taggedHash(TapTweak, internal_key)·G'));
  const tweak = bitcoin.crypto.taggedHash('TapTweak', xOnly);
  kv('  internal key', hx(xOnly));
  kv('  tweak scalar', hx(tweak));
  kv('  output key', hx(derived.p2tr.payment.pubkey) + C.dim('  (nam trong scriptPubKey tb1p)'));
}

// ======================================================================
// BUOC 2: Quet UTXO tren tung dia chi (goi REST API mempool.space).
// index = { address: {type,...} }, utxos = mang phang da gan .address/.confirmed
// ======================================================================
export function explainUtxoScan({ apiBase, index, utxos }) {
  rule('BUOC 2 · Quet UTXO (goi REST API cho tung dia chi)',
    'src/api.js › fetchUtxos()  ·  src/index.js › scanAllUtxos()');
  line(C.dim(`  Endpoint: GET ${apiBase}/address/<dia_chi>/utxo  (JSON)`));
  for (const [address, meta] of Object.entries(index)) {
    const found = utxos.filter((u) => u.address === address);
    line();
    line(`  ${C.yellow(meta.type.padEnd(12))} ${address}`);
    line(`    ${C.dim('GET')} /address/${address}/utxo  ${C.dim('->')} ${found.length} UTXO`);
    for (const u of found) {
      const st = u.confirmed ? C.green('confirmed') : C.yellow('MEMPOOL (chua the chi)');
      line(`      • ${u.txid}:${u.vout}  ${u.value} sat  ${st}`);
    }
    if (!found.length) line(C.dim('      (khong co UTXO)'));
  }
  const total = utxos.reduce((s, u) => s + u.value, 0);
  const conf = utxos.filter((u) => u.confirmed).length;
  line();
  kv('Tong', `${utxos.length} UTXO (${conf} confirmed) = ${total} sat`);
  line(C.dim('  Chi UTXO "confirmed" moi duoc dua vao coin selection o Buoc 3.'));
}

// ======================================================================
// BUOC 3: Coin selection - vi sao chon nhung UTXO nay, phi tinh the nao.
// trace do src/coinselect.js tra ve.
// ======================================================================
export function explainCoinSelection(trace) {
  rule('BUOC 3 · Coin selection (chon it input -> phi re)',
    'src/coinselect.js › selectCoins()  (tra ve .trace de in o day)');
  kv('can gui (target)', `${trace.target} sat`);
  kv('phi thi truong', `${trace.feeRate} sat/vByte`);
  line();
  line(C.dim('  Bang uoc luong kich thuoc (vByte) - vi sao Legacy dat, Taproot re:'));
  line(`    ${C.dim('INPUT ')} ` + Object.entries(INPUT_VBYTES).map(([k, v]) => `${k}=${v}`).join('  '));
  line(`    ${C.dim('OUTPUT')} ` + Object.entries(OUTPUT_VBYTES).map(([k, v]) => `${k}=${v}`).join('  '));
  line(`    ${C.dim('overhead=' + TX_OVERHEAD + '  dust=' + DUST)}`);
  line();
  line(C.dim(`  phi = ceil((overhead + output_nhan(${OUTPUT_VBYTES[trace.destType]}) [+ change(${trace.changeVbytes})] + sum(inputs)) × feeRate)`));

  line();
  line(C.dim('  Sap xep UTXO GIAM DAN theo gia tri (largest-first), gom dan:'));
  trace.sorted.forEach((u, i) =>
    line(`    ${String(i).padStart(2)}. ${C.yellow(u.type.padEnd(12))} ${u.value} sat  ${C.dim(u.txid.slice(0, 12) + '…:' + u.vout)}`)
  );

  line();
  trace.steps.forEach((s, i) => {
    line(`  ${C.bold(`vong ${i + 1}`)}: +[${s.added.type}] ${s.added.value} sat`);
    line(`    inputSum=${s.inputSum}  inputsVbytes=${s.inputsVbytes}`);
    line(`    ${C.dim('neu co change')}: phi=${s.feeWithChange}, can inputSum >= target+phi = ${s.needWithChange}`);
    line(`    ${C.dim('neu khong change')}: phi=${s.feeNoChange}, can inputSum >= ${s.needNoChange}`);
    const done = !s.decision.startsWith('chua du');
    line(`    ${done ? C.green('=> ' + s.decision) : C.dim('=> ' + s.decision)}`);
  });
}

// ======================================================================
// BUOC 8: Broadcast - mo ta request se gui (khong tu y phat song).
// ======================================================================
export function explainBroadcastRequest({ apiBase, hex, willSend }) {
  rule('BUOC 8 · Broadcast (phat song raw hex len mang luoi)',
    'src/api.js › broadcast()  ·  goi tu src/index.js › cmdSend()');
  line(C.dim(`  POST ${apiBase}/tx`));
  line(C.dim('  Content-Type: text/plain'));
  kv('body (raw hex)', `${hex.length / 2} byte`);
  line(`    ${hex}`);
  line(C.dim('  Response body la txid neu duoc chap nhan; loi neu tx khong hop le.'));
  if (!willSend) line(C.yellow('  (dry-run: KHONG gui. Them --broadcast de phat song that.)'));
}

// ---------- Tai dung cac buoc ky BANG TAY ----------

// Dung tx CHUA KY tu inputs/outputs, khop mac dinh cua PSBT
// (version=2, locktime=0, sequence=0xffffffff).
function buildUnsignedTx(inputs, outputs) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  for (const inp of inputs) {
    const hash = Buffer.from(inp.txid, 'hex').reverse(); // txid -> byte order noi bo
    tx.addInput(hash, inp.vout);
  }
  for (const out of outputs) {
    tx.addOutput(bitcoin.address.toOutputScript(out.address, network), out.value);
  }
  return tx;
}

// Tinh sighash cho 1 input theo dung luat cua no + lay ket qua ham chuan de doi chieu.
function sighashForInput(tx, i, inp, inputs) {
  if (inp.type === 'p2pkh') {
    const scriptCode = inp.payment.output; // = scriptPubKey P2PKH
    const manual = legacySighash(tx, i, scriptCode, 0x01);
    const lib = tx.hashForSignature(i, scriptCode, 0x01);
    return { law: 'Legacy sighash', scriptCode, hashType: 0x01, ...manual, lib };
  }
  if (inp.type === 'p2sh-p2wpkh') {
    const scriptCode = p2wpkhScriptCode(inp.payment.redeem.hash);
    const manual = bip143Sighash({ tx, inIndex: i, scriptCode, value: inp.value, hashType: 0x01 });
    const lib = tx.hashForWitnessV0(i, scriptCode, inp.value, 0x01);
    return { law: 'BIP143 (SegWit v0)', scriptCode, hashType: 0x01, ...manual, lib };
  }
  if (inp.type === 'p2wpkh') {
    const scriptCode = p2wpkhScriptCode(inp.payment.hash);
    const manual = bip143Sighash({ tx, inIndex: i, scriptCode, value: inp.value, hashType: 0x01 });
    const lib = tx.hashForWitnessV0(i, scriptCode, inp.value, 0x01);
    return { law: 'BIP143 (SegWit v0)', scriptCode, hashType: 0x01, ...manual, lib };
  }
  if (inp.type === 'p2tr') {
    const prevOutScripts = inputs.map((x) => x.payment.output);
    const values = inputs.map((x) => x.value);
    const manual = bip341Sighash({ tx, inIndex: i, prevOutScripts, values, hashType: 0x00 });
    const lib = tx.hashForWitnessV1(i, prevOutScripts, values, 0x00);
    return { law: 'BIP341 (Taproot)', scriptCode: null, hashType: 0x00, ...manual, lib };
  }
  throw new Error(`Loai input khong ho tro: ${inp.type}`);
}

// Signer Taproot da tweak (giong src/tx.js) - key-path spend.
function tweakTaproot(keyPair) {
  const xOnly = toXOnly(Buffer.from(keyPair.publicKey));
  return keyPair.tweak(bitcoin.crypto.taggedHash('TapTweak', xOnly));
}

// Tu ky 1 input: ECDSA (DER + byte sighash) hoac Schnorr (64B, khong byte sighash).
function signInput(keyPair, inp, sighash) {
  if (inp.type === 'p2tr') {
    const sig = Buffer.from(tweakTaproot(keyPair).signSchnorr(sighash));
    return { kind: 'schnorr', sig };
  }
  const compact = keyPair.sign(sighash); // 64B, low-R tat dinh (RFC6979)
  const sig = bitcoin.script.signature.encode(compact, 0x01); // DER ++ 0x01
  return { kind: 'ecdsa', sig, pubkey: Buffer.from(keyPair.publicKey) };
}

// Tu ghep scriptSig + witness roi serialize thanh giao dich hoan chinh.
function assembleSigned(inputs, outputs, signed) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  inputs.forEach((inp, i) => {
    const hash = Buffer.from(inp.txid, 'hex').reverse();
    const s = signed[i];
    let scriptSig = Buffer.alloc(0);
    if (inp.type === 'p2pkh') {
      scriptSig = bitcoin.script.compile([s.sig, s.pubkey]); // <sig> <pubkey>
    } else if (inp.type === 'p2sh-p2wpkh') {
      scriptSig = bitcoin.script.compile([inp.payment.redeem.output]); // push redeemScript
    }
    tx.addInput(hash, inp.vout, undefined, scriptSig);
  });
  outputs.forEach((o) => tx.addOutput(bitcoin.address.toOutputScript(o.address, network), o.value));
  inputs.forEach((inp, i) => {
    const s = signed[i];
    if (inp.type === 'p2wpkh' || inp.type === 'p2sh-p2wpkh') tx.setWitness(i, [s.sig, s.pubkey]);
    else if (inp.type === 'p2tr') tx.setWitness(i, [s.sig]);
    // p2pkh: khong co witness
  });
  return tx;
}

// Tach raw hex hoan chinh thanh tung truong (co ca phan witness cua SegWit).
function explainSerialized(tx) {
  rule('BUOC 7 · Serialize -> raw transaction (tach tung truong)',
    'src/tx.js › psbt.extractTransaction().toHex()');
  const hasWit = tx.ins.some((i) => i.witness && i.witness.length);
  line(`    ${C.dim('version'.padEnd(16))} ${hx(u32le(tx.version))}`);
  if (hasWit) line(`    ${C.dim('segwit marker'.padEnd(16))} 0001  ${C.dim('(marker+flag)')}`);
  line(`    ${C.dim('vin count'.padEnd(16))} ${hx(varint(tx.ins.length))}`);
  tx.ins.forEach((inp, i) => {
    line(`    ${C.yellow(`in[${i}]`)} outpoint  ${hx(inp.hash)}${hx(u32le(inp.index))}`);
    line(`           scriptSig ${hx(varSlice(inp.script))}`);
    line(`           sequence  ${hx(u32le(inp.sequence))}`);
  });
  line(`    ${C.dim('vout count'.padEnd(16))} ${hx(varint(tx.outs.length))}`);
  tx.outs.forEach((out, i) => {
    line(`    ${C.yellow(`out[${i}]`)} value    ${hx(u64le(out.value))} ${C.dim(`(${out.value} sat)`)}`);
    line(`           script   ${hx(varSlice(out.script))}`);
  });
  if (hasWit) {
    tx.ins.forEach((inp, i) => {
      const w = inp.witness || [];
      line(`    ${C.yellow(`wit[${i}]`)} items=${w.length}  ${w.map(hx).join('  ') || C.dim('(rong)')}`);
    });
  }
  line(`    ${C.dim('locktime'.padEnd(16))} ${hx(u32le(tx.locktime))}`);
  line();
  kv('vsize', `${tx.virtualSize()} vByte`);
  kv('weight', `${tx.weight()} WU`);
  kv('txid', tx.getId());
}

// ======================================================================
// Diem vao chinh: tai dung ca pipeline BANG TAY, doi chieu voi PSBT.
// psbtHex = ket qua that do src/tx.js (PSBT) tao ra.
// ======================================================================
export function explainManualPipeline({ keyPair, inputs, outputs, psbtHex }) {
  // --- BUOC 4 ---
  rule('BUOC 4 · Dung giao dich CHUA KY (inputs + outputs)',
    'src/tx.js › buildAndSign()  (psbt.addInput / psbt.addOutput)');
  const tx = buildUnsignedTx(inputs, outputs);
  inputs.forEach((inp, i) =>
    line(`  in[${i}] ${C.yellow(inp.type.padEnd(12))} ${inp.txid}:${inp.vout}  ${inp.value} sat`)
  );
  outputs.forEach((o, i) => line(`  out[${i}] ${o.value} sat -> ${o.address}`));

  // --- BUOC 5 ---
  rule('BUOC 5 · Bam Sighash (tu tay) & doi chieu ham chuan bitcoinjs',
    'that: PSBT trong src/tx.js  ·  tu tay: src/debug/sighash-manual.js');
  const sighashes = [];
  inputs.forEach((inp, i) => {
    const sh = sighashForInput(tx, i, inp, inputs);
    sighashes.push(sh);
    line();
    line(`  ${C.bold(`in[${i}] ${inp.type}`)}  ${C.dim('· luat: ' + sh.law)}`);
    if (sh.scriptCode) kv('scriptCode', hx(sh.scriptCode));
    line(`  ${C.dim('preimage (chuoi byte truoc khi bam):')}`);
    printParts(sh.parts);
    kv('sighash (tu tay)', hx(sh.hash));
    check(sh.hash.equals(sh.lib), `khop ham chuan (${sh.law === 'Legacy sighash' ? 'hashForSignature' : sh.law.startsWith('BIP143') ? 'hashForWitnessV0' : 'hashForWitnessV1'})`);
  });

  // --- BUOC 6 ---
  rule('BUOC 6 · Ky (ECDSA/Schnorr) & ghep scriptSig / witness',
    'src/tx.js › psbt.signInput() + finalizeAllInputs()  (Taproot: tweakTaprootSigner)');
  const signed = inputs.map((inp, i) => {
    const s = signInput(keyPair, inp, sighashes[i].hash);
    line();
    line(`  ${C.bold(`in[${i}] ${inp.type}`)}  ${C.dim('· ' + (s.kind === 'schnorr' ? 'Schnorr 64B (khong byte sighash)' : 'ECDSA DER + byte sighash 0x01'))}`);
    kv('signature', hx(s.sig));
    if (inp.type === 'p2pkh') kv('-> scriptSig', `<sig> <pubkey>  ${C.dim('(nam trong scriptSig)')}`);
    else if (inp.type === 'p2sh-p2wpkh') kv('-> scriptSig', `push(redeemScript ${hx(inp.payment.redeem.output)})`);
    if (s.kind === 'ecdsa' && inp.type !== 'p2pkh') kv('-> witness', `[sig, pubkey]`);
    if (s.kind === 'schnorr') kv('-> witness', `[sig]  ${C.dim('(key-path, 1 phan tu)')}`);
    return s;
  });

  // --- BUOC 7 ---
  const manualTx = assembleSigned(inputs, outputs, signed);
  explainSerialized(manualTx);

  // --- Doi chieu cuoi cung voi PSBT ---
  rule('DOI CHIEU · Ban tu tay  vs  ban PSBT (src/tx.js)',
    'src/debug/inspect.js › explainManualPipeline()  vs  buildAndSign() hex');
  const manualHex = manualTx.toHex();
  kv('manual hex len', `${manualHex.length / 2} byte`);
  kv('psbt   hex len', `${psbtHex.length / 2} byte`);
  check(manualHex === psbtHex, 'raw hex TRUNG KHOP tung byte (tu tay == PSBT)');
  if (manualHex !== psbtHex) {
    line(C.red('  Manual: ') + manualHex);
    line(C.red('  PSBT  : ') + psbtHex);
  }
}
