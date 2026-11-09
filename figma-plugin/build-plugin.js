// Builds code.js for the Figma development plugin (G-116): reads the prototype's tokens.css + theme.css (theme R3)
// and bundles them as DATA in front of src/main.js. Code = Figma: change the CSS, run `node build-plugin.js`, re-run the plugin.
const fs = require('fs');
const path = require('path');
const PROTO = path.join(__dirname, '..', 'prototype');
const tokensCss = fs.readFileSync(path.join(PROTO, 'tokens.css'), 'utf8');
const themeCss = fs.readFileSync(path.join(PROTO, 'theme.css'), 'utf8');

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
const stripMedia = s => s.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
function blocks(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  const src = stripMedia(stripComments(css));
  while ((m = re.exec(src))) {
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const k = d.slice(0, i).trim();
      if (k.startsWith('--')) decls[k] = d.slice(i + 1).trim();
    }
    out.push({ sel: m[1].trim(), decls });
  }
  return out;
}

// 1. merged environment for theme R3: tokens.css (:root, [data-look]) → theme.css :root primitives → [data-look="r3"]
const env = {};
for (const b of blocks(tokensCss)) if (b.sel === ':root' || b.sel === ':root, [data-look]') Object.assign(env, b.decls);
const tb = blocks(themeCss);
const pick = sel => { const b = tb.find(x => x.sel === sel); if (!b) throw new Error('no block ' + sel); return b.decls; };
Object.assign(env, pick(':root'), pick('[data-look="r3"]'));
const light = pick('[data-look="r3"][data-theme="light"]');
const dark = pick('[data-look="r3"][data-theme="dark"]');

const varRef = v => { const m = /^var\((--[\w-]+)\)$/.exec(v.trim()); return m && m[1]; };
function px(name, seen = []) {
  const v = env[name];
  if (v == null) throw new Error('unknown ' + name + ' via ' + seen.join(' → '));
  const r = varRef(v);
  if (r) return px(r, seen.concat(name));
  let m = /^(-?[\d.]+)px$/.exec(v);
  if (m) return +m[1];
  m = /^calc\(var\((--[\w-]+)\)\s*\+\s*var\((--[\w-]+)\)\)$/.exec(v);
  if (m) return px(m[1], seen.concat(name)) + px(m[2], seen.concat(name));
  return null;
}
// first scale primitive on the alias chain (so Figma shows radius/raised → scale/3, like the CSS)
function scaleAlias(name) {
  let n = name;
  for (let i = 0; i < 10; i++) {
    const r = varRef(env[n] || '');
    if (!r) return null;
    if (/^--(scale|stroke)-/.test(r)) return r;
    n = r;
  }
  return null;
}
const figmaName = cssName => { const s = cssName.replace(/^--/, ''); const i = s.indexOf('-'); return i < 0 ? s : s.slice(0, i) + '/' + s.slice(i + 1); };

// 2. primitives: colours (hex from the generated comments) + numbers
const colors = [];
// G-117: <theme>-<family>-<step> and alpha-<white|black>-<step> → Figma groups light/gray/1, alpha/white/3
for (const m of themeCss.matchAll(/--((?:light|dark|alpha)-[a-z]+)-(\d+):\s*oklch\([^)]*\);\s*\/\*\s*(#[0-9a-f]{6}(?:[0-9a-f]{2})?)( · anchor)?/g))
  colors.push({ name: m[1].replace('-', '/') + '/' + m[2], css: `--${m[1]}-${m[2]}`, hex: m[3], anchor: !!m[4] });
const declared = (themeCss.match(/^\s*--(?:light|dark|alpha)-[a-z]+-\d+: oklch/gm) || []).length;
if (colors.length !== declared) throw new Error(`colour primitives: read ${colors.length} of ${declared}`);
const numbers = Object.keys(env).filter(k => /^--(scale|stroke)-/.test(k)).map(k => ({ name: figmaName(k), css: k, value: px(k) }));

// 3. semantic colours, two themes
function colorValue(v, where) {
  if (v.trim() === 'transparent') return { rgba: [0, 0, 0, 0] }; // G-127: the R4 block has no surface
  const r = varRef(v);
  if (r) {
    if (!colors.find(c => c.css === r)) throw new Error(where + ': alias to non-primitive ' + r);
    return { alias: colors.find(c => c.css === r).name };
  }
  const m = /^oklch\(([\d.]+)\s+0\s+0\s*\/\s*([\d.]+)\)$/.exec(v);
  if (m) { const L = +m[1]; if (L !== 0 && L !== 1) throw new Error(where + ': only black/white overlays supported'); return { rgba: [L, L, L, +m[2]] }; }
  throw new Error(where + ': cannot read colour ' + v);
}
const semNames = Object.keys(light);
if (Object.keys(dark).sort().join() !== semNames.slice().sort().join()) throw new Error('light and dark define different roles');
const semantic = semNames.map(k => ({ name: figmaName(k), css: k, light: colorValue(light[k], 'light ' + k), dark: colorValue(dark[k], 'dark ' + k) }));

// 4. dimension tokens (one mode — the same in both themes)
const dims = [];
for (const k of Object.keys(env)) {
  if (!/^--(space|radius|size|border-width)/.test(k)) continue;
  const value = px(k);
  if (value == null) continue;
  const a = scaleAlias(k);
  dims.push({ name: figmaName(k), css: k, value, alias: a ? figmaName(a) : null });
}

// 5. text styles: weight size/line + tracking (em → %)
const WEIGHT = { 400: 'Regular', 500: 'Medium', 600: 'Semi Bold' };
const tracking = { heading: '--tracking-heading', title: '--tracking-title', overline: '--tracking-overline' };
const text = [];
for (const k of Object.keys(env)) {
  const m = /^--type-([\w-]+)$/.exec(k);
  if (!m) continue;
  const v = /^(\d{3})\s+(\d+)px\/(\d+)px/.exec(env[k]);
  if (!v) throw new Error('type ' + k + ': ' + env[k]);
  const t = tracking[m[1]] ? parseFloat(env[tracking[m[1]]]) * 100 : 0;
  // the family from the font token (var(--font-mono) → "JetBrains Mono" in R5)
  let fam = (env[k].match(/var\((--font-[\w-]+)\)/) || [])[1], family = 'Inter';
  for (let i = 0; fam && i < 5; i++) { const val = env[fam] || ''; const r = /^var\((--font-[\w-]+)\)$/.exec(val.trim()); if (r) { fam = r[1]; continue; } family = val.split(',')[0].trim().replace(/^["']|["']$/g, '') || 'Inter'; break; }
  text.push({ name: m[1], css: k, family, weight: +v[1], style: WEIGHT[v[1]], size: +v[2], line: +v[3], tracking: +t.toFixed(2), upper: m[1] === 'overline' });
}

// letter-spacing tokens (em → %) for texts that add tracking on top of their style (KPI labels)
const trackingPct = {};
for (const k of Object.keys(env)) if (/^--tracking-/.test(k)) trackingPct[k] = +(parseFloat(env[k]) * 100).toFixed(2);
// G-119: the TO-BE screen (extract-screen.js → screen-light.json) → component masters + the screen of instances
let screen = null;
const screenFile = path.join(__dirname, 'screen-light.json');
if (fs.existsSync(screenFile)) {
  const darkFile = path.join(__dirname, 'screen-dark.json');
  const rd = f => fs.existsSync(path.join(__dirname, f)) ? JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')) : null;
  // G-174: + the «in the red» page (extract-screen.js light|dark states): its components join the masters, it becomes a board
  const lossL = rd('screen-loss-light.json'), lossD = rd('screen-loss-dark.json');
  screen = require('./screen-model').build(JSON.parse(fs.readFileSync(screenFile, 'utf8')), fs.existsSync(darkFile) ? JSON.parse(fs.readFileSync(darkFile, 'utf8')) : null, null, lossL ? { loss: { light: lossL, dark: lossD } } : {});
  let n = 0; const w = x => { if (x.t === 'inst') n++; (x.kids || []).forEach(w); }; w(screen.tree);
  screen.instances = n;
}
const submission = require('./submission-data')(); // G-160: texts for the «Add submission texts» command
const DATA = { source: 'prototype/tokens.css + theme.css' + (screen ? ' + TO-BE screen' : ''), built: '', colors, numbers, semantic, dims, text, tracking: trackingPct, screen, submission };
const main = ['docs-en.js', 'screen.js', 'boards.js', 'submission.js', 'main.js'].map(f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')).join('\n');
// no clock time: the same inputs give the same code.js; «built» is a short hash of the data instead
DATA.built = 'data ' + require('crypto').createHash('sha1').update(JSON.stringify(DATA)).digest('hex').slice(0, 8);
fs.writeFileSync(path.join(__dirname, 'code.js'), '// GENERATED by build-plugin.js — edit src/main.js or the CSS, then run: node build-plugin.js\nconst DATA = ' + JSON.stringify(DATA, null, 1) + ';\n\n' + main);
if (screen) console.log(`screen: ${screen.sets.length} generated sets · ${screen.instances} instances on the screen`);
console.log(`colours ${colors.length} · numbers ${numbers.length} · semantic ${semantic.length} · dims ${dims.length} · text ${text.length}`);
console.log('text: ' + text.map(t => `${t.name} ${t.family} ${t.weight} ${t.size}/${t.line}${t.tracking ? ' ' + t.tracking + '%' : ''}`).join(' · '));
console.log('dims: ' + dims.map(d => `${d.name}=${d.value}${d.alias ? '→' + d.alias : ''}`).join(' '));
