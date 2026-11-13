/* Nivellement – Rechenkern
 * Lern- und Übungswerkzeug, kein amtliches Vermessungsprogramm.
 * Intern wird ausschließlich ganzzahlig gerechnet:
 *   Ablesungen und Höhen in mm (int), Zielweiten in dm (int, 0,1 m Auflösung).
 * Damit sind Summenprobe und ΣK = W exakt (keine Gleitkommafehler).
 */
(function (root) {
  'use strict';

  var DEFAULT_EINST = {
    c: 15,              // f = c · √s  (f in mm, s in km) – Unterrichtskonvention Infoblatt HSBK
    wKonv: 'a',         // 'a' RWTH: W = Soll − Ist ; 'b' HSBK: W = Ist − Soll
    maxZw: 50,          // m, Warnung bei Zielweite darüber (Lehrbuch: ca. 50 m bei mm-Ablesung)
    maxDiff: 5,         // m, Warnung bei Zielweitendifferenz R/V je Aufstellung
    maxDoppel: 3,       // mm, Warnung bei Abweichung einer Doppelaufnahme
    maxAblesung: 5,     // m, Warnung bei Ablesung über Lattenlänge
    gleichVerteilen: false // Ersatzverfahren ohne Zielweiten: gleichmäßig je Aufstellung
  };

  var BEMERKUNGEN = [
    'Anschlusspunkt (Höhenfestpunkt)', 'Endpunkt (Höhenfestpunkt)', 'Wechselpunkt',
    'Zwischenpunkt', 'Kontrollpunkt (Doppelaufnahme)', 'Mauerbolzen', 'Pfeilerbolzen',
    'Höhenbolzen', 'Pflock mit Nagel', 'Fluchtstab / Holzpflock', 'Grenzstein',
    'Kanaldeckel', 'Straßenablauf / Gully', 'Bordstein OK', 'OK Gelände',
    'OK Gelände Bestand', 'OK Fertigfußboden (OKFF)', 'OK Rohdecke (OKRD)', 'Meterriss',
    'OK Schnurgerüst', 'Fundamentsohle', 'Baugrubensohle', 'Blitzableiter',
    'Punkt nicht einsehbar', 'Latte unsicher – wiederholen'
  ];

  /* ---------- Zahlen ---------- */

  // Liest eine Dezimalzahl (Komma oder Punkt) als ganze Zahl in 10^-dec Einheiten.
  function parseFix(str, dec) {
    if (str === null || str === undefined) return { v: null };
    var s = String(str).trim().replace(/−/g, '-').replace(/±/g, '').replace(/\s/g, '');
    if (s === '' || s === '-' || s === '–' || s === '—') return { v: null };
    s = s.replace(',', '.');
    var m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[2] === '' && !m[3])) return { v: null, err: 'keine gültige Zahl' };
    var frac = m[3] || '';
    if (frac.length > dec) return { v: null, err: 'höchstens ' + dec + ' Nachkommastelle' + (dec === 1 ? '' : 'n') };
    while (frac.length < dec) frac += '0';
    var v = parseInt((m[2] || '0') + frac, 10);
    if (m[1] === '-' && v !== 0) v = -v;
    return { v: v };
  }

  function fmtFix(v, dec, sign) {
    if (v === null || v === undefined || isNaN(v)) return '';
    var a = Math.abs(v), p = Math.pow(10, dec);
    var s = String(Math.floor(a / p));
    if (dec > 0) { var f = String(a % p); while (f.length < dec) f = '0' + f; s += ',' + f; }
    if (v < 0) return '−' + s;
    if (sign) return (v > 0 ? '+' : '±') + s;
    return s;
  }
  function plainFix(v, dec) { // für Dateien: Punkt, Bindestrich
    if (v === null || v === undefined) return '';
    var a = Math.abs(v), p = Math.pow(10, dec);
    var s = String(Math.floor(a / p));
    if (dec > 0) { var f = String(a % p); while (f.length < dec) f = '0' + f; s += '.' + f; }
    return (v < 0 ? '-' : '') + s;
  }
  function fmtM(mm, sign) { return fmtFix(mm, 3, sign); }
  function fmtMM(mm, sign) { return fmtFix(mm, 0, sign); }
  function fmtZw(dm) { if (dm === null || dm === undefined) return ''; return dm % 10 === 0 ? fmtFix(dm / 10, 0) : fmtFix(dm, 1); }
  function fmtDez(x, dec) { return x === null || x === undefined ? '' : x.toFixed(dec).replace('.', ',').replace('-', '−'); }

  // rund(a / b), b > 0, kaufmännisch (.5 vom Nullpunkt weg) – exakt ganzzahlig
  function rndDiv(a, b) {
    var s = a < 0 ? -1 : 1;
    return s * Math.floor((2 * Math.abs(a) + b) / (2 * b));
  }

  /* ---------- Auswertung ---------- */

  function auswerten(p) {
    var e = {}, k;
    for (k in DEFAULT_EINST) e[k] = DEFAULT_EINST[k];
    if (p.einst) for (k in p.einst) if (p.einst[k] !== undefined && p.einst[k] !== null && p.einst[k] !== '') e[k] = p.einst[k];
    e.c = Number(e.c); e.maxZw = Number(e.maxZw); e.maxDiff = Number(e.maxDiff);
    e.maxDoppel = Number(e.maxDoppel); e.maxAblesung = Number(e.maxAblesung);

    var res = {
      einst: e, rows: [], setups: [], plaus: [], eingabe: [], warn: [], hinweise: [],
      expl: {}, doppel: [], zeilenWarn: {}
    };
    function zw(row, text, art) {
      (res.zeilenWarn[row] = res.zeilenWarn[row] || []).push({ text: text, art: art || 'warn' });
    }

    var ha = parseFix(p.HA, 3);
    if (ha.err) res.eingabe.push({ row: null, text: 'H_A: ' + ha.err });
    var HA = ha.v;
    var HEsoll = null;
    if (p.schleife) HEsoll = HA;
    else {
      var he = parseFix(p.HEsoll, 3);
      if (he.err) res.eingabe.push({ row: null, text: 'H_E,soll: ' + he.err });
      HEsoll = he.v;
    }
    res.HA = HA; res.HEsoll = HEsoll; res.schleife = !!p.schleife;

    // 1. Eingaben lesen
    var FELDER = [['R', 3, 'Rückblick'], ['Z', 3, 'Zwischenblick'], ['V', 3, 'Vorblick'], ['zwR', 1, 'Zielweite R'], ['zwV', 1, 'Zielweite V']];
    var P = (p.zeilen || []).map(function (z, i) {
      var o = { i: i, punkt: String(z.punkt || '').trim(), bem: z.bem || '' };
      FELDER.forEach(function (f) {
        var r = parseFix(z[f[0]], f[1]);
        o[f[0]] = r.v;
        var name = 'Zeile ' + (i + 1) + ' (' + (o.punkt || 'ohne Punktnr.') + '): ' + f[2];
        if (r.err) { res.eingabe.push({ row: i, feld: f[0], text: name + ' – ' + r.err }); zw(i, f[2] + ': ' + r.err, 'err'); }
        else if (r.v !== null && r.v < 0) { o[f[0]] = null; res.eingabe.push({ row: i, feld: f[0], text: name + ' darf nicht negativ sein' }); zw(i, f[2] + ' negativ', 'err'); }
      });
      return o;
    });
    res.P = P;

    // 2. Plausibilität Feldbuch (Infoblatt HSBK)
    var last = null, lastRow = null;
    function pl(row, text) { res.plaus.push({ row: row, text: 'Zeile ' + (row + 1) + ': ' + text }); zw(row, text, 'plaus'); }
    P.forEach(function (o) {
      var hasR = o.R !== null, hasZ = o.Z !== null, hasV = o.V !== null;
      if (!hasR && !hasZ && !hasV) return;
      if (!o.punkt) zw(o.i, 'Punktnummer fehlt', 'warn');
      if (hasZ && (hasR || hasV)) pl(o.i, 'Zwischenblick nicht mit Rück- oder Vorblick in einer Zeile kombinieren (eigene Zeile für den Zwischenpunkt).');
      var tok = [];
      if (hasV) tok.push('V');
      if (hasZ) tok.push('Z');
      if (hasR) tok.push('R');
      tok.forEach(function (t) {
        if (last === null && t !== 'R') pl(o.i, 'Die Messung beginnt mit einem Rückblick.');
        else if (t === 'R' && last === 'R') pl(o.i, 'Nie zwei Rückblicke hintereinander.');
        else if (t === 'R' && last === 'Z') pl(o.i, 'Nach Zwischenblicken folgt ein Vorblick (vor dem nächsten Rückblick fehlt ein Vorblick).');
        else if (t === 'V' && last === 'V') pl(o.i, 'Nie zwei Vorblicke hintereinander.');
        else if (t === 'Z' && last === 'V') pl(o.i, 'Vor einem Zwischenblick steht ein Rückblick.');
        last = t; lastRow = o.i;
      });
    });
    if (last !== null && last !== 'V') pl(lastRow, 'Die Messung endet mit einem Vorblick.');
    if (last === null) res.hinweise.push('Noch keine Ablesungen eingegeben.');

    // 3. Höhenrechnung (beide Rechenwege)
    var cur = null, begonnen = false;
    P.forEach(function (o) {
      var r = { i: o.i, typ: '', dh: null, H: null, H2: null, setup: null, setupNeu: null, K: null, Hk: null };
      var hasR = o.R !== null, hasZ = o.Z !== null, hasV = o.V !== null;
      if (hasV) {
        r.typ = hasR ? 'wp' : 'v';
        if (cur) {
          r.setup = cur.nr;
          if (cur.Hbase !== null) { r.dh = cur.R - o.V; r.H = cur.Hbase + r.dh; r.H2 = cur.visur - o.V; }
          cur.rowV = o.i; cur.V = o.V; cur.zwV = o.zwV; cur.dh = r.dh;
          cur = null;
        }
      }
      if (hasZ && !hasR && !hasV) {
        r.typ = 'z';
        if (cur) {
          r.setup = cur.nr; cur.zRows.push(o.i);
          if (cur.Hbase !== null) { r.dh = cur.R - o.Z; r.H = cur.Hbase + r.dh; r.H2 = cur.visur - o.Z; }
        }
      }
      if (hasR) {
        var base = null;
        if (hasV) base = r.H;
        else if (!begonnen) { base = HA; r.H = HA; r.H2 = HA; r.typ = 'start'; }
        else r.typ = 'r';
        cur = {
          nr: res.setups.length + 1, rowR: o.i, R: o.R, zwR: o.zwR, Hbase: base,
          visur: base !== null ? base + o.R : null, rowV: null, V: null, zwV: null, dh: null,
          zRows: [], s: null, diff: null, K: null, Kcum: null
        };
        res.setups.push(cur);
        r.setupNeu = cur.nr;
      }
      if (hasR || hasZ || hasV) begonnen = true;
      res.rows.push(r);
    });

    // 4. Summen und Rechenprobe
    var sR = 0, sV = 0, nZ = 0;
    P.forEach(function (o) { if (o.R !== null) sR += o.R; if (o.V !== null) sV += o.V; if (o.Z !== null) nZ++; });
    var sDh = 0;
    res.setups.forEach(function (s) { if (s.dh !== null) sDh += s.dh; });
    var lastV = null;
    P.forEach(function (o) { if (o.V !== null) lastV = o.i; });
    var HEgem = lastV !== null ? res.rows[lastV].H : null;
    var vollst = HA !== null && res.plaus.length === 0 && res.eingabe.length === 0 && res.setups.length > 0 &&
      res.setups.every(function (s) { return s.rowV !== null && s.Hbase !== null; });
    var rw2 = res.rows.every(function (r) { return r.H === r.H2; });
    var probe = null;
    if (vollst) probe = (sR - sV === sDh) && (sDh === HEgem - HA) && rw2;
    res.sum = { R: sR, V: sV, RV: sR - sV, dh: sDh, nZ: nZ, HEgem: HEgem, lastV: lastV, vollst: vollst, probe: probe, rw2: rw2 };

    // 5. Strecken, Zielweiten
    var sAll = res.setups.length > 0, S = 0, maxZw = null, maxZwOrt = '';
    res.setups.forEach(function (s) {
      if (s.zwR !== null && s.zwV !== null) { s.s = s.zwR + s.zwV; s.diff = s.zwR - s.zwV; S += s.s; }
      else sAll = false;
      if (s.diff !== null && Math.abs(s.diff) > e.maxDiff * 10)
        zw(s.rowV, 'Zielweitendifferenz Aufstellung I' + s.nr + ': ' + fmtZw(Math.abs(s.diff)) + ' m (> ' + e.maxDiff + ' m) – Instrument möglichst mittig aufstellen', 'warn');
    });
    P.forEach(function (o) {
      ['zwR', 'zwV'].forEach(function (f) {
        if (o[f] === null) return;
        if (maxZw === null || o[f] > maxZw) { maxZw = o[f]; maxZwOrt = o.punkt; }
        if (o[f] > e.maxZw * 10) zw(o.i, 'Zielweite ' + fmtZw(o[f]) + ' m > ' + e.maxZw + ' m (bei mm-Ablesung höchstens ca. 50 m)', 'warn');
      });
      ['R', 'Z', 'V'].forEach(function (f) {
        if (o[f] !== null && o[f] > e.maxAblesung * 1000) zw(o.i, 'Ablesung ' + fmtM(o[f]) + ' m größer als Lattenlänge (' + e.maxAblesung + ' m)?', 'warn');
      });
    });
    res.strecke = { alle: sAll, S: sAll ? S : null, maxZw: maxZw, maxZwOrt: maxZwOrt };

    // 6. Widerspruch, Grenzwert, Fehlerverteilung
    var dHsoll = (HEsoll !== null && HA !== null) ? HEsoll - HA : null;
    var Ktot = null, W = null, f = null, fOk = null;
    if (vollst && dHsoll !== null) { Ktot = dHsoll - (sR - sV); W = e.wKonv === 'b' ? -Ktot : Ktot; }
    if (sAll && S > 0) {
      f = e.c * Math.sqrt(S / 10000);
      if (W !== null) fOk = Math.abs(W) <= f + 1e-9;
    }
    var verteilt = false, ersatz = false;
    if (Ktot !== null) {
      if (sAll && S > 0) verteilt = fOk === true;
      else if (e.gleichVerteilen) { verteilt = true; ersatz = true; }
    }
    var sumK = null;
    if (verteilt) {
      var tot = 0, cum = 0, prev = 0;
      res.setups.forEach(function (s) { tot += ersatz ? 1 : s.s; });
      sumK = 0;
      res.setups.forEach(function (s) {
        s.cumPrev = cum;
        cum += ersatz ? 1 : s.s;
        s.cum = cum;
        var c = rndDiv(Ktot * cum, tot);
        s.K = c - prev; s.Kcum = c; s.KcumPrev = prev; prev = c; sumK += s.K;
      });
      res.gewichtTot = tot;
      res.rows.forEach(function (r) {
        if (r.typ === 'start') { r.Hk = r.H; return; }
        if (r.setup !== null && r.H !== null) {
          var s = res.setups[r.setup - 1];
          if (r.typ === 'v' || r.typ === 'wp') r.K = s.K;
          r.Hk = r.H + s.Kcum;
        }
      });
    }
    res.aus = {
      dHist: sR - sV, dHsoll: dHsoll, Ktot: Ktot, W: W, f: f, fOk: fOk, verteilt: verteilt, ersatz: ersatz,
      sumK: sumK, probeK: verteilt ? sumK === Ktot : null
    };

    // 7. Doppelaufnahmen (Kontrolle von Zwischenpunkten)
    var grp = {};
    res.rows.forEach(function (r) {
      var o = P[r.i];
      if (!o.punkt || r.H === null) return;
      var key = o.punkt.toLowerCase();
      (grp[key] = grp[key] || []).push(r);
    });
    Object.keys(grp).forEach(function (key) {
      var g = grp[key];
      if (g.length < 2 || !g.some(function (r) { return r.typ === 'z'; })) return;
      for (var j = 1; j < g.length; j++) {
        var a = g[0], b = g[j];
        var ha_ = verteilt ? a.Hk : a.H, hb_ = verteilt ? b.Hk : b.H;
        var d = hb_ - ha_;
        var ok = Math.abs(d) <= e.maxDoppel;
        res.doppel.push({ punkt: P[a.i].punkt, rowA: a.i, rowB: b.i, HA_: ha_, HB_: hb_, diff: d, ok: ok, korr: verteilt });
        if (!ok) zw(b.i, 'Doppelaufnahme weicht um ' + fmtMM(Math.abs(d)) + ' mm ab (> ' + e.maxDoppel + ' mm) – Punkt erneut messen', 'warn');
      }
    });

    // 8. Hinweise
    if (res.plaus.length) res.hinweise.push('Feldbuch nicht plausibel (siehe Meldungen) – die Auswertung ist erst nach Korrektur möglich.');
    if (vollst && dHsoll === null)
      res.hinweise.push('Keine Sollhöhe H_E: nur Rechenprobe möglich. Messfehler (z. B. Ablesefehler) bleiben unentdeckt! Abhilfe: an einen zweiten Höhenfestpunkt anschließen oder als Schleife zum Ausgangspunkt zurück messen.');
    if (vollst && dHsoll !== null && !(sAll && S > 0)) {
      if (e.gleichVerteilen) res.hinweise.push('Zielweiten unvollständig: Ersatzverfahren – Widerspruch gleichmäßig auf die Aufstellungen verteilt. Grenzwert f nicht prüfbar, Messfehler können unentdeckt bleiben.');
      else res.hinweise.push('Zielweiten unvollständig: kein Grenzwertnachweis und keine Fehlerverteilung, nur Rechenprobe. Messfehler können unentdeckt bleiben.');
    }
    if (fOk === false) res.hinweise.push('|W| > f: Der Widerspruch ist unzulässig – Messung wiederholen! (keine Fehlerverteilung)');
    if (nZ > 0) {
      var kontr = res.doppel.length > 0;
      res.hinweise.push('Zwischenblicke sind nicht durch den Abschluss kontrolliert' + (kontr ? ' – Doppelaufnahmen siehe Auswertung.' : '. Kontrolle nur durch Doppelaufnahme von einem zweiten Standpunkt.'));
    }
    Object.keys(res.zeilenWarn).forEach(function (row) {
      res.zeilenWarn[row].forEach(function (w) { if (w.art === 'warn') res.warn.push({ row: +row, text: 'Zeile ' + (+row + 1) + ': ' + w.text }); });
    });

    erklaerungen(res, P, e);
    return res;
  }

  /* ---------- Lernmodus: Erklärungen ---------- */

  function erklaerungen(res, P, e) {
    var X = res.expl, S = res.sum, A = res.aus, st = res.strecke;
    function ex(key, titel, formel, werte, ergebnis, note) { X[key] = { titel: titel, formel: formel, werte: werte, ergebnis: ergebnis, note: note || '' }; }
    function nm(i) { return P[i].punkt || ('Zeile ' + (i + 1)); }
    var KtotTxt = 'K_ges = ΔH_soll − ΔH_ist (Gesamtkorrektur, ' + (e.wKonv === 'b' ? '= −W' : '= W') + ')';

    res.rows.forEach(function (r) {
      var o = P[r.i];
      if (r.typ === 'start') {
        ex('r' + r.i + ':H', 'Höhe ' + nm(r.i) + ' (Anschlusspunkt)', 'H = H_A (gegebene Höhe des Höhenfestpunkts)',
          'H_A = ' + fmtM(res.HA) + ' m', 'H = ' + fmtM(r.H) + ' m ü. NHN',
          'Visurhöhe der Aufstellung I' + r.setupNeu + ': H_Visur = H + R = ' + fmtM(r.H) + ' + ' + fmtM(o.R) + ' = ' + fmtM(res.setups[r.setupNeu - 1].visur) + ' m');
        if (r.Hk !== null) ex('r' + r.i + ':Hk', 'Höhe korrigiert ' + nm(r.i), 'Anschlusspunkt: keine Korrektur', 'H = ' + fmtM(r.H) + ' m', 'H_korr = ' + fmtM(r.Hk) + ' m');
        return;
      }
      if (r.setup === null || r.H === null) return;
      var s = res.setups[r.setup - 1], abl = r.typ === 'z' ? o.Z : o.V, an = r.typ === 'z' ? 'Z' : 'V';
      var richt = r.dh > 0 ? ' (positiv = steigend)' : r.dh < 0 ? ' (negativ = fallend)' : ' (gleich hoch)';
      ex('r' + r.i + ':dh', 'Höhenunterschied Δh – Punkt ' + nm(r.i),
        'Δh = R − ' + an + '   (R = letzter Rückblick: Aufstellung I' + s.nr + ' auf Punkt ' + nm(s.rowR) + ')',
        'Δh = ' + fmtM(s.R) + ' m − ' + fmtM(abl) + ' m', 'Δh = ' + fmtM(r.dh, true) + ' m' + richt,
        r.typ === 'z' ? 'Zwischenblick: Bezug immer auf den letzten Wechselpunkt (Rückblick), nicht auf den vorherigen Zwischenpunkt. Δh eines Zwischenblicks zählt nicht in ΣΔh.' : '');
      ex('r' + r.i + ':H', 'Höhe gemessen – Punkt ' + nm(r.i),
        'Rechenweg 1: H_neu = H_alt + Δh\nRechenweg 2: H_neu = H_Visur − ' + an + '   mit H_Visur = H_alt + R',
        '1: H = ' + fmtM(s.Hbase) + ' m + (' + fmtM(r.dh, true) + ' m)\n2: H_Visur = ' + fmtM(s.Hbase) + ' + ' + fmtM(s.R) + ' = ' + fmtM(s.visur) + ' m;  H = ' + fmtM(s.visur) + ' − ' + fmtM(abl),
        'H = ' + fmtM(r.H) + ' m ü. NHN ' + (r.H === r.H2 ? '– beide Rechenwege stimmen überein ✓' : '– Rechenwege weichen ab ✗'));
      if (r.K !== null) {
        var g = A.ersatz ? 'Anzahl Aufstellungen' : 'Strecke';
        var u = function (x) { return A.ersatz ? String(x) : fmtZw(x) + ' m'; };
        ex('r' + r.i + ':K', 'Korrektion K – Aufstellung I' + s.nr,
          'K_i = rund(K_ges · Σs_bis i / s) − rund(K_ges · Σs_bis i−1 / s)\n' + KtotTxt + '\nVerteilung proportional zur ' + g + ', kumulativ in 1-mm-Schritten gerundet',
          'K_ges = ' + fmtMM(A.Ktot, true) + ' mm;  s = ' + u(res.gewichtTot) + ';  s_' + s.nr + ' = ' + (A.ersatz ? '1' : fmtZw(s.zwR) + ' + ' + fmtZw(s.zwV) + ' = ' + u(s.s)) +
          '\nK = rund(' + fmtMM(A.Ktot, true) + ' · ' + u(s.cum) + ' / ' + u(res.gewichtTot) + ') − rund(' + fmtMM(A.Ktot, true) + ' · ' + u(s.cumPrev) + ' / ' + u(res.gewichtTot) + ')' +
          '\n  = rund(' + fmtDez(A.Ktot * s.cum / res.gewichtTot, 3) + ') − rund(' + fmtDez(A.Ktot * s.cumPrev / res.gewichtTot, 3) + ') = ' + fmtMM(s.Kcum, true) + ' − (' + fmtMM(s.KcumPrev, true) + ')',
          'K_' + s.nr + ' = ' + fmtMM(s.K, true) + ' mm', 'Die kumulative Rundung sorgt dafür, dass ΣK exakt K_ges ergibt.');
      }
      if (r.Hk !== null) {
        ex('r' + r.i + ':Hk', 'Höhe korrigiert – Punkt ' + nm(r.i),
          'H_korr = H_gem + ΣK (kumulierte Korrektion bis einschließlich Aufstellung I' + s.nr + ')',
          'H_korr = ' + fmtM(r.H) + ' m + (' + fmtMM(s.Kcum, true) + ' mm)', 'H_korr = ' + fmtM(r.Hk) + ' m ü. NHN',
          r.typ === 'z' ? 'Zwischenpunkt: erhält die kumulierte Korrektur einschließlich seiner Aufstellung (Korrektur über den Rückblick der Aufstellung, wie im Lehrbuch).' : '');
      }
    });

    var rList = P.filter(function (o) { return o.R !== null; }).map(function (o) { return fmtM(o.R); });
    var vList = P.filter(function (o) { return o.V !== null; }).map(function (o) { return fmtM(o.V); });
    ex('sumR', 'Summe der Rückblicke ΣR', 'ΣR = R₁ + R₂ + …', 'ΣR = ' + (rList.join(' + ') || '0'), 'ΣR = ' + fmtM(S.R) + ' m');
    ex('sumV', 'Summe der Vorblicke ΣV', 'ΣV = V₁ + V₂ + …  (Zwischenblicke zählen NICHT)', 'ΣV = ' + (vList.join(' + ') || '0'), 'ΣV = ' + fmtM(S.V) + ' m');
    ex('sumRV', 'ΣR − ΣV', 'ΣR − ΣV', fmtM(S.R) + ' − ' + fmtM(S.V), '= ' + fmtM(S.RV, true) + ' m');
    var dhl = res.setups.filter(function (s) { return s.dh !== null; }).map(function (s) { return '(' + fmtM(s.dh, true) + ')'; });
    ex('sumDh', 'Summe der Höhenunterschiede ΣΔh', 'ΣΔh = Δh₁ + Δh₂ + …  (nur Vorblick-Zeilen, ohne Zwischenblicke)', 'ΣΔh = ' + (dhl.join(' + ') || '0'), 'ΣΔh = ' + fmtM(S.dh, true) + ' m');
    ex('HA', 'Anfangshöhe H_A', 'gegeben (Anschlusspunkt / Höhenfestpunkt)', 'H_A = ' + fmtM(res.HA) + ' m', 'H_A = ' + fmtM(res.HA) + ' m ü. NHN');
    if (S.HEgem !== null) ex('HE', 'Endhöhe H_E (gemessen)', 'H_E = Höhe des letzten Vorblickpunkts aus der Höhenrechnung', 'Punkt ' + nm(S.lastV), 'H_E = ' + fmtM(S.HEgem) + ' m ü. NHN');
    ex('dHist', 'Gemessener Höhenunterschied ΔH_ist', 'ΔH_ist = ΣR − ΣV', fmtM(S.R) + ' − ' + fmtM(S.V), 'ΔH_ist = ' + fmtM(A.dHist, true) + ' m');
    if (S.vollst) ex('probe', 'Rechenprobe (Summenprobe)', 'ΣR − ΣV = ΣΔh = H_E − H_A   und   Rechenweg 1 = Rechenweg 2 in jeder Zeile',
      fmtM(S.RV, true) + ' = ' + fmtM(S.dh, true) + ' = ' + fmtM(S.HEgem) + ' − ' + fmtM(res.HA) + ' = ' + fmtM(S.HEgem - res.HA, true),
      S.probe ? 'Rechenprobe o.k. ✓' : 'Rechenprobe NICHT erfüllt ✗',
      'Die Rechenprobe prüft nur das Rechnen, nicht das Messen. Ablesefehler deckt erst der Vergleich mit einer Sollhöhe auf.');
    if (st.alle) ex('s', 'Gesamtstrecke s', 's = Σ s_i  mit  s_i = Zielweite R + Zielweite V je Aufstellung (Zielweiten von Zwischenblicken zählen nicht)',
      res.setups.map(function (s) { return '(' + fmtZw(s.zwR) + ' + ' + fmtZw(s.zwV) + ')'; }).join(' + '),
      's = ' + fmtZw(st.S) + ' m = ' + fmtDez(st.S / 10000, 4) + ' km');
    if (st.maxZw !== null) ex('maxZw', 'Größte Zielweite', 'max(Zielweiten)', 'bei Punkt ' + (st.maxZwOrt || '?'), fmtZw(st.maxZw) + ' m ' + (st.maxZw > e.maxZw * 10 ? '> ' : '≤ ') + e.maxZw + ' m',
      'Lehrbuch: Zielweite höchstens ca. 50 m bei mm-Ablesung. Gleich lange Zielweiten R/V heben Restfehler (Ziellinienfehler, Erdkrümmung, Refraktion) weitgehend auf.');
    if (A.dHsoll !== null) ex('dHsoll', 'Soll-Höhenunterschied ΔH_soll', res.schleife ? 'Schleifennivellement (zurück zum Ausgangspunkt): ΔH_soll = 0' : 'ΔH_soll = H_E,soll − H_A',
      res.schleife ? 'H_E,soll = H_A' : fmtM(res.HEsoll) + ' − ' + fmtM(res.HA), 'ΔH_soll = ' + fmtM(A.dHsoll, true) + ' m');
    if (A.W !== null) ex('W', 'Widerspruch W', e.wKonv === 'b' ? 'W = ΔH_ist − ΔH_soll  (Konvention Infoblatt HSBK; Korrektion K = −W)' : 'W = ΔH_soll − ΔH_ist  (Konvention RWTH-Vordruck, Lehrbuch d = Soll − Ist; ΣK = W)',
      e.wKonv === 'b' ? 'W = ' + fmtM(A.dHist, true) + ' − (' + fmtM(A.dHsoll, true) + ')' : 'W = ' + fmtM(A.dHsoll, true) + ' − (' + fmtM(A.dHist, true) + ')',
      'W = ' + fmtM(A.W, true) + ' m = ' + fmtMM(A.W, true) + ' mm');
    if (A.f !== null) ex('f', 'Zulässiger Widerspruch f', 'f = c · √s   (f in mm, s in km, c = ' + fmtDez(e.c, 1).replace(',0', '') + ' – Unterrichtskonvention, keine Normfestlegung)',
      'f = ' + fmtDez(e.c, 1).replace(',0', '') + ' · √' + fmtDez(st.S / 10000, 4) + ' = ' + fmtDez(e.c, 1).replace(',0', '') + ' · ' + fmtDez(Math.sqrt(st.S / 10000), 4),
      'f = ' + fmtDez(A.f, 1) + ' mm');
    if (A.fOk !== null) ex('fOk', 'Nachweis |W| ≤ f', '|W| ≤ f', '|' + fmtMM(A.W, true) + '| mm ≤ ' + fmtDez(A.f, 1) + ' mm ?',
      A.fOk ? 'eingehalten ✓ – Widerspruch wird verteilt' : 'NICHT eingehalten ✗ – Messung wiederholen');
    if (A.sumK !== null) ex('sumK', 'Probe ΣK', 'ΣK = K₁ + K₂ + … muss ' + (e.wKonv === 'b' ? '−W' : 'W') + ' ergeben',
      'ΣK = ' + res.setups.map(function (s) { return '(' + fmtMM(s.K, true) + ')'; }).join(' + '),
      'ΣK = ' + fmtMM(A.sumK, true) + ' mm ' + (A.probeK ? '= ' + (e.wKonv === 'b' ? '−W' : 'W') + ' ✓' : '≠ ✗'));
  }

  /* ---------- Absteckung ---------- */
  function absteckung(visurMM, sollStr) {
    var h = parseFix(sollStr, 3);
    if (h.err) return { err: h.err };
    if (h.v === null || visurMM === null) return { v: null };
    var a = visurMM - h.v;
    var w = null;
    if (a < 0) w = 'Sollhöhe liegt über der Visur – so nicht absteckbar (Instrument höher aufstellen oder Latte umgekehrt am Punkt).';
    else if (a > 5000) w = 'Ablesung über 5 m – größer als übliche Lattenlänge.';
    return { v: a, warn: w, soll: h.v };
  }

  /* ---------- Übungsaufgaben ---------- */
  function zufall(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function erzeugeUebung(opt) {
    opt = opt || {};
    var n = zufall(3, 5), HA = zufall(30000, 120000);
    var setups = [], fehler = 0, Hw = HA;
    var zbem = ['OK Gelände', 'Kanaldeckel', 'Bordstein OK', 'Grenzstein', 'Straßenablauf / Gully', 'OK Gelände Bestand'];
    for (var k = 0; k < n; k++) {
      var R = zufall(800, 3600), V;
      do { V = zufall(400, 3800); } while (Math.abs(R - V) < 50);
      var zwR = zufall(15, 45), zwV = Math.max(10, zwR + zufall(-3, 3));
      var Vtrue = V;
      var noise = opt.mitSoll === false ? 0 : zufall(-1, 1);
      var zs = [];
      if (opt.mitZ !== false && Math.random() < 0.55) {
        var nz = zufall(1, 2);
        for (var j = 0; j < nz; j++) zs.push({ Z: zufall(500, 3900), zw: zufall(5, 40), bem: zbem[zufall(0, zbem.length - 1)] });
      }
      Hw += R - Vtrue;
      setups.push({ R: R, V: V + noise, zwR: zwR, zwV: zwV, zs: zs });
      fehler += noise;
    }
    var HEtrue = Hw;
    var rows = [], zNr = 1;
    rows.push({ punkt: 'A', zwR: String(setups[0].zwR), zwV: '', R: fmtM(setups[0].R), Z: '', V: '', bem: 'Anschlusspunkt (Höhenfestpunkt)' });
    setups.forEach(function (s, k) {
      s.zs.forEach(function (z) { rows.push({ punkt: String(zNr++), zwR: '', zwV: String(z.zw), R: '', Z: fmtM(z.Z), V: '', bem: z.bem }); });
      var letzte = k === setups.length - 1;
      if (letzte) rows.push({ punkt: 'E', zwR: '', zwV: String(s.zwV), R: '', Z: '', V: fmtM(s.V), bem: opt.mitSoll === false ? 'Endpunkt' : 'Endpunkt (Höhenfestpunkt)' });
      else rows.push({ punkt: 'WP' + (k + 1), zwR: String(setups[k + 1].zwR), zwV: String(s.zwV), R: fmtM(setups[k + 1].R), Z: '', V: fmtM(s.V), bem: 'Wechselpunkt' });
    });
    return {
      kopf: { projekt: 'Übungsaufgabe ' + new Date().toLocaleDateString('de-DE'), instrument: '', datum: '', wetter: '', feldbuchfuehrer: '', beobachter: '', bearbeiter: '', blatt: '1' },
      HA: fmtM(HA), HEsoll: opt.mitSoll === false ? '' : fmtM(HEtrue), schleife: false,
      einst: {}, zeilen: rows
    };
  }

  /* ---------- CSV ---------- */
  var META = [['projekt', 'Projekt'], ['instrument', 'Instrument'], ['datum', 'Datum'], ['wetter', 'Wetter'],
    ['feldbuchfuehrer', 'Feldbuchführer'], ['beobachter', 'Beobachter'], ['bearbeiter', 'Bearbeiter'], ['blatt', 'Blatt']];

  function csvCell(v) {
    v = v === null || v === undefined ? '' : String(v);
    return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCSV(p) {
    var L = [];
    META.forEach(function (m) { L.push([m[1], (p.kopf || {})[m[0]] || '']); });
    L.push(['H_A', p.HA || '']);
    L.push(['H_E,soll', p.schleife ? '' : (p.HEsoll || '')]);
    L.push(['Schleife', p.schleife ? 'ja' : 'nein']);
    L.push([]);
    L.push(['Punkt', 'ZwR', 'ZwV', 'R', 'Z', 'V', 'Bemerkung']);
    (p.zeilen || []).forEach(function (z) {
      L.push([z.punkt, z.zwR, z.zwV, z.R, z.Z, z.V, z.bem].map(function (x) { return x || ''; }));
    });
    return L.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }
  function parseCSVText(t) {
    t = t.replace(/^﻿/, '');
    var first = t.split(/\r?\n/).slice(0, 20).join('\n');
    var cnt = function (c) { return (first.match(new RegExp('\\' + c, 'g')) || []).length; };
    var d = cnt(';') >= cnt('\t') && cnt(';') >= cnt(',') ? ';' : (cnt('\t') >= cnt(',') ? '\t' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { rows: rows, delim: d };
  }
  function importCSV(text) {
    var pr = parseCSVText(text), rows = pr.rows;
    var p = { kopf: {}, HA: '', HEsoll: '', schleife: false, einst: {}, zeilen: [] };
    var norm = function (s) { return String(s || '').trim().toLowerCase().replace(/[\s_.\-\/]/g, '').replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe'); };
    var MAP = {
      punkt: 'punkt', pkt: 'punkt', punktnr: 'punkt', zwr: 'zwR', zielweiter: 'zwR', zwv: 'zwV', zielweitev: 'zwV',
      r: 'R', rueckblick: 'R', z: 'Z', zwischenblick: 'Z', mittelblick: 'Z', v: 'V', vorblick: 'V', bemerkung: 'bem', bem: 'bem'
    };
    var hdr = -1, cols = null, warn = [];
    for (var i = 0; i < rows.length; i++) {
      var c0 = norm(rows[i][0]);
      if (hdr < 0) {
        if (MAP[c0] === 'punkt') {
          hdr = i; cols = rows[i].map(function (h) { return MAP[norm(h)] || null; });
          continue;
        }
        var val = (rows[i][1] || '').trim();
        META.forEach(function (m) { if (norm(m[1]) === c0) p.kopf[m[0]] = val; });
        if (c0 === 'ha') p.HA = val;
        if (c0 === 'he,soll' || c0 === 'hesoll' || c0 === 'he') p.HEsoll = val;
        if (c0 === 'schleife') p.schleife = /^(ja|1|true|x)$/i.test(val);
      } else {
        if (rows[i].every(function (x) { return String(x).trim() === ''; })) continue;
        var z = { punkt: '', zwR: '', zwV: '', R: '', Z: '', V: '', bem: '' };
        cols.forEach(function (k, j) {
          if (!k) return;
          var v = String(rows[i][j] || '').trim();
          if (k !== 'punkt' && k !== 'bem' && pr.delim === ',') v = v.replace('.', ',');
          z[k] = v;
        });
        p.zeilen.push(z);
      }
    }
    if (hdr < 0) throw new Error('Keine Kopfzeile gefunden (erste Spalte „Punkt“ erwartet).');
    if (!cols.some(function (c) { return c === 'R'; }) || !cols.some(function (c) { return c === 'V'; })) warn.push('Spalten R und/oder V nicht erkannt.');
    p.importWarn = warn;
    return p;
  }

  /* ---------- XLSX (mit Formeln, ohne Bibliothek) ---------- */
  var CRC = (function () {
    var t = [], c;
    for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var u = unescape(encodeURIComponent(s)), a = new Uint8Array(u.length);
    for (var i = 0; i < u.length; i++) a[i] = u.charCodeAt(i);
    return a;
  }
  function zip(files) { // [{name, data:Uint8Array}] – Methode "stored"
    var parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var nm = utf8(f.name), crc = crc32(f.data), sz = f.data.length;
      var lh = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz), u16(nm.length), u16(0));
      parts.push(new Uint8Array(lh), nm, f.data);
      central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(sz), u32(sz),
        u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off)), nm);
      off += lh.length + nm.length + sz;
    });
    var cdStart = off, cdLen = 0;
    central.forEach(function (c, i) {
      var a = i % 2 === 0 ? new Uint8Array(c) : c;
      parts.push(a); cdLen += a.length;
    });
    parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdLen), u32(cdStart), u16(0))));
    var tot = 0; parts.forEach(function (x) { tot += x.length; });
    var out = new Uint8Array(tot), o = 0;
    parts.forEach(function (x) { out.set(x, o); o += x.length; });
    return out;
  }
  function xe(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(c) { var s = ''; c++; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

  // Stile: 0 Standard, 1 fett, 2 Eingabe Text, 3 Eingabe 0.000, 4 Eingabe 0.0, 5 berechnet 0.000,
  // 6 berechnet 0, 7 berechnet 0.0, 8 Kopfzeile, 9 berechnet Text, 10 Titel, 11 berechnet 0.0000
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="4"><numFmt numFmtId="164" formatCode="0.000"/><numFmt numFmtId="165" formatCode="+0;-0;0"/><numFmt numFmtId="166" formatCode="0.0"/><numFmt numFmtId="167" formatCode="0.0000"/></numFmts>' +
    '<fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font></fonts>' +
    '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF5CC"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEFF2"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9E2EC"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FF9AA5B1"/></left><right style="thin"><color rgb="FF9AA5B1"/></right><top style="thin"><color rgb="FF9AA5B1"/></top><bottom style="thin"><color rgb="FF9AA5B1"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="12">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="166" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center" horizontal="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="167" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function buildXlsx(p, res) {
    var cells = {}; // "r,c" -> xml
    var maxR = 0;
    function put(r, c, xml) { cells[r + ',' + c] = xml; if (r > maxR) maxR = r; }
    function ref(r, c, abs) { return abs ? '$' + colName(c) + '$' + r : colName(c) + r; }
    function str(r, c, v, s) { if (v === '' || v === null || v === undefined) { if (s) put(r, c, '<c r="' + ref(r, c) + '" s="' + s + '"/>'); return; } put(r, c, '<c r="' + ref(r, c) + '" s="' + (s || 0) + '" t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>'); }
    function num(r, c, v, s) { if (v === null || v === undefined || v === '') { put(r, c, '<c r="' + ref(r, c) + '" s="' + s + '"/>'); return; } put(r, c, '<c r="' + ref(r, c) + '" s="' + s + '"><v>' + v + '</v></c>'); }
    function fml(r, c, f, v, s) { put(r, c, '<c r="' + ref(r, c) + '" s="' + s + '"' + (typeof v === 'string' && !/^-?[\d.]+$/.test(v) ? ' t="str"' : '') + '><f>' + xe(f) + '</f>' + (v === null || v === undefined ? '' : '<v>' + xe(v) + '</v>') + '</c>'); }
    var m3 = function (mm) { return plainFix(mm, 3); }, d1 = function (dm) { return plainFix(dm, 1); };
    var K = p.kopf || {}, e = res.einst, A = res.aus, S = res.sum;

    str(1, 0, 'Nivellement – Feldbuch und Auswertung', 10);
    str(1, 6, 'Lern- und Übungswerkzeug, kein amtliches Vermessungsprogramm', 0);
    var kopf = [['Projekt', K.projekt], ['Instrument', K.instrument], ['Datum', K.datum], ['Wetter', K.wetter],
      ['Feldbuchführer', K.feldbuchfuehrer], ['Beobachter', K.beobachter], ['Bearbeiter', K.bearbeiter], ['Blatt', K.blatt]];
    kopf.forEach(function (k, i) {
      var r = 2 + (i % 4), c = i < 4 ? 0 : 4;
      str(r, c, k[0], 1); str(r, c + 1, k[1] || '', 2);
    });
    // Parameter
    var PR = 7;
    str(PR, 0, 'H_A [m]', 1); num(PR, 1, res.HA !== null ? m3(res.HA) : '', 3);
    str(PR, 2, 'H_E,soll [m]', 1);
    if (res.schleife) fml(PR, 3, 'B' + PR, res.HA !== null ? m3(res.HA) : null, 5);
    else num(PR, 3, res.HEsoll !== null ? m3(res.HEsoll) : '', 3);
    str(PR, 4, 'c [mm/√km]', 1); num(PR, 5, String(e.c), 4);
    str(PR, 6, res.schleife ? 'Schleifennivellement: H_E,soll = H_A' : '', 0);
    str(PR, 9, 'Gelb = Eingabe, Grau = berechnet (Formel)', 0);

    var HR = 9, R0 = 10;
    var H = ['Punkt', 'Zielweite R [m]', 'Zielweite V [m]', 'Rückblick R [m]', 'Zwischenblick Z [m]', 'Vorblick V [m]', 'Δh [m]',
      'Korrektion K [mm]', 'Höhe gemessen [m ü. NHN]', 'Höhe korrigiert [m ü. NHN]', 'Bemerkung',
      'Visurhöhe [m] (Rechenweg 2)', 'Höhe Rechenweg 2 [m]', A.ersatz ? 'Gewicht (1 je Aufstellung)' : 's_i [m]', A.ersatz ? 'Σ Gewicht' : 'Σs [m]', 'ΣK [mm]'];
    H.forEach(function (h, c) { str(HR, c, h, 8); });
    var P = res.P, rowOf = function (i) { return R0 + i; };
    var n = P.length, rEnd = R0 + Math.max(n, 1) - 1;
    var sumRow = rEnd + 3; // Auswertungsblock beginnt hier
    var REF = {}; // Bezeichner -> Zellbezug im Auswertungsblock
    var labels = ['ΣR [m]', 'ΣV [m]', 'ΣR − ΣV [m]', 'ΣΔh [m]', 'H_A [m]', 'H_E gemessen [m]', 'ΔH_ist = ΣR − ΣV [m]', 'Rechenprobe',
      's [m]', 's [km]', 'größte Zielweite [m]', 'ΔH_soll = H_E,soll − H_A [m]', 'K_ges = ΔH_soll − ΔH_ist [mm]',
      (e.wKonv === 'b' ? 'W = ΔH_ist − ΔH_soll [mm]' : 'W = ΔH_soll − ΔH_ist [mm]'), 'W [m]', 'f = c · √s [mm]', '|W| ≤ f', 'ΣK [mm]', (e.wKonv === 'b' ? 'Probe ΣK = −W' : 'Probe ΣK = W')];
    var keys = ['sR', 'sV', 'sRV', 'sDh', 'HA', 'HE', 'dHist', 'probe', 's', 'skm', 'maxZw', 'dHsoll', 'Ktot', 'W', 'Wm', 'f', 'fOk', 'sumK', 'probeK'];
    keys.forEach(function (k, j) { REF[k] = ref(sumRow + 1 + j, 1, true); });

    // Datenzeilen
    var prevVrow = null;
    P.forEach(function (o, i) {
      var r = rowOf(i), x = res.rows[i];
      str(r, 0, o.punkt, 2);
      num(r, 1, o.zwR !== null ? d1(o.zwR) : '', 4);
      num(r, 2, o.zwV !== null ? d1(o.zwV) : '', 4);
      num(r, 3, o.R !== null ? m3(o.R) : '', 3);
      num(r, 4, o.Z !== null ? m3(o.Z) : '', 3);
      num(r, 5, o.V !== null ? m3(o.V) : '', 3);
      str(r, 10, o.bem, 2);
      var s = x.setup !== null ? res.setups[x.setup - 1] : null;
      if (x.typ === 'start') {
        if (x.H !== null) fml(r, 8, '$B$' + PR, m3(x.H), 5);
        if (A.verteilt) fml(r, 9, 'I' + r, m3(x.Hk), 5);
      }
      if (s && x.H !== null) {
        var rR = rowOf(s.rowR), col = x.typ === 'z' ? 'E' : 'F';
        fml(r, 6, 'D' + rR + '-' + col + r, m3(x.dh), 5);
        fml(r, 8, 'I' + rR + '+G' + r, m3(x.H), 5);
        fml(r, 12, 'L' + rR + '-' + col + r, m3(x.H2), 5);
        if (x.typ === 'v' || x.typ === 'wp') {
          if (A.verteilt) {
            if (A.ersatz) num(r, 13, '1', 7); else fml(r, 13, 'B' + rR + '+C' + r, d1(s.s), 7);
            fml(r, 14, prevVrow ? 'O' + prevVrow + '+N' + r : 'N' + r, A.ersatz ? String(s.cum) : d1(s.cum), 7);
            var kf = 'ROUND(' + REF.Ktot + '*O' + r + '/' + REF.s + ',0)' + (prevVrow ? '-ROUND(' + REF.Ktot + '*O' + prevVrow + '/' + REF.s + ',0)' : '');
            fml(r, 7, kf, String(s.K), 6);
            fml(r, 15, prevVrow ? 'P' + prevVrow + '+H' + r : 'H' + r, String(s.Kcum), 6);
            fml(r, 9, 'I' + r + '+P' + r + '/1000', m3(x.Hk), 5);
          } else if (res.strecke.alle) {
            fml(r, 13, 'B' + rR + '+C' + r, d1(s.s), 7);
            fml(r, 14, prevVrow ? 'O' + prevVrow + '+N' + r : 'N' + r, d1(s.cum !== undefined ? s.cum : 0), 7);
          }
          prevVrow = r;
        }
      }
      if (x.setupNeu !== null && x.H !== null) {
        fml(r, 11, 'I' + r + '+D' + r, m3(res.setups[x.setupNeu - 1].visur), 5);
      }
    });
    // Zwischenpunkte: korrigierte Höhe mit ΣK der eigenen Aufstellung (V-Zeile folgt später)
    if (A.verteilt) P.forEach(function (o, i) {
      var x = res.rows[i];
      if (x.typ === 'z' && x.Hk !== null) {
        var s = res.setups[x.setup - 1];
        fml(rowOf(i), 9, 'I' + rowOf(i) + '+P' + rowOf(s.rowV) + '/1000', m3(x.Hk), 5);
      }
    });
    // Σs-Spalte ohne Verteilung: kumulativ nachtragen (Werte)
    if (!A.verteilt && res.strecke.alle) {
      var cm = 0; res.setups.forEach(function (s) { cm += s.s; var r = rowOf(s.rowV); var c = cells[r + ',14']; if (c) cells[r + ',14'] = c.replace(/<v>[^<]*<\/v>/, '<v>' + d1(cm) + '</v>'); });
    }

    // Auswertungsblock
    var rng = function (c) { return c + R0 + ':' + c + rEnd; };
    str(sumRow, 0, 'Auswertung', 10);
    var lastVrow = S.lastV !== null ? rowOf(S.lastV) : null;
    var j = 0;
    function line(label, f, v, s, note) {
      var r = sumRow + 1 + j; j++;
      str(r, 0, label, 1);
      if (f === null) { if (v !== null && v !== undefined) str(r, 1, v, 9); else str(r, 1, '–', 9); }
      else fml(r, 1, f, v, s);
      if (note) str(r, 2, note, 0);
    }
    line(labels[0], 'SUM(' + rng('D') + ')', m3(S.R), 5);
    line(labels[1], 'SUM(' + rng('F') + ')', m3(S.V), 5, 'Zwischenblicke zählen nicht in ΣV');
    line(labels[2], REF.sR + '-' + REF.sV, m3(S.RV), 5);
    line(labels[3], 'SUMIF(' + rng('F') + ',"<>",' + rng('G') + ')', m3(S.dh), 5, 'nur Vorblick-Zeilen');
    line(labels[4], '$B$' + PR, res.HA !== null ? m3(res.HA) : null, 5);
    line(labels[5], lastVrow ? 'I' + lastVrow : null, lastVrow && S.HEgem !== null ? m3(S.HEgem) : null, 5);
    line(labels[6], REF.sR + '-' + REF.sV, m3(A.dHist), 5);
    line(labels[7], S.vollst ? 'IF(AND(ROUND(' + REF.sRV + '-' + REF.sDh + ',3)=0,ROUND(' + REF.sDh + '-(' + REF.HE + '-' + REF.HA + '),3)=0),"o.k.","Fehler")' : null,
      S.vollst ? (S.probe ? 'o.k.' : 'Fehler') : 'nicht möglich (Feldbuch unvollständig)', 9);
    var sAll = res.strecke.alle;
    line(labels[8], sAll ? 'SUM(' + rng('N') + ')' : null, sAll ? d1(res.strecke.S) : (A.ersatz ? 'Zielweiten unvollständig' : null), 7, A.ersatz ? 'Ersatzverfahren: Gewicht 1 je Aufstellung' : 'Zielweiten von Zwischenblicken zählen nicht');
    if (A.ersatz) {
      // für die K-Formeln steht in REF.s die Anzahl der Aufstellungen
      cells[(sumRow + 9) + ',1'] = '<c r="B' + (sumRow + 9) + '" s="7"><f>SUM(' + rng('N') + ')</f><v>' + res.setups.length + '</v></c>';
      str(sumRow + 9, 2, 'Anzahl Aufstellungen (Ersatzverfahren ohne Zielweiten)', 0);
    }
    line(labels[9], sAll ? REF.s + '/1000' : null, sAll ? String(res.strecke.S / 10000) : null, 11);
    line(labels[10], res.strecke.maxZw !== null ? 'MAX(' + rng('B') + ',' + rng('C') + ')' : null, res.strecke.maxZw !== null ? d1(res.strecke.maxZw) : null, 7, 'Lehrbuch: höchstens ca. ' + e.maxZw + ' m bei mm-Ablesung');
    var hs = A.dHsoll !== null;
    line(labels[11], hs ? '$D$' + PR + '-$B$' + PR : null, hs ? m3(A.dHsoll) : 'keine Sollhöhe – nur Rechenprobe, Messfehler bleiben unentdeckt', 5);
    line(labels[12], hs && A.Ktot !== null ? 'ROUND((' + REF.dHsoll + '-' + REF.dHist + ')*1000,0)' : null, A.Ktot !== null ? String(A.Ktot) : null, 6);
    line(labels[13], A.W !== null ? (e.wKonv === 'b' ? '-' + REF.Ktot : REF.Ktot) : null, A.W !== null ? String(A.W) : null, 6);
    line(labels[14], A.W !== null ? REF.W + '/1000' : null, A.W !== null ? m3(A.W) : null, 5);
    line(labels[15], A.f !== null ? '$F$' + PR + '*SQRT(' + REF.skm + ')' : null, A.f !== null ? String(A.f) : null, 7, 'c einstellbar (Unterrichtskonvention, keine Norm)');
    line(labels[16], A.fOk !== null ? 'IF(ABS(' + REF.W + ')<=' + REF.f + ',"eingehalten","nicht eingehalten – Messung wiederholen")' : null,
      A.fOk === null ? null : (A.fOk ? 'eingehalten' : 'nicht eingehalten – Messung wiederholen'), 9);
    line(labels[17], A.verteilt ? 'SUM(' + rng('H') + ')' : null, A.verteilt ? String(A.sumK) : 'keine Fehlerverteilung', 6);
    line(labels[18], A.verteilt ? 'IF(' + REF.sumK + '=' + REF.Ktot + ',"o.k.","Fehler")' : null, A.verteilt ? (A.probeK ? 'o.k.' : 'Fehler') : null, 9);
    var hr = sumRow + 2 + keys.length;
    res.hinweise.forEach(function (h, k) { str(hr + k, 0, '• ' + h, 0); });

    // Sheet-XML
    var byRow = {};
    Object.keys(cells).forEach(function (k) { var a = k.split(','); (byRow[a[0]] = byRow[a[0]] || []).push([+a[1], cells[k]]); });
    var sd = Object.keys(byRow).map(Number).sort(function (a, b) { return a - b; }).map(function (r) {
      var cs = byRow[r].sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }).join('');
      return '<row r="' + r + '"' + (r === HR ? ' ht="40" customHeight="1"' : '') + '>' + cs + '</row>';
    }).join('');
    var widths = [26, 10, 10, 11, 12, 11, 10, 11, 14, 14, 30, 14, 13, 9, 9, 9];
    var cols = '<cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="' + HR + '" topLeftCell="A' + (HR + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="13"/>' + cols + '<sheetData>' + sd + '</sheetData>' +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    var files = [
      { name: '[Content_Types].xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>') },
      { name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
      { name: 'xl/workbook.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Nivellement" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>') },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
      { name: 'xl/styles.xml', data: utf8(STYLES) },
      { name: 'xl/worksheets/sheet1.xml', data: utf8(sheet) }
    ];
    return zip(files);
  }

  var API = {
    DEFAULT_EINST: DEFAULT_EINST, BEMERKUNGEN: BEMERKUNGEN,
    parseFix: parseFix, fmtFix: fmtFix, fmtM: fmtM, fmtMM: fmtMM, fmtZw: fmtZw, fmtDez: fmtDez, plainFix: plainFix,
    rndDiv: rndDiv, auswerten: auswerten, absteckung: absteckung, erzeugeUebung: erzeugeUebung,
    exportCSV: exportCSV, importCSV: importCSV, buildXlsx: buildXlsx
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.NivCore = API;
})(this);
