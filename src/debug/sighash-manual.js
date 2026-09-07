// DEBUG SAU - Tu tay tinh SIGHASH (thong diep duoc ky) cho ca 3 luat:
//   - Legacy   (P2PKH)        : thuat toan sighash goc cua Bitcoin
//   - SegWit v0 (BIP143)      : P2WPKH & P2SH-P2WPKH
//   - Taproot   (BIP341)      : P2TR key-path (Schnorr)
//
// Muc dich HOC: PSBT giau kin buoc nay. O day ta dung Buffer THUAN de ghep
// "preimage" (chuoi byte truoc khi bam) dung y het spec, roi bam ra sighash.
// File src/debug/inspect.js se doi chieu ket qua nay voi ham chuan cua
// bitcoinjs (hashForSignature / hashForWitnessV0 / hashForWitnessV1).
import * as bitcoin from 'bitcoinjs-lib';

const { hash256, sha256, taggedHash } = bitcoin.crypto;

// ---- Cac tien ich serialize co ban (little-endian, varint kieu Bitcoin) ----

// So nguyen 4 byte / 8 byte dang little-endian.
export const u32le = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
export const u64le = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

// CompactSize / varint: cach Bitcoin ma hoa do dai (so luong input, output, script).
export function varint(n) {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  if (n <= 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = 0xff;
  b.writeBigUInt64LE(BigInt(n), 1);
  return b;
}

// Mot doan "script" trong tx luon di kem tien to do dai (varint) o dau.
export const varSlice = (buf) => Buffer.concat([varint(buf.length), buf]);

// Outpoint = txid (32 byte, thu tu byte noi bo/dao) + vout (4 byte LE).
const outpoint = (inp) => Buffer.concat([inp.hash, u32le(inp.index)]);

// scriptCode kieu P2PKH dung cho P2WPKH/P2SH-P2WPKH: 76a914{hash160}88ac (25 byte).
// Ban chat: du la SegWit, thong diep sighash van "gia vo" nhu dang chi mot P2PKH.
export const p2wpkhScriptCode = (hash160) =>
  bitcoin.script.compile([
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    hash160,
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_CHECKSIG,
  ]);

// =====================================================================
// 1) LEGACY sighash (P2PKH) - chi cai dat truong hop SIGHASH_ALL (0x01).
//    Y tuong: nhan ban tx, XOA scriptSig moi input, RIENG input dang ky thi
//    dat scriptSig = scriptCode (chinh la scriptPubKey cua UTXO). Noi them
//    4 byte hashType roi bam kep (hash256).
// =====================================================================
export function legacySighash(tx, inIndex, scriptCode, hashType = 0x01) {
  const parts = [];
  const push = (label, buf) => {
    parts.push({ label, hex: buf.toString('hex') });
    return buf;
  };
  const chunks = [];
  chunks.push(push('version', u32le(tx.version)));
  chunks.push(push('input_count', varint(tx.ins.length)));
  tx.ins.forEach((inp, i) => {
    chunks.push(push(`in[${i}].outpoint`, outpoint(inp)));
    // Chi input dang ky mang scriptCode; cac input khac scriptSig rong.
    const script = i === inIndex ? scriptCode : Buffer.alloc(0);
    chunks.push(push(`in[${i}].script`, varSlice(script)));
    chunks.push(push(`in[${i}].sequence`, u32le(inp.sequence)));
  });
  chunks.push(push('output_count', varint(tx.outs.length)));
  tx.outs.forEach((out, i) => {
    chunks.push(push(`out[${i}].value`, u64le(out.value)));
    chunks.push(push(`out[${i}].script`, varSlice(out.script)));
  });
  chunks.push(push('locktime', u32le(tx.locktime)));
  chunks.push(push('sighash_type', u32le(hashType)));

  const preimage = Buffer.concat(chunks);
  return { hash: hash256(preimage), preimage, parts };
}

// =====================================================================
// 2) SEGWIT v0 sighash (BIP143) - dung cho P2WPKH & P2SH-P2WPKH.
//    Khac Legacy: bam san 3 "tong hop" (prevouts/sequences/outputs) nen ky
//    nhieu input re hon, va CO dua gia tri (amount) cua UTXO vao preimage.
// =====================================================================
export function bip143Sighash({ tx, inIndex, scriptCode, value, hashType = 0x01 }) {
  const hashPrevouts = hash256(Buffer.concat(tx.ins.map(outpoint)));
  const hashSequence = hash256(Buffer.concat(tx.ins.map((i) => u32le(i.sequence))));
  const hashOutputs = hash256(
    Buffer.concat(tx.outs.map((o) => Buffer.concat([u64le(o.value), varSlice(o.script)])))
  );
  const thisIn = tx.ins[inIndex];

  const parts = [];
  const push = (label, buf) => {
    parts.push({ label, hex: buf.toString('hex') });
    return buf;
  };
  const preimage = Buffer.concat([
    push('nVersion', u32le(tx.version)),
    push('hashPrevouts', hashPrevouts),
    push('hashSequence', hashSequence),
    push('outpoint', outpoint(thisIn)),
    push('scriptCode', varSlice(scriptCode)),
    push('amount', u64le(value)),
    push('nSequence', u32le(thisIn.sequence)),
    push('hashOutputs', hashOutputs),
    push('nLocktime', u32le(tx.locktime)),
    push('sighashType', u32le(hashType)),
  ]);
  return { hash: hash256(preimage), preimage, parts };
}

// =====================================================================
// 3) TAPROOT sighash (BIP341) - P2TR key-path, mac dinh SIGHASH_DEFAULT (0x00).
//    Khac han: dung SHA256 DON (khong kep) cho cac tong hop, gom scriptPubKey
//    cua TAT CA input, va ket thuc bang taggedHash('TapSighash', epoch ‖ msg).
// =====================================================================
export function bip341Sighash({ tx, inIndex, prevOutScripts, values, hashType = 0x00 }) {
  const shaPrevouts = sha256(Buffer.concat(tx.ins.map(outpoint)));
  const shaAmounts = sha256(Buffer.concat(values.map(u64le)));
  const shaScriptPubkeys = sha256(Buffer.concat(prevOutScripts.map(varSlice)));
  const shaSequences = sha256(Buffer.concat(tx.ins.map((i) => u32le(i.sequence))));
  const shaOutputs = sha256(
    Buffer.concat(tx.outs.map((o) => Buffer.concat([u64le(o.value), varSlice(o.script)])))
  );

  const spendType = Buffer.from([0x00]); // ext_flag=0 (key-path), khong co annex

  const parts = [];
  const push = (label, buf) => {
    parts.push({ label, hex: buf.toString('hex') });
    return buf;
  };
  const sigMsg = Buffer.concat([
    push('hash_type', Buffer.from([hashType])),
    push('nVersion', u32le(tx.version)),
    push('nLockTime', u32le(tx.locktime)),
    push('sha_prevouts', shaPrevouts),
    push('sha_amounts', shaAmounts),
    push('sha_scriptpubkeys', shaScriptPubkeys),
    push('sha_sequences', shaSequences),
    push('sha_outputs', shaOutputs),
    push('spend_type', spendType),
    push('input_index', u32le(inIndex)),
  ]);

  // epoch byte 0x00 duoc noi TRUOC sigMsg roi bam tagged (tag = "TapSighash").
  const epoch = Buffer.from([0x00]);
  const preimage = Buffer.concat([epoch, sigMsg]);
  return { hash: taggedHash('TapSighash', preimage), preimage, parts };
}
