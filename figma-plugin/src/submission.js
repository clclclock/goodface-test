// G-160: «Add submission texts» — puts the texts the brief asks for (audit, time, difficulties, AI, product) as text cards
// on their own. It touches nothing else: only layers this command made earlier (plugin data goodface = submission) are replaced.
// Page: an existing «Здача» page; else a new one; on the Starter plan (3 pages) — to the right of everything on the current page.
async function addSubmission() {
  const S = DATA.submission;
  if (!S || !S.frames || !S.frames.length) throw new Error('No submission texts in this build — run node build-plugin.js');
  const TAG = 'submission';
  const styles = (await figma.listAvailableFontsAsync()).filter(f => f.fontName.family === 'Inter').map(f => f.fontName.style);
  const pick = (...c) => c.find(x => styles.includes(x)) || 'Regular';
  const F = { r: { family: 'Inter', style: pick('Regular') }, m: { family: 'Inter', style: pick('Medium') }, b: { family: 'Inter', style: pick('Semi Bold', 'SemiBold', 'Bold') } };
  for (const f of Object.values(F)) await figma.loadFontAsync(f);
  const rgb = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });

  let page = figma.root.children.find(p => p.type === 'PAGE' && p.name === 'Здача'), onCurrent = false;
  if (!page) { try { page = figma.createPage(); page.name = 'Здача'; } catch (e) { page = figma.currentPage; onCurrent = true; } }
  if (page.loadAsync) await page.loadAsync();
  await figma.setCurrentPageAsync(page);
  for (const n of page.children.filter(n => n.getPluginData('goodface') === TAG)) n.remove();

  const text = (s, font, size, line, color) => {
    const t = figma.createText(); t.fontName = font; t.characters = s; t.fontSize = size;
    t.lineHeight = { unit: 'PIXELS', value: line }; t.fills = [{ type: 'SOLID', color: rgb(color) }]; t.name = s.slice(0, 40); return t;
  };
  const auto = (name, dir, gap) => {
    const f = figma.createFrame(); f.name = name; f.layoutMode = dir; f.itemSpacing = gap;
    f.primaryAxisSizingMode = 'AUTO'; f.counterAxisSizingMode = 'AUTO'; f.fills = []; return f;
  };
  const row = auto('Здача · тексти', 'HORIZONTAL', 40);
  row.counterAxisAlignItems = 'MIN';
  page.appendChild(row);
  for (const fr of S.frames) {
    const card = auto(fr.title, 'VERTICAL', 14);
    card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 48;
    card.fills = [{ type: 'SOLID', color: rgb('#FFFFFF') }];
    card.cornerRadius = 24;
    row.appendChild(card);
    card.resize(fr.wide ? 760 : 640, 100); card.counterAxisSizingMode = 'FIXED'; card.primaryAxisSizingMode = 'AUTO';
    const add = t => { card.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; return t; };
    add(text(fr.title, F.b, 32, 40, '#111111'));
    for (const b of fr.body) {
      if (b.t === 'h') add(text(b.s, F.b, 22, 30, '#111111'));
      else if (b.t === 'row') {
        const t = add(text(`${b.a} — ${b.b}${b.c ? '\n' + b.c : ''}`, F.r, 18, 28, '#111111'));
        t.setRangeFontName(0, b.a.length + 3 + b.b.length, F.m);
        if (b.c) t.setRangeFills(b.a.length + 4 + b.b.length, t.characters.length, [{ type: 'SOLID', color: rgb('#5F646B') }]);
      } else {
        const s = b.t === 'li' && !/^\d+\. /.test(b.s) ? '• ' + b.s : b.s;
        const t = add(text(s, F.r, 18, 28, '#2A2A2A'));
        const k = s.indexOf(':'); // a label before «:» at the start («Що не так:», «Метрика:») — medium
        if (k > 0 && k < 40) t.setRangeFontName(0, k + 1, F.m);
      }
    }
  }
  if (onCurrent) {
    const others = page.children.filter(n => n !== row);
    const right = others.length ? Math.max(...others.map(n => n.x + n.width)) : 0;
    const top = others.length ? Math.min(...others.map(n => n.y)) : 0;
    row.x = right + 400; row.y = top;
  } else { row.x = 0; row.y = 0; }
  row.setPluginData('goodface', TAG);
  figma.viewport.scrollAndZoomIntoView([row]);
  return [`Submission texts: ${S.frames.length} cards on «${page.name}»${onCurrent ? ' (no room for a new page — placed to the right of everything on this page)' : ''}; nothing else was changed`];
}
