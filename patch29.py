import re
p='synth.js'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
i0 = s.index("const SFX_PRESETS"); head, s = s[:i0], s[i0:]
for k in ["hit","boom","coin","jump","blip","thump","toll","rattle"]:
    s, n = re.subn(r'(\n    %s: \{ name: "[^"]+",)' % k, r'\1 cat: "Basics",', s, count=1); assert n==1, k
s = head + s
rep('''    // "ha ha ha": an h of breath''','''    // smashes, bombs, crashes and spooky sounds
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
    // "ha ha ha": an h of breath''')
open(p,'w').write(s)
