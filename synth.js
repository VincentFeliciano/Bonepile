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
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  // iOS only lets sound start inside a tap, so play one silent sample on the first touch
  function unlockAudio() {
    const a = audio(); if (!a) return;
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch (_) {}
  }
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
    buy: { name: "Buy a relic", layers: [
      { k: "tone", wave: "square", notes: [72, 79], step: 0.08, dur: 0.28, vol: 0.1 },
      { k: "bass", notes: [48], dur: 0.2, vol: 0.35 }] },
  };
  // crunchy starting points the lab can drop onto any sound
  // crunchy starting points the lab can drop onto any sound (layers, plus knobs for the grit)
  const SFX_PRESETS = {
    hit: { name: "Hit", knobs: { bits: 5, down: 3 }, layers: [{ k: "noise", rate: 0.9, to: 0.2, dur: 0.12, vol: 0.45 }, { k: "bass", notes: [45], bend: -18, dur: 0.1, vol: 0.4 }] },
    boom: { name: "Explosion", knobs: { bits: 4, down: 6 }, layers: [{ k: "noise", rate: 0.5, to: 0.05, dur: 0.7, vol: 0.6 }, { k: "noise", short: true, rate: 0.25, dur: 0.4, vol: 0.2 }, { k: "bass", notes: [33], bend: -12, dur: 0.5, vol: 0.5 }] },
    coin: { name: "Coin", knobs: { bits: 6 }, layers: [{ k: "tone", wave: "square", notes: [83, 88], step: 0.06, dur: 0.3, vol: 0.1 }] },
    jump: { name: "Jump", knobs: { bits: 6, down: 2 }, layers: [{ k: "tone", wave: "pulse25", notes: [60], bend: 14, dur: 0.22, vol: 0.12 }] },
    blip: { name: "Blip", layers: [{ k: "tone", wave: "pulse12", notes: [84], dur: 0.05, vol: 0.1 }] },
    thump: { name: "Bass thump", knobs: { bits: 6, down: 2 }, layers: [{ k: "bass", notes: [36], bend: -10, dur: 0.18, vol: 0.6 }, { k: "noise", rate: 0.12, dur: 0.06, vol: 0.25 }] },
    toll: { name: "Crypt bell", knobs: { echo: 0.45, echoTime: 0.22, bits: 6 }, layers: [{ k: "tone", wave: "pulse12", notes: [57, 45], step: 0.03, dur: 0.6, vol: 0.12 }, { k: "bass", notes: [33], dur: 0.5, vol: 0.4 }] },
    rattle: { name: "Bone rattle", knobs: { bits: 4, down: 4 }, layers: [{ k: "noise", short: true, rate: 0.7, dur: 0.05, vol: 0.2 }, { k: "noise", short: true, at: 0.07, rate: 0.6, dur: 0.05, vol: 0.18 }, { k: "noise", short: true, at: 0.13, rate: 0.75, dur: 0.06, vol: 0.15 }, { k: "bass", notes: [40], nj: 4, dur: 0.05, vol: 0.2 }] },
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
  function sfxKnob(d, v) {
    if (d.choices) return d.choices.includes(v) ? v : d.def;
    return typeof v === "number" && isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.def;
  }
  function sfxConf(name) {
    const u = sfxSaved()[name] || {}, knobs = {};
    for (const d of SFX_KNOBS) knobs[d.k] = sfxKnob(d, u[d.k]);
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
  function playSfx(name, opts = {}, conf = null) {
    const s = SFX[name]; if (!s) return;
    if (s.buzz) buzz(s.buzz);
    const a = audio(); if (!a) return;
    conf = conf || sfxConf(name);
    const K = conf.knobs, T = K.length, base = opts.at || 0, W = K.wobble, st = Math.pow(2, K.pitch / 12);
    const mix = L => (L.k === "noise" ? K.noiseVol : L.k === "bass" ? K.bass : K.tone) * K.vol;
    const peak = conf.layers.reduce((p, L) => Math.max(p, (+L.vol || 0) * mix(L)), 0);
    const bus = sfxBus(a, K, peak);
    let end = 0;
    for (const L of conf.layers) {
      const at = base + (+L.at || 0) * T, vol = (+L.vol || 0) * mix(L), common = { at, vol, atk: K.attack, curve: K.decay, out: bus.out };
      if (!vol) continue;
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
  }
