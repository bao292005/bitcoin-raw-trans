// WALKTHROUGH OFFLINE - Debug sau TOAN BO 8 buoc, KHONG can tien testnet.
//
// Buoc 1     : khoa & 4 loai dia chi (explainAddresses)
// Buoc 2 & 3 : quet UTXO + coin selection tren DU LIEU GIA (de thay logic chon)
// Buoc 4-7   : chi tieu ca 4 loai input (UTXO gia) - tu tinh sighash, tu ky,
//              tu dung witness, doi chieu tung byte voi PSBT
// Buoc 8     : mo ta request broadcast (dry-run, khong gui)
//
// Chay:  npm run walkthrough
import * as bitcoin from 'bitcoinjs-lib';
import { loadKeyPair, deriveAddresses } from '../src/wallet.js';
import { selectCoins } from '../src/coinselect.js';
import {
  explainAddresses,
  explainUtxoScan,
  explainCoinSelection,
  explainBroadcastRequest,
} from '../src/debug/inspect.js';
import { buildAndSign } from '../src/tx.js';

const kp = loadKeyPair(); // vi ngau nhien - khong lien quan tien that
const d = deriveAddresses(kp);
const types = [d.p2pkh, d.p2sh, d.p2wpkh, d.p2tr];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  WALKTHROUGH OFFLINE · debug sau ca 8 buoc (khong can tien)    ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ================= BUOC 1 =================
// revealSecret=true: an toan vi day la khoa ngau nhien, khong co tien that.
explainAddresses(kp, d, { revealSecret: true });

// ============ BUOC 2 & 3 (du lieu gia) ============
// Tao mot bo UTXO GIA da dang de thay coin selection chon nhu the nao.
// (Rieng buoc ky ben duoi dung 1 bo khac gom du 4 loai - xem chu thich.)
const fakeTxid = (n) => n.toString(16).padStart(2, '0').repeat(32).slice(0, 64);
const index = {};
for (const t of types) index[t.payment.address ?? t.address] = { type: t.type, payment: t.payment };

const mockScan = [
  { address: d.p2wpkh.address, type: 'p2wpkh', value: 30000, confirmed: true, txid: fakeTxid(0xa1), vout: 0 },
  { address: d.p2tr.address, type: 'p2tr', value: 250000, confirmed: true, txid: fakeTxid(0xb2), vout: 1 },
  { address: d.p2pkh.address, type: 'p2pkh', value: 120000, confirmed: true, txid: fakeTxid(0xc3), vout: 0 },
  { address: d.p2sh.address, type: 'p2sh-p2wpkh', value: 50000, confirmed: false, txid: fakeTxid(0xd4), vout: 2 },
];
explainUtxoScan({ apiBase: '(offline mock)', index, utxos: mockScan });

const spendable = mockScan.filter((u) => u.confirmed);
const selection = selectCoins({
  utxos: spendable,
  target: 200000,
  feeRate: 5,
  changeType: 'p2wpkh',
  destType: 'p2wpkh',
});
explainCoinSelection(selection.trace);

// ============ BUOC 4-7 (chi tieu ca 4 loai input) ============
// De minh hoa DU CA 4 luat ky, phan nay dung 4 UTXO gia (moi loai 1 cai).
const VALUE = 100000;
function mockPrevTx(outputScript) {
  const tx = new bitcoin.Transaction();
  tx.version = 2;
  tx.addInput(Buffer.alloc(32, 0), 0xffffffff);
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
    nonWitnessUtxo: prev.toHex(),
  };
});
const totalIn = VALUE * inputs.length;
const fee = 2000;
const outputs = [{ address: d.p2wpkh.address, value: totalIn - fee }];

const res = buildAndSign({ keyPair: kp, inputs, outputs, debug: true });

// ================= BUOC 8 =================
explainBroadcastRequest({ apiBase: '(offline mock)', hex: res.hex, willSend: false });

console.log('\n' + '═'.repeat(66));
console.log('KET QUA: buildAndSign (PSBT) tra ve txid =', res.txid);
console.log('Neu tat ca dong ✓ o tren deu xanh -> ban tu tay va ban PSBT khop hoan toan.');
