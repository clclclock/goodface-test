// Goodface DS → Figma (G-116, palette G-117). Variables, text styles, Read me · Colours · Typography · Spacing · Components (with docs).
// Re-running is safe: variables and styles are updated by name, the generated page is rebuilt.
// DATA comes from build-plugin.js (tokens.css + theme.css).

const log = [];

// ── helpers: collections and variables (upsert by name) ──
async function collection(name) {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find(c => c.name === name) || figma.variables.createVariableCollection(name);
}
async function variablesOf(col) {
  const all = await figma.variables.getLocalVariablesAsync();
  const map = {};
  for (const v of all) if (v.variableCollectionId === col.id) map[v.name] = v;
  return map;
}
function upsert(map, col, name, type) {
  if (map[name] && map[name].resolvedType !== type) { map[name].remove(); delete map[name]; }
  return map[name] || (map[name] = figma.variables.createVariable(name, col, type));
}
const hexToRgb = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255, a: h.length > 7 ? +(parseInt(h.slice(7, 9), 16) / 255).toFixed(3) : 1 });
// variables this plugin made earlier but the code no longer has (e.g. zinc/18 before G-117) — generated, so removed
function prune(map, keep, what) {
  const gone = Object.keys(map).filter(n => !keep.has(n));
  for (const n of gone) { map[n].remove(); delete map[n]; }
  if (gone.length) log.push(`${what}: removed ${gone.length} old`);
}
const alias = v => figma.variables.createVariableAlias(v);
function scopesFor(name) {
  if (name.startsWith('text/')) return ['TEXT_FILL'];
  if (name.startsWith('surface/')) return ['FRAME_FILL', 'SHAPE_FILL'];
  if (name.startsWith('border/')) return ['STROKE_COLOR'];
  return ['ALL_FILLS', 'STROKE_COLOR'];
}
function dimScopes(name) {
  if (name.startsWith('space/')) return ['GAP'];
  if (name.startsWith('radius/')) return ['CORNER_RADIUS'];
  if (name.startsWith('border/')) return ['STROKE_FLOAT'];
  return ['WIDTH_HEIGHT'];
}

// ── 1. variables ──
async function buildVariables() {
  // primitives: hidden from pickers (scopes = []) — designers pick roles, not raw colours
  const prim = await collection('Primitives');
  const pm = prim.modes[0].modeId;
  prim.renameMode(pm, 'Value');
  const pv = await variablesOf(prim);
  for (const c of DATA.colors) {
    const v = upsert(pv, prim, c.name, 'COLOR');
    v.setValueForMode(pm, hexToRgb(c.hex));
    v.scopes = [];
    v.setVariableCodeSyntax('WEB', `var(${c.css})`);
  }
  for (const n of DATA.numbers) {
    const v = upsert(pv, prim, n.name, 'FLOAT');
    v.setValueForMode(pm, n.value);
    v.scopes = [];
    v.setVariableCodeSyntax('WEB', `var(${n.css})`);
  }

  // semantic colours: one collection with Light / Dark modes; Starter allows one mode → two collections
  const existing = await figma.variables.getLocalVariableCollectionsAsync();
  const split = existing.find(c => c.name === 'Semantic · Light'); // an earlier run on the free plan
  const sem = split || await collection('Semantic');
  const lightId = sem.modes[0].modeId;
  sem.renameMode(lightId, 'Light');
  let darkId = (sem.modes.find(m => m.name === 'Dark') || {}).modeId;
  if (!darkId && !split) { try { darkId = sem.addMode('Dark'); } catch (e) { darkId = null; } }
  let darkCol = null;
  const targets = [{ col: sem, mode: lightId, key: 'light' }];
  if (darkId) targets.push({ col: sem, mode: darkId, key: 'dark' });
  else {
    sem.name = 'Semantic · Light';
    const d = darkCol = await collection('Semantic · Dark');
    d.renameMode(d.modes[0].modeId, 'Dark');
    targets.push({ col: d, mode: d.modes[0].modeId, key: 'dark' });
    log.push('Free plan: one mode per collection → Semantic · Light and Semantic · Dark');
  }
  const maps = new Map();
  for (const t of targets) if (!maps.has(t.col.id)) maps.set(t.col.id, await variablesOf(t.col));
  for (const s of DATA.semantic) {
    for (const t of targets) {
      const v = upsert(maps.get(t.col.id), t.col, s.name, 'COLOR');
      const val = s[t.key];
      v.setValueForMode(t.mode, val.alias ? alias(pv[val.alias]) : { r: val.rgba[0], g: val.rgba[1], b: val.rgba[2], a: val.rgba[3] });
      v.scopes = scopesFor(s.name);
      v.setVariableCodeSyntax('WEB', `var(${s.css})`);
    }
  }

  // dimensions: spacing, radii, sizes — same in both themes
  const dim = await collection('Dimensions');
  const dm = dim.modes[0].modeId;
  dim.renameMode(dm, 'Value');
  const dv = await variablesOf(dim);
  for (const d of DATA.dims) {
    const v = upsert(dv, dim, d.name, 'FLOAT');
    v.setValueForMode(dm, d.alias && pv[d.alias] ? alias(pv[d.alias]) : d.value);
    v.scopes = dimScopes(d.name);
    v.setVariableCodeSyntax('WEB', `var(${d.css})`);
  }
  prune(dv, new Set(DATA.dims.map(d => d.name)), 'Dimensions');
  for (const m of maps.values()) prune(m, new Set(DATA.semantic.map(x => x.name)), 'Semantic');
  prune(pv, new Set(DATA.colors.map(c => c.name).concat(DATA.numbers.map(n => n.name))), 'Primitives');
  log.push(`Variables: ${DATA.colors.length + DATA.numbers.length} primitives · ${DATA.semantic.length} semantic × 2 themes · ${DATA.dims.length} dimensions`);
  return { color: maps.get(sem.id), dim: dv, semantic: sem, darkMode: darkId, darkColor: darkCol ? maps.get(darkCol.id) : null };
}

// ── 2. text styles ──
async function interStyles() {
  const fonts = await figma.listAvailableFontsAsync();
  // G-133: every family the text styles use (Inter for text, JetBrains Mono for numbers in R5) → { family: { Regular, Medium, 'Semi Bold', Bold } }
  const families = [...new Set(['Inter'].concat(DATA.text.map(t => t.family)))];
  const all = {};
  for (const family of families) {
    const styles = fonts.filter(f => f.fontName.family === family).map(f => f.fontName.style);
    const find = re => styles.find(s => re.test(s));
    const map = { Regular: find(/^regular$/i), Medium: find(/^medium$/i), 'Semi Bold': find(/^semi\s?bold$/i) };
    const bold = find(/^bold$/i);
    if (bold) map.Bold = bold;
    for (const k in map) {
      if (!map[k]) throw new Error(family + ' ' + k + ' is not available in this Figma');
      await figma.loadFontAsync({ family, style: map[k] });
    }
    all[family] = map;
  }
  return all;
}
async function buildTextStyles(styleMap) {
  const existing = await figma.getLocalTextStylesAsync();
  const out = {};
  for (const t of DATA.text) {
    const st = existing.find(s => s.name === t.name) || figma.createTextStyle();
    st.name = t.name;
    st.fontName = { family: t.family, style: styleMap[t.family][t.style] };
    st.fontSize = t.size;
    st.lineHeight = { unit: 'PIXELS', value: t.line };
    st.letterSpacing = { unit: 'PERCENT', value: t.tracking };
    st.textCase = t.upper ? 'UPPER' : 'ORIGINAL';
    st.description = `${t.css} · ${t.weight} ${t.size}/${t.line} · Inter, tabular digits (set in Type details → Numbers)`;
    out[t.name] = st;
  }
  log.push(`Text styles: ${DATA.text.length}`);
  return out;
}

// ── 3. building blocks ──
let V, T; // variables { color, dim, prim, darkColor }, text styles
const col = n => { const v = V.color[n]; if (!v) throw new Error('no colour variable ' + n); return v; };
const dim = n => { const v = V.dim[n] || V.prim[n]; if (!v) throw new Error('no dimension variable ' + n); return v; };
const paint = (name, variable) => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', variable || col(name));
function fill(node, name) { node.fills = name ? [paint(name)] : []; }
function stroke(node, name, transparent) {
  // CSS «border: 1px solid transparent» — keeps the size; a variable-bound paint loses opacity 0 in Figma, so it stays unbound
  node.strokes = [transparent ? { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0 } : paint(name)];
  node.strokeAlign = 'INSIDE';
  node.setBoundVariable('strokeWeight', dim('border/width'));
  if ('strokesIncludedInLayout' in node || node.layoutMode) node.strokesIncludedInLayout = true; // = CSS border-box
}
function radius(node, name) { for (const f of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) node.setBoundVariable(f, dim(name)); }
function pad(node, y, x) {
  for (const [f, n] of [['paddingTop', y], ['paddingBottom', y], ['paddingLeft', x], ['paddingRight', x]]) {
    if (n === 0) node[f] = 0; else node.setBoundVariable(f, dim(n));
  }
}
// auto layout frame or component: dir, gap token (or number), align
function layout(node, dir, gap, align) {
  node.layoutMode = dir;
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'AUTO';
  node.counterAxisAlignItems = align || 'CENTER';
  if (typeof gap === 'string') node.setBoundVariable('itemSpacing', dim(gap)); else node.itemSpacing = gap || 0;
  node.fills = [];
  return node;
}
function frame(name, dir, gap, align) { const f = figma.createFrame(); f.name = name; return layout(f, dir, gap, align || 'MIN'); }
async function text(chars, style, color, name) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(T[style].id);
  t.characters = chars;
  t.fills = [paint(color)];
  t.name = name || chars.slice(0, 40);
  return t;
}
// text that wraps inside a fixed-width auto-layout parent
async function para(parent, chars, style, color) {
  const t = await text(chars, style, color);
  parent.appendChild(t);
  t.layoutSizingHorizontal = 'FILL';
  t.textAutoResize = 'HEIGHT';
  return t;
}
function fixedWidth(f, w) { f.resize(w, Math.max(f.height, 10)); f.counterAxisSizingMode = 'FIXED'; f.primaryAxisSizingMode = 'AUTO'; } // resize() fixes both axes — give the height back to hug
function textProp(owner, nodes, name, value) {
  const key = owner.addComponentProperty(name, 'TEXT', value);
  for (const n of nodes) n.componentPropertyReferences = { characters: key };
}
function setLayout(set) {
  set.layoutMode = 'VERTICAL';
  set.layoutWrap = 'NO_WRAP';
  set.itemSpacing = 16; set.counterAxisSpacing = 16;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  set.primaryAxisSizingMode = 'AUTO'; set.counterAxisSizingMode = 'AUTO';
  set.counterAxisAlignItems = 'CENTER';
  fill(set, 'surface/page'); // on the page tone, as in the product
  set.cornerRadius = 16;
}
const NEUTRAL = 'Label'; // components carry a neutral label; real texts live in the screen's instances

// ── 4. areas: a page each (Read me · Foundations · Components); page limit → sections on one page ──
const AREAS = ['Read me', 'Colours', 'Typography', 'Spacing', 'Components'];
async function areas() {
  const old = figma.root.children.find(p => p.name === 'Components (generated)'); // name from the first pilot
  if (old && !figma.root.children.find(p => p.name === 'Components')) {
    old.name = 'Components';
    await old.loadAsync();
    // the first pilot's loose sets (generated, not hand-made) — replaced by the Components board
    for (const n of old.children.filter(c => ['Tag', 'Segmented Control / Item', 'Segmented Control', 'Preview · Dark'].includes(c.name))) n.remove();
  }
  const found = {}, created = [];
  let limit = false;
  for (const name of AREAS) {
    let p = figma.root.children.find(x => x.name === name && x.type === 'PAGE');
    if (!p) {
      try { p = figma.createPage(); p.name = name; created.push(p); } catch (e) { limit = true; break; }
    }
    found[name] = p;
  }
  const out = {};
  if (!limit) {
    for (const name of AREAS) { await found[name].loadAsync(); out[name] = { page: found[name], parent: found[name] }; }
    return out;
  }
  for (const p of created) p.remove();
  const host = await dsPage();
  log.push('Page limit on this plan (3) → sections on page «' + host.name + '»');
  for (const name of AREAS) {
    let s = host.children.find(x => x.type === 'SECTION' && x.name === name);
    if (!s) { s = figma.createSection(); s.name = name; host.appendChild(s); }
    s.setPluginData('goodface', 'area');
    out[name] = { page: host, parent: s, section: s };
  }
  return out;
}
// Starter: 3 pages per file → the brief page · «Design system» (Read me / Foundations / Components as sections) · «TO-BE»
const BOARDS = ['Goodface · Performance Summary', 'Foundations', 'Colours', 'Typography', 'Spacing & radii', 'Components'];
const isOurs = n => n.getPluginData('goodface') === 'area' ||
  (n.type === 'SECTION' && AREAS.concat('Foundations').includes(n.name) && n.children.length === 1 && BOARDS.includes(n.children[0].name)); // sections of the run before tagging
async function dsPage() {
  const DS = 'Design system';
  let p = figma.root.children.find(x => x.name === DS);
  if (!p) {
    const comp = figma.root.children.find(x => x.name === 'Components');
    if (comp) { await comp.loadAsync(); if (comp.children.every(isOurs)) { comp.name = DS; p = comp; } } // empty page from an earlier run
  }
  if (!p) { try { p = figma.createPage(); p.name = DS; } catch (e) { p = figma.currentPage; } }
  await p.loadAsync();
  // sections an earlier run left on other pages (generated content, not hand-made): they are rebuilt here
  for (const pg of figma.root.children) {
    if (pg === p) continue;
    await pg.loadAsync();
    for (const n of pg.children.filter(isOurs)) n.remove();
  }
  return p;
}
// a board = one auto-layout column per area, rebuilt on every run
async function board(area, title, subtitle) {
  for (const n of area.parent.children.filter(c => c.name === title)) n.remove();
  const b = frame(title, 'VERTICAL', 48);
  b.paddingTop = b.paddingBottom = b.paddingLeft = b.paddingRight = 64;
  fill(b, 'surface/page');
  b.cornerRadius = 24;
  area.parent.appendChild(b);
  const head = frame('Header', 'VERTICAL', 'space/inline');
  b.appendChild(head);
  head.appendChild(await text(title, 'hero', 'text/primary'));
  if (subtitle) head.appendChild(await text(subtitle, 'body', 'text/secondary'));
  return b;
}
function place(area, b, x) {
  if (area.section) {
    b.x = 80; b.y = 80;
    area.section.resizeWithoutConstraints(b.width + 160, b.height + 160);
    area.section.x = x; area.section.y = 0;
    return x + b.width + 160 + 200;
  }
  b.x = 0; b.y = 0;
  return x;
}

// ── 5. documentation card ──
async function docCard(name, node, host) {
  const d = DOCS[name];
  if (!d) throw new Error('no docs for ' + name);
  const c = frame('Docs · ' + name, 'VERTICAL', 'space/gap');
  pad(c, 'space/inset-lg', 'space/inset-lg');
  if (host) { host.appendChild(c); c.layoutSizingHorizontal = 'FILL'; await para(c, 'Documentation', 'overline', 'text/muted'); }
  else { fill(c, 'surface/container'); stroke(c, 'border/subtle', false); radius(c, 'radius/container'); fixedWidth(c, 420); }
  if (!host) { await para(c, name, 'heading', 'text/primary'); await para(c, d.summary, 'body', 'text/secondary'); } // in a card the header above already says both
  // the variants that exist in this file (read from the set), next to the ones the code has
  let inFile = null;
  if (node && node.type === 'COMPONENT_SET') inFile = Object.entries(node.componentPropertyDefinitions).filter(([, p]) => p.type === 'VARIANT').map(([k, p]) => `${k} = ${p.variantOptions.join(' · ')}`).join('; ');
  else if (node) inFile = '— (one component)';
  const rows = [['Code', d.code]].concat(inFile ? [['Variants in this file', inFile], ['Variants in code', d.variants]] : [['Variants', d.variants]], [['Properties', d.props], ['Size', d.size], ['Tokens', d.tokens]]);
  for (const [k, v] of rows) {
    const r = frame(k, 'VERTICAL', 'space/tight');
    c.appendChild(r); r.layoutSizingHorizontal = 'FILL';
    await para(r, k, 'overline', 'text/muted');
    await para(r, v, 'body', 'text/primary');
  }
  const r = frame('Rules', 'VERTICAL', 'space/tight');
  c.appendChild(r); r.layoutSizingHorizontal = 'FILL';
  await para(r, 'Rules', 'overline', 'text/muted');
  for (const rule of d.rules) await para(r, '— ' + rule, 'body', 'text/primary');
  return c;
}
// Components page: groups → one block per component: name and what it is for, every variant captioned, the main component, its docs
const GROUPS = [
  ['Controls & labels', 'What you click, and the labels next to values.', ['Segmented Control', 'Segmented Control / Item', 'Tag', 'Period Tag', 'Info Tip']],
  ['Cards & rows', 'Where the numbers live.', ['KPI Card', 'Stat Row', 'Breakdown Row']],
  ['Bars & charts', 'One weight for every bar; rounded only where a scale or a value ends. One line chart for P&L over time.', ['Split Bar', 'Pair Bar', 'Diverge Bar', 'Rate Bar', 'Mini Bar', 'Line Chart']],
  ['Navigation', 'The page shell around the two blocks.', ['Trading Panel']],
];
function divider(parent) {
  const r = figma.createRectangle(); r.name = 'Divider'; r.resize(100, 1); r.fills = [paint('border/subtle')];
  parent.appendChild(r); r.layoutSizingHorizontal = 'FILL'; r.layoutSizingVertical = 'FIXED';
}
async function componentBlock(parent, set) {
  const variants = set.type === 'COMPONENT_SET' ? set.children.slice() : [set];
  const widest = Math.max(...variants.map(v => v.width));
  const W = Math.round(Math.max(480, widest + 64, set.width + 64));
  const card = frame('Component · ' + set.name, 'VERTICAL', 0);
  fill(card, 'surface/card'); stroke(card, 'border/subtle', false); radius(card, 'radius/container');
  card.clipsContent = true;
  parent.appendChild(card);
  fixedWidth(card, W);
  const head = frame('Header', 'VERTICAL', 'space/tight');
  pad(head, 'space/inset-lg', 'space/inset-lg');
  card.appendChild(head); head.layoutSizingHorizontal = 'FILL';
  await para(head, set.name, 'heading', 'text/primary');
  if (DOCS[set.name]) await para(head, DOCS[set.name].summary, 'body', 'text/secondary');
  // the stage: the component on its own tone — what you see here is the component, the white below is about it
  const stage = frame('Component', 'VERTICAL', 'space/stack');
  pad(stage, 'space/inset-lg', 'space/inset-lg');
  fill(stage, 'surface/track');
  card.appendChild(stage); stage.layoutSizingHorizontal = 'FILL';
  await para(stage, 'Variants', 'overline', 'text/muted');
  // every variant on its own, with its property values over it — readable without selecting anything
  const plate = frame('Variants · preview', 'HORIZONTAL', 24);
  stage.appendChild(plate); plate.layoutSizingHorizontal = 'FILL';
  plate.layoutWrap = 'WRAP'; plate.counterAxisSpacing = 24;
  for (const v of variants) {
    const tile = frame('Variant · ' + v.name, 'VERTICAL', 'space/inline');
    plate.appendChild(tile);
    tile.appendChild(await text(set.type === 'COMPONENT_SET' ? v.name.split(', ').join(' · ') : 'one variant', 'overline', 'text/muted'));
    tile.appendChild(v.createInstance());
  }
  await para(stage, 'Main component — edit here; the variants above and the screen follow', 'overline', 'text/muted');
  stage.appendChild(set);
  await docCard(set.name, set, card);
  return card;
}
// a group = one panel per kind: its title, then its components in one row (scan left → right)
async function groupPanel(b, i, n, title, note, count) {
  const g = frame('Group · ' + title, 'VERTICAL', 32);
  g.paddingTop = g.paddingBottom = g.paddingLeft = g.paddingRight = 40;
  fill(g, 'surface/sunken'); stroke(g, 'border/subtle', false);
  g.cornerRadius = 24;
  b.appendChild(g);
  const h = frame('Group title', 'VERTICAL', 'space/tight'); g.appendChild(h);
  h.appendChild(await text(`Group ${i} of ${n} · ${count}`, 'overline', 'text/muted'));
  h.appendChild(await text(title, 'numeric-lg', 'text/primary'));
  if (note) h.appendChild(await text(note, 'body', 'text/secondary'));
  const row = frame('Row', 'HORIZONTAL', 32, 'MIN');
  g.appendChild(row);
  return row;
}
async function componentGroups(b, sets) {
  const byName = Object.fromEntries(sets.map(x => [x.name, x]));
  const groups = GROUPS.map(([t, n, names]) => [t, n, names.filter(x => byName[x])]).filter(g => g[2].length);
  const rest = sets.map(x => x.name).filter(x => !GROUPS.some(g => g[2].includes(x)));
  if (rest.length) groups.push(['Other', '', rest]);
  const total = groups.length + 1; // + Containers
  let i = 0;
  for (const [title, note, names] of groups) {
    const row = await groupPanel(b, ++i, total, title, note, names.length + (names.length === 1 ? ' component' : ' components'));
    for (const n of names) await componentBlock(row, byName[n]);
  }
  return total;
}
async function componentRow(b, set) {
  const row = frame('Row · ' + set.name, 'HORIZONTAL', 32);
  b.appendChild(row);
  row.appendChild(set);
  row.appendChild(await docCard(set.name, set));
  return row;
}

// ── 6. components ──
async function buildTag() {
  const c = figma.createComponent();
  c.name = 'tone=neutral';
  layout(c, 'HORIZONTAL', null);
  pad(c, 0, 'space/inline');
  fill(c, 'surface/tag');
  stroke(c, 'border/subtle', true);
  radius(c, 'radius/pill');
  const t = await text(NEUTRAL, 'label', 'text/secondary', 'Label');
  c.appendChild(t);
  const set = figma.combineAsVariants([c], figma.currentPage);
  set.name = 'Tag';
  setLayout(set);
  textProp(set, [t], 'Label', NEUTRAL);
  set.description = DOCS['Tag'].summary;
  return set;
}
const SEG_STATES = {
  default: { fill: null, border: null, text: 'text/secondary' },
  hover: { fill: 'surface/hover', border: null, text: 'text/primary' },
  active: { fill: 'surface/selected', border: 'border/selected', text: 'text/selected' },
};
const SEG_SIZES = {
  sm: { padY: 'space/tight', padX: 'space/stack', text: 'label', track: 'surface/track', active: 0 },
  lg: { padY: 'scale/2', padX: 'scale/4', text: 'body-medium', track: 'surface/track-lg', active: 0 },
};
async function buildSegmented() {
  const items = [], texts = [];
  for (const size of Object.keys(SEG_SIZES)) for (const state of Object.keys(SEG_STATES)) {
    const s = SEG_SIZES[size], st = SEG_STATES[state];
    const c = figma.createComponent();
    c.name = `size=${size}, state=${state}`;
    layout(c, 'HORIZONTAL', null);
    pad(c, s.padY, s.padX); // lg binds to scale/2 and scale/4, as the CSS does
    fill(c, st.fill);
    stroke(c, st.border || 'border/strong', !st.border);
    radius(c, 'radius/control');
    const t = await text(NEUTRAL, s.text, st.text, 'Label');
    c.appendChild(t);
    items.push(c); texts.push(t);
  }
  const set = figma.combineAsVariants(items, figma.currentPage);
  set.name = 'Segmented Control / Item';
  setLayout(set);
  textProp(set, texts, 'Label', NEUTRAL);
  set.description = DOCS['Segmented Control / Item'].summary;

  const tracks = [];
  for (const size of Object.keys(SEG_SIZES)) {
    const s = SEG_SIZES[size];
    const c = figma.createComponent();
    c.name = `size=${size}`;
    layout(c, 'HORIZONTAL', 'space/tight');
    pad(c, 'space/tight', 'space/tight');
    fill(c, s.track);
    stroke(c, 'border/track', false);
    radius(c, 'radius/nested'); // concentric: control 8 + gap 4 (G-111)
    for (let i = 0; i < 4; i++) { // 3 items (Breakdowns); the 4th is hidden — shown where a switch has four (the chart period, G-143)
      const variant = set.children.find(v => v.name === `size=${size}, state=${i === s.active ? 'active' : 'default'}`);
      const it = variant.createInstance();
      c.appendChild(it);
      if (i === 3) { it.name = 'Item 4 (hidden — show for 4 options)'; it.visible = false; }
    }
    tracks.push(c);
  }
  const tset = figma.combineAsVariants(tracks, figma.currentPage);
  tset.name = 'Segmented Control';
  setLayout(tset);
  tset.description = DOCS['Segmented Control'].summary;
  return [tset, set];
}

// ── 7. foundations (generated from the variables) ──
const hexOf = n => (DATA.colors.find(c => c.name === n) || {}).hex;
function valueText(v) {
  if (v.alias) return `${v.alias} ${hexOf(v.alias)}`;
  const [r, , , a] = v.rgba;
  return `${r === 1 ? 'white' : 'black'} ${+(a * 100).toFixed(1)}%`;
}
function swatch(variable, w, h) {
  const r = figma.createRectangle();
  r.resize(w || 40, h || 28);
  r.fills = [paint(null, variable)];
  r.strokes = [paint('border/subtle')]; r.strokeWeight = 1; r.strokeAlign = 'INSIDE';
  r.cornerRadius = 6;
  r.name = variable.name;
  return r;
}
function darkSwatch(name) {
  if (V.darkColor) return swatch(V.darkColor[name]);
  const f = frame('Dark', 'HORIZONTAL', 0);
  f.appendChild(swatch(col(name)));
  f.setExplicitVariableModeForCollection(V.semantic, V.darkMode);
  return f;
}
async function sectionTitle(parent, title, note) {
  const h = frame(title, 'VERTICAL', 'space/tight');
  parent.appendChild(h);
  h.appendChild(await text(title, 'heading', 'text/primary'));
  if (note) h.appendChild(await text(note, 'body', 'text/secondary'));
}
async function buildColours(b) {
  await paletteNotes(b);
  // colour roles
  const roles = frame('Colour roles', 'VERTICAL', 'space/gap');
  b.appendChild(roles);
  await sectionTitle(roles, 'Colour roles', 'Semantic variables — components use only these. Light | Dark, then the primitive each points to.');
  const groups = [];
  for (const s of DATA.semantic) { const g = s.name.split('/')[0]; if (!groups.includes(g)) groups.push(g); }
  const grid = frame('Groups', 'HORIZONTAL', 48);
  grid.layoutWrap = 'WRAP'; grid.counterAxisSpacing = 32;
  roles.appendChild(grid);
  fixedWidthRow(grid, 1440);
  for (const g of groups) {
    const gcol = frame(g, 'VERTICAL', 'space/inline');
    grid.appendChild(gcol);
    gcol.appendChild(await text(g, 'overline', 'text/muted'));
    for (const s of DATA.semantic.filter(x => x.name.split('/')[0] === g)) {
      const row = frame(s.name, 'HORIZONTAL', 'space/stack', 'CENTER');
      gcol.appendChild(row);
      row.appendChild(swatch(col(s.name)));
      row.appendChild(darkSwatch(s.name));
      const names = frame('Names', 'VERTICAL', 0);
      row.appendChild(names);
      names.appendChild(await text(s.name, 'body-medium', 'text/primary'));
      names.appendChild(await text(`${valueText(s.light)} · ${valueText(s.dark)}`, 'caption', 'text/secondary'));
    }
  }
  // primitives: one row per ramp (theme / family), steps 1–12; ● = anchor (a colour the screen already used)
  const prim = frame('Primitives', 'VERTICAL', 'space/gap');
  b.appendChild(prim);
  await sectionTitle(prim, 'Primitives', 'Two ramps of 12 steps per family — light and dark. Hidden from the pickers. ● anchor: a colour the screen already used; the other steps are built between anchors.');
  const ramps = [];
  for (const c of DATA.colors) { const r = c.name.split('/').slice(0, 2).join('/'); if (!ramps.includes(r)) ramps.push(r); }
  const stepsRow = frame('Steps', 'HORIZONTAL', 'space/stack', 'CENTER');
  prim.appendChild(stepsRow);
  const lead = frame('Ramp', 'VERTICAL', 0); lead.minWidth = 120; stepsRow.appendChild(lead);
  for (let i = 1; i <= 12; i++) { const h = frame(String(i), 'VERTICAL', 0); h.minWidth = 64; stepsRow.appendChild(h); h.appendChild(await text(String(i), 'overline', 'text/muted')); }
  for (const r of ramps) {
    const row = frame(r, 'HORIZONTAL', 'space/stack', 'CENTER');
    prim.appendChild(row);
    const name = frame('Name', 'VERTICAL', 0); name.minWidth = 120; row.appendChild(name);
    name.appendChild(await text(r, 'body-medium', 'text/primary'));
    for (const c of DATA.colors.filter(x => x.name.startsWith(r + '/'))) {
      const chip = frame(c.name, 'VERTICAL', 'space/tight');
      row.appendChild(chip);
      if (r === 'alpha/white') {
        const plate = frame('On dark', 'HORIZONTAL', 0);
        plate.paddingTop = plate.paddingBottom = plate.paddingLeft = plate.paddingRight = 0;
        plate.fills = [paint(null, V.prim['dark/gray/1'])]; plate.cornerRadius = 6;
        chip.appendChild(plate);
        const sw = swatch(V.prim[c.name], 64, 40); sw.strokes = [];
        plate.appendChild(sw);
      } else chip.appendChild(swatch(V.prim[c.name], 64, 40));
      chip.appendChild(await text((c.anchor ? '● ' : '') + c.hex, 'caption', c.anchor ? 'text/primary' : 'text/secondary'));
    }
  }
}
async function buildTypography(b) {
  const type = frame('Type', 'VERTICAL', 'space/gap');
  b.appendChild(type);
  const ORDER = ['hero', 'numeric-lg', 'heading', 'title', 'body-strong', 'body-medium', 'body', 'numeric', 'label', 'caption', 'overline'];
  const rank = n => { const i = ORDER.indexOf(n); return i < 0 ? 99 : i; };
  for (const t of DATA.text.slice().sort((a, z) => rank(a.name) - rank(z.name))) {
    const row = frame(t.name, 'HORIZONTAL', 32, 'CENTER');
    type.appendChild(row);
    const meta = frame('Meta', 'VERTICAL', 0);
    row.appendChild(meta);
    meta.minWidth = 200; // a min width, so the frame still hugs its height
    meta.appendChild(await text(t.name, 'body-medium', 'text/primary'));
    meta.appendChild(await text(`${t.weight} · ${t.size}/${t.line}${t.tracking ? ' · ' + t.tracking + '%' : ''}`, 'caption', 'text/secondary'));
    row.appendChild(await text(t.name.startsWith('numeric') || t.name === 'hero' ? '+$2,050.00' : 'Daily Net P&L Statistics', t.name, 'text/primary'));
  }
}
async function buildSpacing(b) {
  const dims = frame('Dimensions', 'HORIZONTAL', 96);
  b.appendChild(dims);
  const sp = frame('Spacing', 'VERTICAL', 'space/stack');
  dims.appendChild(sp);
  await sectionTitle(sp, 'Spacing', 'space/* — gaps and padding.');
  for (const d of DATA.dims.filter(x => x.name.startsWith('space/')).sort((a, z) => a.value - z.value)) {
    const row = frame(d.name, 'HORIZONTAL', 'space/stack', 'CENTER');
    sp.appendChild(row);
    const bar = figma.createRectangle();
    bar.resize(d.value, 12); bar.setBoundVariable('width', V.dim[d.name]);
    bar.fills = [paint('brand/fill')]; bar.name = 'Value';
    row.appendChild(bar);
    row.appendChild(await text(`${d.name} · ${d.value}${d.alias ? ' → ' + d.alias : ''}`, 'body', 'text/primary'));
  }
  const rd = frame('Radii', 'VERTICAL', 'space/stack');
  dims.appendChild(rd);
  await sectionTitle(rd, 'Radii', 'radius/* — nested corners are concentric: outer = inner + gap.');
  const rrow = frame('Swatches', 'HORIZONTAL', 'space/section', 'MIN');
  rd.appendChild(rrow);
  for (const d of DATA.dims.filter(x => x.name.startsWith('radius/') && x.value < 100)) {
    const chip = frame(d.name, 'VERTICAL', 'space/inline');
    rrow.appendChild(chip);
    const sq = figma.createRectangle();
    sq.resize(64, 64); radius(sq, d.name);
    sq.fills = [paint('surface/container')]; sq.strokes = [paint('border/strong')]; sq.strokeWeight = 1;
    chip.appendChild(sq);
    chip.appendChild(await text(`${d.name} · ${d.value}`, 'caption', 'text/secondary'));
  }
}
async function paletteNotes(b) {
  const n = frame('How the palette is built', 'VERTICAL', 'space/inline');
  b.appendChild(n);
  fixedWidth(n, 960);
  await para(n, 'How the palette is built', 'heading', 'text/primary');
  const lines = [
    'Five families — gray, blue, green, red, amber. Each has two ramps of 12 steps: one for the light theme, one for the dark. Two ramps, because a dark theme is not an inverted light one: its backgrounds need small steps in the darks, the light theme needs them in the lights.',
    'The step number says what a colour is for, the same in both themes: 1–2 backgrounds · 3–5 fills of components · 6–8 borders and tracks · 9–10 solid colour · 11–12 text. So most roles point at the same step in both themes: surface/page = gray 1, text/primary = gray 12, brand/fill = blue 9.',
    'Anchors (●) are the colours the screen already used: dark greys picked from the visual reference, green and red tuned for contrast. They keep their exact value. The other steps are built in OKLCH between the anchors along one lightness curve per theme, so every ramp is complete and evenly spaced.',
    'Exceptions, on purpose: surface/raised is gray 3 in dark but gray 1 (white) in light — cards are lighter than the tray in both themes. In dark, positive text uses green 9: the solid green already passes text contrast. In light, the warning dot uses amber 11: solid amber is too pale on white.',
    'Overlays (hover, pressed, tag) use the alpha ramps — black on light, white on dark — so they work on any surface. Every text pair passes 4.5:1, every graphic 3:1, checked by the generator script.',
    V.darkColor ? 'Themes: this Figma plan allows one mode per collection, so Light and Dark are two collections with identical role names (Semantic · Light, Semantic · Dark). On a paid plan the plugin builds one collection with Light and Dark side by side.' : 'Themes: one collection, modes Light and Dark side by side.',
  ];
  for (const l of lines) await para(n, l, 'body', 'text/secondary');
}
function fixedWidthRow(f, w) { f.resize(w, Math.max(f.height, 10)); f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'AUTO'; }

// ── 8. read me ──
async function buildReadme(b) {
  const col1 = frame('Text', 'VERTICAL', 'space/section');
  b.appendChild(col1);
  fixedWidth(col1, 760);
  const blocks = [
    ['How this file is built', [
      'The redesign was built in code first (an HTML prototype), then generated into this file by a plugin that reads the same tokens. So the file and the prototype cannot drift apart.',
      'A class in code is a component here; a data-* attribute is a variant property, with the same name and values (data-size="lg" → size = lg).',
    ]],
    ['Tokens — two tiers', [
      'Primitives: colour ramps of 12 steps per family and theme, alpha ramps, the spacing scale. Hidden from the pickers. The step number says what a colour is for (details on Colours).',
      'Semantic roles (surface, border, text, graphic, feedback, brand): what components use. Light and Dark values. ' + (V.darkColor ? 'On this plan a collection has one mode, so the themes are two collections: Semantic · Light and Semantic · Dark.' : 'One collection, modes Light and Dark.'),
      'Dimensions: spacing, radii and sizes, each pointing at a step of the scale. Every variable shows its CSS name in Dev Mode.',
    ]],
    ['What is where', [
      'Read me, Colours, Typography, Spacing and Components — the design system (one page with sections where the plan limits pages). TO-BE — the redesigned screen, built from these components.',
      'Colours — how the palette is built, colour roles in both themes, the ramps. Typography — text styles. Spacing — spacing and radii.',
      'Components — each component with its variants on auto layout and a documentation card next to it.',
      'Components carry a neutral “Label”; the real texts live in the screen.',
    ]],
    ['Rules worth knowing', [
      'Borders: surfaces are separated by fill, not by lines; controls have a border, labels do not.',
      'Bar corners: rounded only where a scale or value ends; square at zero and where parts meet.',
      'Nested corners are concentric: outer radius = inner radius + the gap.',
      'Colour carries meaning: green and red only for money, blue for the interface.',
    ]],
  ];
  for (const [h, ps] of blocks) {
    const s = frame(h, 'VERTICAL', 'space/inline');
    col1.appendChild(s); s.layoutSizingHorizontal = 'FILL';
    await para(s, h, 'heading', 'text/primary');
    for (const p of ps) await para(s, p, 'body', 'text/secondary');
  }
  await para(col1, `Generated from ${DATA.source} · ${DATA.built}`, 'caption', 'text/muted');
}

// ── run ──
async function run() {
  const styles = await interStyles();
  FONTS = styles;
  V = await buildVariables();
  V.prim = await variablesOf(await collection('Primitives'));
  T = await buildTextStyles(styles);
  const A = await areas();

  await figma.setCurrentPageAsync(A['Components'].page);
  const comp = await board(A['Components'], 'Components', 'One block per component: what it is for, every variant with its values, the main component, and how to use it. Neutral labels; the real texts are set on the screen.');
  const tag = await buildTag();
  const [track, item] = await buildSegmented();
  SETS['Tag'] = tag; SETS['Segmented Control'] = track; SETS['Segmented Control / Item'] = item;
  cssIndex();
  const generated = DATA.screen ? await buildGeneratedSets() : [];
  const total = await componentGroups(comp, [tag, track, item].concat(generated));
  // containers: content differs at every use, so they are frames on the screen — documented here
  const cnames = ['Stat Block', 'Stat Group', 'Disclosure', 'Breakdown Table'].filter(n => DOCS[n]);
  const cont = await groupPanel(comp, total, total, 'Containers', 'Auto-layout frames on the screen, not instances: what is inside differs at every use.', cnames.length + ' frames');
  for (const n of cnames) cont.appendChild(await docCard(n));

  const boards = {};
  for (const [area, title, sub, build] of [
    ['Colours', 'Colours', 'Generated from the variables in this file — roles first, then the ramps they point at.', buildColours],
    ['Typography', 'Typography', 'Text styles — Inter for text, JetBrains Mono for numbers (hero, numeric), tabular digits. Names match the CSS tokens (--type-*).', buildTypography],
    ['Spacing', 'Spacing & radii', 'Dimensions — each points at a step of the scale.', buildSpacing],
  ]) {
    await figma.setCurrentPageAsync(A[area].page);
    boards[area] = await board(A[area], title, sub);
    await build(boards[area]);
  }

  await figma.setCurrentPageAsync(A['Read me'].page);
  const rm = await board(A['Read me'], 'Goodface · Performance Summary', 'Design system and redesign of the Summary tab — how to read this file.');
  await buildReadme(rm);

  let x = 0;
  x = place(A['Read me'], rm, x);
  for (const a of ['Colours', 'Typography', 'Spacing']) x = place(A[a], boards[a], x);
  place(A['Components'], comp, x);
  log.push(`Components: ${3 + generated.length} sets with docs (${generated.map(g => g.name).join(', ')})`);
  if (DATA.screen) {
    const sp = await screenPage();
    const host = sp || A['Components'].page;
    await figma.setCurrentPageAsync(host);
    const frames = await buildScreen(sp || A['Components'].parent);
    figma.viewport.scrollAndZoomIntoView(frames);
    log.push('TO-BE: light and dark, ' + DATA.screen.instances + ' instances');
    if (CHECK) log.push('Check: ' + CHECK.map(([t, r]) => `${t} ${r.n - r.rows.length}/${r.n} match, layers differ in ${r.rows.filter(x => x.worst === 999).length}`).join('; ') + ' (report above the screens)');
  } else {
    await figma.setCurrentPageAsync(A['Components'].page);
    figma.viewport.scrollAndZoomIntoView([A['Components'].section || comp]);
  }
  if (unknownTokens.size) log.push('Tokens not in the variables (raw values used): ' + [...unknownTokens].join(', '));
  log.push('Data: ' + DATA.source + ' · built ' + DATA.built);
  return log;
}

// G-125: on the free plan dark is a rebinding of each layer, not a mode — a variant switched by hand in a dark frame
// comes from the (light) main component. This command turns the selected layers dark again; on a paid plan it sets the mode.
async function applyDarkSelection() {
  const sel = figma.currentPage.selection;
  if (!sel.length) throw new Error('Select the frames or instances to turn dark first');
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const sem = cols.find(c => c.name === 'Semantic');
  const darkMode = sem && (sem.modes.find(m => m.name === 'Dark') || {}).modeId;
  if (sem && darkMode) { for (const n of sel) n.setExplicitVariableModeForCollection(sem, darkMode); return [`Dark mode set on ${sel.length} layer(s)`]; }
  const light = cols.find(c => c.name === 'Semantic · Light'), dark = cols.find(c => c.name === 'Semantic · Dark');
  if (!light || !dark) throw new Error('No Semantic · Light / Semantic · Dark collections — run «Build everything» first');
  V = { color: await variablesOf(light), darkColor: await variablesOf(dark) };
  for (const n of sel) await rebindDark(n);
  return [`Dark theme applied to ${sel.length} selected layer(s) and everything inside`];
}

(figma.command === 'dark' ? applyDarkSelection() : figma.command === 'submission' ? addSubmission() : figma.command === 'loss' ? addLossState() : run()).then(
  lines => { console.log(lines.join('\n')); figma.closePlugin('✓ Goodface DS — ' + lines.filter(l => !l.startsWith('Data')).join(' · ')); },
  err => { console.error(err); figma.closePlugin('✕ ' + (err && err.message ? err.message : String(err))); }
);
