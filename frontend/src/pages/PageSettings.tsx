import { useState } from 'react'
import { Card } from '../components/ui'
import { useWallet } from '../useWallet'
import { TYPE_META, fmtSat, toBtc } from '../api'

export default function PageSettings() {
  const { net, wif, publicKey, addresses, utxos } = useWallet()
  const [showWif, setShowWif] = useState(false)
  const [copied, setCopied] = useState('')

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }

  const Row = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#6B8BB0', fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#FFFFFF', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 840 }}>
      {/* Mang luoi */}
      <Card>
        <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Mạng lưới</h2>
        <Row label="NETWORK" value={net?.network ?? '—'} mono />
        <Row label="Nguồn dữ liệu" value={net?.useRpc ? 'bitcoind JSON-RPC' : 'REST Esplora'} />
        <Row label="Endpoint" value={net?.apiBase ?? '—'} mono />
        <Row label="Kết nối" value={net?.connected ? 'đang kết nối' : 'mất kết nối'} />
        {net?.blocks !== undefined && <Row label="Chiều cao chuỗi" value={net.blocks.toLocaleString()} mono />}
        {net?.minerBalance !== undefined && <Row label="Số dư ví miner" value={fmtSat(net.minerBalance)} mono />}
        <Row label="Phí áp dụng" value={net?.feeRate != null ? `${net.feeRate} sat/vByte` : '—'} mono />
        {net?.error && (
          <p style={{ color: '#FF4757', fontSize: 12, marginTop: 10, lineHeight: '19px' }}>{net.error}</p>
        )}
      </Card>

      {/* Vi */}
      <Card>
        <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Ví đang mở</h2>
        <p style={{ color: '#6B8BB0', fontSize: 13, marginBottom: 14 }}>
          Cả 4 địa chỉ đều suy ra từ cùng một private key.
        </p>

        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#6B8BB0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Public key
          </p>
          <p style={{ color: '#A8C4E8', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '17px' }}>
            {publicKey}
          </p>
        </div>

        {addresses.map((a) => {
          const m = TYPE_META[a.type]
          const mine = utxos.filter((u) => u.address === a.address)
          const sum = mine.reduce((s, u) => s + u.value, 0)
          return (
            <div key={a.key} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0, marginTop: 5 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
                  {m.label}{' '}
                  <span style={{ color: '#6B8BB0', fontWeight: 400, fontFamily: 'monospace', fontSize: 11 }}>{m.short}</span>
                </p>
                <p
                  onClick={() => copy(a.key, a.address)}
                  style={{ color: copied === a.key ? '#00D4AA' : '#A8C4E8', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 2, cursor: 'pointer' }}
                >
                  {copied === a.key ? '✓ đã sao chép' : a.address}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'monospace' }}>{toBtc(sum)}</p>
                <p style={{ color: '#6B8BB0', fontSize: 11 }}>{mine.length} UTXO</p>
              </div>
            </div>
          )
        })}
      </Card>

      {/* Private key */}
      <Card style={{ background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)' }}>
        <h2 style={{ color: '#FF4757', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Private key</h2>
        <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px', marginBottom: 14 }}>
          Ai có key này là có toàn quyền với số tiền trong ví.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 14px',
          }}>
            <p style={{ color: '#A8C4E8', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {showWif ? wif : '•'.repeat(52)}
            </p>
          </div>
          <button
            onClick={() => setShowWif((v) => !v)}
            style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', color: '#A8C4E8', fontSize: 12,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {showWif ? 'Ẩn' : 'Hiện'}
          </button>
          <button
            onClick={() => copy('wif', wif)}
            style={{
              padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', color: copied === 'wif' ? '#00D4AA' : '#A8C4E8',
              fontSize: 12, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {copied === 'wif' ? '✓' : '⎘'}
          </button>
        </div>
      </Card>

      {/* Bao mat */}
      <Card style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.15)' }}>
        <h3 style={{ color: '#F7931A', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          Về mô hình bảo mật của công cụ này
        </h3>
        {[
          'Private key được gửi lên server cục bộ để ký — đây KHÔNG phải cách ví thật hoạt động.',
          'Server chỉ lắng nghe trên 127.0.0.1, không nhận kết nối từ máy khác.',
          'Server từ chối khởi động nếu NETWORK=mainnet.',
          'Đây là công cụ học tập. Đừng bao giờ nhập private key có tiền thật.',
        ].map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 7 }}>
            <span style={{ color: '#F7931A', fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
            <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px' }}>{t}</p>
          </div>
        ))}
      </Card>
    </div>
  )
}
