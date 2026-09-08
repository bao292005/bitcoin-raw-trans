interface Props {
  onConfirm: () => void
  onCancel: () => void
}

export default function LogoutModal({ onConfirm, onCancel }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.18s ease both',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } } @keyframes scaleIn { from { opacity:0; transform:scale(0.95) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }`}</style>

      <div style={{
        width: 400,
        background: '#1A2A4A',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '36px 32px 28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'scaleIn 0.2s ease both',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle top-right glow */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,71,87,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Close button */}
        <button
          onClick={onCancel}
          style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B8BB0', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'rgba(255,71,87,0.1)',
            border: '1px solid rgba(255,71,87,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#FF4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17l5-5-5-5M21 12H9" stroke="#FF4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Đăng xuất</h2>
        <p style={{ color: '#A8C4E8', fontSize: 14, textAlign: 'center', lineHeight: '22px', marginBottom: 24 }}>
          Bạn có chắc chắn muốn đăng xuất<br/>khỏi ví Bitcoin của mình không?
        </p>

        {/* User info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 24,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #4A8BDF, #00D4AA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: '#0B1426',
          }}>S</div>
          <div>
            <p style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>Satoshi N.</p>
            <p style={{ color: '#6B8BB0', fontSize: 12 }}>satoshi@bitcoin.org</p>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00D4AA', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>Active</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              color: '#A8C4E8', fontSize: 14, fontWeight: 500, fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
              background: '#FF4757', border: 'none',
              color: '#FFFFFF', fontSize: 14, fontWeight: 700, fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 16px rgba(255,71,87,0.35)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(255,71,87,0.45)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(255,71,87,0.35)' }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
