const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

const PORT = process.env.PORT || 10000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'set-a-secret';
const DATABASE_URL = process.env.DATABASE_URL;

let pool;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
}

app.use(express.json());
app.use(cookieParser());

function ok(res, data) {
  res.json(data);
}

function err(res, status, message) {
  res.status(status).json({ error: message });
}

function requireDb(req, res, next) {
  if (!pool) return err(res, 500, 'DATABASE_URL not configured');
  next();
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.token;
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) return err(res, 401, 'Unauthorized');
  req.user = decoded;
  next();
}

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS talents(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      bio TEXT,
      portfolio_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bookings(
      id SERIAL PRIMARY KEY,
      talent_id INTEGER REFERENCES talents(id),
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      meeting_time TIMESTAMP,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS questions(
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

initDb().catch((e) => console.error('DB init failed', e));

app.get('/', (req, res) => res.send(' <!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>JMJ Model</title><style>:root{--bg:#0B0B0B;--text:#FFFFFF;--muted:#B5B5B5;--paper:#F0EEE9;--text-paper:#0B0B0B;--accent:#FF2B2B;--accent2:#D41919;--border:rgba(255,255,255,.12);--radius:18px;--shadow:0 18px 40px rgba(0,0,0,.45);}*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:var(--bg);color:var(--text);}a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto;padding:28px 18px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid var(--border)}.brand{font-weight:800;letter-spacing:.2em;font-size:13px}.btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:999px;border:1px solid var(--border);background:rgba(255,255,255,0.02);color:var(--text);font-weight:700;font-size:13px;cursor:pointer}.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{background:var(--accent2);border-color:var(--accent2)}.panel{margin-top:18px;border-radius:var(--radius);background:var(--paper);color:var(--text-paper);box-shadow:var(--shadow);border:1px solid rgba(11,11,11,.06);padding:18px}.panel h1{margin:0;font-size:28px;line-height:1.1}.panel p{margin:10px 0 0;font-size:13px;line-height:1.55;color:rgba(11,11,11,.75)}</style></head><body><div class="wrap"><div class="topbar"><div class="brand">JMJ MODEL</div><button class="btn" onclick="location.href='/admin'">Admin</button></div><div class="panel"><h1>設計 tokens 已上線</h1><p>PANTONE 11-4201 Cloud Dancer (#F0EEE9) 當作 card surface；黑白紅保持品牌的清晰對比。Admin 在 /admin。</p><div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" onclick="alert('示意：瀏覽人才')">瀏覽人才</button><button class="btn" onclick="alert('示意：提交 casting')">提交 casting</button></div></div></div></body></html>. '));

app.get('/admin', (req, res) => {
  const token = req.cookies?.token;
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) {
    return res.send(`<!doctype html><html><body>
      <h1>Admin login</h1>
      <form id="f"><input name="u" placeholder="user" />
      <input name="p" placeholder="pass" type="password" />
      <button>Login</button></form>
      <pre id="out"></pre>
      <script>
        document.getElementById('f').onsubmit=async(e)=>{
          e.preventDefault();
          const fd=new FormData(e.target);
          const r=await fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username:fd.get('u'),password:fd.get('p')})});
          document.getElementById('out').textContent=await r.text();
          if(r.ok) location.reload();
        };
      </script>
    </body></html>`);
  }
  return res.send(`<!doctype html><html><body>
    <h1>Admin</h1>
    <button id="logout">Logout</button>
    <pre id="out"></pre>
    <script>
      document.getElementById('logout').onclick=async()=>{await fetch('/admin/logout',{method:'POST'});location.reload();};
    </script>
  </body></html>`);
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return err(res, 401, 'Invalid credentials');
  }
  const token = jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  });
  ok(res, { ok: true });
});

app.post('/admin/logout', (_req, res) => {
  res.clearCookie('token');
  ok(res, { ok: true });
});

app.get('/api/talents', requireDb, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM talents ORDER BY created_at DESC');
  ok(res, rows);
});

app.post('/api/bookings', requireDb, async (req, res) => {
  const { talent_id, client_name, client_email, meeting_time } = req.body || {};
  if (!client_name || !client_email) return err(res, 400, 'client_name and client_email required');
  const { rows } = await pool.query(
    `INSERT INTO bookings (talent_id, client_name, client_email, meeting_time)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [talent_id || null, client_name, client_email, meeting_time ? new Date(meeting_time) : null]
  );
  ok(res, rows[0]);
});

app.post('/api/questions', requireDb, async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!message) return err(res, 400, 'message required');
  const { rows } = await pool.query(
    `INSERT INTO questions (name,email,message) VALUES ($1,$2,$3) RETURNING *`,
    [name || null, email || null, message]
  );
  ok(res, rows[0]);
});

app.listen(PORT, () => console.log('Listening on', PORT));
