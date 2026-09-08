// State dung chung cho ca ung dung: WIF dang mo, 4 dia chi, danh sach UTXO,
// va thong tin mang luoi. Dat trong Context de moi trang doc cung mot nguon.
import { createContext, useContext } from 'react'
import type { AddressInfo, NetworkInfo, Utxo } from './api'

export interface WalletState {
  wif: string
  publicKey: string
  addresses: AddressInfo[]

  utxos: Utxo[]
  total: number
  confirmedTotal: number
  loadingUtxos: boolean

  net: NetworkInfo | null

  /** Quet lai UTXO tu mang luoi. */
  refreshUtxos: () => Promise<void>
  /** Doc lai chieu cao block / so du miner. */
  refreshNet: () => Promise<void>
  /** Ca hai. */
  refreshAll: () => Promise<void>

  logout: () => void
}

export const WalletContext = createContext<WalletState | null>(null)

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet phai dung ben trong <WalletContext.Provider>')
  return ctx
}

/** Tra ve dia chi theo loai, vd byType('p2wpkh'). */
export function useAddress(key: AddressInfo['key']): string {
  const { addresses } = useWallet()
  return addresses.find((a) => a.key === key)?.address ?? ''
}
