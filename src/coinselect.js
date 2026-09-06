// BUOC 3: Lua chon UTXO (Coin Selection).
//
// Muc tieu: gom du UTXO de tra (amount + phi) ma dung IT input nhat co the,
// vi cang it input -> giao dich cang nho (vByte) -> phi cang re.
// Chien luoc: sap xep UTXO giam dan theo gia tri (largest-first / accumulative),
// gom dan cho toi khi du. Neu phan du (change) qua nho (bui - dust) thi bo vao phi.

// Uoc luong so vByte cho tung loai input (da lam tron len de an toan).
export const INPUT_VBYTES = {
  'p2pkh': 148,        // Legacy: scriptSig lon (sig + pubkey khong nam trong witness)
  'p2sh-p2wpkh': 91,   // Nested SegWit
  'p2wpkh': 68,        // Native SegWit
  'p2tr': 58,          // Taproot key-path (Schnorr, chi 1 phan tu witness)
};

// Uoc luong so vByte cho tung loai output.
export const OUTPUT_VBYTES = {
  'p2pkh': 34,
  'p2sh-p2wpkh': 32,
  'p2wpkh': 31,
  'p2tr': 43,
};

const TX_OVERHEAD = 11; // version + locktime + so luong in/out + marker/flag segwit

// Nguong dust: output nho hon nguong nay khong dang tao (phi > gia tri).
const DUST = 546;

// utxos: [{ txid, vout, value, type }]  (da gan 'type' theo dia chi so huu)
// targets: tong so sat can gui (chua ke phi)
// feeRate: sat/vByte
// changeType: loai dia chi nhan tien thoi (change)
export function selectCoins({ utxos, target, feeRate, changeType = 'p2wpkh', destType = 'p2wpkh' }) {
  const sorted = [...utxos].sort((a, b) => b.value - a.value);

  const selected = [];
  let inputSum = 0;

  const baseVbytes = TX_OVERHEAD + OUTPUT_VBYTES[destType]; // output nhan chinh
  const changeVbytes = OUTPUT_VBYTES[changeType];

  for (const utxo of sorted) {
    selected.push(utxo);
    inputSum += utxo.value;

    const inputsVbytes = selected.reduce((s, u) => s + INPUT_VBYTES[u.type], 0);

    // Thu 2 kich ban: co change va khong co change.
    const feeWithChange = Math.ceil((baseVbytes + inputsVbytes + changeVbytes) * feeRate);
    const feeNoChange = Math.ceil((baseVbytes + inputsVbytes) * feeRate);

    // Kich ban co change: du tien cho target + phi + it nhat 1 dust change?
    if (inputSum >= target + feeWithChange) {
      const change = inputSum - target - feeWithChange;
      if (change >= DUST) {
        return { inputs: selected, fee: feeWithChange, change, changeType };
      }
      // change qua nho -> gop luon vao phi, khong tao output change.
      return { inputs: selected, fee: inputSum - target, change: 0, changeType };
    }

    // Kich ban khong change: vua khit (phan du nho hon dust cung gop vao phi).
    if (inputSum >= target + feeNoChange && inputSum - target - feeNoChange < DUST) {
      return { inputs: selected, fee: inputSum - target, change: 0, changeType };
    }
  }

  throw new Error(
    `Khong du so du. Can it nhat ${target} sat + phi, chi gom duoc ${inputSum} sat tu ${sorted.length} UTXO.`
  );
}
