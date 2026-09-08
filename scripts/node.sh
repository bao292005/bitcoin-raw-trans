#!/usr/bin/env bash
# Quan ly bitcoind regtest CUC BO cho project nay.
#
# Datadir nam trong .bitcoin/ ngay trong thu muc project, KHONG dung
# ~/Library/Application Support/Bitcoin -> khong dung cham gi toi may ban,
# va xoa thu muc la sach hoan toan.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATADIR="$ROOT/.bitcoin"
CONF="$DATADIR/bitcoin.conf"

RPC_USER="${RPC_USER:-bitcoin}"
RPC_PASS="${RPC_PASS:-bitcoin}"
RPC_PORT=18443

cli() { bitcoin-cli -datadir="$DATADIR" -regtest "$@"; }

write_conf() {
  mkdir -p "$DATADIR"
  cat > "$CONF" <<EOF
regtest=1
server=1
# -txindex: cho phep getrawtransaction tra cuu giao dich BAT KY.
# Bat buoc de lay nonWitnessUtxo cho input Legacy P2PKH.
txindex=1
fallbackfee=0.0001
daemon=0
# Chuoi regtest nay hoan toan doc lap: ta tu dao block, khong ket noi peer nao.
# Tat listen de khoi chiem cong P2P 18444/18445 — neu khong se dung do voi
# Bitcoin-Qt hoac mot node regtest khac dang mo tren cung may.
listen=0
dnsseed=0
upnp=0

[regtest]
rpcuser=$RPC_USER
rpcpassword=$RPC_PASS
rpcbind=127.0.0.1
rpcport=$RPC_PORT
rpcallowip=127.0.0.1
EOF
}

case "${1:-}" in
  start)
    write_conf
    if cli getblockchaininfo >/dev/null 2>&1; then
      echo "bitcoind regtest dang chay roi."
      exit 0
    fi
    # Cong RPC bi ai do chiem -> bao ngay thay vi de bitcoind bao chung chung.
    if lsof -nP -iTCP:$RPC_PORT -sTCP:LISTEN >/dev/null 2>&1; then
      echo "LOI: cong RPC $RPC_PORT dang bi chiem boi:"
      lsof -nP -iTCP:$RPC_PORT -sTCP:LISTEN | tail -n +2
      echo "Dat RPC_PORT khac hoac tat tien trinh do."
      exit 1
    fi

    echo "Khoi dong bitcoind regtest (datadir: $DATADIR) ..."
    if ! bitcoind -datadir="$DATADIR" -conf="$CONF" -regtest -daemonwait; then
      echo
      echo "Khoi dong that bai. Vai dong loi cuoi trong debug.log:"
      grep -i "error" "$DATADIR/regtest/debug.log" 2>/dev/null | tail -5
      exit 1
    fi
    cli getblockchaininfo | grep -E '"(chain|blocks)"'
    echo "RPC: http://127.0.0.1:$RPC_PORT"
    ;;

  stop)
    cli stop 2>/dev/null && echo "Da dung bitcoind." || echo "bitcoind khong chay."
    ;;

  status)
    if cli getblockchaininfo 2>/dev/null; then :; else
      echo "bitcoind regtest khong chay. Chay: npm run node:start"
      exit 1
    fi
    ;;

  reset)
    # Xoa sach chuoi va vi -> quay lai block 0.
    cli stop >/dev/null 2>&1 || true
    sleep 1
    rm -rf "$DATADIR"
    echo "Da xoa $DATADIR. Chay 'npm run node:start' de tao lai tu dau."
    ;;

  qt)
    # Mo Bitcoin-Qt TREN DATADIR CUA DU AN.
    #
    # Qt va bitcoind KHONG chay dong thoi duoc tren cung datadir (khoa file),
    # nen ta dung bitcoind truoc. Doi lai, Qt luc nay vua la giao dien vua la
    # node phuc vu RPC — server.js noi vao binh thuong, khong can doi gi.
    write_conf

    QT=""
    for p in \
      "/Applications/Bitcoin-Qt.app/Contents/MacOS/Bitcoin-Qt" \
      "$(command -v bitcoin-qt 2>/dev/null)"
    do
      [ -x "$p" ] && QT="$p" && break
    done
    if [ -z "$QT" ]; then
      echo "Khong tim thay Bitcoin-Qt."
      echo "Cai bang: brew install --cask bitcoin-core"
      echo "Hoac tai tai https://bitcoincore.org/en/download/"
      exit 1
    fi

    if cli getblockchaininfo >/dev/null 2>&1; then
      echo "Dang dung bitcoind de nhuong datadir cho Qt..."
      cli stop >/dev/null 2>&1
      # Cho nha khoa datadir, neu khong Qt se bao "already running".
      for _ in $(seq 1 20); do
        cli getblockchaininfo >/dev/null 2>&1 || break
        sleep 0.5
      done
      sleep 1
    fi

    echo "Mo Bitcoin-Qt tren $DATADIR ..."
    "$QT" -regtest -datadir="$DATADIR" -conf="$CONF" >/dev/null 2>&1 &
    echo
    echo "Qt vua la GUI vua la node RPC — chay 'npm run web' la dung duoc."
    echo "Muon quay lai bitcoind: dong Qt roi chay 'npm run node:start'."
    ;;

  cli)
    shift
    cli "$@"
    ;;

  *)
    echo "Cach dung: $0 {start|stop|status|reset|cli <lenh...>}"
    exit 1
    ;;
esac
