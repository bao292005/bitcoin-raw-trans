// E2E tren mang local regtest: chay TRON VEN vong doi giao dich, khong gia lap.
//
// Khac voi selftest (ky offline, khong ai kiem chung), bai nay dua raw hex vao
// dung consensus engine cua Bitcoin Core. Tx duoc chap nhan => chu ky va cach
// ghep scriptSig/witness cua ca 4 loai dia chi la DUNG THAT.
//
//   npm run node:start && npm run e2e
import assert from 'node:assert';
import { NETWORK_NAME, USE_RPC } from '../src/config.js';
import { loadKeyPair, addressIndex } from '../src/wallet.js';
import { fetchUtxos, fetchTxHex, fetchFeeRate, broadcast } from '../src/api.js';
import { selectCoins } from '../src/coinselect.js';
import { buildAndSign } from '../src/tx.js';
import {
  rpc,
  rpcWallet,
  ensureWallet,
  mineBlocks,
  getMinerAddress,
  getMinerBalance,
  sendFromMiner,
  getChainInfo,
} from '../src/rpc.js';

if (!USE_RPC) {
  console.error(`E2E chi chay tren regtest. Dat NETWORK=regtest trong .env (dang la: ${NETWORK_NAME}).`);
  process.exit(1);
}

const fmt = (s) => `${s} sat`;
let step = 0;
const say = (msg) => console.log(`\n[${++step}] ${msg}`);
const ok = (msg) => console.log(`    ✓ ${msg}`);

const PER_ADDRESS = 1_000_000; // rot vao moi loai dia chi
const SEND_AMOUNT = 3_400_000; // > 3 UTXO -> buoc phai dung CA 4 loai input

async function scanAll(index) {
  const all = [];
  for (const [address, meta] of Object.entries(index)) {
    for (const u of await fetchUtxos(address)) {
      all.push({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        confirmed: u.status?.confirmed ?? false,
        type: meta.type,
        payment: meta.payment,
        address,
      });
    }
  }
  return all;
}

async function main() {
  say('Kiem tra node regtest');
  await ensureWallet();
  const info = await getChainInfo();
  assert.equal(info.chain, 'regtest', 'Node phai chay o che do regtest');
  ok(`chain=regtest, chieu cao=${info.blocks}`);

  say('Dao block cho du coinbase chin (>=101)');
  const minerAddr = await getMinerAddress();
  const need = Math.max(0, 101 - info.blocks);
  if (need) await mineBlocks(need, minerAddr);
  const balance = await getMinerBalance();
  assert.ok(balance > 0, 'Vi miner phai co tien sau khi dao');
  ok(`so du miner = ${fmt(balance)}`);

  say('Tao vi moi & suy ra 4 loai dia chi tu MOT private key');
  const kp = loadKeyPair();
  const { derived, index } = addressIndex(kp);
  const kinds = ['p2pkh', 'p2sh', 'p2wpkh', 'p2tr'];
  for (const k of kinds) ok(`${derived[k].type.padEnd(12)} ${derived[k].address}`);
  assert.equal(new Set(kinds.map((k) => derived[k].address)).size, 4, '4 dia chi phai khac nhau');
  assert.match(derived.p2wpkh.address, /^bcrt1q/, 'P2WPKH phai la bech32 regtest');
  assert.match(derived.p2tr.address, /^bcrt1p/, 'P2TR phai la bech32m regtest');

  say('Faucet: rot tien vao CA 4 dia chi trong 1 giao dich');
  const targets = Object.fromEntries(kinds.map((k) => [derived[k].address, PER_ADDRESS]));
  const faucetTxid = await sendFromMiner(targets);
  await mineBlocks(1);
  ok(`faucet txid = ${faucetTxid} (da confirm)`);

  say('Quet UTXO tren ca 4 dia chi (scantxoutset)');
  const utxos = await scanAll(index);
  assert.equal(utxos.length, 4, `Phai thay dung 4 UTXO, thay ${utxos.length}`);
  const seenTypes = new Set(utxos.map((u) => u.type));
  for (const t of ['p2pkh', 'p2sh-p2wpkh', 'p2wpkh', 'p2tr']) {
    assert.ok(seenTypes.has(t), `Thieu UTXO loai ${t}`);
  }
  utxos.forEach((u) => ok(`[${u.type}] ${u.txid.slice(0, 12)}…:${u.vout} = ${fmt(u.value)}`));

  say('Coin selection');
  const feeRate = await fetchFeeRate();
  const dest = await rpcWallet('getnewaddress', ['e2e-dest']);
  const recipients = [{ address: dest, value: SEND_AMOUNT, type: 'p2wpkh' }];
  const selection = selectCoins({
    utxos: utxos.filter((u) => u.confirmed),
    target: SEND_AMOUNT,
    feeRate,
    changeType: 'p2wpkh',
    destOutputs: recipients,
  });
  assert.equal(selection.inputs.length, 4, 'Phai gom du 4 input de dat muc tieu');
  ok(`chon ${selection.inputs.length} input, phi=${fmt(selection.fee)} @ ${feeRate} sat/vB`);
  ok(`change=${fmt(selection.change)}`);

  say('Lay raw tx cho input Legacy (nonWitnessUtxo)');
  for (const inp of selection.inputs) {
    if (inp.type === 'p2pkh') {
      inp.nonWitnessUtxo = await fetchTxHex(inp.txid);
      assert.ok(inp.nonWitnessUtxo?.length > 0, 'nonWitnessUtxo khong duoc rong');
      ok(`da lay raw tx cho input p2pkh (${inp.nonWitnessUtxo.length / 2} byte)`);
    }
  }

  say('Ky 4 input voi 4 kieu khac nhau (ECDSA x3 + Schnorr) & serialize');
  const outputs = [{ address: dest, value: SEND_AMOUNT }];
  if (selection.change > 0) {
    outputs.push({ address: derived.p2wpkh.address, value: selection.change });
  }
  const { hex, txid, vsize } = buildAndSign({ keyPair: kp, inputs: selection.inputs, outputs });
  ok(`txid du kien = ${txid}`);
  ok(`vsize = ${vsize} vByte, raw = ${hex.length / 2} byte`);

  say('Bitcoin Core kiem tra tinh hop le TRUOC khi gui (testmempoolaccept)');
  const [check] = await rpc('testmempoolaccept', [[hex]]);
  assert.ok(check.allowed, `Core tu choi tx: ${check['reject-reason'] || 'khong ro'}`);
  ok(`allowed=true, vsize theo Core = ${check.vsize}`);
  assert.equal(check.txid, txid, 'txid tu tinh phai trung txid Core tinh');
  ok('txid tu tinh TRUNG txid cua Core');

  say('Broadcast len mang luoi');
  const sentTxid = await broadcast(hex);
  assert.equal(sentTxid, txid, 'txid tra ve phai trung');
  ok(`da phat song: ${sentTxid}`);

  say('Dao 1 block & xac minh on-chain');
  await mineBlocks(1);
  const confirmedTx = await rpc('getrawtransaction', [txid, true]);
  assert.equal(confirmedTx.confirmations, 1, 'Giao dich phai co 1 confirmation');
  ok(`confirmations = ${confirmedTx.confirmations}`);

  const out0 = await rpc('gettxout', [txid, 0]);
  assert.equal(Math.round(out0.value * 1e8), SEND_AMOUNT, 'So tien nguoi nhan phai dung');
  ok(`nguoi nhan nhan dung ${fmt(SEND_AMOUNT)}`);

  say('Xac minh 4 UTXO cu da bi TIEU (khong con trong UTXO set)');
  for (const inp of selection.inputs) {
    const spent = await rpc('gettxout', [inp.txid, inp.vout]);
    assert.equal(spent, null, `UTXO ${inp.type} le ra phai da bi tieu`);
    ok(`[${inp.type}] da bi tieu dung`);
  }

  say('Xac minh so du con lai = change');
  const after = await scanAll(index);
  const remaining = after.reduce((s, u) => s + u.value, 0);
  assert.equal(remaining, selection.change, 'So du con lai phai bang change');
  ok(`con lai ${fmt(remaining)} = change`);

  const spentTotal = PER_ADDRESS * 4;
  assert.equal(spentTotal, SEND_AMOUNT + selection.fee + selection.change, 'Can bang thu chi');
  ok(`can bang: ${spentTotal} = ${SEND_AMOUNT} (gui) + ${selection.fee} (phi) + ${selection.change} (change)`);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  E2E PASS — ca 4 loai dia chi ky & duoc Bitcoin Core');
  console.log('  chap nhan, giao dich da confirmed on-chain.');
  console.log('══════════════════════════════════════════════════════');
}

main().catch((e) => {
  console.error('\nE2E THAT BAI:', e.message);
  process.exit(1);
});
