import { useState } from 'react'
import type { Page } from '../App'
import { Card, BtnPrimary, BtnSecondary } from '../components/ui'
import TxDebug from '../components/TxDebug'
import { useWallet } from '../useWallet'
import {
  api, fmtSat, toBtc, short, TYPE_META, guessAddrType, DEFAULT_DUST,
  type BuildResult,
} from '../api'
import { recordSent } from '../history'

interface Recipient {
  address: string
  amount: string // giu dang chuoi de nguoi dung go thoai mai
}

export default function PageSend({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { wif, confirmedTotal, utxos, net, refreshAll, addresses } = useWallet()

  // Dinh danh vi trong nhat ky cuc bo — dung dia chi, KHONG dung private key.
  const walletId = addresses.find((a) => a.key === 'p2wpkh')?.address ?? ''

  const [recipients, setRecipients] = useState<Recipient[]>([{ address: '', amount: '' }])
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [preview, setPreview] = useState<BuildResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const dustTable = net?.dust ?? DEFAULT_DUST

  // Voi moi dong: doan loai dia chi -> nguong dust -> co vi pham khong.
  const checks = recipients.map((r) => {
    const address = r.address.trim()
    const value = Number(r.amount)
    const type = guessAddrType(address)
    const minValue = type ? dustTable[type] : 0
    const hasAmount = r.amount !== '' && Number.isInteger(value) && value > 0
    return {
      address,
      value,
      type,
      minValue,
      // Chi bao dust khi da doan duoc loai va da nhap so hop le.
      isDust: !!type && hasAmount && value < minValue,
      ok: address.length > 10 && hasAmount && (!type || value >= minValue),
    }
  })

  const parsed = checks.map((c) => ({ address: c.address, value: c.value }))
  const totalSend = checks.reduce((s, c) => s + (Number.isFinite(c.value) ? c.value : 0), 0)
  const canProceed = checks.length > 0 && checks.every((c) => c.ok) && totalSend > 0

  const setField = (i: number, key: keyof Recipient, val: string) => {
    setRecipients((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  }

  const addRecipient = () => setRecipients((rs) => [...rs, { address: '', amount: '' }])
  const removeRecipient = (i: number) => setRecipients((rs) => rs.filter((_, idx) => idx !== i))

  // Dung + ky nhung KHONG phat song -> de nguoi dung xem truoc phi va input duoc chon.
  const doPreview = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await api.build(wif, parsed, { broadcast: false })
      setPreview(r)
      setStep(2)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Ky lai va phat song that.
  const doBroadcast = async () => {
    setError('')
    setBusy(true)
    try {
      const r = await api.build(wif, parsed, { broadcast: true })
      // Ghi vao nhat ky cuc bo — core khong luu lich su giao dich.
      recordSent(walletId, {
        txid: r.txid,
        at: Date.now(),
        target: r.target,
        fee: r.fee,
        change: r.change,
        vsize: r.vsize,
        inputCount: r.inputs.length,
        inputTypes: r.inputs.map((i) => i.type),
        outputs: r.outputs,
      })
      setPreview(r)
      setStep(3)
      await refreshAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setRecipients([{ address: '', amount: '' }])
    setPreview(null)
    setStep(1)
    setError('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '12px 16px', color: '#FFFFFF', fontSize: 14,
    fontFamily: 'monospace', outline: 'none', transition: 'all 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F7931A'
    e.target.style.boxShadow = '0 0 0 3px rgba(247,147,26,0.15)'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
    e.target.style.boxShadow = 'none'
  }

  // ── Buoc 3: da phat song ────────────────────────────────────────────────
  if (step === 3 && preview) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Card glow>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,212,170,0.1)', border: '2px solid rgba(0,212,170,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h2 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Đã phát sóng</h2>
            <p style={{ color: '#A8C4E8', fontSize: 14, lineHeight: '22px' }}>
              Giao dịch đã được mạng lưới chấp nhận
              {preview.mined && <> và <strong style={{ color: '#00D4AA' }}>đã confirmed</strong> (tự đào 1 block)</>}.
            </p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ color: '#6B8BB0', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>txid</p>
            <p
              style={{ color: '#F7931A', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', cursor: 'pointer' }}
              onClick={() => navigator.clipboard.writeText(preview.txid)}
              title="Bấm để sao chép"
            >
              {preview.txid}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 22 }}>
            {[
              { label: 'Đã gửi', value: fmtSat(preview.target) },
              { label: 'Phí', value: fmtSat(preview.fee) },
              { label: 'Tiền thối', value: fmtSat(preview.change) },
            ].map((s) => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ color: '#6B8BB0', fontSize: 11, marginBottom: 4 }}>{s.label}</p>
                <p style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <BtnPrimary onClick={reset}>Gửi giao dịch khác</BtnPrimary>
            <BtnSecondary onClick={() => onNavigate('utxos')}>Xem UTXO</BtnSecondary>
          </div>
        </Card>

        <Card style={{ marginTop: 20 }}>
          <h3 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Chi tiết kỹ thuật</h3>
          <TxDebug r={preview} />
        </Card>
      </div>
    )
  }

  // ── Buoc 1-2 ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Chi bao buoc */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                  background: step >= s ? 'linear-gradient(135deg, #F7931A, #F9A84A)' : 'rgba(255,255,255,0.08)',
                  color: step >= s ? '#0B1426' : '#6B8BB0',
                  border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>{s}</div>
                <span style={{ color: step >= s ? '#FFFFFF' : '#6B8BB0', fontSize: 13, fontWeight: step === s ? 600 : 400 }}>
                  {s === 1 ? 'Người nhận & số tiền' : 'Xem lại & phát sóng'}
                </span>
              </div>
              {s === 1 && <div style={{ width: 48, height: 1, background: step === 2 ? '#F7931A' : 'rgba(255,255,255,0.1)', margin: '0 12px' }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 10, padding: '12px 16px' }}>
            <span style={{ color: '#FF4757', fontWeight: 700, flexShrink: 0 }}>✕</span>
            <span style={{ color: '#FF4757', fontSize: 13, lineHeight: '20px' }}>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600 }}>Người nhận</h2>
              <span style={{ color: '#6B8BB0', fontSize: 12 }}>số tiền tính bằng satoshi</span>
            </div>
            <p style={{ color: '#6B8BB0', fontSize: 13, lineHeight: '20px', marginBottom: 18 }}>
              Có thể gửi nhiều người trong <strong style={{ color: '#A8C4E8' }}>một</strong> giao dịch —
              rẻ hơn gửi từng cái riêng vì chỉ trả phí overhead một lần.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recipients.map((r, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ color: '#A8C4E8', fontSize: 13, fontWeight: 500 }}>Người nhận {i + 1}</span>
                    {recipients.length > 1 && (
                      <button
                        onClick={() => removeRecipient(i)}
                        style={{ background: 'none', border: 'none', color: '#6B8BB0', fontSize: 12, cursor: 'pointer', padding: 0 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#FF4757' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6B8BB0' }}
                      >
                        ✕ Bỏ
                      </button>
                    )}
                  </div>
                  <input
                    placeholder={net?.network === 'regtest' ? 'bcrt1q…' : 'tb1q…'}
                    value={r.address}
                    onChange={(e) => setField(i, 'address', e.target.value)}
                    style={{ ...inputStyle, marginBottom: 8 }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    spellCheck={false}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      placeholder="100000"
                      value={r.amount}
                      onChange={(e) => setField(i, 'amount', e.target.value)}
                      style={{ ...inputStyle, paddingRight: 64 }}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#6B8BB0', fontSize: 12 }}>
                      sat
                    </span>
                  </div>
                  {checks[i]?.isDust ? (
                    <div style={{
                      display: 'flex', gap: 7, marginTop: 7,
                      background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)',
                      borderRadius: 8, padding: '8px 10px',
                    }}>
                      <span style={{ color: '#FF4757', fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚠</span>
                      <p style={{ color: '#FF4757', fontSize: 11, lineHeight: '17px' }}>
                        Dưới ngưỡng <strong>dust</strong>: địa chỉ{' '}
                        {checks[i].type ? TYPE_META[checks[i].type!].label : ''} cần tối thiểu{' '}
                        <strong style={{ fontFamily: 'monospace' }}>{checks[i].minValue} sat</strong>.
                        Mạng lưới từ chối output nhỏ hơn mức này vì tiêu nó tốn phí hơn giá trị nó mang.
                      </p>
                    </div>
                  ) : (
                    Number(r.amount) > 0 && (
                      <p style={{ color: '#6B8BB0', fontSize: 11, marginTop: 5 }}>
                        = {toBtc(Number(r.amount))} BTC
                        {checks[i]?.type && (
                          <span style={{ marginLeft: 8, color: TYPE_META[checks[i].type!].color }}>
                            {TYPE_META[checks[i].type!].label}
                          </span>
                        )}
                      </p>
                    )
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addRecipient}
              style={{
                marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10,
                background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)',
                color: '#A8C4E8', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              + Thêm người nhận
            </button>

            <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <BtnSecondary onClick={() => onNavigate('dashboard')} style={{ padding: '12px 24px' }}>Huỷ</BtnSecondary>
              <BtnPrimary onClick={doPreview} disabled={!canProceed || busy} style={{ flex: 1 }}>
                {busy ? 'Đang chọn UTXO & ký…' : 'Xem trước giao dịch →'}
              </BtnPrimary>
            </div>
          </Card>
        ) : (
          preview && (
            <>
              <Card glow>
                <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Xem lại</h2>
                <p style={{ color: '#6B8BB0', fontSize: 13, marginBottom: 18 }}>
                  Giao dịch đã được ký nhưng <strong style={{ color: '#F7931A' }}>chưa</strong> phát sóng.
                </p>

                {preview.outputs.filter((o) => !o.isChange).map((o, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#6B8BB0', fontSize: 13, flexShrink: 0 }}>Tới</span>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <p style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>{o.address}</p>
                      <p style={{ color: '#F7931A', fontSize: 14, fontWeight: 700, marginTop: 3 }}>{fmtSat(o.value)}</p>
                    </div>
                  </div>
                ))}

                {[
                  { label: 'Số UTXO dùng', value: `${preview.inputs.length} input`, sub: preview.inputs.map((i) => TYPE_META[i.type].label).join(', ') },
                  { label: 'Phí mạng', value: fmtSat(preview.fee), sub: `${preview.feeRate} sat/vB × ${preview.vsize} vB` },
                  { label: 'Tiền thối về ví', value: fmtSat(preview.change), sub: preview.change > 0 ? short(preview.changeAddress, 14, 8) : 'gộp vào phí (dưới ngưỡng dust)' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ color: '#6B8BB0', fontSize: 13, flexShrink: 0 }}>{row.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: '#FFFFFF', fontSize: 14 }}>{row.value}</p>
                      <p style={{ color: '#6B8BB0', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>{row.sub}</p>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', marginTop: 4, borderTop: '2px solid rgba(247,147,26,0.15)' }}>
                  <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 700 }}>Tổng trừ khỏi ví</span>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#F7931A', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                      {fmtSat(preview.target + preview.fee)}
                    </p>
                    <p style={{ color: '#A8C4E8', fontSize: 12 }}>{toBtc(preview.target + preview.fee)} BTC</p>
                  </div>
                </div>

                <div style={{ marginTop: 22, display: 'flex', gap: 12 }}>
                  <BtnSecondary onClick={() => { setStep(1); setPreview(null) }} style={{ padding: '12px 24px' }}>← Sửa</BtnSecondary>
                  <BtnPrimary onClick={doBroadcast} disabled={busy} style={{ flex: 1 }}>
                    {busy ? 'Đang phát sóng…' : 'Xác nhận & phát sóng'}
                  </BtnPrimary>
                </div>
              </Card>

              <Card>
                <h3 style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Chi tiết kỹ thuật</h3>
                <TxDebug r={preview} />
              </Card>
            </>
          )
        )}
      </div>

      {/* Cot phai */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ padding: 20 }}>
          <p style={{ color: '#6B8BB0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
            Ví của bạn
          </p>
          {[
            { label: 'Khả dụng', value: `${toBtc(confirmedTotal)} BTC`, color: '#FFFFFF' },
            { label: 'Số UTXO', value: `${utxos.length}`, color: '#A8C4E8' },
            { label: 'Đang gửi', value: totalSend > 0 ? fmtSat(totalSend) : '—', color: totalSend > confirmedTotal ? '#FF4757' : '#F7931A' },
          ].map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: '#6B8BB0', fontSize: 13 }}>{r.label}</span>
              <span style={{ color: r.color, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{r.value}</span>
            </div>
          ))}
          {totalSend > confirmedTotal && (
            <p style={{ color: '#FF4757', fontSize: 12, marginTop: 6, lineHeight: '18px' }}>
              Vượt quá số dư khả dụng (chưa kể phí).
            </p>
          )}
        </Card>

        <Card style={{ padding: 20, background: 'rgba(74,139,223,0.06)', border: '1px solid rgba(74,139,223,0.15)' }}>
          <p style={{ color: '#4A8BDF', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Phí tính thế nào</p>
          <p style={{ color: '#A8C4E8', fontSize: 12, lineHeight: '19px' }}>
            Phí = <strong style={{ color: '#FFFFFF' }}>kích thước</strong> (vByte) × {net?.feeRate ?? '?'} sat/vB.
            Không phụ thuộc số tiền gửi. Càng nhiều input càng đắt, nên thuật toán cố chọn ít UTXO nhất.
          </p>
        </Card>

        {net?.network === 'regtest' && (
          <Card style={{ padding: 20, background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)' }}>
            <p style={{ color: '#00D4AA', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Mạng local</p>
            <p style={{ color: '#A8C4E8', fontSize: 12, lineHeight: '19px' }}>
              Đang chạy regtest — tiền không có giá trị thật. Sau khi phát sóng, ứng dụng tự đào
              1 block để giao dịch được xác nhận ngay.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
