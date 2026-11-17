p='template.html'; s=open(p).read()
a=s.index('  // ---------- sound and buzz'); b=s.index('  function setMuted(m)')
s=s[:a]+'''%%SYNTH%%
  try { muted = localStorage.getItem("bonepile-muted") === "1"; } catch (_) {}
  // the game's sounds, each shaped by any tweaks saved in the sound lab
  const sfx = {};
  for (const n of Object.keys(SFX)) sfx[n] = () => playSfx(n);
  sfx.coin = i => playSfx("coin", { at: (i || 0) * 0.05 });
'''+s[b:]
old='window.addEventListener("pointerdown", () => { if (!muted) audio(); }, { once: true });'
assert old in s; s=s.replace(old,'window.addEventListener("pointerdown", () => { if (!muted) unlockAudio(); }, { once: true });')
old='      <button id="menuBack" type="button">Back</button>\n'
assert old in s; s=s.replace(old, old+'      <a id="labLink" href="lab.html">Sound lab</a>\n')
old='#menu p, #dailyText { margin: 0; color: var(--line); }'
assert old in s; s=s.replace(old, old+'\n#labLink { font-family: "Press Start 2P", ui-monospace, monospace; font-size: 8px; color: var(--muted); text-decoration: none; padding: 10px; }')
open(p,'w').write(s)
