import type { CSSProperties, ReactNode, InputHTMLAttributes } from 'react'

// ── Card ────────────────────────────────────────────────────────────────────
export function Card({ children, glow = false, style }: { children: ReactNode; glow?: boolean; style?: CSSProperties }) {
  return (
    <div style={{
      background: '#1A2A4A',
      border: glow ? '1px solid rgba(247,147,26,0.2)' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16,
      padding: 24,
      boxShadow: glow
        ? '0 0 40px rgba(247,147,26,0.05), 0 4px 16px rgba(0,0,0,0.3)'
        : '0 4px 16px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(10px)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Buttons ─────────────────────────────────────────────────────────────────
export function BtnPrimary({ children, onClick, disabled, style }: { children: ReactNode; onClick?: () => void; disabled?: boolean; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(247,147,26,0.3)' : 'linear-gradient(135deg, #F7931A, #F9A84A)',
        border: 'none', borderRadius: 10, padding: '12px 24px',
        color: '#0B1426', fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(247,147,26,0.3)',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 20px rgba(247,147,26,0.4)' } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = disabled ? 'none' : '0 4px 14px rgba(247,147,26,0.3)' }}
    >
      {children}
    </button>
  )
}

export function BtnSecondary({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 24px',
        color: '#FFFFFF', fontSize: 15, fontWeight: 500, cursor: 'pointer',
        backdropFilter: 'blur(10px)', transition: 'background 0.15s',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
    >
      {children}
    </button>
  )
}

export function BtnGhost({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', borderRadius: 8,
        padding: '8px 14px', color: '#A8C4E8', fontSize: 14, fontWeight: 500,
        cursor: 'pointer', transition: 'background 0.15s',
        fontFamily: 'Inter, sans-serif',
        ...style,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

// ── Input ────────────────────────────────────────────────────────────────────
type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; suffix?: ReactNode }
export function Input({ label, suffix, style, ...rest }: InputProps) {
  return (
    <div>
      {label && <label style={{ display: 'block', color: '#A8C4E8', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          {...rest}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
            padding: suffix ? '14px 60px 14px 18px' : '14px 18px',
            color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter, sans-serif',
            outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
            ...style,
          }}
          onFocus={e => { e.target.style.borderColor = '#F7931A'; e.target.style.boxShadow = '0 0 0 3px rgba(247,147,26,0.15)' }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
        />
        {suffix && <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ children, color = '#00D4AA' }: { children: ReactNode; color?: string }) {
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}33`,
      color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
    }}>{children}</span>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, subColor = '#00D4AA', glow }: { label: string; value: string; sub?: string; subColor?: string; glow?: boolean }) {
  return (
    <Card glow={glow} style={{ padding: '20px 24px' }}>
      <p style={{ color: '#6B8BB0', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{label}</p>
      <p style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>{value}</p>
      {sub && <p style={{ color: subColor, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{sub}</p>}
    </Card>
  )
}

// ── Section header ────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}>{title}</h2>
      {action}
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────
export function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 -24px' }} />
}

// ── Tx icon ───────────────────────────────────────────────────────────────
export function TxIcon({ type }: { type: 'receive' | 'send' }) {
  const isReceive = type === 'receive'
  return (
    <div
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        flexShrink: 0,
        background: isReceive ? 'rgba(0,212,170,0.1)' : 'rgba(255,71,87,0.1)',
        border: `1px solid ${isReceive ? 'rgba(0,212,170,0.2)' : 'rgba(255,71,87,0.2)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isReceive
        ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 21V8M7 13l5-5 5 5" stroke="#FF4757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      }
    </div>
  )
}

// ── Tx label cell (icon + text, never merged) ─────────────────────────────
export function TxLabelCell({ type, label }: { type: 'receive' | 'send'; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {/* Icon lives in its own box — never concatenated with the label string */}
      <TxIcon type={type} />
      {/* Label in its own element so it cannot bleed into the icon */}
      <span style={{
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
    </div>
  )
}
