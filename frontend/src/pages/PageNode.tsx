import { useMemo, useState } from 'react'
import { Card, BtnPrimary, BtnSecondary, StatTile } from '../components/ui'
import { useWallet } from '../useWallet'
import { api, fmtSat, toBtc, short, TYPE_META, type AddrKey } from '../api'

const DEFAULT_AMOUNT = '1000000'

function MiniBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        color: '#A8C4E8', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.11)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
    >
      {label}
    </button>
  )
}

// Dieu khien mang local regtest: dao block va rot tien (faucet).
// Tren testnet khong dung duoc — phai xin faucet cong cong.
export default function PageNode() {
  const { wif, net, refreshAll, addresses, utxos } = useWallet()

  const [blocks, setBlocks] = useState('1')
  // Moi loai dia chi tu chon rieng: co rot hay khong, va bao nhieu sat.
  const [picks, setPicks] = useState<Record<string, { on: boolean; amount: string }>>({})
  const [busy, setBusy] = useState<'mine' | 'faucet' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // Mac dinh: bat het, moi dia chi DEFAULT_AMOUNT.
  const pickOf = (key: string) => picks[key] ?? { on: true, amount: DEFAULT_AMOUNT }
  const setPick = (key: string, patch: Partial<{ on: boolean; amount: string }>) =>
    setPicks((p) => ({ ...p, [key]: { ...pickOf(key), ...patch } }))

  const selected = useMemo(
    () =>
      addresses
        .filter((a) => pickOf(a.key).on)
        .map((a) => ({ key: a.key, value: Number(pickOf(a.key).amount) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addresses, picks]
  )

  const faucetTotal = selected.reduce((s, t) => s + (Number.isFinite(t.value) ? t.value : 0), 0)
  const faucetValid =
    selected.length > 0 && selected.every((t) => Number.isInteger(t.value) && t.value > 0)
  const overBalance = net?.minerBalance != null && faucetTotal > net.minerBalance

  const isRegtest = net?.useRpc === true
  const connected = !!net?.connected

  const run = async (kind: 'mine' | 'faucet', fn: () => Promise<string>) => {
    setBusy(kind)
    setMsg(null)
    try {
      const text = await fn()
      setMsg({ kind: 'ok', text })
      await refreshAll()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const doMine = () =>
    run('mine', async () => {
      const n = Number(blocks)
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Số block không hợp lệ: ${blocks}`)
      const r = await api.mine(n)
      return `Đã đào ${r.mined} block. Chiều cao hiện tại: ${r.blocks.toLocaleString()}.`
    })

  const doFaucet = () =>
    run('faucet', async () => {
      if (!selected.length) throw new Error('Chưa chọn địa chỉ nào để rót.')
      const r = await api.faucet(wif, selected as { key: AddrKey; value: number }[])
      const names = r.targets.map((t) => TYPE_META[t.type].label).join(', ')
      return `Đã rót tổng ${fmtSat(r.total)} vào ${r.targets.length} địa chỉ (${names}). txid: ${short(r.txid, 12, 8)}`
    })

  if (!isRegtest) {
    return (
      <Card style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.15)' }}>
        <h2 style={{ color: '#F7931A', fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
          Không dùng được trên {net?.network ?? 'mạng này'}
        </h2>
        <p style={{ color: '#A8C4E8', fontSize: 14, lineHeight: '22px' }}>
          Đào block và faucet chỉ có trên mạng local <strong style={{ color: '#FFFFFF' }}>regtest</strong>,
          nơi ta tự điều khiển node. Trên testnet phải xin tiền từ faucet công cộng và chờ
          thợ đào thật xác nhận.
        </p>
        <p style={{ color: '#6B8BB0', fontSize: 13, lineHeight: '21px', marginTop: 12 }}>
          Muốn bật regtest: đặt <code style={{ color: '#F7931A', fontFamily: 'monospace' }}>NETWORK=regtest</code> trong
          file <code style={{ fontFamily: 'monospace' }}>.env</code>, chạy{' '}
          <code style={{ color: '#F7931A', fontFamily: 'monospace' }}>npm run node:start</code> rồi khởi động lại server.
        </p>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Trang thai node */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatTile
          label="Chiều cao chuỗi"
          value={net?.blocks?.toLocaleString() ?? '—'}
          sub={connected ? '● đang kết nối' : '● mất kết nối'}
          subColor={connected ? '#00D4AA' : '#FF4757'}
          glow
        />
        <StatTile
          label="Số dư ví miner"
          value={net?.minerBalance != null ? `${toBtc(net.minerBalance)} BTC` : '—'}
          sub={net?.minerBalance != null ? fmtSat(net.minerBalance) : undefined}
          subColor="#4A8BDF"
        />
        <StatTile
          label="Phí áp dụng"
          value={net?.feeRate != null ? `${net.feeRate} sat/vB` : '—'}
          sub="regtest dùng FEE_RATE cố định"
          subColor="#6B8BB0"
        />
      </div>

      {/* Thong bao ket qua */}
      {msg && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: msg.kind === 'ok' ? 'rgba(0,212,170,0.08)' : 'rgba(255,71,87,0.08)',
          border: `1px solid ${msg.kind === 'ok' ? 'rgba(0,212,170,0.2)' : 'rgba(255,71,87,0.2)'}`,
          borderRadius: 12, padding: '12px 16px',
        }}>
          <span style={{ color: msg.kind === 'ok' ? '#00D4AA' : '#FF4757', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {msg.kind === 'ok' ? '✓' : '✕'}
          </span>
          <p style={{ color: msg.kind === 'ok' ? '#00D4AA' : '#FF4757', fontSize: 13, lineHeight: '20px' }}>
            {msg.text}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Dao block */}
        <Card>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Đào block</h2>
          <p style={{ color: '#6B8BB0', fontSize: 13, lineHeight: '20px', marginBottom: 18 }}>
            Trên regtest bạn tự sinh block bằng <code style={{ fontFamily: 'monospace', color: '#A8C4E8' }}>generatetoaddress</code>.
            Thưởng đào vào ví miner của bitcoind.
          </p>

          <label style={{ display: 'block', color: '#A8C4E8', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            Số block
          </label>
          <input
            type="number"
            min={1}
            value={blocks}
            onChange={(e) => setBlocks(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
              padding: '12px 16px', color: '#FFFFFF', fontSize: 15,
              fontFamily: 'monospace', outline: 'none', marginBottom: 12,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['1', '6', '101'].map((n) => (
              <button
                key={n}
                onClick={() => setBlocks(n)}
                style={{
                  padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
                  background: blocks === n ? 'rgba(247,147,26,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${blocks === n ? 'rgba(247,147,26,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: blocks === n ? '#F7931A' : '#6B8BB0',
                }}
              >
                {n} block
              </button>
            ))}
          </div>

          <BtnPrimary onClick={doMine} disabled={busy !== null} style={{ width: '100%' }}>
            {busy === 'mine' ? 'Đang đào…' : '⛏ Đào block'}
          </BtnPrimary>

          <p style={{ color: '#6B8BB0', fontSize: 12, lineHeight: '19px', marginTop: 14 }}>
            Thưởng coinbase phải chờ <strong style={{ color: '#A8C4E8' }}>100 block</strong> mới tiêu được,
            nên lần khởi tạo cần đào 101 block.
          </p>
        </Card>

        {/* Faucet */}
        <Card>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Faucet</h2>
          <p style={{ color: '#6B8BB0', fontSize: 13, lineHeight: '20px', marginBottom: 18 }}>
            Chuyển tiền từ ví miner vào các địa chỉ bạn chọn, gộp trong một giao dịch,
            rồi tự đào 1 block để xác nhận. Chọn ít loại để thử trường hợp ví chỉ có
            một kiểu UTXO.
          </p>

          {/* Chon tung dia chi + so tien rieng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ color: '#A8C4E8', fontSize: 14, fontWeight: 500 }}>Địa chỉ nhận</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <MiniBtn
                label="Chọn hết"
                onClick={() => setPicks(Object.fromEntries(addresses.map((a) => [a.key, { ...pickOf(a.key), on: true }])))}
              />
              <MiniBtn
                label="Bỏ hết"
                onClick={() => setPicks(Object.fromEntries(addresses.map((a) => [a.key, { ...pickOf(a.key), on: false }])))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {addresses.map((a) => {
              const m = TYPE_META[a.type]
              const p = pickOf(a.key)
              const held = utxos.filter((u) => u.address === a.address).reduce((s, u) => s + u.value, 0)
              const badAmount = p.on && !(Number.isInteger(Number(p.amount)) && Number(p.amount) > 0)
              return (
                <div
                  key={a.key}
                  style={{
                    background: p.on ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${p.on ? `${m.color}44` : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10, padding: '10px 12px',
                    transition: 'all 0.15s',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={p.on}
                      onChange={(e) => setPick(a.key, { on: e.target.checked })}
                      style={{ width: 15, height: 15, accentColor: m.color, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0, opacity: p.on ? 1 : 0.4 }} />
                    <span style={{ color: p.on ? '#FFFFFF' : '#6B8BB0', fontSize: 13, fontWeight: 600 }}>
                      {m.label}
                    </span>
                    <span style={{ color: '#6B8BB0', fontSize: 11, marginLeft: 'auto', fontFamily: 'monospace' }}>
                      đang có {held.toLocaleString('en-US')}
                    </span>
                  </label>

                  {p.on && (
                    <div style={{ marginTop: 8, paddingLeft: 24 }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min={1}
                          value={p.amount}
                          onChange={(e) => setPick(a.key, { amount: e.target.value })}
                          style={{
                            width: '100%', background: 'rgba(0,0,0,0.22)',
                            border: `1px solid ${badAmount ? 'rgba(255,71,87,0.4)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: 8, padding: '8px 46px 8px 12px', color: '#FFFFFF',
                            fontSize: 13, fontFamily: 'monospace', outline: 'none',
                          }}
                        />
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#6B8BB0', fontSize: 11 }}>
                          sat
                        </span>
                      </div>
                      <p style={{ color: badAmount ? '#FF4757' : '#6B8BB0', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>
                        {badAmount ? 'số sat phải là số nguyên dương' : `${toBtc(Number(p.amount))} BTC`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Muc tien nhanh — ap cho cac dia chi dang chon */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#6B8BB0', fontSize: 11 }}>Đặt nhanh:</span>
            {['100000', '1000000', '5000000'].map((n) => (
              <button
                key={n}
                onClick={() =>
                  setPicks(Object.fromEntries(
                    addresses.map((a) => [a.key, { ...pickOf(a.key), amount: pickOf(a.key).on ? n : pickOf(a.key).amount }])
                  ))
                }
                style={{
                  padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#6B8BB0',
                }}
              >
                {toBtc(Number(n))} BTC
              </button>
            ))}
          </div>

          {/* Tong ket */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 8, marginBottom: 12,
            background: overBalance ? 'rgba(255,71,87,0.08)' : 'rgba(0,0,0,0.2)',
            border: `1px solid ${overBalance ? 'rgba(255,71,87,0.25)' : 'rgba(255,255,255,0.06)'}`,
          }}>
            <span style={{ color: '#6B8BB0', fontSize: 12 }}>
              {selected.length} địa chỉ · tổng
            </span>
            <span style={{ color: overBalance ? '#FF4757' : '#F7931A', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
              {faucetTotal.toLocaleString('en-US')} sat
            </span>
          </div>
          {overBalance && (
            <p style={{ color: '#FF4757', fontSize: 12, lineHeight: '18px', marginBottom: 12 }}>
              Vượt số dư ví miner ({fmtSat(net!.minerBalance!)}). Đào thêm block trước.
            </p>
          )}

          <BtnSecondary onClick={doFaucet} style={{ width: '100%', opacity: faucetValid && !busy ? 1 : 0.5 }}>
            {busy === 'faucet'
              ? 'Đang rót…'
              : selected.length === 0
                ? 'Chưa chọn địa chỉ nào'
                : `↓ Rót vào ${selected.length} địa chỉ`}
          </BtnSecondary>
        </Card>
      </div>

      {/* Ghi chu ky thuat */}
      <Card style={{ background: 'rgba(74,139,223,0.06)', border: '1px solid rgba(74,139,223,0.15)' }}>
        <h3 style={{ color: '#4A8BDF', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          Mạng local hoạt động thế nào
        </h3>
        <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '21px', marginBottom: 8 }}>
          <strong style={{ color: '#FFFFFF' }}>regtest</strong> là chế độ của Bitcoin Core cho phép tự tạo
          blockchain riêng trên máy: độ khó gần bằng 0 nên đào block là tức thì, và bạn toàn quyền
          quyết định khi nào giao dịch được xác nhận.
        </p>
        <p style={{ color: '#A8C4E8', fontSize: 13, lineHeight: '21px', marginBottom: 8 }}>
          Ví ở đây quét UTXO bằng <code style={{ fontFamily: 'monospace', color: '#6B8BB0' }}>scantxoutset</code> —
          quét thẳng tập UTXO nên không cần import ví hay rescan. Đổi lại nó
          <strong style={{ color: '#FFFFFF' }}> không thấy mempool</strong>, nên sau mỗi lần gửi ứng dụng
          tự đào 1 block.
        </p>
        <p style={{ color: '#6B8BB0', fontSize: 12, lineHeight: '19px' }}>
          Dữ liệu chuỗi nằm trong <code style={{ fontFamily: 'monospace' }}>.bitcoin/</code> trong thư mục dự án.
          Chạy <code style={{ fontFamily: 'monospace', color: '#A8C4E8' }}>npm run node:reset</code> để xoá sạch và làm lại từ block 0.
        </p>
      </Card>
    </div>
  )
}
