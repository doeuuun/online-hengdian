// 온라인 헝디엔 서버: 정적 파일 제공 + 접속자 위치/인사 중계(WebSocket)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const MAX_CLIENTS = Number(process.env.MAX_CLIENTS) || 60;
const MAX_PER_IP = Number(process.env.MAX_PER_IP) || 4;
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  const base = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  if (req.url === '/healthz') { res.writeHead(200, { ...base, 'content-type': 'text/plain' }); return res.end('ok'); }
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400, base); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403, base); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, base); return res.end('not found'); }
    res.writeHead(200, {
      ...base,
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': p === '/index.html' ? 'no-cache' : 'public, max-age=86400'
    });
    res.end(buf);
  });
});

// ---------- 접속자 상태 ----------
const ROLES = new Set(['empress', 'emperor', 'maid', 'knight', 'consort', 'eunuch', 'general']);
const THRONE = 5;
const clients = new Map();
const ipCount = new Map();
const dirty = new Set();
let nextId = 1;

const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : d;
function sanitize(d, prev) {
  d = d && typeof d === 'object' ? d : {};
  const out = {
    on: d.on === 1 ? 1 : 0,
    r: ROLES.has(d.r) ? d.r : 'maid',
    n: (typeof d.n === 'string' ? d.n.replace(/[^\p{L}\p{N} ._-]/gu, '') : '').slice(0, 10) || '손님',
    x: +num(d.x, -100, 100, 0).toFixed(2),
    z: +num(d.z, -120, 100, 0).toFixed(2),
    y: +num(d.y, 0, 4, 0).toFixed(2),
    f: +num(d.f, -7, 7, 0).toFixed(2),
    mv: d.mv === 1 ? 1 : 0,
    s: Math.round(num(d.s, 0, 5, 0)),
    wc: Math.round(num(d.wc, 0, 1e6, 0))
  };
  return out;
}
function throneHolder() {
  for (const [id, c] of clients) if (c.state && c.state.on === 1 && c.state.s === THRONE) return id;
  return null;
}

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 1024,
  verifyClient: ({ origin }) => !ALLOWED.length || (origin && ALLOWED.includes(origin))
});

wss.on('connection', (ws, req) => {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (clients.size >= MAX_CLIENTS || (ipCount.get(ip) || 0) >= MAX_PER_IP) { ws.close(1013, 'full'); return; }
  ipCount.set(ip, (ipCount.get(ip) || 0) + 1);
  const id = String(nextId++);
  const c = { ws, ip, state: null, tokens: 20, last: Date.now(), alive: true };
  clients.set(id, c);

  const init = [];
  for (const [oid, oc] of clients) if (oid !== id && oc.state && oc.state.on === 1) init.push([oid, oc.state]);
  ws.send(JSON.stringify({ t: 'i', id, peers: init }));

  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    c.tokens = Math.min(20, c.tokens + (now - c.last) / 1000 * 12); c.last = now;
    if (c.tokens < 1) return;
    c.tokens -= 1;
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (!m || m.t !== 'p') return;
    const s = sanitize(m.d);
    if (s.s === THRONE) {
      const holder = throneHolder();
      if (s.r !== 'emperor' || (holder && holder !== id)) s.s = 0;
    }
    c.state = s;
    dirty.add(id);
  });
  const leave = () => {
    if (!clients.delete(id)) return;
    ipCount.set(ip, Math.max(0, (ipCount.get(ip) || 1) - 1));
    dirty.delete(id);
    const msg = JSON.stringify({ t: 'l', id });
    for (const oc of clients.values()) if (oc.ws.readyState === 1) oc.ws.send(msg);
  };
  ws.on('close', leave);
  ws.on('error', leave);
});

// 변경분을 0.1초마다 묶어서 전송
setInterval(() => {
  if (!dirty.size) return;
  const ids = [...dirty]; dirty.clear();
  for (const [cid, c] of clients) {
    if (c.ws.readyState !== 1) continue;
    const u = [];
    for (const id of ids) if (id !== cid && clients.get(id) && clients.get(id).state) u.push([id, clients.get(id).state]);
    if (u.length) c.ws.send(JSON.stringify({ t: 'b', u }));
  }
}, 100);

// 끊어진 연결 정리
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false; try { c.ws.ping(); } catch {}
  }
}, 30000);

server.listen(PORT, () => console.log('온라인 헝디엔 서버 실행 중: http://localhost:' + PORT));
