p='synth.js'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
rep('''      actx = new AC(); master = actx.createGain();''','''      try { actx = new AC({ latencyHint: "interactive" }); } catch (_) { actx = new AC(); }
      master = actx.createGain();''')
rep('''      actx.onstatechange = () => { if (actx.state !== "running") armAudio(); }; // iOS can interrupt it later
    }''','''      actx.onstatechange = () => { if (actx.state !== "running") armAudio(); }; // iOS can interrupt it later
      loadCrush(actx);
    }''')
rep('''  // iOS only starts Web Audio inside a tap, and its ring switch silences Web Audio. So on each tap,
  // until the sound is really running: resume the context, play one silent sample, and loop a silent
  // <audio> tag, which moves the page into "playback" so sound plays even on silent.''','''  // iOS only starts Web Audio inside a tap, and its ring switch silences Web Audio. So on each tap,
  // until the sound is really running: resume the context and play one silent sample. To play on
  // silent, newer iOS takes navigator.audioSession "playback". Only where that's missing do we loop a
  // silent <audio> tag instead, because a playing <audio> tag makes iOS use big audio buffers and
  // every sound then starts noticeably late.
  const hasSession = () => { try { return !!(navigator.audioSession && "type" in navigator.audioSession); } catch (_) { return false; } };''')
rep('''    try { const t = silentTag(); if (t.paused) { const p = t.play(); if (p && p.catch) p.catch(() => {}); } } catch (_) {}''','''    if (!hasSession()) try { const t = silentTag(); if (t.paused) { const p = t.play(); if (p && p.catch) p.catch(() => {}); } } catch (_) {}''')
rep('''    const evs = ["touchend", "pointerup", "click", "keydown"];''','''    const evs = ["touchstart", "touchend", "pointerdown", "pointerup", "click", "keydown"];''')
# worklet crusher
rep('''  // the chain a sound plays through: bit crush and sample-rate drop, then an echo''','''  // the bit crusher runs on the audio thread (an AudioWorklet made from this string), so it adds
  // no delay and doesn't stutter when the game is busy drawing
  let crushOk = false;
  const CRUSH = `registerProcessor("crush", class extends AudioWorkletProcessor {
    constructor(o) { super(); const p = o.processorOptions; this.lv = p.lv; this.hold = p.hold; this.pk = p.pk; this.bits = p.bits; this.n = 0; this.h = 0; this.end = p.end; }
    process(ins, outs) {
      const x = ins[0] && ins[0][0], y = outs[0][0];
      if (x) for (let i = 0; i < y.length; i++) {
        if (this.n++ % this.hold === 0) this.h = this.bits < 16 ? Math.max(-this.pk, Math.min(this.pk, Math.round(x[i] / this.pk * this.lv) / this.lv * this.pk)) : x[i];
        y[i] = this.h;
      }
      return currentTime < this.end;
    }
  });`;
  function loadCrush(a) {
    try {
      if (!a.audioWorklet || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) return;
      const u = URL.createObjectURL(new Blob([CRUSH], { type: "application/javascript" }));
      a.audioWorklet.addModule(u).then(() => { crushOk = true; }, () => {});
    } catch (_) {}
  }
  // the chain a sound plays through: bit crush and sample-rate drop, then an echo''')
rep('''    if ((K.bits < 16 || K.down > 1) && a.createScriptProcessor) {
      const sp''','''    if ((K.bits < 16 || K.down > 1) && crushOk && typeof AudioWorkletNode !== "undefined") {
      try {
        const w = new AudioWorkletNode(a, "crush", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
          processorOptions: { lv: Math.pow(2, K.bits - 1), hold: Math.max(1, Math.round(K.down)), pk: Math.max(0.02, peak), bits: K.bits, end: a.currentTime + 12 } });
        w.connect(out); out = w; nodes.push(w);
        return { out, nodes };
      } catch (_) {}
    }
    if ((K.bits < 16 || K.down > 1) && a.createScriptProcessor) {
      const sp''')
open(p,'w').write(s)
