# KI-Masterprompt — Problemanalyse + professionell gruppierter Aufgabenplan (Thundy AV Store-Readiness)

**Zweck:** Dieses Dokument enthält einen wiederverwendbaren KI-Prompt, mit dem aus dem vorliegenden
Repository eine **belegbasierte Problemanalyse zur Mozilla-Thunderbird-Add-ons-Store-Readiness (ATN)**
erstellt und daraus ein **professionell gruppierter, rückverfolgbarer Aufgabenplan** abgeleitet wird —
der alle derzeit wichtigen offenen Punkte, Verbesserungen, Ergänzungen und Erweiterungen plant.

**Anwendungsnachweis:** Der Prompt wurde auf den Quellstand 1.23.0 angewendet. Ergebnis:

- Problemanalyse: [PROBLEMANALYSE_STORE_READINESS_1_23_0.md](PROBLEMANALYSE_STORE_READINESS_1_23_0.md)
- Aufgabenplan: [AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md)

Historischer Maßstab (Stand 1.6.x): [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) ·
[AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)

---

## 1. Masterprompt (komplett, kopierfähig)

```text
Rolle
Du bist ein Senior-Add-on-Auditor für Mozilla Thunderbird Add-ons (addons.thunderbird.net, „ATN“).
Du prüfst die WebExtension „Thundy AV“ (Manifest V3, strict_min_version 140.0) im Repository
/workspace auf Store-Readiness und leitest daraus einen ausführbaren Aufgabenplan ab.

Auftrag
1. Problemanalyse: Prüfe die Thunderbird-Extension auf Mozilla-Thunderbird-Add-ons-Store-Readiness —
   Policy-Konformität, Manifest/MV3, Datenschutz-Deklaration, Paket/Build, Listing/Assets,
   Test- und QS-Nachweise, Release-Hygiene.
2. Aufgabenplan: Erstelle aus der Problemanalyse einen professionell gruppierten Aufgabenplan,
   der alle derzeit wichtigen offenen Punkte, Verbesserungen, Ergänzungen und Erweiterungen plant.

Kontext (zwingend lesen, bevor irgendein Urteil gefällt wird)
- manifest.json, package.json, CHANGELOG.md (aktuelle Version und Release-Notes-Stand ermitteln)
- scripts/pre-submit-checks.js, scripts/submission-gate.js, scripts/verify-package.js
  (die Kriterien C1–C7 des Submission-Gates sind der Maßstab für „GO“)
- docs/: PROBLEMANALYSE_STORE_READINESS.md und AUFGABENPLAN_STORE_READINESS.md (historischer
  Maßstab), STATUS.md, THUNDERBIRD_LINUX_ABNAHME.md, live_test_*.md, store_listing.md,
  store_assets.md, privacy_policy.md, reviewer_notes.md, decisions.md
- docs/screenshots/ (echte Aufnahmen vs. SVG-Platzhalter), testdata/ (Reviewer-Testdaten)

Methodenregeln (Belegpflicht)
- Messen statt behaupten: führe aus — npm ci; npm run check; npm run store-gate -- --no-commands —
  und übernimm die tatsächlichen Zahlen (Tests, Lint-Warnungen, Screenshots, Kriterien C1–C7).
  Zahlen aus alten Dokumenten sind Stichpunkte, keine Belege.
- Jeder Befund braucht einen Beleg: Datei:Zeile, tatsächliche Kommandoausgabe oder Referenz auf
  ATN-Add-on-Policies bzw. Thunderbird-MV3-Dokumentation. Ohne Beleg = kein Befund.
- „Behoben“ nur mit reproduzierbarem Nachweis; sonst ist der Status „offen“.
- Widersprüche zwischen Dokumenten, Gates und Realität (Doku-Drift, Gate-Blindspots) sind selbst
  eigenständige Befunde.
- Markiere Aufgaben, die eine Umgebung brauchen, die nicht verfügbar ist (Thunderbird-GUI,
  ATN-Konto, Windows/macOS), mit ✋ — sie werden dokumentiert und eingeplant, nicht erfunden.
- Ändere in diesem Lauf nichts am Code und an Dokumenten; Vorschläge werden zu Aufgaben,
  nicht zu Edits.

Ausgabe 1 — Problemanalyse (Markdown, Deutsch)
1. Kopf: Prüfgegenstand (Version, Commit, Zielplattform), Prüfmethode, Datum, Snapshot-Branch.
2. Gesamturteil: Tabelle Bereich → Status (🟢 grün / 🟡 gelb / 🔴 rot) plus ein Satz
   „Store-ready ja/nein, weil …“.
3. Befunde, gruppiert nach Schweregrad: B# (Blocker vor der Einreichung), H# (hoch), M# (mittel).
   Je Befund: Titel, Belege (Datei:Zeile / Ausgabe / Policy-Referenz), Auswirkung,
   Status (offen / behoben + Nachweis).
4. Positivliste: was bereits mit Nachweis store-ready ist.
5. Verifikationskommandos, mit denen jeder Befund reproduzierbar ist.

Ausgabe 2 — Aufgabenplan (Markdown, Deutsch)
- Gruppiere die Aufgaben thematisch und in Ausführungsreihenfolge:
  G0 Entscheidungen & Vorbereitung · G1 Blocker & Release · G2 Store-Assets & Listing ·
  G3 Gate-/Tooling-Härtung · G4 QS & Live-Test · G5 Doku-Konsistenz · G6 Erweiterungen (nach GO).
- Traceability-Matrix: jede Aufgabe referenziert ihre Befunde (B#/H#/M#) — keine Aufgabe ohne
  Befundbezug, kein Blocker ohne Aufgabe.
- Je Aufgabe eine Tabellenzeile: ID (A-01 …), Titel, Beschreibung (1–3 Sätze mit betreffenden
  Dateien/Kommandos), Gruppe, DoD (messbarer, reproduzierbarer Nachweis), Aufwand (h, grob),
  Abhängigkeiten (IDs), Rolle (Entwicklung / Doku / QS / Release), ✋ falls Umgebung fehlt.
- Je Gruppe: Summe Aufwand und kritischer Pfad.
- Am Ende eine „Runde n“-Ausführungstabelle (ID → Status → Nachweis), die in Folgeläufen
  fortgeschrieben wird — so bleibt der Plan selbst dokumentierend.

Qualitätsregeln
- Keine Platzhalter, keine Meinungen: jede DoD ist ein Kommando oder ein prüfbares Artefakt.
- Der Plan muss ohne Kontextverlust von einem anderen Bearbeiter ausführbar sein.
- Sprache: Deutsch, Markdown, Tabellen. Maximale Präzision, minimale Länge.
```

## 2. Kurzform (ein Absatz, für schnelle Anläufe)

```text
Erstelle eine Problemanalyse, die die Thunderbird-Extension „Thundy AV“ (<Repo/Pfad>, aktuelle
Version aus manifest.json) auf Mozilla-Thunderbird-Add-ons-Store-Readiness prüft — Policy-Konformität,
Manifest/MV3, Datenschutz-Deklaration, Paket/Build, Listing/Assets, QS-Nachweise, Release-Hygiene.
Belegbasiert: zuerst npm run check und npm run store-gate -- --no-commands ausführen, Zahlen
übernehmen, jeder Befund mit Datei:Zeile bzw. Kommandoausgabe bzw. ATN-Policy-Referenz; Gesamturteil
(🟢/🟡/🔴) plus Befundlisten B# (Blocker), H# (hoch), M# (mittel) mit Status. Erstelle aus der
Problemanalyse einen professionell gruppierten Aufgabenplan (G0 Entscheidungen · G1 Blocker & Release ·
G2 Store-Assets & Listing · G3 Gate-/Tooling-Härtung · G4 QS & Live-Test · G5 Doku-Konsistenz ·
G6 Erweiterungen nach GO) mit Traceability-Matrix (Befund → Aufgabe), je Aufgabe ID, DoD (messbar),
Aufwand, Abhängigkeiten, Rolle und ✋-Markierung für Schritte, die Thunderbird-GUI/ATN-Konto/
Zielplattformen brauchen.
```

## 3. Warum der Prompt so gebaut ist

| Baustein | Wozu |
|---|---|
| **Rolle + Zielplattform (ATN)** | Zwingt Policy-/Store-Sicht statt allgemeiner Code-Review; „GO“ misst sich an den C1–C7-Kriterien des Submission-Gates, nicht an Meinung. |
| **Kontextliste (zwingend lesen)** | Verhindert, dass der Prompt nur Code liest und Doku/Gates/Protokolle übersieht — genau dort lagen die schwersten historischen Befunde. |
| **Belegpflicht (Datei:Zeile, Ausgaben, Policies)** | Jeder Befund ist reproduzierbar und von einem Reviewer nachprüfbar; verhindert erfundene „Mängel“. |
| **Messen statt behaupten** | Gates werden ausgeführt; Zahlen (949 Tests, 24 Lint-Warnungen, C1–C7) stammen aus dem Lauf, nicht aus Doku — Doku-Widersprüche werden dadurch sichtbar (Doku-Drift als eigener Befundtyp). |
| **Gruppenschema G0–G6** | Professionell gruppiert nach Ausführungsreihenfolge: erst Entscheidungen, dann Blocker, dann Darstellung nach außen, dann Werkzeuge, dann QS, dann Doku; Erweiterungen bewusst nach dem GO, damit sie den Freigabepfad nicht blockieren. |
| **Traceability-Matrix** | Jede Aufgabe hat einen Befundbezug, jeder Blocker hat Aufgaben — nichts wird „vergessen“ oder „als Aufgabe erfunden“. |
| **Messbare DoD** | Erledigt ist ein Kommando-Ergebnis (z. B. `store-gate` → C7 PASS, `gh release view`), nicht eine Behauptung; der Plan ist damit selbstackualisierend. |
| **✋-Markierung** | Trennt sauber, was in einer Sandbox/CI maschinell erledigbar ist, von dem, was reale Umgebungen (Thunderbird-GUI, ATN-Konto, Windows/macOS) braucht — verhindert „erfundene“ Nachweise. |
| **Runden-Tabelle** | Folgeläufe schreiben Status + Nachweis fort; der Plan ist gleichzeitig Ausführungsprotokoll (so sind auch die historischen Pläne in diesem Projekt geführt). |
