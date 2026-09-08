import { useState } from 'react'
import { useWallet } from '../useWallet'
import { fmtSat, toBtc } from '../api'

export default function Header({ title }: { title: string }) {
  const { confirmedTotal, total, net, loadingUtxos, refreshAll } = useWallet()
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshAll()
    } finally {
      setRefreshing(false)
    }
  }

  const busy = refreshing || loadingUtxos
  const pending = total - confirmedTotal

  return (
    <header style={{
      height: 72, flexShrink: 0,
      background: '#0B1426',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* Trai: breadcrumb + tieu de */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#6B8BB0', fontSize: 13 }}>BTC Wallet</span>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="#6B8BB0" strokeWidth="2" strokeLinecap="round"/></svg>
          <span style={{ color: '#A8C4E8', fontSize: 13 }}>{title}</span>
        </div>
        <h1 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, lineHeight: '28px', letterSpacing: '-0.3px' }}>{title}</h1>
      </div>

      {/* Phai: so du that + phi + nut quet lai */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#6B8BB0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Số dư khả dụng
          </p>
          <p style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}>
            {toBtc(confirmedTotal)} BTC
          </p>
          <p style={{ color: '#6B8BB0', fontSize: 11 }}>
            {fmtSat(confirmedTotal)}
            {pending > 0 && <span style={{ color: '#F7931A' }}> · +{fmtSat(pending)} chờ</span>}
          </p>
        </div>

        {net?.feeRate != null && (
          <div style={{
            padding: '6px 12px', borderRadius: 10,
            background: 'rgba(74,139,223,0.08)', border: '1px solid rgba(74,139,223,0.18)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#6B8BB0', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Phí</p>
            <p style={{ color: '#4A8BDF', fontSize: 13, fontWeight: 700 }}>{net.feeRate} sat/vB</p>
          </div>
        )}

        <button
          onClick={doRefresh}
          disabled={busy}
          title="Quét lại UTXO và trạng thái mạng"
          style={{
            width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)', cursor: busy ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
        >
          <svg
            width="18" height="18" fill="none" viewBox="0 0 24 24"
            style={busy ? { animation: 'spin 0.8s linear infinite' } : undefined}
          >
            <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" stroke="#A8C4E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
