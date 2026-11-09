// G-173: «Add loss state» — the illustrative «in the red» page (prototype tobe/states.html) as real layers:
// instances of the components ALREADY in this file (built 08.11), frames where those components cannot show a part.
// Only adds: reads the file's variables, text styles and components, changes none of them; replaces only its own frame
// (plugin data goodface = loss). Placed to the right of everything on the page that holds the TO-BE screen.
async function findComponents(names) {
  if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync();
  const found = {};
  for (const page of figma.root.children) {
    for (const n of page.findAll(x => (x.type === 'COMPONENT_SET' || (x.type === 'COMPONENT' && !(x.parent && x.parent.type === 'COMPONENT_SET'))) && names.includes(x.name))) {
      if (!found[n.name]) found[n.name] = n;
    }
  }
  return found;
}
async function addLossState() {
  const L = DATA.loss;
  if (!L || !L.tree) throw new Error('No loss state in this build — run node build-plugin.js');
  FONTS = await interStyles();
  // variables and text styles as they are in the file — read only
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const byName = n => cols.find(c => c.name === n);
  const sem = byName('Semantic') || byName('Semantic · Light');
  if (!sem) throw new Error('No Semantic variables in this file — this command adds to a file built by «Build everything»');
  V = { color: await variablesOf(sem), dim: byName('Dimensions') ? await variablesOf(byName('Dimensions')) : {}, prim: byName('Primitives') ? await variablesOf(byName('Primitives')) : {}, semantic: sem };
  const styles = await figma.getLocalTextStylesAsync();
  T = {};
  for (const t of DATA.text) { const st = styles.find(s => s.name === t.name); if (st) T[t.name] = st; }
  cssIndex();
  // components by name
  const names = [...new Set(L.comps)];
  const found = await findComponents(names);
  const missing = names.filter(n => !found[n]);
  if (missing.length) throw new Error('Components not found in this file: ' + missing.join(', ') + ' — nothing was added');
  Object.assign(SETS, found);

  // the page with the TO-BE screen, else the current page
  let page = figma.currentPage;
  for (const p of figma.root.children) if (p.findAll(x => x.type === 'FRAME' && /^TO-BE · /.test(x.name)).length) { page = p; break; }
  await figma.setCurrentPageAsync(page);
  for (const n of page.children.filter(n => n.getPluginData('goodface') === 'loss')) n.remove();

  const wrap = frame('Illustrative state · In the red · Light', 'VERTICAL', 16);
  wrap.paddingTop = wrap.paddingBottom = wrap.paddingLeft = wrap.paddingRight = 32;
  fill(wrap, 'surface/page');
  page.appendChild(wrap);
  const label = T.overline ? await text(L.label, 'overline', 'text/muted') : null;
  if (label) wrap.appendChild(label);
  const s = await renderSpec(L.tree, false);
  wrap.appendChild(s);
  s.resize(L.width, s.height); s.layoutSizingHorizontal = 'FIXED'; s.layoutSizingVertical = 'HUG';
  const sized = sizePass();
  const others = page.children.filter(n => n !== wrap);
  wrap.x = others.length ? Math.max(...others.map(n => n.x + n.width)) + 400 : 0;
  wrap.y = others.length ? Math.min(...others.map(n => n.y)) : 0;
  wrap.setPluginData('goodface', 'loss');
  // self-check against the prototype: the screen is the 2nd child (after the label)
  const r = selfCheck({ children: [s] }, L.raw, 2);
  figma.viewport.scrollAndZoomIntoView([wrap]);
  const out = [`Loss state on «${page.name}»: ${L.instances} instances of this file's components, ${L.frames.length} part(s) as frames (${L.frames.join('; ') || 'none'})`,
    `Check: ${r.n - r.rows.length} of ${r.n} layers match the prototype` + (sized.n ? ` · bar lengths ${sized.first + sized.second} of ${sized.n} held` : ''),
    'nothing else was changed'];
  if (r.rows.length) console.log('off:\n' + r.rows.slice(0, 30).map(x => x.label + ' · ' + x.d).join('\n'));
  if (sized.failed.length) console.log('bars:\n' + sized.failed.join('\n'));
  if (unknownTokens.size) out.push('raw values for: ' + [...unknownTokens].join(', '));
  return out;
}
