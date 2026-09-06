# bitcoin-raw-trans

Code lại **toàn bộ quy trình tạo – ký – phát sóng giao dịch Bitcoin** trên mạng **testnet**,
từ một private key duy nhất, hỗ trợ đầy đủ 4 loại địa chỉ:

| Loại | Chuẩn | Tiền tố (testnet) | Ký |
|------|-------|-------------------|----|
| Legacy | P2PKH | `m` / `n` | ECDSA (scriptSig) |
| Nested SegWit | P2SH-P2WPKH | `2` | ECDSA (witness) |
| Native SegWit | P2WPKH bech32 | `tb1q` | ECDSA (witness) |
| Taproot | P2TR | `tb1p` | Schnorr (witness) |

Stack: **Node.js + [bitcoinjs-lib] + tiny-secp256k1 + ecpair**. UTXO/broadcast qua **mempool.space** REST API (không cần chạy full node).

## Cài đặt

```bash
npm install
npm test          # self-test: ký thử cả 4 loại input (không cần tiền thật)
```

## Sử dụng

```bash
# 1. Tạo private key (WIF) + xem 4 địa chỉ
node src/index.js genkey

# 2. Suy ra địa chỉ từ 1 private key có sẵn
node src/index.js addr <WIF>

# 3. Quét UTXO & số dư trên cả 4 địa chỉ
node src/index.js balance <WIF>

# 4. Tạo + ký giao dịch (mặc định dry-run, in raw hex)
node src/index.js send <WIF> <địa_chỉ_nhận> <số_sat>

# 5. Ký VÀ phát sóng luôn lên mạng lưới
node src/index.js send <WIF> <địa_chỉ_nhận> <số_sat> --broadcast
```

Private key có thể đặt qua biến môi trường thay cho tham số:

```bash
export PRIVATE_KEY=cR5d...          # WIF testnet
node src/index.js balance
```

### Nạp tiền test

Gửi tBTC vào một trong các địa chỉ ở trên từ faucet, ví dụ:
- https://coinfaucet.eu/en/btc-testnet/
- https://mempool.space/testnet

## 8 bước quy trình được cài đặt ở đâu

| Bước | Mô tả | File |
|------|-------|------|
| 1 | Private key → public key → 4 loại địa chỉ | `src/wallet.js` |
| 2 | Quét UTXO chưa chi | `src/api.js` (`fetchUtxos`) |
| 3 | Coin selection (ít input → phí rẻ) | `src/coinselect.js` |
| 4 | Dựng giao dịch chưa ký (inputs/outputs/change) | `src/tx.js` |
| 5 | Băm Sighash & ký ECDSA/Schnorr (canonical, chống malleability) | `src/tx.js` |
| 6 | Ghép chữ ký vào scriptSig / witness theo loại địa chỉ | `src/tx.js` (`finalizeAllInputs`) |
| 7 | Serialize thành raw hex hoàn chỉnh | `src/tx.js` (`extractTransaction`) |
| 8 | Phát sóng lên mạng | `src/api.js` (`broadcast`) |

## Cấu hình

Qua biến môi trường (`src/config.js`):

- `NETWORK` — `testnet` (mặc định) hoặc `mainnet`.
- `API_BASE` — đổi endpoint, ví dụ testnet4: `https://mempool.space/testnet4/api`.
- `FEE_RATE` — sat/vByte dự phòng nếu API ước lượng phí lỗi.

## Ghi chú kỹ thuật

- **Legacy P2PKH** cần raw hex của giao dịch trước (`nonWitnessUtxo`) để tính sighash — tool tự tải qua API.
- **Taproot** dùng key-path spend: signer được *tweak* bằng `taggedHash('TapTweak', xOnlyPubkey)` (BIP341) rồi ký Schnorr.
- Chữ ký ECDSA được bitcoinjs ký **low-S canonical** để tránh transaction malleability.
- Chữ ký được xác minh lại đúng theo loại (ECDSA vs Schnorr) trước khi finalize — lưu ý cả hai đều dài 64 byte nên phân biệt theo loại input, không theo độ dài.

[bitcoinjs-lib]: https://github.com/bitcoinjs/bitcoinjs-lib

> ⚠️ Chỉ dùng cho testnet / mục đích học tập. Không đưa private key thật vào command line trên máy chia sẻ.
