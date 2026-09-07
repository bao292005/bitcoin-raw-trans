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

## Debug sâu (học từng bước)

Muốn "mở nắp" phần mà PSBT giấu kín — tự tay tính **sighash**, tự ký, tự ghép
**scriptSig/witness** rồi đối chiếu byte-for-byte với PSBT:

```bash
# A. Walkthrough OFFLINE — không cần tiền test, chạy lại vô hạn lần.
#    Đi qua CẢ 8 BƯỚC bằng dữ liệu giả (quét UTXO, coin selection, ký 4 loại...).
npm run walkthrough

# B. Trên luồng THẬT — thêm cờ --debug.
node src/index.js balance <WIF> --debug                         # sâu Bước 1-2
node src/index.js send <WIF> <địa_chỉ_nhận> <số_sat> --debug    # sâu cả 8 bước
```

Debug "mở nắp" **đủ 8 bước**:
- **Bước 1** — pubkey → x-only → hash160 → scriptPubKey từng loại, và phép *tweak* Taproot (BIP341).
- **Bước 2** — endpoint API gọi cho từng địa chỉ, danh sách UTXO trả về, trạng thái confirmed/mempool.
- **Bước 3** — bảng vByte theo loại input/output, sắp xếp largest-first, **từng vòng lặp** chọn UTXO kèm phép tính phí và lý do quyết định (tạo change / gộp dust).
- **Bước 4** — cấu trúc inputs/outputs của giao dịch chưa ký.
- **Bước 5** — **preimage** (chuỗi byte trước khi băm) tách theo từng trường + **sighash tự tính**, kèm `✓` khớp hàm chuẩn (`hashForSignature`/`hashForWitnessV0`/`hashForWitnessV1`).
- **Bước 6** — chữ ký ECDSA (DER + byte sighash) hoặc Schnorr (64B), cách ghép vào scriptSig/witness.
- **Bước 7** — raw hex tách theo trường (cả phần witness) + vsize/weight/txid.
- **Bước 8** — mô tả request `POST /tx` sẽ gửi (dry-run không gửi nếu thiếu `--broadcast`).
- **Đối chiếu cuối** — **raw hex tự tay == raw hex PSBT**, khớp từng byte.

Cài đặt ở `src/debug/sighash-manual.js` (3 luật sighash thuần Buffer) và
`src/debug/inspect.js` (in + coin-selection trace + tự ký + đối chiếu). Trace của
coin selection nằm trong `src/coinselect.js` (trường `trace`).

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
