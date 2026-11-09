// G-119: turns the screen description (screen-<theme>.json from extract-screen.js) into what the plugin builds:
//   masters — one component per (component, variant): the union of every occurrence's parts (an optional part = boolean
//             «Show …» property, hidden where an occurrence lacks it), neutral texts («Label», «Value»);
//   screen  — the tree with every component occurrence replaced by an instance + overrides (text, bar length, hidden
//             part, nested variant). Containers (Stat Block, Stat Group, Disclosure, Breakdown Table) stay frames.
// Tag and Segmented Control are drawn by hand in the plugin (they have states the screen does not show: hover, lg);
// their occurrences become instances of those sets.
const HAND = ['Tag', 'Segmented Control', 'Segmented Control / Item'];
// value of a variant property where an occurrence does not set it (the component list)
const DEFAULTS = { kind: 'row', layout: 'inline', muted: 'false', tone: 'neutral', size: 'md', sample: 'ok', bar: 'shown', state: 'default', sort: 'none' };

const clone = o => JSON.parse(JSON.stringify(o));
const tokenOf = n => n.t === 'inst' || n.comp ? 'C:' + n.comp : n.t + ':' + (n.cls[0] || n.name);
// longest common subsequence alignment of two child lists by token → pairs [i|null, j|null] in order
function align(a, b) {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = tokenOf(a[i]) === tokenOf(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (tokenOf(a[i]) === tokenOf(b[j])) out.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) out.push([i++, null]);
    else out.push([null, j++]);
  }
  while (i < n) out.push([i++, null]);
  while (j < m) out.push([null, j++]);
  return out;
}
const placeholder = n => {
  const c = (n.cls && n.cls[0]) || '';
  const part = c.includes('__') ? c.split('__').pop() : (n.name === 'text' ? 'text' : c);
  return part ? part.replace(/-/g, ' ').replace(/^\w/, x => x.toUpperCase()) : 'Text';
};
const variantKey = (comp, v) => comp + ' | ' + Object.keys(v).sort().map(k => k + '=' + v[k]).join(', ');

// the code's boxes, for the plugin's check: name, kind, position and size of every element
const geometry = n => ({ t: n.t, name: n.name, cls0: (n.cls && n.cls[0]) || '', comp: n.comp || null, x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10, w: Math.round(n.w * 10) / 10, h: Math.round(n.h * 10) / 10, chars: n.t === 'text' ? n.text.chars : undefined, kids: (n.kids || []).map(geometry) });
// extra (G-173): another page (the «in the red» state) drawn with THESE masters, without changing them —
// for a file whose components were built from `screen`; a part the masters cannot show becomes a plain frame
// opts.loss (G-174): { light, dark } — the «in the red» page; its components join the masters (KPI Card hero · negative)
// G-175: a child that fills an axis its parent hugs (CSS stretch inside a column that grows with its content) collapses in Figma
// (the Expanded screen came out 570 px short) → it hugs too, which is what the browser shows
const fixFill = n => {
  for (const k of n.kids || []) {
    if (n.dir === 'V' && n.sizeV === 'HUG' && k.sizeV === 'FILL') k.sizeV = 'HUG';
    if (n.dir === 'H' && n.sizeH === 'HUG' && k.sizeH === 'FILL') k.sizeH = 'HUG';
    fixFill(k);
  }
  return n;
};
const fixAll = s => { if (!s) return; fixFill(s.tree); (s.screens || []).forEach(x => fixFill(x.tree)); (s.blocks || []).forEach(b => { fixFill(b.tree); (b.overlays || []).forEach(o => fixFill(o.tree)); }); (s.states || []).forEach(x => fixFill(x.tree)); (s.extras || []).forEach(fixFill); };
function build(screen, dark, extra, opts) {
  opts = opts || {};
  [screen, dark, extra, opts.loss && opts.loss.light, opts.loss && opts.loss.dark].forEach(fixAll);
  const occ = new Map(); // key → { comp, variant, nodes: [] }
  const walk = n => {
    if (n.comp && !HAND.includes(n.comp)) {
      const k = variantKey(n.comp, n.variant);
      if (!occ.has(k)) occ.set(k, { comp: n.comp, variant: n.variant, nodes: [] });
      occ.get(k).nodes.push(n);
    }
    (n.kids || []).forEach(walk);
  };
  walk(screen.tree);
  (screen.extras || []).forEach(walk); // states the screen does not show (the open tip) — masters only
  (screen.states || []).forEach(s => walk(s.tree)); // Costs & activity open: its rows are variants the closed screen lacks
  (screen.screens || []).forEach(s => walk(s.tree)); // G-174: the Expanded screen
  (screen.blocks || []).forEach(b => { walk(b.tree); (b.overlays || []).forEach(o => walk(o.tree)); }); // G-174: states of single blocks
  if (opts.loss) walk(opts.loss.light.tree);

  // master spec: nested components become instance placeholders (their own master shows inside)
  const asMaster = (n, top) => {
    if (!top && n.comp) return { t: 'inst', comp: n.comp, variant: n.variant, name: n.name, cls: n.cls, sizeH: n.sizeH, sizeV: n.sizeV, w: n.w, h: n.h, wVar: n.wVar, margin: n.margin, seen: 1 };
    const m = Object.assign({}, n, { seen: 1 });
    delete m.comp; delete m.variant; delete m.frame;
    if (m.kids) m.kids = m.kids.map(k => asMaster(k, false));
    return m;
  };
  const merge = (m, o) => { // o: an occurrence subtree already in master form
    m.seen++;
    if (!m.kids || !o.kids) return;
    const pairs = align(m.kids, o.kids);
    const kids = [];
    for (const [i, j] of pairs) {
      if (i != null && j != null) { merge(m.kids[i], o.kids[j]); kids.push(m.kids[i]); }
      else if (i != null) kids.push(m.kids[i]);
      else kids.push(o.kids[j]); // a part only this occurrence has (seen = 1)
    }
    m.kids = kids;
  };
  const masters = [];
  for (const [key, g] of occ) {
    const spec = asMaster(clone(g.nodes[0]), true);
    for (const o of g.nodes.slice(1)) merge(spec, asMaster(clone(o), true));
    const N = g.nodes.length;
    // optional parts and neutral texts
    const names = {}, shows = {};
    const finish = (n, depth, parentSeen) => {
      if (depth > 0 && n.seen < parentSeen) n.optional = true; // only the top part that comes and goes, not its insides
      const seen = n.seen; delete n.seen;
      if (n.t === 'text') {
        let p = placeholder(n); names[p] = (names[p] || 0) + 1; if (names[p] > 1) p += ' ' + names[p];
        n.prop = p; n.text = Object.assign({}, n.text, { chars: p }); delete n.text.ranges;
      }
      if (n.optional) { let sp = 'Show ' + (n.prop || placeholder(n)); shows[sp] = (shows[sp] || 0) + 1; if (shows[sp] > 1) sp += ' ' + shows[sp]; n.showProp = sp; }
      if (n.t !== 'inst') (n.kids || []).forEach(k => finish(k, depth + 1, seen));
    };
    finish(spec, 0, N);
    masters.push({ key, comp: g.comp, variant: g.variant, count: N, spec });
  }
  // variant properties per component: the union of attribute names, defaults where an occurrence omits one
  const sets = {};
  for (const m of masters) (sets[m.comp] = sets[m.comp] || { comp: m.comp, props: new Set(), masters: [] }).masters.push(m), Object.keys(m.variant).forEach(p => sets[m.comp].props.add(p));
  for (const s of Object.values(sets)) {
    s.props = [...s.props].sort();
    for (const m of s.masters) {
      m.props = {};
      for (const p of s.props) m.props[p] = m.variant[p] != null ? m.variant[p] : (DEFAULTS[p] || 'default');
      m.name = s.props.length ? s.props.map(p => `${p}=${m.props[p]}`).join(', ') : s.comp;
    }
  }
  const propsFor = (comp, variant) => {
    if (HAND.includes(comp)) return comp === 'Tag' ? { tone: 'neutral' } : comp === 'Segmented Control' ? { size: variant.size || 'sm' } : { size: variant.size || 'sm', state: variant.state || 'default' };
    const s = sets[comp]; const out = {};
    for (const p of s.props) out[p] = variant[p] != null ? variant[p] : (DEFAULTS[p] || 'default');
    return out;
  };
  const masterOf = (comp, variant) => masters.find(m => m.comp === comp && m.key === variantKey(comp, variant));

  // overrides: walk the occurrence against the master it will show
  const overrides = (occNode, master, path, out) => {
    if (!master.kids || !occNode.kids) return;
    const mk = master.kids, ok = occNode.kids.map(k => k.comp ? Object.assign({}, k, { t: 'inst' }) : k);
    const pairs = align(mk, ok);
    for (const [i, j] of pairs) {
      if (i == null) { out.lost = (out.lost || 0) + 1; continue; } // structure the master lacks — should not happen
      const p = path.concat(i), m = mk[i];
      if (j == null) { out.push({ path: p, hide: true }); continue; }
      const o = ok[j];
      if (m.t === 'inst') {
        const v = propsFor(o.comp, o.variant);
        out.push({ path: p, variant: v });
        if (HAND.includes(o.comp)) handOverrides(o, p, out);
        else if (masterOf(o.comp, o.variant)) overrides(o, masterOf(o.comp, o.variant).spec, p, out);
        else out.lost = (out.lost || 0) + 1; // a variant the masters lack (only in extra)
        if (m.sizeH === 'FIXED' && Math.abs(m.w - o.w) > 0.5) out.push({ path: p, w: o.w });
        continue;
      }
      if (m.t === 'svg') { // a curve is data: another shape cannot be an override (icons: same shape, colour by theme — compared by geometry only)
        const geo = x => (String(x.svg || '').match(/\s(points|d|x|y|x1|x2|y1|y2|cx|cy|r|rx|ry|width|height)="[^"]*"/g) || []).join('|');
        if (m.name === 'Line' && geo(m) !== geo(o)) out.lost = (out.lost || 0) + 1;
        continue;
      }
      if (m.t === 'text') {
        const e = { path: p, chars: o.text.chars };
        if (o.text.ranges) e.ranges = o.text.ranges;
        if (JSON.stringify(o.text.color) !== JSON.stringify(m.text.color)) e.color = o.text.color;
        out.push(e);
        continue;
      }
      if (m.t === 'box') {
        if (JSON.stringify(o.fill || null) !== JSON.stringify(m.fill || null)) out.push({ path: p, fill: o.fill || null });
        if (m.sizeH === 'FIXED' && Math.abs(m.w - o.w) > 0.5) out.push({ path: p, w: o.w });
        if (m.sizeV === 'FIXED' && Math.abs(m.h - o.h) > 0.5) out.push({ path: p, h: o.h });
        overrides(o, m, p, out);
      }
    }
  };
  // hand-made sets: Tag → its label; Segmented Control → each item's label and state
  const handOverrides = (o, p, out) => {
    const texts = []; const w = n => { if (n.t === 'text') texts.push(n.text.chars); (n.kids || []).forEach(w); }; w(o);
    if (o.comp === 'Tag') out.push({ path: p.concat(0), chars: texts[0] });
    if (o.comp === 'Segmented Control') (o.kids || []).forEach((it, i) => {
      if (i === 3) out.push({ path: p.concat(i), show: true });
      out.push({ path: p.concat(i), variant: { size: o.variant.size || 'sm', state: it.variant.state || 'default' } });
      const tt = []; const w2 = n => { if (n.t === 'text') tt.push(n.text.chars); (n.kids || []).forEach(w2); }; w2(it);
      out.push({ path: p.concat(i, 0), chars: tt[0] });
    });
  };
  // screen: containers and plain boxes stay frames; components become instances
  const toScreen = n => {
    if (n.comp && !HAND.includes(n.comp) && !masterOf(n.comp, n.variant)) { FELL.push(n.comp + ' ' + JSON.stringify(n.variant)); n = Object.assign({}, n, { comp: null }); } // a variant only the dark capture has → a frame
    if (n.comp) {
      const ov = [];
      if (HAND.includes(n.comp)) handOverrides(n, [], ov);
      else overrides(n, masterOf(n.comp, n.variant).spec, [], ov);
      if (ov.lost || ov.some(o => o.w != null || o.h != null)) { FELL.push(n.comp); return toScreen(Object.assign({}, n, { comp: null, frame: n.comp })); } // structure the master lacks, or bars / a curve that are data → a frame named after the component
      return { t: 'inst', comp: n.comp, props: propsFor(n.comp, n.variant), overrides: ov, name: n.name, sizeH: n.sizeH, sizeV: n.sizeV, w: n.w, h: n.h, wVar: n.wVar, margin: n.margin }; // a component keeps its outer margin (a wrapper in Figma)
    }
    const c = Object.assign({}, n);
    if (c.kids) c.kids = c.kids.map(toScreen);
    return c;
  };
  const FELL = [];
  const tree = toScreen(screen.tree);
  FELL.length = 0;
  const treeDark = dark ? toScreen(dark.tree) : null;
  const states = (screen.states || []).map((s, i) => ({ name: s.name, light: toScreen(s.tree), dark: dark && dark.states && dark.states[i] ? toScreen(dark.states[i].tree) : null }));
  // masters' nested instances need their variant props too
  const fixInst = n => { if (n.t === 'inst' && !n.props) n.props = propsFor(n.comp, n.variant); (n.kids || []).forEach(fixInst); };
  masters.forEach(m => fixInst(m.spec));
  // build order: a component before the components that contain it
  const deps = c => { const d = new Set(); const w = n => { if (n.t === 'inst') d.add(n.comp); (n.kids || []).forEach(w); }; sets[c].masters.forEach(m => w(m.spec)); return [...d].filter(x => !HAND.includes(x)); };
  const order = []; const visit = c => { if (order.includes(c)) return; deps(c).forEach(visit); order.push(c); };
  Object.keys(sets).forEach(visit);
  return {
    sets: order.map(c => ({ comp: c, props: sets[c].props, masters: sets[c].masters.map(m => ({ name: m.name, props: m.props, count: m.count, spec: m.spec })) })),
    screens: (screen.screens || []).map((x, i) => ({ name: x.name, light: toScreen(x.tree), dark: dark && dark.screens && dark.screens[i] ? toScreen(dark.screens[i].tree) : null, raw: geometry(x.tree), marks: x.marks || {}, height: x.height })),
    blocks: (screen.blocks || []).map((b, i) => { const db = dark && dark.blocks && dark.blocks[i]; return { name: b.name, at: b.at, w: b.w, light: toScreen(b.tree), dark: db ? toScreen(db.tree) : null,
      overlays: (b.overlays || []).map((o, j) => ({ x: o.x, y: o.y, w: o.w, h: o.h, light: toScreen(o.tree), dark: db && db.overlays[j] ? toScreen(db.overlays[j].tree) : null })) }; }),
    marks: screen.marks || {},
    loss: opts.loss ? { light: toScreen(opts.loss.light.tree), dark: opts.loss.dark ? toScreen(opts.loss.dark.tree) : null, raw: geometry(opts.loss.light.tree), height: opts.loss.light.height } : null,
    extra: extra ? (() => { FELL.length = 0; const t = toScreen(extra.tree); return { tree: t, raw: geometry(extra.tree), width: extra.width, frames: FELL.slice() }; })() : null,
    raw: geometry(screen.tree), rawDark: dark ? geometry(dark.tree) : null, tree, treeDark, states, width: screen.width, theme: screen.theme, source: screen.source,
  };
}
module.exports = { build, HAND };

if (require.main === module) { // node screen-model.js → a summary, for checking without Figma
  const s = require('./screen-light.json');
  const r = build(s);
  for (const set of r.sets) console.log(`${set.comp.padEnd(16)} props: ${set.props.join(', ').padEnd(22)} variants: ${set.masters.map(m => m.name + ' (×' + m.count + ')').join(' · ')}`);
  let inst = 0, ov = 0, lost = 0, hide = 0; const w = n => { if (n.t === 'inst') { inst++; ov += n.overrides.length; lost += n.overrides.lost || 0; hide += n.overrides.filter(o => o.hide).length; } (n.kids || []).forEach(w); }; w(r.tree);
  const opt = []; r.sets.forEach(s => s.masters.forEach(m => { const w2 = n => { if (n.optional) opt.push(s.comp + ': ' + n.showProp); if (n.t !== 'inst') (n.kids || []).forEach(w2); }; w2(m.spec); }));
  console.log(`screen: ${inst} instances · ${ov} overrides · ${hide} hidden parts · unmatched ${lost}`);
  console.log('optional parts: ' + opt.join(' · '));
}
