"""Pull SAC (ศมส.) public ethnic-group profiles + ethnic-research records and
index them by the border provinces/districts the project works in.

Public APIs (listed on sac.gdcatalog.go.th, license CC BY-NC):
  https://ethnicity.sac.or.th/service/ethnic-group?limit=200
  https://ethnicity.sac.or.th/service/ethnic-research?limit=2000

Matching is TEXT-BASED (province / district names appearing in title, subject,
description, spatial). It is an index of "what SAC's knowledge base mentions",
not a census of where groups live — the UI labels it that way.
"""
import json, os, re, html, urllib.request

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "..", "data")
RAW = os.path.join(DATA, "raw")
os.makedirs(RAW, exist_ok=True)


def get(url, path):
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": "border-cities-atlas/0.1"})
        with urllib.request.urlopen(req, timeout=120) as r:
            open(path, "wb").write(r.read())
    return json.load(open(path))


def clean(s):
    s = html.unescape(html.unescape(s or ""))
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def field_text(rec, keys=("title", "subject", "description", "spatial")):
    parts = []
    for k in keys:
        v = clean(rec.get(k))
        if k == "spatial" and "ตลิ่งชัน" in v:   # SAC library address, not study site
            continue
        parts.append(v)
    return " ".join(parts)


def main():
    project = json.load(open(os.path.join(DATA, "project.json")))
    provinces = [p["name_th"] for p in project["provinces"]]
    districts = {d: p["name_th"] for p in project["provinces"] for d in p["districts"]}

    groups = get("https://ethnicity.sac.or.th/service/ethnic-group?limit=200",
                 os.path.join(RAW, "sac_ethnic_groups.json"))["data"]
    research = get("https://ethnicity.sac.or.th/service/ethnic-research?limit=2000",
                   os.path.join(RAW, "sac_ethnic_research.json"))["result"]

    # Matching rules (verified by sampling hits per province):
    #  - bare substring is accepted, except names that are also common words/places:
    #    "ตาก" only as จังหวัดตาก/จ.ตาก or a standalone list item (not ตากใบ, ตากแดด, บ้านตากลาง);
    #    "สุรินทร์" not when it is หมู่เกาะสุรินทร์ (Phang Nga, Moken).
    #  - the API "spatial" field often holds SAC's own library address
    #    ("อำเภอเขตตลิ่งชัน จังหวัด... ") — such values are dropped as noise.
    #  - district hits need "อำเภอY"/"อ.Y".
    AMBIG = {
        "ตาก": r"(?:(?:จังหวัด|จ\.\s?)ตาก)|(?:(?:(?<=[\s,(])|^)ตาก(?=[\s,)]|$))",
        "สุรินทร์": r"(?<!เกาะ)สุรินทร์",
    }

    def match(text, tokens=()):
        hits_p = {p for p in provinces if (re.search(AMBIG[p], text) if p in AMBIG else p in text) or p in tokens}
        hits_d = {d for d in districts if len(d) > 2 and re.search(r"(อำเภอ|อ\.\s?)" + re.escape(d), text)}
        for d in hits_d:
            hits_p.add(districts[d])
        return sorted(hits_p), sorted(hits_d)

    def toks(rec):
        out = set()
        for k in ("subject", "spatial"):
            v = clean(rec.get(k))
            if "ตลิ่งชัน" in v:
                continue
            out |= {t.strip() for t in re.split(r"[,،;/]", v) if t.strip()}
        return out

    out_groups, out_research = [], []
    for g in groups:
        text = field_text(g)
        ps, ds = match(text, toks(g))
        out_groups.append({
            "id": g["id"], "name": clean(g["title"]), "family": clean(g["type"]),
            "setting": clean(g.get("spatial")), "url": g.get("source.uri"),
            "img": g.get("picture"), "provinces": ps, "districts": ds,
            "summary": clean(g.get("description"))[:260],
        })
    for r in research:
        title = clean(r.get("title"))
        if not title or title == "-":
            continue
        text = field_text(r)
        ps, ds = match(text, toks(r))
        if not ps:
            continue
        out_research.append({"id": r["id"], "title": title[:220], "author": clean(r.get("creator")),
                             "url": r.get("source.uri"), "provinces": ps, "districts": ds})

    meta = {"groups_total": len(groups), "research_total": len(research),
            "research_matched": len(out_research),
            "source": "ethnicity.sac.or.th public API (CC BY-NC), fetched for MVP"}
    json.dump({"meta": meta, "groups": out_groups, "research": out_research},
              open(os.path.join(DATA, "sac_index.json"), "w"), ensure_ascii=False)
    print(meta)
    from collections import Counter
    c = Counter(p for r in out_research for p in r["provinces"])
    print("research by province:", c.most_common())
    cg = Counter(p for g in out_groups for p in g["provinces"])
    print("groups by province:", cg.most_common())


if __name__ == "__main__":
    main()
