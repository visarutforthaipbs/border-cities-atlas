"""Assemble everything the MVP needs into web/data.js (window.ATLAS = {...}).

Single JS file so index.html opens by double-click (no server, no fetch/CORS).
Inputs:
  data/project.json          curated from project documents (see meta.sources)
  data/sac_index.json        from 02_sac.py (SAC public API)
  data/trade_raw_agg.json    from 01_trade.py (Thai Customs per-checkpoint CSVs)
  data/raw/provinces.geojson, data/raw/districts.geojson
     (github.com/chingchai/OpenGISData-Thailand — admin boundaries)
"""
import json, os, collections
from shapely.geometry import shape, mapping

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, "..")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "web", "data.js")

# Border crossings: customs post names -> one map point at the district centroid.
# (prov, district) must exist in districts.geojson. Pins sit at the DISTRICT
# centroid, not the exact gate — the UI says so.
CROSSINGS = [
    # --- Malaysia ---
    ("sadao", "สะเดา", "MY", "สงขลา", "สะเดา", ["ด่านศุลกากรสะเดา (ศภ.4)"]),
    ("padang", "ปาดังเบซาร์", "MY", "สงขลา", "สะเดา", ["ด่านศุลกากรปาดังเบซาร์ (ศภ.4)", "ด่านศุลกากรปาดังเบซาร์ ทางบกพรมแดน1", "ด่านศุลกากรปาดังเบซาร์ ทางรถไฟ"]),
    ("ban_prakop", "บ้านประกอบ", "MY", "สงขลา", "นาทวี", ["ด่านศุลกากรบ้านประกอบ (ศภ.4)"]),
    ("sungai_kolok", "สุไหงโก-ลก", "MY", "นราธิวาส", "สุไหงโก-ลก", ["ด่านศุลกากรสุไหง โก-ลก (ศภ.4)"]),
    ("buketa", "บูเก๊ะตา", "MY", "นราธิวาส", "แว้ง", ["ด่านพรมแดนบูเก๊ะตา ด่านศุลกากรสุไหง โก-ลก", "ด่านศุลกากรบูเก๊ะตา (ศภ.4)"]),
    ("tak_bai", "ตากใบ", "MY", "นราธิวาส", "ตากใบ", ["ด่านศุลกากรตากใบ (ศภ.4)"]),
    ("betong", "เบตง", "MY", "ยะลา", "เบตง", ["ด่านศุลกากรเบตง (ศภ.4)"]),
    ("wang_prachan", "วังประจัน", "MY", "สตูล", "ควนโดน", ["ด่านศุลกากรวังประจัน (ศภ.4)"]),
    ("satun", "สตูล (ทางเรือ)", "MY", "สตูล", "เมืองสตูล", ["ด่านศุลกากรสตูล (ศภ.4)"]),
    # --- Myanmar ---
    ("mae_sot", "แม่สอด", "MM", "ตาก", "แม่สอด", ["จุดบริการช่องทางอนุมัติในพื้นที่อำเภอแม่สอด", "จุดบริการช่องทางอนุมัตินอกพื้นที่อำเภอแม่สอด", "ด่านพรมแดนแม่สอด(สะพานมิตรภาพไทย-พม่า)", "ด่านศุลกากรแม่สอด (ศภ.3)"]),
    ("mae_sai", "แม่สาย", "MM", "เชียงราย", "แม่สาย", ["ด่านศุลกากรแม่สาย (ด่านพรมแดนแม่สายแห่งที่ 2)", "ด่านพรมแดนแม่สายแห่งที่ 1"]),
    ("mae_hong_son", "แม่ฮ่องสอน", "MM", "แม่ฮ่องสอน", "เมืองแม่ฮ่องสอน", ["ด่านศุลกากรแม่ฮ่องสอน (ศภ.3)"]),
    ("mae_sariang", "แม่สะเรียง", "MM", "แม่ฮ่องสอน", "แม่สะเรียง", ["ด่านศุลกากรแม่สะเรียง (ศภ.3)"]),
    ("sangkhla", "สังขละบุรี", "MM", "กาญจนบุรี", "สังขละบุรี", ["ด่านศุลกากรสังขละบุรี (ศภ.1)"]),
    ("phu_nam_ron", "บ้านพุน้ำร้อน", "MM", "กาญจนบุรี", "เมืองกาญจนบุรี", ["จุดผ่านแดนถาวรบ้านพุน้ำร้อน"]),
    ("singkhon", "ด่านสิงขร", "MM", "ประจวบคีรีขันธ์", "เมืองประจวบคีรีข", ["ด่านพรมแดนสิงขร"]),
    # --- Laos ---
    ("chiang_saen", "เชียงแสน", "LA", "เชียงราย", "เชียงแสน", ["ด่านศุลกากรเชียงแสน (ศภ.3)"]),
    ("chiang_khong", "เชียงของ", "LA", "เชียงราย", "เชียงของ", ["ด่านพรมแดนเชียงของแห่งที่ 4 สะพานมิตรภาพไทย-ลาว แห่งที่ 4 เชียงของ-ห้วยทราย", "ด่านพรมแดนเชียงของแห่งที่ 3(ท่าเรือผาถ่าน)", "ด่านพรมแดนเชียงของแห่งที่ 1(ท่าเรือบั๊ค)", "ด่านพรมแดนเชียงของแห่งที่ 2(ท่าเรือเชียงของ)", "ด่านศุลกากรเชียงของ"]),
    ("ban_huak", "บ้านฮวก", "LA", "พะเยา", "ภูซาง", ["ด่านพรมแดนบ้านฮวก"]),
    ("thung_chang", "ทุ่งช้าง (ห้วยโก๋น)", "LA", "น่าน", "ทุ่งช้าง", ["ด่านศุลกากรทุ่งช้าง (ศภ.3)"]),
    ("phu_du", "ภูดู่", "LA", "อุตรดิตถ์", "บ้านโคก", ["สำนักงานศุลกากรชั่วคราวจุดผ่านแดนถาวรภูดู่"]),
    ("tha_li", "ท่าลี่", "LA", "เลย", "ท่าลี่", ["ด่านศุลกากรท่าลี่ (ศภ.2)"]),
    ("chiang_khan", "เชียงคาน", "LA", "เลย", "เชียงคาน", ["ด่านศุลกากรเชียงคาน (ศภ.2)", "ด่านพรมแดนเชียงคาน"]),
    ("nong_khai", "หนองคาย", "LA", "หนองคาย", "เมืองหนองคาย", ["สำนักงานศุลกากรหนองคาย", "ด่านพรมแดนรถไฟหนองคาย", "ด่านพรมแดนท่าเรือหนองคาย (ท่าเรือหายโศก)"]),
    ("bueng_kan", "บึงกาฬ", "LA", "บึงกาฬ", "เมืองบึงกาฬ", ["ด่านศุลกากรบึงกาฬ (ศภ.2)", "ด่านพรมแดนท่าเรือโดยสารบริเวณด่านฯ บึงกาฬเดิม"]),
    ("nakhon_phanom", "นครพนม", "LA", "นครพนม", "เมืองนครพนม", ["ด่านศุลกากรนครพนม (ศภ.2)", "จุดผ่านแดนถาวรท่าเทียบเรือโดยสารการท่องเที่ยวนครพนม"]),
    ("mukdahan", "มุกดาหาร", "LA", "มุกดาหาร", "เมืองมุกดาหาร", ["ด่านศุลกากรมุกดาหาร (ศภ.2)", "รพท.มุกดาหารลานทอง ด่านศุลกากรมุกดาหาร", "ด่านพรมแดนท่าเรือเทศบาลมุกดาหาร"]),
    ("khemmarat", "เขมราฐ", "LA", "อุบลราชธานี", "เขมราฐ", ["ด่านศุลกากรเขมราฐ (ศภ.2)"]),
    ("pak_saeng", "บ้านปากแซง", "LA", "อุบลราชธานี", "นาตาล", ["ด่านพรมแดนบ้านปากแซง อำเภอนาตาล อุบลราชธานี(ศภ.2)"]),
    ("chong_mek", "ช่องเม็ก", "LA", "อุบลราชธานี", "สิรินธร", ["ด่านศุลกากรช่องเม็ก (ศภ.2)", "ด่านพรมแดนช่องเม็ก (ศภ.2)"]),
    # --- Cambodia ---
    ("chong_sa_ngam", "ช่องสะงำ", "KH", "ศรีสะเกษ", "ภูสิงห์", ["ด่านศุลกากรช่องสะงำ (ศภ.2)"]),
    ("chong_chom", "ช่องจอม", "KH", "สุรินทร์", "กาบเชิง", ["ด่านศุลกากรช่องจอม (ศภ.2)"]),
    ("aranyaprathet", "อรัญประเทศ–คลองลึก", "KH", "สระแก้ว", "อรัญประเทศ", ["ด่านศุลกากรอรัญประเทศ (ศภ.1)", "จุดตรวจด่านพรมแดนคลองลึก (ศภ.1)"]),
    ("nong_ian", "หนองเอี่ยน–สตึงบท", "KH", "สระแก้ว", "อรัญประเทศ", ["จุดผ่านแดนถาวรสะพานมิตรภาพไทย-กัมพูชา (หนองเอี่ยน-สตึงบท)"]),
    ("ta_phraya", "ตาพระยา", "KH", "สระแก้ว", "ตาพระยา", ["จุดผ่อนปรนบ้านตาพระยา (ศภ.1)"]),
    ("khao_din", "บ้านเขาดิน", "KH", "สระแก้ว", "คลองหาด", ["ด่านพรมแดนบ้านเขาดิน (ศภ. 1)"]),
    ("ban_laem", "บ้านแหลม", "KH", "จันทบุรี", "โป่งน้ำร้อน", ["ด่านพรมแดนบ้านแหลม", "ด่านศุลกากรบ้านแหลม (ศภ.1)"]),
    ("ban_phakkad", "บ้านผักกาด", "KH", "จันทบุรี", "โป่งน้ำร้อน", ["ด่านพรมแดนบ้านผักกาด"]),
    ("sap_tari", "บ้านซับตารี", "KH", "จันทบุรี", "โป่งน้ำร้อน", ["จุดผ่อนปรนทางการค้าบ้านซับตารี"]),
    ("hat_lek", "บ้านหาดเล็ก", "KH", "ตราด", "คลองใหญ่", ["ด่านพรมแดนบ้านหาดเล็ก"]),
]

# Small jitter (deg) when two crossings share a district centroid.
JITTER = {"padang": (-0.06, 0.0), "nong_ian": (0.06, 0.05), "ban_phakkad": (0.07, 0.0), "sap_tari": (-0.07, 0.0)}


def simplify_fc(features, tol, prec):
    out = []
    for f in features:
        g = shape(f["geometry"]).simplify(tol, preserve_topology=True)
        gj = mapping(g)

        def rnd(c):
            if isinstance(c[0], (float, int)):
                return [round(c[0], prec), round(c[1], prec)]
            return [rnd(x) for x in c]
        gj = {"type": gj["type"], "coordinates": rnd(gj["coordinates"])}
        out.append({"type": "Feature", "properties": f["properties"], "geometry": gj})
    return {"type": "FeatureCollection", "features": out}


def main():
    project = json.load(open(os.path.join(DATA, "project.json")))
    sac = json.load(open(os.path.join(DATA, "sac_index.json")))
    trade = json.load(open(os.path.join(DATA, "trade_raw_agg.json")))
    prov = json.load(open(os.path.join(DATA, "raw", "provinces.geojson")))
    dist = json.load(open(os.path.join(DATA, "raw", "districts.geojson")))

    proj_prov = {p["name_th"]: p for p in project["provinces"]}
    target = {(p["name_th"], d) for p in project["provinces"] for d in p["districts"]}

    # --- geometry ---
    prov_props = []
    for f in prov["features"]:
        n = f["properties"]["pro_th"]
        rp = shape(f["geometry"]).representative_point()
        f["properties"] = {"name": n, "en": f["properties"]["pro_en"], "project": n in proj_prov,
                           "c": [round(rp.y, 4), round(rp.x, 4)]}
    g_prov = simplify_fc(prov["features"], 0.008, 3)

    centroid = {}
    dfeat = []
    for f in dist["features"]:
        p, a = f["properties"]["pro_th"], f["properties"]["amp_th"]
        rp = shape(f["geometry"]).representative_point()
        centroid[(p, a)] = (round(rp.y, 4), round(rp.x, 4))
        if p in proj_prov:
            f["properties"] = {"prov": p, "name": a, "en": f["properties"]["amp_en"], "target": (p, a) in target,
                               "c": list(centroid[(p, a)])}
            dfeat.append(f)
    g_dist = simplify_fc(dfeat, 0.004, 3)
    missing = [t for t in target if t not in centroid]
    assert not missing, missing

    # --- vector basemap: neighbour countries + main rivers (Natural Earth) ---
    from shapely.geometry import box
    bb = box(92.0, 0.5, 110.5, 24.5)
    ne = json.load(open(os.path.join(DATA, "raw", "ne_50m_admin0.geojson")))
    TH_NAMES = {"MMR": "เมียนมา", "LAO": "ลาว", "KHM": "กัมพูชา", "MYS": "มาเลเซีย", "VNM": "เวียดนาม", "CHN": "จีน", "IDN": "อินโดนีเซีย", "THA": "ไทย"}
    nfeat = []
    for f in ne["features"]:
        iso = f["properties"].get("ADM0_A3")
        if iso not in TH_NAMES or iso == "THA":
            continue
        g = shape(f["geometry"]).intersection(bb)
        if g.is_empty:
            continue
        nfeat.append({"type": "Feature", "properties": {"iso": iso, "name": TH_NAMES[iso]}, "geometry": mapping(g)})
    g_neigh = simplify_fc(nfeat, 0.01, 3)
    rv = json.load(open(os.path.join(DATA, "raw", "ne_10m_rivers.geojson")))
    KEEP_R = {"Mekong": "แม่น้ำโขง", "Salween": "แม่น้ำสาละวิน", "Mun": "แม่น้ำมูล", "Chao Phraya": "เจ้าพระยา", "Ping": "ปิง", "Kong": None, "Chi": "ชี"}
    rfeat = []
    for f in rv["features"]:
        n = f["properties"].get("name")
        if n not in KEEP_R:
            continue
        g = shape(f["geometry"]).intersection(bb)
        if g.is_empty:
            continue
        rfeat.append({"type": "Feature", "properties": {"name": KEEP_R[n] or n, "major": n in ("Mekong", "Salween")}, "geometry": mapping(g)})
    g_rivers = simplify_fc(rfeat, 0.005, 3)

    # --- trade ---
    cps = trade["checkpoints"]
    used = set()
    crossings = []
    for cid, name, line, p, d, posts in CROSSINGS:
        assert (p, d) in centroid, (cid, p, d)
        annual = collections.defaultdict(lambda: [0.0, 0.0])
        monthly = collections.defaultdict(lambda: [0.0, 0.0])
        topx, topm = collections.Counter(), collections.Counter()
        found = []
        for post in posts:
            e = cps.get(post)
            if not e:
                continue
            found.append(post)
            used.add(post)
            for y, v in e["annual"].items():
                annual[y][0] += v["export"]
                annual[y][1] += v["import"]
            for m, v in e["monthly"].items():
                monthly[m][0] += v["export"]
                monthly[m][1] += v["import"]
            for k, v, hs in e.get("top_export_2025", []):
                topx[(k, hs)] += v
            for k, v, hs in e.get("top_import_2025", []):
                topm[(k, hs)] += v
        lat, lng = centroid[(p, d)]
        j = JITTER.get(cid, (0, 0))
        mb = lambda x: round(x / 1e6, 1)  # million baht
        crossings.append({
            "id": cid, "name": name, "line": line, "prov": p, "district": d,
            "project": p in proj_prov, "target_district": (p, d) in target,
            "lat": round(lat + j[1], 4), "lng": round(lng + j[0], 4), "posts": found,
            "annual": {y: [mb(v[0]), mb(v[1])] for y, v in sorted(annual.items())},
            "monthly": {m: [mb(v[0]), mb(v[1])] for m, v in sorted(monthly.items()) if m >= "2023-01"},
            "top_export": [[k[0], mb(v), k[1]] for k, v in topx.most_common(5)],
            "top_import": [[k[0], mb(v), k[1]] for k, v in topm.most_common(5)],
        })
    unused = sorted(((v["annual"].get("2025", {}).get("export", 0) + v["annual"].get("2025", {}).get("import", 0)) / 1e6, k)
                    for k, v in cps.items() if k not in used)
    print("largest unmapped posts (2025, M฿):", [(round(a), b) for a, b in unused[-8:]])

    # --- SAC per province ---
    sac_prov = {}
    for p in proj_prov:
        res = [r for r in sac["research"] if p in r["provinces"]]
        grp = [g for g in sac["groups"] if p in g["provinces"]]
        sac_prov[p] = {
            "research_n": len(res),
            "research_district_n": len([r for r in res if any((p, d) in target for d in r["districts"])]),
            "groups": [{"name": g["name"], "family": g["family"], "url": g["url"]} for g in grp],
            "research": [{"t": r["title"], "a": r["author"], "u": r["url"], "d": r["districts"]} for r in res],
        }

    atlas = {
        "meta": {
            "built": "2026-10-16",
            "trade_latest_month_2026": max(trade["meta"]["latest_month_2026"].values()),
            "sac": sac["meta"],
            "sources": project["meta"]["sources"],
        },
        "project": project,
        "geo": {"provinces": g_prov, "districts": g_dist, "neighbours": g_neigh, "rivers": g_rivers},
        "crossings": crossings,
        "sac": sac_prov,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    s = json.dumps(atlas, ensure_ascii=False, separators=(",", ":"))
    open(OUT, "w").write("window.ATLAS=" + s + ";\n")
    print("wrote", OUT, round(len(s.encode()) / 1e6, 2), "MB;", len(crossings), "crossings")


if __name__ == "__main__":
    main()
