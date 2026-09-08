// Lop goi API toi server.js. Khong co logic Bitcoin nao o day —
// moi tinh toan deu chay o backend bang core trong ../../src.

export type AddrKey = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr'
export type AddrType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr'

export interface AddressInfo {
  key: AddrKey
  type: AddrType
  address: string
}

export interface Utxo {
  txid: string
  vout: number
  value: number
  confirmed: boolean
  type: AddrType
  address: string
}

export interface NetworkInfo {
  network: 'regtest' | 'testnet' | 'mainnet'
  useRpc: boolean
  apiBase: string
  connected: boolean
  chain?: string
  blocks?: number
  minerBalance?: number
  feeRate?: number | null
  /** Nguong dust theo loai output, do server gui xuong. */
  dust?: Record<AddrType, number>
  error?: string
}

// Nguong dust mac dinh — dung khi chua goi duoc /api/network.
// Bitcoin Core tinh theo kich thuoc output + input de tieu no.
export const DEFAULT_DUST: Record<AddrType, number> = {
  'p2pkh': 546,
  'p2sh-p2wpkh': 540,
  'p2wpkh': 294,
  'p2tr': 330,
}

// Doan loai dia chi tu tien to — de canh bao dust NGAY khi go,
// khong phai cho server tra loi. Server van kiem tra lai bang toOutputScript.
export function guessAddrType(addr: string): AddrType | null {
  const a = addr.trim()
  if (!a) return null
  if (/^(bc1p|tb1p|bcrt1p)/i.test(a)) return 'p2tr'
  if (/^(bc1q|tb1q|bcrt1q)/i.test(a)) return 'p2wpkh'
  if (/^[23]/.test(a)) return 'p2sh-p2wpkh'
  if (/^[1mn]/.test(a)) return 'p2pkh'
  return null
}

export interface SelectionStep {
  added: { type: AddrType; value: number }
  inputSum: number
  inputsVbytes: number
  feeWithChange: number
  feeNoChange: number
  needWithChange: number
  needNoChange: number
  decision: string
}

export interface SelectionTrace {
  target: number
  feeRate: number
  destType: string
  changeType: string
  baseVbytes: number
  changeVbytes: number
  sorted: { type: AddrType; value: number; txid: string; vout: number }[]
  steps: SelectionStep[]
}

export interface BuildResult {
  feeRate: number
  fee: number
  change: number
  changeAddress: string
  target: number
  inputs: Omit<Utxo, 'confirmed'>[]
  outputs: { address: string; value: number; isChange: boolean }[]
  trace: SelectionTrace
  hex: string
  txid: string
  vsize: number
  weight: number
  broadcast: boolean
  mined?: boolean
}

// ── Ham goi chung ──────────────────────────────────────────────────────────
async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ error: 'Phan hoi khong hop le tu server.' }))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Loi HTTP ${res.status}`)
  return data as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  const data = await res.json().catch(() => ({ error: 'Phan hoi khong hop le tu server.' }))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Loi HTTP ${res.status}`)
  return data as T
}

// ── Endpoints ──────────────────────────────────────────────────────────────
export const api = {
  network: () => get<NetworkInfo>('/network'),

  addresses: (wif: string) =>
    post<{ network: string; publicKey: string; addresses: AddressInfo[] }>('/addresses', { wif }),

  genkey: () =>
    post<{ wif: string; publicKey: string; addresses: AddressInfo[] }>('/genkey'),

  utxos: (wif: string) =>
    post<{ utxos: Utxo[]; total: number; confirmedTotal: number }>('/utxos', { wif }),

  build: (wif: string, recipients: { address: string; value: number }[], opts?: { broadcast?: boolean; feeRate?: number }) =>
    post<BuildResult>('/build', { wif, recipients, ...opts }),

  mine: (blocks: number) =>
    post<{ mined: number; blocks: number; lastHash: string }>('/mine', { blocks }),

  // targets: chon dia chi nao duoc rot va bao nhieu.
  // Bo trong -> rot deu vao ca 4 dia chi.
  faucet: (wif: string, targets: { key: AddrKey; value: number }[]) =>
    post<{
      txid: string
      total: number
      targets: { key: AddrKey; type: AddrType; address: string; value: number }[]
    }>('/faucet', { wif, targets }),
}

// ── Tien ich hien thi ──────────────────────────────────────────────────────

// Nhan sat, tra ve chuoi BTC 8 chu so thap phan.
export const toBtc = (sat: number) => (sat / 1e8).toFixed(8)

// "1234567" -> "1,234,567 sat"
export const fmtSat = (sat: number) => `${sat.toLocaleString('en-US')} sat`

// Rut gon chuoi dai (dia chi, txid) o giua.
export const short = (s: string, head = 8, tail = 6) =>
  s.length <= head + tail + 1 ? s : `${s.slice(0, head)}…${s.slice(-tail)}`

// Nhan dien loai dia chi -> nhan hien thi + mau.
export const TYPE_META: Record<AddrType, { label: string; short: string; color: string; note: string }> = {
  'p2pkh': {
    label: 'Legacy',
    short: 'P2PKH',
    color: '#6B8BB0',
    note: 'Chu ky nam trong scriptSig. Input nang nhat (~148 vB).',
  },
  'p2sh-p2wpkh': {
    label: 'Nested SegWit',
    short: 'P2SH-P2WPKH',
    color: '#4A8BDF',
    note: 'SegWit boc trong P2SH de tuong thich vi cu (~91 vB).',
  },
  'p2wpkh': {
    label: 'Native SegWit',
    short: 'P2WPKH',
    color: '#F7931A',
    note: 'Chu ky nam trong witness, phi re hon (~68 vB).',
  },
  'p2tr': {
    label: 'Taproot',
    short: 'P2TR',
    color: '#00D4AA',
    note: 'Ky Schnorr, key-path spend. Input re nhat (~58 vB).',
  },
}
