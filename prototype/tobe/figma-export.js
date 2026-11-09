// Figma export (G-119): walks the TO-BE screen and describes it for the Figma plugin — layout, sizing, the TOKENS used
// (by name, read from the CSS rules, not the computed colours), texts with styles, icons, components and their variants.
// Used by figma-export.html; the node runner is ../../figma-plugin/extract-screen.js. Nothing here changes the screen.
window.figmaExport = function (doc, rootSel) {
  const win = doc.defaultView;
  // component classes → Figma names (the component list); containers become auto-layout frames, not instances
  const COMP = { 'tag': 'Tag', 'period-tag': 'Period Tag', 'segmented': 'Segmented Control', 'segmented__item': 'Segmented Control / Item', 'kpi-card': 'KPI Card', 'line-chart': 'Line Chart', 'split-bar': 'Split Bar', 'pair-bar': 'Pair Bar', 'stat-row': 'Stat Row', 'breakdown-row': 'Breakdown Row', 'diverge-bar': 'Diverge Bar', 'rate-bar': 'Rate Bar', 'mini-bar': 'Mini Bar', 'info-tip__trigger': 'Info Tip', 'info-tip': 'Info Tip', 'side': 'Trading Panel' };
  const FRAMES = { 'stat-block': 'Stat Block', 'stat-group': 'Stat Group', 'disclosure': 'Disclosure', 'breakdown-table': 'Breakdown Table', 'summary-content': 'Summary' };
  const NOT_VARIANT = ['data-tab', 'data-panel', 'data-sort-key', 'data-anim', 'data-icon', 'data-placement'];
  const TOKEN = /^--(surface|border|text|graphic|feedback|brand|space|radius|size|scale|stroke|type|tracking|light|dark|alpha)-/;

  // ── CSS rules with specificity, for «which token did the author write here» ──
  const RULES = [];
  const splitSel = s => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  const spec = s => {
    const noArgs = s.replace(/\([^)]*\)/g, '');
    const a = (noArgs.match(/#[\w-]+/g) || []).length;
    const b = (noArgs.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length + (noArgs.match(/:(?!:)[\w-]+/g) || []).length;
    const c = (noArgs.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
    return a * 10000 + b * 100 + c;
  };
  let order = 0;
  const walk = rules => {
    for (const r of rules) {
      if (r.selectorText && r.style) {
        for (const sel of splitSel(r.selectorText)) if (!sel.includes('::')) RULES.push({ sel, spec: spec(sel), order: order++, style: r.style });
      } else if (r.media) { if (win.matchMedia(r.media.mediaText).matches) walk(r.cssRules); }
      else if (r.cssRules && !(r.constructor && r.constructor.name === 'CSSStartingStyleRule')) walk(r.cssRules);
    }
  };
  for (const sh of doc.styleSheets) { try { walk(sh.cssRules); } catch (e) { /* cross-origin (fonts) */ } }
  const matchCache = new Map();
  const matched = el => {
    if (!matchCache.has(el)) matchCache.set(el, RULES.filter(r => { try { return el.matches(r.sel); } catch (e) { return false; } }));
    return matchCache.get(el);
  };
  // the winning declaration among several property names (a longhand and its shorthands): [value, which name]
  const declared = (el, names) => {
    let best = null;
    for (const r of matched(el)) for (const n of names) {
      const v = r.style.getPropertyValue(n); if (!v) continue;
      const imp = r.style.getPropertyPriority(n) === 'important' ? 1 : 0;
      const score = [imp, r.spec, r.order];
      if (!best || score[0] > best.s[0] || (score[0] === best.s[0] && (score[1] > best.s[1] || (score[1] === best.s[1] && score[2] > best.s[2])))) best = { v: v.trim(), n, s: score };
    }
    if (el.style) for (const n of names) { const v = el.style.getPropertyValue(n); if (v) return [v.trim(), n]; }
    return best ? [best.v, best.n] : [null, null];
  };
  const inheritedDecl = (el, names) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const [v, n] = declared(e, names); if (v && v !== 'inherit') return [v, n, e]; } return [null, null, null]; };
  // var(--local) → follow component-local custom properties until a design token (or a raw value)
  const tokenOf = (el, v) => {
    for (let i = 0; i < 8 && v; i++) {
      const m = /^var\((--[\w-]+)\s*(?:,[^)]*)?\)$/.exec(v.trim());
      if (!m) return null;
      if (TOKEN.test(m[1])) return m[1];
      v = inheritedDecl(el, [m[1]])[0];
    }
    return null;
  };
  const split4 = v => { const p = v.split(/\s+(?![^(]*\))/); return [p[0], p[1] ?? p[0], p[2] ?? p[0], p[3] ?? p[1] ?? p[0]]; };
  const px = v => parseFloat(v) || 0;
  const rgbParse = c => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c); return m ? [m[1] / 255, m[2] / 255, m[3] / 255, m[4] == null ? 1 : +m[4]] : null; };
  // any CSS colour (oklch too) → rgba 0–1, through one canvas pixel — Figma reads neither oklch nor var() in SVG
  const cvs = doc.createElement('canvas'); cvs.width = cvs.height = 1; const cx = cvs.getContext('2d', { willReadFrequently: true });
  const rgba = c => {
    if (!c || c === 'none') return null;
    const p = rgbParse(c); if (p) return p;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = 'rgba(0,0,0,0)'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
  };
  const hex = c => { const v = rgba(c); return v ? '#' + v.slice(0, 3).map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('') : 'none'; };

  // visible = rendered: not display:none, not [hidden], not the body of a closed <details> (its <summary> stays)
  const vis = e => {
    const cs = win.getComputedStyle(e);
    if (cs.display === 'none' || e.closest('[hidden]')) return false;
    const det = e.closest('details');
    if (det && det !== e && !det.open && !e.closest('summary')) return false;
    return true;
  };
  const isLayout = e => /flex|grid/.test(win.getComputedStyle(e).display);
  const kids = e => [...e.children].filter(vis);
  const SHAPES = 'path,rect,circle,ellipse,line,polyline,polygon';
  const zeroText = e => px(win.getComputedStyle(e).fontSize) === 0;
  const textLike = e => !zeroText(e) && !isLayout(e) && e.tagName.toLowerCase() !== 'svg' && kids(e).every(c => !isLayout(c) && c.tagName.toLowerCase() !== 'svg' && !c.querySelector('svg') && win.getComputedStyle(c).display.startsWith('inline') && !boxy(c)) && e.textContent.trim() !== '';
  // a box of its own: a fill, a border or padding — a label like «7», «Soon», «50K» or an underlined tab is a frame with text inside, not bare text
  const boxy = e => { const cs = win.getComputedStyle(e); const bg = rgba(cs.backgroundColor); return (bg && bg[3] > 0) || ['Top', 'Right', 'Bottom', 'Left'].some(s => px(cs['border' + s + 'Width']) > 0 || px(cs['padding' + s]) > 0); };
  const root = doc.querySelector(rootSel);
  const R = root.getBoundingClientRect();

  // paint from a declared value (token) or the computed colour
  const paintOf = (el, declaredV, computed) => {
    const tok = declaredV && tokenOf(el, declaredV);
    if (tok) return { var: tok };
    const c = rgba(computed);
    if (!c || c[3] === 0) return null;
    return { rgba: c };
  };
  const typeOf = el => { const [v] = inheritedDecl(el, ['font']); const t = v && tokenOf(el, v); return t ? t.replace('--type-', '') : null; };
  const textInfo = (el, chars) => {
    const cs = win.getComputedStyle(el);
    const [cv] = inheritedDecl(el, ['color']);
    const [ls] = inheritedDecl(el, ['letter-spacing']);
    // the exact size, weight and line height on screen — the plugin keeps the style and overrides what the CSS overrides
    return { style: typeOf(el), color: paintOf(el, cv, cs.color), upper: cs.textTransform === 'uppercase', track: ls && tokenOf(el, ls) ? tokenOf(el, ls) : null,
      family: cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''),
      weight: +cs.fontWeight, size: px(cs.fontSize), line: px(cs.lineHeight), align: cs.textAlign === 'right' || cs.textAlign === 'end' ? 'RIGHT' : cs.textAlign === 'center' ? 'CENTER' : 'LEFT', chars };
  };
  const textNode = (el, r) => {
    const chars = el.textContent.replace(/\s+/g, ' ').trim();
    const n = { t: 'text', name: el.classList[0] || el.tagName.toLowerCase(), cls: [...el.classList], x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height, text: textInfo(el, chars) };
    const ranges = []; let pos = 0;
    const lead = el.textContent.replace(/\s+/g, ' ').length - el.textContent.replace(/\s+/g, ' ').trimStart().length;
    for (const c of el.childNodes) {
      const t = c.textContent.replace(/\s+/g, ' ');
      const start = Math.max(0, pos - lead), end = Math.min(chars.length, pos - lead + t.length);
      if (c.nodeType === 1 && end > start) { const ti = textInfo(c, ''); ranges.push({ s: start, e: end, style: ti.style, color: ti.color, weight: ti.weight, size: ti.size, line: ti.line, family: ti.family }); }
      pos += t.length;
    }
    if (ranges.length) n.text.ranges = ranges;
    const nr = doc.createRange(); nr.selectNodeContents(el); const nb = nr.getBoundingClientRect();
    n.nat = { w: nb.width, h: nb.height }; // the text's own extent, not its (stretched) box
    return n;
  };
  // svg: every shape keeps its own colour (logo = brand blue, icons = the text colour they sit in); var() → computed for Figma
  const svgNode = (el, node, cs) => {
    node.t = 'svg';
    const [cv] = inheritedDecl(el, ['color']);
    node.color = paintOf(el, cv, cs.color);
    const attrUp = (sh, a) => { for (let e = sh; e && e !== el.parentElement; e = e.parentElement) { const v = e.getAttribute(a); if (v) return v; } return null; };
    const clone = el.cloneNode(true);
    const shapes = [...el.querySelectorAll(SHAPES)], cshapes = [...clone.querySelectorAll(SHAPES)];
    node.shapes = shapes.map((sh, i) => {
      const scs = win.getComputedStyle(sh);
      const one = p => {
        const comp = scs[p];
        if (!comp || comp === 'none' || (rgba(comp) || [0, 0, 0, 1])[3] === 0) { cshapes[i].setAttribute(p, 'none'); return null; }
        cshapes[i].setAttribute(p, hex(comp));
        if (rgba(comp)[3] < 1) cshapes[i].setAttribute(p + '-opacity', String(rgba(comp)[3]));
        const d = declared(sh, [p])[0] || attrUp(sh, p);
        return d === 'currentColor' ? node.color : paintOf(sh, d, comp);
      };
      cshapes[i].removeAttribute('style');
      return { fill: one('fill'), stroke: one('stroke') };
    });
    clone.setAttribute('width', node.w); clone.setAttribute('height', node.h);
    for (const g of clone.querySelectorAll('[style*="opacity"]')) { const m = /opacity:\s*([\d.]+)/.exec(g.getAttribute('style')); if (m) g.setAttribute('opacity', m[1]); }
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    node.svg = clone.outerHTML.replace(/currentColor/g, hex(cs.color));
    node.sizeH = node.sizeV = 'FIXED';
    return node;
  };
  // G-143: the Line Chart → a plain chart in pixels for Figma. The page draws it in a 1000×100 box stretched to the card, with clip
  // paths (green above zero, red below), a dot pattern and a mask for the hover — Figma's SVG import reads none of that reliably.
  // Here: the zero crossings are inserted, the line is cut into green and red pieces, two fills (above / below zero) and the axis;
  // every shape keeps its token. The hover (cursor, point, grey part) is the prototype's behaviour, not a layer.
  const lineChartNode = (el, node) => {
    node.t = 'svg';
    const vb = el.viewBox.baseVal, sx = node.w / vb.width, sy = node.h / vb.height;
    const q = sel => el.querySelector(sel);
    const pos = q('.line-chart__line[data-tone="positive"]'), neg = q('.line-chart__line[data-tone="negative"]');
    const apos = q('.line-chart__area[data-tone="positive"]'), aneg = q('.line-chart__area[data-tone="negative"]'), axis = q('.line-chart__axis');
    const P = pos.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number)).map(([x, y]) => [x * sx, y * sy]);
    const Z = +axis.getAttribute('y1') * sy;
    const pts = [P[0]];
    for (let i = 1; i < P.length; i++) {
      const [x0, y0] = P[i - 1], [x1, y1] = P[i];
      if ((y0 - Z) * (y1 - Z) < 0) { const t = (Z - y0) / (y1 - y0); pts.push([x0 + (x1 - x0) * t, Z]); }
      pts.push(P[i]);
    }
    // G-176: the hover state (the «Chart · hover» block) — left of the cursor in colour, right of it grey over a pale fill, the cursor and the point
    const svgEl = el, cursor = q('.line-chart__cursor'), hovered = svgEl.hasAttribute('data-hover') && cursor;
    const cx = hovered ? +cursor.getAttribute('x1') * sx : Infinity;
    const yAt = x => { for (let i = 1; i < pts.length; i++) if (pts[i][0] >= x) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], t = x1 === x0 ? 0 : (x - x0) / (x1 - x0); return y0 + (y1 - y0) * t; } return pts[pts.length - 1][1]; };
    const all = pts.slice();
    const leftPts = hovered ? all.filter(p => p[0] <= cx).concat([[cx, yAt(cx)]]) : all;
    const rightPts = hovered ? [[cx, yAt(cx)]].concat(all.filter(p => p[0] > cx)) : [];
    pts.length = 0; leftPts.forEach(p => pts.push(p)); // the coloured part below works on pts
    const r2 = v => Math.round(v * 100) / 100, ps = a => a.map(([x, y]) => r2(x) + ',' + r2(y)).join(' ');
    const area = a => ps([[a[0][0], Z]].concat(a, [[a[a.length - 1][0], Z]]));
    const pieces = above => { // runs of segments on one side; a segment lying on zero goes to the green side only
      const out = []; let cur = null;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], on = p => Math.abs(p[1] - Z) < 0.01;
        const mine = above ? a[1] <= Z + 0.01 && b[1] <= Z + 0.01 : a[1] >= Z - 0.01 && b[1] >= Z - 0.01 && !(on(a) && on(b));
        if (mine) { if (!cur) { cur = [a]; out.push(cur); } cur.push(b); } else cur = null;
      }
      return out;
    };
    const paint = (sh, p) => { const c = win.getComputedStyle(sh)[p], d = declared(sh, [p])[0]; return { c, ref: paintOf(sh, d, c) }; };
    const attr = (pt, kind) => kind + '="' + hex(pt.c) + '"' + (rgba(pt.c)[3] < 1 ? ' ' + kind + '-opacity="' + rgba(pt.c)[3] + '"' : '');
    const fp = paint(apos, 'fill'), fn = paint(aneg, 'fill'), lp = paint(pos, 'stroke'), ln = paint(neg, 'stroke'), ax = paint(axis, 'stroke');
    const lw = parseFloat(win.getComputedStyle(pos).strokeWidth) || 2, aw = parseFloat(win.getComputedStyle(axis).strokeWidth) || 1;
    const parts = [], shapes = [];
    parts.push('<polygon points="' + area(pts.map(([x, y]) => [x, Math.min(y, Z)])) + '" ' + attr(fp, 'fill') + '/>'); shapes.push({ fill: fp.ref, stroke: null });
    parts.push('<polygon points="' + area(pts.map(([x, y]) => [x, Math.max(y, Z)])) + '" ' + attr(fn, 'fill') + '/>'); shapes.push({ fill: fn.ref, stroke: null });
    parts.push('<line x1="0" y1="' + r2(Z) + '" x2="' + r2(node.w) + '" y2="' + r2(Z) + '" ' + attr(ax, 'stroke') + ' stroke-width="' + aw + '"/>'); shapes.push({ fill: null, stroke: ax.ref });
    for (const [side, pt] of [[true, lp], [false, ln]]) for (const run of pieces(side)) {
      parts.push('<polyline points="' + ps(run) + '" fill="none" ' + attr(pt, 'stroke') + ' stroke-width="' + lw + '" stroke-linejoin="round" stroke-linecap="round"/>'); shapes.push({ fill: null, stroke: pt.ref });
    }
    if (hovered && rightPts.length > 1) {
      const muted = q('.line-chart__line[data-tone="muted"]'), dot = q('.line-chart__dot'), marker = q('.line-chart__marker');
      const lm = paint(muted, 'stroke'), df = paint(dot, 'fill'), cs = paint(cursor, 'stroke'), mf = paint(marker, 'fill'), msk = paint(marker, 'stroke');
      // the dotted, fading area of the prototype → a pale fill of the dot colour (Figma's SVG import drops patterns and masks)
      parts.push('<polygon points="' + area(rightPts) + '" fill="' + hex(df.c) + '" fill-opacity="0.12"/>'); shapes.push({ fill: df.ref, stroke: null, opacity: 0.12 });
      parts.push('<polyline points="' + ps(rightPts) + '" fill="none" ' + attr(lm, 'stroke') + ' stroke-width="' + lw + '" stroke-linejoin="round" stroke-linecap="round"/>'); shapes.push({ fill: null, stroke: lm.ref });
      const dash = (win.getComputedStyle(cursor).strokeDasharray || '2 4').replace(/px/g, '').replace(/,/g, ' ');
      parts.push('<line x1="' + r2(cx) + '" y1="0" x2="' + r2(cx) + '" y2="' + r2(node.h) + '" ' + attr(cs, 'stroke') + ' stroke-width="1" stroke-dasharray="' + dash + '"/>'); shapes.push({ fill: null, stroke: cs.ref });
      const mw = parseFloat(win.getComputedStyle(marker).strokeWidth) || 2;
      parts.push('<circle cx="' + r2(cx) + '" cy="' + r2(yAt(cx)) + '" r="4" ' + attr(mf, 'fill') + ' ' + attr(msk, 'stroke') + ' stroke-width="' + mw + '"/>'); shapes.push({ fill: mf.ref, stroke: msk.ref });
    }
    node.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + r2(node.w) + '" height="' + r2(node.h) + '" viewBox="0 0 ' + r2(node.w) + ' ' + r2(node.h) + '">' + parts.join('') + '</svg>';
    node.shapes = shapes; node.color = null; node.name = 'Line';
    node.sizeH = node.sizeV = 'FIXED';
    return node;
  };
  const lineBox = n => {
    if (n.text && !n.text.line) n.text.line = Math.round(n.h);
    const L = n.text && n.text.line;
    if (L && n.h < L - 0.5) { n.y -= (L - n.h) / 2; n.h = L; if (n.nat) n.nat.h = L; }
    return n;
  };
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const cap = s => s[0].toUpperCase() + s.slice(1);

  function describe(el, parentDir) {
    const cs = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const cls = [...el.classList];
    const node = { name: cls[0] || el.tagName.toLowerCase(), cls, x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height };
    const comp = cls.map(c => COMP[c]).find(Boolean), frameName = cls.map(c => FRAMES[c]).find(Boolean);
    if (comp) { node.comp = comp; node.variant = Object.fromEntries([...el.attributes].filter(a => a.name.startsWith('data-') && !NOT_VARIANT.includes(a.name)).map(a => [a.name.slice(5), a.value])); }
    if (cls.includes('side')) { const app = el.closest('.app'); node.variant = { state: app && app.dataset.side === 'collapsed' ? 'collapsed' : 'expanded' }; }
    if (cls.includes('info-tip__trigger')) node.variant = { state: 'closed' }; // the icon = the closed tip; the panel (.info-tip) = state open
    if (frameName) node.frame = frameName;
    if (+cs.opacity < 1) node.op = +cs.opacity;

    // sizing inside the parent's auto layout
    const parent = el.parentElement, pcs = parent && win.getComputedStyle(parent);
    const grow = +cs.flexGrow || 0;
    const sibs = parent ? kids(parent).map(s => +win.getComputedStyle(s).flexGrow || 0).filter(g => g > 0) : [];
    const weighted = sibs.length > 1 && sibs.some(g => g !== sibs[0]) || /width|flex/.test(el.getAttribute('style') || '');
    const [wDecl] = declared(el, ['width', 'flex-basis', 'min-width']);
    const wTok = wDecl && tokenOf(el, wDecl);
    if (wTok) node.wVar = wTok;
    const fixedW = !!wTok || (wDecl && /px$/.test(wDecl));
    const [hDecl] = declared(el, ['height', 'min-height']);
    const hTok = hDecl && tokenOf(el, hDecl);
    if (hTok) node.hVar = hTok;
    const fixedH = !!hTok || (hDecl && /px$/.test(hDecl));
    const alignSelf = cs.alignSelf === 'auto' ? (pcs ? pcs.alignItems : 'normal') : cs.alignSelf;
    const stretch = alignSelf === 'stretch' || alignSelf === 'normal';
    if (parentDir === 'H') {
      node.sizeH = grow > 0 ? (weighted ? 'FIXED' : 'FILL') : fixedW ? 'FIXED' : 'HUG';
      node.sizeV = fixedH ? 'FIXED' : stretch && !/height/.test(el.getAttribute('style') || '') ? 'FILL' : 'HUG';
    } else if (parentDir === 'V') {
      node.sizeV = grow > 0 ? (weighted ? 'FIXED' : 'FILL') : fixedH ? 'FIXED' : 'HUG';
      node.sizeH = fixedW ? 'FIXED' : stretch ? 'FILL' : 'HUG';
    } else { node.sizeH = 'FIXED'; node.sizeV = 'HUG'; }
    // inside a CSS grid: a column of «fr» fills, a fixed column keeps its width; the side columns stretch to the content's height
    if (pcs && pcs.display.includes('grid')) {
      const tpl = (declared(parent, ['grid-template-columns'])[0] || '').split(/\s+(?![^(]*\))/).filter(Boolean);
      if (tpl.length > 1) { const tok = tpl[kids(parent).indexOf(el)] || ''; node.sizeH = /fr/.test(tok) ? 'FILL' : 'FIXED'; node.sizeV = /fr/.test(tok) ? 'HUG' : 'FILL'; }
      else { node.sizeH = fixedW ? 'FIXED' : 'HUG'; node.sizeV = fixedH ? 'FIXED' : 'HUG'; }
    }
    // margins: «auto» pushes (→ a spacer in the parent), a length becomes padding of a wrapper frame in Figma
    if (parent && parentDir) {
      const along = parentDir === 'H' ? ['left', 'right'] : ['top', 'bottom'];
      const auto = s => (declared(el, ['margin-' + s, 'margin', parentDir === 'H' ? 'margin-inline' : 'margin-block'])[0] || '').split(/\s+/).some(v => v === 'auto') && declared(el, ['margin-' + s])[0] !== '0';
      const ml = declared(el, ['margin-' + along[0]])[0], mr = declared(el, ['margin-' + along[1]])[0], m = declared(el, ['margin'])[0];
      const isAuto = (side, longhand) => longhand === 'auto' || (!longhand && m && split4(m)[SIDES.indexOf(side)] === 'auto');
      node.autoBefore = isAuto(along[0], ml); node.autoAfter = isAuto(along[1], mr);
      if (!node.autoBefore) delete node.autoBefore; if (!node.autoAfter) delete node.autoAfter;
      void auto;
    }
    const margin = SIDES.map(s => {
      const v = px(cs['margin' + cap(s)]);
      if ((s === 'left' || s === 'top') && node.autoBefore && (parentDir === 'H' ? s === 'left' : s === 'top')) return { v: 0 };
      if ((s === 'right' || s === 'bottom') && node.autoAfter && (parentDir === 'H' ? s === 'right' : s === 'bottom')) return { v: 0 };
      const [d, n] = declared(el, ['margin-' + s, 'margin']);
      const tok = d && (n === 'margin' ? tokenOf(el, split4(d)[SIDES.indexOf(s)]) : tokenOf(el, d));
      return { v: Math.max(0, v), var: tok || null };
    });
    if (margin.some(m => m.v > 0)) node.margin = margin;

    // fill, border, radius
    const [bg] = declared(el, ['background-color', 'background']);
    const fill = paintOf(el, bg, cs.backgroundColor);
    if (fill) node.fill = fill;
    const bw = SIDES.map(s => px(cs[`border${cap(s)}Width`]));
    if (bw.some(Boolean)) {
      const side = SIDES[bw.findIndex(Boolean)];
      const [bd] = declared(el, [`border-${side}-color`, 'border-color', `border-${side}`, 'border']);
      const colorPart = bd && (bd.match(/var\(--[\w-]+\)|transparent/g) || []).filter(t => !/--border-width|--stroke/.test(t)).pop();
      const widthPart = bd && (bd.match(/var\(--(?:border-width|stroke-1)\)/) || [])[0];
      const computedColor = cs[`border${cap(side)}Color`];
      node.stroke = { w: bw, wVar: widthPart ? tokenOf(el, widthPart) : null, paint: colorPart === 'transparent' ? null : paintOf(el, colorPart, computedColor) };
    }
    node.radius = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c, i) => {
      const [v] = declared(el, [`border-${c}-radius`, 'border-radius']);
      const tok = v && (v.startsWith('var(') && !v.includes(' ') ? tokenOf(el, v) : (split4(v)[i] && tokenOf(el, split4(v)[i])));
      return { v: Math.min(px(cs[['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'][i]]), 999), var: tok || null };
    });
    if (!node.radius.some(c => c.v)) delete node.radius;
    if (cs.overflow !== 'visible' && cs.overflow !== '') node.clip = true;

    // a shape cut by clip-path (the tip's tail) → a real triangle, in its fill colour
    if (cs.clipPath && cs.clipPath.startsWith('polygon(') && !kids(el).length) {
      const pts = cs.clipPath.slice(8, -1).split(',').map(p => p.trim().split(/\s+/).map((v, i) => v.endsWith('%') ? parseFloat(v) / 100 * (i ? r.height : r.width) : parseFloat(v)));
      node.t = 'svg';
      node.color = node.fill || null; delete node.fill;
      node.shapes = [{ fill: node.color, stroke: null }];
      node.svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}"><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#000"/></svg>`;
      node.sizeH = node.sizeV = 'FIXED';
      return node;
    }
    if (el.tagName.toLowerCase() === 'svg' && el.classList.contains('line-chart__svg')) return lineChartNode(el, node);
    if (el.tagName.toLowerCase() === 'svg') return svgNode(el, node, cs);

    // text: one Figma text node (ranges for inline <b>, <span>); with a box of its own → a frame around the text
    if (zeroText(el) && !kids(el).length && boxy(el)) { node.t = 'box'; node.dir = 'H'; node.gap = { v: 0 }; node.ai = 'MIN'; node.jc = 'MIN'; node.pad = padOf(el, cs); node.kids = []; node.sizeH = node.sizeH === 'FILL' ? 'FILL' : 'FIXED'; node.sizeV = 'FIXED'; return node; }
    if (textLike(el)) {
      const t = textNode(el, r);
      if (!boxy(el)) { Object.assign(node, { t: 'text', text: t.text, nat: t.nat }); return lineBox(node); }
      node.t = 'box'; node.dir = 'H'; node.gap = { v: 0 }; node.ai = 'CENTER';
      node.jc = cs.textAlign === 'center' ? 'CENTER' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'MAX' : 'MIN';
      node.pad = padOf(el, cs);
      const cr = doc.createRange(); cr.selectNodeContents(el); const rr = cr.getBoundingClientRect();
      Object.assign(t, { name: 'text', cls: [], x: rr.left - R.left, y: rr.top - R.top, w: rr.width, h: rr.height, sizeH: 'HUG', sizeV: 'HUG' });
      node.kids = [lineBox(t)];
      return node;
    }
    node.t = 'box';
    const d = cs.display;
    let dir = /flex/.test(d) ? (cs.flexDirection.startsWith('column') ? 'V' : 'H') : /grid/.test(d) ? 'H' : 'V';
    node.dir = dir;
    if (/flex/.test(d)) {
      const gapProp = dir === 'H' ? ['column-gap', 'gap'] : ['row-gap', 'gap'];
      const [gv] = declared(el, gapProp);
      const gparts = gv ? gv.split(/\s+(?![^(]*\))/) : [];
      const gtok = gparts.length ? tokenOf(el, gv.startsWith('var(') && gparts.length === 1 ? gv : (dir === 'H' ? gparts[1] || gparts[0] : gparts[0])) : null;
      node.gap = { v: px(dir === 'H' ? cs.columnGap : cs.rowGap), var: gtok };
      // wrap: Figma wraps only a fixed / fill width. A box that hugs its content in the browser sits on one row → no wrap, it keeps hugging
      // (G-144: a FIXED width taken from Chrome's text metrics was a hair too narrow in Figma → «Breakdowns» pushed its «i» onto a second line)
      if (cs.flexWrap === 'wrap' && node.sizeH !== 'HUG') { node.wrap = true; node.cgap = { v: px(dir === 'H' ? cs.rowGap : cs.columnGap) }; }
      const map = { 'flex-start': 'MIN', start: 'MIN', normal: 'MIN', stretch: 'MIN', center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', baseline: 'BASELINE', 'space-between': 'SPACE_BETWEEN' };
      node.ai = map[cs.alignItems] || 'MIN';
      node.jc = map[cs.justifyContent] || 'MIN';
    } else if (/grid/.test(d)) { // grid → a row of its columns (or a centred cell)
      node.gap = { v: px(cs.columnGap) };
      const c = v => /center/.test(v) ? 'CENTER' : /end/.test(v) ? 'MAX' : 'MIN';
      node.ai = c(cs.alignItems); node.jc = c(cs.justifyItems + ' ' + cs.justifyContent);
    } else { node.gap = { v: 0 }; node.ai = 'MIN'; node.jc = 'MIN'; }
    node.pad = padOf(el, cs);
    node.kids = [];
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { // a bare text run inside a box
        const t = c.textContent.replace(/\s+/g, ' ').trim();
        if (!t || zeroText(el)) continue;
        const raw = c.textContent, a = raw.length - raw.trimStart().length, b = raw.trimEnd().length;
        const range = doc.createRange(); range.setStart(c, a); range.setEnd(c, b); const rr = range.getBoundingClientRect();
        node.kids.push(lineBox({ t: 'text', name: 'text', cls: [], x: rr.left - R.left, y: rr.top - R.top, w: rr.width, h: rr.height, nat: { w: rr.width, h: rr.height }, sizeH: 'HUG', sizeV: 'HUG', text: textInfo(el, t) }));
      } else if (c.nodeType === 1 && vis(c)) {
        const k = describe(c, dir);
        const spacer = () => ({ t: 'box', name: 'spacer', cls: [], dir: 'H', gap: { v: 0 }, pad: [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }], ai: 'MIN', jc: 'MIN', kids: [], x: 0, y: 0, w: 0, h: 0,
          sizeH: dir === 'H' ? 'FILL' : 'FIXED', sizeV: dir === 'H' ? 'FIXED' : 'FILL' });
        if (k.autoBefore) node.kids.push(spacer());
        node.kids.push(k);
        if (k.autoAfter) node.kids.push(spacer());
      }
    }
    // a block whose children sit on one line (text + an icon, a title + a caret) is a row, not a column
    if (!/flex|grid/.test(d) && node.kids.length > 1) {
      // one line = every child overlaps the others vertically
      if (Math.max(...node.kids.map(k => k.y)) < Math.min(...node.kids.map(k => k.y + k.h)) - 2) {
        node.dir = dir = 'H'; node.ai = 'CENTER';
        const gaps = node.kids.slice(1).map((k, i) => k.x - (node.kids[i].x + node.kids[i].w)).filter(g => g >= 0);
        node.gap = { v: gaps.length ? Math.round(Math.min(...gaps)) : 0 };
        node.kids.forEach(k => { k.sizeH = k.t === 'svg' || (k.t === 'box' && !k.kids.length) ? 'FIXED' : 'HUG'; k.sizeV = k.t === 'svg' || (k.t === 'box' && !k.kids.length) ? 'FIXED' : 'HUG'; });
      }
    }
    // margins along the main axis from the geometry — CSS collapses adjacent margins, Figma adds paddings
    if (node.kids.length && node.jc === 'MIN' && !node.wrap) {
      const V = dir === 'V', pos = V ? 'y' : 'x', size = V ? 'h' : 'w', before = V ? 0 : 3, after = V ? 2 : 1;
      const bw = node.stroke ? node.stroke.w : [0, 0, 0, 0];
      let prevEnd = node[pos] + bw[before] + node.pad[before].v, prev = null, afterSpacer = false;
      for (const k of node.kids) {
        if (k.name === 'spacer') { afterSpacer = true; continue; }
        if (k.margin || (prev && prev.margin)) {
          const space = k[pos] - prevEnd - (prev && !afterSpacer ? node.gap.v : 0);
          k.margin = k.margin || [{ v: 0 }, { v: 0 }, { v: 0 }, { v: 0 }];
          const declaredBefore = k.margin[before];
          k.margin[before] = { v: afterSpacer ? 0 : Math.max(0, Math.round(space * 100) / 100), var: declaredBefore && Math.abs(declaredBefore.v - space) < 0.5 ? declaredBefore.var : null };
          if (prev && prev.margin) prev.margin[after] = { v: 0 };
        }
        prevEnd = k[pos] + k[size]; prev = k; afterSpacer = false;
      }
      if (prev && prev.margin) { const end = node[pos] + node[size] - bw[after] - node.pad[after].v; prev.margin[after] = { v: Math.max(0, Math.round((end - prevEnd) * 100) / 100) }; if (node.sizeV === 'HUG' && V || node.sizeH === 'HUG' && !V) { /* hugging: keep the declared trailing margin only */ } }
      for (const k of node.kids) if (k.margin && !k.margin.some(m => m.v > 0)) delete k.margin;
    }
    // an empty box (bar fill, track, dot) has no content to hug — its size is fixed (from the token where there is one)
    if (!node.kids.length) { if (node.sizeH === 'HUG') node.sizeH = 'FIXED'; if (node.sizeV === 'HUG') node.sizeV = 'FIXED'; }
    return node;
  }
  function padOf(el, cs) {
    return SIDES.map(s => {
      const [v, n] = declared(el, [`padding-${s}`, 'padding']);
      let tok = null;
      if (v) tok = n === 'padding' ? tokenOf(el, split4(v)[SIDES.indexOf(s)]) : tokenOf(el, v);
      return { v: px(cs[`padding${cap(s)}`]), var: tok };
    });
  }
  // Fill needs something to fill: where every child fills an axis its hugging parent has nothing to measure,
  // so the biggest child hugs instead (in CSS the tallest column sets the row's height) — or the parent is fixed by its token
  function natural(n, ext) {
    // text: the glyph box (nat.h) is shorter than its line box; Figma's text node is lines × line-height (G-144)
    if (n.nat) return ext === 'h' && n.text && n.text.line ? Math.max(n.nat.h, Math.min(n.h, Math.ceil(n.nat.h / n.text.line - 0.01) * n.text.line)) : n.nat[ext];
    if (n.t !== 'box' || !n.kids || !n.kids.length) return n[ext];
    if (n[ext === 'w' ? 'sizeH' : 'sizeV'] === 'FIXED') return n[ext]; // a fixed child (icon slot, button, avatar) counts at its own size, not its content's (G-146)
    const along = (n.dir === 'H') === (ext === 'w');
    const bw = n.stroke && n.stroke.w || [0, 0, 0, 0]; // border-box: the border counts (G-146 — without it every bordered tag / item came out 2 px «too wide» → FIXED)
    const pad = ext === 'w' ? n.pad[1].v + n.pad[3].v + bw[1] + bw[3] : n.pad[0].v + n.pad[2].v + bw[0] + bw[2];
    const ks = n.kids.filter(k => k.name !== 'spacer').map(k => natural(k, ext) + (k.margin ? (ext === 'w' ? k.margin[1].v + k.margin[3].v : k.margin[0].v + k.margin[2].v) : 0));
    return pad + (along ? ks.reduce((a, b) => a + b, 0) + n.gap.v * Math.max(0, ks.length - 1) : Math.max(0, ...ks));
  }
  function settle(n) {
    if (!n.kids || !n.kids.length) return;
    n.kids.forEach(settle);
    if (n.t === 'box') for (const [key, ext] of [['sizeH', 'w'], ['sizeV', 'h']]) {
      if (n[key] !== 'HUG' || n.kids.some(k => k[key] === 'FILL')) continue;
      if (n.wrap && key === 'sizeV') continue; // a wrapping row grows with its lines — Figma hugs that height (G-146)
      if (n[ext] - natural(n, ext) > 1) n[key] = 'FIXED';
    }
    for (const [key, ext, fixed] of [['sizeH', 'w', n.wVar], ['sizeV', 'h', n.hVar]]) {
      if (n[key] === 'FIXED' || n[key] === 'FILL' && n !== tree) continue;
      if (!n.kids.every(k => k[key] === 'FILL')) continue;
      if (fixed) { n[key] = 'FIXED'; continue; }
      const big = n.kids.reduce((a, b) => (natural(b, ext) > natural(a, ext) ? b : a));
      big[key] = (big.t === 'box' && big.kids && big.kids.length) || big.t === 'text' || big.comp ? 'HUG' : 'FIXED';
      settle(big); // it hugs now — its own children must give it a size
    }
  }
  const tree = describe(root, null);
  tree.sizeH = 'FIXED';
  settle(tree);
  return { source: doc.location.pathname + doc.location.search, width: R.width, height: R.height, theme: doc.documentElement.dataset.theme, rules: RULES.length, tree };
};
