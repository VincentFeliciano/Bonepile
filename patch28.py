p='synth.js'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
rep('''    let t = at, last = at;
    for (let i = 0; i < n; i++) {
      const f = n > 1 ? i / (n - 1) : 0, sp = Math.max(0.2, 1 + accel * (f - 0.5) * 2);
      const d = (+L.sylDur || 0.1) * T * K.vLen * sp * (1 + (Math.random() * 2 - 1) * 0.15 * W);
      const m = (+L.base || 60) + K.pitch + ((+L.drift || 0) + K.vDrift) * f + (Math.random() * 2 - 1) * (+L.jitter || 0) * W * K.vRough;
      const bend = ((+L.contour || 0) + K.vContour) * (L.alt && i % 2 ? -1 : 1) + K.slide;
      const v = vol * (1 - (+L.fade || 0) * f);
      const c = { ...common, at: t, vol: v, atk, curve, dur: d, step: d, bend, arp: K.arp, arpHz: K.arpHz, vib, vibHz };''','''    // cadence: tempo, swing (long-short pairs), accents, a pitch step per syllable, the "h" of each "ha"
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
      const c = { ...common, at: t + hl * 0.7, vol: v, atk, curve, dur: d, step: d, bend, arp: K.arp, arpHz: K.arpHz, vib, vibHz };''')
rep('''      last = t + atk + d;
      t += d + (+L.gap || 0) * T * K.vGap * sp;''','''      last = t + hl * 0.7 + atk + d;
      t += (d + hl * 0.7 + (+L.gap || 0) * T * K.vGap * sp) * sw;''')
rep('''        crunch({ ...common, at: t, vol: v * breath * 0.9 * K.noiseVol, dur: Math.min(0.05, d * 0.4),''','''        crunch({ ...common, at: t + hl * 0.7, vol: v * breath * 0.9 * K.noiseVol, dur: Math.min(0.05, d * 0.4),''')
rep('''        crunch({ ...common, at: t, vol: v * breath * 0.35 * K.noiseVol, dur: d,''','''        crunch({ ...common, at: t + hl * 0.7, vol: v * breath * 0.35 * K.noiseVol, dur: d,''')
rep('''    { k: "echo", g: "Space",''','''    { k: "vTempo", g: "Cadence", label: "Tempo", min: 0.4, max: 2.5, step: 0.05, def: 1, rnd: [0.7, 1.6] },
    { k: "vSwing", g: "Cadence", label: "Swing (long-short)", min: -0.6, max: 0.6, step: 0.05, def: 0, rnd: [-0.3, 0.3] },
    { k: "vAccent", g: "Cadence", label: "Accent", choices: ["orig", "none", "first", "odd", "three", "last"], def: "orig" },
    { k: "vStep", g: "Cadence", label: "Pitch step per syllable", min: -4, max: 4, step: 0.5, def: 0, rnd: [-2, 1] },
    { k: "vH", g: "Cadence", label: "H sound", min: 0, max: 2, step: 0.05, def: 0, rnd: [0, 1.2] },
    { k: "vTail", g: "Cadence", label: "Last syllable length", min: 0.5, max: 5, step: 0.1, def: 1, rnd: [0.8, 3] },
    { k: "echo", g: "Space",''')
rep('''    // voices: laughs, cries and screams''','''    // "ha ha ha": an h of breath then an "ah", with a cadence you can shape
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
    // voices: laughs, cries and screams''')
open(p,'w').write(s)

p='lab-template.html'; s=open(p).read()
rep('''oo: "OO", oh: "OH", ah: "AH", ee: "EE" };''','''oo: "OO", oh: "OH", ah: "AH", ee: "EE", none: "None", first: "First", odd: "Every 2nd", three: "Every 3rd", last: "Last" };''')
rep('''Start from a voice above." };''','''Start from a voice above.", vAccent: "Accented syllables are louder and a little higher." };''')
rep('''    vol: v => Math.round(v * 100) + "%",''','''    vTempo: v => v.toFixed(2) + "x", vSwing: v => v ? (v > 0 ? "long-short " : "short-long ") + Math.round(Math.abs(v) * 100) + "%" : "even", vStep: v => v ? sign(v) + " st" : "off",
    vH: v => v ? Math.round(v * 100) + "%" : "off", vTail: v => v.toFixed(1) + "x",
    vol: v => Math.round(v * 100) + "%",''')
rep('''      if (d.g === "Voice" && !voice) continue;''','''      if ((d.g === "Voice" || d.g === "Cadence") && !voice) continue;''')
open(p,'w').write(s)
