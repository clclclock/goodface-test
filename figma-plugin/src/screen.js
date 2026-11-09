// ── 9. components and the TO-BE screen from the prototype (G-119) ──
// DATA.screen comes from screen-model.js: sets of masters (specs) and the screen tree of frames + instances with overrides.
let CSSV = {}, FONTS = {}, CHECK = null;
const unknownTokens = new Set();
function cssIndex() {
  CSSV = {};
  for (const s of DATA.semantic) CSSV[s.css] = { color: V.color[s.name] };
  for (const d of DATA.dims) CSSV[d.css] = { float: V.dim[d.name] };
  for (const n of DATA.numbers) CSSV[n.css] = { float: V.prim[n.name] };
  for (const c of DATA.colors) CSSV[c.css] = { color: V.prim[c.name] };
  for (const t of DATA.text) CSSV[t.css] = { style: T[t.name] };
}
const TRANSPARENT = () => ({ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0 });
function specPaint(p) {
  if (!p) return null;
  if (p.var && CSSV[p.var] && CSSV[p.var].color) return paint(null, CSSV[p.var].color);
  if (p.var) unknownTokens.add(p.var);
  const c = p.rgba || [0, 0, 0, 1];
  return { type: 'SOLID', color: { r: c[0], g: c[1], b: c[2] }, opacity: c[3] };
}
function bindNum(node, field, tok, v) {
  const x = tok && CSSV[tok] && CSSV[tok].float;
  if (x) node.setBoundVariable(field, x);
  else { if (tok) unknownTokens.add(tok); node[field] = v || 0; }
}
const famOf = f => (f && FONTS[f]) ? f : 'Inter'; // a family the plugin loaded, else Inter
const weightStyle = (w, f) => { const F = FONTS[famOf(f)]; return w >= 700 && F.Bold ? F.Bold : w >= 600 ? F['Semi Bold'] : w >= 500 ? F.Medium : F.Regular; };

const styleSpec = name => DATA.text.find(x => x.name === name);
const fits = (name, size, weight, line) => { const st = styleSpec(name); return st && (!size || Math.abs(st.size - size) < 0.1) && (!weight || st.weight === weight) && (!line || Math.abs(st.line - line) < 0.5); };
async function textRanges(t, ranges) {
  for (const r of ranges || []) {
    if (r.e <= r.s) continue;
    if (r.style && T[r.style] && fits(r.style, r.size, r.weight, r.line)) await t.setRangeTextStyleIdAsync(r.s, r.e, T[r.style].id);
    else if (r.weight) {
      t.setRangeFontName(r.s, r.e, { family: famOf(r.family), style: weightStyle(r.weight, r.family) });
      if (r.size) t.setRangeFontSize(r.s, r.e, r.size);
    }
    const p = specPaint(r.color); if (p) t.setRangeFills(r.s, r.e, [p]);
  }
}
async function renderText(s) {
  const t = figma.createText();
  const st = s.text.style && T[s.text.style];
  if (st && fits(s.text.style, s.text.size, s.text.weight, s.text.line)) await t.setTextStyleIdAsync(st.id);
  else { // the CSS sets its own size or weight here — keep exactly that (the style it starts from is in the layer name)
    t.fontName = { family: famOf(s.text.family), style: weightStyle(s.text.weight, s.text.family) };
    t.fontSize = s.text.size || 14;
    if (s.text.line) t.lineHeight = { unit: 'PIXELS', value: s.text.line };
    const base = st && styleSpec(s.text.style);
    if (base && base.tracking) t.letterSpacing = { unit: 'PERCENT', value: base.tracking };
    if (s.text.style) t.setPluginData('style', s.text.style);
  }
  t.characters = s.text.chars || ' ';
  t.fills = [specPaint(s.text.color) || paint('text/primary')];
  if (s.text.upper && !(st && st.textCase === 'UPPER')) t.textCase = 'UPPER';
  if (s.text.track && DATA.tracking[s.text.track] != null) t.letterSpacing = { unit: 'PERCENT', value: DATA.tracking[s.text.track] };
  t.textAlignHorizontal = s.text.align || 'LEFT';
  await textRanges(t, s.text.ranges);
  t.name = s.prop || s.name;
  return t;
}
function renderSvg(s) {
  let svg = s.svg;
  if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const n = figma.createNodeFromSvg(svg);
  n.name = s.name === 'Line' ? 'Line' : 'Icon';
  const vectors = n.findAll(x => ['VECTOR', 'RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'LINE', 'BOOLEAN_OPERATION'].includes(x.type));
  if (s.shapes && vectors.length === s.shapes.length) { // shape by shape, in document order: logo = brand blue, icon = its text colour
    vectors.forEach((v, i) => {
      const sh = s.shapes[i];
      if ('fills' in v) v.fills = sh.fill ? [specPaint(sh.fill)] : [];
      if ('strokes' in v) v.strokes = sh.stroke ? [specPaint(sh.stroke)] : [];
    });
  } else {
    const p = specPaint(s.color) || paint('text/secondary');
    for (const v of vectors) {
      if (v.strokes && v.strokes.length) v.strokes = [p];
      if (v.fills && v.fills.length) v.fills = [p];
    }
    if (s.shapes) log.push(`icon «${s.name}»: ${vectors.length} shapes in Figma vs ${s.shapes.length} in code — one colour used`);
  }
  n.fills = [];
  return n;
}
const SETS = {}; // component name → ComponentSetNode | ComponentNode
function variantOf(comp, props) {
  const set = SETS[comp];
  if (!set) throw new Error('no component ' + comp);
  if (set.type === 'COMPONENT') return set;
  const want = Object.entries(props || {});
  const v = set.children.find(c => want.every(([k, val]) => (c.variantProperties || {})[k] === val));
  if (!v) throw new Error(`${comp}: no variant ${JSON.stringify(props)}`);
  return v;
}
// G-147: every size override (bar lengths inside Breakdown Row) is read back after the whole screen is laid out —
// the first run showed the bars at the main component's lengths
const SIZED = [];
async function applyOverride(inst, o) {
  let n = inst;
  const through = x => { while (x && x.type === 'FRAME' && x.name === 'margin' && x.children.length === 1) x = x.children[0]; return x; }; // a margin wrapper is not in the paths
  for (const i of o.path) { n = through(n.children && n.children[i]); if (!n) throw new Error(`${inst.name}: no layer at ${o.path.join('.')}`); }
  if (o.hide) { n.visible = false; return; }
  if (o.show) n.visible = true; // a part the master keeps hidden (the 4th Segmented item)
  if (o.variant) n.setProperties(o.variant);
  if (o.chars != null) {
    n.characters = o.chars || ' ';
    if (o.color) n.fills = [specPaint(o.color)];
    await textRanges(n, o.ranges);
  }
  if (o.fill !== undefined) n.fills = o.fill ? [specPaint(o.fill)] : [];
  if (o.w != null) n.resize(Math.max(o.w, 0.01), n.height);
  if (o.h != null) n.resize(n.width, Math.max(o.h, 0.01));
  if (o.w != null || o.h != null) SIZED.push({ inst: inst.name, path: o.path.join('.'), n, w: o.w, h: o.h });
}
async function renderInst(s) {
  const inst = variantOf(s.comp, s.props).createInstance();
  inst.name = s.comp;
  for (const o of s.overrides || []) await applyOverride(inst, o);
  return inst;
}
function applySizing(n, s) {
  if (n.getPluginData && n.getPluginData('margin')) { // the wrapper: hugs a fixed child, fills where the child fills
    const m = x => x === 'FIXED' ? 'HUG' : x;
    s = Object.assign({}, s, { sizeH: m(s.sizeH), sizeV: m(s.sizeV), wVar: null, hVar: null, w: s.w + s.margin[1].v + s.margin[3].v, h: s.h + s.margin[0].v + s.margin[2].v });
  }
  const isAuto = x => x.layoutMode && x.layoutMode !== 'NONE';
  const hugOk = n.type === 'TEXT' || isAuto(n) || n.type === 'INSTANCE';
  const mode = m => (m === 'HUG' && !hugOk) ? 'FIXED' : (m || 'HUG');
  if (n.type === 'TEXT') n.textAutoResize = s.sizeH === 'HUG' ? 'WIDTH_AND_HEIGHT' : 'HEIGHT';
  const h = mode(s.sizeH), v = mode(s.sizeV);
  const want = [h === 'FIXED' ? Math.max(s.w, 0.01) : n.width, v === 'FIXED' ? Math.max(s.h, 0.01) : n.height];
  if ((h === 'FIXED' || v === 'FIXED') && !(n.type === 'INSTANCE' && Math.abs(want[0] - n.width) < 0.5 && Math.abs(want[1] - n.height) < 0.5)) n.resize(want[0], want[1]);
  n.layoutSizingHorizontal = h;
  if (!(n.type === 'TEXT' && v === 'FILL')) n.layoutSizingVertical = v;
  if (s.wVar && h === 'FIXED' && CSSV[s.wVar] && CSSV[s.wVar].float) n.setBoundVariable('width', CSSV[s.wVar].float);
  if (s.hVar && v === 'FIXED' && CSSV[s.hVar] && CSSV[s.hVar].float) n.setBoundVariable('height', CSSV[s.hVar].float);
}
async function renderSpec(s, isMaster) {
  if (s.margin && !isMaster) {
    const inner = await renderSpec(Object.assign({}, s, { margin: null }), false);
    const w = figma.createFrame();
    w.name = 'margin';
    w.layoutMode = 'VERTICAL'; w.fills = []; w.clipsContent = false;
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((k, i) => bindNum(w, k, s.margin[i].var, s.margin[i].v));
    w.primaryAxisSizingMode = 'AUTO'; w.counterAxisSizingMode = 'AUTO';
    w.appendChild(inner);
    applySizing(inner, Object.assign({}, s, { margin: null }));
    w.setPluginData('margin', '1');
    return w;
  }
  if (s.t === 'text') return renderText(s);
  if (s.t === 'svg') return renderSvg(s);
  if (s.t === 'inst') return renderInst(s);
  const f = isMaster ? figma.createComponent() : figma.createFrame();
  f.name = s.frame || s.name;
  f.layoutMode = s.dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
  f.fills = s.fill ? [specPaint(s.fill)] : [];
  bindNum(f, 'itemSpacing', s.gap && s.gap.var, s.gap ? s.gap.v : 0);
  ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((k, i) => { if (s.pad) bindNum(f, k, s.pad[i].var, s.pad[i].v); });
  // space-between + a child that fills the main axis: CSS keeps the gap (no free space to spread), Figma's «Auto» spacing drops it to 0
  // → plain packing with the gap, which is what the browser shows (G-147: Stat Row labels 32 px too wide, values shifted 16 px)
  const fillsMain = (s.kids || []).some(k => (s.dir === 'H' ? k.sizeH : k.sizeV) === 'FILL');
  f.primaryAxisAlignItems = s.jc === 'SPACE_BETWEEN' && fillsMain ? 'MIN' : ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'].includes(s.jc) ? s.jc : 'MIN';
  f.counterAxisAlignItems = s.ai === 'BASELINE' && f.layoutMode !== 'HORIZONTAL' ? 'MIN' : ['MIN', 'CENTER', 'MAX', 'BASELINE'].includes(s.ai) ? s.ai : 'MIN';
  if (s.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = s.cgap ? s.cgap.v : 0; }
  if (s.stroke) {
    f.strokes = [s.stroke.paint ? specPaint(s.stroke.paint) : TRANSPARENT()];
    f.strokeAlign = 'INSIDE';
    const [t, r, b, l] = s.stroke.w;
    if (t === r && r === b && b === l) bindNum(f, 'strokeWeight', s.stroke.wVar, t);
    else { f.strokeTopWeight = t; f.strokeRightWeight = r; f.strokeBottomWeight = b; f.strokeLeftWeight = l; }
    f.strokesIncludedInLayout = true; // CSS border-box
  }
  if (s.radius) ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].forEach((k, i) => bindNum(f, k, s.radius[i].var, s.radius[i].v));
  f.clipsContent = !!s.clip;
  if (s.op != null) f.opacity = s.op;
  f.resize(Math.max(s.w, 0.01), Math.max(s.h, 0.01));
  f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO';
  for (const k of s.kids || []) {
    const c = await renderSpec(k, false);
    f.appendChild(c);
    applySizing(c, k);
    if (isMaster || k.showProp) c.setPluginData('show', k.showProp || '');
  }
  return f;
}
// a master's own size: hug where it hugs, else its width on the screen
function rootSizing(c, s) {
  c.resize(Math.max(s.w, 1), Math.max(s.h, 1));
  const horiz = c.layoutMode === 'HORIZONTAL';
  const hHug = s.sizeH === 'HUG', vHug = s.sizeV !== 'FIXED' || true; // heights always hug their content
  c.primaryAxisSizingMode = (horiz ? hHug : vHug) ? 'AUTO' : 'FIXED';
  c.counterAxisSizingMode = (horiz ? vHug : hHug) ? 'AUTO' : 'FIXED';
}
// text and boolean properties: «Label», «Value» … and «Show Hint» … linked across variants
function componentProps(owner, variants) {
  const outside = (n, root) => { for (let p = n.parent; p && p !== root; p = p.parent) if (p.type === 'INSTANCE') return false; return true; };
  const texts = {}, shows = {};
  for (const v of variants) {
    for (const t of v.findAll(n => n.type === 'TEXT' && outside(n, v))) (texts[t.name] = texts[t.name] || []).push(t);
    for (const n of v.findAll(n => outside(n, v) && n.getPluginData('show'))) (shows[n.getPluginData('show')] = shows[n.getPluginData('show')] || []).push(n);
  }
  for (const [name, nodes] of Object.entries(texts)) {
    const key = owner.addComponentProperty(name, 'TEXT', nodes[0].characters);
    for (const n of nodes) n.componentPropertyReferences = Object.assign({}, n.componentPropertyReferences, { characters: key });
  }
  for (const [name, nodes] of Object.entries(shows)) {
    const key = owner.addComponentProperty(name, 'BOOLEAN', true);
    for (const n of nodes) n.componentPropertyReferences = Object.assign({}, n.componentPropertyReferences, { visible: key });
  }
}
async function buildGeneratedSets() {
  const out = [];
  for (const set of DATA.screen.sets) {
    const comps = [];
    for (const m of set.masters) {
      const c = await renderSpec(m.spec, true);
      c.name = m.name;
      rootSizing(c, m.spec);
      comps.push(c);
    }
    let node;
    if (!set.props.length) { node = comps[0]; node.name = set.comp; componentProps(node, [node]); }
    else { node = figma.combineAsVariants(comps, figma.currentPage); node.name = set.comp; setLayout(node); componentProps(node, comps); }
    node.description = (DOCS[set.comp] || {}).summary || '';
    SETS[set.comp] = node;
    out.push(node);
  }
  return out;
}
// the screen: a light frame from instances; a dark copy rebound to the dark roles
async function rebindDark(root) {
  if (!V.darkColor) { root.setExplicitVariableModeForCollection(V.semantic, V.darkMode); return; }
  const byId = {};
  for (const [name, v] of Object.entries(V.color)) if (V.darkColor[name]) byId[v.id] = V.darkColor[name];
  const swap = paints => paints.map(p => { const b = p.boundVariables && p.boundVariables.color; return b && byId[b.id] ? figma.variables.setBoundVariableForPaint(p, 'color', byId[b.id]) : p; });
  const nodes = [root].concat(root.findAll(() => true));
  for (const n of nodes) {
    if (n.type === 'TEXT') { for (const seg of n.getStyledTextSegments(['fills'])) n.setRangeFills(seg.start, seg.end, swap(seg.fills)); }
    else if ('fills' in n && Array.isArray(n.fills) && n.fills.length) n.fills = swap(n.fills);
    if ('strokes' in n && Array.isArray(n.strokes) && n.strokes.length) n.strokes = swap(n.strokes);
  }
}
async function buildScreen(parent) {
  for (const n of parent.children.filter(c => /^TO-BE · /.test(c.name))) n.remove();
  const frames = [];
  for (const theme of ['Light', 'Dark']) {
    const wrap = frame(`TO-BE · Performance · Summary · ${theme}`, 'VERTICAL', 0);
    fill(wrap, 'surface/page');
    parent.appendChild(wrap);
    const s = await renderSpec(theme === 'Dark' && DATA.screen.treeDark ? DATA.screen.treeDark : DATA.screen.tree, false);
    wrap.appendChild(s);
    s.resize(DATA.screen.width, s.height);
    s.layoutSizingHorizontal = 'FIXED'; s.layoutSizingVertical = 'HUG';
    if (theme === 'Dark') await rebindDark(wrap);
    frames.push(wrap);
  }
  frames[1].x = frames[0].x + frames[0].width + 120; frames[1].y = frames[0].y;
  // the plugin checks its own result against the code (G-124)
  const sized = sizePass();
  const results = [['Light', selfCheck(frames[0], DATA.screen.raw, 2)]];
  if (DATA.screen.rawDark) results.push(['Dark', selfCheck(frames[1], DATA.screen.rawDark, 2)]);
  await checkReport(parent, results, sized);
  CHECK = results;
  // states the screen does not show (Costs & activity open) — a column under each screen, same theme
  const nextY = [frames[0].y + frames[0].height + 120, frames[1].y + frames[1].height + 120];
  for (const st of DATA.screen.states || []) {
    for (const [i, theme] of [[0, 'Light'], [1, 'Dark']]) {
      const spec = theme === 'Dark' ? (st.dark || st.light) : st.light;
      const wrap = frame(`TO-BE · State · ${st.name} · ${theme}`, 'VERTICAL', 16);
      wrap.paddingTop = wrap.paddingBottom = wrap.paddingLeft = wrap.paddingRight = 32;
      fill(wrap, 'surface/page');
      parent.appendChild(wrap);
      wrap.appendChild(await text('State · ' + st.name, 'overline', 'text/muted'));
      const s = await renderSpec(spec, false);
      wrap.appendChild(s);
      s.resize(spec.w, s.height); s.layoutSizingHorizontal = 'FIXED'; s.layoutSizingVertical = 'HUG';
      if (theme === 'Dark') await rebindDark(wrap);
      wrap.x = frames[i].x; wrap.y = nextY[i]; nextY[i] += wrap.height + 120;
      frames.push(wrap);
    }
  }
  return frames;
}
// read every size override back; one that did not hold gets a second try (fixed sizing first), the rest are listed in the report
function sizePass() {
  const off = e => (e.w != null && Math.abs(e.n.width - e.w) > 0.5) || (e.h != null && Math.abs(e.n.height - e.h) > 0.5);
  const out = { n: SIZED.length, first: 0, second: 0, failed: [] };
  for (const e of SIZED) {
    if (!off(e)) { out.first++; continue; }
    const was = { w: Math.round(e.n.width * 10) / 10, sizing: e.n.layoutSizingHorizontal, type: e.n.type, parent: e.n.parent && e.n.parent.layoutMode };
    let err = '';
    try { if (e.w != null) e.n.layoutSizingHorizontal = 'FIXED'; if (e.h != null) e.n.layoutSizingVertical = 'FIXED'; e.n.resize(Math.max(e.w != null ? e.w : e.n.width, 0.01), Math.max(e.h != null ? e.h : e.n.height, 0.01)); } catch (x) { err = String(x.message || x).slice(0, 80); }
    if (!off(e)) { out.second++; continue; }
    const want = Math.round((e.w != null ? e.w : e.h) * 10) / 10;
    out.failed.push(e.inst + ' ' + e.path + ' · ' + was.type + ' ' + was.sizing + ' in ' + was.parent + ' · want ' + want + ', got ' + was.w + ' → ' + Math.round(e.n.width * 10) / 10 + (err ? ' · ' + err : ''));
  }
  SIZED.length = 0;
  return out;
}
function selfCheck(frame, raw, TOL) {
  const app = frame.children[0], o = app.absoluteBoundingBox;
  const rows = [], font = []; let n = 0;
  const through = x => { while (x && x.type === 'FRAME' && x.name === 'margin' && x.children.length === 1) x = x.children[0]; return x; };
  const kidsOf = f => ('children' in f ? f.children : []).filter(c => c.visible !== false && c.name !== 'spacer');
  const walk = (s, f, trail) => {
    f = through(f); if (!f || !f.absoluteBoundingBox) return;
    n++;
    const b = f.absoluteBoundingBox;
    const d = { x: b.x - o.x - s.x, y: b.y - o.y - s.y, w: b.width - s.w, h: b.height - s.h };
    const off = Object.entries(d).filter(([, v]) => Math.abs(v) > TOL);
    const label = trail.concat(s.cls0 || s.name).slice(-3).join(' › ') + (s.chars ? ' «' + s.chars.slice(0, 24) + '»' : '');
    if (off.length) {
      const onlyTextWidth = s.t === 'text' && off.every(([k, v]) => (k === 'w' && Math.abs(v) <= 6) || (k === 'x' && Math.abs(v) <= 6));
      (onlyTextWidth ? font : rows).push({ label, d: off.map(([k, v]) => k + ' ' + (v > 0 ? '+' : '') + Math.round(v)).join(' '), worst: Math.max(...off.map(([, v]) => Math.abs(v))) });
    }
    if (s.t === 'text' || s.t === 'svg') return;
    const sk = s.kids.filter(k => k.name !== 'spacer'), fk = kidsOf(f);
    if (sk.length !== fk.length) { rows.push({ label: label + ' — layers', d: `code ${sk.length} · Figma ${fk.length}`, worst: 999 }); return; }
    sk.forEach((k, i) => walk(k, fk[i], trail.concat(s.cls0 || s.name)));
  };
  walk(raw, app, []);
  rows.sort((a, b) => b.worst - a.worst);
  return { n, rows, font };
}
async function checkReport(parent, results, sized) {
  for (const x of parent.children.filter(c => c.name === 'Check · code ↔ Figma')) x.remove();
  const f = frame('Check · code ↔ Figma', 'VERTICAL', 'space/stack');
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = 32;
  fill(f, 'surface/page'); stroke(f, 'border/subtle', false); f.cornerRadius = 16;
  parent.appendChild(f);
  f.appendChild(await text('Check · code ↔ Figma', 'heading', 'text/primary'));
  f.appendChild(await text('Every layer of the screen — instances included — against the same element of the prototype: position and size, tolerance 2 px. Text width within 6 px is font rendering (Chrome vs Figma), listed apart.', 'caption', 'text/secondary'));
  for (const [theme, r] of results) {
    f.appendChild(await text(`${theme}: ${r.n - r.rows.length} of ${r.n} layers match · off ${r.rows.length} · text width (font rendering) ${r.font.length}`, 'body-strong', r.rows.length ? 'feedback/negative-text' : 'feedback/positive-text'));
    for (const row of r.rows.slice(0, 25)) f.appendChild(await text(`${row.worst === 999 ? 'layers' : Math.round(row.worst) + ' px'} · ${row.label} · ${row.d}`, 'caption', 'text/secondary'));
  }
  if (sized && sized.n) {
    f.appendChild(await text(`Size overrides (bar lengths in instances): ${sized.first} of ${sized.n} held · ${sized.second} on a second try · ${sized.failed.length} did not`, 'body-strong', sized.failed.length ? 'feedback/negative-text' : 'feedback/positive-text'));
    for (const l of sized.failed.slice(0, 8)) f.appendChild(await text(l, 'caption', 'text/secondary'));
  }
  f.x = 0; f.y = -f.height - 160;
  return f;
}
async function screenPage() {
  let p = figma.root.children.find(x => x.name === 'TO-BE');
  if (!p) { try { p = figma.createPage(); p.name = 'TO-BE'; } catch (e) { p = null; } }
  if (!p) { log.push('No room for a TO-BE page — the screen goes next to the design system'); return null; }
  await p.loadAsync();
  return p;
}
