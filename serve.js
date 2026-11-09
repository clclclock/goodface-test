// A tiny static server for the prototype — Node only, no packages, no internet.
// Run from the repository root:  node serve.js   → http://localhost:5173/tobe/
// Another port:                  node serve.js 8080
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'prototype'), PORT = +process.argv[2] || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { res.writeHead(301, { Location: p + '/' }); return res.end(); } // /tobe → /tobe/
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log('Prototype: http://localhost:' + PORT + '/tobe/  (AS-IS: http://localhost:' + PORT + '/)'));
