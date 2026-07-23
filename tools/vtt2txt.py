#!/usr/bin/env python3
"""Collapse a YouTube auto-caption .vtt into clean plain text.

Auto-subs repeat each line in rolling windows; this dedupes consecutive
repeats and emits a [mm:ss] marker roughly every 30 seconds so findings
can cite video timestamps.

Usage: python3 vtt2txt.py input.vtt > output.txt
"""
import re
import sys


def main(path: str) -> None:
    ts_re = re.compile(r"^(\d+):(\d+):(\d+)\.\d+ --> ")
    tag_re = re.compile(r"<[^>]+>")
    last_line = ""
    last_marker = -60
    for raw in open(path, encoding="utf-8"):
        raw = raw.strip()
        m = ts_re.match(raw)
        if m:
            secs = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            if secs - last_marker >= 30:
                sys.stdout.write(f"\n[{secs // 60:02d}:{secs % 60:02d}] ")
                last_marker = secs
            continue
        if not raw or raw == "WEBVTT" or raw.startswith(("Kind:", "Language:", "NOTE")):
            continue
        line = tag_re.sub("", raw).strip()
        if line and line != last_line:
            sys.stdout.write(line + " ")
            last_line = line


if __name__ == "__main__":
    main(sys.argv[1])
