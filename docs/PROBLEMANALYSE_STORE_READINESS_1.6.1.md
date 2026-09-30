# Problemanalyse (Iteration 2) – Store-Readiness „Thundy AV“ – Prüfstand 1.6.1

**Auftrag:** Zweite, unabhängige Erhebung der Store-Readiness der Thunderbird-Erweiterung „Thundy AV –
Email Scanner for Thunderbird“ für eine Listung im Thunderbird Add-ons Store (`addons.thunderbird.net`, ATN) –
**nach** den in Iteration 1 abgeleiteten und umgesetzten Maßnahmen.
**Ergebnis dieser Datei:** Analyse mit Nachweis. Daraus abgeleitet:
[AUFGABENPLAN_STORE_READINESS_1.6.1.md](AUFGABENPLAN_STORE_READINESS_1.6.1.md).

| Feld | Wert |
|---|---|
| Prüfgegenstand | Repository `VaZuLeS/Thunderbird-Antivirus`, Branch `cline/573mahd6`, HEAD `7b449bc` |
| Add-on-Version | **1.6.1** (Manifest V3, `strict_min_version` 140.0), `default_locale` en |
| Zielplattform | ATN – Listung (Signatur-Kanal `listed`), Signierziel `https://addons.thunderbird.net/api/v5/` |
| Werkzeuge | `npm test`, `npm run check`, `npm run gate` (neu), `npm run lint:filtered`, `npm run package:verify`, `node scripts/submission-gate.js`, statische Codeanalyse, Abgleich mit Primärquellen (Thunderbird-API-Referenz, Mozilla Add-on-Policies, MDN, `addons-linter`) |
| Datum | Prüflauf im Sandbox-Checkout (Version 1.6.1) |

## Dokumentengenerationen

| Generation | Dokument | Aussage |
|---|---|---|
| 1 (Baseline) | [STORE_READINESS_ANALYSIS.md](STORE_READINESS_ANALYSIS.md) | Befunde B1–B6/H1–H12/M1–M12 zum Stand **1.5** (MV2→MV3-Portierung, Paketbereinigung, Trademark, Privacy-Policy) |
| 2 | [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) + [AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md) | Befunde P0-1…P3-17 zum Stand **1.6** und deren Abarbeitung (Durchführungsstand/Go-No-Go in §0/§10) |
| **3 (diese)** | diese Datei + [AUFGABENPLAN_STORE_READINESS_1.6.1.md](AUFGABENPLAN_STORE_READINESS_1.6.1.md) | **Re-Erhebung zum Stand 1.6.1**: was ist belegt geschlossen, was ist offen, welche Risiken bringt der neue Code mit |

## 1. Ergebnis in einem Satz

**Die Erweiterung ist technisch und dokumentarisch so weit vorbereitet, dass die Einreichung nur noch an drei
Dingen scheitert, die außerhalb des Repositories liegen (Nachweis in einer echten Thunderbird-Installation,
echte Screenshots, ATN-Konto) – der neue Code aus Iteration 1 hat jedoch neun kleinere Nacharbeiten
hinterlassen, die vorher abzuarbeiten sind.**

## 2. Ampelmatrix (Prüfstand 1.6.1)

| Tor | Kriterium | Status | Beleg |
|---|---|---|---|
| T1 | Funktionsnachweis in Thunderbird 140 ESR | 🔴 **offen** | Protokoll + Testdaten fertig, Ausführung hier nicht möglich (kein GTK/X/root); `npm run gate` blockt |
| T2 | Policy-Konformität (Beschreibung, Daten, Rechte) | 🟢 **erfüllt** | Daten-Deklaration optional + Runtime-Opt-in, Entscheidung belegt, keine Telemetrie, kein Remote-Code |
| T3 | Technische Validierung | 🟢 **erfüllt** | 422 Tests / 0 Fehler, `npm run check` Exit 0, 0 Lint-Fehler, Paketinhalt geprüft |
| T4 | Listing-Reife (Assets) | 🟠 **teilweise** | Listing-Text, Sprachfeld, Releasenotes vorhanden; **0 von 3 Screenshots** |
| T5 | Reviewer-Bedienbarkeit | 🟢 **erfüllt** | Antwortkatalog, 4 Testnachrichten, Testanleitung; „ohne API-Schlüssel prüfbar“ dokumentiert |
| T6 | Release-Fähigkeit (ATN-Signatur) | 🟠 **teilweise** | Signierweg korrekt dokumentiert und im Gate erzwungen; Ausführung erfordert ATN-Schlüssel |
| T7 | Automatisierte Einreichungsprüfung | 🟢 **erfüllt** | `npm run gate` prüft alle Kriterien maschinell, Exit-Code 1 bei Blockern |

---

## 3. Übernommene Punkte aus Iteration 1 (nachgeprüft)

| Befund (Iteration 1) | Stand 1.6.1 | Nachweis dieses Laufs |
|---|---|---|
| P0-1 Kernfunktion unbelegt | 🔴 offen (unverändert) | keine TB-Installation lauffähig; Risiko benannt, Alternativplan vorhanden |
| P0-2 keine Screenshots | 🔴 offen | `npm run gate` → `0 of 3 required screenshots`; `docs/screenshots/` enthält 3 SVG-Platzhalter |
| P0-3 Reviewer-Testmittel | 🟢 erledigt (mit Grenze) | `docs/testdata.md` + 4 Fixtures in `testdata/`; Test-API-Schlüssel nicht möglich, „ohne Schlüssel prüfbar“ aufgelistet |
| P0-4 Daten-Deklaration/Consent | 🟢 erledigt | `required:["none"]`/`optional:["personalCommunications"]`, Runtime-Opt-in, Entscheidung dokumentiert, 5 Tests |
| P0-5 keine Store-Präsenz | 🔴 offen | erfordert ATN-Konto |
| P1-6 Signierweg zielte auf AMO | 🟢 erledigt | `--amo-base-url …/api/v5/` in Workflow, quickstart, STATUS, ci/README; im Gate erzwungen |
| P1-7 aktive CI zu schwach | 🟠 **teilweise** | der **aktive** Workflow `.github/workflows/ci.yml` ist unverändert die alte Fassung (`node --test background.test.js`, `npx web-ext lint`); der korrigierte Workflow ruht als Spiegel in `docs/ci/ci.yml` (`npm run check`). PRs sind weiterhin nicht abgesichert. |
| P1-8 kein Release-Artefakt | 🟠 teilweise | Version 1.6.1 + CHANGELOG + lokaler Build; Tag/Release/Signatur erfordern ATN-Schlüssel |
| P1-9 UI nur deutsch | 🟢 erledigt | 153 Schlüssel je Sprache für Optionsseite, Popup, Banner, Manifest; `test/i18n.test.js` erzwingt Vollständigkeit |
| P1-10 MV2-Altpfade/Linter-Rauschen | 🟢 erledigt | 0 Treffer für MV2-APIs im Laufzeitcode; Lint 26 → 18 Warnungen, alle gefiltert |
| P1-11 Fehler bleiben unsichtbar | 🟢 erledigt | Diagnose wird protokolliert, gespeichert, gemeldet und im Popup angezeigt; Host-Freigabe per Klick im Popup |
| P2-12 Dokumentationsdrift | 🟠 überwiegend erledigt | Test-/Paketkennzahlen korrigiert; zwei Reste → N-02 |
| P2-13 Reviewer-Origins ≠ Manifest | 🟢 erledigt | Manifest-Origin und Laufzeit-Origin getrennt ausgewiesen |
| P2-14 Listing-Metadaten offen | 🟠 teilweise | Version/Sprache/Kompatibilität aktualisiert; Screenshots + Store-URL fehlen |
| P2-15 Kompatibilitätsaussage | 🟢 erledigt | „Thunderbird 140+“ in Listing, README und Antwortkatalog begründet |
| P2-16 Umgehung des ApiGateway | 🟢 erledigt | alle Aufrufe über `apiGateway.fetchWithTimeout` (per Test erzwungen) |
| P3-17 doppelte Ignore-Konfiguration | 🟢 erledigt | `.webextignore` entfernt; Test prüft die Abwesenheit |

---

## 4. Neue Befunde aus dem aktuellen Stand (N-01…N-09)

### N-01 (mittel) – Die öffentlich verlinkte Datenschutzerklärung zeigt noch Version 1.6
**Belege**
- Repository: `docs/privacy_policy.md:3` → „Version 1.6.1“.
- Live (die im Listing hinterlegte URL): `curl https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html`
  → „Version 1.6“, Stand „September 2026“.
**Regel:** Policies 1 („No Surprises“) und 6.2.1 verlangen eine Darstellung, die zur eingereichten Version passt;
der Reviewer öffnet genau diese URL.
**Auswirkung:** Divergenz zwischen Listing-Verweis und Repository, bis der Branch gemergt und veröffentlicht ist.
Die neue Zusatz-Abfrage der Datenberechtigung aus 1.6.1 ist in der Live-Fassung noch nicht beschrieben.

### N-02 (mittel) – Veraltete Versionsangabe in einem Reviewer-Dokument
**Beleg:** `docs/store_assets.md:3` → „(Version 1.6)“.
**Auswirkung:** Ein Reviewer, der Versionsangaben gegeneinander prüft, findet einen Widerspruch.

### N-03 (mittel) – Benachrichtigungstext nennt nur das „Banner“, betrifft aber auch Time-of-Click
**Beleg:** `background.js:122` (`injectIntoMessageDisplay`) wird an **drei** Stellen genutzt: `:850`
(Time-of-Click-Hinweis), `:1000` (Warnbanner), `:1130` (Opt-in-Banner). Der Text `notificationBannerFailed`
(`background.js:150`, `_locales/*/messages.json`) spricht ausschließlich vom Banner.
**Auswirkung:** Bei einem Fehler im Time-of-Click-Pfad erhält der Nutzer eine irreführende Diagnose – das
Gegenteil des Ziels von P1-11.

### N-04 (mittel) – Die Diagnose im Popup zeigt keinen Zeitpunkt
**Beleg:** `background.js:145` speichert `{ at: Date.now(), message }`; `api.js:133-147` liest den Datensatz,
verwendet aber nur `failure.message`.
**Auswirkung:** Ein Bugreport kann nicht einordnen, zu welcher Version/Installation der Fehler gehört.

### N-05 (mittel) – Die Plattform-Datenberechtigung wird zur Laufzeit nicht erzwungen
**Beleg:** `background.js:64` (`mayTransmitExternally()`) prüft ausschließlich `externalAnalysisConsent`; die
optionale Datenberechtigung wird nur beim Speichern in `options.js` angefragt (dokumentierte Entscheidung in
`docs/data_collection_decision.md` §3.3).
**Bewertung:** Vertretbar – Thunderbird bietet keinen automatischen Consent-Prompt, der eigene Schalter ist die
durchsetzende Instanz. Es ist aber die Stelle, an der ein Reviewer am ehesten nachhakt.
**Auswirkung:** Rückfrage-Risiko, kein Defekt. Abhilfe: Beleg im Antwortkatalog + Schritt im Live-Test.

### N-06 (niedrig) – Der Pre-Submit-Guard für die Daten-Deklaration prüft nur ein String-Vorkommen
**Beleg:** `scripts/pre-submit-checks.js:148` sucht in `options.js` lediglich den String `data_collection`; ein
Kommentar genügte, um die Prüfung zu erfüllen.
**Auswirkung:** Der Check suggeriert mehr Sicherheit, als er gibt; die inhaltliche Absicherung leisten Tests und
Gate (Semantik statt Vorkommen).

### N-07 (niedrig) – `npm run lint:filtered` schreibt in einen festen Pfad
**Beleg:** `package.json:21` → `--output json > /tmp/web-ext-lint.json`.
**Auswirkung:** Nicht Windows-tauglich, bei parallelen Läufen kollisionsanfällig (in CI unkritisch).

### N-08 (niedrig) – 24 Locale-Schlüssel ohne `description`
**Beleg:** `_locales/en|de/messages.json`: 24 der 153 Einträge (überwiegend aus 1.5/1.6) haben kein
`description`-Feld, die neuen 129 haben eines.
**Auswirkung:** Reine Übersetzer-Hilfestellung, keine Store-Auswirkung.

### N-09 (niedrig, mit dieser Iteration behoben) – Drei Dokumentengenerationen ohne übergreifende Navigation
**Beleg:** `STORE_READINESS_ANALYSIS.md` (1.5), `PROBLEMANALYSE_STORE_READINESS.md` (1.6) und diese Datei (1.6.1)
lagen nebeneinander; `docs/index.md` verwies nur auf die Generationen 1 und 2.
**Auswirkung:** Die aktuelle Aussage war ohne Kontext nicht erkennbar. Behoben durch die Generationentabelle
weiter oben sowie die ergänzten Verweise in `docs/index.md` und `docs/STATUS.md` (Aufgabe R-01).

---

## 5. Positivnachweise (in diesem Lauf verifiziert)

- **Tests:** 422 Tests / 68 Suites / **0 Fehler**; `npm run check` endet mit Exit 0.
- **Lokalisierung:** je 153 Schlüssel in `en` und `de` mit identischer Schlüsselmenge, **0 Umlaute im englischen
  Katalog** (keine unübersetzten Reste), keine `$PLATZHALTER$` ohne Definition. Die 6 Einträge mit identischem
  Text in beiden Sprachen sind beabsichtigt („Status:“, „Details:“, „(Normal)“, „(Suspicious)“, „(Critical)“,
  Produktname).
- **Laufzeitcode:** 0 `TODO`/`FIXME`, **0 `console.log`**, keine MV2- oder in MV3 entfernten APIs
  (`tabs.executeScript`, `browser_action`, `background.persistent`, `messageDisplay.getDisplayedMessage`,
  `messageDisplay.onMessageDisplayed`).
- **Lint und Paket:** `web-ext lint` 0 Fehler / 18 Warnungen, vollständig als bekannte Thunderbird-False-Positives
  gefiltert; `verify-package` 17 Dateien, Inhalt gültig (keine Tests, Doku oder Lockfiles im XPI).
- **Dokumentation:** 0 defekte relative Links über 32 Markdown-Dateien; keine Secrets im Repository;
  `.thundy-test-profile/` ist in `.gitignore`.
- **Beispielskript:** `examples/run-in-thunderbird.sh` verwendet ausschließlich real existierende `web-ext`-Optionen
  (`--firefox`, `--firefox-profile`, `--keep-profile-changes`, gegen `web-ext run --help` geprüft).
- **Erzwungene Entscheidungen:** Signierziel, Daten-Deklaration, Injektionsweg, zentrales Timeout und die
  Ignore-Konfiguration sind durch Tests (`test/store_readiness.test.js`, `test/i18n.test.js`) und das Gate
  abgesichert, nicht nur dokumentiert.

## 6. In dieser Umgebung nicht prüfbar (Restrisiko)

| Frage | Warum offen | Klärung |
|---|---|---|
| Erscheint das Opt-in-Banner in Thunderbird 140 ESR? | kein lauffähiges Thunderbird (kein GTK/X, kein Root) | Live-Test (Plan R-04) |
| Überlebt die User-Geste `runtime.sendMessage` bis `permissions.request()`? | Laufzeitverhalten von Gecko | Live-Test (Plan R-04); Zusatzweg im Popup ist bereits gebaut |
| Löst `contexts: ["link"]` im Nachrichtentext aus? | Kontext ist dokumentiert, die Anwendbarkeit auf Nachrichteninhalte nicht | Live-Test (Plan R-04) |
| Akzeptiert der ATN-Validator `messagesRead` und die `messages.*`-APIs? | `web-ext lint` prüft gegen ein Firefox-Ziel | Validator-Lauf mit ATN-Zugang (Plan R-03) |
| Wie bewertet das ATN-Review die Daten-Deklaration? | Auslegung der Policy | Antwortkatalog (Plan R-08) + vorbereitete Rückfrage |
| Ist die verlinkte Live-Policy nach dem Merge aktuell? | Veröffentlichung hängt am Default-Branch | Plan R-12, unmittelbar vor der Einreichung prüfen |

## 7. Urteil und Go/No-Go

**Urteil: NO-GO für die Einreichung – die Lücke ist aber klar umrissen.** Die drei verbleibenden Blocker liegen
außerhalb des Repositories (Thunderbird-Nachweis, Screenshots, ATN-Konto); die neun neuen Befunde sind
Nacharbeiten mit zusammen deutlich unter einem Personentag Aufwand.

Die Go/No-Go-Kriterien aus Iteration 1 sind jetzt **maschinell** prüfbar:

```bash
npm run gate     # Exit-Code 1, solange Einreichungsvoraussetzungen fehlen
```

Aktuelles Ergebnis (3 Blocker, 0 Warnungen):

```
BLOCKER: only 0 of 3 required screenshots found in docs/
BLOCKER: the live test protocol still has 9 open checklist item(s)
BLOCKER: the live test protocol still has an empty environment field: Datum, Thunderbird-Version, Getestet von
```

## 8. Quellen

- Eigene Messungen in diesem Checkout (Kommandos in §2/§5 sowie §0 des Aufgabenplans).
- [Thunderbird WebExtension-API-Referenz](https://webextension-api.thunderbird.net/en/mv3/) – `scripting.messageDisplay`,
  `permissions` (Hinweis: Thunderbird zeigt keinen automatischen Consent-Prompt).
- [Mozilla Add-on-Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) – Kapitel 1, 3, 4, 6.
- [Firefox built-in data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
  und MDN `browser_specific_settings`.
- `node_modules/addons-linter` (Validator von AMO und ATN) – Regel `NONE_DATA_COLLECTION_IS_EXCLUSIVE`.
- `node_modules/web-ext` – Default-Signierziel `addons.mozilla.org/api/v5/`.
- Repository-Dateien, jeweils mit Datei/Zeile zitiert.

**Weiter:** Aufgabenplan dieser Iteration → [AUFGABENPLAN_STORE_READINESS_1.6.1.md](AUFGABENPLAN_STORE_READINESS_1.6.1.md)



