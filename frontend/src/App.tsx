import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import LogoutModal from './components/LogoutModal'
import PageLogin from './pages/PageLogin'
import PageDashboard from './pages/PageDashboard'
import PageSend from './pages/PageSend'
import PageReceive from './pages/PageReceive'
import PageUtxos from './pages/PageUtxos'
import PageTransactions from './pages/PageTransactions'
import PageNode from './pages/PageNode'
import PageSettings from './pages/PageSettings'
import { api, type AddressInfo, type NetworkInfo, type Utxo } from './api'
import { WalletContext, type WalletState } from './useWallet'

export type Page =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'utxos'
  | 'transactions'
  | 'node'
  | 'settings'

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  send: 'Gửi Bitcoin',
  receive: 'Nhận Bitcoin',
  utxos: 'UTXO',
  transactions: 'Giao dịch',
  node: 'Node cục bộ',
  settings: 'Cài đặt',
}

export default function App() {
  const [wif, setWif] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [addresses, setAddresses] = useState<AddressInfo[]>([])

  const [utxos, setUtxos] = useState<Utxo[]>([])
  const [total, setTotal] = useState(0)
  const [confirmedTotal, setConfirmedTotal] = useState(0)
  const [loadingUtxos, setLoadingUtxos] = useState(false)

  const [net, setNet] = useState<NetworkInfo | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [showLogout, setShowLogout] = useState(false)

  const refreshNet = useCallback(async () => {
    try {
      setNet(await api.network())
    } catch {
      setNet(null)
    }
  }, [])

  const refreshUtxos = useCallback(async () => {
    if (!wif) return
    setLoadingUtxos(true)
    try {
      const r = await api.utxos(wif)
      setUtxos(r.utxos)
      setTotal(r.total)
      setConfirmedTotal(r.confirmedTotal)
    } finally {
      setLoadingUtxos(false)
    }
  }, [wif])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshNet(), refreshUtxos()])
  }, [refreshNet, refreshUtxos])

  // Thong tin mang luoi doc duoc ca khi chua mo vi (man dang nhap can no).
  useEffect(() => {
    refreshNet()
  }, [refreshNet])

  // Vua mo vi -> quet UTXO ngay.
  useEffect(() => {
    if (wif) refreshUtxos()
  }, [wif, refreshUtxos])

  const handleLogin = (w: string, pk: string, addrs: AddressInfo[]) => {
    setWif(w)
    setPublicKey(pk)
    setAddresses(addrs)
  }

  const logout = () => {
    setWif('')
    setPublicKey('')
    setAddresses([])
    setUtxos([])
    setTotal(0)
    setConfirmedTotal(0)
    setPage('dashboard')
  }

  if (!wif) {
    return <PageLogin net={net} onLogin={handleLogin} />
  }

  const state: WalletState = {
    wif,
    publicKey,
    addresses,
    utxos,
    total,
    confirmedTotal,
    loadingUtxos,
    net,
    refreshUtxos,
    refreshNet,
    refreshAll,
    logout,
  }

  const content = () => {
    switch (page) {
      case 'dashboard':    return <PageDashboard onNavigate={setPage} />
      case 'send':         return <PageSend onNavigate={setPage} />
      case 'receive':      return <PageReceive />
      case 'utxos':        return <PageUtxos onNavigate={setPage} />
      case 'transactions': return <PageTransactions />
      case 'node':         return <PageNode />
      case 'settings':     return <PageSettings />
    }
  }

  return (
    <WalletContext.Provider value={state}>
      <div style={{ display: 'flex', height: '100%', background: '#0B1426', overflow: 'hidden' }}>
        <Sidebar active={page} onNavigate={setPage} onLogoutClick={() => setShowLogout(true)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 280, overflow: 'hidden' }}>
          <Header title={pageTitles[page]} />
          <main
            key={page}
            className="page-enter"
            style={{ flex: 1, overflowY: 'auto', padding: 32, maxWidth: 1200, width: '100%' }}
          >
            {content()}
          </main>
        </div>
      </div>

      {showLogout && (
        <LogoutModal
          onCancel={() => setShowLogout(false)}
          onConfirm={() => {
            setShowLogout(false)
            logout()
          }}
        />
      )}
    </WalletContext.Provider>
  )
}
