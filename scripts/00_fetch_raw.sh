#!/usr/bin/env bash
# Re-download the boundary/basemap sources that are git-ignored (data/raw/).
# SAC API responses are fetched + cached by 02_sac.py itself.
# Customs CSVs come from the thai-trade-monitor mirror; their aggregate
# (data/trade_raw_agg.json) is committed so 03_build.py runs without it.
set -euo pipefail
cd "$(dirname "$0")/../data" && mkdir -p raw && cd raw
B=https://raw.githubusercontent.com
curl -fsSL -o provinces.geojson  $B/chingchai/OpenGISData-Thailand/master/provinces.geojson
curl -fsSL -o districts.geojson  $B/chingchai/OpenGISData-Thailand/master/districts.geojson
curl -fsSL -o ne_50m_admin0.geojson $B/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
curl -fsSL -o ne_10m_rivers.geojson $B/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
echo "ok: $(ls)"
