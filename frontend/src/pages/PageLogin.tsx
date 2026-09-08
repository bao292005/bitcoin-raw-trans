import { useState } from 'react'
import { api, type AddressInfo, type NetworkInfo } from '../api'

interface Props {
  net: NetworkInfo | null
  onLogin: (wif: string, publicKey: string, addresses: AddressInfo[]) => void
}

export default function PageLogin({ net, onLogin }: Props) {
  const [wif, setWif] = useState('')
  const [showWif, setShowWif] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generated, setGenerated] = useState('')

  const open = async (candidate: string) => {
    setError('')
    if (!candidate.trim()) {
      setError('Vui lòng nhập private key (WIF).')
      return
    }
    setLoading(true)
    try {
      const r = await api.addresses(candidate.trim())
      onLogin(candidate.trim(), r.publicKey, r.addresses)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Tao vi moi: hien WIF ra man hinh de nguoi dung luu lai truoc khi vao.
  const genkey = async () => {
    setError('')
    setGenerating(true)
    try {
      const r = await api.genkey()
      setWif(r.wif)
      setGenerated(r.wif)
      setShowWif(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '14px 18px',
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F7931A'
    e.target.style.boxShadow = '0 0 0 3px rgba(247,147,26,0.15)'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
    e.target.style.boxShadow = 'none'
  }

  const netLabel = net
    ? net.connected
      ? `${net.network}${net.blocks !== undefined ? ` · block ${net.blocks.toLocaleString()}` : ''}`
      : `${net.network} · mất kết nối`
    : 'đang kết nối…'
  const netOk = !!net?.connected

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #070E1C 0%, #0B1426 50%, #0D1A35 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: 24,
    }}>
      {/* Ambient glow blobs */}
      <div style={{ position: 'absolute', top: '15%', left: '20%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(247,147,26,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,139,223,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{
        width: 460,
        background: '#1A2A4A',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 24,
        padding: '40px 36px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(247,147,26,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #F7931A, #F9A84A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(247,147,26,0.4)',
            flexShrink: 0,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#0B1426" strokeWidth="1.5"/>
              <path d="M15 8.5C15 8.5 14 7 12 7C10 7 8.5 8 8.5 9.5C8.5 13 15.5 11 15.5 14.5C15.5 16.5 13.5 17.5 12 17.5C10 17.5 8.5 16 8.5 16M12 6V7M12 17.5V19" stroke="#0B1426" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', lineHeight: 1.2 }}>BTC Wallet</h1>
            <div style={{ color: netOk ? '#4A8BDF' : '#FF4757', fontSize: 12, fontWeight: 500, marginTop: 2 }}>
              <span
                className={netOk ? 'pulse-dot' : undefined}
                style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: netOk ? '#00D4AA' : '#FF4757', marginRight: 5, verticalAlign: 'middle' }}
              />
              {netLabel}
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '24px -36px' }} />

        <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Mở ví</h2>
        <p style={{ color: '#6B8BB0', fontSize: 13, marginBottom: 24 }}>
          Nhập private key dạng WIF. Từ một key này sẽ suy ra cả 4 loại địa chỉ.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); open(wif) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', color: '#A8C4E8', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              Private key (WIF)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showWif ? 'text' : 'password'}
                placeholder="cQWPNDDbcL31KCZ8SZJQWVrkub9b…"
                value={wif}
                onChange={(e) => { setWif(e.target.value); setGenerated('') }}
                style={{ ...inputBase, paddingRight: 48 }}
                onFocus={handleFocus}
                onBlur={handleBlur}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowWif((v) => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B8BB0', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  {showWif
                    ? <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/></>
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Vi vua tao -> nhac luu lai */}
          {generated && (
            <div style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ color: '#00D4AA', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>✓ Đã tạo ví mới</p>
              <p style={{ color: '#A8C4E8', fontSize: 12, lineHeight: '18px', marginBottom: 8 }}>
                Lưu lại key này — không có nó thì không mở lại được ví.
              </p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(generated)}
                style={{ background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 6, padding: '5px 12px', color: '#00D4AA', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                ⎘ Sao chép WIF
              </button>
            </div>
          )}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 10, padding: '10px 14px' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" stroke="#FF4757" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="#FF4757" strokeWidth="1.8" strokeLinecap="round"/></svg>
              <span style={{ color: '#FF4757', fontSize: 13 }}>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !wif.trim()}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              cursor: loading || !wif.trim() ? 'not-allowed' : 'pointer',
              background: loading || !wif.trim() ? 'rgba(247,147,26,0.35)' : 'linear-gradient(135deg, #F7931A, #F9A84A)',
              color: '#0B1426', fontSize: 15, fontWeight: 700,
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading || !wif.trim() ? 'none' : '0 4px 20px rgba(247,147,26,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="#0B1426" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                Đang mở…
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" stroke="#0B1426" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#0B1426" strokeWidth="2" strokeLinecap="round"/></svg>
                Mở ví
              </>
            )}
          </button>
        </form>

        {/* Tao vi moi */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ color: '#6B8BB0', fontSize: 12 }}>hoặc</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <button
            type="button"
            onClick={genkey}
            disabled={generating}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#FFFFFF', fontSize: 14, fontWeight: 500,
              cursor: generating ? 'wait' : 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
          >
            {generating ? 'Đang tạo…' : '+ Tạo ví mới'}
          </button>
        </div>

        <p style={{ color: '#6B8BB0', fontSize: 11, lineHeight: '17px', marginTop: 20, textAlign: 'center' }}>
          Công cụ học tập chạy cục bộ. Server chỉ lắng nghe trên 127.0.0.1 và từ chối
          khởi động trên mainnet. Đừng dùng key thật.
        </p>
      </div>
    </div>
  )
}
