// AS-IS rebuild of the Goodface wireframe (Figma node 3189-387).
// Every value below is copied from the wireframe.
// Exception: `bar` = position of the dot on the "Winning %" bar, measured from the wireframe screenshot (07.11)
// (the wireframe shows a bar without a number). `red` = length of the red part of that bar, measured the same way;
// it is a separate mark from the dot and is close to, but not equal to, 1 − bar.
window.DATA = {
  account: { name: "$50K Phase 1", status: "Close to daily limit", equity: "$51,180", change: "+2.48%" },

  kpis: [
    { label: "Total P&L", value: "+$6,384", tone: "pos" },
    { label: "Avg Daily P&L", value: "+$53", tone: "pos" },
    { label: "Profit Factor", value: "2.30" },
  ],
  kpis2: [
    { label: "Total Trading Days", value: "120", split: [85, 0, 35] },
    { label: "Total Trades", value: "424", split: [261, 0, 163] },
  ],

  cards: [
    { title: "P&L Statistics", rows: [
      ["Avg Trade P&L", "+$34", "pos"], ["Avg Winning Trade", "+$97", "pos"], ["Avg Losing Trade", "-$67", "neg"],
      ["Avg Winning Day", "+$155", "pos"], ["Avg Losing Day", "-$194", "neg"], ["Trade Expectancy", "+$34", "pos"] ] },
    { title: "Performance Extremes", rows: [
      ["Best Month", "+$1,590", "pos", "May"], ["Worst Month", "-$151", "neg", "Feb"], ["Largest Win", "+$197", "pos"],
      ["Largest Loss", "-$119", "neg"], ["Best Day", "+$316", "pos"], ["Worst Day", "-$395", "neg"] ] },
    { title: "Streaks & Patterns", rows: [
      ["Max Win Streak", "7", "pos"], ["Max Loss Streak", "4", "neg"], ["Max Winning Days", "7", "pos"], ["Max Losing Days", "2", "neg"] ] },
    { title: "Trading Activity", rows: [
      ["Avg Daily Volume", "1.07"], ["Open Trades", "3"], ["Logged Days", "120"] ] },
    { title: "Costs & Fees", rows: [
      ["Total Commissions", "-$904", "neg"], ["Total Fees", "-$254", "neg"], ["Total Swap", "-$0", "neg"] ] },
  ],

  breakdowns: [
    { title: "By week", key: "Week", rows: [
      { name: "Wk 1", tag: "worst", net: 78, bar: 0.333, red: 0.636, profit: 173, loss: -95, trades: 3 },
      { name: "Wk 2", net: 540, bar: 0.667, red: 0.374, profit: 1024, loss: -484, trades: 18 },
      { name: "Wk 3", tag: "best", net: 793, bar: 0.714, red: 0.33, profit: 923, loss: -130, trades: 14 },
      { name: "Wk 4", net: 119, bar: 0.538, red: 0.52, profit: 586, loss: -467, trades: 13 },
      { name: "Wk 5", net: 520, bar: 0.583, red: 0.475, profit: 890, loss: -370, trades: 12 } ] },
    { title: "By pairs", key: "Pair", rows: [
      { name: "GBPUSD", net: 585, bar: 0.632, red: 0.414, profit: 1043, loss: -458, trades: 19 },
      { name: "EURUSD", tag: "best", net: 811, bar: 0.75, red: 0.28, profit: 1068, loss: -257, trades: 16 },
      { name: "XAUUSD", net: 469, bar: 0.571, red: 0.48, profit: 910, loss: -441, trades: 14 },
      { name: "USDJPY", tag: "worst", net: 185, bar: 0.455, red: 0.495, profit: 575, loss: -390, trades: 11 } ] },
    { title: "By session", key: "Session", rows: [
      { name: "London", tag: "best", net: 1018, bar: 0.67, red: 0.367, profit: 1753, loss: -735, trades: 27 },
      { name: "NY", net: 785, bar: 0.69, red: 0.347, profit: 1115, loss: -330, trades: 16 },
      { name: "Asia", net: 450, bar: 0.60, red: 0.449, profit: 588, loss: -138, trades: 10 },
      { name: "Outside", tag: "worst", net: -203, bar: 0.29, red: 0.677, profit: 140, loss: -343, trades: 7 } ] },
  ],
};
