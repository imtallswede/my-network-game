"""Campus Connect audio: every sound is synthesised here with numpy, so it is original and reproducible.

No samples, sound fonts or speech engines are used. Voices are formant-synthesised gibberish
("simlish"-style babble), so there is nothing to license and nothing to translate.
"""
import numpy as np
from scipy.signal import lfilter, butter

SR = 44100
RNG = np.random.default_rng(20261117)  # fixed seed: identical output on every build

SOUNDS = []  # dicts: id, category, data (float32 mono or stereo), loop, bpm, title, description, use, volume


def add(category, name, data, title, desc, use, loop=False, bpm=None, volume=0.8):
    SOUNDS.append(dict(id=name, category=category, data=data, loop=loop, bpm=bpm, title=title,
                       description=desc, use=use, volume=volume))


# ------------------------------------------------------------------ building blocks

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def nn(name):
    """'C#5' -> midi number."""
    base = NOTE[name[0]]
    rest = name[1:]
    if rest and rest[0] in "#b":
        base += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    return base + 12 * (int(rest) + 1)


def t(dur):
    return np.arange(int(SR * dur)) / SR


def osc(freq, dur, wave="sine", phase=0.0):
    """freq may be a scalar or an array (for slides)."""
    n = int(SR * dur)
    f = np.full(n, freq, dtype=float) if np.isscalar(freq) else np.asarray(freq, float)[:n]
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if wave == "sine":
        return np.sin(ph)
    if wave == "triangle":
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if wave == "square":  # softened square, less aliasing
        return np.tanh(4 * np.sin(ph))
    if wave == "pulse":
        return np.tanh(6 * (np.sin(ph) + 0.4))
    if wave == "saw":  # 10-harmonic band-limited saw
        return sum(np.sin(k * ph) / k for k in range(1, 11)) * 0.6
    if wave == "organ":
        return 0.6 * np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    if wave == "epiano":
        env2 = np.exp(-np.arange(n) / SR * 6)
        return np.sin(ph + 1.2 * env2 * np.sin(ph * 2)) * 0.9
    raise ValueError(wave)


def env(n, a=0.005, d=0.08, s=0.7, r=0.08, hold=None):
    """ADSR envelope of n samples; the release starts at n - r."""
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    e = np.full(n, s, dtype=float)
    a_n = min(a_n, n)
    e[:a_n] = np.linspace(0, 1, a_n, endpoint=False) if a_n else e[:a_n]
    d_end = min(n, a_n + d_n)
    e[a_n:d_end] = np.linspace(1, s, d_end - a_n, endpoint=False) if d_end > a_n else e[a_n:d_end]
    if r_n and n > r_n:
        e[-r_n:] *= np.linspace(1, 0, r_n)
    return e


def note(freq, dur, wave="triangle", vol=0.5, a=0.005, d=0.08, s=0.6, r=0.08, vib=0.0, vib_rate=5.5):
    total = dur + r
    tt = t(total)
    f = freq * (1 + vib * np.sin(2 * np.pi * vib_rate * tt)) if vib else freq
    return osc(f, total, wave) * env(len(tt), a, d, s, r) * vol


def noise(dur):
    return RNG.uniform(-1, 1, int(SR * dur))


def lowpass(x, cutoff, order=2):
    b, a = butter(order, min(cutoff / (SR / 2), 0.99), "low")
    return lfilter(b, a, x)


def highpass(x, cutoff, order=2):
    b, a = butter(order, min(cutoff / (SR / 2), 0.99), "high")
    return lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], "band")
    return lfilter(b, a, x)


def decay(n, rate):
    return np.exp(-np.arange(n) / SR * rate)


def plus(*xs):
    """Sum arrays of different lengths (zero-padded)."""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def mix(buf, x, at):
    """Add x into buf starting at time `at` (seconds); grows nothing, clips to buf length."""
    i = int(at * SR)
    if i >= len(buf):
        return buf
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]
    return buf


def blank(dur, stereo=False):
    n = int(SR * dur)
    return np.zeros((n, 2)) if stereo else np.zeros(n)


def master(x, peak=0.89):
    x = np.tanh(x * 1.1) / np.tanh(1.1)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    fade = min(len(x), int(0.004 * SR))
    if not getattr(x, "_loop", False):
        x[:fade] *= np.linspace(0, 1, fade)[:, None] if x.ndim == 2 else np.linspace(0, 1, fade)
    return x.astype(np.float32)


def master_tail(x, peak=0.89):
    """Master a one-shot: also fade the last 10 ms so it never clicks."""
    x = master(x, peak)
    fade = min(len(x), int(0.01 * SR))
    ramp = np.linspace(1, 0, fade)
    x[-fade:] *= ramp[:, None] if x.ndim == 2 else ramp
    return x


# percussion
def kick(vol=0.9):
    d = 0.32
    f = 50 + 110 * decay(int(SR * d), 28)
    return osc(f, d, "sine") * decay(int(SR * d), 11) * vol


def snare(vol=0.5, tone=190):
    d = 0.22
    n = bandpass(noise(d), 1200, 8000) * decay(int(SR * d), 22)
    b = osc(tone, d) * decay(int(SR * d), 30)
    return (n * 0.8 + b * 0.5) * vol


def hat(vol=0.25, length=0.05):
    return highpass(noise(length), 7000) * decay(int(SR * length), 60) * vol


def shaker(vol=0.15):
    return bandpass(noise(0.08), 5000, 12000) * env(int(SR * 0.08), 0.02, 0.02, 0.6, 0.04) * vol


# ------------------------------------------------------------------ music engine

class Song:
    def __init__(self, bpm, bars, beats_per_bar=4, tail=2.0):
        self.bpm, self.bars, self.bpb = bpm, bars, beats_per_bar
        self.spb = 60.0 / bpm
        self.length = bars * beats_per_bar * self.spb
        self.buf = blank(self.length + tail, stereo=True)

    def at(self, beat):
        return beat * self.spb

    def put(self, x, beat, pan=0.0):
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        i = int(self.at(beat) * SR)
        j = min(len(self.buf), i + len(x))
        self.buf[i:j, 0] += x[: j - i] * l
        self.buf[i:j, 1] += x[: j - i] * r

    def seq(self, text, start=0.0, wave="triangle", vol=0.3, pan=0.0, octave=0, **kw):
        """'E5:1 G5:0.5 R:0.5 ...' -> notes; returns the end beat."""
        beat = start
        for tok in text.split():
            name, length = tok.split(":")
            length = float(length)
            if name != "R":
                notes = name.split("+")
                for n_ in notes:
                    self.put(note(midi(nn(n_) + 12 * octave), length * self.spb * 0.92, wave, vol / len(notes) ** 0.5, **kw), beat, pan)
            beat += length
        return beat

    def chord(self, notes, beat, beats, wave="organ", vol=0.18, pan=0.0, **kw):
        for n_ in notes:
            self.put(note(midi(n_), beats * self.spb * 0.98, wave, vol, **kw), beat, pan)

    def drums(self, pattern, bars=None, vol=1.0):
        """pattern: dict of instrument -> 16-step strings ('x' hit, 'o' ghost, '.' rest), one bar long."""
        steps = 16
        for bar in range(bars or self.bars):
            for inst, pat in pattern.items():
                for k, ch in enumerate(pat):
                    if ch == ".":
                        continue
                    v = vol * (1.0 if ch == "x" else 0.45)
                    beat = bar * self.bpb + k * self.bpb / steps
                    s = {"k": kick(0.9 * v), "s": snare(0.45 * v), "h": hat(0.22 * v), "H": hat(0.25 * v, 0.18),
                         "z": shaker(0.18 * v), "r": snare(0.25 * v, 300)}[inst]
                    self.put(s, beat, {"k": 0, "s": 0.05, "h": 0.35, "H": 0.35, "z": -0.35, "r": 0.1}[inst])

    def echo(self, delay_beats=0.75, feedback=0.3, wet=0.18):
        d = int(self.at(delay_beats) * SR)
        out = self.buf.copy()
        tap = self.buf.copy()
        for k in range(1, 5):
            tap = np.roll(tap, d, axis=0) * feedback
            tap[:d] = 0
            out[:, k % 2] += tap[:, k % 2] * wet / feedback
        self.buf = out

    def render(self, loop=True):
        n = int(self.length * SR)
        if loop:  # wrap the tail onto the start so the loop is seamless
            out = self.buf[:n].copy()
            tail = self.buf[n:]
            out[: len(tail)] += tail[: n]
        else:
            out = self.buf
        return out


# ------------------------------------------------------------------ voices (formant babble)

VOWELS = {  # F1, F2, F3 (Hz) approximate adult formants
    "a": (800, 1200, 2500), "e": (500, 1800, 2500), "i": (320, 2300, 3000),
    "o": (500, 900, 2400), "u": (350, 800, 2300), "ae": (700, 1700, 2500),
}


def resonator(x, f, bw):
    r = np.exp(-np.pi * bw / SR)
    theta = 2 * np.pi * f / SR
    return lfilter([1 - r], [1, -2 * r * np.cos(theta), r * r], x)


def voice(syllables, f0_curve, rate=7.0, gruff=0.0, formant_shift=1.0, breath=0.05):
    """syllables: list of (consonant, vowel) e.g. [('m','a'), ('', 'o')]; f0_curve: callable 0..1 -> Hz."""
    syl = 1.0 / rate
    out = []
    for k, (cons, vow) in enumerate(syllables):
        dur = syl * RNG.uniform(0.85, 1.25)
        n = int(SR * dur)
        pos = (k + np.linspace(0, 1, n)) / len(syllables)
        f0 = np.array([f0_curve(p) for p in pos]) * (1 + 0.01 * np.sin(2 * np.pi * 6 * np.arange(n) / SR))
        src = osc(f0, dur, "saw") + gruff * RNG.uniform(-1, 1, n) * 0.6 + breath * RNG.uniform(-1, 1, n)
        f1, f2, f3 = (v * formant_shift for v in VOWELS[vow])
        y = resonator(src, f1, 90) * 1.0 + resonator(src, f2, 120) * 0.6 + resonator(src, f3, 180) * 0.3
        y *= env(n, 0.015, 0.05, 0.85, 0.04)
        if cons:
            cn = int(SR * 0.045)
            burst = {"s": highpass(noise(0.045), 4000) * 0.5, "t": highpass(noise(0.02), 2500) * 0.8,
                     "k": bandpass(noise(0.03), 1500, 4000) * 0.8, "m": lowpass(osc(f0[0], 0.045), 400) * 0.8,
                     "b": lowpass(noise(0.02), 800), "w": osc(f0[0], 0.045) * 0.3, "h": bandpass(noise(0.045), 800, 3000) * 0.4,
                     "n": lowpass(osc(f0[0], 0.045), 600) * 0.7, "r": bandpass(osc(f0[0], 0.045, "saw"), 300, 1600) * 0.6}[cons]
            burst = burst[:cn] * env(len(burst[:cn]), 0.003, 0.01, 0.8, 0.01)
            y = np.concatenate([burst * np.max(np.abs(y) + 1e-9), y])
        out.append(y)
        if RNG.uniform() < 0.12:
            out.append(np.zeros(int(SR * 0.04)))
    y = np.concatenate(out)
    return y / (np.max(np.abs(y)) + 1e-9)


CONS_CLASS = {"s": "s", "z": "s", "f": "s", "v": "b", "t": "t", "d": "t", "p": "b", "b": "b", "k": "k", "g": "k", "c": "k",
              "m": "m", "n": "n", "l": "n", "r": "r", "w": "w", "y": "w", "h": "h", "j": "s", "q": "k", "x": "s"}


def syl(word):
    """'ma-ka-ti-wo' -> [('m','a'), ('k','a'), ...]. Tolerant: any letters are accepted."""
    res = []
    for s in word.split("-"):
        s = s.lower()
        vi = next((i for i, ch in enumerate(s) if ch in "aeiouy"), None)
        vow = "i" if vi is None else {"y": "i"}.get(s[vi], s[vi])
        cons = CONS_CLASS.get(s[0], "h") if (s and s[0] not in "aeiouy") else ""
        res.append((cons, vow))
    return res


def angry_contour(base, peak, end):
    return lambda p: base + (peak - base) * np.sin(min(p, 0.7) / 0.7 * np.pi / 2) if p < 0.7 else peak + (end - peak) * (p - 0.7) / 0.3


# ------------------------------------------------------------------ registry

def build_registry():
    SOUNDS.clear()
    RNG.bit_generator.state = np.random.default_rng(20261117).bit_generator.state

    # ===== UI / build SFX ==========================================================
    b = blank(0.32)
    mix(b, note(midi(nn("C6")), 0.06, "triangle", 0.6, r=0.05), 0)
    mix(b, note(midi(nn("G6")), 0.12, "triangle", 0.6, r=0.1), 0.06)
    mix(b, highpass(noise(0.01), 3000) * 0.4, 0)
    add("sfx-build", "sfx-ap-place", master_tail(b), "Access point placed",
        "Two quick rising triangle-wave blips with a tiny click, like snapping a device into a ceiling mount.",
        "Play when an AP is placed or moved (FR-002).")

    b = blank(0.3)
    mix(b, note(midi(nn("G6")), 0.06, "triangle", 0.6, r=0.05), 0)
    mix(b, note(midi(nn("C6")), 0.12, "triangle", 0.5, r=0.1), 0.06)
    add("sfx-build", "sfx-ap-remove", master_tail(b), "Equipment removed",
        "The placement blip in reverse: two falling notes.", "Play when an AP or uplink is removed and refunded (FR-003).")

    b = blank(0.65)
    for k, n_ in enumerate(("E6", "B6")):
        mix(b, note(midi(nn(n_)), 0.08, "square", 0.35, r=0.25), k * 0.07)
    mix(b, highpass(noise(0.4), 6000) * decay(int(SR * 0.4), 9) * 0.25, 0.1)
    add("sfx-build", "sfx-uplink-purchase", master_tail(b), "Uplink purchased",
        "A bright two-note register 'ka-ching' with a shimmer of metallic noise.", "Play when an uplink is bought (FR-003).")

    b = blank(0.7)
    for k, n_ in enumerate(("C5", "E5", "G5", "C6", "E6")):
        mix(b, note(midi(nn(n_)), 0.07, "square", 0.3, r=0.2), k * 0.055)
    add("sfx-build", "sfx-uplink-upgrade", master_tail(b), "Uplink upgraded to 1 Gbps",
        "A fast five-note rising arpeggio, like a power-up.", "Play when a 100 Mbps uplink is upgraded to 1 Gbps (FR-003).")

    b = blank(0.4)
    for k in range(2):
        mix(b, (note(midi(nn("A2")), 0.1, "square", 0.45, r=0.03) + note(midi(nn("A2")) * 1.03, 0.1, "square", 0.3, r=0.03)), k * 0.15)
    add("sfx-build", "sfx-purchase-refused", master_tail(b), "Purchase refused",
        "Two short low buzzes. Not harsh: it means 'not enough budget', not 'you failed'.",
        "Play when a purchase exceeds the remaining budget; show cost and budget as text (FR-004).")

    b = blank(0.3)
    for k in range(3):
        mix(b, bandpass(noise(0.012), 2000 + k * 900, 6000 + k * 900) * 0.8, k * 0.06)
        mix(b, note(1400 + k * 250, 0.02, "sine", 0.25, r=0.02), k * 0.06)
    add("sfx-build", "sfx-channel-change", master_tail(b), "Channel changed",
        "Three rising dial clicks, like turning a tuning knob.", "Play when an AP's channel is changed (FR-007).")

    b = blank(0.06)
    mix(b, highpass(noise(0.015), 2500) * decay(int(SR * 0.015), 200) * 0.7, 0)
    mix(b, note(2200, 0.01, "sine", 0.3, r=0.02), 0)
    add("sfx-ui", "sfx-ui-click", master_tail(b, 0.6), "Button click",
        "A tiny, soft tick.", "Generic button and menu click. Keep it quiet.", volume=0.5)

    b = blank(0.05)
    mix(b, note(3200, 0.008, "sine", 0.2, r=0.02), 0)
    add("sfx-ui", "sfx-ui-focus", master_tail(b, 0.35), "Keyboard focus move",
        "An even tinier, high blip.", "Optional cue when the keyboard map cursor moves (FR-036). Off by default is fine.", volume=0.3)

    b = blank(0.25)
    mix(b, note(midi(nn("G4")), 0.05, "sine", 0.5, r=0.12), 0)
    mix(b, note(midi(nn("D4")), 0.06, "sine", 0.5, r=0.12), 0.06)
    add("sfx-ui", "sfx-pause", master_tail(b, 0.7), "Game paused",
        "Two soft descending sine notes.", "Play when the clock pauses (FR-021). Pair with a visible 'Paused' label.")

    b = blank(0.25)
    mix(b, note(midi(nn("D4")), 0.05, "sine", 0.5, r=0.12), 0)
    mix(b, note(midi(nn("A4")), 0.06, "sine", 0.5, r=0.12), 0.06)
    add("sfx-ui", "sfx-resume", master_tail(b, 0.7), "Game resumed",
        "Two soft ascending sine notes.", "Play when the clock resumes (FR-021).")

    b = blank(0.3)
    for k in range(2):
        mix(b, note(midi(nn("E5")) * (1 + k * 0.5), 0.04, "triangle", 0.5, r=0.06), k * 0.07)
    add("sfx-ui", "sfx-speed-2x", master_tail(b, 0.7), "Speed set to 2x",
        "A quick double blip, the second higher.", "Play when the clock switches to 2x (FR-021).")

    b = blank(0.5)
    sweep = osc(np.linspace(300, 1600, int(SR * 0.4)), 0.4, "sine") * env(int(SR * 0.4), 0.3, 0.05, 0.5, 0.05) * 0.2
    mix(b, plus(bandpass(noise(0.4), 600, 4000) * env(int(SR * 0.4), 0.3, 0.05, 0.5, 0.05) * 0.5, sweep), 0)
    add("sfx-ui", "sfx-restart", master_tail(b, 0.7), "Session restart",
        "A rising whoosh.", "Play after the player confirms Restart (FR-027).")

    b = blank(0.5)
    for k in range(2):
        mix(b, note(midi(nn("F4")), 0.1, "pulse", 0.35, r=0.05) + note(midi(nn("B3")), 0.1, "pulse", 0.25, r=0.05), k * 0.17)
    add("sfx-ui", "sfx-content-error", master_tail(b), "Content error",
        "Two flat, dissonant beeps.", "Play with the visible content-error message when level data fails validation (FR-032).")

    b = blank(0.18)
    f = 900 * decay(int(SR * 0.12), 25) + 250
    mix(b, osc(f, 0.12, "sine") * decay(int(SR * 0.12), 30) * 0.6, 0)
    add("sfx-game", "sfx-user-arrive", master_tail(b, 0.5), "User arrives",
        "A soft bubble pop.", "Play (quietly, rate-limited) as users arrive during a wave (FR-023).", volume=0.35)

    # ===== tickets ================================================================
    b = blank(0.9)
    for k in range(2):
        for n_, dt in (("A5", 0), ("E6", 0.09)):
            tone = note(midi(nn(n_)), 0.05, "sine", 0.5, a=0.002, d=0.2, s=0.0, r=0.2)
            mix(b, plus(tone, 0.25 * note(midi(nn(n_)) * 2.76, 0.05, "sine", 0.3, a=0.002, d=0.08, s=0, r=0.1)), k * 0.32 + dt)
    add("sfx-tickets", "sfx-ticket-open", master_tail(b), "New trouble ticket",
        "A two-tone help-desk notification chime, played twice.", "Play when a ticket opens (FR-014). Auto-pause follows by default (FR-022).")

    b = blank(1.0)
    for k, n_ in enumerate(("C5", "E5", "G5")):
        mix(b, note(midi(nn(n_)), 0.08, "triangle", 0.45, r=0.12), k * 0.075)
    mix(b, plus(note(midi(nn("C6")), 0.35, "sine", 0.45, d=0.4, s=0.2, r=0.3), note(midi(nn("C7")), 0.2, "sine", 0.1, d=0.2, s=0, r=0.2)), 0.225)
    add("sfx-tickets", "sfx-diagnosis-correct", master_tail(b), "Correct diagnosis",
        "A bright major arpeggio that lands on a bell tone.", "Play on a correct diagnosis, with the +25 points (FR-017).")

    b = blank(0.6)
    mix(b, note(midi(nn("E4")), 0.12, "triangle", 0.45, r=0.12), 0)
    mix(b, note(midi(nn("C4")), 0.22, "triangle", 0.4, r=0.18), 0.14)
    add("sfx-tickets", "sfx-diagnosis-wrong", master_tail(b), "Not quite",
        "Two gentle, descending notes. Encouraging, not punishing: the ticket stays open and no points are lost.",
        "Play on a wrong diagnosis, alongside the explanation text (FR-016).")

    b = blank(0.9)
    pent = [nn(x) for x in ("C6", "D6", "E6", "G6", "A6", "C7", "D7", "E7")]
    for k in range(9):
        mix(b, note(midi(pent[RNG.integers(len(pent))]), 0.04, "sine", 0.3, a=0.002, d=0.15, s=0, r=0.15), k * 0.055)
    add("sfx-tickets", "sfx-hint-reveal", master_tail(b), "Hint revealed",
        "A short sparkle of high, quick bell notes.", "Play when a hint or worked solution is shown (FR-019).")

    b = blank(0.8)
    mix(b, plus(kick(0.8), lowpass(noise(0.32), 900) * decay(int(SR * 0.32), 25) * 0.6), 0)
    mix(b, plus(note(midi(nn("G5")), 0.05, "sine", 0.35, d=0.3, s=0, r=0.3), note(midi(nn("D6")), 0.05, "sine", 0.25, d=0.3, s=0, r=0.3)), 0.12)
    add("sfx-tickets", "sfx-ticket-closed", master_tail(b), "Ticket closed",
        "A rubber-stamp thud followed by a small chime.", "Play when a ticket closes after the fix (FR-017); pairs with stamp-resolved.")

    b = blank(0.8)
    mix(b, note(midi(nn("D5")), 0.05, "sine", 0.35, d=0.4, s=0, r=0.35) + note(midi(nn("A5")), 0.05, "sine", 0.2, d=0.4, s=0, r=0.35), 0)
    add("sfx-tickets", "sfx-ticket-resolved-by-change", master_tail(b, 0.7), "Ticket resolved by network change",
        "A single neutral chime: good news, but no points.", "Play when an undiagnosed ticket auto-closes (FR-017a).")

    b = blank(1.0)
    for k in range(3):
        mix(b, note(midi(nn("A5")), 0.12, "square", 0.25, r=0.06), k * 0.28)
        mix(b, note(midi(nn("A5")) * 0.75, 0.12, "square", 0.15, r=0.06), k * 0.28)
    add("sfx-tickets", "sfx-ticket-aging-warning", master_tail(b), "Ticket getting old",
        "Three urgent but soft pulses.", "Play once when any ticket passes about 60 s, as a warning before the 90 s firing limit (FR-020, FR-024).")

    # ===== waves and reviews ======================================================
    b = blank(1.6)
    for k in range(12):
        ring = osc(1250, 0.06, "square") * 0.3 + osc(1250 * 2.7, 0.06, "sine") * 0.15
        mix(b, ring * env(len(ring), 0.002, 0.02, 0.6, 0.02), k * 0.07)
    mix(b, note(1250, 0.05, "sine", 0.3, d=0.6, s=0, r=0.6), 0.84)
    add("sfx-waves", "sfx-wave-start", master_tail(b), "Wave starts (campus bell)",
        "A ringing electric school bell that stops and decays.", "Play when a wave of users starts arriving (FR-023).")

    b = blank(0.6)
    w = bandpass(noise(0.5), 400, 5000) * env(int(SR * 0.5), 0.15, 0.1, 0.6, 0.25) * 0.6
    mix(b, w, 0)
    add("sfx-waves", "sfx-wave-review-open", master_tail(b, 0.7), "Wave review opens",
        "A paper-swoosh, like a report sliding onto a desk.", "Play when the end-of-wave review appears (FR-024).")

    b = blank(1.6)
    for k, (n_, ln) in enumerate((("C5", 0.12), ("E5", 0.12), ("G5", 0.12), ("C6", 0.5))):
        mix(b, note(midi(nn(n_)), ln, "square", 0.25, r=0.2) + note(midi(nn(n_)), ln, "triangle", 0.35, r=0.2), k * 0.13)
    mix(b, note(midi(nn("G4")), 0.6, "triangle", 0.25, r=0.3), 0.39)
    add("sfx-waves", "sfx-wave-passed", master_tail(b), "Wave passed",
        "A short, cheerful four-note fanfare.", "Play when a wave review passes (FR-024).")

    b = blank(2.6)
    for k, (n_, ln) in enumerate((("Bb4", 0.4), ("A4", 0.4), ("Ab4", 0.4))):
        mix(b, note(midi(nn(n_)), ln, "saw", 0.4, a=0.03, r=0.1), k * 0.45)
    slide = np.linspace(midi(nn("G4")), midi(nn("G4")) * 0.94, int(SR * 1.2))
    vibr = slide * (1 + 0.025 * np.sin(2 * np.pi * 6 * np.arange(len(slide)) / SR))
    mix(b, lowpass(osc(vibr, 1.2, "saw"), 1800) * env(len(vibr), 0.04, 0.2, 0.8, 0.4) * 0.45, 1.35)
    add("sfx-waves", "sfx-fired", master_tail(lowpass(b, 2400)), "You're fired",
        "A droopy, brassy descending 'wah-wah-wah-waaah' with a wobbling last note. Comic, not cruel.",
        "Play on the fired review, under the reason text and the Retry level button (FR-024, FR-025).")

    b = blank(3.0)
    fan = [("G4", 0, 0.15), ("C5", 0.15, 0.15), ("E5", 0.3, 0.15), ("G5", 0.45, 0.45), ("E5", 0.95, 0.15), ("G5", 1.1, 0.9)]
    for n_, st, ln in fan:
        mix(b, note(midi(nn(n_)), ln, "square", 0.22, r=0.2) + note(midi(nn(n_)), ln, "saw", 0.18, r=0.2), st)
    for n_ in ("C4", "E4", "G4", "C5"):
        mix(b, note(midi(nn(n_)), 0.9, "organ", 0.18, a=0.05, r=0.6), 1.1)
    mix(b, snare(0.4), 1.1)
    mix(b, kick(0.7), 1.1)
    add("sfx-waves", "sfx-level-complete", master_tail(b), "Level complete",
        "A longer brass-and-organ victory fanfare ending on a held major chord.", "Play with the level summary (FR-026).")

    b = blank(4.0)
    prog = [("C4", "E4", "G4"), ("F4", "A4", "C5"), ("G4", "B4", "D5"), ("C4", "E4", "G4", "C5")]
    for k, ch in enumerate(prog):
        ln = 0.45 if k < 3 else 1.6
        for n_ in ch:
            mix(b, note(midi(nn(n_)), ln, "organ", 0.15, a=0.02, r=0.4), k * 0.5)
    for k, n_ in enumerate(("E5", "F5", "G5", "C6")):
        mix(b, note(midi(nn(n_)), 0.45 if k < 3 else 1.6, "triangle", 0.35, r=0.4, vib=0.004), k * 0.5)
    for k in range(4):
        mix(b, kick(0.5), k * 0.5)
    mix(b, highpass(noise(1.5), 5000) * decay(int(SR * 1.5), 3) * 0.12, 1.5)
    add("sfx-waves", "sfx-session-complete", master_tail(b), "Session complete",
        "A grand I-IV-V-I cadence with a bell-like melody and a cymbal swell.", "Play on the final session summary after Level 3 (FR-026).")

    # ===== alarms =================================================================
    b = blank(2.4)
    for k in range(4):
        f = 600 if k % 2 == 0 else 900
        mix(b, osc(f, 0.6, "square") * env(int(SR * 0.6), 0.01, 0.01, 1.0, 0.01) * 0.35, k * 0.6)
    add("sfx-alarms", "sfx-alarm-noc-klaxon", master(lowpass(b, 3500)), "NOC klaxon (loop)",
        "A two-tone network-operations-centre klaxon alternating 600 Hz and 900 Hz. Loops seamlessly.",
        "Loop during the Level 3 uplink failure until the player pauses or acts. Keep volume low and stop on pause.",
        loop=True, volume=0.5)

    b = blank(1.2)
    for k in range(3):
        mix(b, osc(2900, 0.09, "square") * env(int(SR * 0.09), 0.002, 0.01, 1, 0.005) * 0.3, k * 0.14)
    add("sfx-alarms", "sfx-alarm-pager", master_tail(b, 0.75), "On-call pager",
        "Three sharp, high pager beeps.", "Play when a ticket opens while the player is in another panel, or as the on-call page for an outage.",
        volume=0.5)

    b = blank(3.0)
    for k in range(3):
        sw = np.concatenate([np.linspace(500, 1300, int(SR * 0.8)), np.linspace(1300, 1300, int(SR * 0.2))])
        mix(b, osc(sw, 1.0, "saw") * env(len(sw), 0.02, 0.05, 0.9, 0.05) * 0.3, k * 1.0)
    add("sfx-alarms", "sfx-alarm-server-room", master_tail(lowpass(b, 4000)), "Server-room whoop alarm",
        "Three rising 'whoop' sirens.", "Big outage moment: play once when the student center uplink fails (FR-011).", volume=0.55)

    b = blank(1.6)
    for k in range(4):
        mix(b, note(midi(nn("E5")), 0.12, "sine", 0.4, r=0.05) + note(midi(nn("C5")), 0.12, "sine", 0.4, r=0.05), k * 0.4)
    add("sfx-alarms", "sfx-alarm-satisfaction-low", master_tail(b), "Satisfaction falling",
        "A soft, repeating two-note warning beep.", "Play once when campus satisfaction drops below about 75%, before the 70% firing line (FR-024).",
        volume=0.5)

    n = int(SR * 1.6)
    f = 900 * decay(n, 1.6) + 50
    pd = osc(f, 1.6, "saw") * decay(n, 1.6) * 0.5
    crackle = np.where(RNG.uniform(size=n) > 0.995, RNG.uniform(-1, 1, n), 0) * decay(n, 2) * 0.8
    b = lowpass(pd, 3000) + crackle + lowpass(noise(1.6), 300) * decay(n, 3) * 0.3
    add("sfx-alarms", "sfx-uplink-failure", master_tail(b), "Uplink fails (power-down)",
        "A falling power-down whine with electrical crackles, like equipment dying.", "Play the instant a scheduled uplink failure fires (FR-011).")

    # ===== dial-up modem ==========================================================
    # An original, simplified evocation of a 56k handshake: dial tone, DTMF digits, ringback,
    # answer tone, then screechy training and hiss. Not a recording.
    seq = []
    seq.append(osc(350, 0.7) * 0.25 + osc(440, 0.7) * 0.25)
    dtmf = {"1": (697, 1209), "2": (697, 1336), "3": (697, 1477), "4": (770, 1209), "5": (770, 1336), "6": (770, 1477),
            "7": (852, 1209), "8": (852, 1336), "9": (852, 1477), "0": (941, 1336)}
    for d in "5550142":
        lo, hi = dtmf[d]
        seq.append((osc(lo, 0.09) + osc(hi, 0.09)) * 0.25 * env(int(SR * 0.09), 0.003, 0.0, 1, 0.003))
        seq.append(np.zeros(int(SR * 0.06)))
    seq.append(np.zeros(int(SR * 0.3)))
    seq.append((osc(440, 0.9) + osc(480, 0.9)) * 0.2 * env(int(SR * 0.9), 0.01, 0, 1, 0.01))
    seq.append(np.zeros(int(SR * 0.35)))
    ans = osc(2100, 1.2)
    for k in range(1, 3):  # phase reversals
        i = int(SR * 0.45 * k)
        ans[i:] *= -1
    seq.append(ans * 0.22 * env(len(ans), 0.01, 0, 1, 0.02))
    v8 = np.concatenate([osc(f, 0.11, "square") * 0.18 for f in (1650, 980, 1650, 1180, 1650, 980, 1180, 1650)])
    seq.append(lowpass(v8, 5000))
    n = int(SR * 0.6)
    bong = osc(np.linspace(1050, 1150, n), 0.6) * 0.25 + osc(np.linspace(2250, 2150, n), 0.6) * 0.2
    seq.append(bong * env(n, 0.01, 0.05, 0.8, 0.05))
    n = int(SR * 1.8)
    tt = np.arange(n) / SR
    screech = (np.sin(2 * np.pi * (1800 * tt + 400 * np.sin(2 * np.pi * 13 * tt))) * 0.15
               + bandpass(noise(1.8), 600, 3400) * (0.3 + 0.25 * np.sign(np.sin(2 * np.pi * 7 * tt))))
    seq.append(screech * env(n, 0.02, 0, 1, 0.05))
    n = int(SR * 1.4)
    hiss = bandpass(noise(1.4), 300, 3600) * 0.35 * (0.8 + 0.2 * np.sin(2 * np.pi * 47 * np.arange(n) / SR))
    seq.append(hiss * env(n, 0.01, 0, 1, 0.5))
    add("sfx-retro", "sfx-dialup-modem-handshake", master_tail(np.concatenate(seq) * 0.9, 0.8), "Dial-up modem handshake",
        "A retro modem connecting: dial tone, seven touch-tone digits, ringback, the answer tone, warbly training chirps, a 'bong' and screeching hiss. Synthesised, about 9 seconds.",
        "Comedy beat for the Level 2 briefing ('some students brought routers from home'), a loading screen, or an easter egg for a slow zone.",
        volume=0.6)

    b = blank(0.8)
    mix(b, (osc(350, 0.7) * 0.3 + osc(440, 0.7) * 0.3), 0)
    add("sfx-retro", "sfx-dial-tone", master_tail(b, 0.7), "Phone dial tone",
        "A short telephone dial tone.", "Help-desk phone flavour, e.g. before a voice complaint plays.", volume=0.5)

    b = blank(0.9)
    for k in range(4):
        mix(b, osc(1000, 0.08, "square") * 0.15 + osc(1500, 0.08, "sine") * 0.1, k * 0.2)
    mix(b, bandpass(noise(0.8), 1000, 4000) * 0.06, 0)
    add("sfx-retro", "sfx-printer-ticket", master_tail(b, 0.7), "Dot-matrix ticket printout",
        "A short burst of chattering printer beeps and paper noise.", "Alternative 'ticket opened' cue with a retro help-desk feel.", volume=0.5)

    # ===== voices: users yelling and the Dean =====================================
    def say(words, base, peak, end, rate, gruff=0.05, shift=1.0, vol=0.9):
        return voice(sum((syl(w) for w in words), []), angry_contour(base, peak, end), rate, gruff, shift) * vol

    b = say(["wa-i-fa", "i-so", "slo-o-u"], 220, 340, 300, 8.5, shift=1.15)
    add("voices", "voice-user-complaint-slow", master_tail(b), "User: 'My Wi-Fi is so slow!'",
        "A higher-pitched student voice in exasperated gibberish whose intonation rises at the end. No real words.",
        "Play (at random, rate-limited) when a ticket opens for a slow zone. Keep the ticket text as the real information.",
        volume=0.6)
    b = say(["i-ze", "i-n-te", "ne-tu", "da-u-n"], 180, 300, 330, 7.5, shift=1.08)
    add("voices", "voice-user-complaint-down", master_tail(b), "User: 'Is the internet down?!'",
        "A rising, questioning gibberish complaint ending on a high, indignant note.",
        "Play when users lose service in an uncovered zone or a building with its uplink down.", volume=0.6)
    b = say(["u-gh", "ba-fa-ri-ng", "ma-vi-de-o", "a-ga-i-n"], 120, 170, 105, 7.0, gruff=0.25, shift=0.9)
    add("voices", "voice-user-complaint-buffering", master_tail(b), "User: 'Buffering again...'",
        "A low, grumbling gibberish sigh that falls in pitch at the end.",
        "Play for Video users in congested zones (Level 2).", volume=0.6)
    b = say(["he-e-i", "ha-lo", "ka-n-a-ni", "wa-n", "he-lp"], 240, 380, 360, 10.0, gruff=0.1, shift=1.2)
    add("voices", "voice-user-yell-hey", master_tail(b), "User yelling 'Hey! Can anyone help?!'",
        "A fast, loud, high-pitched gibberish shout.", "Play when a ticket is older than about 60 s.", volume=0.6)
    b = say(["no-o-o", "ma-i-se-i-v"], 200, 420, 180, 6.0, gruff=0.15, shift=1.1)
    add("voices", "voice-user-wail", master_tail(b), "User wailing 'Nooo, my save!'",
        "A long, dramatic gibberish wail that rises and falls.", "Comedy reaction when a building's uplink fails.", volume=0.6)

    crowd = blank(5.0)
    for k in range(12):
        words = [RNG.choice(["ma-ka", "wa-i", "ne-to", "slo-u", "u-gh", "ha-lo", "fa-i", "bo-ku", "ne-ti", "ka-wa"]) for _ in range(5)]
        base = RNG.uniform(110, 260)
        v = say(words, base, base * 1.4, base * 1.1, RNG.uniform(6, 9), gruff=RNG.uniform(0.05, 0.3), shift=RNG.uniform(0.85, 1.2), vol=0.25)
        mix(crowd, v, RNG.uniform(0, 3.0))
    crowd = lowpass(crowd, 3500)
    n = len(crowd)
    seam = int(SR * 0.5)
    crowd[:seam] = crowd[:seam] * np.linspace(0, 1, seam) + crowd[-seam:] * np.linspace(1, 0, seam)
    crowd = crowd[:-seam]
    add("voices", "voice-crowd-grumble-loop", master(crowd, 0.6), "Angry crowd murmur (loop)",
        "Twelve overlapping gibberish voices muttering and grumbling. Crossfaded to loop.",
        "Background bed that fades in as campus satisfaction falls; scale its volume with (100 - satisfaction).",
        loop=True, volume=0.35)

    for name, words, base, peak, end, rate, title, desc, use in (
        ("voice-dean-briefing", ["wel-ko-m", "tu-ka-m-pu-s", "ne-to-wa-k"], 150, 175, 140, 6.5,
         "Dean of IT: briefing", "A calm, mid-pitched gibberish voice: an even, matter-of-fact statement.", "Play when a level briefing opens."),
        ("voice-dean-pleased", ["e-ks-se-le-n-t", "wa-n-de-fu-l"], 150, 230, 200, 7.0,
         "Dean of IT: pleased", "A cheerful gibberish exclamation that rises happily.", "Play on wave passed or level complete."),
        ("voice-dean-hmm", ["hm-m-m", "i-ze-e"], 140, 120, 160, 4.5,
         "Dean of IT: 'Hmm...'", "A slow, doubtful gibberish 'hmm' that ends on a questioning rise.", "Play when satisfaction is near the 70% line."),
        ("voice-dean-fired", ["yu-a", "fa-i-ya-d", "ga-t-a-u-t"], 165, 200, 110, 6.0,
         "Dean of IT: 'You're fired!'", "A stern, emphatic gibberish declaration that drops in pitch at the end.", "Play on the fired review with the dean-of-it-angry portrait."),
    ):
        b = say(words, base, peak, end, rate, gruff=0.08, shift=1.05)
        add("voices", name, master_tail(b), title, desc, use, volume=0.65)

    # ===== music loops ============================================================
    C_, G_, Am, F_ = [48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]

    s = Song(104, 8)
    prog = [C_, G_, Am, F_] * 2
    for bar, ch in enumerate(prog):
        s.put(note(midi(ch[0] - 12), s.spb * 1.8, "triangle", 0.45, r=0.05), bar * 4, 0)
        s.put(note(midi(ch[0] - 12), s.spb * 0.9, "triangle", 0.4, r=0.05), bar * 4 + 2, 0)
        s.put(note(midi(ch[2] - 12), s.spb * 0.9, "triangle", 0.35, r=0.05), bar * 4 + 3, 0)
        for k in range(8):
            s.put(note(midi(ch[k % 3] + 12 + (12 if k in (3, 7) else 0)), s.spb * 0.4, "square", 0.07, d=0.05, s=0.3, r=0.05), bar * 4 + k * 0.5, 0.4 * (-1) ** k)
    s.seq("E5:1 G5:1 C6:1 G5:1 D5:1 G5:1 B5:2 C6:1 B5:0.5 A5:0.5 E5:2 F5:1 A5:1 C6:1 A5:1 "
          "G5:1.5 E5:0.5 C5:1 E5:1 D5:1 B4:1 D5:1 G5:1 A5:1 G5:1 E5:1 C5:1 D5:1 E5:1 C5:2",
          wave="triangle", vol=0.32, vib=0.003)
    s.drums({"k": "x.......x.......", "s": "....x.......x...", "h": "..x...x...x...x."})
    s.echo(0.75)
    add("music", "music-title-theme", master(s.render()), "Title theme (loop)",
        "A bright, friendly chiptune theme at 104 BPM in C major: a triangle melody, plucky arpeggios and a light beat. 8 bars, loops seamlessly.",
        "Title screen and Level 1 briefing.", loop=True, bpm=104, volume=0.45)

    s = Song(88, 8)
    Fm7, Dm7, Bbm7, C7 = [53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]
    for bar, ch in enumerate([Fm7, Dm7, Bbm7, C7] * 2):
        for beat in (0, 1.5, 2.5):
            s.chord(ch, bar * 4 + beat, 1.2 if beat else 1.4, "epiano", 0.11, pan=-0.2, a=0.005, d=0.4, s=0.35, r=0.3)
        s.put(note(midi(ch[0] - 24), s.spb * 1.8, "sine", 0.45, r=0.1), bar * 4)
        s.put(note(midi(ch[2] - 24), s.spb * 1.8, "sine", 0.4, r=0.1), bar * 4 + 2)
    s.seq("R:4 A5:1.5 G5:0.5 F5:2 R:4 E5:1 F5:1 G5:2 R:4 A5:1.5 C6:0.5 A5:2 G5:3 R:1", wave="sine", vol=0.22, vib=0.004, a=0.02)
    s.drums({"z": "x.o.x.o.x.o.x.o.", "k": "x.........x.....", "r": "....x.......x..."}, vol=0.7)
    s.echo(0.75, 0.35, 0.22)
    add("music", "music-build-calm", master(s.render()), "Build phase (loop)",
        "A mellow electric-piano groove at 88 BPM in F major with a soft bass, a shaker and an occasional sine-lead phrase. Unhurried, for thinking.",
        "Plays while paused, between waves, and in the zone table. Thinking time is unlimited, so the music should be too.",
        loop=True, bpm=88, volume=0.4)

    s = Song(128, 8)
    Am_, F2, C2, G2 = [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]
    for bar, ch in enumerate([Am_, F2, C2, G2] * 2):
        for k in range(8):
            s.put(note(midi(ch[0] - 24 + (12 if k % 2 else 0)), s.spb * 0.4, "pulse", 0.28, d=0.05, s=0.5, r=0.03), bar * 4 + k * 0.5, 0)
        for k in range(16):
            s.put(note(midi(ch[k % 3] + 12), s.spb * 0.2, "square", 0.06, d=0.03, s=0.2, r=0.03), bar * 4 + k * 0.25, 0.5 * (-1) ** k)
    s.seq("A5:0.75 A5:0.75 C6:0.5 B5:1 G5:1 A5:0.75 A5:0.75 F5:0.5 E5:2 R:4 R:4 "
          "E6:0.75 D6:0.75 C6:0.5 B5:1 C6:1 A5:0.75 G5:0.75 A5:0.5 E5:2 G5:1 B5:1 D6:2 R:2",
          wave="saw", vol=0.16, a=0.01, vib=0.004, pan=-0.15)
    s.drums({"k": "x...x...x...x...", "s": "....x.......x..x", "h": "x.xxx.xxx.xxx.xx"})
    s.echo(0.75, 0.25, 0.12)
    add("music", "music-wave-rush", master(s.render()), "Wave in progress (loop)",
        "A driving 128 BPM A-minor track with pulsing bass, a sixteenth-note arpeggio and a buzzy lead. Energetic but not frantic.",
        "Plays while a wave is running. Duck or pause it when the game pauses (FR-021).", loop=True, bpm=128, volume=0.4)

    s = Song(116, 8)
    Bb, F3, Gm, Eb = [58, 62, 65], [53, 57, 60], [55, 58, 62], [51, 55, 58]
    for bar, ch in enumerate([Bb, F3, Gm, Eb, Bb, F3, Eb, F3]):
        for k in range(4):
            s.put(note(midi(ch[0] - 24 if k % 2 == 0 else ch[2] - 24), s.spb * 0.8, "triangle", 0.45, r=0.05), bar * 4 + k)
        s.chord(ch, bar * 4 + 1, 0.45, "saw", 0.05, pan=0.3)
        s.chord(ch, bar * 4 + 3, 0.45, "saw", 0.05, pan=0.3)
    s.seq("F5:1.5 F5:0.5 Bb5:1 D6:1 C6:1.5 A5:0.5 F5:2 G5:1 Bb5:1 D6:1 G5:1 Eb6:2 D6:1 C6:1 "
          "D6:1.5 C6:0.5 Bb5:1 F5:1 C6:1.5 Bb5:0.5 A5:2 G5:1 Bb5:1 Eb6:1 G6:1 F6:3 R:1",
          wave="saw", vol=0.22, a=0.03, vib=0.006, pan=-0.1)
    s.drums({"s": "x.ooxoo.x.ooxoxx", "k": "x.......x.......", "H": "........x......."}, vol=0.8)
    s.echo(0.5, 0.25, 0.1)
    add("music", "music-homecoming-march", master(s.render()), "Homecoming march (loop)",
        "A marching-band-style loop at 116 BPM in B-flat major, with a brassy lead, oom-pah bass and snare rolls.",
        "Level 3 'Homecoming' waves and briefing.", loop=True, bpm=116, volume=0.4)

    s = Song(76, 4, tail=3)
    for bar, ch in enumerate([[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]]):
        s.chord(ch, bar * 4, 4, "organ", 0.09, a=0.6, d=0.3, s=0.8, r=1.2)
        s.chord([c + 12 for c in ch[1:]], bar * 4 + 2, 2, "sine", 0.05, pan=0.4, a=0.3, r=1.0)
        s.put(note(midi(ch[0] - 12), s.spb * 3.6, "sine", 0.35, a=0.05, r=0.6), bar * 4)
    s.seq("E5:3 D5:1 C5:3 R:1 A4:3 C5:1 B4:4", wave="sine", vol=0.15, a=0.08, vib=0.004)
    s.echo(1.0, 0.4, 0.25)
    add("music", "music-wave-review", master(s.render()), "Wave review (loop)",
        "A slow, reflective 76 BPM pad in C major with a quiet bass and a short sine melody. Calm, for reading the review.",
        "Wave review and level summary screens (FR-024, FR-026).", loop=True, bpm=76, volume=0.35)

    s = Song(96, 8)
    D_, A_, Bm, G3 = [50, 54, 57], [45, 49, 52], [47, 50, 54], [43, 47, 50]
    for bar, ch in enumerate([D_, A_, Bm, G3] * 2):
        s.chord(ch, bar * 4, 3.9, "organ", 0.1, a=0.05, r=0.3, pan=-0.2)
        for k in range(4):
            s.put(note(midi(ch[0] - 12), s.spb * 0.8, "triangle", 0.4, r=0.05), bar * 4 + k)
        for k in range(8):
            s.put(note(midi(ch[(k * 2) % 3] + 24), s.spb * 0.3, "sine", 0.08, d=0.08, s=0.2, r=0.1), bar * 4 + k * 0.5, 0.4)
    s.seq("F#5:1 A5:1 D6:2 E5:1 A5:1 C#6:2 D6:1 C#6:1 B5:1 F#5:1 G5:1 A5:1 B5:2 "
          "A5:1.5 F#5:0.5 D5:2 E5:1.5 C#5:0.5 A4:2 B4:1 D5:1 F#5:1 B5:1 A5:2 D6:2",
          wave="triangle", vol=0.3, vib=0.004)
    s.drums({"k": "x.......x.......", "s": "....x.......x...", "z": "x.x.x.x.x.x.x.x."}, vol=0.8)
    s.echo(0.75)
    add("music", "music-session-summary", master(s.render()), "Session summary (loop)",
        "A warm, triumphant 96 BPM anthem in D major with organ chords, glockenspiel arpeggios and a singing lead.",
        "Final session summary and credits.", loop=True, bpm=96, volume=0.45)

    # ===== ambience ===============================================================
    n = int(SR * 8)
    amb = lowpass(noise(8), 500) * 0.25 + bandpass(noise(8), 1500, 4000) * 0.03 * (1 + np.sin(2 * np.pi * 0.2 * np.arange(n) / SR))
    for k in range(10):
        chirp_t = RNG.uniform(0.2, 7.2)
        f0 = RNG.uniform(2500, 4200)
        ch = osc(np.linspace(f0, f0 * 1.25, int(SR * 0.08)), 0.08) * env(int(SR * 0.08), 0.01, 0.02, 0.6, 0.03) * 0.06
        mix(amb, np.tile(ch, 2), chirp_t)
    seam = int(SR * 1.0)
    amb[:seam] = amb[:seam] * np.linspace(0, 1, seam) + amb[-seam:] * np.linspace(1, 0, seam)
    amb = amb[:-seam]
    add("ambience", "amb-campus-quad-loop", master(amb, 0.5), "Campus quad ambience (loop)",
        "A soft outdoor bed: distant air, light wind and occasional birdsong. Crossfaded to loop.",
        "Quiet background under the build phase, or alone when music is turned off.", loop=True, volume=0.3)

    n = int(SR * 6)
    tt = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 60 * tt) * 0.25 + np.sin(2 * np.pi * 120 * tt) * 0.15 + np.sin(2 * np.pi * 180 * tt) * 0.05
           + lowpass(noise(6), 1200) * 0.35)
    amb = hum
    for k in range(6):
        mix(amb, highpass(noise(0.01), 3000) * 0.08, RNG.uniform(0, 5.8))
    add("ambience", "amb-server-closet-loop", master(amb, 0.5), "Server closet hum (loop)",
        "Mains hum and fan noise from a network closet, with the occasional relay tick. Loops (6 s, whole-cycle hum).",
        "Background when the uplink or core-switch panel is open.", loop=True, volume=0.25)


if __name__ == "__main__":
    build_registry()
    print(len(SOUNDS), "sounds")
