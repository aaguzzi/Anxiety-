#!/usr/bin/env python3
"""Generate the background sound layers for meditations.

Each layer is a 60-second mono loop (32 kHz, 16-bit) that repeats without a seam: noise is built in
the frequency domain, so it is periodic by construction, and every envelope and event wraps around
the loop. Output goes to android/app/src/main/assets/ambience/, which is not committed.

    python3 scripts/make-ambience.py [output_dir]
"""
import os
import sys
import wave

import numpy as np

# Bump when a change here should replace loops that were generated earlier.
VERSION = "3"
SR = 32000
DUR = 60
N = SR * DUR
T = np.arange(N) / SR
FREQS = np.fft.rfftfreq(N, 1 / SR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def band(lo, hi, order=3):
    """Smooth band-pass magnitude response."""
    f = np.maximum(FREQS, 1e-6)
    return 1 / np.sqrt(1 + (lo / f) ** (2 * order)) / np.sqrt(1 + (f / hi) ** (2 * order))


def noise(rng, magnitude):
    """Loopable noise with the given magnitude response, unit variance."""
    spec = magnitude * np.exp(1j * rng.uniform(0, 2 * np.pi, len(FREQS)))
    spec[0] = 0
    x = np.fft.irfft(spec, N)
    return x / np.std(x)


def tilt(exponent):
    return np.maximum(FREQS, 20.0) ** (-exponent)


def lfo(rng, cycles, depth=1.0):
    """Slow wobble made of whole cycles per loop, so it joins up at the ends. Range about -1..1."""
    out = np.zeros(N)
    for c in cycles:
        out += np.sin(2 * np.pi * c * T / DUR + rng.uniform(0, 2 * np.pi))
    return depth * out / len(cycles)


def circular_convolve(x, kernel):
    k = np.zeros(N)
    k[:len(kernel)] = kernel
    return np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(k), N)


def add_wrapped(buf, start, sig):
    """Add a short sound at a sample offset, wrapping past the end back to the start."""
    idx = (start + np.arange(len(sig))) % N
    np.add.at(buf, idx, sig)


def a_weighting(f):
    """How sensitive hearing is at each frequency (the standard A curve), as a gain."""
    f = np.maximum(f, 1e-3)
    return 1.2589 * (12194 ** 2 * f ** 4) / (
        (f ** 2 + 20.6 ** 2) * np.sqrt((f ** 2 + 107.7 ** 2) * (f ** 2 + 737.9 ** 2)) * (f ** 2 + 12194 ** 2))


def normalise(x, level=-27.0, peak=0.9):
    """Scale to a perceived loudness (A-weighted dB below full scale), so that the same volume
    setting sounds about equally loud for a hiss and for a rumble."""
    x = x - np.mean(x)
    power = np.abs(np.fft.rfft(x)) ** 2
    heard = np.sqrt(np.sum(power * a_weighting(FREQS) ** 2) / np.sum(power)) * np.sqrt(np.mean(x ** 2))
    x = x * (10 ** (level / 20) / heard)
    top = np.max(np.abs(x))
    return x * (peak / top) if top > peak else x


# ── Layers ──────────────────────────────────────────────────────────────────────────────────────

def white(rng):
    return normalise(noise(rng, band(40, 11000)))


def pink(rng):
    return normalise(noise(rng, tilt(0.5) * band(30, 12000)))


def brown(rng):
    return normalise(noise(rng, tilt(1.0) * band(25, 8000)), level=-29.0)


def rain(rng):
    body = noise(rng, tilt(0.35) * band(500, 9000)) * (1 + 0.12 * lfo(rng, [3, 7, 11]))
    # Patter: dense tiny impacts shaping a bright noise.
    hits = np.zeros(N)
    pos = rng.integers(0, N, 320 * DUR)
    np.add.at(hits, pos, rng.exponential(1.0, len(pos)))
    patter_env = circular_convolve(hits, np.exp(-np.arange(int(0.02 * SR)) / (0.004 * SR)))
    patter = noise(rng, band(2200, 12000)) * patter_env
    patter /= np.std(patter)
    # Heavier drops: short damped pings.
    drops = np.zeros(N)
    for start in rng.integers(0, N, 7 * DUR):
        f = rng.uniform(1400, 4200)
        n = int(0.06 * SR)
        t = np.arange(n) / SR
        drops_sig = rng.uniform(0.2, 1.0) * np.sin(2 * np.pi * f * t) * np.exp(-t / rng.uniform(0.006, 0.018))
        add_wrapped(drops, start, drops_sig)
    drops /= max(np.std(drops), 1e-9)
    rumble = noise(rng, tilt(0.8) * band(50, 260))
    return normalise(body + 0.55 * patter + 0.10 * drops + 0.25 * rumble)


def ocean(rng):
    # Wave arrivals every 8 to 11 seconds; each swells, breaks, and washes out.
    times, t = [], rng.uniform(0, 3)
    while t < DUR - 4:
        times.append(t)
        t += rng.uniform(8, 11)
    swell = np.zeros(N)
    foam = np.zeros(N)
    for when in times:
        size = rng.uniform(0.6, 1.0)
        dt = (T - when + DUR / 2) % DUR - DUR / 2      # signed, circular time from the break
        rise = np.clip((dt + 4.0) / 4.0, 0, 1) ** 2.2 * (dt <= 0)
        fall = np.exp(-np.clip(dt, 0, None) / 2.6) * (dt > 0)
        swell += size * (rise + fall)
        foam += size * np.exp(-np.clip(dt, 0, None) / 3.8) * (dt > 0) * np.clip(dt / 0.4, 0, 1)
    swell = 0.18 + swell
    low = noise(rng, tilt(0.9) * band(45, 500))
    mid = noise(rng, tilt(0.6) * band(300, 3000))
    hiss = noise(rng, tilt(0.2) * band(2500, 10000))
    return normalise(0.9 * low * swell + 0.8 * mid * swell ** 1.4 + 0.5 * hiss * (0.05 + foam))


def stream(rng):
    flutter = noise(rng, band(0.5, 14, 2))
    base = noise(rng, tilt(0.3) * band(350, 7000)) * (1 + 0.35 * flutter)
    bubbles = np.zeros(N)
    for start in rng.integers(0, N, 45 * DUR):
        n = int(rng.uniform(0.02, 0.07) * SR)
        t = np.arange(n) / SR
        f0 = rng.uniform(450, 1900)
        sweep = f0 * (1 + 0.35 * t / t[-1])
        sig = np.sin(2 * np.pi * np.cumsum(sweep) / SR) * np.exp(-t / (0.35 * t[-1])) * rng.uniform(0.2, 1.0)
        add_wrapped(bubbles, start, sig)
    bubbles /= max(np.std(bubbles), 1e-9)
    return normalise(base + 0.45 * bubbles)


def wind(rng):
    def gust(cycles):
        return np.clip(0.55 + 0.6 * lfo(rng, cycles), 0.05, None) ** 1.6
    low = noise(rng, tilt(0.7) * band(70, 420)) * gust([2, 3, 5])
    mid = noise(rng, tilt(0.4) * band(280, 950, 4)) * gust([3, 4, 7])
    high = noise(rng, tilt(0.3) * band(700, 2400, 4)) * gust([4, 5, 9]) ** 1.5
    return normalise(0.9 * low + 0.8 * mid + 0.35 * high)


def drone(rng):
    # A fifth-and-octave chord on A, each note two slightly detuned sines that slowly beat.
    notes = [(110.0, 1.0), (164.81, 0.55), (220.0, 0.5), (329.63, 0.22), (440.0, 0.12)]
    out = np.zeros(N)
    for freq, amp in notes:
        for detune in (-0.11, 0.13):
            f = round((freq + detune) * DUR) / DUR      # whole cycles per loop
            swell = 0.75 + 0.25 * np.sin(2 * np.pi * rng.integers(1, 5) * T / DUR + rng.uniform(0, 6.28))
            out += amp * swell * np.sin(2 * np.pi * f * T + rng.uniform(0, 6.28))
    air = noise(rng, tilt(0.6) * band(200, 3000))
    return normalise(out / np.std(out) + 0.03 * air, level=-30.0)


def bowls(rng):
    out = np.zeros(N)
    strikes = [(4.0, 220.0), (19.0, 293.66), (34.0, 196.0), (48.0, 261.63)]
    partials = [(1.0, 1.0, 9.0), (2.76, 0.45, 6.0), (5.40, 0.2, 3.5), (8.93, 0.08, 2.0)]
    length = int(26 * SR)
    t = np.arange(length) / SR
    attack = np.clip(t / 0.006, 0, 1)
    # The lowest note is still ringing faintly when the strike's time is up: fade it out over the
    # last two seconds rather than cutting it off, which would tick.
    release = np.clip((length - np.arange(length)) / (2.0 * SR), 0, 1)
    for when, fundamental in strikes:
        sig = np.zeros(length)
        for ratio, amp, decay in partials:
            f = fundamental * ratio
            # Two close modes give the slow shimmer of a real bowl.
            sig += amp * np.exp(-t / decay) * (np.sin(2 * np.pi * f * t) + 0.7 * np.sin(2 * np.pi * (f + 0.6) * t + 1.0))
        add_wrapped(out, int(when * SR), sig * attack * release)
    return normalise(out, level=-28.0)


LAYERS = {
    'white': white, 'pink': pink, 'brown': brown, 'rain': rain, 'ocean': ocean,
    'stream': stream, 'wind': wind, 'drone': drone, 'bowls': bowls,
}


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'android/app/src/main/assets/ambience')
    os.makedirs(out_dir, exist_ok=True)
    stamp = os.path.join(out_dir, 'version.txt')
    current = os.path.exists(stamp) and open(stamp).read().strip() == VERSION
    for i, (name, make) in enumerate(LAYERS.items()):
        path = os.path.join(out_dir, name + '.wav')
        if current and os.path.exists(path):
            continue
        samples = make(np.random.default_rng(1000 + i))
        pcm = np.clip(np.round(samples * 32767), -32768, 32767).astype('<i2')
        with wave.open(path + '.part', 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        os.replace(path + '.part', path)
        print('made', name)
    with open(stamp, 'w') as f:
        f.write(VERSION)


if __name__ == '__main__':
    main()
