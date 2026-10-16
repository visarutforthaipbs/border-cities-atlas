/* Tiny dependency-free SVG chart helpers. All return SVG markup strings. */
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (v) => {
    if (v == null || isNaN(v)) return "–";
    const a = Math.abs(v);
    if (a >= 1000) return Math.round(v).toLocaleString("en-US");
    if (a >= 10) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    if (a === 0) return "0";
    return v.toFixed(2);
  };
  const niceMax = (m) => {
    if (m <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    const n = m / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };

  /** Stacked annual bars: rows=[{x, a, b, partial}], colors [a,b] */
  function stacked(rows, { w = 420, h = 170, colors = ["var(--exp)", "var(--imp)"], highlight = null } = {}) {
    const pad = { l: 44, r: 6, t: 14, b: 22 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const max = niceMax(Math.max(...rows.map((r) => r.a + r.b), 0));
    const bw = iw / rows.length;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ih - (ih * i) / 4;
      s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="var(--line)" ${i ? 'stroke-dasharray="2 3"' : ""}/>`;
      s += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${fmt((max * i) / 4)}</text>`;
    }
    rows.forEach((r, i) => {
      const x = pad.l + i * bw + bw * 0.16, bwi = bw * 0.68;
      const ha = (r.a / max) * ih, hb = (r.b / max) * ih;
      const op = highlight == null || highlight === r.x ? 1 : 0.45;
      const dash = r.partial ? ' stroke="var(--ink-2)" stroke-dasharray="2 2" stroke-width="1"' : "";
      s += `<g opacity="${op}"><title>${esc(r.x)}: ส่งออก ${fmt(r.a)} / นำเข้า ${fmt(r.b)} ล้านบาท${r.partial ? " (ยังไม่ครบปี)" : ""}</title>`;
      s += `<rect x="${x}" y="${pad.t + ih - ha}" width="${bwi}" height="${Math.max(ha, 0)}" fill="${colors[0]}" rx="1.5"${dash}/>`;
      s += `<rect x="${x}" y="${pad.t + ih - ha - hb}" width="${bwi}" height="${Math.max(hb, 0)}" fill="${colors[1]}" rx="1.5"${dash}/></g>`;
      const lab = String(r.x).slice(2) + (r.partial ? "*" : "");
      s += `<text x="${x + bwi / 2}" y="${h - 6}" text-anchor="middle">${"'" + lab}</text>`;
    });
    return s + "</svg>";
  }

  /** Horizontal ranked bars: items=[{label, value, color, sub, key}] */
  function hbars(items, { w = 420, row = 24, labelW = 120, unit = "", max = null, valueFmt = fmt } = {}) {
    const h = items.length * row + 4;
    const m = max || Math.max(...items.map((d) => d.value), 1);
    const iw = w - labelW - 70;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
    items.forEach((d, i) => {
      const y = i * row + 2;
      const bw = Math.max((d.value / m) * iw, d.value > 0 ? 2 : 0);
      s += `<g ${d.key ? `data-key="${esc(d.key)}" style="cursor:pointer"` : ""}>`;
      s += `<text class="lbl" x="${labelW - 8}" y="${y + row / 2 + 4}" text-anchor="end">${esc(d.label)}</text>`;
      s += `<rect x="${labelW}" y="${y + 5}" width="${iw}" height="${row - 10}" fill="var(--line)" opacity=".45" rx="3"/>`;
      s += `<rect x="${labelW}" y="${y + 5}" width="${bw}" height="${row - 10}" fill="${d.color || "var(--ink)"}" rx="3"/>`;
      s += `<text class="v" x="${labelW + bw + 6}" y="${y + row / 2 + 4}">${valueFmt(d.value)}${unit}</text>`;
      s += "</g>";
    });
    return s + "</svg>";
  }

  /** Two-line monthly chart: points=[{m:'2024-01', a, b}] */
  function lines(points, { w = 420, h = 150, colors = ["var(--exp)", "var(--imp)"], markers = [] } = {}) {
    const pad = { l: 44, r: 8, t: 10, b: 22 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    if (!points.length) return "";
    const max = niceMax(Math.max(...points.map((p) => Math.max(p.a, p.b)), 0));
    const X = (i) => pad.l + (iw * i) / Math.max(points.length - 1, 1);
    const Y = (v) => pad.t + ih - (v / max) * ih;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ih - (ih * i) / 4;
      s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="var(--line)" ${i ? 'stroke-dasharray="2 3"' : ""}/>`;
      s += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${fmt((max * i) / 4)}</text>`;
    }
    markers.forEach((mk) => {
      const i = points.findIndex((p) => p.m === mk.m);
      if (i < 0) return;
      s += `<line x1="${X(i)}" x2="${X(i)}" y1="${pad.t}" y2="${pad.t + ih}" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
      s += `<text x="${X(i) + 4}" y="${pad.t + 9}" style="fill:var(--accent)">${esc(mk.label)}</text>`;
    });
    ["a", "b"].forEach((k, j) => {
      const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join("");
      s += `<path d="${d}" fill="none" stroke="${colors[j]}" stroke-width="1.8" stroke-linejoin="round"/>`;
    });
    points.forEach((p, i) => {
      if (p.m.endsWith("-01")) s += `<text x="${X(i)}" y="${h - 6}" text-anchor="middle">${p.m.slice(0, 4)}</text>`;
    });
    return s + "</svg>";
  }

  /** Inline sparkline of totals: vals=[number] */
  function spark(vals, { w = 84, h = 22, color = "var(--ink)" } = {}) {
    const m = Math.max(...vals, 1);
    const X = (i) => (w * i) / Math.max(vals.length - 1, 1);
    const Y = (v) => h - 2 - (v / m) * (h - 4);
    const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    const last = vals.length - 1;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${X(last)}" cy="${Y(vals[last])}" r="2.2" fill="${color}"/></svg>`;
  }

  window.Charts = { stacked, hbars, lines, spark, fmt, esc };
})();
