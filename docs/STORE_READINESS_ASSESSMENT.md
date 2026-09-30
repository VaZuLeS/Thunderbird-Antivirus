# Store-Readiness-Bewertung (aktueller Stand) — Thundy AV 1.6

**Zweck:** Bewertung, ob dieses Paket **jetzt** bei addons.thunderbird.net (ATN) eingereicht werden kann.
Grundlage: die Analyse vom Stand `1a72c45` ([STORE_READINESS_REVIEW_1.6.md](STORE_READINESS_REVIEW_1.6.md)),
die darauf folgende Umsetzung und eine **neue** Nachmessung am Commit `b27a487`.

**Gegenstand:** Thunderbird-WebExtension „Thundy AV – Email Scanner for Thunderbird“, MV3, Version 1.6,
ID `thundy-av@bludau-it-services.de`, `strict_min_version 140.0`.

**Methode:** vollständiger Test-/Lint-/Build-Lauf, Pre-Submit-Checks, Paketinspektion, Abgleich von
Manifest ⇔ Code ⇔ veröffentlichter Doku, Prüfung der Live-URLs, unabhängige Gegenprüfung
(siehe Anhang B).

---

## 1. Kurzurteil

| Bereich | Status |
|---|---|
| Manifest-, Paket- und Rechtekonformität | 🟢 erfüllt (auch automatisiert geprüft) |
| Datenschutz-Deklaration und Consent-Durchsetzung | 🟢 erfüllt (deklariert, im Code erzwungen, mehrfach getestet) |
| Übereinstimmung Listing/Policy ↔ Code | 🟢 erfüllt (nach Doku-Abgleich) |
| Tests, Lint, Paket, Lokalisierung | 🟢 erfüllt (462 Tests, Lint 0 Fehler, 18 Dateien, 194×2 Katalog-Keys) |
| Icons, Lizenz, Support, Datenschutz-URL | 🟢 erfüllt |
| **Manuelle Live-Verifikation in Thunderbird** | 🔴 **offen** — Kernfunktion nur durch Unit-Tests mit gemockten APIs belegt |
| **Store-Screenshots** | 🔴 **offen** — nur SVG-Platzhalter |
| **Signierung + Einreichung** | 🔴 **offen** — kein signiertes XPI, kein Listing, keine Store-URL |
| CI-Abdeckung der neuen Tests | 🟠 aktiv nur `background.test.js`; vollständige Definition liegt in `docs/ci/ci.yml` |

**Ergebnis:** Das Paket ist **technisch einreichungsreif** — die formalen und die inhaltlichen
Store-Anforderungen sind erfüllt und im Repository belegbar. Die Einreichung scheitert derzeit **nicht** an
Code oder Deklarationen, sondern an drei organisatorischen Schritten, die in dieser Umgebung nicht leistbar
sind: **Live-Test → Screenshots → Signieren/Einreichen**.

---

## 2. Frische Nachweise (Commit `b27a487`)

```bash
npm test                                          # 462 Tests, 69 Suites, 0 Fehler
npm run pre-submit-checks                         # 0 Fehler, 2 Warnungen (Screenshots, reduzierte CI)
npx web-ext lint --source-dir . --output json     # 0 Fehler, 25 bekannte Thunderbird-False-Positives
npx web-ext build --source-dir . --artifacts-dir ./build --overwrite-dest
node scripts/verify-package.js ./build            # 18 Dateien, 270 797 Bytes, Paketinhalt gültig
curl -s -o /dev/null -w '%{http_code}' https://vazules.github.io/Thunderbird-Antivirus/privacy_policy.html   # 200
```

Zusätzliche Prüfungen, die die Pre-Submit-Checks seit der Umsetzung automatisch abdecken
(`npm run pre-submit-checks`):

| Prüfung | Ergebnis |
|---|---|
| MV3, Versionsformat, `homepage_url` https, Add-on-ID, Default-Locale | ok |
| `data_collection_permissions` deckt `personalCommunications` ab (**optional**) | ok |
| Optionale Host-Rechte: gültige Match-Patterns, nur für Analyse-Anbieter | ok (5 Origins) |
| benutzter API-Namespace ⇔ deklarierte Berechtigung (`downloads`, `menus`, `messageDisplay`, `messages`, `notifications`, `scripting`, `storage`) | ok |
| registriertes Message-Display-Skript liegt im Paket (`message_display.js`) | ok |
| alle 181 lokalisierten UI-Strings haben einen Katalogeintrag (Default-Locale `en`) | ok |
| kein Legacy `install.rdf`, Datenschutzerklärung vorhanden und von 3 Landingpages verlinkt, Versionen konsistent | ok |
| Screenshots, vollständige Testsuite in der aktiven CI | Warnung (bewusst, siehe Abschnitt 4) |

---

## 3. Was inhaltlich erfüllt ist (jeweils mit Beleg)

**Manifest und Berechtigungen**
- MV3, sprechender Name ohne Trademark-Präfix, `short_name`, ID, Version 1.6, `strict_min_version 140.0`,
  `options_ui.open_in_tab`, CSP `script-src 'self'; object-src 'none'` (`manifest.json`).
- Rechte: `messagesRead`, `storage`, `notifications`, `scripting`, `downloads`, `menus` — jede wird im Code
  tatsächlich genutzt (Kontextmenü jetzt inklusive, `background.js:1743-1842`).
- Host-Zugriff ausschließlich optional und auf die fünf real aufgerufenen Origins begrenzt
  (`manifest.json:27-33`); die Optionsseite fragt sie erst beim Speichern des jeweiligen Schlüssels an
  (`options.js:171-194`).

**Datenschutz**
- Deklaration: `required: ["none"]`, `optional: ["personalCommunications"]` — „nichts ist verpflichtend,
  Nachrichteninhalte nur nach Opt-in“; vom Validator akzeptiert (Lint 0 Fehler).
- Durchsetzung an einer Stelle: `mayTransmitExternally()` prüft die eigene Zustimmung **und** die (falls
  vorhandene) eingebaute Kategorie-Zustimmung (`background.js:72-95`); alle Provider-Pfade sind über
  `assertExternalAnalysisAllowed()`/`mayTransmitExternally()` abgesichert, inklusive der neuen
  Time-of-Click- und Auto-Scan-Pfade.
- Popup: ohne Zustimmung keine Anbieter-Abfrage und keine Upload-Aktionen (`api.js:215-232`), mit Test.
- Kein Remote-Code, kein `eval`/`new Function`, kein `innerHTML` im Produktivcode, keine externen Fonts/CDNs;
  ausgeführte Skripte sind ausschließlich gebündelt (`message_display.js` wird per `registerScripts`
  registriert).

**Funktionsumfang (jetzt durch Code gedeckt)**
- Lokale Bewertung beim Anzeigen einer Nachricht (Score 0–100, Begründungen), Banner mit zwei Opt-in-Aktionen,
  Warnbanner ab Score 50, SPF/DKIM/DMARC-Badge (`message_display.js`).
- Time-of-Click: Prüfung vor dem Öffnen, Blockade bei bekannten bösartigen/nicht verifizierbaren Links,
  Fail-Closed für nicht prüfbare Schemes, Mittelklick ebenfalls abgefangen, explizite Nutzerfreigabe,
  In-Memory-Freigabe für die Sitzung.
- Kontextmenü: Link-Scan und „alle Links dieser Nachricht scannen“ (bis 20 Links).
- Popup: Kopfzeilendaten, gespeicherte Ergebnisse, manueller Upload, „HTML entschärfen“, lokale CDR.
- Optionen: Zustimmung, Datenschutz-Stufen, Listen, IP-Reputation, Auto-Scan, Diagnose der Registrierung.

**Paket, Tests, Lokalisierung**
- XPI enthält 18 Dateien: `manifest.json`, `background.js`, `message_display.js`, `db.js`, `api.js`,
  `api_gateway.js`, `options.{html,js}`, `popup.html`, `theme.css`, 5 Icons, 2 Locale-Kataloge, `LICENSE`.
  Keine Tests, Docs, Lockfiles oder Legacy-Dateien; keine ungenutzten Dateien.
- 462 Tests in 69 Suites, 0 Fehler — u. a. für Consent-Durchsetzung, Datenschutz-Stufen, Berechtigungs-/
  Namespace-Konsistenz, MV3-Portierung, Message-Display-UI und Time-of-Click, Popup-Consent-Gate,
  Lokalisierungs-Helfer und Datenkonsent-Anfrage.
- Lokalisierung: `_locales/en` und `_locales/de` mit je 194 Keys (vollständige Parität, automatisch geprüft), Default-Locale `en`,
  deutsche Fallbacks im Code; Optionsseite, Popup, Banner und Manifest-Strings laufen über `browser.i18n`.

---

## 3b. Nachträglich umgesetzt: Popup-Ergebnisse und Design (September 2026)

Zwei Rückmeldungen aus der Nutzung wurden zusätzlich abgearbeitet:

- **„Die Ergebnisse vom Scan werden nicht angezeigt.“** Zwei Ursachen: (a) der Scan aus dem Banner arbeitete mit
  `{ id }` ohne `headerMessageId`, wodurch alle IndexedDB-Schreibvorgänge still übersprungen wurden, und
  (b) das Popup brach ohne Hybrid-Analysis-Schlüssel sofort ab. Der Scan löst nun den echten `MessageHeader` auf,
  und das Popup zeigt **immer** die lokale Bewertung (Score mit Balken, Begründungen, SPF/DKIM/DMARC-Ergebnis,
  Bewertungszeit) sowie die gespeicherten Anhang-/Link-Verdikte als Status-Chips. Anbieter-Berichte und Uploads
  bleiben durch Zustimmung **und** API-Schlüssel geschützt.
- **Design modernisiert:** `theme.css` wurde auf Design-Tokens (Farben, Abstände, Radien, Schatten, Typo-Skala),
  Hell/Dunkel über `prefers-color-scheme`, sichtbare Fokus-Zustände und reduzierte Bewegung umgestellt; Popup und
  Optionsseite nutzen Karten, Chips, Score-Balken und eine ruhige Hierarchie. Die Banner in der Nachrichtenansicht
  wurden auf dieselben Farbwerte/Abstände gezogen (inline, da eigenes Dokument). Keine Remote-Ressourcen, keine
  Webfonts, CSP unverändert.

Ergänzend in derselben Runde: ein **Integrationstest** (`integration.test.js`), der Hintergrund- und Popup-Skript
gegen **eine** In-Memory-IndexedDB laufen lässt und den Datenvertrag beweist (Nachricht angezeigt → Bewertung unter
der Message-ID gespeichert → Popup zeigt sie), eine **Scan-Aktion im Popup** und ein **Testnachrichten-Fixture**
`docs/test_messages/suspicious_message.eml` für den noch offenen Live-Test; die Pre-Submit-Checks prüfen zusätzlich
die Parität der Locale-Kataloge.

**Store-Relevanz:** Alle Änderungen sind rein lokal — keine neue Berechtigung, kein neuer Netzwerkpfad, keine
zusätzliche Datenerhebung; Datenschutzerklärung und Reviewer-Notizen wurden entsprechend präzisiert.

## 4. Was für die Einreichung noch fehlt (priorisiert)

### Muss vor der Einreichung
1. **Live-Verifikation in Thunderbird 140 ESR** (nicht in dieser Umgebung möglich). Zu prüfen sind genau die
   Pfade, die nur mit gemockten APIs getestet sind: Erscheinen von Opt-in-Banner, Warnbanner und Auth-Badge;
   beide Kontextmenü-Einträge; `permissions.request()` aus dem Bannerpfad; Prüfung/Blockade eines Links
   (inkl. Mittelklick) und die Wirkung von „Link trotzdem öffnen“; Verhalten im 3-Pane **und** in einem
   separaten Nachrichtenfenster. Ergebnis in `docs/STATUS.md` festhalten. Schlägt etwas fehl, betrifft es
   vor allem die Annahme, dass Thunderbird `sender.tab` für Message-Display-Skripte setzt — dafür existiert
   seit `b27a487` ein Fallback auf die aktive Nachrichtenansicht.
2. **Store-Screenshots** (PNG ≥ 1280 × 800, drei Motive) — erst nach dem Live-Test sinnvoll, sie müssen die
   reale Oberfläche zeigen (`docs/screenshot_capture.md`, `docs/store_assets.md`).
3. **Signieren und einreichen**: `npx web-ext sign --channel listed` (Secrets `ATN_API_KEY`/`ATN_API_SECRET`,
   Release-Workflow in `docs/ci/release.yml`), Listing aus `docs/store_listing.md` mit Summary, Beschreibung,
   Kategorie, Lizenz MIT, Support-Kontakt, Datenschutz-URL und Releasenotes.

4. **Datenschutzerklärung neu veröffentlichen.** Die Live-URL antwortet (HTTP 200), liefert aber eine
   **ältere Revision** als das Repository: die Abschnitte zur Datenkonsent-Deklaration und zum Time-of-Click-Pfad
   fehlen dort noch. Vor der Einreichung muss der aktuelle `docs/`-Stand in den Pages-Branch übernommen (bzw. der
   Pages-Build neu ausgelöst) und die Änderung stichprobenartig geprüft werden.

### Sollte (Review-Risiko senken)
5. **CI vervollständigen**: `.github/workflows/ci.yml` führt nur `background.test.js` aus. Die vollständige
   Definition (`npm ci`, Pre-Submit-Checks, **`npm test`**, Lint mit Filter, Build + Paketprüfung) liegt in
   `docs/ci/ci.yml` und muss von einer Person/einem Token **mit `workflows`-Berechtigung** übernommen werden
   (`cp docs/ci/ci.yml .github/workflows/ci.yml && cp docs/ci/release.yml .github/workflows/release.yml`).
   Die Pre-Submit-Checks warnen, solange das nicht geschehen ist.
6. **Release-Artefakt** zur Version 1.6 bauen und am GitHub-Release anhängen (derzeit kein Release-Artefakt),
   damit das signierte Paket nachvollziehbar ist.

### Optional
7. Weitere Sprachen über zusätzliche `_locales/<code>`-Ordner (Infrastruktur steht; nur `en`/`de` gepflegt).
8. Promo-Grafiken für das Listing (ATN verlangt sie nicht).
9. Beobachtung der äußeren Abhängigkeiten: `strict_min_version 140.0` schließt ältere Thunderbird-Versionen
   aus (gewollt, MV3 + eingebaute Datenkonsent); die Provider-APIs können ihre Limits/Preise ändern —
   dokumentiert in `docs/external_service_hardening.md`.


---

## 5. Bewertung und Empfehlung

- **Code/Deklaration/Paket:** einreichungsreif. Es gibt keine bekannten offenen Blocker; die zuvor
  gefundenen vier Blocker (fehlende `menus`-Berechtigung, nicht unterstützter Injektionsweg, kosmetischer
  Time-of-Click mit totem Handler, Popup ohne Consent-Gate) sind behoben und getestet.
- **Prozess:** Die Einreichung ist erst sinnvoll, wenn die Punkte 1–3 erledigt sind. Grund: Ohne Live-Test
  kann der Reviewer die Kernzusage („warnt/blockiert bei verdächtigen Nachrichten und Links“) nicht
  bestätigen, und ein Listing ohne Screenshots ist unüblich.
- **Empfohlene Reihenfolge:** (1) Live-Test in TB 140 ESR → (2) Ergebnisse und ggf. Korrekturen einarbeiten →
  (3) Screenshots → (4) Version/CHANGELOG finalisieren → (5) signieren und einreichen; parallel die
  CI-Übernahme (Punkt 4).
- **Ehrliche Reichweite:** Die Erkennung ist heuristisch (lokaler Score) plus Abfragen bei den Anbietern mit
  **eigenen** API-Schlüsseln. Ohne konfigurierte Schlüssel bleibt der Schutz auf lokale Heuristiken und
  bereits bekannte Verdikte beschränkt — Listing, Reviewer-Notizen und README sagen das so, statt
  Vollständigkeit zu behaupten.

---

## Anhang A — Nachweisdateien

| Aussage | Datei |
|---|---|
| Analyse des Ausgangsbefunds (4 Blocker, 4 hohe Risiken, 8 mittlere Punkte) | `STORE_READINESS_REVIEW_1.6.md` |
| Historische Analyse (Manifest 1.5) | `STORE_READINESS_ANALYSIS.md` |
| Umsetzungsstand, offene Punkte | `STATUS.md` |
| Listing-Texte und Checkliste | `store_listing.md`, `store_assets.md`, `screenshot_capture.md` |
| Reviewer-Notizen (Rechte, Datenflüsse, Testweg) | `reviewer_notes.md` |
| Datenschutzerklärung (DE/EN, live erreichbar) | `privacy_policy.md` |
| Gates | `scripts/pre-submit-checks.js`, `scripts/verify-package.js`, `scripts/filter-lint-warnings.js` |
| CI-Definitionen (vollständig, noch nicht übernommen) | `docs/ci/ci.yml`, `docs/ci/release.yml`, `docs/ci/README.md` |

## Anhang B — Wie dieser Stand geprüft wurde

1. **Befundverifikation (Ausgangsstand `1a72c45`):** alle vier Blocker und der Paket-/Rechteabgleich durch
   einen zweiten Reviewer bestätigt, keine widerlegenden Stellen gefunden.
2. **Regressionsprüfung (nach der Umsetzung):** Injektion, Time-of-Click, Popup-Consent und
   Datenkonsent-Erzwingung bestätigt; die dabei gefundenen Restpunkte (Mittelklick-Bypass, Broadcast-Filter,
   überholte Doku-Aussagen, fehlende Tests, toter `createEl()`-Helper) sind umgesetzt.
3. **ATN-Review-Simulation (dieser Stand):** Ergebnis siehe Abschnitt 4 — keine Code- oder
   Deklarationsblocker; offen sind Live-Test, Screenshots, Signierung/Einreichung und die CI-Übernahme.

*Letzte Aktualisierung: aktueller Commit dieses Branches (`cline/ktzgfrzf`).*

