import { useMemo, useState } from 'react'
import type { Page } from '../App'
import { Card, BtnPrimary, BtnGhost, Badge } from '../components/ui'
import { useWallet } from '../useWallet'
import { TYPE_META, fmtSat, short, toBtc, type AddrType } from '../api'

const ALL_TYPES: AddrType[] = ['p2pkh', 'p2sh-p2wpkh', 'p2wpkh', 'p2tr']

export default function PageUtxos({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { utxos, total, confirmedTotal, loadingUtxos, refreshUtxos } = useWallet()
  const [filter, setFilter] = useState<AddrType | 'all'>('all')
  const [copied, setCopied] = useState('')

  // Gom theo loai de hien so luong + tong tren tung tab.
  const byType = useMemo(() => {
    const m = {} as Record<AddrType, { count: number; sum: number }>
    for (const t of ALL_TYPES) m[t] = { count: 0, sum: 0 }
    for (const u of utxos) {
      m[u.type].count++
      m[u.type].sum += u.value
    }
    return m
  }, [utxos])

  const shown = useMemo(
    () =>
      (filter === 'all' ? utxos : utxos.filter((u) => u.type === filter))
        .slice()
        .sort((a, b) => b.value - a.value),
    [utxos, filter]
  )

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt)
    setCopied(txt)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tong quan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {ALL_TYPES.map((t) => {
          const meta = TYPE_META[t]
          const d = byType[t]
          return (
            <Card key={t} style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <p style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                {d.sum.toLocaleString('en-US')}
              </p>
              <p style={{ color: '#6B8BB0', fontSize: 11, marginTop: 2 }}>
                sat · {d.count} UTXO
              </p>
            </Card>
          )
        })}
      </div>

      {/* Bang UTXO */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}>
              UTXO chưa chi tiêu
            </h2>
            <p style={{ color: '#6B8BB0', fontSize: 12, marginTop: 3 }}>
              Tổng {utxos.length} UTXO · {toBtc(total)} BTC
              {total !== confirmedTotal && ` (khả dụng ${toBtc(confirmedTotal)} BTC)`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnGhost onClick={refreshUtxos} style={{ fontSize: 13 }}>
              {loadingUtxos ? 'Đang quét…' : '↻ Quét lại'}
            </BtnGhost>
            <BtnPrimary onClick={() => onNavigate('send')} style={{ fontSize: 13, padding: '9px 18px' }}>
              Gửi →
            </BtnPrimary>
          </div>
        </div>

        {/* Tab loc theo loai */}
        <div style={{ display: 'flex', gap: 6, padding: '0 24px 16px', flexWrap: 'wrap' }}>
          {(['all', ...ALL_TYPES] as const).map((t) => {
            const isActive = filter === t
            const label = t === 'all' ? `Tất cả (${utxos.length})` : `${TYPE_META[t].label} (${byType[t].count})`
            const color = t === 'all' ? '#F7931A' : TYPE_META[t].color
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  fontWeight: isActive ? 700 : 400, transition: 'all 0.15s',
                  background: isActive ? `${color}1F` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? `${color}55` : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? color : '#6B8BB0',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Dong tieu de */}
        <div style={{
          display: 'grid', gridTemplateColumns: '150px 1fr 90px 150px',
          gap: 12, padding: '10px 24px',
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['Loại', 'Outpoint (txid:vout)', 'Trạng thái', 'Giá trị'].map((h, i) => (
            <span key={h} style={{ color: '#6B8BB0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i === 3 ? 'right' : 'left' }}>
              {h}
            </span>
          ))}
        </div>

        {shown.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: '#6B8BB0', fontSize: 14, marginBottom: 6 }}>
              {loadingUtxos ? 'Đang quét UTXO…' : 'Không có UTXO nào.'}
            </p>
            {!loadingUtxos && (
              <p style={{ color: '#6B8BB0', fontSize: 12 }}>
                Sang màn <strong style={{ color: '#F7931A' }}>Node</strong> để rót tiền vào ví (faucet).
              </p>
            )}
          </div>
        ) : (
          shown.map((u) => {
            const meta = TYPE_META[u.type]
            const outpoint = `${u.txid}:${u.vout}`
            return (
              <div
                key={outpoint}
                style={{
                  display: 'grid', gridTemplateColumns: '150px 1fr 90px 150px',
                  gap: 12, padding: '13px 24px', alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ color: '#FFFFFF', fontSize: 13 }}>{meta.label}</span>
                </div>

                <button
                  onClick={() => copy(outpoint)}
                  title={outpoint}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    textAlign: 'left', minWidth: 0,
                  }}
                >
                  <span style={{ color: copied === outpoint ? '#00D4AA' : '#A8C4E8', fontSize: 12, fontFamily: 'monospace' }}>
                    {copied === outpoint ? '✓ đã sao chép' : `${short(u.txid, 14, 8)}:${u.vout}`}
                  </span>
                  <span style={{ display: 'block', color: '#6B8BB0', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                    {short(u.address, 14, 8)}
                  </span>
                </button>

                <div>
                  {u.confirmed
                    ? <Badge color="#00D4AA">confirmed</Badge>
                    : <Badge color="#F7931A">mempool</Badge>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                    {u.value.toLocaleString('en-US')}
                  </p>
                  <p style={{ color: '#6B8BB0', fontSize: 11 }}>{toBtc(u.value)} BTC</p>
                </div>
              </div>
            )
          })
        )}
      </Card>

      {/* Giai thich vi sao loai input anh huong phi */}
      <Card style={{ background: 'rgba(74,139,223,0.06)', border: '1px solid rgba(74,139,223,0.15)' }}>
        <h3 style={{ color: '#4A8BDF', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          Vì sao loại UTXO ảnh hưởng tới phí
        </h3>
        <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px', marginBottom: 12 }}>
          Phí tính theo <strong style={{ color: '#FFFFFF' }}>kích thước</strong> giao dịch (vByte), không theo
          số tiền. Mỗi input thêm vào làm giao dịch to ra — và mỗi loại địa chỉ tốn khác nhau:
        </p>
        {ALL_TYPES.map((t) => (
          <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_META[t].color, flexShrink: 0, marginTop: 5 }} />
            <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px' }}>
              <strong style={{ color: '#FFFFFF' }}>{TYPE_META[t].label}</strong>{' '}
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B8BB0' }}>({TYPE_META[t].short})</span>
              {' — '}{TYPE_META[t].note}
            </p>
          </div>
        ))}
        <p style={{ color: '#6B8BB0', fontSize: 12, lineHeight: '19px', marginTop: 10 }}>
          Vì vậy thuật toán chọn UTXO cố dùng <strong style={{ color: '#A8C4E8' }}>ít input nhất</strong> có thể.
          Xem chi tiết từng vòng lặp ở màn Gửi, phần “Chi tiết kỹ thuật”.
        </p>
      </Card>
    </div>
  )
}
