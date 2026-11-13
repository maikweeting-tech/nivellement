/* Nivellement – Oberfläche */
(function () {
  'use strict';
  var C = window.NivCore, BSP = window.NivBeispiele;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var M = C.fmtM, MM = C.fmtMM, ZW = C.fmtZw, DZ = C.fmtDez;
  var KEY = 'nivellement.v1';

  /* ---------- Speicher ---------- */
  var S = null;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || typeof S !== 'object' || !S.projekte) S = { projekte: {}, aktiv: null, eigeneBem: [], lern: false, tab: 'feldbuch', ue: null };
  S.eigeneBem = S.eigeneBem || [];
  var tSave = null;
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* privat/gesperrt: App funktioniert ohne Speichern */ } }
  function save() { if (P()) P().geaendert = Date.now(); clearTimeout(tSave); tSave = setTimeout(persist, 250); }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function leereZeile() { return { punkt: '', zwR: '', zwV: '', R: '', Z: '', V: '', bem: '' }; }
  var KOPF = [['projekt', 'Projekt'], ['instrument', 'Instrument'], ['datum', 'Datum'], ['wetter', 'Wetter'],
    ['feldbuchfuehrer', 'Feldbuchführer'], ['beobachter', 'Beobachter'], ['bearbeiter', 'Bearbeiter'], ['blatt', 'Blatt']];
  function neuesProjekt(vorlage) {
    var p = vorlage ? clone(vorlage) : {
      kopf: { projekt: 'Neues Nivellement', instrument: '', datum: new Date().toLocaleDateString('de-DE'), wetter: '', feldbuchfuehrer: '', beobachter: '', bearbeiter: '', blatt: '1' },
      HA: '', HEsoll: '', schleife: false, einst: {}, zeilen: [leereZeile(), leereZeile(), leereZeile(), leereZeile(), leereZeile(), leereZeile()]
    };
    p.kopf = p.kopf || {}; p.einst = p.einst || {}; p.zeilen = p.zeilen || [];
    delete p.importWarn;
    p.id = uid(); p.geaendert = Date.now();
    p.abs = p.abs || [{ name: '', bem: 'Fundamentsohle', soll: '', ist: '' }];
    p.absQuelle = p.absQuelle || '';
    S.projekte[p.id] = p; S.aktiv = p.id;
    return p;
  }
  if (!Object.keys(S.projekte).length) { neuesProjekt(BSP.A.projekt); neuesProjekt(BSP.C.projekt); neuesProjekt(BSP.B.projekt); persist(); }
  if (!S.projekte[S.aktiv]) S.aktiv = Object.keys(S.projekte)[0];
  function P() { return S.projekte[S.aktiv]; }
  var R = null;
  function rechne() { R = C.auswerten(P()); return R; }

  /* ---------- Tabs ---------- */
  function zeigeTab(t) {
    S.tab = t; save();
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    document.querySelectorAll('section.tab').forEach(function (s) { s.classList.toggle('on', s.id === 't-' + t); });
    if (t === 'feldbuch') renderFeldbuch();
    if (t === 'skizze') renderSkizze();
    if (t === 'abstecken') renderAbsteck();
    if (t === 'ueben') renderUebung();
    if (t === 'projekte') renderProjekte();
    window.scrollTo(0, 0);
  }
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) zeigeTab(b.dataset.tab); });

  /* ---------- Lernmodus / Erklärung ---------- */
  var lern = $('#lern');
  lern.checked = !!S.lern; document.body.classList.toggle('lern', !!S.lern);
  lern.addEventListener('change', function () { S.lern = lern.checked; document.body.classList.toggle('lern', S.lern); save(); });
  function zeigeErkl(x) {
    if (!x) return;
    $('#dlg-t').textContent = x.titel;
    $('#dlg-b').innerHTML = '<div class="lbl">Formel</div><div class="box">' + esc(x.formel) + '</div>' +
      '<div class="lbl">Werte eingesetzt</div><div class="box">' + esc(x.werte) + '</div>' +
      '<div class="lbl">Ergebnis</div><div class="box res">' + esc(x.ergebnis) + '</div>' +
      (x.note ? '<div class="note">' + esc(x.note) + '</div>' : '');
    var d = $('#dlg');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('#dlg-x').addEventListener('click', function () { $('#dlg').close(); });
  $('#dlg').addEventListener('click', function (e) { if (e.target === $('#dlg')) $('#dlg').close(); });

  /* ---------- Bemerkungsliste ---------- */
  function renderBemListe() {
    var all = C.BEMERKUNGEN.concat(S.eigeneBem.filter(function (b) { return C.BEMERKUNGEN.indexOf(b) < 0; }));
    $('#bemliste').innerHTML = all.map(function (b) { return '<option value="' + esc(b) + '">'; }).join('');
  }
  function merkeBem(v) {
    v = String(v || '').trim();
    if (v && C.BEMERKUNGEN.indexOf(v) < 0 && S.eigeneBem.indexOf(v) < 0) { S.eigeneBem.push(v); renderBemListe(); save(); }
  }

  /* ================= FELDBUCH ================= */
  var COLS = [
    { k: 'punkt', h: 'Punkt', cls: 'c-punkt st', inp: 'text' },
    { k: 'zwR', h: 'Zielweite R', u: '[m]', cls: 'c-zw', inp: 'dec' },
    { k: 'zwV', h: 'Zielweite V', u: '[m]', cls: 'c-zw', inp: 'dec' },
    { k: 'R', h: 'Rückblick R', u: '[m]', cls: 'c-abl', inp: 'dec' },
    { k: 'Z', h: 'Zwischenblick Z', u: '[m]', cls: 'c-abl', inp: 'dec' },
    { k: 'V', h: 'Vorblick V', u: '[m]', cls: 'c-abl', inp: 'dec' },
    { k: 'dh', h: 'Δh', u: '[m]', calc: true },
    { k: 'K', h: 'Korrektion K', u: '[mm]', calc: true, cls: 'k' },
    { k: 'H', h: 'Höhe gemessen', u: '[m ü. NHN]', calc: true },
    { k: 'Hk', h: 'Höhe korrigiert', u: '[m ü. NHN]', calc: true },
    { k: 'bem', h: 'Bemerkung', cls: 'c-bem', inp: 'bem' }
  ];
  function renderFeldbuch() {
    var p = P();
    $('#kopf').innerHTML = KOPF.map(function (k) {
      return '<label class="f">' + k[1] + '<input class="in" data-kopf="' + k[0] + '" value="' + esc(p.kopf[k[0]]) + '" autocomplete="off"></label>';
    }).join('');
    $('#HA').value = p.HA || ''; $('#HEsoll').value = p.HEsoll || ''; $('#schleife').checked = !!p.schleife;
    $('#HEsoll').disabled = !!p.schleife;
    var e = p.einst || {}, d = C.DEFAULT_EINST;
    $('#e-c').value = DZ(Number(e.c !== undefined && e.c !== '' ? e.c : d.c), 1).replace(',0', '');
    $('#e-wKonv').value = e.wKonv || d.wKonv;
    $('#e-maxZw').value = e.maxZw !== undefined ? String(e.maxZw).replace('.', ',') : d.maxZw;
    $('#e-maxDiff').value = e.maxDiff !== undefined ? String(e.maxDiff).replace('.', ',') : d.maxDiff;
    $('#e-maxDoppel').value = e.maxDoppel !== undefined ? String(e.maxDoppel).replace('.', ',') : d.maxDoppel;
    $('#e-gleich').checked = !!e.gleichVerteilen;
    renderTabelle();
  }
  function renderTabelle() {
    var p = P();
    var h = '<thead><tr><th class="n">Nr.<small>Typ</small></th>' + COLS.map(function (c) {
      return '<th class="' + (c.k === 'punkt' ? 'st' : '') + '">' + c.h + (c.u ? '<small>' + c.u + '</small>' : '') + '</th>';
    }).join('') + '<th></th></tr></thead><tbody>';
    p.zeilen.forEach(function (z, i) {
      h += '<tr data-i="' + i + '"><td class="n"><span class="typ" id="t' + i + '"></span>' + (i + 1) + '</td>';
      COLS.forEach(function (c) {
        if (c.calc) { h += '<td class="calc ' + (c.cls || '') + '" id="c' + i + c.k + '"></td>'; return; }
        var attrs = c.inp === 'dec' ? ' inputmode="decimal"' : (c.inp === 'bem' ? ' list="bemliste"' : '');
        h += '<td class="' + c.cls + '"><input class="in" data-f="' + c.k + '" value="' + esc(z[c.k]) + '"' + attrs +
          ' autocomplete="off" enterkeyhint="next" aria-label="' + c.h + ' Zeile ' + (i + 1) + '"></td>';
      });
      h += '<td class="act"><button data-act="ins" title="Zeile darunter einfügen" aria-label="Zeile darunter einfügen">＋</button><button data-act="del" title="Zeile löschen" aria-label="Zeile löschen">✕</button></td></tr>';
    });
    $('#fb').innerHTML = h + '</tbody>';
    update();
  }
  function typLabel(r, i) {
    if (!r) return '';
    if (r.typ === 'start') return 'AP';
    if (r.typ === 'wp') return 'WP';
    if (r.typ === 'z') return 'ZP';
    if (r.typ === 'v') return i === R.sum.lastV ? 'EP' : 'V';
    if (r.typ === 'r') return 'R';
    return '';
  }
  function update() {
    rechne();
    var p = P();
    $('#projname').textContent = p.kopf.projekt || '';
    var bad = {};
    R.eingabe.forEach(function (x) { if (x.row !== null && x.row !== undefined) bad[x.row + ':' + x.feld] = true; });
    $('#HA').classList.toggle('bad', R.eingabe.some(function (x) { return /^H_A/.test(x.text); }));
    $('#HEsoll').classList.toggle('bad', R.eingabe.some(function (x) { return /^H_E/.test(x.text); }));
    R.rows.forEach(function (r, i) {
      var tr = document.querySelector('#fb tr[data-i="' + i + '"]');
      if (!tr) return;
      var set = function (k, txt, key) {
        var td = document.getElementById('c' + i + k);
        td.textContent = txt;
        if (key && R.expl[key] && txt) td.dataset.x = key; else delete td.dataset.x;
      };
      set('dh', r.dh !== null ? M(r.dh, true) : '', 'r' + i + ':dh');
      set('K', r.K !== null ? MM(r.K, true) : '', 'r' + i + ':K');
      set('H', r.H !== null ? M(r.H) : '', 'r' + i + ':H');
      set('Hk', r.Hk !== null ? M(r.Hk) : '', 'r' + i + ':Hk');
      document.getElementById('t' + i).textContent = typLabel(r, i);
      var w = R.zeilenWarn[i] || [];
      tr.classList.toggle('e', w.some(function (x) { return x.art !== 'warn'; }));
      tr.classList.toggle('w', w.length > 0 && !w.some(function (x) { return x.art !== 'warn'; }));
      tr.querySelector('td.n').title = w.map(function (x) { return x.text; }).join('\n');
      tr.querySelectorAll('input[data-f]').forEach(function (inp) { inp.classList.toggle('bad', !!bad[i + ':' + inp.dataset.f]); });
    });
    renderMeldungen();
    renderAuswertung();
  }
  function renderMeldungen() {
    var h = '';
    R.eingabe.forEach(function (x) { h += '<div class="msg err"' + (x.row !== null && x.row !== undefined ? ' data-row="' + x.row + '"' : '') + '>Eingabe: ' + esc(x.text) + '</div>'; });
    R.plaus.forEach(function (x) { h += '<div class="msg err" data-row="' + x.row + '">Plausibilität: ' + esc(x.text) + '</div>'; });
    R.warn.forEach(function (x) { h += '<div class="msg warn" data-row="' + x.row + '">' + esc(x.text) + '</div>'; });
    R.hinweise.forEach(function (x) { h += '<div class="msg info">' + esc(x) + '</div>'; });
    if (R.sum.probe === true) h += '<div class="msg ok">Rechenprobe o.k.: ΣR − ΣV = ΣΔh = H_E − H_A, Rechenweg 1 = Rechenweg 2 in jeder Zeile.</div>';
    if (R.sum.probe === false) h += '<div class="msg err">Rechenprobe NICHT erfüllt.</div>';
    if (R.aus.verteilt) h += '<div class="msg ok">Widerspruch verteilt (' + (R.aus.ersatz ? 'Ersatzverfahren: gleichmäßig je Aufstellung' : 'proportional zu den Strecken') + '), ΣK = ' + MM(R.aus.sumK, true) + ' mm ' + (R.aus.probeK ? '✓' : '✗') + '.</div>';
    $('#msgs').innerHTML = h;
  }
  function kv(label, val, key, cls) {
    return '<div class="kv' + (cls ? ' ' + cls : '') + '"' + (key && R.expl[key] ? ' data-x="' + key + '"' : '') + '><div class="k">' + label + '</div><div class="v">' + val + '</div></div>';
  }
  function renderAuswertung() {
    var A = R.aus, Su = R.sum, st = R.strecke, e = R.einst;
    var h = '';
    h += kv('ΣR', M(Su.R) + ' m', 'sumR');
    h += kv('ΣV <span class="small">(ohne Zwischenblicke)</span>', M(Su.V) + ' m', 'sumV');
    h += kv('ΣR − ΣV', M(Su.RV, true) + ' m', 'sumRV');
    h += kv('ΣΔh', M(Su.dh, true) + ' m', 'sumDh');
    h += kv('H_A', R.HA !== null ? M(R.HA) + ' m' : '–', 'HA');
    h += kv('H_E (gemessen)', Su.HEgem !== null && Su.HEgem !== undefined ? M(Su.HEgem) + ' m' : '–', 'HE');
    h += kv('ΔH_ist = ΣR − ΣV', M(A.dHist, true) + ' m', 'dHist');
    h += kv('Rechenprobe', Su.vollst ? (Su.probe ? 'o.k. ✓' : 'Fehler ✗') : 'nicht möglich', 'probe', Su.vollst ? (Su.probe ? 'good' : 'bad') : '');
    h += kv('Strecke s', st.alle ? ZW(st.S) + ' m = ' + DZ(st.S / 10000, 3) + ' km' : 'Zielweiten unvollständig', 's');
    h += kv('größte Zielweite', st.maxZw !== null ? ZW(st.maxZw) + ' m' + (st.maxZwOrt ? ' (' + esc(st.maxZwOrt) + ')' : '') : '–', 'maxZw', st.maxZw !== null && st.maxZw > e.maxZw * 10 ? 'bad' : '');
    h += kv('ΔH_soll' + (R.schleife ? ' (Schleife)' : ''), A.dHsoll !== null ? M(A.dHsoll, true) + ' m' : '– (keine Sollhöhe)', 'dHsoll');
    h += kv(e.wKonv === 'b' ? 'W = Ist − Soll' : 'W = Soll − Ist', A.W !== null ? M(A.W, true) + ' m = ' + MM(A.W, true) + ' mm' : '–', 'W');
    h += kv('f = ' + DZ(e.c, 1).replace(',0', '') + ' · √s', A.f !== null ? DZ(A.f, 1) + ' mm' : '–', 'f');
    h += kv('|W| ≤ f', A.fOk === null ? '–' : (A.fOk ? 'eingehalten ✓' : 'nicht eingehalten – Messung wiederholen'), 'fOk', A.fOk === null ? '' : (A.fOk ? 'good' : 'bad'));
    h += kv(e.wKonv === 'b' ? 'ΣK = −W' : 'ΣK = W', A.verteilt ? MM(A.sumK, true) + ' mm ' + (A.probeK ? '✓' : '✗') : 'keine Verteilung', 'sumK', A.verteilt ? (A.probeK ? 'good' : 'bad') : '');
    $('#aus').innerHTML = h;

    var P_ = R.P, nm = function (i) { return i === null || i === undefined ? '–' : esc(P_[i].punkt || ('Z. ' + (i + 1))); };
    var t = '<tr><th>Auf­stellung</th><th class="l">Rückblick auf</th><th>R [m]</th><th class="l">Vorblick auf</th><th>V [m]</th><th>Zielweite R [m]</th><th>Zielweite V [m]</th><th>Differenz R−V [m]</th><th>s_i [m]</th><th>H_Visur [m]</th><th>Δh [m]</th><th>K [mm]</th><th>Zwischen­blicke</th></tr>';
    R.setups.forEach(function (s) {
      var dw = s.diff !== null && Math.abs(s.diff) > e.maxDiff * 10;
      t += '<tr><td>I' + s.nr + '</td><td class="l">' + nm(s.rowR) + '</td><td>' + M(s.R) + '</td><td class="l">' + nm(s.rowV) + '</td><td>' + M(s.V) + '</td><td>' + ZW(s.zwR) + '</td><td>' + ZW(s.zwV) + '</td>' +
        '<td style="' + (dw ? 'color:var(--err);font-weight:700' : '') + '">' + (s.diff !== null ? DZ(s.diff / 10, 1) : '') + '</td><td>' + ZW(s.s) + '</td><td>' + M(s.visur) + '</td><td>' + M(s.dh, true) + '</td><td>' + (s.K !== null ? MM(s.K, true) : '') + '</td><td>' + s.zRows.length + '</td></tr>';
    });
    $('#aufst').innerHTML = R.setups.length ? t : '<tr><td class="l muted">Noch keine Aufstellung.</td></tr>';
    var d = '';
    if (R.doppel.length) {
      d = '<h3>Doppelaufnahmen (Kontrolle von Zwischenpunkten)</h3><div class="scrollx"><table class="std"><tr><th class="l">Punkt</th><th>Zeile</th><th>H [m]</th><th>Zeile</th><th>H [m]</th><th>Differenz [mm]</th><th class="l">Ergebnis</th></tr>' +
        R.doppel.map(function (x) {
          return '<tr><td class="l">' + esc(x.punkt) + '</td><td>' + (x.rowA + 1) + '</td><td>' + M(x.HA_) + '</td><td>' + (x.rowB + 1) + '</td><td>' + M(x.HB_) + '</td><td>' + MM(x.diff, true) + '</td><td class="l" style="color:var(' + (x.ok ? '--ok' : '--err') + ')">' + (x.ok ? 'o.k. (≤ ' + e.maxDoppel + ' mm)' : 'Abweichung zu groß') + '</td></tr>';
        }).join('') + '</table></div><p class="small muted">Verglichen werden ' + (R.doppel[0].korr ? 'korrigierte' : 'gemessene') + ' Höhen.</p>';
    }
    $('#doppel').innerHTML = d;
  }
  // Ereignisse Feldbuch
  $('#kopf').addEventListener('input', function (e) { var k = e.target.dataset.kopf; if (k) { P().kopf[k] = e.target.value; save(); $('#projname').textContent = P().kopf.projekt || ''; } });
  $('#HA').addEventListener('input', function (e) { P().HA = e.target.value; save(); update(); });
  $('#HEsoll').addEventListener('input', function (e) { P().HEsoll = e.target.value; save(); update(); });
  $('#schleife').addEventListener('change', function (e) { P().schleife = e.target.checked; $('#HEsoll').disabled = e.target.checked; save(); update(); });
  function einst(id, key, num) {
    $(id).addEventListener(num ? 'input' : 'change', function (e) {
      var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (num) {
        var n = parseFloat(String(v).replace(',', '.'));
        if (isNaN(n) || n <= 0) { e.target.classList.add('bad'); return; }
        e.target.classList.remove('bad'); v = n;
      }
      P().einst[key] = v; save(); update();
    });
  }
  einst('#e-c', 'c', true); einst('#e-wKonv', 'wKonv'); einst('#e-maxZw', 'maxZw', true); einst('#e-maxDiff', 'maxDiff', true);
  einst('#e-maxDoppel', 'maxDoppel', true); einst('#e-gleich', 'gleichVerteilen');
  var fb = $('#fb');
  fb.addEventListener('input', function (e) {
    var f = e.target.dataset.f; if (!f) return;
    var i = +e.target.closest('tr').dataset.i;
    P().zeilen[i][f] = e.target.value; save(); update();
  });
  fb.addEventListener('change', function (e) { if (e.target.dataset.f === 'bem') merkeBem(e.target.value); });
  fb.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.dataset.f) return;
    e.preventDefault();
    var i = +e.target.closest('tr').dataset.i, f = e.target.dataset.f;
    if (i + 1 >= P().zeilen.length) { P().zeilen.push(leereZeile()); save(); renderTabelle(); }
    var n = document.querySelector('#fb tr[data-i="' + (i + 1) + '"] input[data-f="' + f + '"]');
    if (n) { n.focus(); n.select(); }
  });
  fb.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (b) {
      var i = +b.closest('tr').dataset.i, z = P().zeilen;
      if (b.dataset.act === 'ins') z.splice(i + 1, 0, leereZeile());
      if (b.dataset.act === 'del') {
        var voll = Object.keys(z[i]).some(function (k) { return String(z[i][k] || '').trim() !== ''; });
        if (voll && !confirm('Zeile ' + (i + 1) + ' (' + (z[i].punkt || 'ohne Punktnr.') + ') löschen?')) return;
        z.splice(i, 1);
        if (!z.length) z.push(leereZeile());
      }
      save(); renderTabelle(); return;
    }
    var td = e.target.closest('td.calc');
    if (td && td.dataset.x && S.lern) zeigeErkl(R.expl[td.dataset.x]);
  });
  $('#aus').addEventListener('click', function (e) { var k = e.target.closest('.kv'); if (k && k.dataset.x && S.lern) zeigeErkl(R.expl[k.dataset.x]); });
  $('#msgs').addEventListener('click', function (e) {
    var m = e.target.closest('.msg[data-row]'); if (!m) return;
    var tr = document.querySelector('#fb tr[data-i="' + m.dataset.row + '"]');
    if (tr) { tr.scrollIntoView({ block: 'center', behavior: 'smooth' }); var inp = tr.querySelector('input'); if (inp) inp.focus({ preventScroll: true }); }
  });
  $('#add1').addEventListener('click', function () { P().zeilen.push(leereZeile()); save(); renderTabelle(); });
  $('#add5').addEventListener('click', function () { for (var k = 0; k < 5; k++) P().zeilen.push(leereZeile()); save(); renderTabelle(); });

  /* ================= SKIZZE ================= */
  function skizzeSVG(p, druck) {
    var res = C.auswerten(p), rel = false;
    if (res.HA === null) { var q = clone(p); q.HA = '0,000'; res = C.auswerten(q); rel = true; }
    var su = res.setups.filter(function (s) { return s.Hbase !== null; });
    if (!su.length) return '<p class="muted" style="padding:12px">Noch keine auswertbare Aufstellung: mindestens einen Rückblick und einen Vorblick eingeben.</p>';
    var col = druck ? { t: '#000', m: '#555', R: '#000', V: '#000', Z: '#555', g: '#000', fill: '#ddd' }
      : { t: 'var(--text)', m: 'var(--muted)', R: 'var(--r-col)', V: 'var(--v-col)', Z: 'var(--z-col)', g: 'var(--muted)', fill: 'var(--calc-bg)' };
    var x = 70, lat = [], ins = [], pts = {}, P_ = res.P;
    su.forEach(function (s) {
      var nz = s.zRows.length, w = 230 + 70 * nz, xI = x + 105, xV = x + w;
      lat.push({ x: x, H: s.Hbase, a: s.R, k: 'R', vis: s.visur });
      if (!pts[s.rowR]) pts[s.rowR] = { x: x, H: s.Hbase, row: s.rowR, typ: res.rows[s.rowR].typ };
      s.zRows.forEach(function (zi, j) {
        var zx = xI + 60 + (j + 0.5) * ((xV - xI - 120) / nz);
        var rz = res.rows[zi];
        if (rz.H === null) return;
        lat.push({ x: zx, H: rz.H, a: P_[zi].Z, k: 'Z', vis: s.visur });
        pts[zi] = { x: zx, H: rz.H, row: zi, typ: 'z' };
      });
      if (s.rowV !== null && res.rows[s.rowV].H !== null) {
        var rv = res.rows[s.rowV];
        lat.push({ x: xV, H: rv.H, a: s.V, k: 'V', vis: s.visur });
        pts[s.rowV] = { x: xV, H: rv.H, row: s.rowV, typ: rv.typ };
      }
      ins.push({ x: xI, vis: s.visur, nr: s.nr, x0: x, x1: s.rowV !== null ? xV : xI });
      x = xV;
    });
    var W = x + 80, top = 70, hh = 230, Hs = 420;
    var arr = Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return a.x - b.x; });
    var lo = Math.min.apply(null, arr.map(function (p) { return p.H; }));
    var hi = Math.max.apply(null, ins.map(function (i) { return i.vis; }));
    var rng = Math.max(hi - lo, 500);
    var y = function (h) { return top + (hi - h) / rng * hh; };
    var gy = function (gx) { // Gelände interpoliert
      if (gx <= arr[0].x) return y(arr[0].H);
      for (var i = 1; i < arr.length; i++) if (gx <= arr[i].x) { var a = arr[i - 1], b = arr[i]; return y(a.H + (b.H - a.H) * (gx - a.x) / (b.x - a.x)); }
      return y(arr[arr.length - 1].H);
    };
    var o = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + Hs + '" viewBox="0 0 ' + W + ' ' + Hs + '" font-family="system-ui, sans-serif" font-size="12" role="img" aria-label="Schematische Skizze des Nivellements">';
    o += '<defs><marker id="pf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:' + col.t + '"/></marker></defs>';
    o += '<line x1="40" y1="24" x2="' + (W - 40) + '" y2="24" style="stroke:' + col.t + '" stroke-width="1.5" marker-end="url(#pf)"/><text x="44" y="18" style="fill:' + col.t + '" font-weight="600">Messrichtung</text>';
    o += '<text x="' + (W - 40) + '" y="18" text-anchor="end" style="fill:' + col.m + '">unmaßstäblich – Höhen überhöht' + (rel ? ', relative Höhen (H_A fehlt)' : '') + '</text>';
    // Gelände
    var gpts = [[30, gy(30)]].concat(arr.map(function (p) { return [p.x, y(p.H)]; })).concat([[W - 30, gy(W - 30)]]);
    var gl = gpts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    o += '<polygon points="' + gl + ' ' + (W - 30) + ',' + (Hs - 60) + ' 30,' + (Hs - 60) + '" style="fill:' + col.fill + '" opacity="0.6"/>';
    o += '<polyline points="' + gl + '" fill="none" style="stroke:' + col.g + '" stroke-width="2"/>';
    // Visurlinien und Instrumente
    ins.forEach(function (i) {
      var yv = y(i.vis);
      lat.filter(function (l) { return l.vis === i.vis && l.x >= i.x0 - 1 && l.x <= i.x1 + 1; }).forEach(function (l) {
        o += '<line x1="' + i.x + '" y1="' + yv + '" x2="' + l.x + '" y2="' + yv + '" style="stroke:' + col[l.k] + '" stroke-width="1.3" stroke-dasharray="5 4"/>';
      });
      var gyI = gy(i.x);
      o += '<line x1="' + i.x + '" y1="' + (yv + 9) + '" x2="' + (i.x - 13) + '" y2="' + gyI + '" style="stroke:' + col.t + '" stroke-width="1.4"/>';
      o += '<line x1="' + i.x + '" y1="' + (yv + 9) + '" x2="' + (i.x + 13) + '" y2="' + gyI + '" style="stroke:' + col.t + '" stroke-width="1.4"/>';
      o += '<line x1="' + i.x + '" y1="' + (yv + 9) + '" x2="' + i.x + '" y2="' + gyI + '" style="stroke:' + col.t + '" stroke-width="1.4"/>';
      o += '<circle cx="' + i.x + '" cy="' + yv + '" r="8" style="fill:' + (druck ? '#fff' : 'var(--surface)') + ';stroke:' + col.t + '" stroke-width="1.6"/>';
      o += '<path d="M' + (i.x - 5.6) + ',' + (yv - 5.6) + ' L' + (i.x + 5.6) + ',' + (yv + 5.6) + ' M' + (i.x + 5.6) + ',' + (yv - 5.6) + ' L' + (i.x - 5.6) + ',' + (yv + 5.6) + '" style="stroke:' + col.t + '" stroke-width="1.6"/>';
      o += '<text x="' + i.x + '" y="' + (yv - 26) + '" text-anchor="middle" font-weight="700" style="fill:' + col.t + '">I' + i.nr + '</text>';
      o += '<text x="' + i.x + '" y="' + (yv - 13) + '" text-anchor="middle" font-size="10.5" style="fill:' + col.m + '">H_Visur ' + M(i.vis) + '</text>';
    });
    // Latten
    lat.forEach(function (l) {
      var yf = y(l.H), yv = y(l.vis);
      var off = l.k === 'R' ? -1 : 1;
      var lx = l.x + off * 6;
      o += '<rect x="' + (lx - 3) + '" y="' + (yv - 16) + '" width="6" height="' + (yf - yv + 16) + '" style="fill:' + (druck ? '#fff' : 'var(--surface)') + ';stroke:' + col[l.k] + '" stroke-width="1.5"/>';
      o += '<line x1="' + (lx - 6) + '" y1="' + yv + '" x2="' + (lx + 6) + '" y2="' + yv + '" style="stroke:' + col[l.k] + '" stroke-width="2"/>';
      o += '<text x="' + (lx + off * 9) + '" y="' + ((yv + yf) / 2 + 4) + '" text-anchor="' + (off < 0 ? 'end' : 'start') + '" font-weight="600" style="fill:' + col[l.k] + '">' + l.k + ' ' + M(l.a) + '</text>';
    });
    // Punkte
    arr.forEach(function (p) {
      var yp = y(p.H), sym;
      var fest = p.typ === 'start' || (p.row === res.sum.lastV && res.HEsoll !== null);
      if (fest) sym = '<path d="M' + p.x + ',' + (yp - 7) + ' L' + (p.x + 7) + ',' + (yp + 5) + ' L' + (p.x - 7) + ',' + (yp + 5) + ' z" style="fill:' + col.t + '"/>';
      else if (p.typ === 'z') sym = '<circle cx="' + p.x + '" cy="' + yp + '" r="5" style="fill:' + col.t + '"/>';
      else sym = '<circle cx="' + p.x + '" cy="' + yp + '" r="5.5" style="fill:' + (druck ? '#fff' : 'var(--surface)') + ';stroke:' + col.t + '" stroke-width="1.8"/>';
      o += sym;
      o += '<text x="' + p.x + '" y="' + (yp + 22) + '" text-anchor="middle" font-weight="700" style="fill:' + col.t + '">' + esc(P_[p.row].punkt || '?') + '</text>';
      o += '<text x="' + p.x + '" y="' + (yp + 36) + '" text-anchor="middle" font-size="10.5" style="fill:' + col.m + '">' + M(p.H) + '</text>';
    });
    // Legende
    var ly = Hs - 26;
    o += '<g font-size="11.5" style="fill:' + col.t + '">';
    o += '<circle cx="46" cy="' + (ly - 4) + '" r="7" style="fill:none;stroke:' + col.t + '" stroke-width="1.4"/><path d="M41,' + (ly - 9) + ' L51,' + (ly + 1) + ' M51,' + (ly - 9) + ' L41,' + (ly + 1) + '" style="stroke:' + col.t + '" stroke-width="1.4"/><text x="58" y="' + ly + '">Instrumentenstandpunkt</text>';
    o += '<circle cx="216" cy="' + (ly - 4) + '" r="5" style="fill:none;stroke:' + col.t + '" stroke-width="1.6"/><text x="226" y="' + ly + '">Wechselpunkt</text>';
    o += '<circle cx="330" cy="' + (ly - 4) + '" r="4.5" style="fill:' + col.t + '"/><text x="340" y="' + ly + '">Zwischenpunkt</text>';
    o += '<path d="M444,' + (ly - 10) + ' L451,' + (ly + 2) + ' L437,' + (ly + 2) + ' z" style="fill:' + col.t + '"/><text x="458" y="' + ly + '">Höhenfestpunkt (App-Ergänzung)</text>';
    o += '<text x="660" y="' + ly + '"><tspan style="fill:' + col.R + '">R Rückblick</tspan>  <tspan style="fill:' + col.Z + '">Z Zwischenblick</tspan>  <tspan style="fill:' + col.V + '">V Vorblick</tspan></text>';
    o += '</g></svg>';
    return o;
  }
  function renderSkizze() { $('#skizze').innerHTML = skizzeSVG(P(), false); }

  /* ================= ABSTECKEN ================= */
  var ABS_BEM = ['Fundamentsohle', 'Baugrubensohle', 'Meterriss', 'OK Schnurgerüst', 'OK Fertigfußboden (OKFF)', 'OK Rohdecke (OKRD)', 'OK Gelände', 'Pflock mit Nagel', 'sonstiger Punkt'];
  function absVisur() {
    var p = P(), res = rechne();
    if (p.absQuelle === 'man' || !res.setups.some(function (s) { return s.visur !== null; })) {
      var v = C.parseFix(p.absVisur, 3);
      return { v: v.v, err: v.err, txt: 'manuell eingegeben', man: true };
    }
    var nr = +p.absQuelle || 0, s = res.setups.filter(function (s) { return s.visur !== null; });
    var st = s.filter(function (x) { return x.nr === nr; })[0] || s[0];
    return { v: st.visur, txt: 'Aufstellung I' + st.nr + ': H_Visur = H(' + (res.P[st.rowR].punkt || '?') + ') + R = ' + M(st.Hbase) + ' + ' + M(st.R) + ' = ' + M(st.visur) + ' m', nr: st.nr };
  }
  function renderAbsteck() {
    var p = P(), res = rechne();
    p.abs = p.abs || [];
    var s = res.setups.filter(function (x) { return x.visur !== null; });
    var opts = s.map(function (x) { return '<option value="' + x.nr + '">Aufstellung I' + x.nr + ' (Rückblick auf ' + esc(res.P[x.rowR].punkt || '?') + ') – H_Visur = ' + M(x.visur) + ' m</option>'; }).join('');
    $('#ab-quelle').innerHTML = opts + '<option value="man">Visurhöhe manuell eingeben</option>';
    var av = absVisur();
    $('#ab-quelle').value = av.man ? 'man' : String(av.nr);
    $('#ab-man-wrap').style.display = av.man ? '' : 'none';
    $('#ab-visur').value = p.absVisur || '';
    renderAbsTab();
  }
  function renderAbsTab() {
    var p = P(), av = absVisur();
    $('#ab-info').textContent = av.v !== null ? 'Verwendet: ' + av.txt : (av.err ? 'Visurhöhe: ' + av.err : 'Visurhöhe fehlt: Feldbuch mit H_A und Rückblick ausfüllen oder manuell eingeben.');
    var h = '<tr><th class="l">Punkt</th><th class="l">Art</th><th>H_Soll [m]</th><th>Soll-Ablesung [m]</th><th>Ablesung ist [m]</th><th>H_ist [m]</th><th>Abweichung [mm]</th><th class="l">Hinweis</th><th></th></tr>';
    p.abs.forEach(function (a, i) {
      var r = C.absteckung(av.v, a.soll), ist = C.parseFix(a.ist, 3), Hist = null, dev = null, hint = r.warn || r.err || '';
      if (av.v !== null && ist.v !== null) { Hist = av.v - ist.v; if (r.soll !== undefined && r.soll !== null) dev = Hist - r.soll; }
      if (dev !== null) hint = dev === 0 ? 'genau auf Sollhöhe ✓' : (dev > 0 ? 'Punkt ' + MM(dev) + ' mm zu hoch (tiefer setzen / abtragen)' : 'Punkt ' + MM(-dev) + ' mm zu tief (höher setzen / auffüllen)');
      if (a.bem === 'Meterriss' && !hint) hint = 'Meterriss = OKFF + 1,000 m';
      h += '<tr data-i="' + i + '"><td class="l"><input class="in" data-a="name" value="' + esc(a.name) + '" style="width:90px"></td>' +
        '<td class="l"><select data-a="bem">' + ABS_BEM.map(function (b) { return '<option' + (b === a.bem ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select></td>' +
        '<td><input class="in' + (r.err ? ' bad' : '') + '" data-a="soll" value="' + esc(a.soll) + '" inputmode="decimal" style="width:96px;text-align:right"></td>' +
        '<td style="background:var(--calc-bg);font-weight:700" class="ab-x" data-i="' + i + '">' + (r.v !== null && r.v !== undefined ? M(r.v) : '') + '</td>' +
        '<td><input class="in' + (ist.err ? ' bad' : '') + '" data-a="ist" value="' + esc(a.ist) + '" inputmode="decimal" style="width:86px;text-align:right"></td>' +
        '<td style="background:var(--calc-bg)">' + (Hist !== null ? M(Hist) : '') + '</td>' +
        '<td style="background:var(--calc-bg)">' + (dev !== null ? MM(dev, true) : '') + '</td>' +
        '<td class="l small">' + esc(hint) + '</td><td><button class="b sm" data-a-del="' + i + '" aria-label="Sollpunkt löschen">✕</button></td></tr>';
    });
    $('#ab-tab').innerHTML = h;
  }
  $('#ab-quelle').addEventListener('change', function (e) { P().absQuelle = e.target.value; save(); renderAbsteck(); });
  $('#ab-visur').addEventListener('input', function (e) { P().absVisur = e.target.value; save(); renderAbsTab(); refocus(); });
  var lastFocus = null;
  function refocus() {
    if (!lastFocus) return;
    var el = document.querySelector('#ab-tab tr[data-i="' + lastFocus.i + '"] [data-a="' + lastFocus.a + '"]');
    if (el) { el.focus(); if (el.setSelectionRange && lastFocus.pos !== null) try { el.setSelectionRange(lastFocus.pos, lastFocus.pos); } catch (x) { /* select */ } }
  }
  $('#ab-tab').addEventListener('input', function (e) {
    var a = e.target.dataset.a; if (!a) return;
    var i = +e.target.closest('tr').dataset.i;
    P().abs[i][a] = e.target.value; save();
    lastFocus = { i: i, a: a, pos: e.target.selectionStart !== undefined ? e.target.selectionStart : null };
    renderAbsTab(); refocus();
  });
  $('#ab-tab').addEventListener('change', function (e) { if (e.target.dataset.a === 'bem') { var i = +e.target.closest('tr').dataset.i; P().abs[i].bem = e.target.value; save(); renderAbsTab(); } });
  $('#ab-tab').addEventListener('click', function (e) {
    var d = e.target.closest('[data-a-del]');
    if (d) { P().abs.splice(+d.dataset.aDel, 1); save(); renderAbsTab(); return; }
    var x = e.target.closest('.ab-x');
    if (x && S.lern && x.textContent) {
      var a = P().abs[+x.dataset.i], av = absVisur(), r = C.absteckung(av.v, a.soll);
      zeigeErkl({ titel: 'Soll-Lattenablesung ' + (a.name || ''), formel: 'Ablesung_soll = H_Visur − H_Soll', werte: 'H_Visur = ' + M(av.v) + ' m (' + av.txt + ')\nAblesung_soll = ' + M(av.v) + ' − ' + M(r.soll), ergebnis: 'Ablesung_soll = ' + M(r.v) + ' m', note: 'Die Latte wird so lange verschoben (bzw. der Pflock eingeschlagen), bis genau dieser Wert abgelesen wird. Dann liegt der Lattenfuß auf H_Soll.' });
    }
  });
  $('#ab-add').addEventListener('click', function () { P().abs.push({ name: '', bem: 'Fundamentsohle', soll: '', ist: '' }); save(); renderAbsTab(); });

  /* ================= ÜBEN ================= */
  $('#ue-neu').addEventListener('click', function () {
    var opt = { mitZ: $('#ue-z').checked, mitSoll: $('#ue-soll').checked };
    S.ue = { opt: opt, p: C.erzeugeUebung(opt), eing: {}, geprueft: false, loesung: false };
    save(); renderUebung();
  });
  function renderUebung() {
    var box = $('#ue');
    if (!S.ue) { box.innerHTML = '<p class="muted">Mit „Neue Aufgabe“ erzeugt die App ein zufälliges Feldbuch. Trage die Höhen' + ' (und bei Sollhöhe K und korrigierte Höhen) selbst ein, dann „Prüfen“.</p>'; return; }
    var u = S.ue, p = u.p, res = C.auswerten(p), mitSoll = p.HEsoll !== '';
    var ok = function (key, soll) {
      if (!u.geprueft && !u.loesung) return '';
      var v = u.eing[key];
      if (v === undefined || v === '') return u.geprueft ? 'ue-bad' : '';
      return soll(v) ? 'ue-ok' : 'ue-bad';
    };
    var eqM = function (soll) { return function (v) { var x = C.parseFix(v, 3); return !x.err && x.v === soll; }; };
    var eqMM = function (soll) { return function (v) { var x = C.parseFix(v, 0); return !x.err && x.v === soll; }; };
    var inp = function (key, soll, check, w) {
      var val = u.loesung ? soll : (u.eing[key] || '');
      return '<input class="in ' + ok(key, check) + '" data-ue="' + key + '" value="' + esc(val) + '" inputmode="decimal" style="width:' + (w || 90) + 'px;text-align:right"' + (u.loesung ? ' readonly' : '') + '>';
    };
    var h = '<p><b>H_A = ' + esc(p.HA) + ' m ü. NHN</b>' + (mitSoll ? ' &nbsp; <b>H_E,soll = ' + esc(p.HEsoll) + ' m</b> &nbsp; c = 15 mm/√km, W = Soll − Ist' : ' &nbsp; (ohne Sollhöhe: nur Höhen und Rechenprobe)') + '</p>';
    h += '<div class="scrollx"><table class="std"><tr><th class="l">Punkt</th><th>Zielw. R</th><th>Zielw. V</th><th>R</th><th>Z</th><th>V</th><th>Höhe gemessen [m]</th>' + (mitSoll ? '<th>K [mm]</th><th>Höhe korrigiert [m]</th>' : '') + '<th class="l">Bemerkung</th></tr>';
    p.zeilen.forEach(function (z, i) {
      var r = res.rows[i];
      h += '<tr><td class="l">' + esc(z.punkt) + '</td><td>' + esc(z.zwR) + '</td><td>' + esc(z.zwV) + '</td><td>' + esc(z.R) + '</td><td>' + esc(z.Z) + '</td><td>' + esc(z.V) + '</td>';
      h += '<td>' + (r.typ === 'start' ? M(r.H) : inp('H' + i, M(r.H), eqM(r.H))) + '</td>';
      if (mitSoll) {
        h += '<td>' + ((r.typ === 'v' || r.typ === 'wp') ? inp('K' + i, MM(r.K, true), eqMM(r.K), 60) : '') + '</td>';
        h += '<td>' + (r.typ === 'start' ? M(r.Hk) : inp('Hk' + i, M(r.Hk), eqM(r.Hk))) + '</td>';
      }
      h += '<td class="l small">' + esc(z.bem) + '</td></tr>';
    });
    h += '</table></div><div class="grid" style="margin-top:10px">';
    h += '<label class="f">ΣR [m]' + inp('sR', M(res.sum.R), eqM(res.sum.R)) + '</label>';
    h += '<label class="f">ΣV [m]' + inp('sV', M(res.sum.V), eqM(res.sum.V)) + '</label>';
    h += '<label class="f">ΔH_ist = ΣR − ΣV [m]' + inp('dH', M(res.aus.dHist, true), eqM(res.aus.dHist)) + '</label>';
    if (mitSoll) {
      h += '<label class="f">W [mm]' + inp('W', MM(res.aus.W, true), eqMM(res.aus.W), 70) + '</label>';
      h += '<label class="f">f [mm] (1 Nachkommastelle)' + inp('f', DZ(res.aus.f, 1), function (v) { var x = C.parseFix(v, 1); return !x.err && x.v === Math.round(res.aus.f * 10); }, 70) + '</label>';
    }
    h += '</div><div class="row" style="margin-top:12px"><button class="b pri" id="ue-pruef">Prüfen</button><button class="b" id="ue-loes">' + (u.loesung ? 'Eigene Eingaben zeigen' : 'Lösung zeigen') + '</button><button class="b" id="ue-fb">Ins Feldbuch übernehmen</button></div>';
    if (u.geprueft && !u.loesung) {
      var n = 0, g = 0;
      box.innerHTML = h;
      box.querySelectorAll('input[data-ue]').forEach(function (el) { n++; if (el.classList.contains('ue-ok')) g++; });
      box.insertAdjacentHTML('beforeend', '<div class="msg ' + (g === n ? 'ok' : 'warn') + '" style="margin-top:10px">' + g + ' von ' + n + ' Feldern richtig' + (g === n ? ' – sehr gut!' : '. Rote Felder noch einmal nachrechnen; Tipp: im Feldbuch mit Lernmodus den Rechenweg ansehen.') + '</div>');
    } else box.innerHTML = h;
  }
  $('#ue').addEventListener('input', function (e) { var k = e.target.dataset.ue; if (k && S.ue && !S.ue.loesung) { S.ue.eing[k] = e.target.value; save(); } });
  $('#ue').addEventListener('click', function (e) {
    if (!S.ue) return;
    if (e.target.id === 'ue-pruef') { S.ue.geprueft = true; S.ue.loesung = false; save(); renderUebung(); }
    if (e.target.id === 'ue-loes') { S.ue.loesung = !S.ue.loesung; save(); renderUebung(); }
    if (e.target.id === 'ue-fb') { neuesProjekt(S.ue.p); save(); zeigeTab('feldbuch'); }
  });

  /* ================= ZEICHEN & INFO ================= */
  function tab(rows) { return '<div class="scrollx"><table class="std">' + rows.map(function (r) { return '<tr><td class="l" style="width:150px;font-weight:700;white-space:nowrap">' + r[0] + '</td><td class="l">' + r[1] + '</td></tr>'; }).join('') + '</table></div>'; }
  $('#zeichen').innerHTML =
    '<h2>Zeichenerklärung</h2>' +
    '<div class="msg warn">Achtung: <b>W</b> ist doppelt belegt. Es steht für den <b>Wechselpunkt</b> (W1, W2 … bzw. WP) und für den <b>Widerspruch</b> W. In der App heißen Wechselpunkte meist „WP“.</div>' +
    '<h3>Punkte</h3>' + tab([
      ['A, H_A', 'Anfangspunkt = Anschlusspunkt (Höhenfestpunkt mit bekannter Höhe)'],
      ['E, H_E', 'Endpunkt (Höhenfestpunkt; bei Schleife = Anfangspunkt)'],
      ['WP, W1, W2 …', 'Wechselpunkt: Latte bleibt stehen, Instrument wird umgestellt; hat einen Vorblick und danach einen Rückblick'],
      ['Z, ZP', 'Zwischenpunkt: nur ein Zwischenblick, nicht Teil der Messkette'],
      ['I₁, I₂ …', 'Instrumentenstandpunkt (Aufstellung), möglichst mittig zwischen den Latten'],
      ['HFP', 'Höhenfestpunkt, z. B. Mauerbolzen, Pfeilerbolzen, Höhenbolzen']]) +
    '<h3>Ablesungen</h3>' + tab([
      ['R', 'Rückblick (Rückwärtsablesung) zum Punkt mit bekannter Höhe'],
      ['V', 'Vorblick (Vorwärtsablesung) zum neuen Punkt'],
      ['Z', 'Zwischenblick (Mittelblick) auf einen Zwischenpunkt'],
      ['Zielweite', 'Entfernung Instrument–Latte [m]; s_i = Zielweite R + Zielweite V je Aufstellung']]) +
    '<h3>Höhen</h3>' + tab([
      ['H', 'Höhe in m ü. NHN (Normalhöhennull)'],
      ['H_Visur', 'Visurhöhe = Instrumentenhorizont = Höhe der Ziellinie: H_Visur = H_Punkt + R'],
      ['Δh', 'Höhenunterschied: Δh = R − V bzw. R − Z (positiv = steigend)'],
      ['ΔH_ist', 'gemessener Gesamthöhenunterschied = ΣR − ΣV'],
      ['ΔH_soll', 'Soll-Höhenunterschied = H_E,soll − H_A (Schleife: 0)'],
      ['H_E,soll', 'bekannte (Soll-)Höhe des Endpunkts']]) +
    '<h3>Fehler</h3>' + tab([
      ['W', 'Widerspruch: a) RWTH-Vordruck W = Soll − Ist (ΣK = W), b) Infoblatt HSBK W = Ist − Soll (K mit umgekehrtem Vorzeichen)'],
      ['d', 'Lehrbuch: Widerspruch d = Soll − Ist'],
      ['f', 'zulässiger Widerspruch f = c · √s (f in mm, s in km)'],
      ['c', 'Faktor in mm/√km, hier 15 (Unterrichtskonvention, keine Norm)'],
      ['K', 'Korrektion (Verbesserung) je Aufstellung in mm'],
      ['s, s_i', 'Gesamtstrecke bzw. Strecke einer Aufstellung']]) +
    '<h3>Lehrbuchskizze</h3>' + tab([
      ['⊗', 'Instrumentenstandpunkt'],
      ['○', 'Wechselpunkt'],
      ['●', 'Zwischenpunkt'],
      ['▲', 'Höhenfestpunkt (nur in der App-Skizze, eigene Ergänzung)']]) +
    '<h3>Fehlerlehre / Tachymetrie</h3>' + tab([
      ['σ', 'Standardabweichung (Maß für die Genauigkeit)'],
      ['σ_L', 'Standardabweichung einer Lattenablesung'],
      ['σ_km', 'Standardabweichung für 1 km Doppelnivellement bzw. Nivellement'],
      ['n', 'Anzahl der Aufstellungen'],
      ['i', 'Instrumentenhöhe über Boden (nur Tachymetrie; beim Nivellement ohne Bedeutung)'],
      ['t', 'Zielhöhe / Reflektorhöhe (nur Tachymetrie)']]);

  $('#info').innerHTML =
    '<h2>Info / Lernen</h2>' +
    '<h3>1. Grundprinzip</h3><p>Das Instrument erzeugt eine horizontale Ziellinie (Visur). Der Höhenunterschied zweier Punkte ist die Differenz der Lattenablesungen: <span class="formel">Δh = R − V</span>. Ein positives Δh bedeutet steigendes Gelände. Die <b>Instrumentenhöhe über Boden</b> (Stativhöhe) spielt dabei <b>keine Rolle</b>, sie fällt bei R − V heraus. Wichtig ist sie nur bei der Tachymetrie (i, t).</p>' +
    '<h3>2. Regeln für das Feldbuch (Infoblatt HSBK)</h3><ul><li>Die Messung beginnt mit einem Rückblick.</li><li>Nie zwei Rückblicke oder zwei Vorblicke hintereinander.</li><li>Vor einem Zwischenblick steht ein Rückblick; nach Zwischenblicken folgt ein Vorblick.</li><li>Die Messung endet mit einem Vorblick.</li></ul><p>Die App prüft diese Regeln bei der Eingabe und markiert Verstöße. Sie blockiert aber nicht, damit unvollständige Übungen (wie Testfall C) trotzdem gerechnet werden.</p>' +
    '<h3>3. Rechenwege und Probe</h3><p><b>Rechenweg 1 (Δh):</b> <span class="formel">H_neu = H_alt + Δh</span><br><b>Rechenweg 2 (Visurhöhe):</b> <span class="formel">H_Visur = H_alt + R</span>, <span class="formel">H_neu = H_Visur − V</span> (bzw. − Z)<br>Ein Zwischenblick bezieht sich immer auf den <b>letzten Rückblick</b>: <span class="formel">Δh = R − Z</span>.</p>' +
    '<p><b>Summenprobe:</b> <span class="formel">ΣR − ΣV = ΣΔh = H_E − H_A</span>. Zwischenblicke zählen nicht in ΣV. Die Probe kontrolliert nur das <i>Rechnen</i>. Ob richtig <i>gemessen</i> wurde, zeigt erst der Anschluss an eine bekannte Sollhöhe (zweiter Höhenfestpunkt oder Schleife zurück zum Anfangspunkt). Zwischenpunkte sind auch dadurch nicht kontrolliert, sondern nur durch eine Doppelaufnahme von einem zweiten Standpunkt.</p>' +
    '<h3>4. Widerspruch und zulässiger Fehler</h3><p><span class="formel">ΔH_ist = ΣR − ΣV</span>, <span class="formel">ΔH_soll = H_E,soll − H_A</span>. Widerspruch je nach Konvention: a) <span class="formel">W = ΔH_soll − ΔH_ist</span> (RWTH-Vordruck, Lehrbuch d = Soll − Ist) oder b) <span class="formel">W = ΔH_ist − ΔH_soll</span> (Infoblatt HSBK).</p>' +
    '<p>Zulässig: <span class="formel">f = c · √s</span> mit f in mm, s in km, c = 15 (Infoblatt HSBK; in der App einstellbar). Nachweis: <span class="formel">|W| ≤ f</span>, sonst Messung wiederholen.</p>' +
    '<p><b>Warum √s?</b> Nach dem Fehlerfortpflanzungsgesetz hat ein Höhenunterschied aus zwei Ablesungen die Standardabweichung <span class="formel">σ_Δh = σ_L · √2</span>. Bei n Aufstellungen addieren sich die Varianzen: <span class="formel">σ_ges = σ_Δh · √n</span>. Weil die Anzahl der Aufstellungen ungefähr proportional zur Strecke ist (n ~ s), wächst der Fehler mit √s. Der Faktor 15 entspricht etwa einem Sicherheitsfaktor von 2 bis 3 mal σ_km. Rechnerisch steht c = 15 mm also für σ_km ≈ 5 bis 7,5 mm. <span class="badge">prüfbedürftig</span></p>' +
    '<h3>5. Fehlerverteilung</h3><p>Der Widerspruch wird proportional zu den Strecken der Aufstellungen verteilt, in ganzen Millimetern: <span class="formel">K_i = rund(K_ges · Σs_bis i / s) − rund(K_ges · Σs_bis i−1 / s)</span>. Durch diese kumulative Rundung ist ΣK exakt gleich der Gesamtkorrektur. Ein Zwischenpunkt erhält die kumulierte Korrektur einschließlich seiner Aufstellung (Korrektur über den Rückblick, wie im Lehrbuch). Ohne Sollhöhe oder ohne Zielweiten gibt es keine Fehlerverteilung, nur die Rechenprobe. Messfehler bleiben dann unentdeckt.</p>' +
    '<h3>6. Zielweiten</h3><p>Bei mm-Ablesung höchstens ca. 50 m Zielweite (Lehrbuch). Gleich lange Zielweiten für R und V (Instrument mittig) heben Restfehler der Ziellinie sowie Einflüsse von Erdkrümmung und Refraktion weitgehend auf. Deshalb zeigt die App die Zielweitendifferenz je Aufstellung an.</p>' +
    '<h3>7. DIN 18710 – Ingenieurvermessung <span class="badge">prüfbedürftig – gegen aktuelle Normausgabe prüfen</span></h3><p>DIN 18710 (Teile 1–4) arbeitet mit Genauigkeitsstufen: für die Höhe <b>H1</b> (Standardabweichung &gt; 20 mm) bis <b>H5</b> (≤ 0,5 mm), entsprechend <b>L1–L5</b> für die Lage. Die Grenzwerte der Zwischenstufen H2–H4 bzw. L1–L5 nennt die App bewusst nicht. Sie sind der jeweils gültigen Normausgabe zu entnehmen. Der Faktor c = 15 dieser App ist <b>kein</b> Normwert.</p>' +
    '<h3>8. Tachymetrie (nur Info)</h3><p>Bei der trigonometrischen Höhenbestimmung mit dem Tachymeter gilt vereinfacht (ohne Erdkrümmung und Refraktion) <span class="formel">Δh = S · cos z + i − t</span> mit Schrägstrecke S, Zenitwinkel z, Instrumentenhöhe i und Reflektorhöhe t. Hier sind i und t wichtig, beim Nivellement nicht. Die App rechnet nur das geometrische Nivellement.</p>' +
    '<h3>9. Abgrenzung</h3><p>Lern- und Übungswerkzeug, <b>kein amtliches Vermessungsprogramm</b>. Normwerte und Faktoren sind als prüfbedürftig gekennzeichnet.</p>' +
    '<h3>10. Kurzanleitung</h3><ol><li><b>Feldbuch:</b> H_A eingeben, bei Anschluss an einen zweiten Festpunkt H_E,soll (oder „Schleife“ wählen).</li><li>Je Punkt eine Zeile: Punktnummer, Zielweiten, Ablesungen (gelb). Wechselpunkt: V und R in derselben Zeile. Zwischenpunkt: eigene Zeile mit Z.</li><li>Grau = berechnet. Mit <b>Lernmodus</b> eine graue Zelle oder einen Wert der Auswertung antippen, dann erscheinen Formel, eingesetzte Werte und Ergebnis.</li><li>Meldungen unter der Tabelle beachten. Antippen springt zur Zeile.</li><li><b>Skizze</b> zeigt die Messung schematisch, <b>Abstecken</b> rechnet Soll-Lattenablesungen, <b>Üben</b> erzeugt Aufgaben mit Kontrolle.</li><li><b>Projekte &amp; Export:</b> Excel mit Formeln, PDF im Vordruck-Layout, CSV, Sicherung.</li></ol>';

  /* ================= PROJEKTE / EXPORT ================= */
  function renderProjekte() {
    var ids = Object.keys(S.projekte).sort(function (a, b) { return (S.projekte[b].geaendert || 0) - (S.projekte[a].geaendert || 0); });
    $('#plist').innerHTML = ids.map(function (id) {
      var p = S.projekte[id], n = p.zeilen.filter(function (z) { return z.R || z.V || z.Z; }).length;
      return '<div class="pitem' + (id === S.aktiv ? ' on' : '') + '"><div class="t"><b>' + esc(p.kopf.projekt || 'ohne Namen') + '</b><div class="small muted">' + n + ' Zeilen mit Ablesungen · geändert ' + new Date(p.geaendert || Date.now()).toLocaleString('de-DE') + '</div></div>' +
        '<button class="b sm" data-p-open="' + id + '">Öffnen</button><button class="b sm" data-p-dup="' + id + '">Duplizieren</button><button class="b sm warnb" data-p-del="' + id + '">Löschen</button></div>';
    }).join('');
    $('#eigBem').value = S.eigeneBem.join('\n');
  }
  $('#plist').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pOpen) { S.aktiv = b.dataset.pOpen; save(); zeigeTab('feldbuch'); }
    if (b.dataset.pDup) { var p = neuesProjekt(S.projekte[b.dataset.pDup]); p.kopf.projekt = (p.kopf.projekt || '') + ' (Kopie)'; save(); renderProjekte(); }
    if (b.dataset.pDel) {
      var q = S.projekte[b.dataset.pDel];
      if (!confirm('Projekt „' + (q.kopf.projekt || 'ohne Namen') + '“ endgültig löschen? Das kann nicht rückgängig gemacht werden.')) return;
      delete S.projekte[b.dataset.pDel];
      if (!Object.keys(S.projekte).length) neuesProjekt();
      if (!S.projekte[S.aktiv]) S.aktiv = Object.keys(S.projekte)[0];
      save(); renderProjekte();
    }
  });
  $('#p-neu').addEventListener('click', function () { neuesProjekt(); save(); zeigeTab('feldbuch'); });
  ['A', 'B', 'C'].forEach(function (k) { $('#p-bsp' + k).addEventListener('click', function () { neuesProjekt(BSP[k].projekt); save(); zeigeTab('feldbuch'); }); });
  $('#eigBem').addEventListener('input', function (e) { S.eigeneBem = e.target.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); renderBemListe(); save(); });

  function dateiname(ext) {
    var n = (P().kopf.projekt || 'Nivellement').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 60);
    return n + '.' + ext;
  }
  function download(data, name, type) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function exXlsx() { var res = rechne(); download(new Blob([C.buildXlsx(P(), res)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), dateiname('xlsx')); }
  function exCsv() { download('﻿' + C.exportCSV(P()), dateiname('csv'), 'text/csv;charset=utf-8'); }
  function exJson() {
    var all = Object.keys(S.projekte).map(function (k) { return S.projekte[k]; });
    download(JSON.stringify({ app: 'nivellement', version: 1, exportiert: new Date().toISOString(), projekte: all }, null, 1), 'Nivellement_Sicherung_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
  }
  $('#x-xlsx').addEventListener('click', exXlsx); $('#e-xlsx').addEventListener('click', exXlsx);
  $('#e-csv').addEventListener('click', exCsv); $('#e-json').addEventListener('click', exJson);
  $('#x-pdf').addEventListener('click', drucken); $('#e-pdf').addEventListener('click', drucken);
  function leseDatei(input, fn) {
    input.addEventListener('change', function () {
      var f = input.files && input.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { try { fn(String(r.result)); } catch (err) { alert('Import fehlgeschlagen: ' + err.message); } input.value = ''; };
      r.readAsText(f, 'utf-8');
    });
  }
  leseDatei($('#i-csv'), function (t) {
    var p = C.importCSV(t);
    if (!p.kopf.projekt) p.kopf.projekt = 'CSV-Import ' + new Date().toLocaleDateString('de-DE');
    var w = p.importWarn || [];
    neuesProjekt(p); save(); zeigeTab('feldbuch');
    if (w.length) alert('Hinweis zum Import: ' + w.join(' '));
  });
  leseDatei($('#i-json'), function (t) {
    var d = JSON.parse(t), list = d && d.projekte ? d.projekte : (d && d.zeilen ? [d] : null);
    if (!list) throw new Error('Keine Nivellement-Projekte in der Datei.');
    list.forEach(function (p) { if (p && p.zeilen) neuesProjekt(p); });
    save(); renderProjekte(); alert(list.length + ' Projekt(e) eingelesen.');
  });

  /* ---------- Druck / PDF ---------- */
  function drucken() {
    var p = P(), res = rechne(), A = res.aus, Su = res.sum, e = res.einst, k = p.kopf;
    var f = function (v) { return esc(v || ''); };
    var h = '<div class="dk-titel"><h1>Nivellement – Feldbuch und Auswertung</h1><span>Blatt ' + f(k.blatt) + '</span></div>';
    h += '<div class="dk-kopf">' + KOPF.map(function (x) { return '<div><b>' + x[1] + '</b>' + f(k[x[0]]) + '</div>'; }).join('') +
      '<div><b>H_A [m ü. NHN]</b>' + M(res.HA) + '</div><div><b>H_E,soll [m ü. NHN]</b>' + (res.schleife ? M(res.HA) + ' (Schleife)' : (res.HEsoll !== null ? M(res.HEsoll) : '–')) + '</div>' +
      '<div><b>Widerspruch</b>' + (e.wKonv === 'b' ? 'W = Ist − Soll (HSBK)' : 'W = Soll − Ist (RWTH)') + '</div><div><b>Grenzwert</b>f = ' + DZ(e.c, 1).replace(',0', '') + ' · √s [mm]</div></div>';
    h += '<table class="dk"><thead><tr><th>Punkt</th><th>Zielweite R [m]</th><th>Zielweite V [m]</th><th>Rückblick R [m]</th><th>Zwischenblick Z [m]</th><th>Vorblick V [m]</th><th>Δh [m]</th><th>Korrektion K [mm]</th><th>Höhe gemessen [m]</th><th>Höhe korrigiert [m]</th><th>Bemerkung</th></tr></thead><tbody>';
    p.zeilen.forEach(function (z, i) {
      var r = res.rows[i];
      if (!z.punkt && !z.R && !z.V && !z.Z && !z.bem) return;
      h += '<tr><td class="l in">' + f(z.punkt) + '</td><td class="in">' + f(z.zwR) + '</td><td class="in">' + f(z.zwV) + '</td><td class="in">' + f(z.R) + '</td><td class="in">' + f(z.Z) + '</td><td class="in">' + f(z.V) + '</td>' +
        '<td>' + (r.dh !== null ? M(r.dh, true) : '') + '</td><td>' + (r.K !== null ? MM(r.K, true) : '') + '</td><td>' + (r.H !== null ? M(r.H) : '') + '</td><td>' + (r.Hk !== null ? M(r.Hk) : '') + '</td><td class="l">' + f(z.bem) + '</td></tr>';
    });
    h += '<tr><td class="l"><b>Σ</b></td><td></td><td></td><td><b>' + M(Su.R) + '</b></td><td></td><td><b>' + M(Su.V) + '</b></td><td><b>' + M(Su.dh, true) + '</b></td><td><b>' + (A.verteilt ? MM(A.sumK, true) : '') + '</b></td><td></td><td></td><td></td></tr></tbody></table>';
    var it = [
      ['ΣR − ΣV', M(Su.RV, true) + ' m'], ['ΣΔh', M(Su.dh, true) + ' m'], ['Rechenprobe', Su.vollst ? (Su.probe ? 'o.k.' : 'Fehler') : 'nicht möglich'],
      ['H_A', M(res.HA) + ' m'], ['H_E gemessen', Su.HEgem !== null ? M(Su.HEgem) + ' m' : '–'], ['ΔH_ist', M(A.dHist, true) + ' m'],
      ['ΔH_soll', A.dHsoll !== null ? M(A.dHsoll, true) + ' m' : '–'], ['W', A.W !== null ? M(A.W, true) + ' m = ' + MM(A.W, true) + ' mm' : '–'],
      ['s', res.strecke.alle ? ZW(res.strecke.S) + ' m = ' + DZ(res.strecke.S / 10000, 3) + ' km' : '–'],
      ['f', A.f !== null ? DZ(A.f, 1) + ' mm' : '–'], ['|W| ≤ f', A.fOk === null ? '–' : (A.fOk ? 'eingehalten' : 'NICHT eingehalten – Messung wiederholen')],
      [e.wKonv === 'b' ? 'ΣK = −W' : 'ΣK = W', A.verteilt ? MM(A.sumK, true) + ' mm ' + (A.probeK ? 'o.k.' : 'Fehler') : 'keine Verteilung'],
      ['größte Zielweite', res.strecke.maxZw !== null ? ZW(res.strecke.maxZw) + ' m' : '–']
    ];
    h += '<div class="dk-aus">' + it.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>';
    var hw = res.eingabe.map(function (x) { return x.text; }).concat(res.plaus.map(function (x) { return x.text; }), res.warn.map(function (x) { return x.text; }), res.hinweise);
    if (hw.length) h += '<div class="dk-hinw"><b>Hinweise:</b><br>' + hw.map(function (x) { return '• ' + esc(x); }).join('<br>') + '</div>';
    h += '<div class="dk-sig"><div>Feldbuchführer</div><div>Bearbeiter</div><div>geprüft</div></div>';
    h += '<div class="dk-fuss">Erstellt am ' + new Date().toLocaleString('de-DE') + ' mit der Nivellement-Lern-App. Lern- und Übungswerkzeug, kein amtliches Vermessungsprogramm.</div>';
    h += '<div class="dk-skizze"><h2>Schematische Skizze (unmaßstäblich)</h2>' + skizzeSVG(p, true) + '</div>';
    $('#druck').innerHTML = h;
    window.print();
  }

  /* ---------- Start ---------- */
  renderBemListe();
  $('#ue-z').checked = !S.ue || !S.ue.opt || S.ue.opt.mitZ !== false;
  $('#ue-soll').checked = !S.ue || !S.ue.opt || S.ue.opt.mitSoll !== false;
  zeigeTab(S.tab || 'feldbuch');
  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') persist(); });
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* offline-Cache optional */ }); });
  }
  window.NivApp = { S: S, P: P, rechne: rechne };
})();
