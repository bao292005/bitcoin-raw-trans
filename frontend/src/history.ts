// Nhat ky giao dich DA GUI qua giao dien nay.
//
// Vi sao can rieng: core khong luu lich su giao dich. `scantxoutset` chi tra ve
// UTXO CHUA TIEU tai thoi diem hoi — khong biet gi ve tien da tieu hay tien vao
// trong qua khu. Muon lich su day du phai co indexer (Electrum server, Esplora)
// hoac vi theo doi dia chi tu truoc.
//
// Nen o day ta chi ghi lai nhung gi CHINH UNG DUNG NAY lam ra, luu trong
// localStorage theo dia chi vi. Khong bia du lieu.

export interface SentTx {
  txid: string
  at: number // epoch ms
  target: number // tong sat gui cho nguoi nhan
  fee: number
  change: number
  vsize: number
  inputCount: number
  inputTypes: string[]
  outputs: { address: string; value: number; isChange: boolean }[]
}

const KEY_PREFIX = 'brt:sent:'
const MAX_ENTRIES = 100

const keyFor = (walletId: string) => `${KEY_PREFIX}${walletId}`

export function loadSent(walletId: string): SentTx[] {
  if (!walletId) return []
  try {
    const raw = localStorage.getItem(keyFor(walletId))
    return raw ? (JSON.parse(raw) as SentTx[]) : []
  } catch {
    return []
  }
}

export function recordSent(walletId: string, tx: SentTx): void {
  if (!walletId) return
  try {
    const list = [tx, ...loadSent(walletId).filter((t) => t.txid !== tx.txid)]
    localStorage.setItem(keyFor(walletId), JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch {
    // localStorage day hoac bi chan -> bo qua, khong lam hong luong gui tien
  }
}

export function clearSent(walletId: string): void {
  try {
    localStorage.removeItem(keyFor(walletId))
  } catch {
    // bo qua
  }
}

// "2 phut truoc", "3 gio truoc", ...
export function timeAgo(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return 'vừa xong'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}
