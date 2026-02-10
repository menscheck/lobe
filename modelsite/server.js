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

app.get('/', (req, res) => res.send('Model Website: backend ready. Admin at /admin'));

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
