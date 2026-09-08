import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Card, BtnPrimary } from '../components/ui'
import { useWallet } from '../useWallet'
import { TYPE_META, toBtc, type AddrKey } from '../api'

export default function PageReceive() {
  const { addresses, utxos, publicKey, net } = useWallet()
  const [active, setActive] = useState<AddrKey>('p2wpkh')
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState('')

  const current = addresses.find((a) => a.key === active)
  const address = current?.address ?? ''
  const meta = current ? TYPE_META[current.type] : null

  // Tong so tien va so UTXO dang nam o dia chi nay.
  const stats = useMemo(() => {
    const mine = utxos.filter((u) => u.address === address)
    return { count: mine.length, sum: mine.reduce((s, u) => s + u.value, 0) }
  }, [utxos, address])

  // Sinh QR that tu dia chi (thay vi SVG ve tay).
  useEffect(() => {
    if (!address) return
    let cancelled = false
    QRCode.toDataURL(address.toUpperCase(), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 240,
      color: { dark: '#0B1426', light: '#FFFFFF' },
    })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch(() => { if (!cancelled) setQr('') })
    return () => { cancelled = true }
  }, [address])

  const handleCopy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Trai: QR + chon loai */}
      <Card glow style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {/* Tab 4 loai dia chi */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', background: '#131F3A', borderRadius: 12, padding: 4, width: '100%', gap: 4 }}>
          {addresses.map((a) => {
            const isActive = a.key === active
            const m = TYPE_META[a.type]
            return (
              <button
                key={a.key}
                onClick={() => setActive(a.key)}
                style={{
                  padding: '9px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  fontWeight: isActive ? 700 : 400, transition: 'all 0.15s', border: 'none',
                  background: isActive ? `${m.color}1F` : 'transparent',
                  color: isActive ? m.color : '#6B8BB0',
                  outline: isActive ? `1px solid ${m.color}44` : '1px solid transparent',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {meta && (
          <p style={{ color: '#6B8BB0', fontSize: 12, textAlign: 'center' }}>
            <span style={{ color: meta.color, fontFamily: 'monospace' }}>{meta.short}</span> · {meta.note}
          </p>
        )}

        {/* QR that */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minHeight: 272, minWidth: 272, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {qr
            ? <img src={qr} alt={`QR ${address}`} width={240} height={240} style={{ display: 'block' }} />
            : <span style={{ color: '#6B8BB0', fontSize: 13 }}>Đang tạo QR…</span>}
        </div>

        {/* Dia chi */}
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ color: '#A8C4E8', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '19px' }}>
            {address || '—'}
          </p>
        </div>

        <BtnPrimary onClick={handleCopy} style={{ width: '100%', fontSize: 14, padding: '11px 0' }}>
          {copied ? '✓ Đã sao chép' : '⎘ Sao chép địa chỉ'}
        </BtnPrimary>
      </Card>

      {/* Phai: thong tin */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Thông tin địa chỉ</h2>
          {[
            { label: 'Loại', value: meta?.label ?? '—' },
            { label: 'Chuẩn', value: meta?.short ?? '—', mono: true },
            { label: 'Mạng', value: net?.network ?? '—' },
            { label: 'Số UTXO', value: `${stats.count}` },
            { label: 'Số dư', value: `${toBtc(stats.sum)} BTC`, mono: true },
          ].map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#6B8BB0', fontSize: 13 }}>{r.label}</span>
              <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 500, fontFamily: r.mono ? 'monospace' : 'inherit' }}>{r.value}</span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <p style={{ color: '#6B8BB0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
              Public key
            </p>
            <p style={{ color: '#A8C4E8', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '17px' }}>
              {publicKey}
            </p>
          </div>
        </Card>

        <Card style={{ background: 'rgba(74,139,223,0.06)', border: '1px solid rgba(74,139,223,0.15)' }}>
          <h3 style={{ color: '#4A8BDF', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Cùng một private key, bốn địa chỉ
          </h3>
          <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>
            Cả 4 địa chỉ dưới đây đều khoá cùng <strong style={{ color: '#FFFFFF' }}>một</strong> public key.
            Khác nhau chỉ ở cách đóng gói script khoá — dẫn tới cách ký và chi phí khác nhau.
          </p>
          {addresses.map((a) => {
            const m = TYPE_META[a.type]
            return (
              <div key={a.key} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0, marginTop: 5 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
                    {m.label} <span style={{ color: '#6B8BB0', fontWeight: 400, fontFamily: 'monospace', fontSize: 11 }}>{m.short}</span>
                  </p>
                  <p style={{ color: '#6B8BB0', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2 }}>
                    {a.address}
                  </p>
                </div>
              </div>
            )
          })}
        </Card>

        {net?.network === 'regtest' && (
          <Card style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', padding: '16px 20px' }}>
            <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px' }}>
              Đang ở mạng local — không cần QR để nhận tiền. Sang màn{' '}
              <strong style={{ color: '#00D4AA' }}>Node</strong> bấm Faucet là có tiền ngay ở cả 4 địa chỉ.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
