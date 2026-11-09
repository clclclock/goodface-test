// G-119: takes the TO-BE screen description from the running prototype (localhost:5173, or env PORT) with headless Chrome
// and saves it as screen-<theme>.json for build-plugin.js. Run: node extract-screen.js [light|dark]
// Needs the prototype served on localhost:5173 (node serve.js — see README); another port: env PORT. Chrome path: env CHROME, default — Windows.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const theme = process.argv[2] || 'light';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.PORT || 5173;
const url = `http://localhost:${PORT}/tobe/figma-export.html?theme=${theme}`;
const html = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--force-prefers-reduced-motion', '--hide-scrollbars',
  '--window-size=1500,900', '--virtual-time-budget=10000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(html);
if (!m || !m[1].trim()) throw new Error('no export in the page — is the prototype server running on :' + PORT + '?');
const json = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const data = JSON.parse(json);
const out = path.join(__dirname, `screen-${theme}.json`);
fs.writeFileSync(out, JSON.stringify(data, null, 1));
let n = 0; const walk = x => { n++; (x.kids || []).forEach(walk); }; walk(data.tree);
console.log(`${path.basename(out)}: ${n} nodes · ${Math.round(data.width)}×${Math.round(data.height)} · theme ${data.theme} · ${data.rules} CSS rules`);
