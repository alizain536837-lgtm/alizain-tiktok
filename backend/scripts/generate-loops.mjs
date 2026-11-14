// generate-loops.mjs — synthesizes 6 ORIGINAL royalty-free music loops.
// Pure Node.js, zero dependencies. Output: 16-bit PCM WAV, 44.1 kHz, mono.
// Every loop is synthesized from scratch (oscillators + noise + envelopes) —
// no samples, no copyrighted audio, no downloads.
//
// Usage: node scripts/generate-loops.mjs [--out <dir>]
// Default output: <backend>/assets/sounds/*.wav

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const OUT_DIR =
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");

// ---- helpers -------------------------------------------------------------
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
// note names like "C4" -> midi
const N = (name) => {
  const m = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const note = name[0].toUpperCase();
  const sharp = name[1] === "#" ? 1 : 0;
  const oct = parseInt(name[name.length - 1], 10);
  return m[note] + sharp + (oct + 1) * 12;
};
const freq = (name) => midi(N(name));

function makeBuffer(seconds) {
  return new Float32Array(Math.floor(seconds * SR));
}

// Add a pitched tone with a simple ADSR-ish envelope.
function tone(buf, { at, dur, f, type = "sine", amp = 0.3, attack = 0.005, release = 0.08, slideTo = null, detune = 0 }) {
  const start = Math.floor(at * SR);
  const len = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const frac = i / len;
    const fNow = slideTo ? f + (slideTo - f) * frac : f;
    phase += (2 * Math.PI * fNow) / SR;
    let s;
    if (type === "sine") s = Math.sin(phase);
    else if (type === "square") s = Math.sign(Math.sin(phase)) * 0.6;
    else if (type === "saw") s = 2 * ((phase / (2 * Math.PI)) % 1) - 1;
    else if (type === "triangle") s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else s = Math.sin(phase);
    // detuned second voice for warmth
    if (detune) s = (s + Math.sin(phase * (1 + detune))) / 2;
    const env =
      Math.min(1, t / attack) *
      (frac > 1 - release / dur ? Math.max(0, (1 - frac) / (release / dur)) : 1);
    const idx = start + i;
    if (idx < buf.length) buf[idx] += s * amp * env;
  }
}

// Filtered noise burst (hat / snare body / vinyl crackle).
function noise(buf, { at, dur, amp = 0.2, highpass = 0, lowpass = 1 }) {
  const start = Math.floor(at * SR);
  const len = Math.floor(dur * SR);
  let lp = 0;
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const w = (Math.random() * 2 - 1) * amp * (1 - i / len);
    // one-pole lowpass
    lp += lowpass * (w - lp);
    // crude highpass
    hp = highpass * (hp + lp - prev);
    prev = lp;
    const idx = start + i;
    if (idx < buf.length) buf[idx] += highpass ? hp : lp;
  }
}

function kick(buf, at, amp = 0.9) {
  tone(buf, { at, dur: 0.28, f: 150, slideTo: 42, type: "sine", amp, attack: 0.002, release: 0.22 });
}
function snare(buf, at, amp = 0.5) {
  noise(buf, { at, dur: 0.16, amp: amp * 0.9, highpass: 0.35 });
  tone(buf, { at, dur: 0.1, f: 190, type: "triangle", amp: amp * 0.5, attack: 0.001, release: 0.08 });
}
function hat(buf, at, amp = 0.18, open = false) {
  noise(buf, { at, dur: open ? 0.3 : 0.05, amp, highpass: 0.85 });
}
function clap(buf, at, amp = 0.4) {
  for (const d of [0, 0.012, 0.024]) noise(buf, { at: at + d, dur: 0.09, amp: amp * 0.7, highpass: 0.5 });
}

// Schedule a chord (list of note names) as soft pads / plucks.
function chord(buf, at, dur, notes, opts = {}) {
  for (const n of notes) tone(buf, { at, dur, f: freq(n), ...opts });
}

function writeWav(path, buf) {
  // normalize to 0.85 peak
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.85 / peak : 1;
  const data = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) data[i] = Math.max(-32768, Math.min(32767, Math.round(buf[i] * gain * 32767)));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length * 2, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length * 2, 40);
  writeFileSync(path, Buffer.concat([header, Buffer.from(data.buffer)]));
}

// ---- loops ----------------------------------------------------------------
// Each builder returns { seconds, buf }. Durations are whole-bar multiples so
// the loop repeats cleanly.

function upbeatPop() {
  const bpm = 120, beat = 60 / bpm, bar = beat * 4, seconds = bar * 4; // 8s
  const buf = makeBuffer(seconds);
  const prog = [
    ["C4", "E4", "G4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"],
  ];
  for (let b = 0; b < 4; b++) {
    const t0 = b * bar;
    chord(buf, t0, bar * 0.9, prog[b], { type: "triangle", amp: 0.16, attack: 0.01, release: 0.3 });
    for (let q = 0; q < 4; q++) kick(buf, t0 + q * beat, 0.85);
    snare(buf, t0 + beat, 0.45); snare(buf, t0 + 3 * beat, 0.45);
    for (let e = 0; e < 8; e++) hat(buf, t0 + e * beat / 2, e % 2 ? 0.1 : 0.16);
    // sparkle lead: pentatonic riff
    const riff = ["C5", "E5", "G5", "E5", "D5", "E5", "C5", null];
    riff.forEach((n, i) => { if (n) tone(buf, { at: t0 + i * beat / 2, dur: beat / 2.2, f: freq(n), type: "sine", amp: 0.22, attack: 0.005, release: 0.05 }); });
  }
  return { seconds, buf };
}

function chillLofi() {
  const bpm = 72, beat = 60 / bpm, bar = beat * 4, seconds = bar * 3; // 10s
  const buf = makeBuffer(seconds);
  const prog = [
    ["C3", "E3", "G3", "B3"], ["A2", "C3", "E3", "G3"], ["F2", "A2", "C3", "E3"],
  ];
  for (let b = 0; b < 3; b++) {
    const t0 = b * bar;
    chord(buf, t0, bar, prog[b], { type: "sine", amp: 0.11, attack: 0.4, release: 0.8 });
    chord(buf, t0, bar, prog[b].map((n) => n.replace(/[0-9]/, (d) => String(Number(d) + 1))), { type: "triangle", amp: 0.05, attack: 0.4, release: 0.8 });
    kick(buf, t0, 0.55); kick(buf, t0 + 2.5 * beat, 0.45);
    snare(buf, t0 + beat, 0.28); snare(buf, t0 + 3 * beat, 0.28);
    for (let e = 0; e < 8; e++) hat(buf, t0 + e * beat / 2, 0.07);
    // mellow rhodes-ish melody
    const mel = ["E4", null, "G4", "B4", null, "A4", "G4", null];
    mel.forEach((n, i) => { if (n) tone(buf, { at: t0 + i * beat / 2, dur: beat * 0.7, f: freq(n), type: "sine", amp: 0.14, attack: 0.02, release: 0.25 }); });
  }
  // vinyl crackle
  for (let i = 0; i < 220; i++) noise(buf, { at: Math.random() * seconds, dur: 0.004, amp: 0.03, highpass: 0.9 });
  return { seconds, buf };
}

function hipHopBeat() {
  const bpm = 90, beat = 60 / bpm, bar = beat * 4, seconds = bar * 3; // 8s
  const buf = makeBuffer(seconds);
  const bassNotes = ["C2", "C2", "A#1", "G1"];
  for (let b = 0; b < 3; b++) {
    const t0 = b * bar;
    // boom-bap: kick on 1 and 3&, snare on 2 and 4
    kick(buf, t0, 0.95); kick(buf, t0 + 2 * beat + beat / 2, 0.8); kick(buf, t0 + 3.5 * beat, 0.7);
    snare(buf, t0 + beat, 0.55); snare(buf, t0 + 3 * beat, 0.55);
    for (let e = 0; e < 8; e++) hat(buf, t0 + e * beat / 2, e % 2 ? 0.08 : 0.14);
    tone(buf, { at: t0, dur: beat * 1.6, f: freq(bassNotes[b] === "A#1" ? "A#1" : bassNotes[b]), type: "sine", amp: 0.5, attack: 0.01, release: 0.3 });
    // dark minor stab
    chord(buf, t0 + beat / 2, beat / 2, ["C3", "D#3", "G3"], { type: "square", amp: 0.05, attack: 0.005, release: 0.1 });
    chord(buf, t0 + 2.5 * beat, beat / 2, ["C3", "D#3", "G3"], { type: "square", amp: 0.05, attack: 0.005, release: 0.1 });
  }
  return { seconds, buf };
}

function electronicDance() {
  const bpm = 128, beat = 60 / bpm, bar = beat * 4, seconds = bar * 8; // 15s
  const buf = makeBuffer(seconds);
  const prog = [
    ["A1", "A2", "C3", "E3"], ["F1", "F2", "A2", "C3"],
    ["C2", "C3", "E3", "G3"], ["G1", "G2", "B2", "D3"],
  ];
  for (let b = 0; b < 8; b++) {
    const t0 = b * bar;
    const ch = prog[b % 4];
    for (let q = 0; q < 4; q++) kick(buf, t0 + q * beat, 0.9);
    clap(buf, t0 + beat, 0.35); clap(buf, t0 + 3 * beat, 0.35);
    for (let e = 0; e < 8; e++) hat(buf, t0 + e * beat / 2, e % 4 === 2 ? 0.16 : 0.09, e % 4 === 2);
    // driving off-beat bass
    for (let q = 0; q < 4; q++) tone(buf, { at: t0 + q * beat + beat / 2, dur: beat / 2.4, f: freq(ch[0]), type: "saw", amp: 0.16, attack: 0.004, release: 0.06 });
    // bright arp
    const arpNotes = [ch[1], ch[2], ch[3], ch[2]];
    arpNotes.forEach((n, i) => {
      tone(buf, { at: t0 + i * beat, dur: beat / 2, f: freq(n), type: "square", amp: 0.06, attack: 0.004, release: 0.08 });
      tone(buf, { at: t0 + i * beat, dur: beat / 2, f: freq(n) * 2, type: "sine", amp: 0.05, attack: 0.004, release: 0.08 });
    });
  }
  return { seconds, buf };
}

function acousticPluck() {
  const bpm = 100, beat = 60 / bpm, bar = beat * 4, seconds = bar * 4; // 9.6s
  const buf = makeBuffer(seconds);
  const prog = [
    ["C3", "E3", "G3"], ["G2", "B2", "D3"], ["A2", "C3", "E3"], ["F2", "A2", "C3"],
  ];
  for (let b = 0; b < 4; b++) {
    const t0 = b * bar;
    // fingerpicked arpeggio (pluck = fast attack, quick decay triangle+sine)
    const seq = [0, 1, 2, 1, 0, 1, 2, 1];
    seq.forEach((ci, i) => {
      const n = prog[b][ci];
      tone(buf, { at: t0 + i * beat / 2, dur: beat * 0.9, f: freq(n), type: "triangle", amp: 0.24, attack: 0.002, release: 0.35 });
      tone(buf, { at: t0 + i * beat / 2, dur: beat * 0.5, f: freq(n) * 2, type: "sine", amp: 0.08, attack: 0.002, release: 0.2 });
    });
    tone(buf, { at: t0, dur: bar, f: freq(prog[b][0].replace(/[0-9]/, (d) => String(Number(d) - 1))), type: "sine", amp: 0.2, attack: 0.02, release: 0.5 });
    // soft shaker on off-beats
    for (let e = 0; e < 4; e++) noise(buf, { at: t0 + e * beat + beat / 2, dur: 0.08, amp: 0.05, highpass: 0.7 });
  }
  return { seconds, buf };
}

function cinematic() {
  const bpm = 80, beat = 60 / bpm, bar = beat * 4, seconds = bar * 4; // 12s
  const buf = makeBuffer(seconds);
  const prog = [
    ["C3", "E3", "G3", "B3"], ["A2", "C3", "E3", "G3"],
    ["F2", "A2", "C3", "F3"], ["G2", "B2", "D3", "G3"],
  ];
  for (let b = 0; b < 4; b++) {
    const t0 = b * bar;
    chord(buf, t0, bar * 1.05, prog[b], { type: "saw", amp: 0.035, attack: 0.9, release: 1.2, detune: 0.003 });
    chord(buf, t0, bar * 1.05, prog[b].map((n) => n.replace(/[0-9]/, (d) => String(Number(d) + 1))), { type: "sine", amp: 0.06, attack: 0.9, release: 1.2 });
    // slow timpani-like hits on bar 1 and 3
    if (b % 2 === 0) tone(buf, { at: t0, dur: 0.9, f: 65, slideTo: 40, type: "sine", amp: 0.5, attack: 0.01, release: 0.7 });
    // sparse high melody
    const mel = b === 0 ? ["G4", null, null, "E4"] : b === 1 ? ["A4", null, "G4", null] : b === 2 ? ["F4", null, "A4", null] : ["G4", null, null, null];
    mel.forEach((n, i) => { if (n) tone(buf, { at: t0 + i * beat, dur: beat * 1.4, f: freq(n), type: "sine", amp: 0.16, attack: 0.05, release: 0.6 }); });
  }
  return { seconds, buf };
}

const LOOPS = [
  { file: "upbeat-pop.wav", title: "Upbeat Pop", build: upbeatPop },
  { file: "chill-lofi.wav", title: "Chill Lofi", build: chillLofi },
  { file: "hip-hop-beat.wav", title: "Hip-Hop Beat", build: hipHopBeat },
  { file: "electronic-dance.wav", title: "Electronic Dance", build: electronicDance },
  { file: "acoustic-pluck.wav", title: "Acoustic Pluck", build: acousticPluck },
  { file: "cinematic.wav", title: "Cinematic", build: cinematic },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const loop of LOOPS) {
  const { seconds, buf } = loop.build();
  const path = join(OUT_DIR, loop.file);
  writeWav(path, buf);
  console.log(`${loop.file}: ${seconds.toFixed(2)}s -> ${path}`);
}
console.log("Done. 6 original loops written.");
