# bitcoin-raw-trans

Code lại **toàn bộ quy trình tạo – ký – phát sóng giao dịch Bitcoin**,
từ một private key duy nhất, hỗ trợ đầy đủ 4 loại địa chỉ:

| Loại | Chuẩn | Tiền tố (testnet / regtest) | Ký |
|------|-------|------------------------------|----|
| Legacy | P2PKH | `m`/`n` · `m`/`n` | ECDSA (scriptSig) |
| Nested SegWit | P2SH-P2WPKH | `2` · `2` | ECDSA (witness) |
| Native SegWit | P2WPKH bech32 | `tb1q` · `bcrt1q` | ECDSA (witness) |
| Taproot | P2TR | `tb1p` · `bcrt1p` | Schnorr (witness) |

Stack: **Node.js + [bitcoinjs-lib] + tiny-secp256k1 + ecpair**.

Chạy được trên **2 mạng**, cùng một bộ code:

| `NETWORK` | Nguồn dữ liệu | Đặc điểm |
|-----------|---------------|----------|
| `regtest` | **bitcoind JSON-RPC** (local) | Tự đào block, tự faucet, không cần Internet. Verify bằng chính consensus engine của Bitcoin Core. |
| `testnet` | REST Esplora (blockstream/mempool) | Mạng công cộng, cần faucet ngoài. Không cần chạy node. |

## Cài đặt

```bash
npm install
npm test          # self-test: ký thử cả 4 loại input (không cần tiền thật)
```

## Chạy trên mạng local (regtest) — khuyến nghị

Không cần full node, không cần Internet, không cần faucet công cộng.
`bitcoind` chạy ở chế độ `regtest`: bạn **tự đào block** và **tự phát tiền**.

```bash
# 0. Cài Bitcoin Core (một lần)
brew install bitcoin

# 1. Bật node local. Datadir nằm trong .bitcoin/ ngay trong project
#    -> không đụng gì tới máy bạn, xoá thư mục là sạch.
npm run node:start

# 2. Đặt NETWORK=regtest trong .env, rồi khởi tạo:
#    tạo ví miner + đào 101 block (coinbase cần 100 block mới tiêu được)
node src/index.js init

# 3. Tạo ví và rót tiền vào CẢ 4 loại địa chỉ trong một giao dịch
node src/index.js genkey
node src/index.js faucet <WIF>            # mặc định 0.01 BTC mỗi địa chỉ

# 4. Xem UTXO, rồi gửi (số tiền lớn -> buộc gom cả 4 loại input)
node src/index.js balance <WIF>
node src/index.js send <WIF> <địa_chỉ_nhận> 3400000 --broadcast
#    trên regtest, sau khi broadcast tool tự đào 1 block để confirm.
```

Quản lý node:

```bash
npm run node:start     # bật
npm run node:stop      # tắt
npm run node:status    # xem chiều cao block
npm run node:reset     # xoá sạch chuỗi, làm lại từ block 0
npm run node:cli -- getblockchaininfo   # gọi bitcoin-cli bất kỳ
```

### Xem giao dịch trên giao diện Bitcoin Core (Bitcoin-Qt)

Bitcoin-Qt chạy mặc định sẽ dùng datadir hệ thống — tức **một blockchain khác
hoàn toàn**, không thấy gì của dự án. Muốn thấy, phải cho Qt dùng chung
`.bitcoin/` của dự án:

```bash
node src/index.js watch <WIF>   # 1. nạp ví CHỈ-XEM vào Core
npm run node:qt                 # 2. mở Qt trên datadir dự án
```

Trong Qt chọn ví `watch-xxxxxxxx` ở menu **Window → Wallets**. Số dư và toàn bộ
lịch sử giao dịch của cả 4 loại địa chỉ sẽ hiện ra.

**Chỉ-xem** nghĩa là Core nạp *descriptor suy từ public key*, không có private
key — nó theo dõi và hiển thị được, nhưng không ký được. Việc ký vẫn do
`src/tx.js` đảm nhận.

| | |
|---|---|
| `npm run node:start` | chạy bitcoind (nền, không giao diện) |
| `npm run node:qt` | chạy Bitcoin-Qt (có giao diện, kiêm luôn node) |

⚠️ **Không chạy đồng thời được** — hai bên khoá cùng một datadir. `node:qt` tự
dừng bitcoind trước khi mở Qt. Muốn quay lại: đóng Qt rồi `npm run node:start`.
Dù dùng bên nào, `npm run web` vẫn hoạt động y hệt vì cả hai cùng phục vụ RPC
trên cổng 18443.

### Test end-to-end thật

```bash
npm run node:start && npm run e2e
```

Bài này chạy trọn vòng đời và **đưa raw hex vào đúng consensus engine của Bitcoin
Core** (`testmempoolaccept` rồi `sendrawtransaction`). Nó kiểm chứng:

- 4 địa chỉ suy ra từ 1 private key, đúng tiền tố regtest
- faucet → quét UTXO bằng `scantxoutset` → thấy đủ 4 loại
- coin selection gom đúng 4 input, tính phí khớp
- ký 4 input bằng 4 cách (ECDSA ×3 + Schnorr), txid tự tính **trùng** txid Core tính
- broadcast → đào block → `confirmations = 1`
- 4 UTXO cũ đã bị tiêu khỏi UTXO set, số dư còn lại đúng bằng change
- cân bằng thu chi: `tổng input = số gửi + phí + change`

Tx được Core chấp nhận nghĩa là chữ ký và cách ghép scriptSig/witness của cả 4
loại địa chỉ là **đúng thật**, không phải tự mình nói mình đúng.

## Giao diện web

```bash
npm run node:start      # 1. bật node regtest
npm run web:build       # 2. cài deps + build giao diện (chỉ cần chạy lại khi sửa UI)
npm run web             # 3. mở http://127.0.0.1:3000
```

Muốn sửa UI có hot-reload thì chạy 2 terminal:

```bash
npm run web             # terminal 1: API ở :3000
npm run web:dev         # terminal 2: Vite ở :5173, tự proxy /api sang :3000
```

Bảy màn: **Dashboard** (số dư theo từng loại địa chỉ), **Gửi**, **Nhận** (QR cho cả
4 loại), **UTXO** (bảng lọc theo loại), **Giao dịch**, **Node** (đào block / faucet),
**Cài đặt**.

Điểm đáng chú ý ở màn **Gửi**: bấm *Xem trước* sẽ chọn UTXO và ký thật nhưng
**chưa** phát sóng, rồi hiện khối *Chi tiết kỹ thuật* — bản web của cờ `--debug`:
từng vòng lặp coin selection kèm lý do, cấu trúc input/output, cách ghép chữ ký
theo từng loại địa chỉ, và raw hex. Xem xong mới bấm phát sóng.

### Log ở terminal

Terminal chạy `npm run web` in chi tiết từng lời gọi API — tham số, từng bước xử
lý kèm thời gian, kết quả:

```
14:14:11  POST /api/build
  wif=cPzD…F4t  recipients=1  broadcast=true
  → nguoi nhan: 900000 sat -> p2wpkh (tong 900000 sat)
  → phi thi truong: 11 sat/vByte
  → quet UTXO: 32 tim thay, 32 confirmed (124ms)
  → coin selection: 1 input sau 1 vong, phi 1551 sat, change 6193776 sat
  → ky 1 input: p2wpkh(ECDSA) (7ms)
  → txid df1da467…df80  vsize 141 vB  raw 222 byte
  → PHAT SONG -> df1da4670b669a43576717df3912ec83556cd55af448d8ed973f1077a78edf80 (2ms)
  → dao 1 block de xac nhan -> height 139
  200 OK  (162ms)
```

- **Private key luôn bị che** (`cPzD…F4t`) — không bao giờ ghi đầy đủ ra log.
- Chỉ log `/api`, bỏ qua file tĩnh của giao diện.
- Tắt: `LOG=off npm run web`

Cài đặt ở `src/logger.js`.

### Kiến trúc

```
server.js          Express, chỉ bind 127.0.0.1, lớp mỏng bọc src/
src/logger.js      log request ra terminal (che private key)
frontend/          React 19 + Vite + TypeScript
  src/api.ts       gọi /api, có type đầy đủ
  src/useWallet.ts state ví dùng chung (Context)
  src/pages/       7 màn
  src/components/  Card/Button/Input… + TxDebug
```

`server.js` không chứa logic Bitcoin nào — mọi tính toán vẫn nằm trong `src/`,
đúng những hàm mà CLI dùng.

### Bảo mật

Private key được gửi lên server để ký, **không giống ví thật**. Chấp nhận được vì
đây là công cụ học tập chạy cục bộ, và đã có 2 rào:

- Server chỉ lắng nghe `127.0.0.1`, máy khác không kết nối được.
- Server **từ chối khởi động** nếu `NETWORK=mainnet`.

Đừng nhập private key có tiền thật.

## Sử dụng CLI (chung cho mọi mạng)

```bash
# 1. Tạo private key (WIF) + xem 4 địa chỉ
node src/index.js genkey

# 2. Suy ra địa chỉ từ 1 private key có sẵn
node src/index.js addr <WIF>

# 3. Quét UTXO & số dư trên cả 4 địa chỉ
node src/index.js balance <WIF>

# 4. Tạo + ký giao dịch gửi 1 người (mặc định dry-run, in raw hex)
node src/index.js send <WIF> <địa_chỉ_nhận> <số_sat>

# 5. Gửi 1 lần cho NHIỀU ĐỊA CHỈ (Batching Transactions - tiết kiệm phí)
node src/index.js send <WIF> <địa_chỉ_1> <sat_1> <địa_chỉ_2> <sat_2>
# hoặc cú pháp dấu hai chấm:
node src/index.js send <WIF> <địa_chỉ_1>:<sat_1> <địa_chỉ_2>:<sat_2>

# 6. Ký VÀ phát sóng luôn lên mạng lưới (thêm cờ --broadcast)
node src/index.js send <WIF> <địa_chỉ_1> <sat_1> <địa_chỉ_2> <sat_2> --broadcast
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

**regtest** — tự phát, không giới hạn, không chờ:

```bash
# rót vào cả 4 địa chỉ
node src/index.js faucet <WIF> [sat_mỗi_địa_chỉ]

# chỉ rót vào loại được chọn
node src/index.js faucet <WIF> 500000 --only p2tr
node src/index.js faucet <WIF> 500000 --only=p2pkh,p2wpkh
```

Rót chọn lọc để dựng đúng tình huống muốn thử — ví dụ chỉ có UTXO Taproot
(input rẻ nhất) hay chỉ có Legacy (đắt nhất), rồi so phí khi gửi.

Trên giao diện web, màn **Node** cho tick từng loại địa chỉ kèm số sat riêng.

**testnet** — xin từ faucet công cộng:
- https://coinfaucet.eu/en/btc-testnet/
- https://mempool.space/testnet

## 8 bước quy trình được cài đặt ở đâu

| Bước | Mô tả | File |
|------|-------|------|
| 0 | Dựng mạng local + đào block (chỉ regtest) | `src/rpc.js`, `scripts/node.sh` |
| — | Giao diện web (bọc lại các bước dưới) | `server.js`, `web/` |
| 1 | Private key → public key → 4 loại địa chỉ | `src/wallet.js` |
| 2 | Quét UTXO chưa chi | `src/api.js` (`fetchUtxos`) |
| 3 | Coin selection (ít input → phí rẻ) | `src/coinselect.js` |
| 4 | Dựng giao dịch chưa ký (inputs/outputs/change) | `src/tx.js` |
| 5 | Băm Sighash & ký ECDSA/Schnorr (canonical, chống malleability) | `src/tx.js` |
| 6 | Ghép chữ ký vào scriptSig / witness theo loại địa chỉ | `src/tx.js` (`finalizeAllInputs`) |
| 7 | Serialize thành raw hex hoàn chỉnh | `src/tx.js` (`extractTransaction`) |
| 8 | Phát sóng lên mạng | `src/api.js` (`broadcast`) |

### Hai backend mạng

`src/api.js` chỉ là bộ định tuyến; `index.js` và `tx.js` không biết đang chạy backend nào.

| | `src/backend/bitcoind.js` (regtest) | `src/backend/esplora.js` (testnet/mainnet) |
|---|---|---|
| Quét UTXO | `scantxoutset` với descriptor `addr(...)` | `GET /address/<addr>/utxo` |
| Raw tx trước | `getrawtransaction` (cần `-txindex=1`) | `GET /tx/<txid>/hex` |
| Ước lượng phí | `estimatesmartfee`, luôn fallback `FEE_RATE` | `GET /v1/fees/recommended` |
| Broadcast | `sendrawtransaction` | `POST /tx` |

Vì `scantxoutset` quét thẳng tập UTXO nên **không cần import ví, không cần rescan**.
Đổi lại nó chỉ thấy UTXO đã vào block (không thấy mempool) — trên regtest không
thành vấn đề vì ta chủ động đào block sau mỗi lần gửi.

## Cấu hình

Qua biến môi trường (`src/config.js`, đọc từ `.env`):

- `NETWORK` — `regtest` | `testnet` (mặc định) | `mainnet`.
- `FEE_RATE` — sat/vByte dự phòng. Trên regtest **luôn** dùng số này (không có thị trường phí).
- `API_BASE` — đổi endpoint REST, ví dụ testnet4: `https://mempool.space/testnet4/api`.
- `RPC_URL` / `RPC_USER` / `RPC_PASS` / `RPC_WALLET` — chỉ dùng khi `NETWORK=regtest`.
  Mặc định `http://127.0.0.1:18443`, user/pass `bitcoin`, ví miner tên `miner`.

## Ngưỡng dust

Bitcoin Core từ chối output quá nhỏ (`dust, tx with dust output must be 0-fee`),
vì tiêu output đó tốn phí hơn giá trị nó mang. Ngưỡng **khác nhau theo loại**:

| Loại output | Ngưỡng |
|---|---|
| Legacy P2PKH | 546 sat |
| Nested SegWit P2SH-P2WPKH | 540 sat |
| Native SegWit P2WPKH | 294 sat |
| Taproot P2TR | 330 sat |

Core tính `dust = 3 × (kích thước output + kích thước input để tiêu nó) × 3000 sat/kvB`.
Output SegWit tiêu rẻ hơn nên ngưỡng thấp hơn.

Tool chặn ở cả 3 tầng nên bạn không bao giờ chạm phải lỗi này lúc broadcast:
CLI (`parseRecipients`), API (`/api/build`), và giao diện (cảnh báo ngay khi gõ).
Riêng **change** dưới ngưỡng thì không báo lỗi mà được gộp vào phí — xem
`selectCoins()` trong `src/coinselect.js`.

## Ghi chú kỹ thuật

- **Legacy P2PKH** cần raw hex của giao dịch trước (`nonWitnessUtxo`) để tính sighash — tool tự tải qua API.
- **Taproot** dùng key-path spend: signer được *tweak* bằng `taggedHash('TapTweak', xOnlyPubkey)` (BIP341) rồi ký Schnorr.
- Chữ ký ECDSA được bitcoinjs ký **low-S canonical** để tránh transaction malleability.
- Chữ ký được xác minh lại đúng theo loại (ECDSA vs Schnorr) trước khi finalize — lưu ý cả hai đều dài 64 byte nên phân biệt theo loại input, không theo độ dài.

[bitcoinjs-lib]: https://github.com/bitcoinjs/bitcoinjs-lib

> ⚠️ Chỉ dùng cho testnet / mục đích học tập. Không đưa private key thật vào command line trên máy chia sẻ.
