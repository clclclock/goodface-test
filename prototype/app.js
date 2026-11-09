(() => {
  const D = window.DATA;
  const paint = (root = document) => root.querySelectorAll("i[data-icon]").forEach(el => { if (!el.firstChild) el.innerHTML = window.ICONS[el.dataset.icon] || ""; });
  const $ = (s) => document.querySelector(s);
  const money = (n) => (n > 0 ? "+" : n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US");
  const tone = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

  $("#acc-name").textContent = D.account.name;
  $("#acc-status").textContent = D.account.status;
  $("#acc-eq").textContent = D.account.equity;
  $("#acc-ch").textContent = D.account.change;

  $("#kpis").innerHTML = D.kpis.map(k => `
    <div class="kpi"><div class="kpi-label">${k.label.toUpperCase()}</div>
    <div class="kpi-value ${k.tone || ""}">${k.value}</div></div>`).join("");

  $("#kpis2").innerHTML = D.kpis2.map(k => `
    <div class="kpi"><div class="kpi-label">${k.label.toUpperCase()}</div>
    <div class="kpi-line"><div class="kpi-value">${k.value}</div>
      <div class="split"><span class="w">W ${k.split[0]}</span><span class="b">B ${k.split[1]}</span><span class="l">L ${k.split[2]}</span></div>
    </div></div>`).join("");

  $("#cards").innerHTML = D.cards.map(c => `
    <div class="card"><h4 class="h4">${c.title} <i class="i" data-icon="info"></i></h4>
      ${c.rows.map(([l, v, t, note]) => `<div class="row"><span>${l}${note ? ` <em>(${note})</em>` : ""}</span><span class="num ${t || ""}">${v}</span></div>`).join("")}
    </div>`).join("");

  const cols = [
    { k: "name", label: null, align: "left" },
    { k: "net", label: "Net Profit" },
    { k: "bar", label: "Winning %", align: "center" },
    { k: "profit", label: "Total Profit" },
    { k: "loss", label: "Total Loss" },
    { k: "trades", label: "Trades" },
  ];

  function table(b) {
    const st = b._sort || { k: null, dir: 1 };
    const rows = [...b.rows];
    if (st.k) rows.sort((a, c) => (a[st.k] > c[st.k] ? 1 : a[st.k] < c[st.k] ? -1 : 0) * st.dir);
    return `<div class="card bd"><h4 class="h4">${b.title} <i class="i" data-icon="info"></i></h4>
      <table><thead><tr>${cols.map(c => `<th class="${c.align || "right"}" data-k="${c.k}">${c.label || b.key} <i class="sort" data-icon="${st.k === c.k ? (st.dir > 0 ? "arrow-up" : "arrow-down") : "arrow-up-down"}"></i></th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td class="left">${r.name}${r.tag ? ` <span class="tag ${r.tag}">${r.tag.toUpperCase()}</span>` : ""}</td>
        <td class="right num ${tone(r.net)}">${money(r.net)}</td>
        <td class="center"><span class="wbar"><span class="red" style="width:${r.red * 100}%"></span><span class="green"></span><span class="knob" style="left:${r.bar * 100}%"></span></span></td>
        <td class="right num pos">${money(r.profit)}</td>
        <td class="right num neg">${money(r.loss)}</td>
        <td class="right num">${r.trades}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderBreakdowns() {
    $("#breakdowns").innerHTML = D.breakdowns.map(table).join("");
    paint($("#breakdowns"));
    document.querySelectorAll("#breakdowns .bd").forEach((el, i) => {
      el.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
        const b = D.breakdowns[i], k = th.dataset.k;
        b._sort = b._sort && b._sort.k === k ? { k, dir: -b._sort.dir } : { k, dir: k === "name" ? 1 : -1 };
        renderBreakdowns();
      }));
    });
  }
  renderBreakdowns();
  paint();
})();
