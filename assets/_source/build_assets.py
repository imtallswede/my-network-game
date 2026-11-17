"""Build every Campus Connect asset: SVG + PNG art, OGG + MP3 audio, manifest.json and assets/README.md.

Run from the repository root:
    python3 assets/_source/build_assets.py

Needs numpy, scipy, rsvg-convert and ffmpeg. Output is deterministic (fixed random seed).
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import art  # noqa: E402
import audio  # noqa: E402

PNG_SCALE = {  # (min output px on the long edge) so small icons are still usable
    "ui": 128, "channels": 128, "users": 192, "equipment": 256, "tiles": 192, "overlays": 192, "walls": 256,
    "diagnosis": 192, "tickets": 192, "signal": 128, "props": 192, "buildings": 384, "characters": 512,
    "stamps": 640, "brand": 512, "legends": 960, "banners": 1920, "backgrounds": 1920,
}
ART_DIR = {  # category -> folder
    "equipment": "images/equipment", "channels": "images/channels", "buildings": "images/buildings",
    "tiles": "images/map", "overlays": "images/map", "walls": "images/map", "users": "images/users",
    "diagnosis": "images/diagnosis", "tickets": "images/tickets", "signal": "images/ui", "ui": "images/ui",
    "characters": "images/characters", "props": "images/props", "legends": "images/legends",
    "stamps": "images/stamps", "brand": "images/brand", "banners": "images/banners", "backgrounds": "images/backgrounds",
}


def write_wav(path, data):
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1 if pcm.ndim == 1 else 2)
        w.setsampwidth(2)
        w.setframerate(audio.SR)
        w.writeframes(pcm.tobytes())


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"{' '.join(map(str, cmd))}\n{r.stderr}")


def build_art(manifest):
    art.build_registry()
    ids = [a["id"] for a in art.ASSETS]
    assert len(ids) == len(set(ids)), "duplicate art ids"
    for a in art.ASSETS:
        folder = ROOT / ART_DIR[a["category"]]
        folder.mkdir(parents=True, exist_ok=True)
        svg = folder / f'{a["id"]}.svg'
        png = folder / f'{a["id"]}.png'
        svg.write_text(art.svg_doc(a), encoding="utf-8")
        scale = PNG_SCALE[a["category"]] / max(a["w"], a["h"])
        run(["rsvg-convert", "-w", str(round(a["w"] * scale)), "-h", str(round(a["h"] * scale)), "-o", str(png), str(svg)])
        manifest.append(dict(
            id=a["id"], type="image", category=a["category"], title=a["title"], description=a["description"],
            use=a["use"], files=dict(svg=str(svg.relative_to(ROOT)), png=str(png.relative_to(ROOT))),
            width=a["w"], height=a["h"], png_width=round(a["w"] * scale), png_height=round(a["h"] * scale)))


def build_audio(manifest, tmp):
    audio.build_registry()
    ids = [s["id"] for s in audio.SOUNDS]
    assert len(ids) == len(set(ids)), "duplicate sound ids"
    for s in audio.SOUNDS:
        cat = s["category"]
        sub = "music" if cat == "music" else "ambience" if cat == "ambience" else "voices" if cat == "voices" else "sfx"
        folder = ROOT / "audio" / sub
        folder.mkdir(parents=True, exist_ok=True)
        wav = tmp / f'{s["id"]}.wav'
        write_wav(wav, s["data"])
        ogg, mp3 = folder / f'{s["id"]}.ogg', folder / f'{s["id"]}.mp3'
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", "96k", str(ogg)])
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-q:a", "4", str(mp3)])
        dur = len(s["data"]) / audio.SR
        manifest.append(dict(
            id=s["id"], type="audio", category=cat, title=s["title"], description=s["description"], use=s["use"],
            files=dict(ogg=str(ogg.relative_to(ROOT)), mp3=str(mp3.relative_to(ROOT))),
            duration_s=round(dur, 2), loop=s["loop"], bpm=s["bpm"], suggested_volume=s["volume"]))


def md_table(rows, cols):
    out = ["| " + " | ".join(h for h, _ in cols) + " |", "| " + " | ".join("---" for _ in cols) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(f(r)).replace("|", "\\|") for _, f in cols) + " |")
    return "\n".join(out)


def build_readme(manifest):
    imgs = [m for m in manifest if m["type"] == "image"]
    sounds = [m for m in manifest if m["type"] == "audio"]
    parts = [f"""# Campus Connect assets

Original art and audio for **Campus Connect**, made for the game's developer to drop in. Everything here is
generated from code in [`_source/`](_source), so it is original (constitution principle: FR-038), has nothing to
license, and can be rebuilt byte-for-byte.

- **{len(imgs)} images**, each as a crisp **SVG** plus a ready-to-use **PNG**.
- **{len(sounds)} sounds**: music loops, sound effects, alarms, a dial-up modem, and gibberish voices for yelling users.
- [`manifest.json`](manifest.json): one entry per asset with its id, title, description, intended use and files.
  Load it to build a sprite or sound table without hard-coding paths.

## Using the assets

```js
const base = "assets/";                                    // file paths in the manifest are relative to assets/
const manifest = await (await fetch(base + "manifest.json")).json();
const byId = Object.fromEntries(manifest.assets.map(a => [a.id, a]));
new Audio(base + byId["sfx-ticket-open"].files.ogg).play();   // use .mp3 as a fallback for Safari
```

Use relative paths and keep the file names as they are (they are lower-case on purpose; GitHub Pages is case-sensitive).

## Rules these assets follow

- **Never colour-only.** Overlays use hatching and chevrons, channel badges show the number, status badges use
  different shapes. Always put the real value (dBm, %, Mbps) as text next to an icon (FR-035, FR-036).
- **Colour-blind safe palette.** Channels 1, 6 and 11 use blue, orange and green from the Okabe-Ito set.
  Overlapping channels are white with a dashed outline.
- **Every SVG has a `<title>` and `<desc>`**; the same text is in the manifest, so you can use it for `alt` text
  and `aria-label`.
- **Audio never carries information alone.** Every sound has an on-screen text equivalent (FR-036). Voices are
  gibberish, so there is nothing to caption or translate. Music is optional and should duck when the game is paused.
- **Loud sounds are marked.** `suggested_volume` in the manifest is a starting point. The alarms and voices are
  deliberately lower. Offer a mute toggle (`ui-sound-on` / `ui-sound-off` icons are included).
- Looping files are marked `"loop": true` and are cross-faded or whole-cycle, so they loop without a click.
  OGG and MP3 loop slightly differently in browsers: use OGG where it is supported.
- Wall losses and the other numbers named in descriptions are the spec's illustrative values. See `specs/001-campus-connect-playable/spec.md`.

## Image assets
"""]
    for cat in dict.fromkeys(m["category"] for m in imgs):
        rows = [m for m in imgs if m["category"] == cat]
        parts.append(f"\n### {cat.title()} ({len(rows)})\n")
        parts.append(md_table(rows, [
            ("Preview", lambda m: f'<img src="{m["files"]["svg"]}" width="48" alt="">'),
            ("Id", lambda m: f'`{m["id"]}`'), ("Title", lambda m: m["title"]),
            ("Size", lambda m: f'{m["width"]}×{m["height"]}'), ("Use", lambda m: m["use"])]))
    parts.append("\n## Audio assets\n")
    for cat in dict.fromkeys(m["category"] for m in sounds):
        rows = [m for m in sounds if m["category"] == cat]
        parts.append(f"\n### {cat} ({len(rows)})\n")
        parts.append(md_table(rows, [
            ("Id", lambda m: f'`{m["id"]}`'), ("Title", lambda m: m["title"]),
            ("Length", lambda m: f'{m["duration_s"]} s' + (" · loop" if m["loop"] else "")),
            ("What it sounds like", lambda m: m["description"]), ("Use", lambda m: m["use"])]))
    parts.append("""

## Rebuilding

```sh
python3 -m venv .venv && .venv/bin/pip install numpy scipy
brew install ffmpeg librsvg          # or your platform's equivalents
.venv/bin/python assets/_source/build_assets.py
```

Edit colours and shapes in `_source/art.py` and notes or synthesis in `_source/audio.py`. The random seed is fixed, so
unchanged code gives identical output.

## Credits and licence

Created for this project with Claude (Anthropic). No third-party images, samples, sound fonts or speech engines are used.
Released under this repository's Apache-2.0 licence.
""")
    (ROOT / "README.md").write_text("\n".join(parts), encoding="utf-8")


def main():
    import tempfile
    for sub in ("images", "audio"):  # clean old output so removed assets disappear
        for p in (ROOT / sub).rglob("*") if (ROOT / sub).exists() else []:
            if p.is_file():
                p.unlink()
    manifest = []
    build_art(manifest)
    with tempfile.TemporaryDirectory() as tmp:
        build_audio(manifest, Path(tmp))
    (ROOT / "manifest.json").write_text(json.dumps(dict(
        name="Campus Connect assets", version="1.0.0", license="Apache-2.0", generated_by="assets/_source/build_assets.py",
        counts=dict(images=sum(m["type"] == "image" for m in manifest), audio=sum(m["type"] == "audio" for m in manifest)),
        assets=manifest), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    build_readme(manifest)
    print("images:", sum(m["type"] == "image" for m in manifest), "audio:", sum(m["type"] == "audio" for m in manifest))


if __name__ == "__main__":
    main()
