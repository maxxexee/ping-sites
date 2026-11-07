const http = require('http');
const https = require('https');

const DEFAULT_INTERVAL = 240;
const TIMEOUT_MS = 15000;

function parseInterval(raw) {
  const seconds = parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 30) {
    console.warn(`[pinger] INTERVAL_SECONDS="${raw}" is not a usable interval, using ${DEFAULT_INTERVAL}`);
    return DEFAULT_INTERVAL;
  }
  return seconds;
}

const URLS = (process.env.LIST_OF_URLS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const INTERVAL_SECONDS = parseInterval(process.env.INTERVAL_SECONDS || String(DEFAULT_INTERVAL));
const PORT = parseInt(process.env.PORT || '0', 10);

console.log(`[pinger] targets: ${URLS.length ? URLS.join(', ') : '(none)'}`);
console.log(`[pinger] interval: ${INTERVAL_SECONDS}s`);

function ping(url) {
  return new Promise((resolve, reject) => {
    let proto;
    try {
      proto = new URL(url).protocol === 'https:' ? https : http;
    } catch {
      reject({ url, error: 'invalid url' });
      return;
    }

    const req = proto.get(url, { timeout: TIMEOUT_MS }, (res) => {
      // Drain the body, otherwise the socket stays open until the target closes it.
      res.resume();
      resolve({ url, status: res.statusCode });
    });

    req.on('error', (err) => reject({ url, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      reject({ url, error: `timeout after ${TIMEOUT_MS / 1000}s` });
    });
  });
}

function describe(result) {
  if (result.status === 'fulfilled') {
    const { status, url } = result.value;
    const awake = status >= 200 && status < 400;
    return `${awake ? 'OK' : 'BAD'} ${status} ${url}`;
  }
  const reason = result.reason || {};
  return `FAIL ${reason.error || 'error'} ${reason.url || 'unknown'}`;
}

let running = false;

async function run() {
  if (running) {
    console.log('[pinger] previous round still running, skipping this tick');
    return;
  }
  if (!URLS.length) {
    console.log('[pinger] no URLs configured, skipping');
    return;
  }

  running = true;
  try {
    const results = await Promise.allSettled(URLS.map(ping));
    for (const result of results) {
      console.log(`[pinger] ${describe(result)}`);
    }
  } finally {
    running = false;
  }
}

if (PORT > 0) {
  const server = http.createServer((req, res) => res.writeHead(200).end('pinger'));
  server.listen(PORT, () => console.log(`[pinger] listening on ${PORT}`));
}

run();
setInterval(run, INTERVAL_SECONDS * 1000);
