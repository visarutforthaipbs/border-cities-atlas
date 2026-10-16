/* Border Cities Atlas — MVP app. Data: window.ATLAS (built by scripts/03_build.py). */
(function () {
  "use strict";
  const A = window.ATLAS;
  const C = window.Charts;
  const P = A.project;
  const esc = C.esc;
  const LINES = P.border_lines;
  const LINE_COLOR = (k) => (LINES[k] ? LINES[k].color : "#555");
  const PROV = Object.fromEntries(P.provinces.map((p) => [p.name_th, p]));
  const LAST_M = A.meta.trade_latest_month_2026; // e.g. 8
  const TH_MONTH = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const YEARS = Array.from({ length: 10 }, (_, i) => 2017 + i);
  const BKK = [13.7563, 100.5018];

  const state = {
    lens: "project",
    year: 2025,
    sel: null, // {type:'province'|'crossing', id}
    on: { districts: true, research: true, pilots: true, forums: true, events: false, pins: true, projOnly: false },
    pinning: false,
  };

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const total = (c, y) => { const v = c.annual[String(y)]; return v ? v[0] + v[1] : 0; };
  const baht = (m) => {
    if (m == null) return "–";
    const a = Math.abs(m);
    if (a >= 1e6) return (m / 1e6).toFixed(2) + " ล้านล้านบาท";
    if (a >= 1e3) return (m / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " พันล้านบาท";
    if (a >= 1) return Math.round(m).toLocaleString("en-US") + " ล้านบาท";
    return m > 0 ? "< 1 ล้านบาท" : "0";
  };
  const shortBaht = (m) => (m >= 1e3 ? (m / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " พันล้าน" : m >= 1 ? Math.round(m).toLocaleString("en-US") + " ล้าน" : m > 0 ? "< 1 ล้าน" : "0");
  const pct = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const pctTxt = (v) => (v == null ? "–" : (v > 0 ? "+" : "") + v.toFixed(0) + "%");
  const yearLabel = (y) => (y === 2026 ? `2026* (${TH_MONTH[1]}–${TH_MONTH[LAST_M]})` : String(y));
  const lineChips = (lines) => lines.map((k) => `<span class="chip"><i class="line-dot" style="background:${LINE_COLOR(k)}"></i>${esc(LINES[k].th)}</span>`).join("");
  const distCenter = {};
  A.geo.districts.features.forEach((f) => (distCenter[f.properties.prov + "|" + f.properties.name] = f.properties.c));
  const provCenter = {};
  A.geo.provinces.features.forEach((f) => (provCenter[f.properties.name] = f.properties.c));
  const anchorLL = (a) => (a ? distCenter[a[0] + "|" + a[1]] || provCenter[a[0]] : null);
  const ytdSum = (c, y, upto) => { let s = 0; for (let m = 1; m <= upto; m++) { const v = c.monthly[`${y}-${String(m).padStart(2, "0")}`]; if (v) s += v[0] + v[1]; } return s; };

  // ---------- map ----------
  // Vector-only basemap (Natural Earth neighbours + rivers): no tile key, works offline.
  const map = L.map("map", { zoomControl: false, minZoom: 5, maxZoom: 12, zoomSnap: 0.25, attributionControl: true });
  map.fitBounds([[5.6, 97.3], [20.5, 105.7]], { padding: [16, 16] });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.addAttribution("ขอบเขต: OpenGISData-Thailand · Natural Earth");
  map.createPane("base"); map.getPane("base").style.zIndex = 200;
  map.createPane("rivers"); map.getPane("rivers").style.zIndex = 420; map.getPane("rivers").style.pointerEvents = "none";
  L.geoJSON(A.geo.neighbours, { pane: "base", interactive: false, style: { color: "#cbc2b4", weight: 0.8, fillColor: "#ebe6dd", fillOpacity: 1 } }).addTo(map);
  L.geoJSON(A.geo.provinces, { pane: "base", interactive: false, style: { stroke: false, fillColor: "#faf8f4", fillOpacity: 1 } }).addTo(map);
  L.geoJSON(A.geo.rivers, { pane: "rivers", interactive: false, style: (f) => ({ color: "#6f9fb3", weight: f.properties.major ? 1.6 : 0.8, opacity: f.properties.major ? 0.8 : 0.5 }) }).addTo(map);
  const COUNTRY_LBL = [["เมียนมา", 18.6, 96.6], ["ลาว", 19.6, 102.6], ["กัมพูชา", 12.9, 104.6], ["มาเลเซีย", 4.9, 101.4], ["เวียดนาม", 16.2, 107.2]];
  const countryLabels = L.layerGroup(COUNTRY_LBL.map(([n, lat, lng]) => L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: "", html: `<div class="lbl-country">${n}</div>`, iconSize: [120, 20], iconAnchor: [60, 10] }) }))).addTo(map);
  const riverLbl = L.marker([17.95, 102.95], { interactive: false, icon: L.divIcon({ className: "", html: `<div class="lbl-river">แม่น้ำโขง</div>`, iconSize: [80, 16], iconAnchor: [40, 8] }) }).addTo(map);

  // knowledge ramp
  const resN = (name) => (A.sac[name] ? A.sac[name].research_n : 0);
  const maxRes = Math.max(...Object.keys(A.sac).map(resN));
  const RAMP = ["#f3ece2", "#e7d3b8", "#d6b38a", "#c08b5c", "#9c6136", "#6e3d1d"];
  const rampColor = (n) => { if (!n) return RAMP[0]; const t = Math.log(1 + n) / Math.log(1 + maxRes); return RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(t * (RAMP.length - 1.001)))]; };

  const provLayer = L.geoJSON(A.geo.provinces, {
    style: (f) => provStyle(f.properties),
    onEachFeature: (f, layer) => {
      layer.bindTooltip(() => provTip(f.properties), { className: "tip", sticky: true, direction: "top", offset: [0, -6] });
      layer.on("click", (e) => { if (state.pinning) return; if (f.properties.project) select({ type: "province", id: f.properties.name }); L.DomEvent.stopPropagation(e); });
      layer.on("mouseover", () => { if (f.properties.project) layer.setStyle({ weight: 2.4 }); });
      layer.on("mouseout", () => provLayer.resetStyle(layer));
    },
  }).addTo(map);

  function provStyle(p) {
    const sel = state.sel && state.sel.type === "province" && state.sel.id === p.name;
    const meta = PROV[p.name];
    if (!p.project) return { color: "#d6cdbf", weight: 0.6, fillColor: "#faf8f4", fillOpacity: 1, opacity: 1 };
    const col = LINE_COLOR(meta.lines[0]);
    if (state.lens === "knowledge") return { color: sel ? "#1c1a17" : "#8a7a66", weight: sel ? 2.6 : 0.9, fillColor: rampColor(resN(p.name)), fillOpacity: 0.85 };
    if (state.lens === "trade") return { color: col, weight: sel ? 2.6 : 1, fillColor: col, fillOpacity: sel ? 0.16 : 0.06, opacity: 0.8 };
    return { color: col, weight: sel ? 2.8 : 1.2, fillColor: col, fillOpacity: sel ? 0.26 : 0.13, opacity: 0.95, dashArray: meta.in_sac16 ? null : "4 3" };
  }
  function provTip(p) {
    if (!p.project) return `<b>${esc(p.name)}</b><div class="sub">นอกพื้นที่โครงการ</div>`;
    const m = PROV[p.name];
    let sub = m.lines.map((k) => LINES[k].th).join(" · ");
    if (state.lens === "knowledge") sub = `งานวิจัยใน ศมส. ที่กล่าวถึง: ${resN(p.name)} ชิ้น`;
    if (state.lens === "trade") { const cs = A.crossings.filter((c) => c.prov === p.name); sub = `${cs.length} ด่าน · ${baht(cs.reduce((s, c) => s + total(c, state.year), 0))} (${state.year})`; }
    return `<b>${esc(p.name)}</b> <span class="sub">${esc(m.name_en)}</span><div class="sub">${esc(sub)}</div>`;
  }

  // districts of project provinces
  const distLayer = L.geoJSON(A.geo.districts, {
    style: (f) => distStyle(f.properties),
    interactive: false,
  });
  function distStyle(p) {
    if (!p.target) return { color: "#8f857a", weight: 0.4, opacity: 0.45, fill: false };
    const col = LINE_COLOR(PROV[p.prov].lines[0]);
    if (state.lens === "knowledge") return { color: "#1c1a17", weight: 1.1, opacity: 0.7, fill: false, dashArray: "3 2" };
    return { color: col, weight: 1.3, opacity: 1, fillColor: col, fillOpacity: state.lens === "trade" ? 0.12 : 0.38 };
  }
  const distLabels = L.layerGroup();
  const pilotDist = new Set(P.pilot_sites.map((s) => s.province + "|" + s.district));
  A.geo.districts.features.filter((f) => f.properties.target && !pilotDist.has(f.properties.prov + "|" + f.properties.name)).forEach((f) => {
    L.tooltip({ permanent: true, direction: "center", className: "lbl-dist", interactive: false }).setLatLng(f.properties.c).setContent(esc(f.properties.name)).addTo(distLabels);
  });

  // markers — research pins sit up-right of their anchor, forum pins down-left, so they never stack
  const icon = (cls, html, size, dx = 0, dy = 0) => L.divIcon({ className: "", html: `<div class="mk ${cls}">${html}</div>`, iconSize: [size, size], iconAnchor: [size / 2 - dx, size / 2 - dy] });
  const researchLayer = L.layerGroup();
  const seen = {};
  P.research_projects.forEach((r) => {
    const ll = anchorLL(r.anchor); if (!ll) return;
    const k = ll.join(); const n = (seen[k] = (seen[k] || 0) + 1);
    L.marker(ll, { icon: icon("mk-proj", r.no, 24, 14 + 27 * (n - 1), -14), zIndexOffset: 400 })
      .bindTooltip(`<b>โครงการ ${r.no} · ปี ${r.year}</b><div>${esc(r.title)}</div><div class="sub">${esc(r.pi)} · ${esc(r.org)}</div>`, { className: "tip", direction: "top", offset: [14 + 27 * (n - 1), -26] })
      .on("click", () => r.anchor && select({ type: "province", id: r.anchor[0] }))
      .addTo(researchLayer);
  });
  const pilotLayer = L.layerGroup();
  P.pilot_sites.forEach((s) => {
    L.marker(distCenter[s.province + "|" + s.district], { icon: icon("mk-pilot", "★", 34), zIndexOffset: 800 })
      .bindTooltip(`<b>พื้นที่ต้นแบบครูค่ายชายแดน</b><div>${esc(s.name)}</div><div class="sub">${esc(s.people)} · ${esc(s.issue)}</div>`, { className: "tip", direction: "top", offset: [0, -16] })
      .on("click", () => select({ type: "province", id: s.province }))
      .addTo(pilotLayer);
  });
  const forumLayer = L.layerGroup();
  P.forums.forEach((f) => {
    const ll = f.anchor ? anchorLL(f.anchor) : BKK;
    const right = f.region === "south";
    L.marker(ll, { icon: L.divIcon({ className: "", html: `<div class="mk mk-forum">เวที ${f.order}</div>`, iconSize: [52, 22], iconAnchor: right ? [-10, -8] : [58, -4] }), zIndexOffset: 950 })
      .bindTooltip(`<b>เวทีที่ ${f.order} · ${esc(f.when)}</b><div>${esc(f.place)}</div><div class="sub">${esc(f.note)}</div>`, { className: "tip", direction: "top", offset: [-32, 4] })
      .addTo(forumLayer);
  });
  const eventLayer = L.layerGroup();
  P.network_events_2569.forEach((e) => {
    L.marker(anchorLL(e.anchor), { icon: icon("mk-event", "", 12) })
      .bindTooltip(`<b>${esc(e.date)}</b><div>${esc(e.place)}</div><div class="sub">${esc(e.what)}</div>`, { className: "tip", direction: "top", offset: [0, -8] })
      .addTo(eventLayer);
  });

  // trade bubbles
  const tradeLayer = L.layerGroup();
  const maxTrade = Math.max(...A.crossings.flatMap((c) => YEARS.map((y) => total(c, y))));
  const radius = (v) => (v > 0 ? 3 + 34 * Math.sqrt(v / maxTrade) : 2.5);
  function drawTrade() {
    tradeLayer.clearLayers();
    const list = A.crossings.filter((c) => !state.on.projOnly || c.project).sort((a, b) => total(b, state.year) - total(a, state.year));
    list.forEach((c) => {
      const v = total(c, state.year);
      const sel = state.sel && state.sel.type === "crossing" && state.sel.id === c.id;
      L.circleMarker([c.lat, c.lng], {
        radius: radius(v), color: sel ? "#1c1a17" : "#fff", weight: sel ? 2.5 : 1.2,
        fillColor: LINE_COLOR(c.line), fillOpacity: v > 0 ? 0.78 : 0.25, dashArray: v > 0 ? null : "2 2",
      })
        .bindTooltip(`<b>${esc(c.name)}</b> <span class="sub">${esc(c.prov)}</span><div>${baht(v)} · ${yearLabel(state.year)}</div>`, { className: "tip", direction: "top" })
        .on("click", (e) => { L.DomEvent.stopPropagation(e); select({ type: "crossing", id: c.id }); })
        .addTo(tradeLayer);
    });
  }

  // workshop pins
  const PIN_KEY = "bca-workshop-pins-v1";
  const KIND = { data: ["มีข้อมูล/ต้นทุน", "#0f766e"], issue: ["ประเด็นน่าสนใจ", "#b4471f"], forum: ["เสนอจัดเวที", "#1c1a17"], media: ["ไอเดียสื่อ", "#7c3aed"] };
  let pins = []; try { pins = JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); } catch (e) { pins = []; }
  const pinLayer = L.layerGroup();
  function drawPins() {
    pinLayer.clearLayers();
    pins.forEach((p, i) => {
      const k = KIND[p.kind] || KIND.issue;
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="mk mk-user" style="background:${k[1]}">${p.round}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 900 })
        .bindTooltip(`<b>${esc(k[0])} · รอบ ${p.round}</b><div>${esc(p.note)}</div><div class="sub">${esc(p.who || "")}</div>`, { className: "tip", direction: "top", offset: [0, -10] })
        .addTo(pinLayer);
    });
  }
  const savePins = () => { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); drawPins(); };

  // ---------- toggles & legend ----------
  const TOGGLES = [
    { key: "districts", label: "อำเภอเป้าหมาย", lenses: ["project", "trade", "knowledge"] },
    { key: "research", label: "โครงการวิจัย บพท. 67–68", lenses: ["project"], sw: "#1c1a17" },
    { key: "pilots", label: "พื้นที่ต้นแบบครูค่าย", lenses: ["project", "trade", "knowledge"], sw: "var(--accent)" },
    { key: "forums", label: "เส้นทางเวที 4+1", lenses: ["project"] },
    { key: "events", label: "เวทีเครือข่าย มสธ. ต.ค. 69", lenses: ["project"] },
    { key: "projOnly", label: "เฉพาะด่านในจังหวัดโครงการ", lenses: ["trade"] },
    { key: "pins", label: "หมุดจาก Workshop", lenses: ["project", "trade", "knowledge"] },
  ];
  function renderToggles() {
    const items = TOGGLES.filter((t) => t.lenses.includes(state.lens));
    $("#toggles").innerHTML = `<h4>ชั้นข้อมูล</h4>` + items.map((t) => `<label class="toggle"><input type="checkbox" data-k="${t.key}" ${state.on[t.key] ? "checked" : ""}>${t.sw ? `<i class="sw" style="background:${t.sw}"></i>` : ""}${t.label}</label>`).join("");
    $("#toggles").querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => { state.on[inp.dataset.k] = inp.checked; applyLayers(); if (inp.dataset.k === "projOnly" && !state.sel) renderPanel(); }));
  }
  function renderLegend() {
    let h = "";
    if (state.lens === "project") {
      h = `<h4>แนวชายแดน</h4>` + Object.values(LINES).map((l) => `<div class="row"><i class="sw" style="background:${l.color};opacity:.55"></i>${l.th}</div>`).join("") +
        `<div class="row"><i class="sw" style="border:1.5px dashed #888;background:transparent"></i>ไม่อยู่ในรายชื่อ 16 จังหวัดของ ศมส.</div>` +
        `<div class="note">พื้นที่สีเข้ม = อำเภอเป้าหมายตามแผนที่ บพท. ปี 67–68</div>`;
    } else if (state.lens === "trade") {
      h = `<h4>มูลค่าการค้า (นำเข้า+ส่งออก)</h4>` + Object.values(LINES).map((l) => `<div class="row"><i class="sw" style="background:${l.color};border-radius:50%"></i>${l.th}</div>`).join("") +
        `<div class="note">ขนาดวง ∝ มูลค่า · หมุดวางที่กึ่งกลางอำเภอ ไม่ใช่พิกัดด่านจริง · 2026 = ${TH_MONTH[1]}–${TH_MONTH[LAST_M]}</div>`;
    } else {
      h = `<h4>งานวิจัยใน ศมส. ที่กล่าวถึงจังหวัด</h4><div class="ramp" style="background:linear-gradient(90deg,${RAMP.join(",")})"></div><div class="ramp-lbl"><span>0</span><span>${maxRes}</span></div>` +
        `<div class="note">นับจากชื่อเรื่อง/คำสำคัญ/บทคัดย่อ ใน API สาธารณะของ ศมส. (สเกล log)</div>`;
    }
    $("#legend").innerHTML = `<div class="legend">${h}</div>`;
  }
  function applyLayers() {
    provLayer.setStyle((f) => provStyle(f.properties));
    distLayer.setStyle((f) => distStyle(f.properties));
    const want = (layer, cond) => (cond ? layer.addTo(map) : map.removeLayer(layer));
    want(distLayer, state.on.districts);
    want(distLabels, state.on.districts && map.getZoom() >= 7.5);
    want(researchLayer, state.lens === "project" && state.on.research);
    want(forumLayer, state.lens === "project" && state.on.forums);
    want(eventLayer, state.lens === "project" && state.on.events);
    want(pilotLayer, state.on.pilots);
    want(pinLayer, state.on.pins);
    if (state.lens === "trade") { drawTrade(); tradeLayer.addTo(map); } else map.removeLayer(tradeLayer);
    $("#yearbox").classList.toggle("hidden", state.lens !== "trade");
  }
  map.on("zoomend", applyLayers);

  // ---------- selection ----------
  function select(sel) {
    state.sel = sel;
    if (sel && sel.type === "crossing" && state.lens !== "trade") setLens("trade", true);
    applyLayers();
    renderPanel();
    $("#panel").scrollTop = 0;
    if (sel && sel.type === "province") {
      const lyr = provLayer.getLayers().find((l) => l.feature.properties.name === sel.id);
      if (lyr) map.flyToBounds(lyr.getBounds(), { padding: [40, 40], maxZoom: 8.5, duration: 0.6 });
    } else if (sel && sel.type === "crossing") {
      const c = A.crossings.find((x) => x.id === sel.id);
      if (c && map.getZoom() < 7) map.flyTo([c.lat, c.lng], 7, { duration: 0.6 });
    }
  }
  function setLens(lens, keepSel) {
    state.lens = lens;
    document.querySelectorAll(".lenses button").forEach((b) => b.classList.toggle("on", b.dataset.lens === lens));
    const had = state.sel;
    if (!keepSel) state.sel = state.sel && state.sel.type === "province" ? state.sel : null;
    if (had && !state.sel) map.flyToBounds([[5.6, 97.3], [20.5, 105.7]], { padding: [16, 16], duration: 0.5 });
    renderToggles(); renderLegend(); applyLayers(); renderPanel();
  }
  document.querySelectorAll(".lenses button").forEach((b) => b.addEventListener("click", () => setLens(b.dataset.lens)));
  $("#year").addEventListener("input", (e) => { state.year = +e.target.value; $("#yearLabel").textContent = state.year === 2026 ? "2026*" : state.year; applyLayers(); renderPanel(); });
  map.on("click", (e) => { if (state.pinning) openPinDialog(e.latlng); });

  // ---------- panel ----------
  const panel = $("#panel");
  function renderPanel() {
    let h = "";
    if (state.sel && state.sel.type === "province") h = provincePanel(state.sel.id);
    else if (state.sel && state.sel.type === "crossing") h = crossingPanel(state.sel.id);
    else h = state.lens === "trade" ? tradeOverview() : state.lens === "knowledge" ? knowledgeOverview() : projectOverview();
    h += pinsSection() + sourcesBlock();
    panel.innerHTML = h;
    wirePanel();
  }
  function wirePanel() {
    panel.querySelectorAll("[data-prov]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); select({ type: "province", id: el.dataset.prov }); }));
    panel.querySelectorAll("[data-cross]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); select({ type: "crossing", id: el.dataset.cross }); }));
    panel.querySelectorAll("svg [data-key]").forEach((el) => el.addEventListener("click", () => select({ type: "province", id: el.dataset.key })));
    const back = $(".back", panel); if (back) back.addEventListener("click", () => { state.sel = null; applyLayers(); renderPanel(); map.flyTo([13.2, 101.2], 5.75, { duration: 0.5 }); });
    panel.querySelectorAll("[data-more]").forEach((b) => b.addEventListener("click", () => { panel.querySelectorAll(`[data-hidden="${b.dataset.more}"]`).forEach((li) => (li.hidden = false)); b.remove(); }));
    const ex = $("#pinExportJson", panel); if (ex) ex.addEventListener("click", () => download("workshop-pins.json", JSON.stringify(pins, null, 2), "application/json"));
    const ec = $("#pinExportCsv", panel); if (ec) ec.addEventListener("click", () => download("workshop-pins.csv", toCsv(pins), "text/csv"));
    const cl = $("#pinClear", panel); if (cl) cl.addEventListener("click", () => { if (confirm("ลบหมุด Workshop ทั้งหมดในเครื่องนี้?")) { pins = []; savePins(); renderPanel(); } });
    panel.querySelectorAll("[data-delpin]").forEach((b) => b.addEventListener("click", () => { pins.splice(+b.dataset.delpin, 1); savePins(); renderPanel(); }));
  }

  // ----- overview: project
  function projectOverview() {
    const nDist = P.provinces.reduce((s, p) => s + p.districts.length, 0);
    const inSac = P.provinces.filter((p) => p.in_sac16).length;
    let h = `<div class="kicker">ภาพรวมพื้นที่โครงการ</div>
      <h2>เมืองชายแดน 4 แนว ${P.provinces.length} จังหวัด</h2>
      <p class="lede">พื้นที่วิจัย บพท. ปี 2567–68 + พื้นที่ต้นแบบ "ครูค่ายชายแดน" ของ ศมส. — โครงหลักที่งานสื่อสารร่วม Thai PBS จะเกาะไปทั้ง 9 เดือน คลิกจังหวัดบนแผนที่เพื่อดูต้นทุนข้อมูลของแต่ละพื้นที่</p>
      <div class="kpis">
        <div class="kpi"><b>${inSac}</b><span>จังหวัดในข้อเสนอ ศมส.</span></div>
        <div class="kpi"><b>${nDist}</b><span>อำเภอเป้าหมาย</span></div>
        <div class="kpi"><b>${P.research_projects.length}</b><span>โครงการวิจัย บพท. 67–68</span></div>
        <div class="kpi"><b>${P.pilot_sites.length}</b><span>พื้นที่ต้นแบบครูค่าย</span></div>
        <div class="kpi"><b>4+1</b><span>เวทีภูมิภาค + ระดับชาติ</span></div>
        <div class="kpi"><b>${A.crossings.length}</b><span>ด่าน/จุดผ่านแดนที่มีสถิติ</span></div>
      </div>
      <h3>4 แนวชายแดน · 4 ความเปราะบาง</h3>`;
    Object.entries(P.regions).forEach(([k, r]) => {
      const ps = P.provinces.filter((p) => p.region === k);
      h += `<div class="card"><b>${esc(r.th)}</b><p class="muted" style="margin:4px 0 8px">${esc(r.vulnerability)}</p><div class="chips">${ps.map((p) => `<a href="#" class="chip" data-prov="${esc(p.name_th)}"><i class="line-dot" style="background:${LINE_COLOR(p.lines[0])}"></i>${esc(p.name_th)}</a>`).join("")}</div></div>`;
    });
    h += `<h3>พื้นที่ต้นแบบครูค่ายชายแดน</h3>`;
    P.pilot_sites.forEach((s) => (h += `<div class="card"><div class="kicker" style="margin:0">★ ${esc(s.short)}</div><b>${esc(s.name)}</b><p class="muted" style="margin:4px 0 0">${esc(s.people)} · ${esc(s.issue)}<br>ภาคี: ${esc(s.partner)}</p></div>`));
    h += `<h3>เส้นทางเวที 4+1</h3><ul class="list">` + P.forums.map((f) => `<li ${f.anchor ? `data-prov="${esc(f.anchor[0])}"` : ""}><span class="rank">${f.order}</span><span class="nm">${esc(f.place)}<small>${esc(f.note)}</small></span><span class="val">${esc(f.when)}</span></li>`).join("") + `</ul>`;
    h += `<h3>ต้องยืนยันใน Workshop</h3>
      <div class="flag"><span><b>ศรีสะเกษ vs อุบลฯ</b> — กลไกปี 68 มีศรีสะเกษ (ม.ราชภัฏศรีสะเกษ) แต่รายชื่อ 16 จังหวัดในข้อเสนอ ศมส. ใส่อุบลฯ แทน</span></div>
      <div class="flag"><span><b>อุบลฯ ไม่มีมหาวิทยาลัยแม่ข่าย</b> — พื้นที่ต้นแบบโขงเจียมต้องเข้าผ่านเครือข่ายชาติพันธุ์ ศมส.</span></div>
      <div class="flag"><span><b>ชื่อพื้นที่ต้นแบบใต้</b> — เอกสารสะกด "ปลาดี" และ "ปาดี" (ต.สาวอ อ.รือเสาะ) · ร่างแรกเคยระบุเชียงราย–ยะลา</span></div>
      <div class="flag"><span><b>พิกัดโครงการ 3 และ 6</b> — เอกสารระบุเพียง "ตาก" / "หลายจังหวัดเหนือล่าง" หมุดบนแผนที่เป็นตำแหน่งตัวแทน</span></div>`;
    return h;
  }

  // ----- overview: trade
  function tradeOverview() {
    const y = state.year;
    const list = A.crossings.filter((c) => !state.on.projOnly || c.project);
    const byLine = Object.keys(LINES).map((k) => ({ k, v: list.filter((c) => c.line === k).reduce((s, c) => s + total(c, y), 0) }));
    const all = byLine.reduce((s, d) => s + d.v, 0);
    const kh = A.crossings.filter((c) => c.line === "KH");
    const kh24 = kh.reduce((s, c) => s + ytdSum(c, 2024, LAST_M), 0), kh26 = kh.reduce((s, c) => s + ytdSum(c, 2026, LAST_M), 0);
    const months = []; for (let yy = 2023; yy <= 2026; yy++) for (let m = 1; m <= 12; m++) { if (yy === 2026 && m > LAST_M) break; months.push(`${yy}-${String(m).padStart(2, "0")}`); }
    const khPts = months.map((m) => ({ m, a: kh.reduce((s, c) => s + (c.monthly[m] ? c.monthly[m][0] : 0), 0), b: kh.reduce((s, c) => s + (c.monthly[m] ? c.monthly[m][1] : 0), 0) }));
    const sorted = list.slice().sort((a, b) => total(b, y) - total(a, y));
    const top3 = sorted.slice(0, 3).reduce((s, c) => s + total(c, y), 0);
    let h = `<div class="kicker">การค้าข้ามแดนรายด่าน · กรมศุลกากร</div>
      <h2>มูลค่าการค้าผ่านด่านชายแดน ${yearLabel(y)}</h2>
      <p class="lede">รวม <b>${baht(all)}</b> จาก ${list.length} ด่าน/จุดผ่านแดน${state.on.projOnly ? " ในจังหวัดโครงการ" : ""} · 3 ด่านใหญ่สุดคิดเป็น ${all ? Math.round((top3 / all) * 100) : 0}% — เศรษฐกิจชายแดนกระจุกตัวสูงมาก</p>
      <h3>แยกตามแนวชายแดน</h3>` +
      C.hbars(byLine.map((d) => ({ label: LINES[d.k].th, value: d.v / 1e3, color: LINE_COLOR(d.k) })), { labelW: 96, unit: " พันล้าน" }) +
      `<div class="story"><div class="kicker">ประเด็นสื่อ · data story</div><b>ชายแดนไทย–กัมพูชา: การค้าแทบเป็นศูนย์</b>
        <p>${TH_MONTH[1]}–${TH_MONTH[LAST_M]} 2567 ด่านฝั่งกัมพูชามีการค้า <strong>${baht(kh24)}</strong> · ช่วงเดียวกันปี 2569 เหลือ <strong>${baht(kh26)}</strong> (${pctTxt(pct(kh26, kh24))}) — รวมด่านช่องจอม (สุรินทร์) และช่องสะงำ (ศรีสะเกษ) ซึ่งอยู่ในอำเภอเป้าหมายของโครงการ</p>
        <div class="chart-legend"><span><i style="background:var(--exp)"></i>ส่งออก</span><span><i style="background:var(--imp)"></i>นำเข้า</span><span class="muted">ล้านบาท/เดือน</span></div>
        ${C.lines(khPts, { markers: [{ m: "2025-07", label: "ก.ค. 68" }] })}
        <p class="muted" style="font-size:12px">คำถามสำหรับเวทีอีสาน: คนชายแดนที่พึ่งการค้าข้ามแดนปรับตัวอย่างไร ใครได้รับผลกระทบก่อน?</p></div>
      <h3>ด่านทั้งหมด <span class="count">เรียงตามมูลค่า ${y}</span></h3><ul class="list">`;
    sorted.forEach((c, i) => {
      const v = total(c, y), prev = total(c, y - 1);
      const series = YEARS.map((yy) => total(c, yy));
      h += `<li data-cross="${c.id}" ${i >= 15 ? 'hidden data-hidden="cross"' : ""}><span class="rank">${i + 1}</span><span class="nm">${esc(c.name)}<small><i class="line-dot" style="background:${LINE_COLOR(c.line)}"></i> ${esc(c.prov)}${c.target_district ? " · อำเภอเป้าหมาย" : c.project ? "" : " · นอกพื้นที่โครงการ"}</small></span>${C.spark(series, { color: LINE_COLOR(c.line) })}<span class="val">${shortBaht(v)}<br><small class="muted">${y > 2017 && y !== 2026 ? pctTxt(pct(v, prev)) : ""}</small></span></li>`;
    });
    h += `</ul>${sorted.length > 15 ? `<button class="more" data-more="cross">ดูทั้งหมด ${sorted.length} ด่าน</button>` : ""}`;
    return h;
  }

  // ----- overview: knowledge
  function knowledgeOverview() {
    const rows = P.provinces.map((p) => ({ label: p.name_th, value: resN(p.name_th), color: rampColor(resN(p.name_th)), key: p.name_th })).sort((a, b) => b.value - a.value);
    const top = rows[0], low = rows.filter((r) => r.value <= 2).map((r) => r.label);
    const south = ["นราธิวาส", "ยะลา", "สตูล"].reduce((s, p) => s + resN(p), 0);
    let h = `<div class="kicker">คลังความรู้ชาติพันธุ์ ศมส. · ข้อมูลเปิด</div>
      <h2>ความรู้กระจุกอยู่ที่ไหน?</h2>
      <p class="lede">งานวิจัยชาติพันธุ์ ${A.meta.sac.research_total.toLocaleString()} ชิ้นใน API สาธารณะของ ศมส. — ${A.meta.sac.research_matched} ชิ้นกล่าวถึงจังหวัดในโครงการ คลิกแท่งเพื่อดูรายจังหวัด</p>` +
      C.hbars(rows, { labelW: 112, unit: " ชิ้น", valueFmt: (v) => v.toLocaleString("en-US") }) +
      `<div class="story"><div class="kicker">Knowledge gap</div><b>ภาคเหนือถูกศึกษามาก — ชายแดนใต้และหลายจังหวัดริมโขงแทบว่าง</b>
        <p><strong>${esc(top.label)} ${top.value} ชิ้น</strong> ขณะที่ 3 จังหวัดชายแดนใต้รวมกัน <strong>${south} ชิ้น</strong> และ ${low.map(esc).join(", ")} มีไม่เกิน 2 ชิ้น — ตรงกับ "Knowledge Gap" ในข้อเสนอโครงการ และเป็นเหตุผลที่ฐานข้อมูลตำบลชายแดน (SAC-02/03) จำเป็น</p><p class="muted" style="font-size:12px">หมายเหตุ: นับทั้งจังหวัด (เช่น เชียงใหม่รวมงานที่ไม่ใช่พื้นที่ชายแดน) — เป็นดัชนีคร่าว ๆ ของความหนาแน่นความรู้</p></div>
      <h3>ช่องว่างที่ข้อมูล SAC-02/03 จะเติม</h3><p class="muted" style="margin-top:-4px">${esc(P.sac_survey_slots.status)}</p>${slotsHtml()}
      <h3>สิ่งที่ต้องขอจาก ศมส. (ช่วงบ่าย 14:45)</h3>
      <ul class="reslist">
        <li><b>สิทธิ์ดู dashboard + ไฟล์ Excel</b><small>ระดับจังหวัด/ตำบลที่ใช้ในการอบรม มี.ค. 69</small></li>
        <li><b>รายชื่อตำบลที่มีข้อมูลแล้ว</b><small>ครอบคลุม 16 จังหวัดเท่าไร — โขงเจียม/รือเสาะมีหรือยัง</small></li>
        <li><b>Data dictionary SAC-02 / SAC-03</b><small>ชื่อฟิลด์ หน่วย ค่าที่เป็นไปได้</small></li>
        <li><b>ระดับที่เผยแพร่ได้ (PDPA)</b><small>สถานะบุคคล ที่ดิน สุขภาพ = ข้อมูลอ่อนไหว → aggregate/ปกปิด</small></li>
        <li><b>ข้อตกลงแบ่งปันข้อมูล + กำหนดส่ง</b><small>dashboard ศมส. ส่งเดือน 5–8 แต่ data story แรกของเราเดือน 3</small></li>
      </ul>`;
    return h;
  }
  function slotsHtml() {
    return `<div class="slots">` + P.sac_survey_slots.indicators.map((g) => `<div class="slot"><b>${esc(g.group)}</b><span>${g.items.map(esc).join(" · ")}</span><div class="st">รอเชื่อม ศมส.</div></div>`).join("") + `</div>`;
  }

  // ----- province detail
  function provincePanel(name) {
    const p = PROV[name]; const s = A.sac[name] || { research: [], groups: [], research_n: 0 };
    const reg = P.regions[p.region];
    const rp = P.research_projects.filter((r) => (r.anchor && r.anchor[0] === name) || (name === "ประจวบคีรีขันธ์" && r.no === 4) || r.no === 7);
    const pilot = P.pilot_sites.filter((x) => x.province === name);
    const forum = P.forums.filter((f) => f.anchor && f.anchor[0] === name);
    const ev = P.network_events_2569.filter((e) => e.anchor[0] === name);
    const cs = A.crossings.filter((c) => c.prov === name).sort((a, b) => total(b, state.year) - total(a, state.year));
    const res = s.research.slice().sort((a, b) => (b.d.length > 0) - (a.d.length > 0));
    let h = `<button class="back">← ภาพรวม</button>
      <div class="chips" style="margin-bottom:8px">${lineChips(p.lines)}</div>
      <h2>${esc(name)} <span class="muted" style="font-size:15px;font-weight:400">${esc(p.name_en)}</span></h2>
      <p class="lede">ผู้ถือพื้นที่: ${esc(p.university)}</p>
      ${!p.in_sac16 || p.note ? `<div class="flag"><span>${esc(p.note || "ไม่อยู่ในรายชื่อ 16 จังหวัดของข้อเสนอ ศมส.")}</span></div>` : ""}
      <div class="kpis">
        <div class="kpi"><b>${p.districts.length}</b><span>อำเภอเป้าหมาย</span></div>
        <div class="kpi"><b>${cs.length}</b><span>ด่าน/จุดผ่านแดน</span></div>
        <div class="kpi"><b>${s.research_n}</b><span>งานวิจัยใน ศมส. ที่กล่าวถึง</span></div>
      </div>
      <h3>อำเภอเป้าหมาย</h3><div class="chips">${p.districts.map((d) => `<span class="chip target">${esc(d === "เมืองประจวบคีรีข" ? "เมืองประจวบคีรีขันธ์" : d)}</span>`).join("")}</div>
      <h3>ความเปราะบางของภูมิภาค${esc(reg.th)}</h3><div class="card"><p style="margin:0">${esc(reg.vulnerability)}</p><p class="muted" style="margin:6px 0 0;font-size:12px">จากข้อเสนอโครงการ ศมส. (ระดับภูมิภาค — ยังไม่ใช่ข้อมูลรายพื้นที่)</p></div>`;
    if (pilot.length) h += `<h3>★ พื้นที่ต้นแบบครูค่ายชายแดน</h3>` + pilot.map((x) => `<div class="card"><b>${esc(x.name)}</b><p class="muted" style="margin:4px 0 0">${esc(x.people)} · ${esc(x.issue)}<br>ภาคี: ${esc(x.partner)}</p></div>`).join("");
    if (forum.length || ev.length) h += `<h3>เวที</h3><ul class="list">` + forum.map((f) => `<li><span class="rank">${f.order}</span><span class="nm">เวทีภูมิภาค · ${esc(f.place)}<small>${esc(f.note)}</small></span><span class="val">${esc(f.when)}</span></li>`).join("") + ev.map((e) => `<li><span class="rank">•</span><span class="nm">${esc(e.place)}<small>${esc(e.what)}</small></span><span class="val">${esc(e.date)}</span></li>`).join("") + `</ul>`;
    h += `<h3>โครงการวิจัย บพท. ที่เกี่ยวข้อง <span class="count">${rp.length}</span></h3><ul class="reslist">` + rp.map((r) => `<li><b>${r.no}. ${esc(r.title)}</b><small>${esc(r.pi)} · ${esc(r.org)} · ปี ${r.year}</small><small>มุมสื่อ: ${esc(r.media_hook)}</small></li>`).join("") + `</ul>`;
    if (cs.length) {
      h += `<h3>ด่าน/จุดผ่านแดน <span class="count">${yearLabel(state.year)}</span></h3><ul class="list">` + cs.map((c) => `<li data-cross="${c.id}"><span class="nm">${esc(c.name)}<small>อ.${esc(c.district)}${c.target_district ? " · อำเภอเป้าหมาย" : ""}</small></span>${C.spark(YEARS.map((y) => total(c, y)), { color: LINE_COLOR(c.line) })}<span class="val">${baht(total(c, state.year))}</span></li>`).join("") + `</ul>`;
    }
    h += `<h3>กลุ่มชาติพันธุ์ที่ ศมส. กล่าวถึง <span class="count">${s.groups.length}</span></h3>` +
      (s.groups.length ? `<div class="chips">${s.groups.map((g) => `<a class="chip" target="_blank" rel="noopener" href="${esc(g.url)}">${esc(g.name)}</a>`).join("")}</div>` : `<p class="muted">ไม่พบในโปรไฟล์กลุ่มชาติพันธุ์</p>`) +
      `<p class="muted" style="font-size:12px;margin-top:6px">จากการค้นชื่อจังหวัดในโปรไฟล์ 60 กลุ่ม — ไม่ใช่สำมะโนว่าใครอยู่ที่ไหน</p>`;
    h += `<h3>งานวิจัยในคลัง ศมส. <span class="count">${s.research_n} ชิ้น</span></h3>` +
      (res.length ? `<ul class="reslist">${res.map((r, i) => `<li ${i >= 6 ? 'hidden data-hidden="res"' : ""}><a target="_blank" rel="noopener" href="${esc(r.u)}">${esc(r.t)}</a><small>${esc(r.a)}${r.d.length ? " · อ." + r.d.map(esc).join(", อ.") : ""}</small></li>`).join("")}</ul>${res.length > 6 ? `<button class="more" data-more="res">ดูอีก ${res.length - 6} ชิ้น</button>` : ""}` : `<p class="muted">ยังไม่มีงานวิจัยที่กล่าวถึง — ช่องว่างความรู้</p>`);
    h += `<h3>ข้อมูลระดับตำบลจาก ศมส.</h3>${slotsHtml()}`;
    return h;
  }

  // ----- crossing detail
  function crossingPanel(id) {
    const c = A.crossings.find((x) => x.id === id); const y = state.year;
    const v = c.annual[String(y)] || [0, 0]; const prev = total(c, y - 1);
    const rows = YEARS.map((yy) => ({ x: yy, a: (c.annual[String(yy)] || [0, 0])[0], b: (c.annual[String(yy)] || [0, 0])[1], partial: yy === 2026 }));
    const months = Object.keys(c.monthly).sort();
    const pts = months.map((m) => ({ m, a: c.monthly[m][0], b: c.monthly[m][1] }));
    const goods = (arr) => (arr.length ? `<ul class="goods">${arr.map(([k, val, hs]) => `<li><span title="${esc(k)} · พิกัด ${esc(hs)}">${esc(k)} <small class="hs">${esc(hs.slice(0, 4) + "." + hs.slice(4, 6))}</small></span><span>${C.fmt(val)}</span></li>`).join("")}</ul>` : `<p class="muted">ไม่มีข้อมูล</p>`);
    return `<button class="back">← ภาพรวม</button>
      <div class="chips" style="margin-bottom:8px">${lineChips([c.line])}${c.target_district ? `<span class="chip target">อำเภอเป้าหมาย</span>` : c.project ? "" : `<span class="chip">นอกพื้นที่โครงการ</span>`}</div>
      <h2>ด่าน${esc(c.name)}</h2>
      <p class="lede">อ.${esc(c.district)} จ.<a href="#" data-prov="${esc(c.prov)}" ${PROV[c.prov] ? "" : 'style="pointer-events:none;text-decoration:none"'}>${esc(c.prov)}</a></p>
      <div class="kpis">
        <div class="kpi"><b>${C.fmt(v[0] + v[1])}</b><span>ล้านบาท · ${y === 2026 ? "2026*" : y}</span></div>
        <div class="kpi"><b style="color:var(--exp)">${C.fmt(v[0])}</b><span>ส่งออก</span></div>
        <div class="kpi"><b style="color:var(--imp)">${C.fmt(v[1])}</b><span>นำเข้า${y > 2017 && y !== 2026 ? ` · ${pctTxt(pct(v[0] + v[1], prev))} จากปีก่อน` : ""}</span></div>
      </div>
      <h3>รายปี 2017–2026</h3>
      <div class="chart-legend"><span><i style="background:var(--exp)"></i>ส่งออก</span><span><i style="background:var(--imp)"></i>นำเข้า</span><span class="muted">ล้านบาท · *2026 = ${TH_MONTH[1]}–${TH_MONTH[LAST_M]}</span></div>
      ${C.stacked(rows, { highlight: y })}
      <h3>รายเดือน 2023–2026</h3>${C.lines(pts)}
      <h3>สินค้าหลักปี 2025 <span class="count">ล้านบาท</span></h3>
      <div class="cols"><div><div class="muted" style="font-size:12px;margin-bottom:4px">ส่งออก</div>${goods(c.top_export)}</div><div><div class="muted" style="font-size:12px;margin-bottom:4px">นำเข้า</div>${goods(c.top_import)}</div></div>
      <h3>จุดบันทึกของศุลกากรที่รวมไว้</h3><ul class="reslist">${c.posts.map((p) => `<li><small style="color:var(--ink-2)">${esc(p)}</small></li>`).join("")}</ul>
      <p class="muted" style="font-size:12px">หมุดวางที่จุดกึ่งกลางอำเภอ ไม่ใช่พิกัดด่านจริง</p>`;
  }

  // ----- workshop pins section
  function pinsSection() {
    if (!pins.length) return "";
    return `<h3>หมุดจาก Workshop <span class="count">${pins.length}</span></h3>` +
      pins.map((p, i) => { const k = KIND[p.kind] || KIND.issue; return `<div class="card pinrow"><i class="dot" style="background:${k[1]}"></i><div style="flex:1"><b>${esc(k[0])}</b> <span class="muted">รอบ ${p.round}${p.who ? " · " + esc(p.who) : ""}</span><div>${esc(p.note)}</div></div><button class="back" style="margin:0" data-delpin="${i}" title="ลบ">✕</button></div>`; }).join("") +
      `<div class="btnrow"><button class="solid" id="pinExportCsv">ดาวน์โหลด CSV</button><button id="pinExportJson">JSON</button><button id="pinClear">ล้างทั้งหมด</button></div>`;
  }
  function sourcesBlock() {
    return `<div class="sources"><b>ที่มาข้อมูล</b><ul>
      <li>สถิตินำเข้า–ส่งออกรายด่าน กรมศุลกากร 2017–${TH_MONTH[LAST_M]} 2026</li>
      <li>API สาธารณะ ethnicity.sac.or.th (กลุ่มชาติพันธุ์ 60 กลุ่ม, งานวิจัย ${A.meta.sac.research_total.toLocaleString()} ชิ้น) · CC BY-NC</li>
      <li>เอกสารโครงการ บพท. / ศมส. / Thai PBS (แผนที่พื้นที่วิจัย 67–68, ข้อเสนอ วธ 0700/165, ร่างแผนสื่อสาร)</li>
      <li>ขอบเขตจังหวัด/อำเภอ: OpenGISData-Thailand · แผนที่ฐาน © OpenStreetMap, CARTO</li></ul>
      ต้นแบบนี้ <b>ยังไม่มี</b> ข้อมูล SAC-02/03 — ช่องประเส้นคือที่ที่ข้อมูล ศมส. จะเสียบเข้ามา</div>`;
  }

  // ---------- pin mode ----------
  const dlg = $("#pinDialog"); let pendingLL = null;
  $("#pinMode").addEventListener("click", () => {
    state.pinning = !state.pinning;
    $("#pinMode").setAttribute("aria-pressed", state.pinning);
    document.body.classList.toggle("pinning", state.pinning);
    $("#pinMode span").textContent = state.pinning ? "คลิกแผนที่เพื่อปักหมุด" : "ปักหมุด Workshop";
  });
  function openPinDialog(ll) {
    pendingLL = ll;
    const near = nearestProvince(ll);
    $("#pinWhere").textContent = near ? `ใกล้ ${near}` : `${ll.lat.toFixed(3)}, ${ll.lng.toFixed(3)}`;
    $("#pinForm").reset();
    dlg.showModal();
  }
  dlg.addEventListener("close", () => {
    if (dlg.returnValue !== "ok" || !pendingLL) return;
    const fd = new FormData($("#pinForm"));
    pins.push({ lat: +pendingLL.lat.toFixed(5), lng: +pendingLL.lng.toFixed(5), near: nearestProvince(pendingLL), round: fd.get("round"), kind: fd.get("kind"), who: (fd.get("who") || "").trim(), note: (fd.get("note") || "").trim(), ts: new Date().toISOString() });
    savePins(); state.on.pins = true; applyLayers(); renderPanel();
  });
  function nearestProvince(ll) {
    let best = null, bd = Infinity;
    A.geo.provinces.features.forEach((f) => { const c = f.properties.c; const d = (c[0] - ll.lat) ** 2 + (c[1] - ll.lng) ** 2; if (d < bd) { bd = d; best = f.properties.name; } });
    return best;
  }
  function toCsv(rows) {
    const cols = ["round", "kind", "who", "note", "near", "lat", "lng", "ts"];
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    return "\ufeff" + cols.join(",") + "\n" + rows.map((r) => cols.map((c) => q(c === "kind" ? (KIND[r.kind] || [r.kind])[0] : r[c])).join(",")).join("\n");
  }
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- boot ----------
  drawPins();
  renderToggles(); renderLegend(); applyLayers(); renderPanel();
  // deep link: #lens=trade&prov=ตาก&cross=mukdahan&year=2024
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get("year")) { state.year = +hp.get("year"); $("#year").value = state.year; $("#yearLabel").textContent = state.year; }
  if (hp.get("lens")) setLens(hp.get("lens"));
  if (hp.get("prov") && PROV[hp.get("prov")]) select({ type: "province", id: hp.get("prov") });
  if (hp.get("cross")) select({ type: "crossing", id: hp.get("cross") });
})();
