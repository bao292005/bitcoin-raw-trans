import { useMemo } from 'react'
import type { Page } from '../App'
import { Card, BtnPrimary, BtnSecondary, BtnGhost, StatTile, SectionHeader } from '../components/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useWallet } from '../useWallet'
import { TYPE_META, fmtSat, short, toBtc, type AddrType } from '../api'

const ALL_TYPES: AddrType[] = ['p2pkh', 'p2sh-p2wpkh', 'p2wpkh', 'p2tr']

export default function PageDashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { addresses, utxos, total, confirmedTotal, net, loadingUtxos, refreshUtxos } = useWallet()

  // So du chia theo loai dia chi — thay cho bieu do gia BTC/USD (regtest khong co gia).
  const byType = useMemo(() => {
    const m = {} as Record<AddrType, number>
    for (const t of ALL_TYPES) m[t] = 0
    for (const u of utxos) m[u.type] += u.value
    return ALL_TYPES.map((t) => ({
      name: TYPE_META[t].label,
      value: m[t],
      color: TYPE_META[t].color,
      count: utxos.filter((u) => u.type === t).length,
    }))
  }, [utxos])

  const hasFunds = total > 0
  const pending = total - confirmedTotal
  const biggest = useMemo(
    () => utxos.slice().sort((a, b) => b.value - a.value).slice(0, 5),
    [utxos]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Thong so */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatTile
          label="Số dư khả dụng"
          value={`${toBtc(confirmedTotal)} BTC`}
          sub={fmtSat(confirmedTotal)}
          glow
        />
        <StatTile
          label="Tổng UTXO"
          value={`${utxos.length}`}
          sub={pending > 0 ? `${fmtSat(pending)} đang chờ` : 'tất cả đã confirmed'}
          subColor={pending > 0 ? '#F7931A' : '#00D4AA'}
        />
        <StatTile
          label="Loại địa chỉ dùng"
          value={`${byType.filter((b) => b.value > 0).length} / 4`}
          sub={byType.filter((b) => b.value > 0).map((b) => b.name).join(', ') || 'chưa có tiền'}
          subColor="#4A8BDF"
        />
        <StatTile
          label={net?.useRpc ? 'Chiều cao chuỗi' : 'Phí mạng'}
          value={net?.useRpc ? (net.blocks?.toLocaleString() ?? '—') : `${net?.feeRate ?? '—'} sat/vB`}
          sub={net?.connected ? `● ${net.network}` : '● mất kết nối'}
          subColor={net?.connected ? '#00D4AA' : '#FF4757'}
        />
      </div>

      {/* Hang chinh */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Phan bo so du */}
        <Card>
          <SectionHeader
            title="Số dư theo loại địa chỉ"
            action={
              <BtnGhost onClick={refreshUtxos} style={{ fontSize: 13 }}>
                {loadingUtxos ? 'Đang quét…' : '↻ Quét lại'}
              </BtnGhost>
            }
          />
          {hasFunds ? (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'center' }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={byType.filter((d) => d.value > 0)}
                    cx="50%" cy="50%" innerRadius={58} outerRadius={88}
                    paddingAngle={3} dataKey="value"
                  >
                    {byType.filter((d) => d.value > 0).map((d, i) => (
                      <Cell key={i} fill={d.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1A2A4A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                    itemStyle={{ color: '#FFFFFF' }}
                    formatter={(v: unknown) => [`${(v as number).toLocaleString('en-US')} sat`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {byType.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0, opacity: d.value > 0 ? 1 : 0.3 }} />
                    <span style={{ color: d.value > 0 ? '#A8C4E8' : '#6B8BB0', fontSize: 13, flex: 1 }}>
                      {d.name}
                      <span style={{ color: '#6B8BB0', fontSize: 11 }}> · {d.count} UTXO</span>
                    </span>
                    <span style={{ color: d.value > 0 ? '#FFFFFF' : '#6B8BB0', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
                      {d.value.toLocaleString('en-US')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ color: '#6B8BB0', fontSize: 14, marginBottom: 14 }}>
                {loadingUtxos ? 'Đang quét UTXO…' : 'Ví chưa có tiền.'}
              </p>
              {!loadingUtxos && net?.useRpc && (
                <BtnPrimary onClick={() => onNavigate('node')} style={{ fontSize: 14 }}>
                  Rót tiền từ faucet →
                </BtnPrimary>
              )}
            </div>
          )}
        </Card>

        {/* So du + hanh dong */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card glow style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(247,147,26,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <p style={{ color: '#A8C4E8', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Số dư ví</p>
            <p style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 700, letterSpacing: '-1px', marginBottom: 2, fontFamily: 'monospace' }}>
              {toBtc(confirmedTotal)}
            </p>
            <p style={{ color: '#A8C4E8', fontSize: 14, marginBottom: 14 }}>BTC · {fmtSat(confirmedTotal)}</p>

            {pending > 0 && (
              <div style={{ background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.15)', borderRadius: 8, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F7931A' }} />
                <span style={{ color: '#F7931A', fontSize: 12, fontWeight: 600 }}>{fmtSat(pending)} chờ xác nhận</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: pending > 0 ? 0 : 8 }}>
              <BtnPrimary onClick={() => onNavigate('send')} style={{ flex: 1, padding: '11px 0', fontSize: 14 }}>↑ Gửi</BtnPrimary>
              <BtnSecondary onClick={() => onNavigate('receive')} style={{ flex: 1, padding: '11px 0', fontSize: 14 }}>↓ Nhận</BtnSecondary>
            </div>
          </Card>

          {/* 4 dia chi */}
          <Card style={{ padding: '16px 20px' }}>
            <p style={{ color: '#6B8BB0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Địa chỉ của ví
            </p>
            {addresses.map((a) => {
              const m = TYPE_META[a.type]
              return (
                <div
                  key={a.key}
                  onClick={() => navigator.clipboard.writeText(a.address)}
                  title={a.address}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span style={{ color: '#6B8BB0', fontSize: 11, width: 92, flexShrink: 0 }}>{m.label}</span>
                  <span style={{ color: '#A8C4E8', fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {short(a.address, 12, 6)}
                  </span>
                </div>
              )
            })}
          </Card>
        </div>
      </div>

      {/* UTXO lon nhat */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}>UTXO lớn nhất</h2>
          <BtnGhost onClick={() => onNavigate('utxos')} style={{ fontSize: 13 }}>Xem tất cả →</BtnGhost>
        </div>
        {biggest.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <p style={{ color: '#6B8BB0', fontSize: 13 }}>Chưa có UTXO nào.</p>
          </div>
        ) : (
          biggest.map((u) => {
            const m = TYPE_META[u.type]
            return (
              <div
                key={`${u.txid}:${u.vout}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                <span style={{ color: '#FFFFFF', fontSize: 13, width: 120, flexShrink: 0 }}>{m.label}</span>
                <span style={{ color: '#6B8BB0', fontSize: 12, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {short(u.txid, 16, 8)}:{u.vout}
                </span>
                <span style={{ color: u.confirmed ? '#00D4AA' : '#F7931A', fontSize: 11, flexShrink: 0 }}>
                  {u.confirmed ? 'confirmed' : 'mempool'}
                </span>
                <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', width: 110, textAlign: 'right', flexShrink: 0 }}>
                  {u.value.toLocaleString('en-US')}
                </span>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
