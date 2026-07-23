#!/usr/bin/env bash
# Pull Spanish auto-captions for a YouTube live and collapse them to clean text.
# Usage: ./tools/ingest-live.sh <youtube-url-or-video-id>
# If YouTube has no captions yet (fresh post_live), see README for the whisper fallback.
set -euo pipefail
cd "$(dirname "$0")/../lives/transcripts"
url="${1:?usage: ingest-live.sh <youtube-url-or-video-id>}"
yt-dlp --skip-download --write-auto-subs --sub-langs "es-orig,es,es-419" --sub-format vtt -o "%(id)s.%(ext)s" "$url"
for f in *.vtt; do
  txt="${f%%.*}.txt"
  [ -f "$txt" ] || python3 "$(dirname "$0")/../../tools/vtt2txt.py" "$f" > "$txt"
done
ls -la
