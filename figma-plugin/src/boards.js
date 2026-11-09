// G-174: the TO-BE page laid out as boards — grey boards with a large title,
// a Dark row and a Light row: Blocks · Collapsed · Expanded · In the red, a Logic board on the left,
// and green arrows from what is clicked on the Collapsed screen to what it opens (the Expanded screen or a block), each with a label.
// Arrows are plain vectors (connectors exist only in FigJam): moving a board does not move its arrows — run the command again.
const BOARD = { gap: 640, pad: 80, row: 480, title: 40 }; // gap: arrow lanes in the middle, labels between a lane and its target (review)
const INK = { dark: { board: '#5B5B5F', title: '#FFFFFF' }, light: { board: '#E3E3E6', title: '#111114' } };
const ARROW = '#22C55E';
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = h => [{ type: 'SOLID', color: hex(h) }];
const mono = () => ({ family: FONTS['JetBrains Mono'] ? 'JetBrains Mono' : 'Inter', style: (FONTS['JetBrains Mono'] || FONTS.Inter).Medium });
const inter = w => ({ family: 'Inter', style: FONTS.Inter[w] || FONTS.Inter.Regular });

// what each arrow says — the long version is on the Logic board
const ARROWS = [
  { from: 'expand', to: ['screen', 'Expanded', 'hero'], label: 'Click ⤢ — Total P&L takes the full width: period 1W · 1M · 3M · All, the chart with its scale. ⤡ collapses it' },
  { from: 'costs', to: ['screen', 'Expanded', 'costs'], label: 'Click the row — Costs & activity opens; click again — closes' },
  { from: 'side', to: ['block', 'Trading panel · collapsed'], label: 'Click — the Trading panel folds to icons; remembered for the next visit' },
  { from: 'chart', to: ['block', 'Chart · hover'], label: 'Hover — the running total, the day and its P&L' },
  { from: 'tipQuality', to: ['block', 'Info tip · Per trade'], label: 'Hover or focus i — the explanation; click pins it, Esc closes' },
  { from: 'tipBd', to: ['block', 'Info tip · Breakdowns'], label: 'Hover or focus i — what the terms mean' },
  { from: 'tabPair', to: ['block', 'Breakdowns · By pairs'], label: 'Click — the same table by pair' },
  { from: 'tabWeek', to: ['block', 'Breakdowns · By week'], label: 'Click — the same table by week' },
  { from: 'sort', to: ['block', 'Breakdowns · sorted by Winning %'], label: 'Click a heading — sort by it; again — the other way' },
];
const LOGIC = [
  ['What is clickable', [
    'Total P&L ⤢ — the card takes the full width: period switch 1W · 1M · 3M · All with the total for the period, the chart with its scale (top, bottom, $0 where it fits), the bars in two columns. The same button, now ⤡, collapses it.',
    'Cumulative P&L chart — hover: the line to the left of the cursor in colour, the rest grey, a tip with the running total, the day and its P&L.',
    'i — hover or keyboard focus shows the explanation; click pins it; Esc or a click outside closes it.',
    'Costs & activity — a closed row with what is inside; click opens and closes it.',
    'Breakdowns — tabs By session · By pairs · By week; a click on a column heading sorts by it: names A→Z first, numbers high → low first (Net profit opens sorted so); a click on the active column reverses it.',
    'Trading panel — the button folds it to an icon strip; a click is remembered for the next visit. Theme — the button in the Areas rail, for the whole platform.',
  ]],
  ['How numbers are shown', [
    'Every block names its period and whether it is Net (after costs): All time, Last 5 weeks · 60 trades.',
    'Profit and loss: sign + colour + direction, never colour alone. Bars start at zero: green to the right is profit, red to the left is loss.',
    'A table row with fewer than 10 trades → «few trades»: too few to act on. The takeaway row under each table names the weakest place and, if it loses, grades it: under 10 trades — too few trades to act on yet; 10–29 — worth a look, but the sample is still small; 30 and more — the first place to look. If every row is in profit, it names the smallest.',
    'Sample data — the daily curve is not in the brief: its days are made up so that every number on the screen still holds, and it is labelled. Illustrative — the «in the red» screen, not data from the brief.',
  ]],
  ['Keyboard and motion', [
    'Tabs, sort headings, i and ⤢ are reachable with Tab and work with Enter or Space.',
    'Reduce motion → no animation: the card expands and the chart switches period at once.',
  ]],
  ['Boards on this page', [
    'Collapsed — the screen as it opens. Expanded — Total P&L expanded and Costs & activity open. Blocks — states of single blocks. In the red — the same components on an illustrative account in the red. A green number sits on what is clicked; the line with the same number leads to what it opens.',
    'Bars and curves are data: where a row or a card has its own bar lengths or its own curve, it is a frame named after its component — Figma cannot change the size or the shape of a layer inside an instance. The components themselves, with every variant, are on the Components page.',
  ]],
];

async function boardTitle(chars, theme) {
  const t = figma.createText(); t.fontName = mono(); t.characters = chars; t.fontSize = BOARD.title; t.lineHeight = { unit: 'PIXELS', value: 52 };
  t.letterSpacing = { unit: 'PERCENT', value: 2 }; t.fills = solid(INK[theme].title); t.name = 'Title'; return t;
}
function tBoard(name, theme) {
  const b = figma.createFrame(); b.name = name; b.layoutMode = 'HORIZONTAL'; b.itemSpacing = 64; b.counterAxisAlignItems = 'MIN';
  b.paddingTop = b.paddingBottom = b.paddingLeft = b.paddingRight = BOARD.pad; b.primaryAxisSizingMode = 'AUTO'; b.counterAxisSizingMode = 'AUTO';
  b.fills = solid(INK[theme].board); b.cornerRadius = 0; return b;
}
async function column(b, title, theme) { // a board's body: title on top, content below
  const c = figma.createFrame(); c.name = 'Content'; c.layoutMode = 'VERTICAL'; c.itemSpacing = 64; c.fills = []; c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'AUTO';
  b.appendChild(c);
  if (title) c.appendChild(await boardTitle(title, theme));
  return c;
}
async function screenFrame(name, spec, width, dark) {
  const wrap = frame(name, 'VERTICAL', 0);
  fill(wrap, 'surface/page');
  const s = await renderSpec(spec, false);
  wrap.appendChild(s);
  s.resize(width, s.height); s.layoutSizingHorizontal = 'FIXED'; s.layoutSizingVertical = 'HUG';
  if (dark) await rebindDark(wrap);
  return { wrap, app: s };
}
async function blockCard(b, dark) {
  const card = frame('State · ' + b.name, 'VERTICAL', 16);
  card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 32;
  fill(card, 'surface/page');
  card.appendChild(await text((b.num ? b.num + ' · ' : '') + 'State · ' + b.name, 'overline', 'text/muted'));
  if (b.label) card.appendChild(await text(b.label, 'caption', 'text/secondary'));
  const spec = dark && b.dark ? b.dark : b.light;
  const c = await renderSpec(spec, false);
  if (!b.overlays.length) {
    card.appendChild(c);
    c.resize(b.w, c.height); c.layoutSizingHorizontal = 'FIXED'; if (c.layoutMode && c.layoutMode !== 'NONE' || c.type === 'INSTANCE') c.layoutSizingVertical = 'HUG';
  } else { // a tip opens over the page: block and tip in one plain frame, at their places in the prototype
    const holder = figma.createFrame(); holder.name = b.name; holder.fills = []; holder.clipsContent = false;
    const ox = Math.max(0, -Math.min(...b.overlays.map(o => o.x))), oy = Math.max(0, -Math.min(...b.overlays.map(o => o.y)));
    holder.appendChild(c); c.x = ox; c.y = oy; c.resize(b.w, c.height); c.layoutSizingVertical = 'HUG'; // resize fixes both axes — the height follows the content again
    let W = ox + b.w, H = oy + c.height;
    for (const o of b.overlays) {
      const ov = await renderSpec(dark && o.dark ? o.dark : o.light, false);
      holder.appendChild(ov); ov.x = ox + o.x; ov.y = oy + o.y; ov.resize(o.w, ov.height); ov.layoutSizingVertical = 'HUG';
      W = Math.max(W, ov.x + o.w); H = Math.max(H, ov.y + ov.height);
    }
    holder.resize(W, H);
    card.appendChild(holder);
  }
  if (dark) await rebindDark(card);
  return card;
}
async function logicBoard(theme) {
  const b = tBoard('Logic · how the screen works', theme);
  const col = await column(b, 'Logic · how the screen works', theme);
  for (const [head, items] of LOGIC) {
    const card = figma.createFrame(); card.name = head; card.layoutMode = 'VERTICAL'; card.itemSpacing = 14;
    card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 40; card.fills = solid('#FFFFFF'); card.cornerRadius = 20;
    col.appendChild(card); card.resize(760, 100); card.counterAxisSizingMode = 'FIXED'; card.primaryAxisSizingMode = 'AUTO';
    const add = (s, font, size, line, color) => { const t = figma.createText(); t.fontName = font; t.characters = s; t.fontSize = size; t.lineHeight = { unit: 'PIXELS', value: line }; t.fills = solid(color); card.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; return t; };
    add(head, inter('Semi Bold'), 24, 32, '#111114');
    for (const s of items) add('• ' + s, inter('Regular'), 17, 26, '#2A2A2E');
  }
  return b;
}
// numbered marks (G-175): a green badge on the button inside the screen, the same number where the line leaves the board and on the
// state it opens; lines run only through the gaps between boards, in lanes ordered so that they do not cross
function badge(host, num, cx, cy) {
  const c = figma.createEllipse(); c.name = 'Mark ' + num; host.appendChild(c); c.resize(28, 28); c.x = cx - 14; c.y = cy - 14; c.fills = solid(ARROW);
  c.strokes = solid('#FFFFFF'); c.strokeWeight = 2;
  const t = figma.createText(); t.fontName = inter('Semi Bold'); t.characters = String(num); t.fontSize = 14; t.lineHeight = { unit: 'PIXELS', value: 28 };
  t.fills = solid('#FFFFFF'); t.textAlignHorizontal = 'CENTER'; host.appendChild(t); t.resize(28, 28); t.x = cx - 14; t.y = cy - 14; t.name = 'Mark ' + num + ' · number';
  for (const n of [c, t]) n.setPluginData('goodface', 'arrow');
}
async function line(host, pts, num) {
  const minX = Math.min(...pts.map(p => p.x)), minY = Math.min(...pts.map(p => p.y));
  const v = figma.createVector(); v.name = 'Arrow ' + num; host.appendChild(v);
  await v.setVectorNetworkAsync({
    vertices: pts.map((p, i) => ({ x: p.x - minX, y: p.y - minY, strokeCap: i === pts.length - 1 ? 'ARROW_LINES' : 'NONE' })),
    segments: pts.slice(1).map((p, i) => ({ start: i, end: i + 1 })), regions: [],
  });
  v.x = minX; v.y = minY; v.strokes = solid(ARROW); v.strokeWeight = 2; v.strokeJoin = 'ROUND'; v.setPluginData('goodface', 'arrow');
}
function note(host, chars, x, y, w) { // a label without a frame: a dark plate and white text (frames would show their name above them)
  const t = figma.createText(); t.fontName = inter('Medium'); t.characters = chars; t.fontSize = 15; t.lineHeight = { unit: 'PIXELS', value: 22 };
  t.fills = solid('#FFFFFF'); t.textAutoResize = 'HEIGHT'; t.resize(w - 24, 22);
  const r = figma.createRectangle(); r.name = 'Note plate'; r.fills = solid('#0E0E10'); r.cornerRadius = 8; host.appendChild(r);
  host.appendChild(t); t.name = 'Note'; t.x = x + 12; t.y = y + 8; r.resize(w, t.height + 16); r.x = x; r.y = y;
  for (const n of [r, t]) n.setPluginData('goodface', 'arrow');
  return r;
}
// lanes: try every order of the vertical segments, keep the one with the fewest crossings (≤ 7 lines → ≤ 5040 orders)
function lanes(list, x0, step) {
  const perms = a => a.length <= 1 ? [a] : a.flatMap((v, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [v].concat(p)));
  const cost = order => {
    const xs = {}; order.forEach((k, i) => { xs[k] = x0 + i * step; });
    let c = 0;
    for (const a of list) for (const b of list) {
      if (a === b) continue;
      const bx = xs[b.k], lo = Math.min(b.S.y, b.E.y), hi = Math.max(b.S.y, b.E.y);
      for (const [y, xa, xb] of [[a.S.y, a.S.x, xs[a.k]], [a.E.y, xs[a.k], a.E.x]]) // a's horizontal segments against b's vertical one
        if (y > lo && y < hi && bx > Math.min(xa, xb) && bx < Math.max(xa, xb)) c++;
    }
    return c;
  };
  let best = list.map(a => a.k), bestC = Infinity;
  for (const p of perms(list.map(a => a.k))) { const c = cost(p); if (c < bestC) { bestC = c; best = p; } if (!c) break; }
  const xs = {}; best.forEach((k, i) => { xs[k] = x0 + i * step; }); return xs;
}
const box = (n, host) => { const a = n.absoluteBoundingBox, h = host.absoluteBoundingBox; return { x: a.x - h.x, y: a.y - h.y, w: a.width, h: a.height }; };
// numbers: top to bottom by where the button is on the screen
const ORDER = () => ARROWS.filter(a => DATA.screen.marks[a.from]).sort((a, b) => DATA.screen.marks[a.from].y - DATA.screen.marks[b.from].y);
const numOf = name => { const i = ORDER().findIndex(a => a.to[0] === 'block' && a.to[1] === name); return i < 0 ? null : i + 1; };

async function buildBoards(parent) {
  for (const n of parent.children.filter(c => c.getPluginData('goodface') === 'boards' || c.name === 'Check · code ↔ Figma')) n.remove(); // only what this command made — hand-made frames stay
  const S = DATA.screen;
  const host = figma.createFrame(); host.name = 'TO-BE · Boards'; host.fills = []; host.clipsContent = false;
  parent.appendChild(host);
  const others = parent.children.filter(c => c !== host);
  host.x = others.length ? Math.max(...others.map(n => n.x + n.width)) + 600 : 0; host.y = 0;

  const rows = [], checks = [];
  let y = 0;
  const logic = await logicBoard('dark'); host.appendChild(logic); logic.x = 0; logic.y = 0;
  const x0 = logic.width + BOARD.gap;
  const order = ORDER();
  for (const theme of ['dark', 'light']) {
    const dark = theme === 'dark', T = dark ? 'Dark' : 'Light';
    const row = { theme, blocks: {}, screens: {} };
    // Blocks: left — the Trading panel (its line enters from the top) and the states no line points to; right — the states the lines open, in screen order
    const bb = tBoard(`Performance · Blocks · ${T}`, theme);
    const bcol = await column(bb, `Performance · Blocks · ${T}`, theme);
    const cols = figma.createFrame(); cols.name = 'Columns'; cols.layoutMode = 'HORIZONTAL'; cols.itemSpacing = 64; cols.fills = []; cols.counterAxisAlignItems = 'MIN';
    cols.primaryAxisSizingMode = 'AUTO'; cols.counterAxisSizingMode = 'AUTO'; bcol.appendChild(cols);
    const mk = align => { const c = figma.createFrame(); c.name = 'Column'; c.layoutMode = 'VERTICAL'; c.itemSpacing = 48; c.fills = []; c.counterAxisAlignItems = align; c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'AUTO'; cols.appendChild(c); return c; };
    const left = mk('MIN'), right = mk('MAX');
    const all = (S.states || []).map(st => ({ name: st.name, light: st.light, dark: st.dark, w: null, overlays: [] })).concat(S.blocks || []);
    const side = b => b.name === 'Trading panel · collapsed';
    const rank = b => side(b) ? -1 : numOf(b.name) == null ? 1000 : numOf(b.name);
    for (const b of all.slice().sort((p, q) => rank(p) - rank(q))) {
      const w = b.w || b.light.w, num = numOf(b.name), a = order.find(x => x.to[0] === 'block' && x.to[1] === b.name);
      const card = await blockCard(Object.assign({}, b, { w, num, label: a && a.label }), dark);
      (num != null && !side(b) ? right : left).appendChild(card);
      row.blocks[b.name] = card;
    }
    host.appendChild(bb);
    const boards = [bb];
    const shot = async (title, spec, raw, key) => {
      const b = tBoard(title, theme); const c = await column(b, title, theme);
      const { wrap, app } = await screenFrame(title, spec, S.width, dark);
      c.appendChild(wrap);
      host.appendChild(b); boards.push(b);
      row.screens[key] = app;
      if (raw) checks.push([`${T} · ${key}`, app, raw]);
    };
    await shot(`TO-BE · Performance · Summary · ${T} · Collapsed`, dark && S.treeDark ? S.treeDark : S.tree, dark ? S.rawDark : S.raw, 'Collapsed');
    for (const sc of S.screens || []) await shot(`TO-BE · Performance · Summary · ${T} · ${sc.name}`, dark && sc.dark ? sc.dark : sc.light, dark ? null : sc.raw, sc.name);
    if (S.loss) await shot(`TO-BE · Performance · Summary · ${T} · In the red (illustrative)`, dark && S.loss.dark ? S.loss.dark : S.loss.light, dark ? null : S.loss.raw, 'In the red');
    row.boards = boards;
    rows.push(row);
  }
  // sizes get their second try first, then the boards are placed, checked and the lines drawn
  const sized = sizePass();
  for (const row of rows) {
    let x = x0;
    for (const b of row.boards) { b.x = x; b.y = y; x += b.width + BOARD.gap; }
    y += Math.max(...row.boards.map(b => b.height)) + BOARD.row;
  }
  for (let i = 0; i < checks.length; i++) checks[i] = [checks[i][0], selfCheck({ children: [checks[i][1]] }, checks[i][2], 2)];
  let n = 0;
  for (const row of rows) {
    const col = row.screens.Collapsed, cb = box(col, host);
    const bbx = box(row.boards[0], host), cbx = box(row.boards[1], host);
    const L = [], R = [];
    order.forEach((a, i) => {
      const num = i + 1, m = S.marks[a.from];
      const Sy = cb.y + m.y + m.h / 2;
      badge(host, num, cb.x + m.x, cb.y + m.y); // on the button
      if (a.to[0] === 'screen') {
        const app = row.screens[a.to[1]], sc = (S.screens || []).find(s => s.name === a.to[1]); if (!app || !sc || !sc.marks[a.to[2]]) return;
        const ab = box(app, host), t = sc.marks[a.to[2]], eb = box(app.parent.parent.parent, host); // app → wrap → Content → board
        badge(host, num, ab.x + t.x, ab.y + t.y); // on what it opens
        R.push({ k: num, a, S: { x: cbx.x + cbx.w, y: Sy }, E: { x: eb.x, y: ab.y + t.y + 14 } });
      } else {
        const card = row.blocks[a.to[1]]; if (!card) return;
        const kb = box(card, host);
        if (a.to[1] === 'Trading panel · collapsed') L.push({ k: num, a, S: { x: cbx.x, y: Sy }, E: { x: kb.x + kb.w / 2, y: kb.y }, top: true });
        else L.push({ k: num, a, S: { x: cbx.x, y: Sy }, E: { x: kb.x + kb.w, y: kb.y + 30 } });
      }
    });
    // left gap: from the Collapsed board's left edge to the right edge of the state; the Trading panel line enters its card from the top
    const gapL = cbx.x - (bbx.x + bbx.w), side = L.filter(l => !l.top);
    const lx = lanes(side, bbx.x + bbx.w + gapL * 0.3, 22);
    for (const l of L) {
      badge(host, l.k, l.S.x, l.S.y);
      if (l.top) { const yTop = l.E.y - 32 /* the empty band between the board title and the cards, not through the title */, gx = bbx.x + bbx.w + gapL * 0.3 + side.length * 22 + 22; await line(host, [{ x: l.S.x - 14, y: l.S.y }, { x: gx, y: l.S.y }, { x: gx, y: yTop }, { x: l.E.x, y: yTop }, { x: l.E.x, y: l.E.y }], l.k); }
      else await line(host, [{ x: l.S.x - 14, y: l.S.y }, { x: lx[l.k], y: l.S.y }, { x: lx[l.k], y: l.E.y }, { x: l.E.x, y: l.E.y }], l.k);
      n++;
    }
    // right gap: lines to the Expanded board, a note under the start of each
    const gapR = row.boards[2] ? box(row.boards[2], host).x - (cbx.x + cbx.w) : BOARD.gap;
    const rx = lanes(R, cbx.x + cbx.w + gapR * 0.55, 22);
    for (const r of R) {
      badge(host, r.k, r.S.x, r.S.y);
      await line(host, [{ x: r.S.x + 14, y: r.S.y }, { x: rx[r.k], y: r.S.y }, { x: rx[r.k], y: r.E.y }, { x: r.E.x, y: r.E.y }], r.k);
      note(host, r.k + ' · ' + r.a.label, cbx.x + cbx.w + 24, r.S.y + 22, Math.max(200, gapR * 0.55 - 48));
      n++;
    }
  }
  const kids = host.children;
  host.resize(Math.max(...kids.map(k => k.x + k.width)), Math.max(...kids.map(k => k.y + k.height)));
  host.setPluginData('goodface', 'boards');
  await checkReport(parent, checks, sized);
  const ck = parent.children.find(c => c.name === 'Check · code ↔ Figma'); if (ck) { ck.x = host.x; ck.y = host.y - ck.height - 160; }
  CHECK = checks;
  log.push(`Boards: Logic + ${rows.length} rows (Blocks · Collapsed · ${(S.screens || []).map(s => s.name).join(' · ')}${S.loss ? ' · In the red' : ''}), ${n} numbered lines`);
  return [host];
}
