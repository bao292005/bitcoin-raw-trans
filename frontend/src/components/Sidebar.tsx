import type { Page } from '../App'
import { useWallet } from '../useWallet'
import { short } from '../api'

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    id: 'send', label: 'Gửi',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/></svg>,
  },
  {
    id: 'receive', label: 'Nhận',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3v14M7 12l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    id: 'utxos', label: 'UTXO',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="7" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.8"/><circle cx="7" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="17" r="3.2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
  {
    id: 'transactions', label: 'Giao dịch',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  },
  {
    id: 'node', label: 'Node',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="2" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="18" height="6" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M7 7.5h.01M7 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  },
  {
    id: 'settings', label: 'Cài đặt',
    icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.8"/></svg>,
  },
]

// regtest hien mau xanh la (an toan), testnet vang, mainnet do (canh bao).
const NET_COLOR: Record<string, string> = {
  regtest: '#00D4AA',
  testnet: '#F7931A',
  mainnet: '#FF4757',
}

export default function Sidebar({ active, onNavigate, onLogoutClick }: { active: Page; onNavigate: (p: Page) => void; onLogoutClick: () => void }) {
  const { net, addresses } = useWallet()

  const connected = !!net?.connected
  const netName = net?.network ?? '…'
  const dotColor = connected ? NET_COLOR[netName] ?? '#4A8BDF' : '#FF4757'
  const mainAddress = addresses.find((a) => a.key === 'p2wpkh')?.address ?? ''

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, bottom: 0, width: 280, zIndex: 100,
      background: '#0F2642',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #F7931A, #F9A84A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(247,147,26,0.35)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#0B1426" strokeWidth="1.5"/>
              <path d="M15 8.5C15 8.5 14 7 12 7C10 7 8.5 8 8.5 9.5C8.5 13 15.5 11 15.5 14.5C15.5 16.5 13.5 17.5 12 17.5C10 17.5 8.5 16 8.5 16M12 6V7M12 17.5V19" stroke="#0B1426" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>BTC Wallet</div>
            <div style={{ color: dotColor, fontSize: 11, fontWeight: 500 }}>
              <span
                className={connected ? 'pulse-dot' : undefined}
                style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: dotColor, marginRight: 5, verticalAlign: 'middle' }}
              />
              {connected
                ? `${netName}${net?.blocks !== undefined ? ` · block ${net.blocks.toLocaleString()}` : ''}`
                : `${netName} · mất kết nối`}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <p style={{ color: '#6B8BB0', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 8 }}>Menu</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'rgba(247,147,26,0.12)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #F7931A' : '3px solid transparent',
                  color: isActive ? '#F7931A' : '#6B8BB0',
                  fontSize: 14, fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = isActive ? '#F7931A' : '#A8C4E8' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = isActive ? '#F7931A' : '#6B8BB0' }}
              >
                {item.icon}
                {item.label}
                {isActive && (
                  <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#F7931A', opacity: 0.8 }} />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Vi dang mo */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #4A8BDF, #00D4AA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#0B1426',
          }}>₿</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>Ví đang mở</div>
            <div style={{ color: '#6B8BB0', fontSize: 11, fontFamily: 'monospace' }}>
              {mainAddress ? short(mainAddress, 10, 6) : '—'}
            </div>
          </div>
        </div>
        <button onClick={onLogoutClick} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '9px 12px', borderRadius: 8, background: 'transparent', border: 'none',
          color: '#6B8BB0', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,71,87,0.08)'; (e.currentTarget as HTMLElement).style.color = '#FF4757' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6B8BB0' }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Đóng ví
        </button>
      </div>
    </aside>
  )
}
