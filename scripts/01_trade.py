"""Aggregate Thai Customs per-checkpoint trade CSVs into border-checkpoint series.

Source: Thai Customs "มูลค่าการนำเข้า/ส่งออกสินค้า รายด่านศุลกากร" CSVs, already
mirrored locally by thai-trade-monitor (data/raw/checkpoint_full/).

Output: data/trade_raw_agg.json
  {checkpoint_name: {"office":..., "annual": {year_ce: {"export": baht, "import": baht}},
                     "monthly": {"YYYY-MM": {"export":..,"import":..}},
                     "top_export_2025": [[desc_th, baht], ...], "top_import_2025": [...]}}
Only land/river border checkpoints are kept (filter by name keywords, then curated
in 04_build.py with coordinates).
"""
import csv, json, os, re, sys, collections, glob

SRC = os.path.expanduser(
    "~/Documents/Personal-Project/thai-trade-monitor/data/raw/checkpoint_full")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "trade_raw_agg.json")

# Keep anything that looks like a land/river border post; drop seaports/airports/BKK.
KEEP = re.compile(r"ด่านพรมแดน|จุดผ่อนปรน|จุดผ่านแดน|ช่องทางอนุมัติ|ด่านศุลกากร(?!ท่าอากาศ)|สำนักงานศุลกากรหนองคาย|สำนักงานศุลกากรชั่วคราว")
DROP = re.compile(r"ท่าอากาศยาน|สนามบิน|แม่กลอง|สงขลา \(|ระนอง \(|เกาะสมุย|ภูเก็ต|ท่าเรือระนอง")

MONTHS_TH = {"มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
             "กรกฎาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12}


def main():
    agg = {}
    top = collections.defaultdict(lambda: collections.defaultdict(float))
    files = sorted(glob.glob(os.path.join(SRC, "*.csv")))
    # 2569 files are one file per month (verified: each holds a single เดือนแม่แบบ),
    # so all of them are summed. Track the latest month for the "YTD" label.
    latest_2569 = {}
    for f in files:
        b = os.path.basename(f)
        if "2569" in b:
            d = "export" if b.startswith("export") else "import"
            m = next((v for k, v in MONTHS_TH.items() if k in b), 0)
            if m > latest_2569.get(d, (0, None))[0]:
                latest_2569[d] = (m, f)
    use = files
    for f in use:
        b = os.path.basename(f)
        direction = "export" if b.startswith("export") else "import"
        n = 0
        with open(f, encoding="utf-8-sig", newline="") as fh:
            r = csv.reader(fh)
            h = next(r)
            iy, im = 0, 1
            idesc = h.index("คำอธิบายไทย")
            ival = next(i for i, c in enumerate(h) if c.startswith("มูลค่า"))
            # export files: ด่าน/สถานที่รับบรรทุก ; import files: ด่าน/สถานที่ตรวจปล่อย
            icp = next(i for i, c in enumerate(h) if c.startswith("ด่าน/สถานที่"))
            ioff = h.index("สำนัก/สำนักงานศุลกากร")
            for row in r:
                cp = row[icp].strip()
                if not KEEP.search(cp) or DROP.search(cp):
                    continue
                try:
                    v = float(row[ival] or 0)
                    y = int(row[iy]) - 543
                    m = int(row[im])
                except ValueError:
                    continue
                e = agg.setdefault(cp, {"office": row[ioff].strip(), "annual": {}, "monthly": {}})
                a = e["annual"].setdefault(str(y), {"export": 0.0, "import": 0.0})
                a[direction] += v
                mk = f"{y}-{m:02d}"
                mm = e["monthly"].setdefault(mk, {"export": 0.0, "import": 0.0})
                mm[direction] += v
                if y == 2025:
                    top[(cp, direction)][(row[2].strip(), row[idesc].strip()[:80])] += v
                n += 1
        print(f"{b}: {n} border rows", file=sys.stderr, flush=True)
    for (cp, d), items in top.items():
        # [desc_th, baht, hs8] — keyed by HS8 so generic labels like "อื่น ๆ" stay distinct
        agg[cp][f"top_{d}_2025"] = sorted(([k[1], round(v), k[0]] for k, v in items.items()), key=lambda x: -x[1])[:5]
    meta = {"files_used": [os.path.basename(f) for f in use],
            "latest_month_2026": {d: v[0] for d, v in latest_2569.items()}}
    json.dump({"meta": meta, "checkpoints": agg}, open(OUT, "w"), ensure_ascii=False)
    print("checkpoints:", len(agg), file=sys.stderr)


if __name__ == "__main__":
    main()
