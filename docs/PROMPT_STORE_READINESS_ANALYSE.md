# Prompt-Vorlage: Problemanalyse Store-Readiness + professionell gruppierter Aufgabenplan

Zweck: Wiederverwendbarer KI-Prompt für die Erstellung einer Problemanalyse zur
Thunderbird-Add-ons-Store-Readiness (ATN) und eines daraus abgeleiteten, fachlich gruppierten
Aufgabenplans für **Thundy AV – Email Scanner for Thunderbird**.

Ersetzt den bisherigen, zu unbestimmten Kurz-Prompt:

> „Erstelle eine Problemanalyse die Thunderbird Extension auf Mozilla Thunderbird Extension Store
> Readyness. Erstelle aus der Problemanalyse einen Aufgabenplan“

**Stand der Vorlage:** 2026-10-16 · Projektstand zum Prüfbeginn: `manifest.json` 1.23.0, MV3,
`strict_min_version` 140.0, Lizenz `GPL-3.0-only`.

---

## 1. Der verbesserte Prompt (kopierbarer Master-Prompt)

~~~text
# Rolle
Du bist ein Senior-Reviewer für Thunderbird/Mozilla WebExtensions mit Schwerpunkt
Add-on-Store-Compliance (addons.thunderbird.net, ATN), Extension-Systematik
(manifest.json, MV3, Thunderbird-APIs) und Release-Qualitätssicherung.

# Auftrag
Erstelle für das Repository VaZuLeS/Thunderbird-Antivirus (Add-on „Thundy AV – Email Scanner
for Thunderbird“) ZWEI zusammenhängende Dokumente:

1. **PROBLEMANALYSE_STORE_READINESS.md** — evidenzbasierte Problemanalyse der
   Thunderbird-Extension auf Store-Readiness gegenüber addons.thunderbird.net (Listung + Signierung,
   `--channel listed`).
2. **AUFGABENPLAN_STORE_READINESS.md** — einen daraus abgeleiteten, professionell gruppierten
   Aufgabenplan mit Phasen, Traceability und messbaren Abschlusskriterien pro Aufgabe.

# Prüfkontext (vorbereitend erfassen, dann referenzieren)
- Führe zunächst eine **Deltalanalyse** gegen die bestehenden Dokumente durch und markiere,
  was neu ist: `docs/PROBLEMANALYSE_STORE_READINESS.md`, `docs/AUFGABENPLAN_STORE_READINESS.md`,
  `docs/decisions.md`, `docs/AUFGABENPLAN_OPTIMIERUNG_I18N.md`, `docs/STATUS.md`, `CHANGELOG.md`.
  Bereits erledigte oder dokumentierte Punkte werden nicht erneut als offen geführt; ihr Stand wird
# Teil 1 — Problemanalyse (Verbindliche Anforderungen)
- **Jeder Befund muss einen Beleg haben**: Datei + Zeilenbereich im aktuellen Quellstand
  (`datei.js:120–135`), Terminalausgabe (Test-/Lint-/Gate-Run), XPI-Inspektion oder
  Policy-Quelle (ATN-/AMO-Add-on-Richtlinie, Thunderbird-API-Doku, MDN). Keine Behauptung
  ohne Beleg; unbekanntes wird als „offen/zu prüfen“ mit Prüfverfahren geführt, nicht vermutet.
- **Schweregrade (stabile Kennungen, Präfix = Schwere):**
  - **P0 = Blocker:** verhindert Freigabe/Signierung/Listung oder verletzt Policy/Datenschutz-Zusage.
  - **P1 = hoch:** hohes Ablehnungs-/Fehler-Risiko oder funktionaler Defekt.
  - **P2 = mittel:** Qualität, Nachweisbarkeit, Dokument-Drift, Metrik-Abweichungen.
  - **P3 = niedrig:** Hygiene, Kleinigkeiten, Optimierungspotenzial.
- **Prüfbereiche (Mindestabdeckung, je Bereich eigener Abschnitt):**
  1. Manifest & Signatur: Manifest V3, ID, Version, `strict_min_version`, Browser-/Thunderbird-API-
     Berechtigungen (`menus`-Namespace, `storage`, `tabs` …), fehlende Berechtigungen.
  2. Datenschutz & Datenerhebung: Deklaration (Datensatztypen) vs. reales Verhalten (Codepfade),
     Zustimmungsmodell (globales Opt-in, Absenderfreigabe, Datenschutz-Stufe inkl. manueller
     Pfade: Popup-Upload, Link-/Kontextmenü-Scan), `sensitiveDataUpload`.
  3. Sicherheit: Eingabesanitisierung, Host-Berechtigungen, `fetch`-Wege am Gateway,
     Klick-/Navigationsschutz, Fehlerbehandlung ohne stille Fehler.
  4. Funktionale Integrität: tote Codepfade, undefinierte Symbole, fehlende Menüs, defektes Popup,
     Verhalten bei verweigerten Berechtigungen.
  5. Paket & Build: XPI-Inhalt (keine Scratch-/Entwicklerdateien), Paketprüfung, Reproduzierbarkeit,
     web-ext lint, Signierweg (ATN-API-Endpunkt `--amo-base-url`, `--approval-timeout` bei `listed`).
  6. CI/Gates & Tests: abgedeckte Testanzahl vs. Gesamtzahl, aktive vs. vorhandene Workflows,
     Pre-Submit-Checks, Benchmarks.
  7. Store-Assets & Listing: Screenshots (echte PNG/JPEG vs. Platzhalter), Listing-Texte,
     Versionskonsistenz der Doku, Reviewer-Notes, Testmittel (Testdaten/Protokoll).
  8. Live-Verifikation: was ist nur mit gemockten APIs belegt; welche Punkte benötigen
     Thunderbird-GUI/ATN-Konto (explizit mit ✋ markieren).
- **Kurzfassung zuerst:** Gesamtnummer pro Schweregrad, Gesamtureil **GO/NO-GO** mit
  messbaren GO-Kriterien (nummeriert, z. B. C1…Cn), danach Details.
- Schließe mit einem Update-Abschnitt „Umsetzungsstand“ (behoben/teilweise/offen je Befund-ID),
  sobald Arbeiten ausgeführt wurden — die Analyse bleibt Snapshot + Fortschrittsjournal.

# Teil 2 — Aufgabenplan (Verbindliche Anforderungen)
Leite **aus JEDER Befund-ID genau mindestens eine Aufgabe** ab und sichere die Rückverfolgbarkeit
über eine **Traceability-Matrix** (Befund-ID → Aufgabe(n)-ID → Kurztitel). Struktur:

- **Gruppierung in Phasen (jede Phase mit Ziel, Voraussetzungen, Ergebnissen):**
  - **Phase 0 — Entscheidungen & Vorbereitung:** Zieldefinition, bindende Produktentscheidungen
    (Datenschutzmodell, Zielversion), Snapshot/Arbeitsbranch.
  - **Phase 1 — Korrekturen (Code & Manifest):** alle P0/P1-Blocker, gruppiert nach demselben
    Codepfad/Feature-Bereich statt nach Einzelpunkten (z. B. „Zustimmungsmodell“,
    „Popup/Interface“, „Kontextmenüs/Linkprüfung“).
  - **Phase 2 — Doku & Listing:** Policy-Dokumente, Listing-Texte, Reviewer-Notes, Assets,
    Versionskonsistenz.
  - **Phase 3 — QS & Gates:** Testabdeckung, CI-Aktivierung, Paketprüfung, Pre-Submit,
    Live-Test-Protokoll (mit ✋-Umgebungsbedarf).
  - **Phase 4 — Release & Store:** Tag/Release, Signierung (ATN-Endpunkt korrekt), Einreichung,
    Nachverifikation.
  - **Ergänzende Querschnittsgruppen (explizit ausweisen):**
    - **Offene Punkte:** nicht abgeschlossene Befunde/Restrisiken (mit Status + Verantwortung).
    - **Verbesserungen:** Qualität/Nutzererlebnis ohne Freigabepflicht (z. B. UX, Fehlertexte).
    - **Ergänzungen:** fehlende Nachweise/Assets/Tests (Screenshots, Live-Test, Testdaten).
    - **Erweiterungen:** neue Funktionsideen/Features (z. B. Enterprise-Features, Sprachausbau),
      klar getrennt von Freigabe-blockierenden Aufgaben, mit dem Etikett
      „kein Freigabe-Blocker“ versehen.
- **Jede Aufgabe im Tabellenformat** mit: ID (fortlaufend A-01…), Kurztitel, Inhalt/Fix-Skizze,
  zugeordnete Befund-ID(s), **DoD (Definition of Done)** — ein reproduzierbarer Nachweis
  (Kommando + erwartetes Ergebnis, z. B. „`npm run check` → Exit 0“ oder „Gate-Protokoll zeigt
  C7 PASS“), Aufwandschätzung in Stunden, Abhängigkeiten (andere IDs), ✋-Markierung falls
  Thunderbird-GUI oder ATN-Konto benötigt wird.
- **Rollen gruppieren:** Entwicklung / Doku / QS / Release (bei Einzelperson = Zeitfenster).
- **Summen pro Phase** in Stunden; kritischen Pfad kenntlich machen.
- **Statusjournal pro Ausführungsrunde** (Tabellen-ID → Status → Nachweis), analog dem
  bestehenden Format in `docs/AUFGABENPLAN_STORE_READINESS.md`.

# Qualitätsregeln für beide Dokumente
- Sprache der Dokumente: Deutsch (wie die bestehenden docs/), Befehle/Metadaten in Englisch.
- Zahlen nie schätzen, sondern messen (Dateizahl, Testanzahl, Bytegröße, Hashwerte).
- Doku-Drift verhindern: Versionsangaben in allen Dokumenten mit dem Prüfsnapshot abgleichen und
  Abweichungen als Befund führen.
- Kein Placebo-Code: jede Fix-Skizze benennt exakt die betroffenen Dateien/Symbole.
- In der Sandbox Unmögliches (Thunderbird-GUI, Provider-Aufrufe, Store-Upload) nicht als
  „erledigt“ ausweisen, sondern als dokumentierten manuellen Schritt mit ✋ führen.
- Format: Markdown, tabellarisch, mit Querverlinks zwischen Problemanalyse, Aufgabenplan und
  einer Verweiszeile in `docs/index.md`.

# Ablauf
1. Repository und bestehende docs/ analysieren (inkl. Deltalanalyse).
2. Problemanalyse schreiben; Befunde zählen (P0…P3); GO/NO-GO bewerten.
3. Daraus den Aufgabenplan ableiten (Traceability-Matrix VOR den Aufgabenlisten).
4. Abschließend selbst prüfen: Ist jede Befund-ID in der Matrix, hat jede Aufgabe ein DoD,
   stimmt jede Versionsangabe?
~~~

---

## 2. Was gegenüber dem Kurz-Prompt verbessert wurde und warum

| # | Mangel des Kurz-Prompts | Verbesserung im Master-Prompt |
|---|---|---|
| 1 | Keine Rolle / kein Expertise-Kontext | Explizite Reviewer-Rolle (ATN-Compliance, MV3, Thunderbird-APIs) — höhere Fachlichkeit der Ergebnisse |
| 2 | „Store Readyness“ undefiniert | Zielplattform, Signierweg und Prüfbereiche (Manifest, Datenschutz, Sicherheit, Paket, CI, Assets, Live-Test) verbindlich aufgezählt |
| 3 | Keine Evidenzpflicht | Jeder Befund braucht Beleg (Datei:Zeile, Run-Ausgabe, Policy-Quelle) — entspricht der bewährten Struktur der bestehenden `PROBLEMANALYSE_STORE_READINESS.md` |
| 4 | Kein Schweregradsystem | P0–P3 mit fester Definition und stabilen Kennungen (P0-1 … P3-25) |
| 5 | Kein Bezug auf bereits Erledigtes | Deltalanalyse gegen bestehende Dokumente (decisions.md, STATUS, i18n-Plan) — verhindert doppelte Arbeit |
| 6 | „Aufgabenplan“ ohne Struktur | Phasen-Gruppierung, Rollen, Traceability-Matrix, DoD pro Aufgabe, Aufwand, Abhängigkeiten |
| 7 | Offene Punkte / Verbesserungen / Ergänzungen / Erweiterungen nicht getrennt | Eigene Querschnittsgruppen mit klarer Semantik; Erweiterungen explizit als „kein Freigabe-Blocker“ etikettiert |
| 8 | Kein Ausgabeformat | Markdown-Konventionen, Tabellenformat, Verlinkung, Sprachvorgabe |
| 9 | Keine Verifikationsanforderung | Selbstprüfung am Ende (Matrix-Vollständigkeit, DoD je Aufgabe, Versionsangaben) und GO-Kriterien C1…Cn |
| 10 | Sandbox-Grenzen ignoriert | ✋-Konvention: GUI-/ATN-abhängige Schritte werden als dokumentierte manuelle Schritte geführt, nicht als erledigt |

## 3. Kurzfassung des Prompts (falls das KI-Modell wenig Kontextbreite hat)

~~~text
Erstelle als Senior-Reviewer für Thunderbird-Add-ons zwei Dokumente für das Repo
VaZuLeS/Thunderbird-Antivirus (Version 1.23.0, MV3, min 140.0, Ziel-Store ATN):
(1) evidenzbasierte Problemanalyse zur Store-Readiness — jeder Befund P0–P3 mit Beleg
(Datei:Zeile, Test-/Gate-Ausgabe oder Policy-Quelle), Kurzfassung mit GO/NO-GO und
nummerierten GO-Kriterien; Deltalanalyse gegen docs/PROBLEMANALYSE_STORE_READINESS.md,
docs/decisions.md und docs/AUFGABENPLAN_OPTIMIERUNG_I18N.md, um bereits Erledigtes nicht
neu zu führen.
(2) daraus einen professionell gruppierten Aufgabenplan: Phasen (0 Entscheidungen,
1 Code/Manifest-Korrekturen nach Feature-Bereich gruppiert, 2 Doku/Listing, 3 QS/Gates,
4 Release/Store) plus Querschnittsgruppen „Offene Punkte“, „Verbesserungen“, „Ergänzungen“,
„Erweiterungen“ (Erweiterungen = kein Freigabe-Blocker); Traceability-Matrix Befund→Aufgabe,
jede Aufgabe mit ID, Fix-Skizze, DoD (reproduzierbarer Nachweis), Aufwand, Abhängigkeiten,
✋ wenn Thunderbird-GUI/ATN-Konto nötig; Statusjournal je Ausführungsrunde.
Deutsch, Markdown, Zahlen gemessen statt geschätzt; abschließende Selbstprüfung der Matrix- und
DoD-Vollständigkeit.
~~~
  kurz referenziert.
- Geprüfte Version/Commit (Snapshot) exakt angeben (manifest.json 1.23.0, Commit-Hash, Datum).
- Zielplattform: Thunderbird 140+ ESR, MV3, Ziel-Store: ATN (NICHT AMO/Mozilla-Firefox).