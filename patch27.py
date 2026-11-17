p='synth.js'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
# --- babble respects the Voice knobs (identical at defaults) ---
rep('''        const n = Math.max(1, Math.min(24, Math.round(opts.syl || +L.syl || 6)));
        const wave = K.wave === "orig" ? L.wave || "pulse25" : K.wave;''','''        const n = Math.max(1, Math.min(24, Math.round(opts.syl || +L.syl || 6) + K.vSyl));
        const wave = K.vVowel !== "orig" ? VOWEL[K.vVowel] : K.wave === "orig" ? L.wave || "pulse25" : K.wave;''')
rep('''          const d = (+L.sylDur || 0.07) * (0.7 + Math.random() * 0.6) * T;
          const m = (+L.base || 48) + K.pitch + Math.round((Math.random() * 2 - 1) * (+L.spread || 5) * W);''','''          const d = (+L.sylDur || 0.07) * (0.7 + Math.random() * 0.6) * T * K.vLen;
          const m = (+L.base || 48) + K.pitch + Math.round((Math.random() * 2 - 1) * (+L.spread || 5) * W * K.vRough) + Math.round(K.vDrift * (n > 1 ? i / (n - 1) : 0));''')
rep('''          chip({ ...common, at: t, wave, notes: [m, m + glide], step: d / 2, dur: d, bend: (Math.random() * 2 - 1) * 3 * W + K.slide,''','''          chip({ ...common, at: t, wave, notes: [m, m + glide], step: d / 2, dur: d, bend: (Math.random() * 2 - 1) * 3 * W + K.slide + K.vContour,''')
rep('''          if (Math.random() < (L.cons === undefined ? 0.5 : +L.cons)) crunch({ ...common, at: t, vol: vol * 0.7 * K.noiseVol, dur: 0.03 * T,''','''          if (Math.random() < (L.cons === undefined ? 0.5 : +L.cons)) crunch({ ...common, at: t, vol: vol * 0.7 * K.noiseVol * K.vBreath, dur: 0.03 * T,''')
rep('''          t += d + (+L.gap || 0.03) * T * Math.random();
        }
        end = Math.max(end, t);
        continue;
      }''','''          t += d + (+L.gap || 0.03) * T * Math.random() * K.vGap;
        }
        end = Math.max(end, t);
        continue;
      }
      if (L.k === "vox") { end = Math.max(end, vox(L, K, common, at, vol)); continue; }''')
# --- vox engine ---
rep('''  function playSfx(name, opts = {}, conf = null) {''','''  // vowels are pulse widths: OO is the soft triangle, EE the thin 12.5% buzz
  const VOWEL = { oo: "triangle", oh: "square", ah: "pulse25", ee: "pulse12" };
  // a voice for laughs, cries and screams: a run of syllables, each sliding up or down, the run
  // drifting in pitch and speeding up or slowing down, with breath, a second voice above and a growl
  function vox(L, K, common, at, vol) {
    const T = K.length, W = K.wobble, n = Math.max(1, Math.min(32, Math.round(+L.syl || 1) + K.vSyl));
    const wave = K.vVowel !== "orig" ? VOWEL[K.vVowel] : K.wave !== "orig" ? K.wave : L.wave || "pulse25";
    const accel = (+L.accel || 0) + K.vRhythm, breath = (+L.breath || 0) * K.vBreath, growl = Math.min(2, (+L.growl || 0) + K.vGrowl);
    const curve = (+L.curve || 1.3) * K.decay / 1.3, atk = (+L.atk || 0) + K.attack;
    const vib = (+L.vib || 0) + K.vib, vibHz = (+L.vibHz || 8) * K.vibHz / 8;
    let t = at, last = at;
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) : 0, sp = Math.max(0.2, 1 + accel * (f - 0.5) * 2);
      const d = (+L.sylDur || 0.1) * T * K.vLen * sp * (1 + (Math.random() * 2 - 1) * 0.15 * W);
      const m = (+L.base || 60) + K.pitch + ((+L.drift || 0) + K.vDrift) * f + (Math.random() * 2 - 1) * (+L.jitter || 0) * W * K.vRough;
      const bend = ((+L.contour || 0) + K.vContour) * (L.alt && i % 2 ? -1 : 1) + K.slide;
      const v = vol * (1 - (+L.fade || 0) * f);
      const c = { ...common, at: t, vol: v, atk, curve, dur: d, step: d, bend, arp: K.arp, arpHz: K.arpHz, vib, vibHz };
      chip({ ...c, wave, notes: [m] });
      if (L.harm) chip({ ...c, wave: wave === "triangle" ? "pulse25" : "pulse12", notes: [m + +L.harm], vol: v * (+L.harmVol || 0.3) });
      if (growl > 0) chip({ ...c, wave: "pulse12", notes: [m - 12], vol: v * growl * 0.8, arp: 1, arpHz: 45 });
      if (breath > 0) {
        crunch({ ...common, at: t, vol: v * breath * 0.9 * K.noiseVol, dur: Math.min(0.05, d * 0.4), rate: 1.8 * Math.pow(2, K.grit), short: K.noise === "short" });
        crunch({ ...common, at: t, vol: v * breath * 0.35 * K.noiseVol, dur: d, rate: 1.1 * Math.pow(2, K.grit), short: K.noise === "short", atk, curve });
      }
      last = t + atk + d;
      t += d + (+L.gap || 0) * T * K.vGap * sp;
    }
    return last;
  }
  function playSfx(name, opts = {}, conf = null) {''')
# --- Voice knobs ---
rep('''    { k: "echo", g: "Space",''','''    { k: "vVowel", g: "Voice", label: "Vowel", choices: ["orig", "oo", "oh", "ah", "ee"], def: "orig" },
    { k: "vSyl", g: "Voice", label: "Syllables", min: -8, max: 16, step: 1, def: 0, rnd: [-2, 6] },
    { k: "vLen", g: "Voice", label: "Syllable length", min: 0.3, max: 3, step: 0.05, def: 1, rnd: [0.6, 1.8] },
    { k: "vGap", g: "Voice", label: "Gap between", min: 0, max: 4, step: 0.1, def: 1, rnd: [0.3, 2] },
    { k: "vRhythm", g: "Voice", label: "Speed up / slow down", min: -0.8, max: 0.8, step: 0.05, def: 0, rnd: [-0.5, 0.5] },
    { k: "vContour", g: "Voice", label: "Each syllable rises / falls", min: -36, max: 36, step: 1, def: 0, rnd: [-12, 12] },
    { k: "vDrift", g: "Voice", label: "Whole run rises / falls", min: -36, max: 36, step: 1, def: 0, rnd: [-12, 12] },
    { k: "vRough", g: "Voice", label: "Wobbly pitch", min: 0, max: 4, step: 0.1, def: 1, rnd: [0.3, 2.5] },
    { k: "vBreath", g: "Voice", label: "Breath", min: 0, max: 3, step: 0.1, def: 1, rnd: [0.2, 2] },
    { k: "vGrowl", g: "Voice", label: "Growl", min: 0, max: 1.5, step: 0.05, def: 0, rnd: [0, 0.8] },
    { k: "echo", g: "Space",''')
# --- voice presets ---
V = lambda **o: o
rep('''    rattle: { name: "Bone rattle",''','''    // voices: laughs, cries and screams
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
    rattle: { name: "Bone rattle",''')
open(p,'w').write(s)

p='lab-template.html'; s=open(p).read()
rep('''  const CHOICE = { orig: "Original", square: "50%", pulse25: "25%", pulse12: "12.5%", triangle: "Soft", long: "Long", short: "Short" };
  const HINT = { wave: "Pulse width: thinner is buzzier.", noise: "Short is the metallic NES loop." };''','''  const CHOICE = { orig: "Original", square: "50%", pulse25: "25%", pulse12: "12.5%", triangle: "Soft", long: "Long", short: "Short", oo: "OO", oh: "OH", ah: "AH", ee: "EE" };
  const HINT = { wave: "Pulse width: thinner is buzzier.", noise: "Short is the metallic NES loop.", vVowel: "Shapes laughs, cries, screams and the skull's voice. Start from a voice above." };
  const hasVoice = () => sfxConf(cur).layers.some(L => L.k === "vox" || L.k === "babble");''')
rep('''    vol: v => Math.round(v * 100) + "%",''','''    vSyl: v => v ? sign(v) : "same", vLen: v => v.toFixed(2) + "x", vGap: v => v.toFixed(1) + "x", vRhythm: v => v ? (v < 0 ? "faster " : "slower ") + Math.round(Math.abs(v) * 100) + "%" : "steady",
    vContour: v => sign(v) + " st", vDrift: v => sign(v) + " st", vRough: v => Math.round(v * 100) + "%", vBreath: v => Math.round(v * 100) + "%", vGrowl: v => v ? Math.round(v * 100) + "%" : "off",
    vol: v => Math.round(v * 100) + "%",''')
rep('''    for (const d of SFX_KNOBS) {
      if (d.g !== group) {''','''    const voice = hasVoice();
    for (const d of SFX_KNOBS) {
      if (d.g === "Voice" && !voice) continue;
      if (d.g !== group) {''')
# preset chips in sections
rep('''  addChip("", "Original");
  for (const id of Object.keys(SFX_PRESETS)) addChip(id, SFX_PRESETS[id].name);''','''  addChip("", "Original");
  const cats = []; for (const id of Object.keys(SFX_PRESETS)) { const c = SFX_PRESETS[id].cat || ""; if (!cats.includes(c)) cats.push(c); }
  for (const c of cats) {
    if (c) { const h = document.createElement("div"); h.className = "cat px"; h.textContent = c.toUpperCase(); pre.append(h); }
    for (const id of Object.keys(SFX_PRESETS)) if ((SFX_PRESETS[id].cat || "") === c) addChip(id, SFX_PRESETS[id].name);
  }''')
rep('''.chips button.on {''','''.chips .cat { flex-basis: 100%; margin: 10px 0 0; font-size: 8px; color: var(--moss); letter-spacing: 0.08em; }
.chips button.on {''')
open(p,'w').write(s)
