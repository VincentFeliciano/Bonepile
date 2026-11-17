p='template.html'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
rep('window.addEventListener("pointerdown", () => { if (!muted) unlockAudio(); }, { once: true });',
    'armAudio();')
rep('''    muted = m;
    try { localStorage.setItem("bonepile-muted", m ? "1" : "0"); } catch (_) {}''','''    muted = m; quietAudio(m);
    try { localStorage.setItem("bonepile-muted", m ? "1" : "0"); } catch (_) {}''')
# music button
rep('''    <button id="mute" type="button"''','''    <button id="music" type="button" aria-label="Music on" aria-pressed="false"><svg viewBox="0 0 12 12" width="24" height="24" fill="currentColor" shape-rendering="crispEdges"><rect x="6" y="1" width="1" height="8"/><rect x="7" y="1" width="2" height="1"/><rect x="8" y="2" width="2" height="1"/><rect x="9" y="3" width="1" height="2"/><rect x="3" y="7" width="3" height="1"/><rect x="2" y="8" width="5" height="2"/><rect x="3" y="10" width="3" height="1"/><rect class="cross" x="1" y="1" width="1" height="1"/><rect class="cross" x="2" y="2" width="1" height="1"/><rect class="cross" x="3" y="3" width="1" height="1"/><rect class="cross" x="4" y="4" width="1" height="1"/><rect class="cross" x="8" y="8" width="1" height="1"/><rect class="cross" x="9" y="9" width="1" height="1"/><rect class="cross" x="10" y="10" width="1" height="1"/></svg></button>
    <button id="mute" type="button"''')
rep('''#mute .cross { display: none; }''','''#mute .cross { display: none; }
#music { padding: 4px; border: none; background: transparent; box-shadow: none; clip-path: none; color: var(--line); line-height: 0; }
#music .cross { display: none; }
#music.off { color: var(--muted); }
#music.off .cross { display: inline; }''')
rep('document.querySelectorAll("button:not(#skull):not(#mute):not(#power)")','document.querySelectorAll("button:not(#skull):not(#mute):not(#music):not(#power)")')
# sounds glue: speech helper and music toggle
rep('''  sfx.coin = i => playSfx("coin", { at: (i || 0) * 0.05 });
''','''  sfx.coin = i => playSfx("coin", { at: (i || 0) * 0.05 });
  // the skull talks in garbled babble, longer for longer lines
  const babble = (text, at = 0) => playSfx("voice", { at, syl: Math.max(3, Math.min(14, Math.round(text.length / 7))) });
  function speak(text, at = 0) { say(text); babble(text, at); }
  function musicState() {
    const b = $("music"); if (!b || !b.classList) return; const on = musicVol() > 0;
    b.classList.toggle("off", !on); b.setAttribute("aria-pressed", String(!on)); b.setAttribute("aria-label", on ? "Music on" : "Music off");
  }
  function toggleMusic() {
    try {
      const v = musicVol();
      if (v > 0) { localStorage.setItem("bonepile-music-prev", String(v)); localStorage.setItem(MUSIC_KEY, "0"); }
      else localStorage.setItem(MUSIC_KEY, String(+localStorage.getItem("bonepile-music-prev") || 0.5));
    } catch (_) {}
    mus.vol = -1; musicState();
  }
''')
# round start: music + speech
rep('''    if (st.boss) setTimeout(() => laugh(`Boss: ${st.boss.name}. ${st.boss.desc}`), 300);
    else if (n === 1 && st.daily) say(`Daily temple, ${st.daily}. Everyone gets the same discs today.`);
    else say(n === 1 ? `The skull demands ${quotaFor(n)} gold before the column fills.` : `Round ${n}. The skull demands ${quotaFor(n)} gold.`);''','''    musicSet(Math.min(4, (n - 1) >> 1), !!st.boss); musicStart();
    if (st.boss) setTimeout(() => laugh(`Boss: ${st.boss.name}. ${st.boss.desc}`, true), 300);
    else if (n === 1 && st.daily) say(`Daily temple, ${st.daily}. Everyone gets the same discs today.`);
    else speak(n === 1 ? `The skull demands ${quotaFor(n)} gold before the column fills.` : `Round ${n}. The skull demands ${quotaFor(n)} gold.`);''')
rep('''  function laugh(text) {
    sfx.laugh();''','''  function laugh(text, talk = false) {
    if (talk) { babble(text); playSfx("laugh", { at: 0.8 }); } else sfx.laugh();''')
rep('''sacShow(); $("sac").hidden = false; reskin(); sfx.refuse();''','''sacShow(); $("sac").hidden = false; reskin(); sfx.scream(); babble("give me your blood", 0.9);''')
rep('''    st.over = true; st.falling = null; sfx.over();''','''    st.over = true; st.falling = null; sfx.over(); playSfx("laugh", { at: 1.5 }); musicStop();''')
rep('''      say("The skull is not satisfied."); sfx.refuse();''','''      speak("The skull is not satisfied."); sfx.refuse();''')
rep('''  $("mute").addEventListener("click", () => setMuted(!muted));''','''  $("mute").addEventListener("click", () => setMuted(!muted));
  $("music").addEventListener("click", toggleMusic); musicState();
  if (document.addEventListener) document.addEventListener("visibilitychange", () => { if (document.hidden) musicStop(); else if (st && !st.over) musicStart(); });''')
open(p,'w').write(s)
