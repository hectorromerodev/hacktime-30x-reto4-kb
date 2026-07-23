# hacktime-30x-reto4-kb

Private knowledge base for our team's run at **Reto 04 · Hotelería — "Captura inteligente en la toma de inventarios"**, Hackathon Colsubsidio × 30X (July 22–26, 2026, Bogotá, hybrid).

This repo is **research only**: official info, live-stream analysis, datasets, blind spots, POCs, and skills. The actual hackathon solution gets its own repo.

## Map

| Path | What lives there |
|---|---|
| `reto/` | Official reto text + hackathon logistics + sponsor benefits |
| `research/` | Blind-spot analysis, questions to ask in the lives |
| `lives/` | One findings doc per analyzed live/charla; raw transcripts in `lives/transcripts/` |
| `datos/` | Raw assets from organizers (xlsx, PDFs) + generated data profiles — see `datos/README.md` |
| `pocs/` | Proof-of-concept spikes |
| `tools/` | `ingest-live.sh` (pull YouTube captions), `vtt2txt.py` (clean them) |
| `archive/retos-1-2/` | Our earlier research on retos 1 & 2 (abandoned when we switched to reto 4) |

## Start here

1. `reto/reto-04-hoteleria.md` — the challenge, parsed.
2. `research/blind-spots.md` — what we know vs. what we're guessing.
3. `research/questions-para-lives.md` — questions to fire in the next lives/mentorías.
4. `lives/` — what organizers actually said, per video.

## Ingesting a new live

```bash
./tools/ingest-live.sh <youtube-url-or-id>   # pulls Spanish auto-captions → clean .txt
```

If YouTube hasn't generated captions yet (common right after a stream ends), transcribe locally:

```bash
cd lives/transcripts
yt-dlp -f ba -x --audio-format mp3 -o "%(id)s.%(ext)s" <url>   # add --download-sections "*START-END" for a segment
uvx whisper-ctranslate2 <id>.mp3 --model small --language es --output_format txt --output_dir .
```

Then have Claude/Gemini analyze the transcript into a `lives/YYYY-MM-DD-<slug>.md` findings doc (see existing ones for the structure).

## Upcoming lives to watch

Channel: <https://www.youtube.com/@30XDevs/streams> — see `reto/logistica-hackathon.md` for the catalog of upcoming charlas.
