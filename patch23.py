p='template.html'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
rep('''    <button id="music" type="button"''','''    <button id="pause" type="button" aria-label="Pause"><svg viewBox="0 0 12 12" width="24" height="24" fill="currentColor" shape-rendering="crispEdges"><rect x="2" y="2" width="3" height="8"/><rect x="7" y="2" width="3" height="8"/></svg></button>
    <button id="music" type="button"''')
rep('''#music { padding: 4px;''','''#pause { padding: 4px; border: none; background: transparent; box-shadow: none; clip-path: none; color: var(--line); line-height: 0; }
#music { padding: 4px;''')
rep('''    <div id="menu" hidden>''','''    <div id="paused" hidden>
      <h2>Paused</h2>
      <p>The skull waits. The discs hold still.</p>
      <button id="resume" type="button">Resume</button>
      <div class="prow"><button id="pSound" type="button">Sound on</button><button id="pMusic" type="button">Music on</button></div>
      <button id="pNew" type="button">New run</button>
      <a class="lab" href="lab.html">Sound lab</a>
    </div>
    <div id="menu" hidden>''')
rep('''#menu h2 {''','''#paused { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #0c1a1c no-repeat 0 0; background-origin: border-box; image-rendering: pixelated; border: 3px solid var(--line); padding: 16px; text-align: center; z-index: 5; }
#paused h2 { margin: 0; font-family: "Press Start 2P", ui-monospace, monospace; font-size: 16px; line-height: 1.5; color: var(--gold); font-weight: normal; }
#paused p { margin: 0; color: var(--line); }
#resume { min-width: 14em; min-height: 52px; }
#paused .prow { display: flex; gap: 10px; }
#paused .lab { font-family: "Press Start 2P", ui-monospace, monospace; font-size: 8px; color: var(--muted); text-decoration: none; padding: 10px; }
#menu h2 {''')
rep('''document.querySelectorAll("button:not(#skull):not(#mute):not(#music):not(#power)")''','''document.querySelectorAll("button:not(#skull):not(#mute):not(#music):not(#pause):not(#power)")''')
rep('''document.querySelectorAll("#over, #shop, #sac, #menu").forEach(p => skin(p, "stone"));''','''document.querySelectorAll("#over, #shop, #sac, #menu, #paused").forEach(p => skin(p, "stone"));''')
rep('''    if (st.over || st.shopOpen || st.sac || st.menu) return;
    if (st.pending && now - st.pending.t >= HILITE_MS) crumblePending(now);''','''    if (st.over || st.shopOpen || st.sac || st.menu || st.paused) return;
    if (st.pending && now - st.pending.t >= HILITE_MS) crumblePending(now);''')
rep('''    if (st.over || st.shopOpen || st.sac || st.menu || e.target.closest("button")) return;''','''    if (st.over || st.shopOpen || st.sac || st.menu || st.paused || e.target.closest("button")) return;''')
rep('''    if (st.over || st.sac || st.menu || st.pending || st.shopOpen || st.checkChain || st.spinning) return;
    const found = findWords(st.stack);''','''    if (st.over || st.sac || st.menu || st.paused || st.pending || st.shopOpen || st.checkChain || st.spinning) return;
    const found = findWords(st.stack);''')
rep('''  function closeMenu() { st.menu = false; $("menu").hidden = true; }''','''  function closeMenu() { st.menu = false; $("menu").hidden = true; }
  // pause: freeze the column and its timers, stop the music
  function pauseShow() {
    $("pSound").textContent = muted ? "Sound off" : "Sound on";
    $("pMusic").textContent = musicVol() > 0 ? "Music on" : "Music off";
  }
  function pauseGame() {
    if (!st || st.over || st.shopOpen || st.sac || st.menu || st.paused) return false;
    st.paused = true; st.pausedAt = performance.now(); drag = null; musicStop();
    pauseShow(); $("paused").hidden = false; reskin();
    return true;
  }
  function resumeGame() {
    if (!st.paused) return;
    const gap = performance.now() - st.pausedAt;
    st.spawnAt += gap; st.lastOffer += gap; if (st.pending) st.pending.t += gap;
    st.paused = false; $("paused").hidden = true; musicStart();
  }''')
rep('''    st.menu = true; drag = null;''','''    if (st.paused) { st.paused = false; $("paused").hidden = true; }
    st.menu = true; drag = null;''')
rep('''    $("sac").hidden = true; $("menu").hidden = true;''','''    $("sac").hidden = true; $("menu").hidden = true; $("paused").hidden = true;''')
rep('''  if (document.addEventListener) document.addEventListener("visibilitychange", () => { if (document.hidden) musicStop(); else if (st && !st.over) musicStart(); });''',
'''  // leaving the app pauses the game; coming back leaves it paused until Resume
  if (document.addEventListener) document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (!pauseGame()) musicStop(); }
    else if (st && !st.over && !st.paused) musicStart();
  });
  $("pause").addEventListener("click", () => { if (st.paused) resumeGame(); else pauseGame(); });
  $("resume").addEventListener("click", resumeGame);
  $("pSound").addEventListener("click", () => { setMuted(!muted); pauseShow(); });
  $("pMusic").addEventListener("click", () => { toggleMusic(); pauseShow(); });
  $("pNew").addEventListener("click", openMenu);''')
open(p,'w').write(s)
