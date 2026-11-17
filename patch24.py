p='template.html'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(a[:70],s.count(a)); s=s.replace(a,b)
MINI = {
"A":"01110 10001 11111 10001 10001","B":"11110 10001 11110 10001 11110","C":"01111 10000 10000 10000 01111",
"D":"11110 10001 10001 10001 11110","E":"11111 10000 11110 10000 11111","F":"11111 10000 11110 10000 10000",
"G":"01111 10000 10011 10001 01111","H":"10001 10001 11111 10001 10001","I":"11111 00100 00100 00100 11111",
"J":"00111 00010 00010 10010 01100","K":"10010 10100 11000 10100 10010","L":"10000 10000 10000 10000 11111",
"M":"10001 11011 10101 10001 10001","N":"10001 11001 10101 10011 10001","O":"01110 10001 10001 10001 01110",
"P":"11110 10001 11110 10000 10000","Q":"01110 10001 10101 10010 01101","R":"11110 10001 11110 10010 10001",
"S":"01111 10000 01110 00001 11110","T":"11111 00100 00100 00100 00100","U":"10001 10001 10001 10001 01110",
"V":"10001 10001 10001 01010 00100","W":"10001 10001 10101 11011 10001","X":"10001 01010 00100 01010 10001",
"Y":"10001 01010 00100 00100 00100","Z":"11111 00010 00100 01000 11111","#":"01010 11111 01010 11111 01010",
}
js = "  // a 5-row pixel alphabet for thin discs, where the 7-row font would touch the edges\n  const MINI = {" + ", ".join('%s: "%s"' % ('"#"' if k=="#" else k, v.replace(" ","")) for k,v in MINI.items()) + "};\n"
js += '''  function miniText(t, cx, y0) {
    const P = PX, w = t.length * 6 - 1; let x = cx - Math.floor(w / 2) * P;
    for (const ch of t) { const g = MINI[ch]; if (g) for (let i = 0; i < 25; i++) if (g[i] === "1") ctx.fillRect(x + (i % 5) * P, y0 + Math.floor(i / 5) * P, P, P); x += 6 * P; }
  }
  // letters sit centred on the bone face (the bottom row is shadow), with a row of bone above and below
  function discText(t, cx, top, faceRows, big) {
    const P = PX;
    const fs = big && t.length <= 2 && faceRows >= 16 ? 16 * P : t.length <= 2 && faceRows >= 9 ? 8 * P : 0;
    if (!fs && [...t].every(ch => MINI[ch])) { miniText(t, cx, top + Math.floor((faceRows - 5) / 2) * P); return; }
    const f = fs || 8 * P, rows = f / P * 7 / 8;
    ctx.font = `${f}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const m = ctx.measureText ? ctx.measureText("H") : null, asc = m && isFinite(m.actualBoundingBoxAscent) && m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : rows * P;
    ctx.fillText(t, cx, top + Math.max(0, Math.floor((faceRows - rows) / 2)) * P + snap(asc));
  }
'''
rep('''  // Discs are slices of old bone''', js + '''  // Discs are slices of old bone''')
rep('''    const fs = h / P >= 20 ? 16 * P : 8 * P;
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ty = top + snap(ry) + P;''','''    const fs = h / P >= 20 ? 16 * P : 8 * P, faceRows = Math.round(h / P) - 1;
    ctx.font = `${fs}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ty = top + snap(ry) + P;''')
rep('''      else if (d.locked) ctx.fillText(d.faces[0], cx, ty);''','''      else if (d.locked) discText(d.faces[0], cx, top, faceRows, true);''')
rep('''        ctx.font = `${face.length > 2 ? 8 * P : fs}px ${FONT}`;
        ctx.fillText(face, lx, ty);''','''        discText(face, lx, top, faceRows, true);''')
open(p,'w').write(s)
