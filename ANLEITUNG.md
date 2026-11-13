# Nivellement – Lern- und Auswerte-App

Lern-, Übungs- und Auswertewerkzeug für das geometrische Liniennivellement mit Zwischenpunkten.
Fachschule für Bautechnik, Hans-Sachs-Berufskolleg Oberhausen, Klasse FH 21.
**Lernwerkzeug, kein amtliches Vermessungsprogramm.**

## Starten

| Weg | Wie | Offline |
|---|---|---|
| Lokal am PC | Ordner `nivellement` kopieren, `index.html` doppelklicken | ja (alles in den Dateien, keine Internet-Bibliotheken) |
| Als App (Handy/Tablet) | Ordner auf einen Webserver legen (z. B. GitHub Pages, Schulserver). Seite öffnen, dann im Browser „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ | ja, nach dem ersten Aufruf (Service Worker) |
| Test am PC mit Webserver | im Ordner `GModG`: `python -m http.server 8765 --directory nivellement`, dann http://localhost:8765 | – |

Daten liegen nur im Browser des jeweiligen Geräts (localStorage). Es gibt keinen Server und kein Login.
Regelmäßig über **Projekte & Export → Sicherung (.json)** sichern.

## Bedienung (kurz)

1. **Feldbuch:** H_A eintragen. Bei Anschluss an einen zweiten Festpunkt H_E,soll eintragen oder „Schleifennivellement“ anhaken.
2. **Eine Zeile je Punkt.** Gelbe Felder sind Eingaben, graue Felder rechnet die App.
   - Wechselpunkt: **V und R in derselben Zeile** (V zur alten, R zur neuen Aufstellung).
   - Zwischenpunkt: eigene Zeile, nur **Z** (Zielweite in Spalte „Zielweite V“).
   - Zielweiten: Zielweite R in der Zeile des Rückblicks, Zielweite V in der Zeile des Vorblicks.
   - Die Spalte Nr./Typ zeigt AP (Anschlusspunkt), WP, ZP, EP (Endpunkt).
   - Enter springt in dieselbe Spalte der nächsten Zeile.
3. **Meldungen** unter der Tabelle: rot = Eingabe/Plausibilität, gelb = Warnung, blau = Hinweis, grün = Probe o.k. Ein Tipp auf die Meldung springt zur Zeile.
4. **Lernmodus** (Schalter oben rechts): Eine graue Zelle oder einen Wert der Auswertung antippen. Es erscheinen Formel, eingesetzte Werte und Ergebnis mit Einheit.
5. **Einstellungen je Projekt:** Faktor c, Vorzeichen von W (RWTH / HSBK), Warngrenzen, Ersatzverfahren ohne Zielweiten.
6. **Skizze:** schematische Ansicht (unmaßstäblich) mit ⊗ Standpunkt, ○ Wechselpunkt, ● Zwischenpunkt, Latten, Ablesungen, Messrichtung.
7. **Abstecken:** Aufstellung wählen (oder Visurhöhe manuell eingeben), Sollhöhe eintragen. Die App zeigt die Soll-Lattenablesung = H_Visur − H_Soll. Mit einer Ist-Ablesung zeigt sie die Abweichung in mm (zu hoch / zu tief).
8. **Üben:** „Neue Aufgabe“ erzeugt ein zufälliges Feldbuch. Du rechnest Höhen, K, korrigierte Höhen, ΣR, ΣV, W und f, dann „Prüfen“. Mit „Ins Feldbuch übernehmen“ lässt sich der Rechenweg im Lernmodus ansehen.
9. **Projekte & Export:**
   - Excel (.xlsx) **mit echten Formeln** (Δh, Höhen über beide Rechenwege, s, K, ΣK, W, f, Nachweis)
   - PDF über den Druckdialog („Als PDF speichern“, A4 quer, Seite 2 = Skizze)
   - CSV-Export und -Import, Sicherung (.json)
   - Beispiele A–C laden

CSV-Format (Semikolon, Dezimalkomma, UTF-8):
```
Projekt;Übung 1
H_A;74,251
H_E,soll;
Schleife;nein

Punkt;ZwR;ZwV;R;Z;V;Bemerkung
A;;;2,431;;;Anschlusspunkt (Höhenfestpunkt)
WP1;;;0,338;;2,371;Wechselpunkt
```
Beim Import werden auch Komma-getrennte Dateien mit Dezimalpunkt sowie Spaltennamen wie „Rückblick“, „Vorblick“, „Zwischenblick“, „Pkt“ erkannt.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche und Gestaltung, Drucklayout (Vordruck) |
| `core.js` | Rechenkern: Plausibilität, Höhen (2 Rechenwege), Summenprobe, W, f, Fehlerverteilung, Erklärungen, CSV, Excel-Export |
| `app.js` | Bedienung, Skizze, Abstecken, Üben, Speicher, Export |
| `beispiele.js` | Testfälle A–C als Beispielprojekte |
| `tests.html` | automatisches Prüfprotokoll (im Browser öffnen) |
| `manifest.json`, `sw.js`, `icon*.png/svg` | Installation als App und Offline-Betrieb |

## Prüfprotokoll (Soll/Ist)

Automatisch mit `tests.html` geprüft: **46 von 46 Prüfungen bestanden.**

### Testfall A – Übung 1 (LfVT-Feldbuch, ohne Endhöhe)
| Größe | Soll | Ist | |
|---|---|---|---|
| ΣR | 16,044 | 16,044 | ✓ |
| ΣV | 21,090 | 21,090 | ✓ |
| ΔH = ΣR − ΣV | −5,046 m | −5,046 m | ✓ |
| H_WP1 | 74,311 | 74,311 | ✓ |
| H_5 | 73,991 | 73,991 | ✓ |
| H_10 | 69,429 | 69,429 | ✓ |
| H_E | 69,205 m ü. NHN | 69,205 | ✓ |
| Rechenprobe | o.k. | o.k. | ✓ |
| Fehlerverteilung | keine | keine | ✓ |
| Hinweis „Messfehler bleiben unentdeckt“ | angezeigt | angezeigt | ✓ |

### Testfall B – Lehrbuchbeispiel mit Zwischenpunkt (Zielweiten angenommen)
| Größe | Soll | Ist | |
|---|---|---|---|
| ΣR | 8,632 | 8,632 | ✓ |
| ΣV | 4,851 | 4,851 | ✓ |
| ΔH_ist | 3,781 | +3,781 | ✓ |
| ΔH_soll | 3,785 | +3,785 | ✓ |
| W | +4 mm | +4 mm | ✓ |
| s | 130 m | 130 m | ✓ |
| f | 5,4 mm (eingehalten) | 5,4 mm, eingehalten | ✓ |
| K | +2 / +1 / +1 mm | +2 / +1 / +1 mm | ✓ |
| ΣK = W | o.k. | o.k. | ✓ |
| H korr. W1 | 433,432 | 433,432 | ✓ |
| H korr. Z | 434,218 | 434,218 | ✓ |
| H korr. W2 | 434,361 | 434,361 | ✓ |
| H korr. ② | 435,135 | 435,135 | ✓ |
| Gegenprobe Konvention b (HSBK) | W = −4 mm, K +2/+1/+1 | W = −4 mm, K +2/+1/+1 | ✓ |

### Testfall C – Infoblatt HSBK (Δh-Bildung)
| Größe | Soll | Ist | |
|---|---|---|---|
| Δh (500 → WP1) | +0,360 | +0,360 | ✓ |
| Δh (100 → 1) | −0,080 | −0,080 | ✓ |
| Δh (100 → 2) | −0,165 | −0,165 | ✓ |
| Δh (100 → 3) | −0,180 | −0,180 | ✓ |
| Plausibilitätsmeldung „endet mit einem Vorblick“ | angezeigt | angezeigt | ✓ |

### Weitere Prüfungen
- Schleifennivellement (ΔH_soll = 0, W, ΣK = W, Endpunkt = H_A), Rundung ±0,5 vom Nullpunkt weg, Komma/Punkt-Eingabe, Ablehnung von mehr als 3 Nachkommastellen: alle ✓.
- **Excel-Export:** Jede Formel der .xlsx (A, B, B mit Konvention b, C, Schleife, Ersatzverfahren; 26–53 Formeln je Datei) wurde mit einem unabhängigen Formel-Auswerter nachgerechnet und stimmt mit den App-Werten überein. ZIP-Prüfsummen (CRC) und XML-Wohlgeformtheit aller Dateiteile: ✓. **Gegentest in Microsoft Excel 16:** Die Dateien zu A, B, B (HSBK) und C öffnen ohne Reparaturmeldung. Nach vollständiger Neuberechnung durch Excel gibt es 0 Formelfehler, und alle Höhen, Korrekturen, W, f und Proben stimmen mit den Sollwerten überein. Die geprüften Dateien liegen in `Beispiel-Exporte/`.
- **CSV:** Export → Import ergibt für A–C dieselben Ergebnisse. Fremdformat (Komma, Dezimalpunkt) wird gelesen.
- **Üben:** 40 Zufallsaufgaben, jeweils die richtige Lösung eingetragen: 40/40 als richtig erkannt. Alle Aufgaben liegen innerhalb von f.
- **Oberfläche:** Handy-Breite 375 px ohne seitliches Scrollen der Seite (die Tabelle scrollt in sich). Keine Konsolenfehler.

## Getroffene Annahmen

1. **Zielweiten in Testfall B** sind angenommen (wie im Auftrag angegeben). Die Zielweite des Zwischenblicks (12 m) zählt nicht zur Strecke.
2. **Plausibilitätsverstöße** sind Meldungen, keine Eingabesperre. Gerechnet wird trotzdem (nötig für Testfall C, der mit Zwischenblicken endet). W, f und die Fehlerverteilung gibt es erst bei plausiblem, vollständigem Feldbuch.
3. **Standard-Vorzeichen W:** Konvention a (RWTH, W = Soll − Ist, ΣK = W), umschaltbar auf b (HSBK, W = Ist − Soll, K = −W). Die Korrekturen K sind in beiden Fällen identisch.
4. **Rundung:** kaufmännisch, .5 wird vom Nullpunkt weg gerundet (wie Excel `RUNDEN`). Intern wird ganzzahlig in mm (Ablesungen, Höhen) und dm (Zielweiten) gerechnet. Deshalb sind die Proben exakt.
5. **K steht in der Vorblick-Zeile** der Aufstellung (RWTH-Vordruck). Zwischenpunkte erhalten kein eigenes K, aber die kumulierte Korrektur einschließlich ihrer Aufstellung.
6. **|W| > f:** keine Fehlerverteilung, Hinweis „Messung wiederholen“.
7. **Ohne vollständige Zielweiten:** keine Verteilung und kein f. Optionales Ersatzverfahren „gleichmäßig je Aufstellung“, voreingestellt aus und deutlich gekennzeichnet. f ist dann nicht prüfbar.
8. **Warngrenzen** (einstellbar): Zielweite > 50 m (Lehrbuch), Zielweitendifferenz R/V > 5 m, Doppelaufnahme > 3 mm, Ablesung > 5 m (Lattenlänge). Die Grenzen 5 m, 3 mm und 5 m sind Vorschläge aus der Rückfragerunde, keine Normwerte.
9. **Doppelaufnahme:** Gleicher Punktname mindestens zweimal, davon mindestens einmal als Zwischenpunkt. Verglichen werden korrigierte Höhen (falls verteilt), sonst gemessene. Die Schleife (Anfangspunkt = Endpunkt) gilt nicht als Doppelaufnahme.
10. **Absteckmodus** rechnet mit der **gemessenen** Visurhöhe (die Korrektur ist im Feld noch unbekannt).
11. **c = 15** und der Zusammenhang „c ≈ 2–3 · σ_km“ sind Unterrichts- bzw. Lehrbuchkonvention und als prüfbedürftig gekennzeichnet. Für **DIN 18710** nennt die App nur die Stufenbezeichnungen und die im Auftrag genannten Grenzen H1 (> 20 mm) und H5 (≤ 0,5 mm). Zwischenwerte wurden bewusst **nicht** geschätzt, sondern verweisen auf die aktuelle Normausgabe.
12. **PDF** entsteht über den Druckdialog des Browsers (keine Bibliothek). Excel wird ohne Bibliothek erzeugt. Die App läuft dadurch komplett offline.
13. **Skizze:** Höhen sind maßstäblich zueinander, aber überhöht. Abstände sind schematisch. Das Symbol ▲ für Höhenfestpunkte ist eine App-Ergänzung zur Lehrbuchskizze.
14. **Übungsaufgaben:** H_A zwischen 30 und 120 m ü. NHN, 3–5 Aufstellungen, Zielweiten 10–45 m, simulierter Messfehler ±1 mm je Aufstellung (immer innerhalb von f).
