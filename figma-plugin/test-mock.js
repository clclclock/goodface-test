// Dry run of code.js against a minimal fake Figma API — catches wrong names, missing variables, bad bind fields.
// Not a substitute for the real run; it checks this plugin's own wiring. Usage: node test-mock.js [--free]
const fs = require('fs');
const path = require('path');
const FREE = process.argv.includes('--free');
const PAGELIMIT = process.argv.includes('--pagelimit'); // Starter: max 3 pages per file
let id = 0;
const BINDABLE = new Set(['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'itemSpacing', 'counterAxisSpacing', 'strokeWeight', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius', 'width', 'height']);
const SCOPES = new Set(['ALL_SCOPES', 'TEXT_CONTENT', 'CORNER_RADIUS', 'WIDTH_HEIGHT', 'GAP', 'ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR', 'STROKE_FLOAT', 'EFFECT_FLOAT', 'EFFECT_COLOR', 'OPACITY', 'FONT_FAMILY', 'FONT_STYLE', 'FONT_WEIGHT', 'FONT_SIZE', 'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'PARAGRAPH_INDENT']);
const collections = [], variables = [], textStyles = [], pages = [];
const stats = { bound: 0, paints: 0, nodes: 0, overrides: 0 };
const isAuto = n => n && n.layoutMode && n.layoutMode !== 'NONE';
const inInstance = n => { for (let p = n.parent; p; p = p.parent) if (p.type === 'INSTANCE') return true; return false; };

function node(type) {
  stats.nodes++;
  const n = { id: 'n' + ++id, type, name: type, children: [], x: 0, y: 0, width: 100, height: 40, fills: [], strokes: [], boundVariables: {},
    appendChild(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); },
    remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); },
    setBoundVariable(f, v) { if (!BINDABLE.has(f)) throw new Error('not bindable: ' + f); if (!v || !v.id) throw new Error('bind ' + f + ' to undefined'); if (v.resolvedType !== 'FLOAT') throw new Error('bind ' + f + ' to ' + v.resolvedType); n.boundVariables[f] = v.id; stats.bound++; },
    setExplicitVariableModeForCollection(c, m) { if (!c.modes.find(x => x.modeId === m)) throw new Error('bad mode'); },
    pd: {}, setPluginData(k, v) { n.pd[k] = v; }, getPluginData(k) { return n.pd[k] || ''; },
    resize(w, h) { n.width = w; n.height = h; }, resizeWithoutConstraints(w, h) { n.width = w; n.height = h; }, async loadAsync() {},
    async setTextStyleIdAsync(sid) { if (!textStyles.find(s => s.id === sid)) throw new Error('no style ' + sid); },
    findAll(fn) { const out = []; const w = x => { for (const c of x.children) { if (!fn || fn(c)) out.push(c); w(c); } }; w(n); return out; },
    characters: '',
    get absoluteBoundingBox() { return { x: n.x, y: n.y, width: n.width, height: n.height }; },
    async setRangeTextStyleIdAsync(a, b, sid) { if (!(a >= 0 && b <= n.characters.length && a < b)) throw new Error(`range ${a}-${b} of «${n.characters}»`); if (!textStyles.find(s => s.id === sid)) throw new Error('no style'); },
    setRangeFills(a, b) { if (!(a >= 0 && b <= n.characters.length && a < b)) throw new Error(`fill range ${a}-${b} of «${n.characters}»`); },
    setRangeFontSize(a, b) { if (!(a >= 0 && b <= n.characters.length && a < b)) throw new Error('size range'); },
    setRangeFontName(a, b) { if (!(a >= 0 && b <= n.characters.length && a < b)) throw new Error('font range'); },
    getStyledTextSegments() { return [{ start: 0, end: Math.max(1, n.characters.length), fills: n.fills }]; },
  };
  // layout sizing: FILL only inside auto layout; HUG only for text, auto-layout frames and instances (as in Figma)
  for (const ax of ['layoutSizingHorizontal', 'layoutSizingVertical']) {
    let v = 'FIXED';
    Object.defineProperty(n, ax, { get: () => v, set(x) {
      if (x === 'FILL' && !isAuto(n.parent)) throw new Error(`${n.name}: FILL outside auto layout`);
      if (x === 'HUG' && !(n.type === 'TEXT' || isAuto(n) || n.type === 'INSTANCE')) throw new Error(`${n.name} (${n.type}): HUG on a non-auto-layout node`);
      v = x; } });
  }
  let refs = {};
  Object.defineProperty(n, 'componentPropertyReferences', { get: () => refs, set(x) { if (inInstance(n)) throw new Error(n.name + ': property reference inside an instance'); refs = x; } });
  if (type === 'COMPONENT' || type === 'COMPONENT_SET') {
    n.props = {};
    n.addComponentProperty = (name, t, def) => { const k = name + '#' + id++; n.props[k] = { type: t, value: def }; return k; };
    n.createInstance = () => instanceOf(n);
  }
  return n;
}
// an instance mirrors its main component's layers; nested instances keep their main, so variants can be swapped
function instanceOf(main) {
  const owner = main.parent && main.parent.type === 'COMPONENT_SET' ? main.parent : main;
  const i = node('INSTANCE'); i.name = main.name; i.main = main; i.layoutMode = main.layoutMode;
  i.componentProperties = JSON.parse(JSON.stringify(owner.props));
  i.setProperties = o => { stats.overrides++; for (const k in o) {
    const variantKeys = owner.type === 'COMPONENT_SET' ? Object.keys(main.variantProperties || {}) : [];
    if (!(k in i.componentProperties) && !variantKeys.includes(k)) throw new Error(`${main.name}: no property ${k}`);
    if (variantKeys.includes(k) && !owner.children.some(v => v.variantProperties[k] === o[k])) throw new Error(`${owner.name}: no variant ${k}=${o[k]}`);
  } };
  const copy = (src, parent) => { for (const c of src.children) {
    const k = c.type === 'INSTANCE' ? instanceOf(c.main) : node(c.type);
    k.name = c.name; k.characters = c.characters; k.layoutMode = c.layoutMode; if (c.visible === false) k.visible = false; // an instance keeps the master's hidden parts, as in Figma
    parent.children.push(k); k.parent = parent;
    if (c.type !== 'INSTANCE') copy(c, k);
  } };
  copy(main, i);
  return i;
}
function variable(name, col, type) {
  if (!col || !col.id) throw new Error('createVariable needs a collection object');
  if (variables.find(v => v.name === name && v.variableCollectionId === col.id)) throw new Error('duplicate variable ' + name);
  const v = { id: 'v' + ++id, name, resolvedType: type, variableCollectionId: col.id, values: {}, scopes: [],
    setValueForMode(m, val) {
      if (!col.modes.find(x => x.modeId === m)) throw new Error(name + ': bad mode');
      if (val && val.type === 'VARIABLE_ALIAS') { const t = variables.find(x => x.id === val.id); if (!t) throw new Error(name + ': alias to missing'); if (t.resolvedType !== type) throw new Error(name + ': alias type'); }
      else if (type === 'COLOR' && !(val && 'r' in val)) throw new Error(name + ': bad colour ' + JSON.stringify(val));
      else if (type === 'FLOAT' && typeof val !== 'number') throw new Error(name + ': bad number ' + val);
      v.values[m] = val;
    },
    setVariableCodeSyntax() {}, remove() { variables.splice(variables.indexOf(v), 1); } };
  Object.defineProperty(v, 'scopes', { set(s) { for (const x of s) if (!SCOPES.has(x)) throw new Error('bad scope ' + x); }, get() { return []; } });
  variables.push(v); return v;
}
global.figma = {
  root: { children: pages },
  variables: {
    async getLocalVariableCollectionsAsync() { return collections.slice(); },
    async getLocalVariablesAsync() { return variables.slice(); },
    createVariableCollection(name) { const c = { id: 'c' + ++id, name, modes: [{ modeId: 'm' + ++id, name: 'Mode 1' }],
      renameMode(m, nm) { c.modes.find(x => x.modeId === m).name = nm; },
      addMode(nm) { if (FREE) throw new Error('Limited to 1 modes only'); const m = 'm' + ++id; c.modes.push({ modeId: m, name: nm }); return m; } };
      collections.push(c); return c; },
    createVariable: variable,
    createVariableAlias(v) { if (!v) throw new Error('alias of undefined'); return { type: 'VARIABLE_ALIAS', id: v.id }; },
    setBoundVariableForPaint(p, f, v) { if (!v) throw new Error('paint bound to undefined'); if (v.resolvedType !== 'COLOR') throw new Error('paint to non-colour'); stats.paints++; return Object.freeze(Object.assign({}, p, { boundVariables: { color: { id: v.id } } })); },
  },
  async listAvailableFontsAsync() { return ['Regular', 'Medium', 'Semi Bold', 'Bold'].map(s => ({ fontName: { family: 'Inter', style: s } })).concat(['Regular', 'Medium', 'SemiBold', 'Bold'].map(s => ({ fontName: { family: 'JetBrains Mono', style: s } }))); },
  async loadFontAsync() {},
  async getLocalTextStylesAsync() { return textStyles.slice(); },
  createTextStyle() { const s = { id: 'S' + ++id }; textStyles.push(s); return s; },
  createPage() { if (PAGELIMIT && pages.length >= 3) throw new Error('Starter plan: 3 pages'); const p = node('PAGE'); p.remove = () => pages.splice(pages.indexOf(p), 1); pages.push(p); return p; },
  async setCurrentPageAsync(p) { if (!pages.includes(p)) throw new Error('not a page'); figma.currentPage = p; },
  createRectangle: () => node('RECTANGLE'),
  createSection: () => node('SECTION'),
  createComponent: () => node('COMPONENT'),
  createFrame: () => node('FRAME'),
  createText: () => node('TEXT'),
  combineAsVariants(list, parent) { const s = node('COMPONENT_SET'); for (const c of list) { if (!/^([\w-]+=[\w-]+)(, [\w-]+=[\w-]+)*$/.test(c.name)) throw new Error('variant name ' + c.name); c.variantProperties = Object.fromEntries(c.name.split(', ').map(p => p.split('='))); s.appendChild(c); }
    Object.defineProperty(s, 'componentPropertyDefinitions', { get() { const o = {}; for (const c of s.children) for (const [k, v] of Object.entries(c.variantProperties)) { o[k] = o[k] || { type: 'VARIANT', variantOptions: [] }; if (!o[k].variantOptions.includes(v)) o[k].variantOptions.push(v); } return o; } });
    const names = list.map(c => c.name); if (new Set(names).size !== names.length) throw new Error('duplicate variants ' + names); parent.appendChild(s); return s; },
  createNodeFromSvg(svg) { if (!/^<svg[^>]*xmlns=/.test(svg)) throw new Error('svg without xmlns'); const f = node('FRAME'); const n = (svg.match(/<(path|rect|circle|ellipse|line|polyline|polygon)/g) || []).length; for (let i = 0; i < n; i++) { const v = node('VECTOR'); v.strokes = [{}]; f.appendChild(v); } return f; },
  viewport: { scrollAndZoomIntoView() {} },
  notify() {},
  closePlugin(msg) { console.log('closePlugin:', msg); if (String(msg).startsWith('✕')) process.exitCode = 1; },
};
figma.command = process.argv.includes('--submission') ? 'submission' : undefined; // G-160
const first0 = node('PAGE'); first0.name = 'Page 1'; pages.push(first0); figma.currentPage = first0;
if (PAGELIMIT) { const c = node('PAGE'); c.name = 'Components (generated)'; pages.push(c); c.remove = () => pages.splice(pages.indexOf(c), 1); } // like the hand-arranged file
const code = fs.readFileSync(path.join(__dirname, 'code.js'), 'utf8');
// run twice: the second run must update, not duplicate
new Function(code)();
setTimeout(() => {
  const count = () => { let k = 0; const walk = n => { k++; n.children.forEach(walk); }; pages.forEach(walk); return k; };
  const first = { vars: variables.length, styles: textStyles.length, nodes: count(), pages: pages.map(p => p.name + ':' + p.children.map(c => c.name).join('+')).join(' | ') };
  new Function(code)();
  setTimeout(() => {
    const second = { vars: variables.length, styles: textStyles.length, nodes: count(), pages: pages.map(p => p.name + ':' + p.children.map(c => c.name).join('+')).join(' | ') };
    console.log('collections:', collections.map(c => `${c.name} [${c.modes.map(m => m.name).join('/')}]`).join(' · '));
    console.log('run 1:', JSON.stringify(first), '· run 2:', JSON.stringify(second), '· pages:', pages.length);
    console.log('bindings:', stats.bound, 'number ·', stats.paints, 'colour · variant swaps:', stats.overrides);
    if (JSON.stringify(first) !== JSON.stringify(second)) { console.log('✕ second run changed counts'); process.exitCode = 1; }
  }, 50);
}, 50);
