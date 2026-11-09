// TO-BE behaviour: icons, Tabs, Info Tip, column sort. No data here: every number is in the markup.
(() => {
  // icons (same Lucide set as AS-IS)
  document.querySelectorAll('i[data-icon]').forEach(el => { el.setAttribute('aria-hidden', 'true'); if (!el.firstChild) el.innerHTML = (window.ICONS || {})[el.dataset.icon] || ''; });

  // Tabs: one Breakdown Table at a time (the same data, sliced differently)
  document.querySelectorAll('.segmented[role="tablist"]').forEach(list => {
    const block = list.closest('.stat-block');
    list.addEventListener('click', e => {
      const tab = e.target.closest('.segmented__item[data-tab]'); if (!tab) return;
      list.querySelectorAll('.segmented__item').forEach(b => { const on = b === tab; b.dataset.state = on ? 'active' : 'default'; b.setAttribute('aria-selected', on); });
      block.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  // Takeaway under each Breakdown Table: the answer to «where do I lose?» in one line, read only from the rows above it
  // (the weakest row, its trades, and whether that is enough to act on — the same rule as the «few trades» rows)
  const NOUN = { session: ['session', 'sessions'], pair: ['pair', 'pairs'], week: ['week', 'weeks'] };
  document.querySelectorAll('.breakdown-table[data-panel]').forEach(panel => {
    const rows = [...panel.querySelectorAll('.breakdown-row:not([data-kind="head"])')].map(r => {
      const net = r.querySelector('.breakdown-row__net .breakdown-row__num').textContent.trim();
      return { name: r.querySelector('.breakdown-row__name b').textContent, netText: net,
        net: parseFloat(net.replace(/[^\d.]/g, '')) * (/^[−-]/.test(net) ? -1 : 1),
        trades: parseInt(r.querySelector('.breakdown-row__name small').textContent, 10), few: r.dataset.sample === 'low' };
    });
    if (!rows.length) return;
    const [one, many] = NOUN[panel.dataset.panel] || ['row', 'rows'];
    const losing = rows.filter(r => r.net < 0), weak = rows.reduce((a, b) => (b.net < a.net ? b : a));
    const lead = losing.length === 1 ? 'Only losing ' + one + ': ' : losing.length ? 'Weakest ' + one + ': ' : 'All ' + many + ' in profit · smallest: ';
    const verdict = weak.net >= 0 ? '' : weak.few ? ' — too few trades to act on yet' : ' — the first place to look';
    const p = document.createElement('p'); p.className = 'breakdown-table__insight';
    p.innerHTML = '<b>Takeaway</b> ' + lead + weak.name + ' ' + weak.netText + ' over ' + weak.trades + ' trades' + verdict;
    panel.appendChild(p);
  });
  // Per trade vs per day: two honest answers that look opposite — say so where the reader meets the first one
  const perTrade = [...document.querySelectorAll('.stat-group')].find(g => /^Per trade/.test(((g.querySelector('.stat-group__title') || {}).textContent || '').trim()));
  if (perTrade) perTrade.insertAdjacentHTML('beforeend', '<p class="stat-group__note">Per trade, wins are bigger. Per day it is the other way round — a losing day is bigger than a winning one (see Average day above).</p>');

  // Info Tip: the «i» opens the definitions for its group (state = closed | open)
  // G-69: overlay above the trigger (popover layer) — hover / focus shows, click pins, Esc or click outside closes
  document.querySelectorAll('.info-tip__trigger').forEach(btn => {
    const tip = document.getElementById(btn.getAttribute('aria-controls'));
    tip.hidden = false; tip.setAttribute('popover', 'manual');
    let pinned = false;
    const place = () => {
      const r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 4;
      const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
      const above = r.top - h - gap >= 8;
      tip.dataset.placement = above ? 'top' : 'bottom';
      const top = above ? r.top - h - gap : r.bottom + gap;
      Object.assign(tip.style, { position: 'fixed', inset: 'auto', margin: '0', left: left + 'px', top: top + 'px' });
      // tail under the «i»: its centre = the trigger's centre, kept off the rounded corners
      const arrow = tip.querySelector('.info-tip__arrow'), tail = tip.querySelector('.info-tip__tail');
      if (arrow && tail) { const aw = arrow.offsetWidth, x = Math.min(Math.max(12, r.left + r.width / 2 - left - aw / 2), w - aw - 12); tail.style.paddingLeft = x + 'px'; }
    };
    const show = () => { if (!tip.matches(':popover-open')) tip.showPopover(); place(); tip.dataset.state = 'open'; btn.setAttribute('aria-expanded', 'true'); };
    const hide = () => { if (tip.matches(':popover-open')) tip.hidePopover(); pinned = false; tip.dataset.state = 'closed'; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('mouseenter', show);
    btn.addEventListener('focus', show);
    let overTip = false;
    tip.addEventListener('mouseenter', () => { overTip = true; });
    tip.addEventListener('mouseleave', () => { overTip = false; if (!pinned) hide(); });
    btn.addEventListener('mouseleave', () => { setTimeout(() => { if (!pinned && !overTip) hide(); }, 80); }); /* the tip stays while the pointer moves onto it (WCAG 1.4.13) */
    btn.addEventListener('blur', () => { if (!pinned) hide(); });
    btn.addEventListener('click', () => { if (pinned) hide(); else { pinned = true; show(); } });
    document.addEventListener('click', e => { if (pinned && !tip.contains(e.target) && !btn.contains(e.target)) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    addEventListener('scroll', () => { if (tip.matches(':popover-open')) place(); }, { passive: true });
  });

  // G-77: Disclosure — height and body opacity animate together, same duration / easing as the Trading panel
  const motion = () => { const cs = getComputedStyle(document.documentElement); return { ms: parseFloat(cs.getPropertyValue('--duration-expand')) || 0, ease: cs.getPropertyValue('--ease-in-out').trim() || 'ease' }; };
  document.querySelectorAll('details.disclosure').forEach(d => {
    const sum = d.querySelector('summary'), body = d.querySelector('.disclosure__body'); let run = null;
    sum.addEventListener('click', e => {
      const { ms, ease } = motion(); if (!ms) return;           // reduce motion → native, instant
      e.preventDefault();
      const from = d.offsetHeight; const opening = !d.open || d.dataset.anim === 'closing';
      if (run) { run.cancel(); run = null; }
      d.dataset.anim = opening ? 'opening' : 'closing';
      if (opening) d.open = true;
      const edge = d.offsetHeight - d.clientHeight;           // borders
      const to = opening ? sum.offsetHeight + body.offsetHeight + edge : sum.offsetHeight + edge;
      run = d.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: ms, easing: ease });
      body.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: ease, fill: 'forwards' });
      run.onfinish = () => { if (!opening) d.open = false; delete d.dataset.anim; body.getAnimations().forEach(x => x.cancel()); run = null; };
    });
  });

  // Sort: click a column heading (as in the original); state shown by data-sort on the head cell
  const num = s => parseFloat(String(s).replace(/[^0-9.\-]/g, '')) || 0;
  const key = {
    'breakdown-row__name': r => r.querySelector('.breakdown-row__name b').textContent,
    'breakdown-row__net': r => num(r.querySelector('.breakdown-row__net .breakdown-row__num').textContent),
    'breakdown-row__rate': r => num(r.querySelector('.breakdown-row__rate .breakdown-row__num').textContent),
    'breakdown-row__pl': r => num(r.querySelector('.breakdown-row__pl .mini-bar__value').textContent),
  };
  document.querySelectorAll('.breakdown-table').forEach(table => {
    const head = table.querySelector('.breakdown-row[data-kind="head"]');
    // G-78: sort icon (Lucide) — none: arrow-up-down on hover, desc: arrow-down, asc: arrow-up
    const ICON = { none: 'arrow-up-down', desc: 'arrow-down', asc: 'arrow-up' };
    const syncIcons = () => head.querySelectorAll('[data-sort]').forEach(c => { let i = c.querySelector('.breakdown-row__sort'); if (!i) { i = document.createElement('i'); i.className = 'breakdown-row__sort'; i.setAttribute('aria-hidden', 'true'); c.appendChild(i); } const n = ICON[c.dataset.sort] || ICON.none; c.setAttribute('aria-sort', c.dataset.sort === 'desc' ? 'descending' : c.dataset.sort === 'asc' ? 'ascending' : 'none'); if (i.dataset.icon !== n) { i.dataset.icon = n; i.innerHTML = (window.ICONS || {})[n] || ''; } });
    syncIcons(); new MutationObserver(syncIcons).observe(head, { subtree: true, attributes: true, attributeFilter: ['data-sort'] });
    head.querySelectorAll('[data-sort]').forEach(cell => { cell.tabIndex = 0; cell.setAttribute('role', 'button'); cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cell.click(); } }); });
    head.querySelectorAll('[data-sort]').forEach(cell => cell.addEventListener('click', () => {
      const cls = [...cell.classList].find(c => key[c]);
      const dir = cell.dataset.sort === 'desc' ? 'asc' : cell.dataset.sort === 'asc' ? 'desc' : (cls === 'breakdown-row__name' ? 'asc' : 'desc'); // names start A→Z, numbers high → low
      head.querySelectorAll('[data-sort]').forEach(c => { c.dataset.sort = 'none'; });
      cell.dataset.sort = dir;
      const rows = [...table.querySelectorAll('.breakdown-row:not([data-kind])')];
      rows.sort((a, b) => { const x = key[cls](a), y = key[cls](b); const d = typeof x === 'string' ? x.localeCompare(y) : x - y; return dir === 'asc' ? d : -d; });
      // G-75: rows slide to their new place (FLIP) — the eye can follow where a row went
      const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
      const insight = table.querySelector('.breakdown-table__insight'); rows.forEach(r => table.insertBefore(r, insight)); // above the takeaway line
      const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-base')) || 0;
      if (ms > 0) rows.forEach(r => { const dy = before.get(r) - r.getBoundingClientRect().top; if (dy) r.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(0.2, 0, 0, 1)' }); });
    }));
  });
})();

// G-138: Segmented Control — the selection slides from the old item to the new one instead of jumping.
// Behaviour only: a ghost of the active fill moves between the two items (Figma: Smart Animate); reduce motion → no ghost.
// The text colour travels with the fill (G-138b): the old label turns «unselected» as the fill leaves it (first half of the move),
// the new one turns «selected» as the fill arrives (second half) — never dark text on the dark track, nor light text on the light fill.
// Two listeners on the click: before the control's own handler (capture) it notes the old item and where it is; after it
// (bubble) the state has changed and nothing is drawn yet — the slide starts in the same task, so no frame shows the new
// item filled before the ghost (otherwise the ghost flickers).
let segFrom = null;
document.addEventListener('click', e => {
  segFrom = null;
  const item = e.target.closest('.segmented__item'); if (!item) return;
  const track = item.closest('.segmented'); if (!track) return;
  const from = track.querySelector('.segmented__item[data-state="active"]'); if (!from || from === item) return;
  segFrom = { track, from, a: from.getBoundingClientRect() };
}, true);
document.addEventListener('click', () => {
  const p = segFrom; segFrom = null; if (!p) return;
  const { track, from, a } = p;
  {
    const to = track.querySelector('.segmented__item[data-state="active"]'); if (!to || to === from) return;
    const keep = [from, to].map(x => ({ x, tr: x.style.transition, bg: x.style.backgroundColor }));
    [from, to].forEach(x => { x.style.transition = 'none'; }); // before any measuring — else the CSS fades start for a frame
    to.style.backgroundColor = 'transparent';
    const cs = getComputedStyle(track), ms = parseFloat(cs.getPropertyValue('--duration-base')) || 0;
    if (!ms) { keep.forEach(k => { k.x.style.transition = k.tr; k.x.style.backgroundColor = k.bg; }); return; }
    const ease = cs.getPropertyValue('--ease-out').trim() || 'ease-out';
    const sel = cs.getPropertyValue('--text-selected').trim(), def = cs.getPropertyValue('--text-secondary').trim();
    const tr = track.getBoundingClientRect(), bx = to.getBoundingClientRect();
    const g = document.createElement('span'); g.setAttribute('aria-hidden', 'true');
    const fill = getComputedStyle(track).getPropertyValue('--surface-selected').trim();
    Object.assign(g.style, { position: 'absolute', left: (a.left - tr.left - track.clientLeft) + 'px', top: (a.top - tr.top - track.clientTop) + 'px', width: a.width + 'px', height: a.height + 'px', background: fill, borderRadius: getComputedStyle(to).borderRadius, zIndex: '-1', pointerEvents: 'none' });
    Object.assign(track.style, { position: 'relative', isolation: 'isolate' });
    track.prepend(g);
    const anims = [
      g.animate([{ transform: 'translate(0, 0)', width: a.width + 'px' }, { transform: 'translate(' + (bx.left - a.left) + 'px, ' + (bx.top - a.top) + 'px)', width: bx.width + 'px' }], { duration: ms, easing: ease }),
      from.animate([{ color: sel }, { color: def, offset: 0.5 }, { color: def }], { duration: ms, easing: 'linear' }),
      to.animate([{ color: def }, { color: def, offset: 0.5 }, { color: sel }], { duration: ms, easing: 'linear' }),
    ];
    let over = false;
    const done = () => { if (over) return; over = true;
      keep.forEach(k => { k.x.style.backgroundColor = k.bg; }); // the fill back first, with no transition — else it fades in again
      g.remove(); Object.assign(track.style, { position: '', isolation: '' });
      void track.offsetWidth; keep.forEach(k => { k.x.style.transition = k.tr; });
      anims.slice(1).forEach(x => x.cancel()); };
    anims[0].onfinish = done; anims[0].oncancel = done; setTimeout(done, ms + 100); // a page in the background may not finish the animation
  }
});
