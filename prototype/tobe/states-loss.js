// ILLUSTRATIVE STATE — not data from the brief. The same TO-BE page and components for an account in the red that trades
// little lately: does the screen still read when the total is negative, the curve sits below zero and every Breakdowns row
// has too few trades? Every number on this page is invented, labelled «Illustrative» on screen, and checked against the others:
//   120 trading days, total −$1,440 (avg daily −$12); equity in the header = $50,000 + total
//   the last 9 trading days = the last 5 weeks of Breakdowns: 14 trades, net −$186, total profit +$189 / total loss −$375;
//   each tab (session · pairs · week) sums to the same 14 trades, 5 won, +$189 / −$375; a week's winning / losing days fit its trades.
// Generates tobe/states.html from the TO-BE page; stops with an error if any number above does not hold. The main page (tobe/index.html) never shows these numbers.

const START = 50000, TOTAL = -1440, DAYS = 120, WINNING = 50;
// the last 9 trading days, by week (Wk 1 … Wk 5) — the Breakdowns weeks below are built on them
const LAST = [[-42, 35], [-61, -28, 50], [-77, 18], [-55], [-26]];
const BD = { // name · trades · won · total profit · total loss  (net = profit − loss)
  session: [['London', 6, 2, 71, 169], ['NY', 5, 3, 118, 106], ['Asia', 2, 0, 0, 52], ['Outside sessions', 1, 0, 0, 48]],
  pair: [['EURUSD', 7, 3, 102, 166], ['GBPUSD', 4, 1, 41, 112], ['XAUUSD', 3, 1, 46, 97]],
  week: [['Wk 1', 3, 1, 52, 59], ['Wk 2', 4, 2, 66, 105], ['Wk 3', 3, 1, 41, 100], ['Wk 4', 2, 0, 0, 55], ['Wk 5', 2, 1, 30, 56]],
};
const TRADES = { total: 268, won: 112 }; // all time; lost = total − won

function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const sum = a => a.reduce((x, y) => x + y, 0);

// the first 111 days: random sizes, a few winning days first (the curve starts green), then the drift down; exact total
function days() {
  const last = LAST.flat(), n = DAYS - last.length, w = WINNING - last.filter(x => x > 0).length, l = n - w, target = TOTAL - sum(last);
  for (let seed = 7; seed < 100000; seed++) {
    const rnd = lcg(seed);
    const wins = Array.from({ length: w }, () => 20 + Math.round(rnd() * 170));
    const losses = Array.from({ length: l }, () => 20 + Math.round(rnd() * 180));
    let diff = target - (sum(wins) - sum(losses)); // spread the difference over the losing days, inside 15 … 260
    for (let i = 0; diff !== 0 && i < 200000; i++) { const j = Math.floor(rnd() * l), st = diff < 0 ? 1 : -1; if (losses[j] + st >= 15 && losses[j] + st <= 260) { losses[j] += st; diff += st; } }
    if (diff !== 0) continue;
    const signs = Array(w).fill(1).concat(Array(l).fill(-1));
    for (let i = signs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [signs[i], signs[j]] = [signs[j], signs[i]]; }
    if (!(signs[0] > 0 && signs[1] > 0 && signs[2] > 0)) continue;
    let a = 0, b = 0; const out = signs.map(x => (x > 0 ? wins[a++] : -losses[b++])).concat(last);
    let c = 0; const cum = out.map(v => (c += v));
    const firstBelow = cum.findIndex(v => v < 0);
    if (firstBelow < 15 || firstBelow > 45 || Math.max(...cum) < 150) continue; // green for a while, then below zero for good
    if (cum.slice(firstBelow + 10).some(v => v >= 0)) continue;
    return out;
  }
  throw new Error('states-loss: no sequence found');
}

const money = v => (v < 0 ? '−' : '+') + '$' + Math.abs(v).toLocaleString('en-US');
const must = (s, a, b, label) => { if (s.split(a).length !== 2) throw new Error('states-loss: ' + label + ' x' + (s.split(a).length - 1)); return s.replace(a, () => b); };

function rows(kind, list) {
  const nets = list.map(r => r[3] - r[4]), neg = Math.max(0, ...nets.map(v => -v)), pos = Math.max(0, ...nets);
  const half = (side, size, v) => {
    const fill = side === 'negative' ? Math.max(0, -v) : Math.max(0, v);
    const fillEl = fill ? '<i class="diverge-bar__fill" style="flex-grow:' + fill + '"></i>' : '', rest = size - fill ? '<i class="diverge-bar__rest" style="flex-grow:' + (size - fill) + '"></i>' : '';
    return '<span class="diverge-bar__half" data-side="' + side + '" style="flex-grow:' + size + '">'
      + (side === 'negative' ? rest + fillEl : fillEl + rest) + '</span>'; // negative half: the fill touches the zero line on its right
  };
  return list.map(([name, trades, won, p, l], i) => {
    const net = nets[i], rate = Math.round(won / trades * 100);
    return '            <div class="breakdown-row" data-sample="low">\n'
      + '              <span class="breakdown-row__name"><b>' + name + '</b><small>' + trades + ' trade' + (trades === 1 ? '' : 's') + '</small><span class="tag">few trades</span></span>\n'
      + '              <span class="breakdown-row__net"><span class="diverge-bar">' + half('negative', neg, net) + half('positive', pos, net) + '</span><span class="breakdown-row__num" data-tone="' + (net < 0 ? 'negative' : 'positive') + '">' + money(net) + '</span></span>\n'
      + '              <span class="breakdown-row__rate"><span class="breakdown-row__num">' + rate + '%</span><span class="rate-bar">' + (rate ? '<i class="rate-bar__fill" style="flex-grow:' + rate + '"></i>' : '') + (100 - rate ? '<i class="rate-bar__rest" style="flex-grow:' + (100 - rate) + '"></i>' : '') + '</span></span>\n'
      + '              <span class="breakdown-row__pl"><span class="mini-bar" data-tone="positive" data-bar="none"><span class="mini-bar__value">' + money(p) + '</span></span><span class="mini-bar" data-tone="negative" data-bar="none"><span class="mini-bar__value">' + money(-l) + '</span></span></span>\n'
      + '            </div>';
  }).join('\n');
}

module.exports = function statesLoss({ html, content, groups, daily, ribbon }) {
  const D = days();
  // checks — every number this page states
  const W = D.filter(x => x > 0), L = D.filter(x => x < 0);
  if (D.length !== DAYS || sum(D) !== TOTAL || W.length !== WINNING || D.some(x => x === 0)) throw new Error('states-loss: days');
  const lastNet = sum(LAST.flat());
  for (const [k, list] of Object.entries(BD)) {
    const t = sum(list.map(r => r[1])), won = sum(list.map(r => r[2])), p = sum(list.map(r => r[3])), l = sum(list.map(r => r[4]));
    if (t !== 14 || won !== 5 || p !== 189 || l !== 375 || p - l !== lastNet) throw new Error('states-loss: breakdowns ' + k);
    if (list.some(r => r[1] >= 10)) throw new Error('states-loss: ' + k + ' — every row must be «few trades»');
  }
  BD.week.forEach(([name, , , p, l], i) => { const d = LAST[i]; if (sum(d.filter(x => x > 0)) > p || -sum(d.filter(x => x < 0)) > l) throw new Error('states-loss: ' + name); });
  const avgW = Math.round(sum(W) / W.length), avgL = Math.round(-sum(L) / L.length), avgDay = Math.round(TOTAL / DAYS);
  const pf = (sum(W) / -sum(L)).toFixed(2), lost = TRADES.total - TRADES.won, top = Math.max(avgW, avgL);
  const TAG = '<span class="tag">Illustrative</span>';

  let c = content;
  c = must(c, groups, '', 'per-trade groups'); // G-178: deliberate — the state shows what a minus changes (total, curve, Breakdowns); Per trade, Per day & month and Costs look the same as on the main page
  c = must(c, '<div class="kpi-card" data-size="hero" data-tone="positive">', '<div class="kpi-card" data-size="hero" data-tone="negative">', 'hero tone');
  c = must(c, '<span class="kpi-card__value">+$6,384</span>', '<span class="kpi-card__value">' + money(TOTAL) + '</span>', 'total');
  c = must(c, 'Avg daily P&amp;L <b>+$53</b>', 'Avg daily P&amp;L <b>' + money(avgDay) + '</b>', 'avg daily');
  c = must(c, 'style="flex-grow:85"></span>', 'style="flex-grow:' + W.length + '"></span>', 'days won');
  c = must(c, 'style="flex-grow:35"></span>', 'style="flex-grow:' + L.length + '"></span>', 'days lost');
  c = must(c, '<b>85</b> winning', '<b>' + W.length + '</b> winning', 'legend won');
  c = must(c, '<b>35</b> losing', '<b>' + L.length + '</b> losing', 'legend lost');
  const track = v => '<i class="pair-bar__fill" style="flex-grow:' + v + '"></i>' + (top - v ? '<i class="pair-bar__rest" style="flex-grow:' + (top - v) + '"></i>' : '');
  c = must(c, '<i class="pair-bar__fill" style="flex-grow:155"></i><i class="pair-bar__rest" style="flex-grow:39"></i>', track(avgW), 'avg win bar');
  c = must(c, '<span class="pair-bar__value">+$155</span>', '<span class="pair-bar__value">' + money(avgW) + '</span>', 'avg win');
  c = must(c, '<i class="pair-bar__fill" style="flex-grow:194"></i>', track(avgL), 'avg loss bar');
  c = must(c, '<span class="pair-bar__value">-$194</span>', '<span class="pair-bar__value">' + money(-avgL) + '</span>', 'avg loss');
  c = must(c, '<span class="kpi-card__value">2.30</span>', '<span class="kpi-card__value">' + pf + '</span>', 'pf');
  c = must(c, '$2.30 won for every $1 lost', '$' + pf + ' won for every $1 lost', 'pf hint');
  c = must(c, '<span class="kpi-card__value">424</span>', '<span class="kpi-card__value">' + TRADES.total + '</span>', 'trades');
  c = must(c, 'style="flex-grow:261"></span>', 'style="flex-grow:' + TRADES.won + '"></span>', 'trades won bar');
  c = must(c, 'style="flex-grow:163"></span>', 'style="flex-grow:' + lost + '"></span>', 'trades lost bar');
  c = must(c, '<b>261</b> won', '<b>' + TRADES.won + '</b> won', 'trades won');
  c = must(c, '<b>163</b> lost', '<b>' + lost + '</b> lost', 'trades lost');
  c = must(c, '<span class="period-tag">All time</span>', '<span class="period-tag">All time</span>' + TAG, 'tag 1');
  c = must(c, '<span class="period-tag">Last 5 weeks · 60 trades</span><span class="stat-block__total" data-tone="positive"><span class="tag">Net</span><b>+$2,050</b></span>',
    '<span class="period-tag">Last 5 weeks · 14 trades</span><span class="stat-block__total" data-tone="negative"><span class="tag">Net</span><b>' + money(lastNet) + '</b></span>' + TAG, 'bd meta');
  for (const k of Object.keys(BD)) {
    const re = new RegExp('(<div class="breakdown-table"[^>]*data-panel="' + k + '"[^>]*>\\n\\s*<div class="breakdown-row" data-kind="head">[\\s\\S]*?\\n            </div>\\n)[\\s\\S]*?(\\n          </div>)');
    if (!re.test(c)) throw new Error('states-loss: panel ' + k);
    c = c.replace(re, (m, head, end) => head + rows(k, BD[k]) + end);
  }
  if (/\+\$6,384|\+\$2,050|60 trades|424</.test(c)) throw new Error('states-loss: a brief number is left on the page');

  let page = must(html, content, c, 'content');
  page = page.split(JSON.stringify(daily)).join(JSON.stringify(D));
  if (page.includes(JSON.stringify(daily))) throw new Error('states-loss: sample days left');
  page = page.split('>Sample data</span>').join('>Illustrative</span>').split('— sample data"').join('— illustrative data"'); // the curve, compact and expanded
  if (/Sample data|sample data/.test(page)) throw new Error('states-loss: a «sample data» label is left');
  page = page.replace(/<div class="ribbon">[^\n]*<\/div>/, () => ribbon('loss', 'not data from the brief', '../'));
  page = must(page, '<title>Performance · Summary — to-be (Goodface test)</title>', '<title>Illustrative state · in the red — to-be (Goodface test)</title>', 'title');
  const eq = START + TOTAL, ch = (TOTAL / START * 100).toFixed(2);
  page = page.replace(/id="acc-eq">[^<]*</, 'id="acc-eq">$' + eq.toLocaleString('en-US') + '<').replace(/class="pos" id="acc-ch">[^<]*</, 'class="neg" id="acc-ch">−' + Math.abs(ch) + '%<');
  if (!page.includes('class="neg" id="acc-ch"')) throw new Error('states-loss: header change');
  return { page, checks: { total: TOTAL, avgDay, winning: W.length, losing: L.length, avgW, avgL: -avgL, pf, last5weeks: lastNet } };
};
