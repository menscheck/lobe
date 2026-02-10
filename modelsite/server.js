const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// lightweight admin placeholder
app.get('/admin', (_req, res) => {
  res.send(`<!doctype html><html><head><meta charset="utf-8" /><title>Admin</title></head><body><h1>JMJ Admin</h1><p>登入頁與內容管理後台會在下一版上線。</p></body></html>`);
});

app.listen(PORT, () => console.log('Listening on port', PORT));
