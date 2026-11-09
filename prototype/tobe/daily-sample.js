// SAMPLE daily net P&L — 120 trading days invented for the chart (the wireframe has only totals). Labelled «Sample data» on screen.
// Every number the screen shows holds, not only the day totals:
//   85 winning · 35 losing · 0 breakeven days · average winning day +$155 · average losing day −$194 · total +$6,384
//   best day +$316 · worst day −$395 · longest streak 7 winning / 2 losing days
//   best month May +$1,590 · worst month Feb −$151 (months: Dec … Jun)
//   the last 5 weeks = the Breakdowns weeks: +78 · +540 · +793 · +119 · +520 = +$2,050; Wk 1 has 3 trades → 3 trading days, 1 winning (Winning % 33),
//   and a week's winning / losing days never exceed that week's total profit / total loss from Breakdowns.
// Only the order and the size of single days are made up; the order is also picked so the curve dips below zero in the first days, to show how it looks under zero. Run: node daily-sample.js → prints the checks and the array.
const SEGMENTS = [ // days · winning days · losing days · net · sum of losing days (absolute); winning days = net + losses
  { name: 'Dec', days: 5, w: 4, l: 1, net: 210, loss: 200 },
  { name: 'Jan', days: 22, w: 17, l: 5, net: 1180, loss: 1250 },
  { name: 'Feb', days: 19, w: 10, l: 9, net: -151, loss: 2000, worst: true },
  { name: 'Mar', days: 22, w: 16, l: 6, net: 1416, loss: 1130 },
  { name: 'Apr', days: 21, w: 16, l: 5, net: 1500, loss: 950 },
  { name: 'May', days: 8, w: 6, l: 2, net: 179, loss: 395 },
  { name: 'May', week: 'Wk 1', days: 3, w: 1, l: 2, net: 78, loss: 95, fixed: { wins: [173], losses: [52, 43] } }, // 1 of 3 trades won (Winning % 33): one trade a day
  { name: 'May', week: 'Wk 2', days: 5, w: 4, l: 1, net: 540, loss: 200 },
  { name: 'May', week: 'Wk 3', days: 5, w: 4, l: 1, net: 793, loss: 90, best: true },
  { name: 'Jun', week: 'Wk 4', days: 5, w: 3, l: 2, net: 119, loss: 330 },
  { name: 'Jun', week: 'Wk 5', days: 5, w: 4, l: 1, net: 520, loss: 150 },
];
// the Breakdowns weeks: total profit / total loss of their trades — a week's winning / losing days cannot exceed them
const WEEK_LIMITS = { 'Wk 1': [173, 95], 'Wk 2': [1024, 484], 'Wk 3': [923, 130], 'Wk 4': [586, 467], 'Wk 5': [890, 370] };
// …and won / lost trades (trades × Winning %): a week cannot have more winning days than winning trades, nor losing days than losing trades
const WEEK_TRADES = { 'Wk 1': [1, 2], 'Wk 2': [12, 6], 'Wk 3': [10, 4], 'Wk 4': [7, 6], 'Wk 5': [7, 5] };
function lcg(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
// n integers in [lo, hi] summing to sum; one of them = peak when given
function split(n, sum, lo, hi, rnd, peak) {
  if (peak) { const rest = split(n - 1, sum - peak, lo, hi, rnd); if (!rest) return null; rest.splice(Math.floor(rnd() * n), 0, peak); return rest; }
  const u = Array.from({ length: n }, () => 0.35 + rnd() ** 1.3);
  const k = sum / u.reduce((a, b) => a + b, 0);
  const v = u.map(x => Math.max(lo, Math.min(hi, Math.round(x * k))));
  let diff = sum - v.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < 100000; i++) { const j = Math.floor(rnd() * n), st = Math.sign(diff); if (v[j] + st >= lo && v[j] + st <= hi) { v[j] += st; diff -= st; } }
  return diff === 0 ? v : null;
}
function build(seed) {
  const rnd = lcg(seed), out = [];
  for (const s of SEGMENTS) {
    let wins, losses;
    if (s.fixed) { wins = s.fixed.wins.slice(); losses = s.fixed.losses.slice(); }
    else {
      wins = split(s.w, s.net + s.loss, 12, 315, rnd, s.best ? 316 : 0);
      losses = s.l ? split(s.l, s.loss, 12, 394, rnd, s.worst ? 395 : 0) : [];
      if (!wins || !losses) return null;
    }
    const signs = Array(s.w).fill(1).concat(Array(s.l).fill(-1));
    for (let i = signs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [signs[i], signs[j]] = [signs[j], signs[i]]; }
    let a = 0, b = 0; for (const x of signs) out.push(x > 0 ? wins[a++] : -losses[b++]);
  }
  const run = sgn => { let r = 0, m = 0; for (const x of out) { r = Math.sign(x) === sgn ? r + 1 : 0; m = Math.max(m, r); } return m; };
  if (run(1) !== 7 || run(-1) !== 2) return null;
  if (!(out[0] < 0 || out[1] < 0)) return null; // the curve dips below zero in the first days, so both colours show
  return out;
}
let out = null;
for (let seed = 11; !out && seed < 200000; seed++) out = build(seed);
if (!out) throw new Error('sample: no sequence found');

// checks — every number the screen states
const W = out.filter(x => x > 0), L = out.filter(x => x < 0), sum = a => a.reduce((x, y) => x + y, 0);
const run = sgn => { let r = 0, m = 0; for (const x of out) { r = Math.sign(x) === sgn ? r + 1 : 0; m = Math.max(m, r); } return m; };
const months = {}, weeks = {}; let i = 0;
for (const s of SEGMENTS) {
  const part = out.slice(i, i + s.days); i += s.days;
  months[s.name] = (months[s.name] || 0) + sum(part);
  if (s.week) { weeks[s.week] = sum(part); const [p, l] = WEEK_LIMITS[s.week];
    if (sum(part.filter(x => x > 0)) > p || -sum(part.filter(x => x < 0)) > l) throw new Error('sample: ' + s.week + ' exceeds its trades');
    const [tw, tl] = WEEK_TRADES[s.week]; if (part.filter(x => x > 0).length > tw || part.filter(x => x < 0).length > tl) throw new Error('sample: ' + s.week + ' has more winning / losing days than trades'); }
}
const checks = { days: out.length, winning: W.length, losing: L.length, breakeven: out.filter(x => x === 0).length,
  avgWin: Math.round(sum(W) / W.length), avgLoss: Math.round(sum(L) / L.length), total: sum(out), best: Math.max(...out), worst: Math.min(...out),
  streakWin: run(1), streakLoss: run(-1), months, weeks, last5weeks: Object.values(weeks).reduce((a, b) => a + b, 0) };
const want = { days: 120, winning: 85, losing: 35, breakeven: 0, avgWin: 155, avgLoss: -194, total: 6384, best: 316, worst: -395, streakWin: 7, streakLoss: 2, last5weeks: 2050 };
for (const [k, v] of Object.entries(want)) if (checks[k] !== v) throw new Error('sample: ' + k + ' = ' + checks[k] + ', want ' + v);
const mv = Object.values(months);
if (months.May !== 1590 || months.Feb !== -151 || Math.max(...mv) !== 1590 || Math.min(...mv) !== -151) throw new Error('sample: months ' + JSON.stringify(months));
// month boundaries for the axis: index of the first day of each month
const MONTHS = []; i = 0;
for (const s of SEGMENTS) { if (!MONTHS.length || MONTHS[MONTHS.length - 1].name !== s.name) MONTHS.push({ name: s.name, from: i }); i += s.days; }
if (typeof module !== 'undefined' && require.main === module) { console.log(JSON.stringify(checks)); console.log(JSON.stringify(out)); }
if (typeof module !== 'undefined') module.exports = { DAILY: out, MONTHS, checks };
