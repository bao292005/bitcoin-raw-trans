#!/usr/bin/env node
// CLI dieu phoi toan bo 8 buoc quy trinh tren testnet.
//
//   node src/index.js genkey                 -> tao private key (WIF) moi
//   node src/index.js addr <WIF>             -> in 4 loai dia chi tu private key
//   node src/index.js balance <WIF>          -> quet UTXO & so du tren cac dia chi
//   node src/index.js send <WIF> <to> <sat> [--broadcast]
//
// Private key co the truyen qua tham so hoac bien moi truong PRIVATE_KEY.
import { network, NETWORK_NAME, API_BASE } from './config.js';
import { loadKeyPair, addressIndex } from './wallet.js';
import { fetchUtxos, fetchTxHex, fetchFeeRate, broadcast } from './api.js';
import { selectCoins } from './coinselect.js';
import { buildAndSign } from './tx.js';
import * as bitcoin from 'bitcoinjs-lib';

const fmt = (sat) => `${sat} sat (${(sat / 1e8).toFixed(8)} BTC)`;

// Phan loai dia chi -> type de uoc luong kich thuoc output.
function classifyAddress(addr) {
  try {
    bitcoin.address.toOutputScript(addr, network); // xac minh hop le
  } catch {
    throw new Error(`Dia chi khong hop le tren ${NETWORK_NAME}: ${addr}`);
  }
  if (/^(bc1p|tb1p|bcrt1p)/.test(addr)) return 'p2tr';
  if (/^(bc1q|tb1q|bcrt1q)/.test(addr)) return 'p2wpkh';
  if (/^[2]/.test(addr) || /^3/.test(addr)) return 'p2sh-p2wpkh';
  return 'p2pkh';
}

// Quet UTXO tren ca 4 dia chi, gan them type + payment de biet cach ky.
async function scanAllUtxos(index) {
  const all = [];
  for (const [address, meta] of Object.entries(index)) {
    const utxos = await fetchUtxos(address);
    for (const u of utxos) {
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

async function cmdGenkey() {
  const kp = loadKeyPair();
  const { derived } = addressIndex(kp);
  console.log('== Vi moi (testnet) ==');
  console.log('Private key (WIF):', kp.toWIF());
  console.log('Public key       :', Buffer.from(kp.publicKey).toString('hex'));
  console.log('\nCac dia chi:');
  printAddresses(derived);
}

function printAddresses(derived) {
  console.log('  Legacy P2PKH        :', derived.p2pkh.address);
  console.log('  Nested P2SH-P2WPKH  :', derived.p2sh.address);
  console.log('  Native SegWit P2WPKH:', derived.p2wpkh.address);
  console.log('  Taproot P2TR        :', derived.p2tr.address);
}

async function cmdAddr(wif) {
  const kp = loadKeyPair(wif);
  const { derived } = addressIndex(kp);
  console.log('Public key:', Buffer.from(kp.publicKey).toString('hex'));
  printAddresses(derived);
}

async function cmdBalance(wif) {
  const kp = loadKeyPair(wif);
  const { index } = addressIndex(kp);
  console.log(`Dang quet UTXO tren ${API_BASE} ...\n`);
  const utxos = await scanAllUtxos(index);
  let total = 0;
  for (const u of utxos) {
    total += u.value;
    console.log(
      `  [${u.type}] ${u.txid}:${u.vout}  ${fmt(u.value)}  ${u.confirmed ? 'confirmed' : 'MEMPOOL'}`
    );
  }
  if (!utxos.length) console.log('  (khong co UTXO)');
  console.log(`\nTong so du: ${fmt(total)} tu ${utxos.length} UTXO`);
}

async function cmdSend(wif, to, amountStr, flags) {
  const amount = Number(amountStr);
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('So sat phai la so nguyen duong.');

  const kp = loadKeyPair(wif);
  const { derived, index } = addressIndex(kp);
  const destType = classifyAddress(to);
  const changeAddress = derived.p2wpkh.address; // tra tien thoi ve dia chi SegWit (output re)

  console.log('== Buoc 2: Quet UTXO ==');
  const utxos = await scanAllUtxos(index);
  const spendable = utxos.filter((u) => u.confirmed);
  console.log(`  Tim thay ${utxos.length} UTXO (${spendable.length} da confirmed, dung de chi).`);
  if (!spendable.length) throw new Error('Khong co UTXO confirmed de chi tieu.');

  const feeRate = await fetchFeeRate();
  console.log(`  Phi thi truong: ${feeRate} sat/vByte`);

  console.log('\n== Buoc 3: Lua chon UTXO (coin selection) ==');
  const selection = selectCoins({
    utxos: spendable,
    target: amount,
    feeRate,
    changeType: 'p2wpkh',
    destType,
  });
  console.log(`  Chon ${selection.inputs.length} input, phi ~${fmt(selection.fee)}`);
  selection.inputs.forEach((u) =>
    console.log(`    - [${u.type}] ${u.txid}:${u.vout} ${fmt(u.value)}`)
  );

  console.log('\n== Buoc 4: Lay raw tx cho input Legacy (neu co) ==');
  for (const inp of selection.inputs) {
    if (inp.type === 'p2pkh') {
      inp.nonWitnessUtxo = await fetchTxHex(inp.txid);
      console.log(`  Da lay raw tx ${inp.txid}`);
    }
  }

  const outputs = [{ address: to, value: amount }];
  if (selection.change > 0) {
    outputs.push({ address: changeAddress, value: selection.change });
    console.log(`  Output change: ${fmt(selection.change)} -> ${changeAddress}`);
  } else {
    console.log('  Khong co change (phan du < dust, gop vao phi).');
  }

  console.log('\n== Buoc 5-7: Ky (Sighash + ECDSA/Schnorr) & Serialize ==');
  const { hex, txid, vsize, weight } = buildAndSign({ keyPair: kp, inputs: selection.inputs, outputs });
  console.log(`  txid (du kien): ${txid}`);
  console.log(`  vsize: ${vsize} vByte | weight: ${weight} WU`);
  console.log('\n  Raw transaction hex:');
  console.log('  ' + hex);

  console.log('\n== Buoc 8: Phat song (Broadcast) ==');
  if (flags.broadcast) {
    const sent = await broadcast(hex);
    console.log(`  DA PHAT SONG! txid: ${sent}`);
    console.log(`  Xem: ${API_BASE.replace('/api', '')}/tx/${sent}`);
  } else {
    console.log('  (dry-run) Them --broadcast de gui len mang luoi.');
    console.log('  Hoac tu broadcast hex o tren tai https://mempool.space/testnet/tx/push');
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = { broadcast: rest.includes('--broadcast') };
  const args = rest.filter((a) => !a.startsWith('--'));
  const wif = args[0] || process.env.PRIVATE_KEY;

  try {
    switch (cmd) {
      case 'genkey':
        return await cmdGenkey();
      case 'addr':
        return await cmdAddr(requireWif(wif));
      case 'balance':
        return await cmdBalance(requireWif(wif));
      case 'send':
        return await cmdSend(requireWif(wif), args[1], args[2], flags);
      default:
        printHelp();
    }
  } catch (e) {
    console.error('\nLOI:', e.message);
    process.exit(1);
  }
}

function requireWif(wif) {
  if (!wif) throw new Error('Thieu private key (WIF). Truyen tham so hoac dat PRIVATE_KEY.');
  return wif;
}

function printHelp() {
  console.log(`bitcoin-raw-trans (mang: ${NETWORK_NAME})

Cach dung:
  node src/index.js genkey
  node src/index.js addr    <WIF>
  node src/index.js balance <WIF>
  node src/index.js send    <WIF> <dia_chi_nhan> <so_sat> [--broadcast]

Private key co the dat qua bien moi truong PRIVATE_KEY thay cho tham so.`);
}

main();
