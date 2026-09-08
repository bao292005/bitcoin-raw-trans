import { useState, type ReactNode } from 'react'
import type { BuildResult } from '../api'
import { TYPE_META, fmtSat, short } from '../api'

// Khoi gap duoc — dung cho tung phan cua bang giai trinh ky thuat.
function Fold({ title, subtitle, children, defaultOpen = false }: {
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          color: '#6B8BB0', fontSize: 11, transition: 'transform 0.15s',
          transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block',
        }}>▶</span>
        <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>{title}</span>
        {subtitle && <span style={{ color: '#6B8BB0', fontSize: 12, marginLeft: 'auto' }}>{subtitle}</span>}
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  )
}

const Row = ({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0' }}>
    <span style={{ color: '#6B8BB0', fontSize: 12, flexShrink: 0 }}>{label}</span>
    <span style={{ color: '#A8C4E8', fontSize: 12, fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>
      {value}
    </span>
  </div>
)

// Ban web cua che do --debug trong CLI: giai trinh vi sao chon UTXO nay,
// phi tinh ra sao, giao dich gom nhung gi.
export default function TxDebug({ r }: { r: BuildResult }) {
  const t = r.trace

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ color: '#6B8BB0', fontSize: 12, lineHeight: '19px', marginBottom: 4 }}>
        Cùng dữ liệu mà <code style={{ fontFamily: 'monospace', color: '#A8C4E8' }}>--debug</code> in ra ở CLI.
      </p>

      {/* Buoc 3 */}
      <Fold
        title="Bước 3 · Chọn UTXO (coin selection)"
        subtitle={`${r.inputs.length} input · ${t.steps.length} vòng lặp`}
        defaultOpen
      >
        <Row label="Cần gửi (target)" value={fmtSat(t.target)} mono />
        <Row label="Phí thị trường" value={`${t.feeRate} sat/vByte`} mono />
        <Row label="Kích thước nền" value={`${t.baseVbytes} vB (overhead + output người nhận)`} mono />
        <Row label="Output change" value={`${t.changeVbytes} vB`} mono />

        <p style={{ color: '#6B8BB0', fontSize: 12, margin: '12px 0 6px' }}>
          Sắp xếp UTXO giảm dần theo giá trị rồi gom dần:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {t.sorted.map((u, i) => (
            <div key={`${u.txid}:${u.vout}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ color: '#6B8BB0', fontFamily: 'monospace', width: 18 }}>{i}.</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_META[u.type].color, flexShrink: 0 }} />
              <span style={{ color: '#A8C4E8', width: 110 }}>{TYPE_META[u.type].label}</span>
              <span style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>{u.value.toLocaleString('en-US')} sat</span>
              <span style={{ color: '#6B8BB0', fontFamily: 'monospace', marginLeft: 'auto' }}>
                {short(u.txid, 8, 4)}:{u.vout}
              </span>
            </div>
          ))}
        </div>

        {t.steps.map((s, i) => {
          const done = !s.decision.startsWith('chua du')
          return (
            <div
              key={i}
              style={{
                background: done ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${done ? 'rgba(0,212,170,0.18)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 6,
              }}
            >
              <p style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                vòng {i + 1}: thêm [{TYPE_META[s.added.type].label}] {s.added.value.toLocaleString('en-US')} sat
              </p>
              <p style={{ color: '#6B8BB0', fontSize: 11, fontFamily: 'monospace', lineHeight: '17px' }}>
                inputSum={s.inputSum.toLocaleString('en-US')} · inputsVbytes={s.inputsVbytes}
                <br />
                có change  → phí={s.feeWithChange}, cần ≥ {s.needWithChange.toLocaleString('en-US')}
                <br />
                không change → phí={s.feeNoChange}, cần ≥ {s.needNoChange.toLocaleString('en-US')}
              </p>
              <p style={{ color: done ? '#00D4AA' : '#6B8BB0', fontSize: 11, marginTop: 5 }}>
                ⇒ {s.decision}
              </p>
            </div>
          )
        })}
      </Fold>

      {/* Buoc 4 */}
      <Fold title="Bước 4 · Cấu trúc giao dịch" subtitle={`${r.inputs.length} in → ${r.outputs.length} out`}>
        <p style={{ color: '#6B8BB0', fontSize: 12, marginBottom: 6 }}>Inputs (tiền vào):</p>
        {r.inputs.map((inp) => (
          <div key={`${inp.txid}:${inp.vout}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_META[inp.type].color, flexShrink: 0 }} />
            <span style={{ color: '#A8C4E8', width: 110 }}>{TYPE_META[inp.type].label}</span>
            <span style={{ color: '#6B8BB0', fontFamily: 'monospace' }}>{short(inp.txid, 10, 6)}:{inp.vout}</span>
            <span style={{ color: '#FFFFFF', fontFamily: 'monospace', marginLeft: 'auto' }}>
              {inp.value.toLocaleString('en-US')} sat
            </span>
          </div>
        ))}

        <p style={{ color: '#6B8BB0', fontSize: 12, margin: '12px 0 6px' }}>Outputs (tiền ra):</p>
        {r.outputs.map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, padding: '3px 0' }}>
            <span style={{ color: '#6B8BB0', fontFamily: 'monospace', width: 44 }}>out[{i}]</span>
            <span style={{ color: '#A8C4E8', fontFamily: 'monospace' }}>{short(o.address, 14, 8)}</span>
            {o.isChange && (
              <span style={{ color: '#4A8BDF', fontSize: 10, background: 'rgba(74,139,223,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                change
              </span>
            )}
            <span style={{ color: '#FFFFFF', fontFamily: 'monospace', marginLeft: 'auto' }}>
              {o.value.toLocaleString('en-US')} sat
            </span>
          </div>
        ))}

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Row
            label="Cân bằng"
            value={`${r.inputs.reduce((s, i) => s + i.value, 0).toLocaleString('en-US')} = ${r.target.toLocaleString('en-US')} (gửi) + ${r.fee.toLocaleString('en-US')} (phí) + ${r.change.toLocaleString('en-US')} (change)`}
            mono
          />
        </div>
      </Fold>

      {/* Buoc 5-6 */}
      <Fold title="Bước 5-6 · Ký & ghép chữ ký" subtitle={`${r.inputs.length} chữ ký`}>
        <p style={{ color: '#A8C4E8', fontSize: 12, lineHeight: '20px', marginBottom: 10 }}>
          Mỗi input được băm sighash và ký <strong style={{ color: '#FFFFFF' }}>riêng biệt</strong>.
          Chữ ký đặt vào đâu tuỳ loại địa chỉ:
        </p>
        {r.inputs.map((inp, i) => {
          const isTaproot = inp.type === 'p2tr'
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 11 }}>
              <span style={{ color: '#6B8BB0', fontFamily: 'monospace', width: 36, flexShrink: 0 }}>in[{i}]</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#FFFFFF' }}>
                  {TYPE_META[inp.type].label}{' '}
                  <span style={{ color: isTaproot ? '#00D4AA' : '#4A8BDF' }}>
                    {isTaproot ? 'Schnorr (64 byte)' : 'ECDSA (DER, low-S)'}
                  </span>
                </p>
                <p style={{ color: '#6B8BB0', marginTop: 2 }}>
                  {inp.type === 'p2pkh' && 'chữ ký + pubkey đặt vào scriptSig, không có witness'}
                  {inp.type === 'p2sh-p2wpkh' && 'scriptSig chứa redeemScript, chữ ký nằm trong witness'}
                  {inp.type === 'p2wpkh' && 'scriptSig rỗng, witness = [chữ ký, pubkey]'}
                  {inp.type === 'p2tr' && 'witness chỉ 1 phần tử, khoá đã tweak theo BIP341'}
                </p>
              </div>
            </div>
          )
        })}
        <p style={{ color: '#6B8BB0', fontSize: 11, lineHeight: '18px', marginTop: 10 }}>
          Cả 4 chữ ký được gộp vào <strong style={{ color: '#A8C4E8' }}>một</strong> giao dịch duy nhất
          (chuẩn PSBT, BIP174), rồi finalize thành raw hex bên dưới.
        </p>
      </Fold>

      {/* Buoc 7 */}
      <Fold title="Bước 7 · Raw transaction" subtitle={`${r.hex.length / 2} byte · ${r.vsize} vB`}>
        <Row label="txid" value={r.txid} mono />
        <Row label="vsize" value={`${r.vsize} vByte`} mono />
        <Row label="weight" value={`${r.weight} WU`} mono />
        <Row label="kích thước raw" value={`${r.hex.length / 2} byte`} mono />
        <p style={{ color: '#6B8BB0', fontSize: 12, margin: '10px 0 6px' }}>Raw hex (đã ký, sẵn sàng phát sóng):</p>
        <div className="hexblock">{r.hex}</div>
        <button
          onClick={() => navigator.clipboard.writeText(r.hex)}
          style={{
            marginTop: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, padding: '5px 12px', color: '#A8C4E8', fontSize: 11, cursor: 'pointer',
          }}
        >
          ⎘ Sao chép raw hex
        </button>
      </Fold>
    </div>
  )
}
