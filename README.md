# ปักหมุดเมืองชายแดน — Border Cities Atlas (MVP v0.1)

Dashboard prototype for the Thai PBS × ศมส. × บพท. border-cities project, built only
from data we can access **today** (no SAC-02/03 survey data yet). Made for the
workshop "ปักหมุดเมืองชายแดน" on 21 Oct 2569 at ศมส.

## Open it

Double-click `web/index.html`. It works **offline**: Leaflet is vendored and the basemap
is vector (Natural Earth + provincial boundaries). Without internet only the Google font
falls back to the system font.

Deep links: `index.html#lens=trade&year=2024`, `#prov=ตาก`, `#cross=mukdahan`

## The three views

| View | Shows | Data |
|---|---|---|
| **พื้นที่โครงการ** | 17 provinces / 46 target districts by border line, 7 บพท. projects, 2 Border Camp Teacher pilot sites, the 4+1 forum plan, items to confirm | the project documents (curated by hand → `data/project.json`) |
| **การค้าข้ามแดน** | 40 border crossings, annual 2017–2026 (Jan–Aug) + monthly trade + main goods, with a year slider | Customs Department per-crossing statistics (local mirror in thai-trade-monitor) |
| **คลังความรู้ ศมส.** | how many SAC ethnic-research records mention each province (knowledge gap) + **slots** where SAC-02/03 data will plug in | public API ethnicity.sac.or.th (CC BY-NC) |

**Workshop pins:** the "ปักหมุด Workshop" button lets you click the map to log round 1/2 pins
with a type, team and note → saved to localStorage → exports CSV/JSON.

## Live site

https://visarutforthaipbs.github.io/border-cities-atlas/ — deployed by `.github/workflows/pages.yml` on every push to `main` (publishes the `web/` folder). Marked `noindex`.

## Rebuild the data

```bash
bash scripts/00_fetch_raw.sh  # boundaries + Natural Earth → data/raw/ (git-ignored)
python3 scripts/01_trade.py   # Customs CSV → data/trade_raw_agg.json (~10 min)
python3 scripts/02_sac.py     # SAC API → data/sac_index.json (cached in data/raw/)
python3 scripts/03_build.py   # everything → web/data.js
python3 scripts/qa_smoke.py   # headless Chrome check of every view + screenshots in qa/
```

## Limits (state these whenever you present it)

- **No SAC-02/03 village/household data yet.** The dashed boxes are slots, not data.
- Crossing pins sit at the **district centroid**, not the real crossing coordinates.
- SAC research is counted by **text matching** province/district names (title, keywords,
  abstract). The `spatial` field values that are the SAC library address (ตลิ่งชัน) were
  dropped, and "ตาก" / "สุรินทร์" use stricter rules → read it as a rough density index,
  not a count of field studies.
- Regional vulnerability text comes from the SAC proposal (regional level), not area data.
- Points in the documents that conflict (to confirm at the workshop): Si Sa Ket vs Ubon in
  the 16-province list, the southern pilot site spelt ปลาดี/ปาดี, and the location of
  research projects 3 and 6.

## Sources

- Thai Customs: import/export value by customs checkpoint, 2560–2569 (Aug)
- SAC: `ethnicity.sac.or.th/service/ethnic-group`, `/service/ethnic-research` (via sac.gdcatalog.go.th)
- Project documents: research area map 67–68, mechanisms 68, project list 67–68, letter วธ 0700/165, Thai PBS draft communication plan, activity calendar 69
- Boundaries: github.com/chingchai/OpenGISData-Thailand · Natural Earth (countries, rivers)
