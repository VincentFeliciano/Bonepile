  // ---------- sound: 8-bit chiptune, all made with the Web Audio API, no files ----------
  // Shared word for word by the game and the sound lab (lab.html), so a sound shaped in the lab
  // plays exactly the same in the game. Like an old console sound chip: pulse channels, a triangle
  // bass and an LFSR noise channel. Pitches step and volume steps down at 60 Hz.
  let actx = null, master = null, muted = false;
  const waves = {}, noiseBufs = {};
  function audio() {
    if (muted) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      actx = new AC(); master = actx.createGain(); master.gain.value = 0.55; master.connect(actx.destination);
      actx.onstatechange = () => { if (actx.state !== "running") armAudio(); }; // iOS can interrupt it later
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  // iOS only starts Web Audio inside a tap, and its ring switch silences Web Audio. So on each tap,
  // until the sound is really running: resume the context, play one silent sample, and loop a silent
  // <audio> tag, which moves the page into "playback" so sound plays even on silent.
  let silent = null, armed = false;
  function silentTag() {
    if (silent) return silent;
    const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer); // half a second of 8 kHz silence
    const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
    let bin = ""; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
    silent = document.createElement("audio"); silent.src = "data:audio/wav;base64," + btoa(bin);
    silent.loop = true; silent.preload = "auto"; silent.setAttribute("playsinline", ""); silent.setAttribute("x-webkit-airplay", "deny");
    return silent;
  }
  function unlockAudio() {
    if (muted) return;
    try { if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback"; } catch (_) {}
    try { const t = silentTag(); if (t.paused) { const p = t.play(); if (p && p.catch) p.catch(() => {}); } } catch (_) {}
    const a = audio(); if (!a) return;
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch (_) {}
    if (a.state !== "running") { try { const r = a.resume(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  }
  function armAudio() {
    if (armed || typeof window === "undefined" || !window.addEventListener) return; armed = true;
    const evs = ["touchend", "pointerup", "click", "keydown"];
    const go = () => {
      unlockAudio();
      if (actx && actx.state === "running") { armed = false; evs.forEach(e => window.removeEventListener(e, go, true)); }
    };
    evs.forEach(e => window.addEventListener(e, go, true));
  }
  function quietAudio(off) { // pause the silent tag while muted or hidden, so iOS isn't left "playing"
    try { if (off) { if (silent) silent.pause(); } else armAudio(); } catch (_) {}
  }
  if (typeof document !== "undefined" && document.addEventListener) document.addEventListener("visibilitychange", () => quietAudio(document.hidden || muted));
  const hz = m => 440 * Math.pow(2, (m - 69) / 12); // MIDI note to frequency
  // pulse wave with a duty cycle (0.5 square, 0.25 and 0.125 the thinner, buzzier chip tones)
  function pulseWave(a, duty) {
    if (waves[duty]) return waves[duty];
    const N = 48, re = new Float32Array(N), im = new Float32Array(N);
    for (let n = 1; n < N; n++) { re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty); }
    return (waves[duty] = a.createPeriodicWave(re, im));
  }
  // 15-bit LFSR noise like the NES: "long" is hiss and grit, "short" is a metallic rattle
  function lfsrBuf(a, short) {
    const key = short ? "s" : "l"; if (noiseBufs[key]) return noiseBufs[key];
    const len = a.sampleRate, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    let r = 1, v = 1; const hold = 4;
    for (let i = 0; i < len; i++) {
      if (i % hold === 0) { const fb = (r & 1) ^ ((r >> (short ? 6 : 1)) & 1); r = (r >> 1) | (fb << 14); v = (r & 1) ? 1 : -1; }
      d[i] = v;
    }
    return (noiseBufs[key] = b);
  }
  // volume envelope: an optional stepped attack, then a stepped decay, one step per 60 Hz frame
  function env(g, t0, vol, dur, atk = 0, curve = 1.3) {
    const up = Math.max(0, Math.round(atk * 60)), steps = Math.max(1, Math.round(dur * 60)), t1 = t0 + up / 60;
    if (up) { g.gain.setValueAtTime(0, t0); for (let i = 1; i < up; i++) g.gain.setValueAtTime(vol * i / up, t0 + i / 60); }
    for (let i = 0; i <= steps; i++) g.gain.setValueAtTime(vol * Math.pow(1 - i / steps, curve), t1 + i / 60);
  }
  const DUTY = { square: 0.5, pulse25: 0.25, pulse12: 0.125 };
  // a chip voice: plays notes (MIDI) one after another, `step` seconds each, with an optional
  // pitch slide, arpeggio (flips up `arp` semitones `arpHz` times a second) and vibrato
  function chip({ at = 0, wave = "square", notes = [60], step = 0.06, vol = 0.15, dur = 0, bend = 0,
                  atk = 0, curve = 1.3, arp = 0, arpHz = 30, vib = 0, vibHz = 8, out = null } = {}) {
    const a = audio(); if (!a) return 0;
    const t0 = a.currentTime + at, total = dur || notes.length * step, len = atk + total, o = a.createOscillator(), g = a.createGain();
    if (wave === "triangle") o.type = "triangle"; else o.setPeriodicWave(pulseWave(a, DUTY[wave] || 0.5));
    const s0 = (notes.length - 1) * step, frames = Math.max(1, Math.round(total * 60));
    const pitch = t => {
      let m = notes[Math.min(notes.length - 1, Math.floor(t / step + 1e-9))];
      if (bend && t > s0) m += bend * (t - s0) * 60 / frames;
      if (arp && Math.floor(t * arpHz + 1e-9) % 2) m += arp;
      if (vib) m += vib * Math.sin(2 * Math.PI * vibHz * t);
      return hz(m);
    };
    notes.forEach((m, i) => o.frequency.setValueAtTime(pitch(i * step), t0 + i * step));
    if (bend || arp || vib) for (let f = 1; f / 60 < len; f++) o.frequency.setValueAtTime(pitch(f / 60), t0 + f / 60);
    env(g, t0, vol, total, atk, curve);
    o.connect(g).connect(out || master); o.start(t0); o.stop(t0 + len + 0.03);
    return at + len;
  }
  // the noise channel: `rate` sets the pitch of the grit (low = rumble, high = hiss), `to` sweeps it
  function crunch({ at = 0, dur = 0.1, vol = 0.3, rate = 1, to = 0, short = false, atk = 0, curve = 1.3, out = null } = {}) {
    const a = audio(); if (!a) return 0;
    const t0 = a.currentTime + at, src = a.createBufferSource(), g = a.createGain(), len = atk + dur;
    const r = v => Math.min(64, Math.max(0.01, v));
    src.buffer = lfsrBuf(a, short); src.loop = true;
    src.playbackRate.setValueAtTime(r(rate), t0);
    if (to) { const frames = Math.max(1, Math.round(len * 60)); for (let f = 1; f <= frames; f++) src.playbackRate.setValueAtTime(r(rate + (to - rate) * f / frames), t0 + f / 60); }
    env(g, t0, vol, dur, atk, curve);
    src.connect(g).connect(out || master); src.start(t0, Math.random() * 0.5); src.stop(t0 + len + 0.03);
    return at + len;
  }
  function buzz(pattern) { if (muted) return; try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {} }

  // ---- every game sound as data: layers of tone (pulse), bass (triangle) and noise voices ----
  // nj and rj are random wiggle: up to nj semitones on the notes, up to rj on the noise rate.
  const SFX = {
    turn: { name: "Disc turn (bone scrape)", layers: [
      { k: "noise", rate: 0.32, rj: 0.12, to: 0.2, dur: 0.07, vol: 0.1 },
      { k: "noise", short: true, rate: 0.9, rj: 0.3, dur: 0.035, vol: 0.035 },
      { k: "bass", notes: [31], nj: 3, dur: 0.04, vol: 0.12 }] },
    land: { name: "Disc lands", layers: [
      { k: "bass", notes: [43], bend: -14, dur: 0.16, vol: 0.5 },
      { k: "noise", rate: 0.18, dur: 0.1, vol: 0.32 }] },
    chomp: { name: "Skull eats a word", layers: [
      { k: "bass", notes: [38], bend: -12, dur: 0.11, vol: 0.55 }, { k: "noise", rate: 0.45, to: 0.2, dur: 0.08, vol: 0.3 },
      { k: "bass", at: 0.15, notes: [38], bend: -12, dur: 0.11, vol: 0.55 }, { k: "noise", at: 0.15, rate: 0.45, to: 0.2, dur: 0.08, vol: 0.3 },
      { k: "tone", at: 0.32, wave: "square", notes: [48, 55, 60], step: 0.04, vol: 0.07 }] },
    coin: { name: "Coin", layers: [{ k: "tone", wave: "square", notes: [83, 88], step: 0.05, dur: 0.16, vol: 0.06 }] },
    refuse: { name: "Skull refuses", layers: [
      { k: "tone", wave: "pulse25", notes: [46, 45], step: 0.1, vol: 0.12 },
      { k: "bass", notes: [34], dur: 0.2, vol: 0.35 }] },
    laugh: { name: "Skull laughs (boss)", layers: [
      ...[64, 62, 60, 57, 53].map((m, i) => ({ k: "tone", at: i * 0.22, wave: "pulse25", notes: [m, m + 12, m, m + 12, m], step: 1 / 30, vol: 0.1 })),
      ...[40, 38, 36, 33, 29].map((m, i) => ({ k: "bass", at: i * 0.22, notes: [m], dur: 0.12, vol: 0.3 }))] },
    smash: { name: "Smash a disc", buzz: [40, 30, 70], layers: [
      { k: "noise", rate: 0.6, to: 0.08, dur: 0.38, vol: 0.5 },
      { k: "bass", notes: [36], bend: -12, dur: 0.3, vol: 0.55 }] },
    curse: { name: "Curse spreads", buzz: 120, layers: [
      { k: "tone", wave: "pulse12", notes: [61, 60, 59, 58, 57, 56, 55, 54], step: 0.06, vol: 0.1 },
      { k: "noise", short: true, rate: 0.5, dur: 0.45, vol: 0.12 }] },
    cleared: { name: "Round cleared", layers: [
      { k: "tone", wave: "square", notes: [67, 72, 76, 79, 84], step: 0.08, dur: 0.7, vol: 0.11 },
      { k: "tone", at: 0.04, wave: "pulse25", notes: [60, 64, 67, 72, 76], step: 0.08, dur: 0.66, vol: 0.06 },
      { k: "bass", notes: [36, 43, 48], step: 0.16, dur: 0.75, vol: 0.4 }] },
    over: { name: "Game over", buzz: [80, 60, 200], layers: [
      { k: "tone", wave: "square", notes: [67, 66, 65, 64, 63, 62, 61, 60, 59, 58, 57, 56, 55], step: 0.08, dur: 1.3, vol: 0.11 },
      { k: "bass", notes: [36, 34, 31, 28, 24], step: 0.22, dur: 1.4, vol: 0.45 },
      { k: "noise", at: 0.9, rate: 0.12, dur: 0.5, vol: 0.25 }] },
    oracle: { name: "Oracle spin", buzz: 30, layers: [
      { k: "tone", wave: "pulse25", notes: [60, 64, 67, 72, 76, 79, 84, 88, 91, 96], step: 0.045, dur: 0.6, vol: 0.08 },
      { k: "tone", at: 0.02, wave: "pulse12", notes: [72, 76, 79, 84, 88, 91, 96, 100], step: 0.045, dur: 0.5, vol: 0.05 }] },
    blood: { name: "Blood sacrifice", buzz: [60, 80, 60, 120, 150], layers: [
      { k: "bass", notes: [36], bend: -6, dur: 0.12, vol: 0.55 }, { k: "bass", at: 0.16, notes: [36], bend: -6, dur: 0.12, vol: 0.55 },
      { k: "noise", at: 0.32, rate: 0.35, to: 0.1, dur: 0.35, vol: 0.4 },
      { k: "tone", at: 0.32, wave: "pulse12", notes: [55, 54, 53, 52, 51, 50], step: 0.05, vol: 0.08 }] },
    charge: { name: "Oracle charge, heart", layers: [{ k: "tone", wave: "square", notes: [72, 76, 79, 84], step: 0.05, dur: 0.35, vol: 0.09 }] },
    scream: { name: "Skull screams (column full)", knobs: { vib: 0.8, vibHz: 13, bits: 5, down: 2 }, layers: [
      { k: "tone", wave: "pulse12", notes: [86], bend: -26, dur: 0.8, vol: 0.1 },
      { k: "tone", at: 0.02, wave: "pulse25", notes: [79], bend: -22, dur: 0.75, vol: 0.06 },
      { k: "noise", rate: 2.5, to: 0.6, dur: 0.7, vol: 0.14 },
      { k: "bass", notes: [33], bend: -5, dur: 0.6, vol: 0.3 }] },
    voice: { name: "Skull voice (babble)", knobs: { bits: 4, down: 3, vib: 0.35, vibHz: 11 }, layers: [
      { k: "babble", wave: "pulse25", base: 45, spread: 6, syl: 6, sylDur: 0.075, gap: 0.03, cons: 0.5, vol: 0.12 },
      { k: "bass", notes: [28], dur: 0.3, vol: 0.12 }] },
    buy: { name: "Buy a relic", layers: [
      { k: "tone", wave: "square", notes: [72, 79], step: 0.08, dur: 0.28, vol: 0.1 },
      { k: "bass", notes: [48], dur: 0.2, vol: 0.35 }] },
  };
  // crunchy starting points the lab can drop onto any sound
  // crunchy starting points the lab can drop onto any sound (layers, plus knobs for the grit)
  const SFX_PRESETS = {
    hit: { name: "Hit", cat: "Basics", knobs: { bits: 5, down: 3 }, layers: [{ k: "noise", rate: 0.9, to: 0.2, dur: 0.12, vol: 0.45 }, { k: "bass", notes: [45], bend: -18, dur: 0.1, vol: 0.4 }] },
    boom: { name: "Explosion", cat: "Basics", knobs: { bits: 4, down: 6 }, layers: [{ k: "noise", rate: 0.5, to: 0.05, dur: 0.7, vol: 0.6 }, { k: "noise", short: true, rate: 0.25, dur: 0.4, vol: 0.2 }, { k: "bass", notes: [33], bend: -12, dur: 0.5, vol: 0.5 }] },
    coin: { name: "Coin", cat: "Basics", knobs: { bits: 6 }, layers: [{ k: "tone", wave: "square", notes: [83, 88], step: 0.06, dur: 0.3, vol: 0.1 }] },
    jump: { name: "Jump", cat: "Basics", knobs: { bits: 6, down: 2 }, layers: [{ k: "tone", wave: "pulse25", notes: [60], bend: 14, dur: 0.22, vol: 0.12 }] },
    blip: { name: "Blip", cat: "Basics", layers: [{ k: "tone", wave: "pulse12", notes: [84], dur: 0.05, vol: 0.1 }] },
    thump: { name: "Bass thump", cat: "Basics", knobs: { bits: 6, down: 2 }, layers: [{ k: "bass", notes: [36], bend: -10, dur: 0.18, vol: 0.6 }, { k: "noise", rate: 0.12, dur: 0.06, vol: 0.25 }] },
    toll: { name: "Crypt bell", cat: "Basics", knobs: { echo: 0.45, echoTime: 0.22, bits: 6 }, layers: [{ k: "tone", wave: "pulse12", notes: [57, 45], step: 0.03, dur: 0.6, vol: 0.12 }, { k: "bass", notes: [33], dur: 0.5, vol: 0.4 }] },
    // smashes, bombs, crashes and spooky sounds
    glass: { name: "Glass smash", cat: "Smashes", knobs: { bits: 6 }, layers: [
      { k: "noise", rate: 3, to: 1.4, dur: 0.3, vol: 0.4 }, { k: "noise", short: true, at: 0.03, rate: 2, dur: 0.12, vol: 0.15 },
      { k: "tone", at: 0.05, wave: "pulse12", notes: [96, 91, 100, 94, 98], step: 0.035, dur: 0.3, vol: 0.05 }] },
    bone: { name: "Bone crack", cat: "Smashes", knobs: { bits: 5, down: 3 }, layers: [
      { k: "noise", short: true, rate: 1.2, dur: 0.05, vol: 0.4 }, { k: "noise", at: 0.03, rate: 0.5, to: 0.2, dur: 0.15, vol: 0.3 },
      { k: "bass", notes: [40], bend: -10, dur: 0.08, vol: 0.4 }] },
    stone: { name: "Stone smash", cat: "Smashes", knobs: { bits: 4, down: 4 }, layers: [
      { k: "noise", rate: 0.4, to: 0.08, dur: 0.45, vol: 0.5 }, { k: "noise", short: true, at: 0.05, rate: 0.8, dur: 0.1, vol: 0.2 },
      { k: "bass", notes: [31], bend: -8, dur: 0.35, vol: 0.55 }] },
    pot: { name: "Clay pot", cat: "Smashes", knobs: { bits: 5, down: 3 }, layers: [
      { k: "noise", rate: 1, to: 0.4, dur: 0.2, vol: 0.4 }, { k: "noise", short: true, at: 0.08, rate: 0.9, dur: 0.06, vol: 0.2 },
      { k: "noise", short: true, at: 0.14, rate: 0.7, dur: 0.05, vol: 0.15 }, { k: "bass", notes: [43], bend: -6, dur: 0.1, vol: 0.3 }] },
    bigboom: { name: "Big bomb", cat: "Bombs", knobs: { bits: 4, down: 6, echo: 0.3 }, layers: [
      { k: "noise", rate: 0.4, to: 0.03, dur: 1.2, vol: 0.6 }, { k: "noise", short: true, at: 0.02, rate: 0.2, dur: 0.5, vol: 0.2 },
      { k: "bass", notes: [28], bend: -14, dur: 1, vol: 0.6 }] },
    grenade: { name: "Grenade", cat: "Bombs", knobs: { bits: 4, down: 5 }, layers: [
      { k: "tone", wave: "pulse12", notes: [84], dur: 0.05, vol: 0.06 },
      { k: "noise", at: 0.08, rate: 0.7, to: 0.06, dur: 0.6, vol: 0.55 }, { k: "bass", at: 0.08, notes: [33], bend: -12, dur: 0.5, vol: 0.5 }] },
    cannon: { name: "Cannon", cat: "Bombs", knobs: { bits: 5, down: 4, echo: 0.4, echoTime: 0.25 }, layers: [
      { k: "bass", notes: [36], bend: -20, dur: 0.25, vol: 0.6 }, { k: "noise", rate: 1, to: 0.1, dur: 0.35, vol: 0.5 }] },
    distant: { name: "Distant blast", cat: "Bombs", knobs: { bits: 5, down: 6, echo: 0.5, echoTime: 0.3, attack: 0.03 }, layers: [
      { k: "noise", rate: 0.2, to: 0.05, dur: 0.9, vol: 0.4 }, { k: "bass", notes: [26], bend: -6, dur: 0.8, vol: 0.4 }] },
    metal: { name: "Metal crash", cat: "Crashes", knobs: { bits: 4, down: 2 }, layers: [
      { k: "noise", short: true, rate: 1.5, to: 0.5, dur: 0.6, vol: 0.4 }, { k: "noise", rate: 0.8, to: 0.2, dur: 0.5, vol: 0.3 },
      { k: "tone", wave: "pulse12", notes: [70, 69], step: 0.25, dur: 0.5, bend: -5, vol: 0.05 }] },
    rubble: { name: "Falling rubble", cat: "Crashes", knobs: { bits: 4, down: 4 }, layers: [
      ...[[0, 0.5, 0.45], [0.09, 0.35, 0.35], [0.2, 0.6, 0.3], [0.33, 0.4, 0.22], [0.5, 0.3, 0.15]].map(([at, rate, vol]) => ({ k: "noise", at, rate, to: rate * 0.5, dur: 0.12, vol })),
      { k: "bass", notes: [31], dur: 0.1, vol: 0.45 }] },
    wood: { name: "Wood crash", cat: "Crashes", knobs: { bits: 5, down: 3 }, layers: [
      { k: "noise", rate: 0.9, to: 0.3, dur: 0.25, vol: 0.45 }, { k: "noise", short: true, at: 0.1, rate: 0.6, dur: 0.1, vol: 0.2 },
      { k: "bass", notes: [45], bend: -15, dur: 0.15, vol: 0.45 }] },
    tumble: { name: "Bones tumble", cat: "Crashes", knobs: { bits: 4, down: 4 }, layers: [
      ...[[0, 0.8], [0.06, 0.65], [0.11, 0.9], [0.19, 0.7], [0.24, 0.85], [0.32, 0.6]].map(([at, rate], i) => ({ k: "noise", short: true, at, rate, rj: 0.2, dur: 0.04, vol: 0.25 - i * 0.025 })),
      { k: "bass", notes: [38], nj: 5, dur: 0.05, vol: 0.2 }] },
    ghost: { name: "Ghost whoosh", cat: "Spooky", knobs: { attack: 0.2, vib: 0.6, vibHz: 5, echo: 0.4, bits: 6 }, layers: [
      { k: "noise", rate: 0.2, to: 0.9, dur: 0.9, vol: 0.2 }, { k: "tone", wave: "triangle", notes: [62], bend: -10, dur: 0.9, vol: 0.07 }] },
    chime: { name: "Cursed chime", cat: "Spooky", knobs: { echo: 0.5, echoTime: 0.28, vib: 0.2, vibHz: 6, bits: 6 }, layers: [
      { k: "tone", wave: "pulse12", notes: [79, 74, 70, 67], step: 0.14, dur: 0.8, vol: 0.08 }] },
    drone: { name: "Crypt drone", cat: "Spooky", knobs: { vib: 0.3, vibHz: 3, attack: 0.25, decay: 0.6, bits: 6, down: 2 }, layers: [
      { k: "bass", notes: [29], dur: 1.6, vol: 0.4 }, { k: "tone", wave: "pulse25", notes: [41], bend: 1, dur: 1.6, vol: 0.05 }] },
    whisper: { name: "Whisper", cat: "Spooky", knobs: { bits: 6, echo: 0.3 }, layers: [
      { k: "noise", rate: 2, to: 1.4, dur: 0.9, vol: 0.12 },
      { k: "babble", wave: "triangle", base: 60, spread: 3, syl: 6, sylDur: 0.06, gap: 0.04, cons: 1, vol: 0.03 }] },
    heartbeat: { name: "Heartbeat", cat: "Spooky", knobs: { bits: 6, down: 2 }, layers: [
      { k: "bass", notes: [33], dur: 0.08, vol: 0.55 }, { k: "bass", at: 0.18, notes: [31], dur: 0.1, vol: 0.45 },
      { k: "bass", at: 0.8, notes: [33], dur: 0.08, vol: 0.5 }, { k: "bass", at: 0.98, notes: [31], dur: 0.1, vol: 0.4 }] },
    door: { name: "Creaky door", cat: "Spooky", knobs: { bits: 5, down: 2, arp: 1, arpHz: 23 }, layers: [
      { k: "tone", wave: "pulse12", notes: [50], bend: 9, dur: 0.8, vol: 0.06 }, { k: "noise", short: true, rate: 0.3, dur: 0.8, vol: 0.05 }] },
    // "ha ha ha": an h of breath then an "ah", with a cadence you can shape
    haSteady: { name: "Ha ha ha", cat: "Ha ha", knobs: { bits: 5, down: 2 }, layers: [
      { k: "vox", wave: "pulse25", base: 57, syl: 6, sylDur: 0.1, gap: 0.09, h: 0.9, hLen: 0.04, harm: 12, harmVol: 0.25, contour: -2, accent: "first", jitter: 0.3, curve: 0.9, vol: 0.13 }] },
    haRoll: { name: "Rolling ha ha", cat: "Ha ha", knobs: { bits: 5, down: 2 }, layers: [
      { k: "vox", wave: "pulse25", base: 62, syl: 10, sylDur: 0.07, gap: 0.045, h: 0.8, hLen: 0.03, accel: -0.4, drift: -6, swing: 0.2, accent: "odd", contour: -2, harm: 12, harmVol: 0.2, curve: 0.9, vol: 0.12 }] },
    haEvil: { name: "Slow evil ha", cat: "Ha ha", knobs: { bits: 4, down: 3, echo: 0.3, echoTime: 0.2 }, layers: [
      { k: "vox", wave: "square", base: 48, syl: 6, sylDur: 0.15, gap: 0.13, h: 1, hLen: 0.05, accel: 0.6, drift: -7, accent: "first", accentSt: 3, growl: 0.4, tail: 2.6, contour: -3, curve: 0.8, vol: 0.13 },
      { k: "bass", notes: [29], dur: 1.6, vol: 0.2 }] },
    haChuckle: { name: "Low chuckle", cat: "Ha ha", knobs: { bits: 5, down: 3 }, layers: [
      { k: "vox", wave: "square", base: 45, syl: 4, sylDur: 0.07, gap: 0.08, h: 0.5, step: -1, growl: 0.2, contour: -2, curve: 1, vol: 0.12 }] },
    haManiac: { name: "Maniac ha", cat: "Ha ha", knobs: { bits: 5, down: 2 }, layers: [
      { k: "vox", wave: "pulse25", base: 64, syl: 14, sylDur: 0.06, gap: 0.03, h: 0.9, hLen: 0.03, accel: -0.5, drift: 10, swing: 0.25, accent: "three", vib: 0.3, vibHz: 12, contour: 2, curve: 0.9, vol: 0.11 }] },
    // voices: laughs, cries and screams
    cackle: { name: "Cackle", cat: "Laughs", knobs: { bits: 5, down: 3 }, layers: [
      { k: "vox", wave: "pulse25", base: 64, syl: 7, sylDur: 0.07, gap: 0.035, contour: -3, drift: -9, jitter: 0.6, harm: 12, harmVol: 0.3, breath: 0.5, fade: 0.3, vol: 0.12 }] },
    giggle: { name: "Giggle", cat: "Laughs", knobs: { bits: 6, down: 2 }, layers: [
      { k: "vox", wave: "pulse12", base: 74, syl: 9, sylDur: 0.045, gap: 0.028, contour: 2, drift: -5, accel: -0.3, jitter: 0.5, breath: 0.4, fade: 0.2, vol: 0.09 }] },
    guffaw: { name: "Boss guffaw", cat: "Laughs", knobs: { bits: 4, down: 3, echo: 0.25 }, layers: [
      { k: "vox", wave: "square", base: 47, syl: 5, sylDur: 0.13, gap: 0.06, contour: -5, drift: -5, growl: 0.6, breath: 0.6, curve: 0.9, vol: 0.13 },
      { k: "bass", notes: [28], dur: 0.9, vol: 0.25 }] },
    madlaugh: { name: "Mad laugh", cat: "Laughs", knobs: { bits: 5, down: 2 }, layers: [
      { k: "vox", wave: "pulse25", base: 60, syl: 12, sylDur: 0.06, gap: 0.02, contour: 4, drift: 12, accel: -0.4, jitter: 1, vib: 0.4, vibHz: 14, harm: 7, harmVol: 0.3, breath: 0.4, vol: 0.11 }] },
    wail: { name: "Wail", cat: "Cries", knobs: { bits: 6, down: 2, echo: 0.35 }, layers: [
      { k: "vox", wave: "pulse25", base: 67, syl: 2, sylDur: 0.55, gap: 0.12, contour: -7, drift: -3, vib: 0.6, vibHz: 6, harm: 12, harmVol: 0.25, breath: 0.3, atk: 0.06, curve: 0.6, vol: 0.11 }] },
    sob: { name: "Sob", cat: "Cries", knobs: { bits: 5, down: 3 }, layers: [
      { k: "vox", wave: "triangle", base: 58, syl: 6, sylDur: 0.12, gap: 0.07, contour: -4, drift: -2, accel: 0.5, jitter: 1.5, vib: 0.3, vibHz: 9, breath: 1, curve: 0.9, vol: 0.13 },
      { k: "noise", at: 1.15, rate: 1.4, to: 2.2, dur: 0.22, vol: 0.12 }] },
    whimper: { name: "Whimper", cat: "Cries", knobs: { bits: 6 }, layers: [
      { k: "vox", wave: "pulse12", base: 71, syl: 4, sylDur: 0.16, gap: 0.09, contour: -5, drift: -1, jitter: 0.4, vib: 0.4, vibHz: 7, breath: 0.5, fade: 0.3, curve: 0.8, vol: 0.08 }] },
    banshee: { name: "Banshee", cat: "Cries", knobs: { bits: 4, down: 4, echo: 0.5, echoTime: 0.25 }, layers: [
      { k: "vox", wave: "pulse25", base: 76, syl: 1, sylDur: 1.2, contour: -14, vib: 0.9, vibHz: 5, harm: 7, harmVol: 0.4, breath: 0.6, atk: 0.15, curve: 0.7, vol: 0.1 }] },
    shriek: { name: "Shriek", cat: "Screams", knobs: { bits: 4, down: 2 }, layers: [
      { k: "vox", wave: "pulse12", base: 88, syl: 1, sylDur: 0.6, contour: -20, vib: 0.8, vibHz: 15, harm: -5, harmVol: 0.4, breath: 1.2, curve: 0.8, vol: 0.1 }] },
    death: { name: "Death scream", cat: "Screams", knobs: { bits: 4, down: 3, echo: 0.3 }, layers: [
      { k: "vox", wave: "pulse25", base: 80, syl: 1, sylDur: 1.1, contour: -30, vib: 1, vibHz: 11, growl: 0.5, breath: 1, fade: 0.3, curve: 0.9, vol: 0.11 },
      { k: "bass", notes: [33], bend: -6, dur: 0.9, vol: 0.3 }] },
    roar: { name: "Roar", cat: "Screams", knobs: { bits: 3, down: 4 }, layers: [
      { k: "vox", wave: "square", base: 42, syl: 1, sylDur: 0.8, contour: -6, growl: 1, breath: 1.4, atk: 0.04, curve: 0.8, vol: 0.14 },
      { k: "noise", rate: 0.25, to: 0.12, dur: 0.8, vol: 0.3 }] },
    howl: { name: "Ghoul howl", cat: "Screams", knobs: { bits: 5, down: 3, echo: 0.45, echoTime: 0.22 }, layers: [
      { k: "vox", wave: "triangle", base: 55, syl: 2, sylDur: 0.5, gap: 0, contour: 9, alt: true, vib: 0.5, vibHz: 6, harm: 12, harmVol: 0.3, breath: 0.4, atk: 0.08, curve: 0.5, vol: 0.14 }] },
    rattle: { name: "Bone rattle", cat: "Basics", knobs: { bits: 4, down: 4 }, layers: [{ k: "noise", short: true, rate: 0.7, dur: 0.05, vol: 0.2 }, { k: "noise", short: true, at: 0.07, rate: 0.6, dur: 0.05, vol: 0.18 }, { k: "noise", short: true, at: 0.13, rate: 0.75, dur: 0.06, vol: 0.15 }, { k: "bass", notes: [40], nj: 4, dur: 0.05, vol: 0.2 }] },
  };
  // the knobs every sound has; at their defaults a sound plays exactly as written above
  const SFX_KNOBS = [
    { k: "vol", g: "Main", label: "Volume", min: 0, max: 2, step: 0.05, def: 1, rnd: [0.7, 1.3] },
    { k: "pitch", g: "Main", label: "Pitch", min: -24, max: 24, step: 1, def: 0, rnd: [-12, 12] },
    { k: "length", g: "Main", label: "Length", min: 0.25, max: 3, step: 0.05, def: 1, rnd: [0.5, 2] },
    { k: "slide", g: "Main", label: "Pitch slide", min: -36, max: 36, step: 1, def: 0, rnd: [-24, 24] },
    { k: "wave", g: "Waves", label: "Lead wave", choices: ["orig", "square", "pulse25", "pulse12", "triangle"], def: "orig" },
    { k: "bassWave", g: "Waves", label: "Bass wave", choices: ["orig", "square", "pulse25", "pulse12"], def: "orig" },
    { k: "noise", g: "Waves", label: "Noise type", choices: ["orig", "long", "short"], def: "orig" },
    { k: "tone", g: "Mix", label: "Lead", min: 0, max: 2, step: 0.05, def: 1, rnd: [0.3, 1.6] },
    { k: "bass", g: "Mix", label: "Bass", min: 0, max: 2, step: 0.05, def: 1, rnd: [0.3, 1.6] },
    { k: "noiseVol", g: "Mix", label: "Noise", min: 0, max: 2, step: 0.05, def: 1, rnd: [0.3, 1.6] },
    { k: "grit", g: "Mix", label: "Noise pitch", min: -3, max: 3, step: 0.1, def: 0, rnd: [-1.5, 1.5] },
    { k: "attack", g: "Shape", label: "Attack", min: 0, max: 0.3, step: 0.01, def: 0, rnd: [0, 0.05] },
    { k: "decay", g: "Shape", label: "Decay", min: 0.3, max: 4, step: 0.1, def: 1.3, rnd: [0.6, 3] },
    { k: "bits", g: "Crunch", label: "Bit depth", min: 1, max: 16, step: 1, def: 16, rnd: [2, 16] },
    { k: "down", g: "Crunch", label: "Sample rate", min: 1, max: 32, step: 1, def: 1, rnd: [1, 12] },
    { k: "arp", g: "Motion", label: "Arpeggio", min: 0, max: 12, step: 1, def: 0, rnd: [0, 12] },
    { k: "arpHz", g: "Motion", label: "Arp speed", min: 4, max: 60, step: 1, def: 30, rnd: [10, 40] },
    { k: "vib", g: "Motion", label: "Vibrato", min: 0, max: 2, step: 0.05, def: 0, rnd: [0, 0.6] },
    { k: "vibHz", g: "Motion", label: "Vibrato speed", min: 1, max: 20, step: 0.5, def: 8, rnd: [4, 14] },
    { k: "vVowel", g: "Voice", label: "Vowel", choices: ["orig", "oo", "oh", "ah", "ee"], def: "orig" },
    { k: "vSyl", g: "Voice", label: "Syllables", min: -8, max: 16, step: 1, def: 0, rnd: [-2, 6] },
    { k: "vLen", g: "Voice", label: "Syllable length", min: 0.3, max: 3, step: 0.05, def: 1, rnd: [0.6, 1.8] },
    { k: "vGap", g: "Voice", label: "Gap between", min: 0, max: 4, step: 0.1, def: 1, rnd: [0.3, 2] },
    { k: "vRhythm", g: "Voice", label: "Speed up / slow down", min: -0.8, max: 0.8, step: 0.05, def: 0, rnd: [-0.5, 0.5] },
    { k: "vContour", g: "Voice", label: "Each syllable rises / falls", min: -36, max: 36, step: 1, def: 0, rnd: [-12, 12] },
    { k: "vDrift", g: "Voice", label: "Whole run rises / falls", min: -36, max: 36, step: 1, def: 0, rnd: [-12, 12] },
    { k: "vRough", g: "Voice", label: "Wobbly pitch", min: 0, max: 4, step: 0.1, def: 1, rnd: [0.3, 2.5] },
    { k: "vBreath", g: "Voice", label: "Breath", min: 0, max: 3, step: 0.1, def: 1, rnd: [0.2, 2] },
    { k: "vGrowl", g: "Voice", label: "Growl", min: 0, max: 1.5, step: 0.05, def: 0, rnd: [0, 0.8] },
    { k: "vTempo", g: "Cadence", label: "Tempo", min: 0.4, max: 2.5, step: 0.05, def: 1, rnd: [0.7, 1.6] },
    { k: "vSwing", g: "Cadence", label: "Swing (long-short)", min: -0.6, max: 0.6, step: 0.05, def: 0, rnd: [-0.3, 0.3] },
    { k: "vAccent", g: "Cadence", label: "Accent", choices: ["orig", "none", "first", "odd", "three", "last"], def: "orig" },
    { k: "vStep", g: "Cadence", label: "Pitch step per syllable", min: -4, max: 4, step: 0.5, def: 0, rnd: [-2, 1] },
    { k: "vH", g: "Cadence", label: "H sound", min: 0, max: 2, step: 0.05, def: 0, rnd: [0, 1.2] },
    { k: "vTail", g: "Cadence", label: "Last syllable length", min: 0.5, max: 5, step: 0.1, def: 1, rnd: [0.8, 3] },
    { k: "echo", g: "Space", label: "Echo", min: 0, max: 0.8, step: 0.05, def: 0, rnd: [0, 0.4] },
    { k: "echoTime", g: "Space", label: "Echo time", min: 0.04, max: 0.5, step: 0.01, def: 0.18, rnd: [0.06, 0.3] },
    { k: "wobble", g: "Space", label: "Variation", min: 0, max: 3, step: 0.1, def: 1, rnd: [0, 2] },
  ];
  const SFX_KEY = "bonepile-sfx";
  let sfxRaw, sfxUser = {};
  function sfxSaved() { // the lab's tweaks, read fresh so a change in the lab shows up in the game
    let raw = null; try { raw = localStorage.getItem(SFX_KEY); } catch (_) {}
    if (raw !== sfxRaw) { sfxRaw = raw; try { const o = raw && JSON.parse(raw); sfxUser = (o && typeof o.sounds === "object" && o.sounds) || {}; } catch (_) { sfxUser = {}; } }
    return sfxUser;
  }
  function sfxKnob(d, v, def = d.def) {
    if (d.choices) return d.choices.includes(v) ? v : def;
    return typeof v === "number" && isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : def;
  }
  const sfxDef = (name, d) => sfxKnob(d, ((SFX[name] && SFX[name].knobs) || {})[d.k]); // a sound's own starting value
  function sfxConf(name) {
    const u = sfxSaved()[name] || {}, knobs = {};
    for (const d of SFX_KNOBS) knobs[d.k] = sfxKnob(d, u[d.k], sfxDef(name, d));
    const layers = Array.isArray(u.layers) && u.layers.length ? u.layers : SFX[name].layers;
    return { knobs, layers };
  }
  // the chain a sound plays through: bit crush and sample-rate drop, then an echo
  function sfxBus(a, K, peak) {
    let out = master; const nodes = [];
    if (K.echo > 0) {
      const dry = a.createGain(), d = a.createDelay(1), fb = a.createGain(), wet = a.createGain();
      d.delayTime.value = K.echoTime; fb.gain.value = K.echo; wet.gain.value = 0.8;
      dry.connect(master); dry.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
      out = dry; nodes.push(dry, d, fb, wet);
    }
    if ((K.bits < 16 || K.down > 1) && a.createScriptProcessor) {
      const sp = a.createScriptProcessor(256, 1, 1), lv = Math.pow(2, K.bits - 1), hold = Math.round(K.down), pk = Math.max(0.02, peak);
      let held = 0, n = 0;
      sp.onaudioprocess = e => {
        const x = e.inputBuffer.getChannelData(0), y = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < x.length; i++) {
          if (n++ % hold === 0) held = K.bits < 16 ? Math.max(-pk, Math.min(pk, Math.round(x[i] / pk * lv) / lv * pk)) : x[i];
          y[i] = held;
        }
      };
      sp.connect(out); out = sp; nodes.push(sp);
    }
    return { out: out === master ? null : out, nodes };
  }
  // vowels are pulse widths: OO is the soft triangle, EE the thin 12.5% buzz
  const VOWEL = { oo: "triangle", oh: "square", ah: "pulse25", ee: "pulse12" };
  // a voice for laughs, cries and screams: a run of syllables, each sliding up or down, the run
  // drifting in pitch and speeding up or slowing down, with breath, a second voice above and a growl
  function vox(L, K, common, at, vol) {
    const T = K.length, W = K.wobble, n = Math.max(1, Math.min(32, Math.round(+L.syl || 1) + K.vSyl));
    const wave = K.vVowel !== "orig" ? VOWEL[K.vVowel] : K.wave !== "orig" ? K.wave : L.wave || "pulse25";
    const accel = (+L.accel || 0) + K.vRhythm, breath = (+L.breath || 0) * K.vBreath, growl = Math.min(2, (+L.growl || 0) + K.vGrowl);
    const curve = (+L.curve || 1.3) * K.decay / 1.3, atk = (+L.atk || 0) + K.attack;
    const vib = (+L.vib || 0) + K.vib, vibHz = (+L.vibHz || 8) * K.vibHz / 8;
    // cadence: tempo, swing (long-short pairs), accents, a pitch step per syllable, the "h" of each "ha"
    const tempo = K.vTempo, swing = Math.min(0.8, (+L.swing || 0) + K.vSwing), stepSt = (+L.step || 0) + K.vStep;
    const accent = K.vAccent !== "orig" ? K.vAccent : L.accent || "none", h = (+L.h || 0) + K.vH, tail = (+L.tail || 1) * K.vTail;
    const hit = i => accent === "first" ? i === 0 : accent === "odd" ? i % 2 === 0 : accent === "three" ? i % 3 === 0 : accent === "last" ? i === n - 1 : false;
    let t = at, last = at;
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) : 0, sp = Math.max(0.2, 1 + accel * (f - 0.5) * 2) / tempo, sw = n > 1 ? (i % 2 ? 1 - swing : 1 + swing) : 1;
      const d = (+L.sylDur || 0.1) * T * K.vLen * sp * (1 + (Math.random() * 2 - 1) * 0.15 * W) * (i === n - 1 ? tail : 1);
      const acc = hit(i);
      const m = (+L.base || 60) + K.pitch + ((+L.drift || 0) + K.vDrift) * f + stepSt * i + (acc ? (+L.accentSt || 2) : 0) + (Math.random() * 2 - 1) * (+L.jitter || 0) * W * K.vRough;
      const bend = ((+L.contour || 0) + K.vContour) * (L.alt && i % 2 ? -1 : 1) + K.slide;
      const v = vol * (1 - (+L.fade || 0) * f) * (acc ? 1.4 : 1);
      const hl = h > 0 ? Math.min(d * 0.5, (+L.hLen || 0.035) * T * K.vLen) : 0;
      if (hl) crunch({ ...common, at: t, vol: v * h * 0.9 * K.noiseVol, dur: hl, rate: 2.4 * Math.pow(2, K.grit), short: K.noise === "short", curve: 0.6 });
      const c = { ...common, at: t + hl * 0.7, vol: v, atk, curve, dur: d, step: d, bend, arp: K.arp, arpHz: K.arpHz, vib, vibHz };
      chip({ ...c, wave, notes: [m] });
      if (L.harm) chip({ ...c, wave: wave === "triangle" ? "pulse25" : "pulse12", notes: [m + +L.harm], vol: v * (+L.harmVol || 0.3) });
      if (growl > 0) chip({ ...c, wave: "pulse12", notes: [m - 12], vol: v * growl * 0.8, arp: 1, arpHz: 45 });
      if (breath > 0) {
        crunch({ ...common, at: t + hl * 0.7, vol: v * breath * 0.9 * K.noiseVol, dur: Math.min(0.05, d * 0.4), rate: 1.8 * Math.pow(2, K.grit), short: K.noise === "short" });
        crunch({ ...common, at: t + hl * 0.7, vol: v * breath * 0.35 * K.noiseVol, dur: d, rate: 1.1 * Math.pow(2, K.grit), short: K.noise === "short", atk, curve });
      }
      last = t + hl * 0.7 + atk + d;
      t += (d + hl * 0.7 + (+L.gap || 0) * T * K.vGap * sp) * sw;
    }
    return last;
  }
  function playSfx(name, opts = {}, conf = null) { // returns how long the sound lasts, in seconds
    const s = SFX[name]; if (!s) return 0;
    if (s.buzz) buzz(s.buzz);
    const a = audio(); if (!a) return 0;
    conf = conf || sfxConf(name);
    const K = conf.knobs, T = K.length, base = opts.at || 0, W = K.wobble, st = Math.pow(2, K.pitch / 12);
    const mix = L => (L.k === "noise" ? K.noiseVol : L.k === "bass" ? K.bass : K.tone) * K.vol;
    const peak = conf.layers.reduce((p, L) => Math.max(p, (+L.vol || 0) * mix(L)), 0);
    const bus = sfxBus(a, K, peak);
    let end = 0;
    for (const L of conf.layers) {
      const at = base + (+L.at || 0) * T, vol = (+L.vol || 0) * mix(L), common = { at, vol, atk: K.attack, curve: K.decay, out: bus.out };
      if (!vol) continue;
      if (L.k === "babble") { // garbled speech: random short syllables with a little grit between them
        const n = Math.max(1, Math.min(24, Math.round(opts.syl || +L.syl || 6) + K.vSyl));
        const wave = K.vVowel !== "orig" ? VOWEL[K.vVowel] : K.wave === "orig" ? L.wave || "pulse25" : K.wave;
        let t = at;
        for (let i = 0; i < n; i++) {
          const d = (+L.sylDur || 0.07) * (0.7 + Math.random() * 0.6) * T * K.vLen;
          const m = (+L.base || 48) + K.pitch + Math.round((Math.random() * 2 - 1) * (+L.spread || 5) * W * K.vRough) + Math.round(K.vDrift * (n > 1 ? i / (n - 1) : 0));
          const glide = Math.random() < 0.5 ? -2 : 3;
          chip({ ...common, at: t, wave, notes: [m, m + glide], step: d / 2, dur: d, bend: (Math.random() * 2 - 1) * 3 * W + K.slide + K.vContour,
            arp: K.arp, arpHz: K.arpHz, vib: K.vib, vibHz: K.vibHz });
          if (Math.random() < (L.cons === undefined ? 0.5 : +L.cons)) crunch({ ...common, at: t, vol: vol * 0.7 * K.noiseVol * K.vBreath, dur: 0.03 * T,
            rate: (1.4 + Math.random()) * Math.pow(2, K.grit), short: K.noise === "orig" ? Math.random() < 0.4 : K.noise === "short" });
          t += d + (+L.gap || 0.03) * T * Math.random() * K.vGap;
        }
        end = Math.max(end, t);
        continue;
      }
      if (L.k === "vox") { end = Math.max(end, vox(L, K, common, at, vol)); continue; }
      if (L.k === "noise") {
        const g = st * Math.pow(2, K.grit), rate = ((+L.rate || 1) + Math.random() * (+L.rj || 0) * W) * g;
        const to = (L.to || K.slide) ? (+L.to || +L.rate || 1) * g * Math.pow(2, K.slide / 12) : 0;
        const short = K.noise === "orig" ? !!L.short : K.noise === "short";
        end = Math.max(end, crunch({ ...common, dur: (+L.dur || 0.1) * T, rate, to, short }));
      } else {
        const lead = L.k !== "bass", nj = +L.nj || 0, j = nj ? Math.floor(Math.random() * nj * W) : 0;
        const notes = (Array.isArray(L.notes) && L.notes.length ? L.notes : [60]).map(m => +m + K.pitch + j);
        const wave = lead ? (K.wave === "orig" ? L.wave || "square" : K.wave) : (K.bassWave === "orig" ? "triangle" : K.bassWave);
        end = Math.max(end, chip({ ...common, wave, notes, step: (+L.step || 0.06) * T, dur: (+L.dur || 0) * T, bend: (+L.bend || 0) + K.slide,
          arp: lead ? K.arp : 0, arpHz: K.arpHz, vib: K.vib, vibHz: K.vibHz }));
      }
    }
    if (bus.nodes.length) {
      const tail = K.echo > 0 ? Math.min(4, K.echoTime * Math.log(0.01) / Math.log(K.echo)) : 0;
      setTimeout(() => bus.nodes.forEach(n => { try { n.disconnect(); } catch (_) {} }), (end - base + tail + 0.4) * 1000 + base * 1000);
    }
    return Math.max(0, end - base);
  }

  // ---------- music: an original dark chiptune loop that builds with the rounds ----------
  // Levels 0 to 4 add parts: a sparse bass, then an arpeggio, drums, the melody, and finally
  // double-time hats and a faster tempo. Boss rounds get their own harsher theme.
  const MUSIC_KEY = "bonepile-music";
  function musicVol() { let v = 0.5; try { const s = localStorage.getItem(MUSIC_KEY); if (s !== null && s !== "" && isFinite(+s)) v = Math.min(1, Math.max(0, +s)); } catch (_) {} return v; }
  const SONGS = {
    crypt: { bpm: 76, perLevel: 7, // D minor: Dm, Bb, C, A
      roots: [38, 34, 36, 33], chords: [[62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64]],
      lead: [[[0, 69, 3], [3, 70, 1], [4, 69, 2], [6, 65, 2], [8, 62, 6], [14, 64, 2]],
             [[0, 65, 3], [3, 67, 1], [4, 65, 2], [6, 62, 2], [8, 70, 4], [12, 69, 4]],
             [[0, 67, 3], [3, 69, 1], [4, 67, 2], [6, 64, 2], [8, 72, 6], [14, 70, 2]],
             [[0, 69, 4], [4, 73, 4], [8, 76, 2], [10, 73, 2], [12, 69, 4]]] },
    boss: { bpm: 118, perLevel: 0, // E phrygian: Em, F, G, F
      roots: [40, 41, 43, 41], chords: [[64, 67, 71], [65, 69, 72], [67, 71, 74], [65, 69, 72]],
      lead: [[[0, 76, 2], [2, 77, 2], [4, 76, 2], [6, 71, 2], [8, 72, 4], [12, 71, 4]],
             [[0, 77, 2], [2, 79, 2], [4, 77, 2], [6, 72, 2], [8, 76, 4], [12, 77, 4]],
             [[0, 79, 2], [2, 81, 2], [4, 79, 2], [6, 74, 2], [8, 77, 3], [11, 76, 1], [12, 74, 4]],
             [[0, 77, 4], [4, 76, 4], [8, 75, 4], [12, 71, 4]]] },
  };
  const mus = { on: false, level: 0, boss: false, timer: 0, step: 0, next: 0, gain: null, vol: -1 };
  function musicStep(n, at, sd) {
    const S = mus.boss ? SONGS.boss : SONGS.crypt, lv = mus.boss ? 4 : mus.level, bar = Math.floor(n / 16) % 4, s = n % 16;
    const r = S.roots[bar], ch = S.chords[bar], o = { out: mus.gain };
    // bass
    if (mus.boss) chip({ ...o, at, wave: "triangle", notes: [s % 4 === 3 ? r + 12 : r], dur: sd * 0.9, vol: 0.32 });
    else if (lv >= 4) chip({ ...o, at, wave: "triangle", notes: [s % 2 ? r + 12 : r], dur: sd * 0.9, vol: 0.3 });
    else if (s === 0 || s === 8 || (lv >= 2 && (s === 6 || s === 14))) chip({ ...o, at, wave: "triangle", notes: [s === 6 || s === 14 ? r + 12 : r], dur: sd * (lv ? 5 : 7), vol: 0.32 });
    // a cold drip in the empty early rounds
    if (lv === 0 && s === 12 && bar % 2) chip({ ...o, at, wave: "pulse12", notes: [ch[2] + 12], dur: sd * 3, vol: 0.03 });
    // arpeggio
    if (lv >= 1 && (lv >= 3 || s % 2 === 0)) chip({ ...o, at, wave: "pulse12", notes: [ch[(s >> (lv >= 3 ? 0 : 1)) % 3] + 12], dur: sd * 0.8, vol: mus.boss ? 0.035 : 0.03 });
    // drums: kick, snare, hats
    if (lv >= 2 && (s === 0 || s === 8 || (lv >= 4 && (s === 10 || (mus.boss && s % 4 === 0)))))
      chip({ ...o, at, wave: "triangle", notes: [36], bend: -14, dur: 0.09, vol: 0.4 });
    if (lv >= 3 && (s === 4 || s === 12)) crunch({ ...o, at, rate: 1.2, to: 0.6, dur: 0.08, vol: 0.12, short: mus.boss });
    if (lv >= 2 && (lv >= 4 || s % 4 === 2)) crunch({ ...o, at, rate: 3.5, dur: 0.02, vol: 0.035 });
    // melody
    if (lv >= 3) for (const [st, m, len] of S.lead[bar]) if (st === s) {
      chip({ ...o, at, wave: "pulse25", notes: [m], dur: sd * len * 0.92, vol: 0.05 });
      if (lv >= 4) chip({ ...o, at: at + 0.01, wave: "pulse12", notes: [m + 12], dur: sd * len * 0.85, vol: 0.022 });
    }
  }
  function musicTick() {
    if (!mus.on) return;
    const a = audio(); if (!a || a.state !== "running") { mus.next = 0; return; }
    if (!mus.gain) { mus.gain = a.createGain(); mus.gain.connect(master); }
    if (mus.step % 16 === 0 || mus.vol <= 0) { mus.vol = musicVol(); mus.gain.gain.setValueAtTime(mus.vol * 0.7, a.currentTime); }
    if (!mus.vol) { mus.next = 0; return; }
    const S = mus.boss ? SONGS.boss : SONGS.crypt, sd = 60 / (S.bpm + S.perLevel * mus.level) / 4;
    if (mus.next < a.currentTime) mus.next = a.currentTime + 0.05;
    while (mus.next < a.currentTime + 0.15) { musicStep(mus.step, mus.next - a.currentTime, sd); mus.next += sd; mus.step++; }
  }
  function musicSet(level, boss) {
    const changed = mus.boss !== !!boss; mus.level = Math.max(0, Math.min(4, level | 0)); mus.boss = !!boss;
    if (changed) mus.step = 0;
  }
  function musicStart() { mus.vol = -1; if (mus.on) return; mus.on = true; mus.step = 0; mus.next = 0; mus.timer = setInterval(musicTick, 25); }
  function musicStop() { mus.on = false; clearInterval(mus.timer); mus.timer = 0; }
