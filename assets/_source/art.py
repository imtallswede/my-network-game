"""Campus Connect art: every SVG is drawn here from code, so it is original and reproducible.

Each call to ``add`` registers one asset with an id, a category, a size, accessible
title/description text and a suggested use. ``build_assets.py`` writes the SVG files,
renders PNGs and records everything in ``manifest.json``.
"""
import math

C = dict(
    ink="#1F2A44", paper="#FFFFFF", cream="#F6F2E8", sand="#EFE6D2",
    teal="#0E7C86", teal_l="#8FD3D9", amber="#E69F00", sky="#56B4E9",
    green="#009E73", yellow="#F0E442", blue="#0072B2", red="#D55E00",
    pink="#CC79A7", grey="#8A8F98", grey_l="#D5D8DE", grey_d="#5B616B",
    brick="#B5543A", brick_d="#8E3F2A", grass="#86B86A", grass_d="#6E9F55",
    path="#E3D5AE", wood="#C98E5A", skin1="#F3CDAA", skin2="#C68A5E",
    skin3="#8D5A3B", hair="#3B2A23", silver="#C9CED6", night="#24324F",
)
FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
# Okabe-Ito based channel colours: 1/6/11 are the non-overlapping 2.4 GHz channels.
CHANNEL_COLOURS = {1: C["blue"], 6: C["amber"], 11: C["green"]}

ASSETS = []


def add(category, name, w, h, title, desc, use, body, bg=None):
    ASSETS.append(dict(id=name, category=category, w=w, h=h, title=title,
                       description=desc, use=use, body=body, bg=bg))


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg_doc(a):
    bg = f'<rect width="{a["w"]}" height="{a["h"]}" fill="{a["bg"]}"/>' if a["bg"] else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{a["w"]}" height="{a["h"]}" '
        f'viewBox="0 0 {a["w"]} {a["h"]}" role="img" aria-labelledby="title desc">'
        f'<title id="title">{esc(a["title"])}</title><desc id="desc">{esc(a["description"])}</desc>'
        f'{bg}{a["body"]}</svg>\n'
    )


# ---------------------------------------------------------------- primitives

def text(x, y, s, size=14, fill=C["ink"], weight=700, anchor="middle", extra=""):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{esc(s)}</text>')


def arc_path(cx, cy, r, a0=-45, a1=45):
    """Arc of radius r around (cx, cy); angles in degrees measured from straight up."""
    x0, y0 = cx + r * math.sin(math.radians(a0)), cy - r * math.cos(math.radians(a0))
    x1, y1 = cx + r * math.sin(math.radians(a1)), cy - r * math.cos(math.radians(a1))
    return f"M{x0:.1f},{y0:.1f} A{r},{r} 0 0 1 {x1:.1f},{y1:.1f}"


def wifi_arcs(cx, cy, radii, colour=C["teal"], sw=3.5, faded=(), dash_faded=True):
    out = []
    for i, r in enumerate(radii):
        if i in faded:
            dash = ' stroke-dasharray="3 4"' if dash_faded else ""
            out.append(f'<path d="{arc_path(cx, cy, r)}" fill="none" stroke="{C["grey"]}" '
                       f'stroke-width="{sw}" stroke-linecap="round"{dash}/>')
        else:
            out.append(f'<path d="{arc_path(cx, cy, r)}" fill="none" stroke="{colour}" '
                       f'stroke-width="{sw}" stroke-linecap="round"/>')
    return "".join(out)


def ap_device(cx, cy, r=12, led=C["green"], ring=C["teal"], body=C["paper"], stroke=C["ink"], sw=3):
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{body}" stroke="{stroke}" stroke-width="{sw}"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.58:.1f}" fill="none" stroke="{ring}" stroke-width="2.5"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{max(2, r * 0.2):.1f}" fill="{led}"/>')


def gear(cx, cy, r_out, r_in, teeth, fill, stroke=C["ink"], sw=2, hole=None):
    pts = []
    for i in range(teeth * 2):
        r = r_out if i % 2 == 0 else r_in
        for k in (-0.22, 0.22):
            a = (i + 0.5 + k) * math.pi / teeth
            pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    h = hole or r_in * 0.45
    return (f'<polygon points="{" ".join(pts)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" '
            f'stroke-linejoin="round"/><circle cx="{cx}" cy="{cy}" r="{h:.1f}" fill="{C["paper"]}" '
            f'stroke="{stroke}" stroke-width="{sw}"/>')


def badge_circle(cx, cy, r, fill, inner, stroke=C["ink"]):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2.5"/>{inner}'


def check(cx, cy, s, colour=C["paper"], sw=3.5):
    return (f'<path d="M{cx - s * 0.5:.1f},{cy:.1f} L{cx - s * 0.12:.1f},{cy + s * 0.38:.1f} '
            f'L{cx + s * 0.55:.1f},{cy - s * 0.4:.1f}" fill="none" stroke="{colour}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')


def cross(cx, cy, s, colour=C["paper"], sw=3.5):
    return (f'<path d="M{cx - s},{cy - s} L{cx + s},{cy + s} M{cx + s},{cy - s} L{cx - s},{cy + s}" '
            f'stroke="{colour}" stroke-width="{sw}" stroke-linecap="round"/>')


def bang(cx, cy, s, colour=C["paper"]):
    return (f'<rect x="{cx - s * 0.11:.1f}" y="{cy - s * 0.55:.1f}" width="{s * 0.22:.1f}" '
            f'height="{s * 0.7:.1f}" rx="{s * 0.11:.1f}" fill="{colour}"/>'
            f'<circle cx="{cx}" cy="{cy + s * 0.42:.1f}" r="{s * 0.13:.1f}" fill="{colour}"/>')


def person(cx, base, skin, shirt, hair, scale=1.0, hair_style="short"):
    s = scale
    head_y = base - 30 * s
    hair_svg = {
        "short": f'<path d="M{cx - 8 * s},{head_y - 1 * s} Q{cx},{head_y - 14 * s} {cx + 8 * s},{head_y - 1 * s} '
                 f'Q{cx},{head_y - 6 * s} {cx - 8 * s},{head_y - 1 * s}Z" fill="{hair}"/>',
        "bun": f'<circle cx="{cx}" cy="{head_y - 10 * s}" r="{4 * s}" fill="{hair}"/>'
               f'<path d="M{cx - 8 * s},{head_y} Q{cx},{head_y - 13 * s} {cx + 8 * s},{head_y} '
               f'Q{cx},{head_y - 5 * s} {cx - 8 * s},{head_y}Z" fill="{hair}"/>',
        "curly": "".join(f'<circle cx="{cx + dx * s}" cy="{head_y - 6 * s + dy * s}" r="{4 * s}" fill="{hair}"/>'
                         for dx, dy in ((-6, 2), (-3, -2), (2, -3), (6, 1), (0, 0))),
        "cap": f'<path d="M{cx - 8.5 * s},{head_y - 1 * s} Q{cx},{head_y - 14 * s} {cx + 8.5 * s},{head_y - 1 * s}Z" '
               f'fill="{hair}"/><rect x="{cx}" y="{head_y - 3 * s}" width="{12 * s}" height="{3 * s}" '
               f'rx="{1.5 * s}" fill="{hair}"/>',
    }[hair_style]
    return (f'<path d="M{cx - 12 * s},{base} Q{cx - 12 * s},{base - 20 * s} {cx},{base - 20 * s} '
            f'Q{cx + 12 * s},{base - 20 * s} {cx + 12 * s},{base}Z" fill="{shirt}" stroke="{C["ink"]}" '
            f'stroke-width="{2 * s}"/>'
            f'<circle cx="{cx}" cy="{head_y}" r="{8.5 * s}" fill="{skin}" stroke="{C["ink"]}" stroke-width="{2 * s}"/>'
            f'{hair_svg}')


def ticket_shape(x, y, w, h, fill, stroke=C["ink"]):
    n = h * 0.18
    return (f'<path d="M{x},{y} H{x + w} V{y + h / 2 - n} A{n},{n} 0 0 0 {x + w},{y + h / 2 + n} '
            f'V{y + h} H{x} V{y + h / 2 + n} A{n},{n} 0 0 0 {x},{y + h / 2 - n}Z" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<line x1="{x + w * 0.68}" y1="{y + 4}" x2="{x + w * 0.68}" y2="{y + h - 4}" stroke="{stroke}" '
            f'stroke-width="1.5" stroke-dasharray="3 3"/>'
            f'<line x1="{x + 7}" y1="{y + h * 0.35}" x2="{x + w * 0.55}" y2="{y + h * 0.35}" stroke="{stroke}" '
            f'stroke-width="2" stroke-linecap="round"/>'
            f'<line x1="{x + 7}" y1="{y + h * 0.62}" x2="{x + w * 0.45}" y2="{y + h * 0.62}" stroke="{stroke}" '
            f'stroke-width="2" stroke-linecap="round"/>')


def tree(cx, base, s=1.0):
    return (f'<rect x="{cx - 3 * s}" y="{base - 16 * s}" width="{6 * s}" height="{16 * s}" fill="{C["wood"]}" '
            f'stroke="{C["ink"]}" stroke-width="{1.5 * s}"/>'
            f'<circle cx="{cx}" cy="{base - 26 * s}" r="{14 * s}" fill="{C["grass_d"]}" stroke="{C["ink"]}" '
            f'stroke-width="{1.5 * s}"/><circle cx="{cx - 5 * s}" cy="{base - 30 * s}" r="{5 * s}" '
            f'fill="{C["grass"]}"/>')


# ---------------------------------------------------------------- buildings (128 x 128 frames)

def library(x=0, y=0, s=1.0):
    g = [f'<g transform="translate({x},{y}) scale({s})">',
         '<ellipse cx="64" cy="118" rx="58" ry="6" fill="#000" opacity="0.12"/>',
         f'<rect x="14" y="52" width="100" height="58" fill="{C["cream"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         f'<polygon points="8,54 64,18 120,54" fill="{C["brick"]}" stroke="{C["ink"]}" stroke-width="3" stroke-linejoin="round"/>',
         f'<polygon points="30,48 64,27 98,48" fill="{C["cream"]}" stroke="{C["ink"]}" stroke-width="2"/>',
         f'<circle cx="64" cy="40" r="6" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2"/>']
    for cx in (26, 46, 82, 102):
        g.append(f'<rect x="{cx - 5}" y="58" width="10" height="44" fill="{C["paper"]}" stroke="{C["ink"]}" stroke-width="2"/>')
    g += [f'<rect x="54" y="70" width="20" height="32" rx="10" fill="{C["teal"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<rect x="8" y="102" width="112" height="8" fill="{C["grey_l"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<rect x="2" y="110" width="124" height="6" fill="{C["grey_l"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          text(64, 66, "LIBRARY", 8, C["ink"], 800), '</g>']
    return "".join(g)


def dorm(x=0, y=0, s=1.0):
    g = [f'<g transform="translate({x},{y}) scale({s})">',
         '<ellipse cx="64" cy="120" rx="54" ry="6" fill="#000" opacity="0.12"/>',
         f'<rect x="18" y="14" width="92" height="104" fill="{C["brick"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         f'<rect x="12" y="8" width="104" height="10" fill="{C["grey_d"]}" stroke="{C["ink"]}" stroke-width="3"/>']
    lit = {(0, 1), (1, 3), (2, 0), (2, 2), (3, 1)}
    for row in range(4):
        for col in range(4):
            fill = C["yellow"] if (row, col) in lit else C["sky"]
            g.append(f'<rect x="{26 + col * 21}" y="{24 + row * 20}" width="13" height="12" fill="{fill}" '
                     f'stroke="{C["ink"]}" stroke-width="2"/>')
    g += [f'<rect x="54" y="100" width="20" height="18" fill="{C["teal"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<rect x="48" y="96" width="32" height="5" fill="{C["grey_l"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<rect x="88" y="104" width="16" height="14" fill="{C["wood"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<line x1="88" y1="111" x2="104" y2="111" stroke="{C["ink"]}" stroke-width="1.5"/>',
          '</g>']
    return "".join(g)


def stadium(x=0, y=0, s=1.0):
    g = [f'<g transform="translate({x},{y}) scale({s})">',
         f'<ellipse cx="64" cy="66" rx="60" ry="52" fill="{C["grey_l"]}" stroke="{C["ink"]}" stroke-width="3"/>']
    for i in range(24):
        a = i * math.pi / 12
        g.append(f'<line x1="{64 + 44 * math.cos(a):.1f}" y1="{66 + 37 * math.sin(a):.1f}" '
                 f'x2="{64 + 58 * math.cos(a):.1f}" y2="{66 + 50 * math.sin(a):.1f}" stroke="{C["grey"]}" stroke-width="2"/>')
    g += [f'<ellipse cx="64" cy="66" rx="44" ry="37" fill="{C["grey"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<rect x="28" y="44" width="72" height="44" rx="4" fill="{C["grass"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<rect x="28" y="44" width="10" height="44" fill="{C["teal"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<rect x="90" y="44" width="10" height="44" fill="{C["amber"]}" stroke="{C["ink"]}" stroke-width="2"/>']
    for xx in range(46, 90, 8):
        g.append(f'<line x1="{xx}" y1="46" x2="{xx}" y2="86" stroke="{C["paper"]}" stroke-width="1.5"/>')
    g += [f'<circle cx="64" cy="66" r="6" fill="none" stroke="{C["paper"]}" stroke-width="1.5"/>', '</g>']
    return "".join(g)


def student_center(x=0, y=0, s=1.0):
    g = [f'<g transform="translate({x},{y}) scale({s})">',
         '<ellipse cx="64" cy="120" rx="60" ry="6" fill="#000" opacity="0.12"/>',
         f'<rect x="10" y="40" width="108" height="78" fill="{C["sand"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         f'<rect x="10" y="34" width="108" height="8" fill="{C["teal"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         f'<rect x="18" y="50" width="92" height="26" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2.5"/>']
    for xx in range(41, 110, 23):
        g.append(f'<line x1="{xx}" y1="50" x2="{xx}" y2="76" stroke="{C["ink"]}" stroke-width="2"/>')
    g += [f'<line x1="22" y1="70" x2="34" y2="56" stroke="{C["paper"]}" stroke-width="2" opacity="0.8"/>',
          f'<rect x="44" y="88" width="40" height="30" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<line x1="64" y1="88" x2="64" y2="118" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<path d="M36,88 H92 L86,80 H42Z" fill="{C["amber"]}" stroke="{C["ink"]}" stroke-width="2.5" stroke-linejoin="round"/>',
          f'<line x1="100" y1="34" x2="100" y2="8" stroke="{C["ink"]}" stroke-width="2.5"/>',
          f'<path d="M100,9 L118,14 L100,19Z" fill="{C["red"]}" stroke="{C["ink"]}" stroke-width="2" stroke-linejoin="round"/>',
          f'<rect x="20" y="94" width="16" height="16" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          f'<rect x="92" y="94" width="16" height="16" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2"/>',
          '</g>']
    return "".join(g)


# ---------------------------------------------------------------- Dean of IT

def dean(expr):
    """Original character: the Dean of IT, silver curls, round glasses, teal cardigan, IT lanyard."""
    g = [f'<circle cx="128" cy="128" r="124" fill="{C["teal_l"]}"/>',
         # body
         f'<path d="M40,256 Q44,178 128,172 Q212,178 216,256Z" fill="{C["teal"]}" stroke="{C["ink"]}" stroke-width="4"/>',
         f'<path d="M104,176 L128,214 L152,176Z" fill="{C["paper"]}" stroke="{C["ink"]}" stroke-width="3" stroke-linejoin="round"/>',
         f'<path d="M110,178 L128,236 M146,178 L128,236" stroke="{C["red"]}" stroke-width="4" fill="none"/>',
         f'<rect x="114" y="226" width="28" height="22" rx="4" fill="{C["paper"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         text(128, 242, "IT", 12, C["teal"], 900),
         f'<rect x="114" y="150" width="28" height="28" fill="{C["skin2"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         # head
         f'<ellipse cx="128" cy="112" rx="48" ry="54" fill="{C["skin2"]}" stroke="{C["ink"]}" stroke-width="4"/>',
         f'<ellipse cx="80" cy="118" rx="8" ry="12" fill="{C["skin2"]}" stroke="{C["ink"]}" stroke-width="3"/>',
         f'<ellipse cx="176" cy="118" rx="8" ry="12" fill="{C["skin2"]}" stroke="{C["ink"]}" stroke-width="3"/>']
    for cx, cy, r in ((88, 72, 16), (106, 56, 18), (128, 50, 19), (150, 56, 18), (168, 72, 16),
                      (80, 92, 11), (176, 92, 11)):
        g.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{C["silver"]}" stroke="{C["ink"]}" stroke-width="3"/>')
    g.append(f'<path d="M84,84 Q128,62 172,84 Q128,76 84,84Z" fill="{C["silver"]}"/>')
    # glasses
    g += [f'<rect x="92" y="102" width="30" height="24" rx="10" fill="{C["paper"]}" fill-opacity="0.5" stroke="{C["ink"]}" stroke-width="3.5"/>',
          f'<rect x="134" y="102" width="30" height="24" rx="10" fill="{C["paper"]}" fill-opacity="0.5" stroke="{C["ink"]}" stroke-width="3.5"/>',
          f'<path d="M122,112 Q128,107 134,112" fill="none" stroke="{C["ink"]}" stroke-width="3"/>',
          f'<path d="M128,124 Q124,138 130,140" fill="none" stroke="{C["ink"]}" stroke-width="3" stroke-linecap="round"/>']
    brows = {
        "neutral": ("M94,94 L120,94", "M136,94 L162,94"),
        "pleased": ("M94,92 Q107,84 120,92", "M136,92 Q149,84 162,92"),
        "concerned": ("M94,96 L120,88", "M136,88 L162,96"),
        "angry": ("M94,88 L120,97", "M136,97 L162,88"),
    }[expr]
    for d in brows:
        g.append(f'<path d="{d}" fill="none" stroke="{C["ink"]}" stroke-width="5" stroke-linecap="round"/>')
    pupils = {"neutral": 0, "pleased": 0, "concerned": -2, "angry": 1}[expr]
    if expr == "pleased":
        g += [f'<path d="M100,116 Q107,108 114,116" fill="none" stroke="{C["ink"]}" stroke-width="3.5" stroke-linecap="round"/>',
              f'<path d="M142,116 Q149,108 156,116" fill="none" stroke="{C["ink"]}" stroke-width="3.5" stroke-linecap="round"/>']
    else:
        g += [f'<circle cx="107" cy="{114 + pupils}" r="4.5" fill="{C["ink"]}"/>',
              f'<circle cx="149" cy="{114 + pupils}" r="4.5" fill="{C["ink"]}"/>']
    mouth = {
        "neutral": f'<path d="M112,150 Q128,156 144,150" fill="none" stroke="{C["ink"]}" stroke-width="4" stroke-linecap="round"/>',
        "pleased": f'<path d="M106,146 Q128,172 150,146Z" fill="{C["paper"]}" stroke="{C["ink"]}" stroke-width="4" stroke-linejoin="round"/>',
        "concerned": f'<path d="M110,154 Q119,148 128,154 Q137,160 146,152" fill="none" stroke="{C["ink"]}" stroke-width="4" stroke-linecap="round"/>',
        "angry": f'<path d="M112,156 Q128,146 144,156" fill="none" stroke="{C["ink"]}" stroke-width="4.5" stroke-linecap="round"/>',
    }[expr]
    g.append(mouth)
    if expr == "pleased":
        g += [f'<ellipse cx="96" cy="138" rx="9" ry="5" fill="{C["pink"]}" opacity="0.55"/>',
              f'<ellipse cx="160" cy="138" rx="9" ry="5" fill="{C["pink"]}" opacity="0.55"/>']
    if expr == "concerned":
        g.append(f'<path d="M176,82 Q170,94 176,98 Q182,94 176,82Z" fill="{C["sky"]}" stroke="{C["ink"]}" stroke-width="2.5"/>')
    if expr == "angry":
        g += [f'<g transform="rotate(-10 196 206)"><rect x="166" y="178" width="66" height="48" rx="3" '
              f'fill="{C["pink"]}" stroke="{C["ink"]}" stroke-width="3"/>',
              text(199, 198, "NOTICE", 12, C["ink"], 900),
              f'<line x1="174" y1="208" x2="224" y2="208" stroke="{C["ink"]}" stroke-width="2"/>',
              f'<line x1="174" y1="216" x2="212" y2="216" stroke="{C["ink"]}" stroke-width="2"/></g>',
              f'<path d="M186,74 l8,-10 M198,82 l12,-6 M194,94 l12,0" stroke="{C["red"]}" stroke-width="4" stroke-linecap="round"/>']
    return "".join(g)


# ---------------------------------------------------------------- registry

def build_registry():
    ASSETS.clear()
    ink, teal = C["ink"], C["teal"]

    # ---- equipment
    add("equipment", "ap", 64, 64, "Access point",
        "A ceiling-mount Wi-Fi access point seen from below, with a green status light and three teal signal arcs.",
        "Map sprite for a placed AP (FR-002). Pair it with a channel badge so the channel is never colour-only.",
        wifi_arcs(32, 42, (18, 25, 32)) + ap_device(32, 42))
    add("equipment", "ap-placement-preview", 64, 64, "Access point placement preview",
        "A dashed, see-through outline of an access point, shown where the map cursor would place one.",
        "Ghost sprite under the map cursor while placing an AP; swap to the solid sprite on confirm.",
        f'<g opacity="0.6">{wifi_arcs(32, 42, (18, 25, 32), C["grey"], 3)}'
        f'<circle cx="32" cy="42" r="12" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.5" stroke-dasharray="4 3"/>'
        f'<text x="32" y="47" font-family="{FONT}" font-size="14" font-weight="800" fill="{ink}" text-anchor="middle">+</text></g>')
    add("equipment", "ap-channel-conflict", 64, 64, "Access point with channel conflict",
        "An access point whose signal arcs clash with orange zig-zag arcs, plus an orange warning triangle with an exclamation mark.",
        "Map sprite when an AP has at least one conflicting neighbour (FR-007). Show the effective capacity number beside it.",
        wifi_arcs(32, 42, (18, 25), teal) +
        f'<path d="M10,22 l6,-4 l6,4 l6,-4 l6,4 l6,-4 l6,4 l6,-4 l6,4" fill="none" stroke="{C["red"]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
        ap_device(32, 42, led=C["amber"]) +
        f'<path d="M50,30 L62,52 H38Z" fill="{C["red"]}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>' + bang(50, 44, 13))
    add("equipment", "ap-overloaded", 64, 64, "Overloaded access point",
        "An access point with a gauge above it whose needle is pushed past the red end of the scale.",
        "Map sprite when an AP's users demand more than its capacity (FR-009). Show the utilisation % beside it.",
        f'<path d="{arc_path(32, 34, 22, -90, -30)}" fill="none" stroke="{C["green"]}" stroke-width="6"/>'
        f'<path d="{arc_path(32, 34, 22, -30, 30)}" fill="none" stroke="{C["amber"]}" stroke-width="6"/>'
        f'<path d="{arc_path(32, 34, 22, 30, 90)}" fill="none" stroke="{C["red"]}" stroke-width="6"/>'
        f'<line x1="32" y1="34" x2="56" y2="26" stroke="{ink}" stroke-width="3.5" stroke-linecap="round"/>'
        f'<circle cx="32" cy="34" r="4" fill="{ink}"/>' + ap_device(32, 50, 10, led=C["red"]))
    add("equipment", "uplink-100mbps", 64, 64, "100 Mbps uplink",
        "A single network cable plug with a label reading 100M.",
        "Building uplink icon for the $200 100 Mbps option (FR-003).",
        f'<path d="M6,46 C18,46 18,32 28,32" fill="none" stroke="{C["grey_d"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<rect x="26" y="22" width="22" height="20" rx="3" fill="{C["sky"]}" stroke="{ink}" stroke-width="3"/>'
        f'<rect x="48" y="26" width="10" height="12" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5"/>'
        f'<rect x="10" y="48" width="44" height="14" rx="7" fill="{C["paper"]}" stroke="{ink}" stroke-width="2"/>' + text(32, 59, "100M", 10, ink, 800))
    add("equipment", "uplink-1gbps", 64, 64, "1 Gbps uplink",
        "A thicker double fibre cable with a gold connector and a label reading 1G.",
        "Building uplink icon for the $800 1 Gbps option or an upgrade (FR-003).",
        f'<path d="M6,40 C18,40 18,28 28,28" fill="none" stroke="{C["amber"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<path d="M6,48 C18,48 18,36 28,36" fill="none" stroke="{C["amber"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<rect x="26" y="20" width="22" height="24" rx="3" fill="{C["yellow"]}" stroke="{ink}" stroke-width="3"/>'
        f'<rect x="48" y="25" width="10" height="6" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2"/>'
        f'<rect x="48" y="33" width="10" height="6" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2"/>'
        f'<rect x="14" y="48" width="36" height="14" rx="7" fill="{ink}"/>' + text(32, 59, "1G", 10, C["yellow"], 900))
    add("equipment", "uplink-failed", 64, 64, "Failed uplink",
        "A grey network cable cut in two, with a spark in the gap and a red cross, labelled DOWN.",
        "Uplink icon after a scheduled failure (FR-011, Level 3). Pair it with the grey 'Uplink down' zone overlay.",
        f'<path d="M4,34 H24" stroke="{C["grey"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<path d="M40,34 H60" stroke="{C["grey"]}" stroke-width="5" stroke-linecap="round"/>'
        f'<rect x="18" y="26" width="10" height="16" rx="2" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5"/>'
        f'<rect x="36" y="26" width="10" height="16" rx="2" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5"/>'
        f'<path d="M32,18 l-3,8 h6 l-3,8" fill="none" stroke="{C["amber"]}" stroke-width="2.5" stroke-linejoin="round"/>'
        f'<rect x="12" y="48" width="40" height="14" rx="7" fill="{C["red"]}"/>' + text(32, 59, "DOWN", 10, C["paper"], 900) +
        cross(32, 10, 5, C["red"], 3))
    add("equipment", "core-switch", 96, 48, "Campus core switch",
        "A rack-mounted network switch with eight ports, each with a small status light.",
        "Where building uplinks terminate; good for the network-closet panel or the uplink purchase dialog.",
        f'<rect x="4" y="8" width="88" height="32" rx="4" fill="{C["grey_d"]}" stroke="{ink}" stroke-width="3"/>' +
        "".join(f'<rect x="{12 + i * 9}" y="20" width="7" height="8" fill="{ink}"/><circle cx="{15.5 + i * 9}" cy="15" r="1.6" '
                f'fill="{[C["green"], C["green"], C["amber"], C["green"], C["grey"], C["green"], C["green"], C["grey"]][i]}"/>'
                for i in range(8)) +
        f'<rect x="12" y="31" width="22" height="4" rx="2" fill="{C["teal_l"]}"/>')

    for ch in range(1, 12):
        clean = ch in CHANNEL_COLOURS
        fill = CHANNEL_COLOURS.get(ch, C["paper"])
        fg = C["paper"] if clean else ink
        dash = "" if clean else ' stroke-dasharray="4 2.5"'
        shape = (f'<rect x="3" y="3" width="26" height="26" rx="13" fill="{fill}" stroke="{ink}" stroke-width="2.5"{dash}/>')
        add("channels", f"channel-{ch:02d}", 32, 32, f"Channel {ch} badge",
            f"A round badge showing the number {ch}." + (
                " Solid fill: one of the three non-overlapping 2.4 GHz channels." if clean else
                " White with a dashed outline: an overlapping channel."),
            "Badge drawn beside an AP and in the zone table so the channel is readable as a number (FR-007, FR-035).",
            shape + text(16, 21, str(ch), 13, fg, 900))

    # ---- buildings
    add("buildings", "building-library", 128, 128, "Library",
        "A classical brick-and-cream campus library with four columns, a round window and front steps.",
        "Level 1 'Orientation Week' building and briefing art (FR-031).", library())
    add("buildings", "building-dorm", 128, 128, "Dormitory",
        "A four-storey brick dorm with lit and unlit windows and a stack of moving boxes by the door.",
        "Level 2 'Dorm Move-In' building and briefing art (FR-031).", dorm())
    add("buildings", "building-stadium", 128, 128, "Stadium",
        "A top-down oval stadium with grey stands, a green field with yard lines, and teal and amber end zones.",
        "Level 3 'Homecoming' stadium (FR-031).", stadium())
    add("buildings", "building-student-center", 128, 128, "Student center",
        "A modern student center with a glass front, an amber entrance canopy and a red flag on the roof.",
        "Level 3 student center, the building with the scheduled uplink failure (FR-031).", student_center())

    # ---- map tiles (64 = one 5 m x 5 m cell)
    tufts = "".join(f'<path d="M{x},{y} l2,-5 l2,5 M{x + 3},{y} l1,-4" stroke="{C["grass_d"]}" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
                    for x, y in ((10, 18), (40, 12), (26, 40), (50, 50), (8, 56)))
    add("tiles", "tile-grass", 64, 64, "Grass tile", "A square of campus lawn with a few grass tufts.",
        "Map cell outside any building. One tile = one 5 m x 5 m cell (FR-001).",
        f'<rect width="64" height="64" fill="{C["grass"]}"/>' + tufts)
    add("tiles", "tile-path", 64, 64, "Footpath tile", "A square of sandy paving with rounded stones.",
        "Map cell for campus walkways between buildings.",
        f'<rect width="64" height="64" fill="{C["path"]}"/>' +
        "".join(f'<ellipse cx="{x}" cy="{y}" rx="9" ry="6" fill="{C["sand"]}" stroke="#CBBB8E" stroke-width="1.5"/>'
                for x, y in ((14, 14), (44, 18), (24, 42), (52, 48), (6, 56))))
    add("tiles", "tile-floor", 64, 64, "Indoor floor tile", "Light floor tiles in a 2 x 2 grid, used inside buildings.",
        "Map cell for a zone inside a building (FR-001).",
        f'<rect width="64" height="64" fill="{C["cream"]}"/>'
        f'<path d="M32,0 V64 M0,32 H64" stroke="{C["grey_l"]}" stroke-width="2"/>'
        f'<rect x="1" y="1" width="62" height="62" fill="none" stroke="{C["grey_l"]}" stroke-width="2"/>')
    add("tiles", "tile-field", 64, 64, "Playing field tile", "Bright turf with a white yard line.",
        "Map cell inside the stadium (Level 3).",
        f'<rect width="64" height="64" fill="#79B25C"/><rect y="0" width="64" height="32" fill="#86BF68"/>'
        f'<line x1="32" y1="0" x2="32" y2="64" stroke="{C["paper"]}" stroke-width="3"/>')
    add("tiles", "map-cursor", 64, 64, "Map cursor",
        "Four thick corner brackets that frame one map cell.",
        "Keyboard map cursor and current selection (FR-036). High contrast, so it works on every tile.",
        "".join(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="square"/>'
                for c, w in ((C["paper"], 9), (ink, 5))
                for d in ("M4,18 V4 H18", "M46,4 H60 V18", "M60,46 V60 H46", "M18,60 H4 V46")))

    # ---- overlays: never colour-only, each has its own pattern
    add("overlays", "overlay-not-covered", 64, 64, "Not covered overlay",
        "A see-through tile with dark diagonal hatching and a small crossed-out Wi-Fi symbol.",
        "Draw over a zone whose RSSI is below -67 dBm (FR-006). The hatching shows coverage without relying on colour.",
        "".join(f'<line x1="{x}" y1="0" x2="{x - 64}" y2="64" stroke="{ink}" stroke-width="2.5" opacity="0.35"/>'
                for x in range(8, 136, 12)) +
        f'<circle cx="52" cy="12" r="10" fill="{C["paper"]}" stroke="{ink}" stroke-width="2"/>' +
        wifi_arcs(52, 17, (5, 9), C["grey_d"], 2) + f'<line x1="45" y1="5" x2="59" y2="19" stroke="{C["red"]}" stroke-width="2.5"/>')
    add("overlays", "overlay-congested", 64, 64, "Congested overlay",
        "A see-through tile with bold amber chevrons, like a slow-traffic road marking.",
        "Draw over zones served by an overloaded AP or a congested uplink (FR-009, FR-010).",
        f'<rect width="64" height="64" fill="{C["amber"]}" opacity="0.18"/>' +
        "".join(f'<path d="M8,{y} L32,{y - 10} L56,{y}" fill="none" stroke="{C["amber"]}" stroke-width="4" opacity="0.8" stroke-linejoin="round"/>'
                for y in (24, 42, 60)))
    add("overlays", "overlay-uplink-down", 64, 64, "Uplink down overlay",
        "A grey see-through tile with a dotted grid and a small broken-plug symbol.",
        "Draw over every zone in a building with no working uplink; users show grey 'Uplink down' status (Level 3).",
        f'<rect width="64" height="64" fill="{C["grey_d"]}" opacity="0.45"/>' +
        "".join(f'<circle cx="{x}" cy="{y}" r="1.8" fill="{C["paper"]}" opacity="0.7"/>' for x in range(8, 64, 12) for y in range(8, 64, 12)) +
        f'<rect x="40" y="4" width="20" height="16" rx="3" fill="{C["paper"]}" stroke="{ink}" stroke-width="2"/>'
        f'<path d="M44,12 h4 M52,12 h4" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>{cross(50, 12, 3, C["red"], 2)}')
    add("overlays", "overlay-ticket-zone", 64, 64, "Open-ticket zone overlay",
        "A tile outlined with a pink dashed border and a small ticket in the corner.",
        "Marks the zone that an open trouble ticket belongs to (FR-014).",
        f'<rect x="3" y="3" width="58" height="58" fill="{C["pink"]}" fill-opacity="0.15" stroke="{C["pink"]}" stroke-width="4" stroke-dasharray="8 5"/>' +
        ticket_shape(36, 6, 24, 16, C["paper"]))

    # ---- walls (edge segments, 64 x 16)
    add("walls", "wall-drywall", 64, 16, "Drywall wall segment",
        "A pale wall segment with dashed vertical seams between panels.",
        "Wall on a cell edge; 3 dB loss in the model (FR-005, illustrative).",
        f'<rect x="1" y="2" width="62" height="12" fill="#EEE7D7" stroke="{ink}" stroke-width="2"/>' +
        "".join(f'<line x1="{x}" y1="3" x2="{x}" y2="13" stroke="{C["grey"]}" stroke-width="1.5" stroke-dasharray="2 2"/>' for x in (16, 32, 48)))
    add("walls", "wall-brick", 64, 16, "Brick wall segment",
        "A red brick wall segment in a running-bond pattern.",
        "Wall on a cell edge; 8 dB loss in the model (FR-005, illustrative).",
        f'<rect x="1" y="2" width="62" height="12" fill="{C["brick"]}" stroke="{ink}" stroke-width="2"/>'
        f'<line x1="1" y1="8" x2="63" y2="8" stroke="{C["cream"]}" stroke-width="1.2"/>' +
        "".join(f'<line x1="{x}" y1="2" x2="{x}" y2="8" stroke="{C["cream"]}" stroke-width="1.2"/>' for x in (13, 29, 45, 61)) +
        "".join(f'<line x1="{x}" y1="8" x2="{x}" y2="14" stroke="{C["cream"]}" stroke-width="1.2"/>' for x in (5, 21, 37, 53)))
    add("walls", "wall-concrete", 64, 16, "Concrete wall segment",
        "A thick grey concrete wall segment with diagonal hatching and aggregate speckles.",
        "Wall on a cell edge; 12 dB loss in the model (FR-005, illustrative).",
        f'<rect x="1" y="1" width="62" height="14" fill="#A3A8AF" stroke="{ink}" stroke-width="2.5"/>' +
        "".join(f'<line x1="{x}" y1="2" x2="{x - 12}" y2="14" stroke="{C["grey_d"]}" stroke-width="1.5"/>' for x in range(12, 76, 8)) +
        "".join(f'<circle cx="{x}" cy="{y}" r="1.2" fill="{ink}"/>' for x, y in ((7, 5), (21, 11), (34, 6), (47, 10), (57, 4))))

    # ---- users
    add("users", "user-light", 48, 48, "Light user",
        "A student with short dark hair holding an open laptop.",
        "Map sprite for a Light user: browsing and email, 2 Mbps (FR-008).",
        person(24, 46, C["skin1"], C["sky"], C["hair"]) +
        f'<rect x="12" y="32" width="24" height="12" rx="2" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2"/>'
        f'<circle cx="24" cy="38" r="2" fill="{teal}"/>')
    add("users", "user-video", 48, 48, "Video user",
        "A student in a cap holding a phone that shows a play button.",
        "Map sprite for a Video user: streaming, 5 Mbps (FR-008).",
        person(24, 46, C["skin3"], C["pink"], C["ink"], hair_style="cap") +
        f'<rect x="17" y="28" width="14" height="18" rx="3" fill="{ink}"/>'
        f'<polygon points="22,32 22,42 29,37" fill="{C["paper"]}"/>')
    add("users", "user-event", 48, 48, "Event user",
        "A fan with curly hair waving an amber pennant.",
        "Map sprite for an Event user at Homecoming: 3 Mbps (FR-008, Level 3).",
        person(22, 46, C["skin2"], C["amber"], C["hair"], hair_style="curly") +
        f'<line x1="34" y1="44" x2="38" y2="10" stroke="{ink}" stroke-width="2.5" stroke-linecap="round"/>'
        f'<path d="M38,10 L46,18 L36,24Z" fill="{teal}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/>')
    add("users", "user-help-desk", 48, 48, "Help-desk technician",
        "A technician with a bun, wearing a headset and holding a clipboard.",
        "Optional character for hint panels or the ticket queue header.",
        person(24, 46, C["skin1"], C["green"], C["brick_d"], hair_style="bun") +
        f'<path d="M15,14 Q24,0 33,14" fill="none" stroke="{ink}" stroke-width="2.5"/>'
        f'<rect x="12" y="13" width="5" height="8" rx="2" fill="{ink}"/><path d="M14,21 Q14,26 21,26" fill="none" stroke="{ink}" stroke-width="2"/>'
        f'<rect x="26" y="30" width="14" height="16" rx="1.5" fill="{C["paper"]}" stroke="{ink}" stroke-width="2"/>'
        f'<line x1="29" y1="36" x2="37" y2="36" stroke="{ink}" stroke-width="1.5"/><line x1="29" y1="40" x2="35" y2="40" stroke="{ink}" stroke-width="1.5"/>')
    add("users", "status-satisfied", 24, 24, "Satisfied status badge",
        "A green circle with a white check mark.", "Small badge over a user or zone at 100% satisfaction.",
        badge_circle(12, 12, 10, C["green"], check(12, 12, 10, sw=3)))
    add("users", "status-slow", 24, 24, "Slow status badge",
        "An amber triangle with an exclamation mark.", "Small badge over a user or zone below 100% satisfaction.",
        f'<path d="M12,2 L23,21 H1Z" fill="{C["amber"]}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/>' + bang(12, 14, 11, ink))
    add("users", "status-offline", 24, 24, "Offline status badge",
        "A grey square with a white cross.", "Small badge over a user who gets 0 Mbps (not covered or uplink down).",
        f'<rect x="2" y="2" width="20" height="20" rx="4" fill="{C["grey"]}" stroke="{ink}" stroke-width="2"/>' + cross(12, 12, 5, C["paper"], 3))

    # ---- diagnosis causes (FR-015)
    def cause(name, title, desc, use, inner, ring):
        add("diagnosis", name, 64, 64, title, desc, use,
            f'<circle cx="32" cy="32" r="30" fill="{C["paper"]}" stroke="{ring}" stroke-width="4"/>' + inner)
    cause("cause-weak-signal", "Diagnosis: Weak signal",
          "A Wi-Fi symbol with only the smallest arc solid; the two outer arcs are grey and dashed, with a down arrow.",
          "Diagnosis option button for 'Weak signal' (zone RSSI below -67 dBm).",
          f'<circle cx="26" cy="44" r="3.5" fill="{teal}"/>' + wifi_arcs(26, 44, (9, 17, 25), teal, 4, faded=(1, 2)) +
          f'<path d="M50,20 V40 M43,33 L50,40 L57,33" fill="none" stroke="{C["red"]}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>', C["blue"])
    cause("cause-ap-overloaded", "Diagnosis: AP overloaded",
          "A small access point under a crowd of three heads, with a gauge needle in the red.",
          "Diagnosis option button for 'AP overloaded' (users demand more than 100 Mbps).",
          "".join(f'<circle cx="{x}" cy="{y}" r="5" fill="{c}" stroke="{ink}" stroke-width="2"/>'
                  for x, y, c in ((20, 20, C["skin1"]), (32, 15, C["skin3"]), (44, 20, C["skin2"]))) +
          ap_device(32, 42, 10, led=C["red"]) +
          f'<path d="M14,52 L22,46 M50,52 L42,46" stroke="{C["red"]}" stroke-width="3" stroke-linecap="round"/>', C["amber"])
    cause("cause-uplink-congested", "Diagnosis: Uplink congested",
          "A funnel packed with coloured traffic dots, squeezing into a thin pipe.",
          "Diagnosis option button for 'Uplink congested' (building traffic above uplink capacity).",
          f'<path d="M8,18 H30 L44,28 H58 V36 H44 L30,46 H8Z" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>' +
          "".join(f'<circle cx="{x}" cy="{y}" r="3.2" fill="{c}"/>' for x, y, c in (
              (14, 24, C["blue"]), (22, 24, C["amber"]), (14, 32, C["green"]), (22, 32, C["pink"]), (30, 32, C["blue"]),
              (14, 40, C["amber"]), (22, 40, C["green"]), (30, 26, C["red"]), (30, 38, C["sky"]), (38, 32, C["amber"]),
              (50, 32, C["green"]))), C["red"])
    cause("cause-channel-interference", "Diagnosis: Channel interference",
          "Two overlapping wave lines, one teal and one orange, with a lightning bolt where they cross.",
          "Diagnosis option button for 'Channel interference' (AP conflict and utilisation above effective capacity).",
          f'<path d="M6,32 Q13,18 20,32 T34,32 T48,32 T62,32" fill="none" stroke="{teal}" stroke-width="3.5"/>'
          f'<path d="M6,34 Q14,48 22,34 T38,34 T54,34" fill="none" stroke="{C["red"]}" stroke-width="3.5" stroke-dasharray="5 3"/>'
          f'<path d="M34,12 L26,32 H34 L28,52" fill="none" stroke="{C["amber"]}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>', C["pink"])
    cause("cause-uplink-down", "Diagnosis: Uplink down",
          "A cable broken into two pieces with a red cross between them.",
          "Diagnosis option button for 'Uplink down' (building has no working uplink).",
          f'<path d="M8,32 H22 M42,32 H56" stroke="{C["grey_d"]}" stroke-width="5" stroke-linecap="round"/>'
          f'<rect x="18" y="25" width="9" height="14" rx="2" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5"/>'
          f'<rect x="37" y="25" width="9" height="14" rx="2" fill="{C["grey_l"]}" stroke="{ink}" stroke-width="2.5"/>' +
          cross(32, 32, 4, C["red"], 3.5), C["grey_d"])

    # ---- tickets
    add("tickets", "ticket-open", 64, 48, "Open ticket",
        "A pink paper trouble ticket with an orange circle and exclamation mark.",
        "Ticket queue row icon for an open ticket (FR-014).",
        ticket_shape(4, 8, 48, 32, "#F7DCEB") + badge_circle(50, 14, 10, C["red"], bang(50, 14, 12)))
    add("tickets", "ticket-diagnosed", 64, 48, "Ticket diagnosed, awaiting fix",
        "A trouble ticket with a blue circle holding a wrench.",
        "Ticket status 'Diagnosed - awaiting fix'. The ticket is still open and still ageing (FR-017, FR-020).",
        ticket_shape(4, 8, 48, 32, "#DCEBF7") + badge_circle(50, 14, 10, C["blue"],
            f'<path d="M45,19 L52,12 M50,9 a4,4 0 1 0 5,5" fill="none" stroke="{C["paper"]}" stroke-width="3" stroke-linecap="round"/>'))
    add("tickets", "ticket-closed", 64, 48, "Closed ticket",
        "A trouble ticket with a green circle and a check mark.",
        "Ticket status when the zone reaches 100% satisfaction after a correct diagnosis (FR-017).",
        ticket_shape(4, 8, 48, 32, "#DDF2E8") + badge_circle(50, 14, 10, C["green"], check(50, 14, 10, sw=3)))
    add("tickets", "ticket-resolved-by-change", 64, 48, "Ticket resolved by network change",
        "A trouble ticket with a grey gear, meaning the network change fixed it before a diagnosis.",
        "Ticket status 'Resolved by network change' (FR-017a). No diagnosis points.",
        ticket_shape(4, 8, 48, 32, "#ECEDEF") + gear(50, 14, 10, 7.5, 8, C["grey"]))
    add("tickets", "scheduled-maintenance-risk", 64, 64, "Scheduled maintenance risk",
        "A calendar page with a hazard triangle and a wrench.",
        "Warning shown in the Level 3 briefing and Wave 2 preview before the uplink failure (US5 scenario 5).",
        f'<rect x="6" y="10" width="44" height="44" rx="4" fill="{C["paper"]}" stroke="{ink}" stroke-width="3"/>'
        f'<rect x="6" y="10" width="44" height="12" rx="4" fill="{C["red"]}" stroke="{ink}" stroke-width="3"/>'
        f'<line x1="16" y1="5" x2="16" y2="15" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'
        f'<line x1="40" y1="5" x2="40" y2="15" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>' +
        "".join(f'<rect x="{12 + c * 10}" y="{28 + r * 9}" width="6" height="5" fill="{C["grey_l"]}"/>' for c in range(4) for r in range(3)) +
        f'<path d="M46,30 L60,56 H32Z" fill="{C["yellow"]}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>' + bang(46, 48, 14, ink))

    # ---- signal strength bars
    for n in range(5):
        bars = "".join(
            f'<rect x="{3 + i * 7}" y="{26 - (i + 1) * 5.5:.1f}" width="5" height="{(i + 1) * 5.5:.1f}" rx="1" '
            + (f'fill="{teal}" stroke="{ink}" stroke-width="1.5"/>' if i < n else
               f'fill="{C["paper"]}" stroke="{C["grey"]}" stroke-width="1.5"/>')
            for i in range(4))
        add("signal", f"signal-{n}-of-4", 32, 32, f"Signal strength {n} of 4",
            f"Four rising bars with {n} filled in teal.",
            "Compact RSSI indicator for the zone panel. Always show the dBm number next to it (FR-035).",
            bars + text(30, 30, str(n), 9, ink, 800, "end"))

    # ---- UI icons (32 x 32, line style)
    S = f'fill="none" stroke="{ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"'
    ui = [
        ("ui-pause", "Pause", "Two vertical bars.", "Pause button; Space key (FR-021).",
         f'<rect x="8" y="6" width="5" height="20" rx="1.5" fill="{ink}"/><rect x="19" y="6" width="5" height="20" rx="1.5" fill="{ink}"/>'),
        ("ui-play", "Play", "A right-pointing triangle.", "Resume button (FR-021).",
         f'<path d="M10,6 L26,16 L10,26Z" fill="{ink}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/>'),
        ("ui-speed-1x", "Normal speed", "One triangle followed by 1x.", "Clock speed 1x (FR-021).",
         f'<path d="M4,9 L14,16 L4,23Z" fill="{ink}"/>' + text(23, 21, "1×", 11, ink, 900)),
        ("ui-speed-2x", "Double speed", "Two triangles followed by 2x.", "Clock speed 2x (FR-021).",
         f'<path d="M2,9 L10,16 L2,23Z M9,9 L17,16 L9,23Z" fill="{ink}"/>' + text(25, 21, "2×", 11, ink, 900)),
        ("ui-auto-pause", "Auto-pause setting", "A pause symbol inside a circle with a small letter A.", "Toggle for auto-pause on tickets and reviews (FR-022).",
         f'<circle cx="16" cy="16" r="12" {S}/><path d="M13,11 V21 M19,11 V21" {S}/>' +
         f'<circle cx="26" cy="7" r="6" fill="{teal}"/>' + text(26, 10.5, "A", 9, C["paper"], 900)),
        ("ui-hint", "Hint", "A lit light bulb.", "Hint button: method first, then worked solution (FR-019).",
         f'<path d="M11,20 a8,8 0 1 1 10,0 v3 h-10Z" fill="{C["yellow"]}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>'
         f'<path d="M12,26 H20 M13,29 H19" {S}/><path d="M16,1 V3 M4,6 l2,1.5 M28,6 l-2,1.5" {S}/>'),
        ("ui-budget", "Budget", "A gold coin with a dollar sign.", "Budget readout (FR-034).",
         f'<circle cx="16" cy="16" r="12" fill="{C["yellow"]}" stroke="{ink}" stroke-width="2.5"/>' + text(16, 21.5, "$", 15, ink, 900)),
        ("ui-score", "Score", "A five-point star.", "Score readout (FR-029).",
         f'<path d="M16,3 L19.8,11.5 L29,12.4 L22,18.5 L24.1,27.6 L16,22.8 L7.9,27.6 L10,18.5 L3,12.4 L12.2,11.5Z" '
         f'fill="{C["amber"]}" stroke="{ink}" stroke-width="2.2" stroke-linejoin="round"/>'),
        ("ui-satisfaction", "Campus satisfaction", "A smiling face.", "Campus satisfaction readout (FR-012, FR-034).",
         f'<circle cx="16" cy="16" r="12" fill="{C["teal_l"]}" stroke="{ink}" stroke-width="2.5"/>'
         f'<circle cx="12" cy="13" r="1.8" fill="{ink}"/><circle cx="20" cy="13" r="1.8" fill="{ink}"/><path d="M10.5,19 Q16,24 21.5,19" {S}/>'),
        ("ui-clock", "Simulation clock", "A clock face with hands at about ten past.", "Clock readout (FR-034).",
         f'<circle cx="16" cy="16" r="12" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.5"/><path d="M16,8 V16 L22,19" {S}/>'),
        ("ui-restart", "Restart", "A circular arrow.", "Restart session; must confirm (FR-027).",
         f'<path d="{arc_path(16, 16, 10, 50, 340)}" {S}/><path d="M7,4 L9.4,9.3 L15,8" {S}/>'),
        ("ui-retry-level", "Retry level", "A circular arrow around a small flag.", "Retry level after being fired (FR-025).",
         f'<path d="{arc_path(16, 16, 11, 50, 340)}" {S}/><path d="M6,3 L8.6,8.8 L14.4,7.5" {S}/>'
         f'<path d="M14,22 V11 L21,13.5 L14,16" fill="{C["red"]}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/>'),
        ("ui-zone-table", "Zone table", "A small table with a header row and three rows.", "Zone table tab, the text equivalent of the map (FR-035).",
         f'<rect x="4" y="6" width="24" height="20" rx="2" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.5"/>'
         f'<rect x="4" y="6" width="24" height="5" fill="{ink}"/><path d="M4,16 H28 M4,21 H28 M13,11 V26" stroke="{ink}" stroke-width="1.8"/>'),
        ("ui-map", "Campus map", "A folded map with a location pin.", "Map tab.",
         f'<path d="M4,8 L11,5 L20,8 L28,5 V24 L20,27 L11,24 L4,27Z" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.2" stroke-linejoin="round"/>'
         f'<path d="M11,5 V24 M20,8 V27" stroke="{ink}" stroke-width="1.5"/><path d="M22,11 a3.5,3.5 0 1 1 0.1,0 M22,18 l-2.5,-4 h5Z" fill="{C["red"]}"/>'),
        ("ui-info", "Information", "A lowercase i in a circle.", "Briefing / model note button (FR-028).",
         f'<circle cx="16" cy="16" r="12" {S}/><circle cx="16" cy="10" r="1.8" fill="{ink}"/><path d="M16,15 V23" {S}/>'),
        ("ui-close", "Close", "A cross.", "Close a dialog or panel.", f'<path d="M8,8 L24,24 M24,8 L8,24" {S}/>'),
        ("ui-confirm", "Confirm", "A check mark.", "Confirm buttons, e.g. diagnosis submit.", check(16, 16, 20, ink, 3)),
        ("ui-place-ap", "Place access point", "A small access point with a plus sign.", "Build tool: place AP ($500).",
         ap_device(14, 18, 9, sw=2.2) + f'<circle cx="25" cy="8" r="6" fill="{C["green"]}"/><path d="M25,5 V11 M22,8 H28" stroke="{C["paper"]}" stroke-width="2" stroke-linecap="round"/>'),
        ("ui-remove", "Remove equipment", "A trash can.", "Remove AP or uplink; 100% refund (FR-003).",
         f'<path d="M7,9 H25 M13,9 V6 H19 V9 M9,9 L10.5,27 H21.5 L23,9" {S}/><path d="M14,13 V23 M18,13 V23" {S}/>'),
        ("ui-buy-uplink", "Buy uplink", "A cable plug with a plus sign.", "Build tool: buy or upgrade an uplink.",
         f'<path d="M3,24 C10,24 10,16 14,16" {S}/><rect x="13" y="11" width="10" height="10" rx="2" fill="{C["sky"]}" stroke="{ink}" stroke-width="2.2"/>'
         f'<circle cx="25" cy="8" r="6" fill="{C["green"]}"/><path d="M25,5 V11 M22,8 H28" stroke="{C["paper"]}" stroke-width="2" stroke-linecap="round"/>'),
        ("ui-channel", "Set channel", "A tuning dial with tick marks.", "Channel picker (FR-007).",
         f'<circle cx="16" cy="17" r="10" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.5"/><path d="M16,17 L22,11" {S}/>' +
         "".join(f'<line x1="{16 + 12.5 * math.cos(a):.1f}" y1="{17 + 12.5 * math.sin(a):.1f}" x2="{16 + 14.5 * math.cos(a):.1f}" '
                 f'y2="{17 + 14.5 * math.sin(a):.1f}" stroke="{ink}" stroke-width="2"/>' for a in [math.radians(d) for d in range(-200, 30, 23)])),
        ("ui-settings", "Settings", "A gear.", "Settings (auto-pause, reduced motion, audio volume).", gear(16, 16, 13, 10, 8, C["grey_l"], ink, 2.2)),
        ("ui-sound-on", "Sound on", "A speaker with two sound waves.", "Mute toggle, unmuted state.",
         f'<path d="M4,12 H9 L16,6 V26 L9,20 H4Z" fill="{ink}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/>'
         f'<path d="{arc_path(16, 16, 6, 45, 135)}" {S}/><path d="{arc_path(16, 16, 11, 45, 135)}" {S}/>'),
        ("ui-sound-off", "Sound off", "A speaker with a cross.", "Mute toggle, muted state.",
         f'<path d="M4,12 H9 L16,6 V26 L9,20 H4Z" fill="{ink}" stroke="{ink}" stroke-width="2" stroke-linejoin="round"/><path d="M20,12 L28,20 M28,12 L20,20" {S}/>'),
        ("ui-keyboard", "Keyboard controls", "A small keyboard.", "Keyboard help overlay (FR-036).",
         f'<rect x="2" y="8" width="28" height="17" rx="3" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.2"/>' +
         "".join(f'<rect x="{5 + c * 5}" y="{11 + r * 4.5}" width="3.5" height="3" rx="0.6" fill="{ink}"/>' for c in range(5) for r in range(2)) +
         f'<rect x="9" y="20" width="14" height="2.6" rx="1" fill="{ink}"/>'),
    ]
    for name, title, desc, use, body in ui:
        add("ui", name, 32, 32, title, desc, use, body)

    # ---- Dean of IT
    for expr, title, desc, use in (
        ("neutral", "Dean of IT, neutral", "The Dean of IT, with silver curls, round glasses, a teal cardigan and an IT lanyard, looking calm.",
         "Level briefings and wave previews (FR-028, FR-038)."),
        ("pleased", "Dean of IT, pleased", "The Dean of IT smiling broadly with closed, happy eyes and rosy cheeks.",
         "Wave passed, level summary and session summary."),
        ("concerned", "Dean of IT, concerned", "The Dean of IT with worried brows, a wavy mouth and a sweat drop.",
         "Satisfaction falling near 70%, an old ticket near 90 s, or the maintenance-risk preview."),
        ("angry", "Dean of IT, firing you", "The Dean of IT frowning and holding up a pink NOTICE slip.",
         "Fired review. Keep the metric, value, threshold and cause as text beside it (FR-024)."),
    ):
        add("characters", f"dean-of-it-{expr}", 256, 256, title, desc, use, dean(expr))

    # ---- props
    add("props", "prop-tree", 48, 48, "Tree", "A round leafy campus tree.", "Decoration on lawn tiles.",
        tree(24, 46, 1.1))
    add("props", "prop-moving-boxes", 48, 48, "Moving boxes", "Three stacked cardboard boxes, the top one labelled ROUTER.",
        "Level 2 'Dorm Move-In' decoration.",
        f'<rect x="4" y="26" width="22" height="18" fill="{C["wood"]}" stroke="{ink}" stroke-width="2"/>'
        f'<rect x="24" y="22" width="20" height="22" fill="#D9A574" stroke="{ink}" stroke-width="2"/>'
        f'<rect x="10" y="8" width="26" height="18" fill="#E2B485" stroke="{ink}" stroke-width="2"/>'
        f'<line x1="23" y1="8" x2="23" y2="14" stroke="{ink}" stroke-width="2"/>' + text(23, 22, "ROUTER", 6, ink, 900))
    add("props", "prop-pennant", 48, 48, "Homecoming pennant", "A teal triangular pennant reading GO on a short pole.",
        "Level 3 'Homecoming' decoration.",
        f'<line x1="8" y1="44" x2="8" y2="4" stroke="{ink}" stroke-width="3" stroke-linecap="round"/>'
        f'<path d="M8,6 L44,15 L8,24Z" fill="{teal}" stroke="{ink}" stroke-width="2.5" stroke-linejoin="round"/>' + text(21, 19, "GO", 9, C["paper"], 900))
    add("props", "prop-coffee", 48, 48, "Coffee mug", "A steaming network-engineer coffee mug with a Wi-Fi symbol.",
        "Session summary or pause screen decoration.",
        f'<path d="M10,16 H34 V38 a6,6 0 0 1 -6,6 H16 a6,6 0 0 1 -6,-6Z" fill="{C["paper"]}" stroke="{ink}" stroke-width="2.5"/>'
        f'<path d="M34,22 h4 a5,5 0 0 1 0,12 h-4" fill="none" stroke="{ink}" stroke-width="2.5"/>' + wifi_arcs(22, 36, (5, 10), teal, 2.5) +
        f'<path d="M16,11 q3,-4 0,-8 M23,11 q3,-4 0,-8 M30,11 q3,-4 0,-8" fill="none" stroke="{C["grey"]}" stroke-width="2" stroke-linecap="round"/>')

    # ---- legends
    viridis = ["#440154", "#482878", "#3E4A89", "#31688E", "#26828E", "#1F9E89", "#35B779", "#6DCD59", "#B4DE2C", "#FDE725"]
    stops = "".join(f'<rect x="{20 + i * 40}" y="22" width="40" height="22" fill="{c}"/>' for i, c in enumerate(viridis[::-1]))
    labels = "".join(text(20 + i * 40, 60, f"{-40 - i * 5}", 11, ink, 700) for i in range(0, 11, 2))
    hatch = (f'<clipPath id="weak"><rect x="236" y="22" width="184" height="22"/></clipPath><g clip-path="url(#weak)">' +
             "".join(f'<line x1="{x}" y1="22" x2="{x - 22}" y2="44" stroke="{ink}" stroke-width="2"/>' for x in range(236, 450, 8)) + '</g>')
    add("legends", "legend-rssi-heatmap", 480, 96, "RSSI heat-map legend",
        "A colour scale from -40 dBm (yellow, strong) to -90 dBm (purple, weak). A bold marker at -67 dBm reads 'covered threshold', and the weak side is hatched for 'not covered'.",
        "Heat-map key. Uses a colour-blind-safe scale plus hatching and numbers, never colour alone (FR-006, FR-035).",
        stops + f'<g opacity="0.45">{hatch}</g><rect x="20" y="22" width="400" height="22" fill="none" stroke="{ink}" stroke-width="2"/>' + labels +
        f'<line x1="236" y1="14" x2="236" y2="50" stroke="{ink}" stroke-width="3.5"/>' +
        text(236, 11, "−67 dBm covered threshold", 11, ink, 800) + text(128, 84, "◀ Covered", 12, C["green"], 800) +
        text(340, 84, "Not covered ▶", 12, C["red"], 800) + text(456, 38, "dBm", 11, ink, 700), bg=C["paper"])
    walls_legend = "".join(
        f'<g transform="translate(20,{18 + i * 30})"><use href="#w{i}"/></g>' for i in range(3))
    add("legends", "legend-wall-types", 300, 110, "Wall types legend",
        "Drywall, brick and concrete wall samples, each labelled with its signal loss in dB.",
        "Key for wall types on the map and in briefings. Losses are illustrative (FR-005).",
        "".join(
            f'<g transform="translate(16,{14 + i * 30})">{body}</g>' + text(96, 27 + i * 30, label, 13, ink, 700, "start")
            for i, (body, label) in enumerate((
                (next(a["body"] for a in ASSETS if a["id"] == "wall-drywall"), "Drywall  ·  3 dB"),
                (next(a["body"] for a in ASSETS if a["id"] == "wall-brick"), "Brick  ·  8 dB"),
                (next(a["body"] for a in ASSETS if a["id"] == "wall-concrete"), "Concrete  ·  12 dB"),
            ))) + text(16, 104, "Illustrative losses, simplified model", 10, C["grey_d"], 600, "start"), bg=C["paper"])
    del walls_legend
    add("legends", "legend-channel-plan", 420, 120, "2.4 GHz channel plan legend",
        "Channels 1 to 11 drawn as overlapping humps; channels 1, 6 and 11 are solid and do not overlap each other, the rest are dashed.",
        "Briefing figure for Level 3 channel planning (FR-007): channels within 4 of each other conflict.",
        "".join(
            f'<path d="M{20 + (ch - 1) * 34 - 60},96 Q{20 + (ch - 1) * 34},{20 if ch in CHANNEL_COLOURS else 40} {20 + (ch - 1) * 34 + 60},96" '
            f'fill="{CHANNEL_COLOURS.get(ch, "none")}" fill-opacity="{0.35 if ch in CHANNEL_COLOURS else 0}" '
            f'stroke="{CHANNEL_COLOURS.get(ch, C["grey"])}" stroke-width="{3 if ch in CHANNEL_COLOURS else 1.5}"'
            f'{"" if ch in CHANNEL_COLOURS else " stroke-dasharray=" + chr(34) + "4 3" + chr(34)}/>'
            for ch in range(1, 12)) +
        f'<line x1="0" y1="96" x2="420" y2="96" stroke="{ink}" stroke-width="2"/>' +
        "".join(text(20 + (ch - 1) * 34, 112, str(ch), 11, ink, 900 if ch in CHANNEL_COLOURS else 500) for ch in range(1, 12)) +
        text(210, 14, "Channels 1 · 6 · 11 do not overlap", 12, ink, 800), bg=C["paper"])

    # ---- stamps (review screen)
    for name, label, colour, title, use in (
        ("stamp-wave-passed", "WAVE PASSED", C["green"], "Wave passed stamp", "Wave review when satisfaction >= 70.0% and no ticket is older than 90 s (FR-024)."),
        ("stamp-fired", "FIRED", C["red"], "Fired stamp", "Wave review when the player is fired. Always show the reason text with it (FR-024)."),
        ("stamp-level-complete", "LEVEL COMPLETE", C["blue"], "Level complete stamp", "Level summary after the third wave review (FR-026)."),
        ("stamp-resolved", "RESOLVED", teal, "Resolved stamp", "Ticket closed after a correct diagnosis and fix (FR-017)."),
    ):
        add("stamps", name, 320, 120, title, f'A tilted rubber-stamp graphic reading "{label}" with a double border.', use,
            f'<g transform="rotate(-6 160 60)" opacity="0.92">'
            f'<rect x="16" y="20" width="288" height="80" rx="10" fill="none" stroke="{colour}" stroke-width="6"/>'
            f'<rect x="26" y="30" width="268" height="60" rx="6" fill="none" stroke="{colour}" stroke-width="2.5"/>' +
            text(160, 72, label, 34 if len(label) < 12 else 28, colour, 900, extra='letter-spacing="3"') + '</g>')

    # ---- brand
    logo_mark = (f'<rect x="8" y="8" width="112" height="112" rx="26" fill="{teal}"/>'
                 + wifi_arcs(64, 88, (22, 36, 50), C["paper"], 8) +
                 f'<path d="M40,104 V82 L64,66 L88,82 V104Z" fill="{C["paper"]}" stroke="{ink}" stroke-width="4" stroke-linejoin="round"/>'
                 f'<rect x="57" y="88" width="14" height="16" fill="{C["amber"]}" stroke="{ink}" stroke-width="3"/>')
    add("brand", "app-icon", 128, 128, "Campus Connect app icon",
        "A teal rounded square with white Wi-Fi arcs rising above a small white campus building with an amber door.",
        "Favicon, app icon and social preview mark.", logo_mark)
    add("brand", "logo-wordmark", 640, 160, "Campus Connect logo",
        "The Campus Connect app icon beside the words Campus Connect and the tagline 'Build the network before the crowd arrives.'",
        "Title screen and README header.",
        f'<g transform="translate(8,16)">{logo_mark}</g>' +
        text(156, 88, "Campus Connect", 56, ink, 900, "start", 'letter-spacing="-1"') +
        text(158, 124, "Build the network before the crowd arrives.", 20, C["grey_d"], 600, "start"))

    # ---- banners (960 x 240)
    def banner(name, title, level, subtitle, scene, sky, desc, use):
        add("banners", name, 960, 240, title, desc, use,
            f'<rect width="960" height="240" fill="{sky}"/><rect y="186" width="960" height="54" fill="{C["grass"]}"/>'
            f'<rect y="186" width="960" height="6" fill="{C["grass_d"]}"/>' + scene +
            f'<rect x="28" y="40" width="440" height="112" rx="16" fill="{C["paper"]}" fill-opacity="0.92" stroke="{ink}" stroke-width="3"/>' +
            text(52, 78, level, 18, teal, 800, "start") + text(52, 118, title.split(": ")[-1], 34, ink, 900, "start") +
            text(52, 142, subtitle, 15, C["grey_d"], 600, "start"))
    banner("banner-level-1-orientation-week", "Level 1: Orientation Week", "LEVEL 1", "Coverage: distance and walls",
           library(560, 70, 1.0) + tree(520, 190, 1.4) + tree(720, 190, 1.2) +
           "".join(person(x, 200, sk, sh, C["hair"], 0.9, hs) for x, sk, sh, hs in (
               (780, C["skin1"], C["sky"], "short"), (820, C["skin3"], C["pink"], "curly"), (860, C["skin2"], C["green"], "bun"))) +
           wifi_arcs(624, 68, (20, 32, 44), C["paper"], 5) + ap_device(624, 68, 10) +
           f'<circle cx="880" cy="56" r="26" fill="{C["yellow"]}"/>', "#BFE3F2",
           "A sunny banner: the campus library with an access point above it, trees and three new students, beside the title Level 1, Orientation Week.",
           "Level 1 briefing header (FR-028, FR-031).")
    banner("banner-level-2-dorm-move-in", "Level 2: Dorm Move-In", "LEVEL 2", "Capacity: AP vs. uplink congestion",
           dorm(560, 62, 1.0) + dorm(700, 82, 0.85) +
           "".join(f'<g transform="translate({x},150)">{next(a["body"] for a in ASSETS if a["id"] == "prop-moving-boxes")}</g>' for x in (520, 830)) +
           "".join(person(x, 202, sk, sh, C["hair"], 0.9, hs) for x, sk, sh, hs in (
               (880, C["skin2"], C["blue"], "cap"), (912, C["skin1"], C["amber"], "short"))) +
           f'<circle cx="880" cy="52" r="24" fill="{C["amber"]}" opacity="0.8"/>', "#F6D9B8",
           "An afternoon banner: two brick dorms with moving boxes and students carrying gear, beside the title Level 2, Dorm Move-In.",
           "Level 2 briefing header (FR-028, FR-031).")
    fireworks = "".join(
        f'<g transform="translate({x},{y})">' + "".join(
            f'<line x1="0" y1="0" x2="{18 * math.cos(a):.1f}" y2="{18 * math.sin(a):.1f}" stroke="{c}" stroke-width="3" stroke-linecap="round"/>'
            for a in [i * math.pi / 5 for i in range(10)]) + '</g>'
        for x, y, c in ((560, 50, C["yellow"]), (900, 40, C["pink"]), (760, 30, C["teal_l"])))
    banner("banner-level-3-homecoming", "Level 3: Homecoming", "LEVEL 3", "Interference and availability",
           fireworks + stadium(600, 70, 1.0) + student_center(760, 72, 0.95) +
           "".join(f'<g transform="translate({x},144)">{next(a["body"] for a in ASSETS if a["id"] == "prop-pennant")}</g>' for x in (520, 900)),
           C["night"],
           "A night-time banner with fireworks over the stadium and the student center, with pennants, beside the title Level 3, Homecoming.",
           "Level 3 briefing header (FR-028, FR-031).")

    # ---- title background (1280 x 720)
    bg = [f'<rect width="1280" height="720" fill="{C["grass"]}"/>']
    for x in range(0, 1280, 64):
        for y in range(0, 720, 64):
            if (x * 7 + y * 3) % 5 == 0:
                bg.append(f'<path d="M{x + 20},{y + 30} l2,-6 l2,6 M{x + 26},{y + 30} l1,-4" stroke="{C["grass_d"]}" stroke-width="2" fill="none"/>')
    bg += [f'<path d="M0,420 C300,380 500,470 700,420 S1100,360 1280,400" fill="none" stroke="{C["path"]}" stroke-width="56" stroke-linecap="round"/>',
           f'<path d="M640,720 C640,600 620,520 700,420" fill="none" stroke="{C["path"]}" stroke-width="48"/>',
           f'<path d="M300,0 C320,160 260,300 330,400" fill="none" stroke="{C["path"]}" stroke-width="44"/>',
           library(90, 150, 1.6), dorm(820, 90, 1.5), stadium(960, 470, 1.8), student_center(340, 470, 1.6)]
    for x, y in ((60, 600), (180, 640), (560, 140), (700, 210), (1180, 260), (760, 640), (1240, 660), (40, 120)):
        bg.append(tree(x, y, 1.5))
    for x, y, r in ((300, 200, 110), (930, 360, 120), (560, 600, 120)):
        bg.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{teal}" fill-opacity="0.10" stroke="{teal}" stroke-width="3" stroke-dasharray="10 8"/>')
        bg.append(wifi_arcs(x, y, (20, 32), C["paper"], 5) + ap_device(x, y, 13))
    for x, y, sk, sh, hs in ((660, 470, C["skin1"], C["sky"], "short"), (720, 480, C["skin3"], C["pink"], "curly"),
                             (190, 460, C["skin2"], C["amber"], "cap"), (1100, 420, C["skin1"], C["green"], "bun")):
        bg.append(person(x, y, sk, sh, C["hair"], 1.4, hs))
    add("backgrounds", "bg-title-campus", 1280, 720, "Campus overview",
        "A top-down illustrated campus: the library, a dorm, the student center and the stadium joined by sandy paths, with trees, students and three access points broadcasting dashed coverage circles.",
        "Title screen or session summary background. Put the logo and buttons over the open path area.",
        "".join(bg))


if __name__ == "__main__":
    build_registry()
    print(len(ASSETS), "art assets")
