// Ghi log request cho server.js.
//
// Muc tieu: nhin terminal la biet web app vua lam gi, tung buoc mat bao lau,
// va hong o dau — khong phai doan.
//
// Tat log:  LOG=off npm run web

const ON = process.env.LOG !== 'off' && process.env.LOG !== '0';

// Mau ANSI. Tu tat khi output khong phai terminal (vd ghi ra file, CI).
const useColor = ON && process.stdout.isTTY;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const C = {
  dim: c(2),
  bold: c(1),
  red: c(31),
  green: c(32),
  yellow: c(33),
  blue: c(34),
  cyan: c(36),
};

const hhmmss = () => new Date().toTimeString().slice(0, 8);

// Rut gon chuoi dai o giua: "cPzDL5VH…mF4t"
const short = (s, head = 4, tail = 3) =>
  typeof s === 'string' && s.length > head + tail + 1
    ? `${s.slice(0, head)}…${s.slice(-tail)}`
    : String(s);

// Tom tat body de log MOT dong. Private key luon bi che.
function summarize(body) {
  if (!body || typeof body !== 'object') return '';
  const parts = [];

  for (const [k, v] of Object.entries(body)) {
    // KHONG BAO GIO in day du private key ra log.
    if (k === 'wif' || /priv|secret|key$/i.test(k)) {
      parts.push(`${k}=${C.dim(short(v))}`);
      continue;
    }
    if (Array.isArray(v)) {
      parts.push(`${k}=${v.length}`);
      continue;
    }
    if (v && typeof v === 'object') continue; // bo qua object long nhau
    parts.push(`${k}=${v}`);
  }
  return parts.join('  ');
}

// Middleware: gan req.log / req.timer, in dong mo dau va dong ket qua.
export function requestLogger() {
  return (req, res, next) => {
    // Bo qua file tinh (JS/CSS/anh cua giao dien) — chi quan tam loi goi API,
    // khong thi moi lan tai trang se do ra hang chuc dong vo nghia.
    if (!ON || !req.path.startsWith('/api')) {
      req.log = () => {};
      req.timer = () => () => 0;
      return next();
    }

    const started = process.hrtime.bigint();
    const ms = () => Number((process.hrtime.bigint() - started) / 1000000n);

    console.log(
      `\n${C.dim(hhmmss())}  ${C.cyan(C.bold(req.method))} ${C.cyan(req.path)}`
    );
    const params = summarize(req.body);
    if (params) console.log(`  ${C.dim(params)}`);

    // Cac buoc trung gian trong handler goi qua day.
    req.log = (msg) => console.log(`  ${C.dim('→')} ${msg}`);

    // Dong ho rieng cho tung buoc: const t = req.timer(); ... t() -> so ms
    req.timer = () => {
      const t0 = process.hrtime.bigint();
      return () => Number((process.hrtime.bigint() - t0) / 1000000n);
    };

    res.on('finish', () => {
      const ok = res.statusCode < 400;
      const tag = ok ? C.green(`${res.statusCode} OK`) : C.red(`${res.statusCode} LOI`);
      console.log(`  ${tag}  ${C.dim(`(${ms()}ms)`)}`);
    });

    next();
  };
}

// Dung trong handler de in loi kem ngu canh.
export function logError(message) {
  if (ON) console.log(`  ${C.red('✕')} ${C.red(message)}`);
}

export { C as logColors, short as logShort };
