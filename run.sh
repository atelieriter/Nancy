#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f data/nancy.json ]]; then
  echo "Cache OSM absent — téléchargement Overpass…"
  python3 scripts/fetch_osm.py
fi

PORT="${PORT:-3002}"
echo "Nancy 3D → http://localhost:${PORT}"
exec python3 - "$PORT" <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import sys

PORT = int(sys.argv[1])

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
PY
