const express = require('express');
const app = express();

const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Model Website</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; }
        header { background:#111; color:#fff; padding:16px; }
        main { padding: 24px; }
        .card { border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:16px; }
      </style>
    </head>
    <body>
      <header>
        <h1>Model Website</h1>
        <p>Demo structure inspired by a talent directory (no copied content).</p>
      </header>
      <main>
        <div class="card">
          <h2>Talent Directory</h2>
          <p>This is a placeholder API response. Hook this up to your CMS/database and cloud storage.</p>
        </div>
      </main>
    </body>
  </html>`);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
