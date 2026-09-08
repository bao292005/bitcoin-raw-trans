import { useMemo, useState } from 'react'
import { Card, BtnGhost, Badge, TxIcon } from '../components/ui'
import { useWallet } from '../useWallet'
import { TYPE_META, fmtSat, short, toBtc } from '../api'
import { loadSent, clearSent, timeAgo } from '../history'

type Tab = 'sent' | 'unspent'

export default function PageTransactions() {
  const { addresses, utxos, loadingUtxos } = useWallet()
  const walletId = addresses.find((a) => a.key === 'p2wpkh')?.address ?? ''

  const [tab, setTab] = useState<Tab>('sent')
  const [version, setVersion] = useState(0) // ep doc lai sau khi xoa

  const sent = useMemo(() => loadSent(walletId), [walletId, version])

  // UTXO gom theo txid: moi txid la mot lan "tien vao" con chua tieu.
  const incoming = useMemo(() => {
    const m = new Map<string, { txid: string; total: number; count: number; confirmed: boolean }>()
    for (const u of utxos) {
      const e = m.get(u.txid) ?? { txid: u.txid, total: 0, count: 0, confirmed: true }
      e.total += u.value
      e.count++
      e.confirmed = e.confirmed && u.confirmed
      m.set(u.txid, e)
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [utxos])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Giai thich gioi han */}
      <Card style={{ background: 'rgba(74,139,223,0.06)', border: '1px solid rgba(74,139,223,0.15)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10" stroke="#4A8BDF" strokeWidth="1.8"/>
            <path d="M12 16v-4M12 8h.01" stroke="#4A8BDF" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '20px' }}>
            Ví này quét UTXO bằng <code style={{ fontFamily: 'monospace', color: '#6B8BB0' }}>scantxoutset</code> —
            chỉ thấy tiền <strong style={{ color: '#FFFFFF' }}>chưa tiêu</strong> ở hiện tại, không có lịch sử quá khứ.
            Muốn lịch sử đầy đủ cần một indexer (Electrum/Esplora) hoặc ví theo dõi địa chỉ từ trước.
            Tab <em>Đã gửi</em> dưới đây là nhật ký cục bộ của chính ứng dụng này.
          </p>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['sent', `Đã gửi (${sent.length})`],
              ['unspent', `Tiền vào chưa tiêu (${incoming.length})`],
            ] as const).map(([id, label]) => {
              const isActive = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    fontWeight: isActive ? 700 : 400, transition: 'all 0.15s',
                    background: isActive ? 'rgba(247,147,26,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? 'rgba(247,147,26,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? '#F7931A' : '#6B8BB0',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {tab === 'sent' && sent.length > 0 && (
            <BtnGhost
              onClick={() => { clearSent(walletId); setVersion((v) => v + 1) }}
              style={{ fontSize: 13 }}
            >
              Xoá nhật ký
            </BtnGhost>
          )}
        </div>

        {/* Tab: da gui */}
        {tab === 'sent' && (
          sent.length === 0 ? (
            <Empty text="Chưa gửi giao dịch nào từ ứng dụng này." />
          ) : (
            sent.map((t) => (
              <div key={t.txid} style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TxIcon type="send" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 500 }}>
                        Gửi tới {t.outputs.filter((o) => !o.isChange).length} địa chỉ
                      </span>
                      <Badge color="#00D4AA">đã phát sóng</Badge>
                    </div>
                    <p style={{ color: '#6B8BB0', fontSize: 12, fontFamily: 'monospace' }}>
                      {short(t.txid, 20, 10)} · {timeAgo(t.at)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: '#FF4757', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                      −{t.target.toLocaleString('en-US')}
                    </p>
                    <p style={{ color: '#6B8BB0', fontSize: 11 }}>phí {t.fee.toLocaleString('en-US')} sat</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, paddingLeft: 52, marginTop: 8, flexWrap: 'wrap' }}>
                  <Meta label="Input" value={`${t.inputCount}`} />
                  <Meta label="Kích thước" value={`${t.vsize} vB`} />
                  <Meta label="Tiền thối" value={fmtSat(t.change)} />
                  <Meta
                    label="Loại input"
                    value={[...new Set(t.inputTypes)]
                      .map((ty) => TYPE_META[ty as keyof typeof TYPE_META]?.label ?? ty)
                      .join(', ')}
                  />
                </div>
              </div>
            ))
          )
        )}

        {/* Tab: tien vao chua tieu */}
        {tab === 'unspent' && (
          incoming.length === 0 ? (
            <Empty text={loadingUtxos ? 'Đang quét…' : 'Ví chưa nhận được tiền.'} />
          ) : (
            incoming.map((t) => (
              <div key={t.txid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <TxIcon type="receive" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 500 }}>
                      Nhận vào {t.count} output
                    </span>
                    {t.confirmed
                      ? <Badge color="#00D4AA">confirmed</Badge>
                      : <Badge color="#F7931A">mempool</Badge>}
                  </div>
                  <p style={{ color: '#6B8BB0', fontSize: 12, fontFamily: 'monospace' }}>{short(t.txid, 24, 10)}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ color: '#00D4AA', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>
                    +{t.total.toLocaleString('en-US')}
                  </p>
                  <p style={{ color: '#6B8BB0', fontSize: 11 }}>{toBtc(t.total)} BTC</p>
                </div>
              </div>
            ))
          )
        )}
      </Card>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ color: '#6B8BB0', fontSize: 14 }}>{text}</p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ color: '#6B8BB0', fontSize: 11 }}>
      {label}: <span style={{ color: '#A8C4E8', fontFamily: 'monospace' }}>{value}</span>
    </span>
  )
}
