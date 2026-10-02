# Entscheidungen des Store-Readiness-Arbeitslaufs (Thundy AV 1.6)

**Bezug:** [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) ·
[AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md)
**Snapshot:** Branch `cline/k0d34w90`, Version 1.6.2, Stand 2026-10-01

Dieses Dokument hält die Entscheidungen fest, die den Code- und Doku-Änderungen dieses
Arbeitslaufs zugrunde liegen. Jede Entscheidung nennt den Befund, die Begründung mit Belegquelle
und die Konsequenz für den Code.

---

## D1 — Einreichungskandidat ist dieser Zweig, Version bleibt 1.6
**Bezug:** P0-5 · **Aufgabe:** A-01

- `main` steht auf Version 1.6; im Repository existieren zusätzlich Tags/Releases `v1.6.1` … `v1.18.0`
  auf einer von `main` **divergierten** Linie (Branch `cline/573mahd6`; `git compare` zuletzt
  17 vor / 18 zurück). Diese Linie ist **nicht** der Einreichungskandidat.
- ATN kennt bislang **keine** Version dieses Add-ons (es ist nicht gelistet), deshalb ist 1.6 als erste
  Store-Version zulässig und vermeidet einen Versionssprung ohne Produktgrund.
- Konsequenz: Alle Fixes landen auf `main`-Basis; die Tags `v1.6`/`v1.6.1` bleiben unangetastet
  (Umbenennen/Verschieben bestehender Tags wäre destruktiv und ist eine Maintainer-Entscheidung,
  siehe A-15).

## D2 — Datenübermittlung wird als Opt-in deklariert und zur Laufzeit angefragt
**Bezug:** P0-1, P2-22 · **Aufgabe:** A-02, A-04

- Manifest: `"data_collection_permissions": { "required": ["none"], "optional": ["personalCommunications"] }`.
- Begründung: Ohne Zustimmung überträgt das Add-on nichts (`mayTransmitExternally()`); Thunderbird
  zeigt dafür keinen eigenen Prompt (*„Unlike Firefox, Thunderbird does not use the built-in onboarding
  flow … add-ons must request consent explicitly“*, `webextension-api.thunderbird.net/en/mv3/permissions.html`).
  Die Extension Workshop Doku stellt klar: *„the `required` list … users must accept this data collection
  to use the extension; they cannot opt out“* und *„Incorrect classification of data on the data collection
  consent will result in a review rejection“*.
- Der offizielle Validator (addons-linter 10.13.0) akzeptiert genau diese Kombination mit **0 Fehlern**;
  die frühere Hausregel in `scripts/pre-submit-checks.js`, die `"none"` + `optional` verbot, wurde an das
  Validatorverhalten angeglichen (Verbot nur **innerhalb** von `required`).
- Zusätzlich: Thunderbird-Berechtigung `sensitiveDataUpload` (l10n: *„Transfer sensitive user data
  (if access has been granted) to a remote server for further processing“*, Thunderbirds eigenes
  Zusatz-Add-on nutzt sie) als `optional_permissions` deklariert und in derselben Nutzergeste
  angefragt; bei Widerruf der Zustimmung wieder entfernt.

## D3 — Die Datenschutz-Stufe gilt für alle Pfade, auch für manuelle Aktionen
**Bezug:** P0-2, P2-15 · **Aufgabe:** A-05

- `strict`: nur SHA-256-Hashes und Reputationsabfragen (VT-Hash, URLhaus-Domain, urlscan-Link,
  IP-Reputation) — **kein** Datei-Upload, **kein** URL-Upload. Manueller Upload/URL-Scan im Popup und
  Kontextmenü antworten mit `TIER_BLOCKS_UPLOAD` bzw. `TIER_REQUIRES_MAX` und einem Hinweis mit Link
  in die Einstellungen.
- `balanced`: zusätzlich vollständiger Anhang-Upload (automatisch wie manuell).
- `max`: zusätzlich vollständiger URL-Upload an Hybrid Analysis.
- Konsequenz: Datenschutzerklärung §3.3/§5, Store-Listing und Reviewer-Notes beschreiben exakt dieses
  Verhalten; die Optionsseite deaktiviert die Stufenauswahl nicht mehr bei „Immer manuell scannen“
  (frühere Begründung „bei manuellem Scan irrelevant“ ist damit überholt).

## D4 — Das Popup überträgt nur mit globaler Zustimmung
**Bezug:** P0-7 · **Aufgabe:** A-09

- `api.js` prüft vor jedem Provider-Zugriff `hasExternalAnalysisConsent()` und bricht sonst mit
  `external-analysis-disabled` ab; statt der externen Abfrage rendert es das **lokal** gespeicherte
  Ergebnis (`renderStoredResultWithoutConsent`).

## D5 — Host-Berechtigung wird vor jedem Provider-Aufruf geprüft
**Bezug:** P1-12, P2-23 · **Aufgabe:** A-08

- `requireHostPermission(url)` läuft vor allen Provider-Aufrufen (Hash-Abfrage, Datei-/URL-Upload,
  IP-Reputation, URLhaus, urlscan, VirusTotal) und wirft `HOST_PERMISSION_MISSING` mit klarem Text statt
  eines undurchsichtigen Netzwerkfehlers.
- Der automatische Anhang-Upload nutzt jetzt `apiGateway.fetchWithTimeout(...)` (vorher rohes `fetch`),
  damit Timeout/Rate-Limit greifen.
- Banner: Schlägt die Berechtigungsanfrage fehl (kein Gestenkontext nach `runtime.sendMessage`), zeigt
  das Banner den Hinweis *„… bitte in den Einstellungen erteilen“* plus Button „Einstellungen öffnen“.

## D6 — Injektionsweg bleibt `scripting.executeScript`, Fehler werden sichtbar
**Bezug:** P1-9, P1-10 · **Aufgabe:** A-16

- `scripting.messageDisplay` bietet in Thunderbird **nur** `getRegisteredScripts`, `registerScripts`,
  `unregisterScripts` (Schema `mail/components/extensions/schemas/scripting-tb.json`); der frühere
  „bevorzugte“ Zweig `scripting.messageDisplay.executeScript` war toter Code und wurde entfernt.
- `browser.scripting.executeScript({ target: { tabId } })` ist der dokumentierte Weg (Thunderbirds eigener
  Browsertest `browser_ext_messageDisplayScripts_mv3.js` nutzt ihn für `mail`-Tabs und verlangt die
  `messagesRead`-Host-Berechtigung, die deklariert ist).
- Schlägt die Injektion fehl, meldet das Add-on das **einmal pro Sitzung** per Benachrichtigung
  (vorher: nur `Logger.warn`).
- Die MV2-Fallbacks (`onMessageDisplayed`, `getDisplayedMessage`) sind entfernt (`strict_min_version`
  ist 140.0); ein Pre-Submit-Check verhindert den Rückfall.

## D7 — Kontextmenüs mit `menus`, Inhalte ohne vollständige URL
**Bezug:** P0-8, P3-25 · **Aufgabe:** A-10

- `menus` steht jetzt in `permissions`; ohne sie ist `browser.menus` undefiniert und beide Einträge
  wären still tot (der Code bricht vorher mit einem Guard ab).
- Benachrichtigungen melden nur noch den Host der gescannten URL (`describeUrlForUser`), nicht die
  vollständige URL mit Tracking-Parametern.
- `menus.create` wird zusätzlich asynchron abgefangen; der `runtime.onMessage`-Listener ignoriert
  Nachrichten fremder Absender.

## D8 — Repository-Hygiene: ein Paketmanager, Entwicklerdateien unter `tools/`
**Bezug:** P2-16, P3-20, P3-23, P3-24 · **Aufgabe:** A-07, A-21

- `pnpm-lock.yaml` entfernt (npm ist der alleinige Paketmanager, `package-lock.json` bleibt).
- Entwickler-Skripte liegen unter `tools/` und heißen `*.dev.js`, damit die Node-Test-Erkennung sie
  nicht mehr als Tests ausführt; `npm test` listet die Testdateien zusätzlich **explizit** auf.
- `.webextignore` entfernt: `web-ext` liest die Datei nicht (nachgeprüft: `grep -r webextignore
  node_modules/web-ext/lib` und `web-ext build --no-config-discovery`) — alleinige Quelle ist
  `web-ext-config.mjs`.
- Scratch-Dateien (`test_regex_escape*.js`) entfernt; damit ist das Paket-Gate wieder grün.

## D9 — CI-Gate und Signierweg
**Bezug:** P1-7, P1-8, P1-14, P1-15 · **Aufgabe:** A-12, A-19

- Der volle Gate (`npm test` inkl. aller Dateien, Lint mit kuratiertem Filter, Build + Paketprüfung)
  liegt in `docs/ci/ci.yml`; der Push unter `.github/workflows/` wird vom verwendeten Token ohne
  `workflows`-Berechtigung abgelehnt (reproduziert, siehe `docs/ci/README.md`). Lokal entspricht
  `npm run check` exakt diesem Job, `npm run store-gate` ergänzt die Artefakt-Kriterien.
- Der Signieraufruf muss `--amo-base-url https://addons.thunderbird.net/api/v5/` setzen (`web-ext`
  würde sonst gegen die AMO-API senden) und bei `--channel listed` `--approval-timeout 0` verwenden
  (Default 900 s < Review-Dauer).

## D10 — Bewusst offen gelassen (nicht in dieser Umgebung lösbar)
**Bezug:** P0-3, P0-4, P1-13 · **Aufgabe:** A-03, A-06, A-11, A-15, A-18, A-20

- Live-Test in Thunderbird 140 ESR (Protokoll: `docs/live_test_protocol.md`, Testdaten: `testdata/`).
- Echte Screenshots (nur SVG-Platzhalter vorhanden).
- ATN-Listung, Signierung und Store-URL (kein ATN-Konto/Netzwerkpfad in dieser Umgebung).
- Umgang mit dem Git-Tag: `v1.6` zeigt auf einen älteren Commit; entweder Tag bewusst neu setzen
  (`git tag -f v1.6 <commit> && git push --force origin v1.6`) **oder** Version erhöhen. Das Gate
  `npm run store-gate` (Kriterium C7) verlangt einen Tag auf dem eingereichten Commit.
- **Release-Metadaten:** Der Versuch, das 2024er-Release
  (`Thunderbird Email Anitivirus by Hybrid Analysis`, Tag `Thunderbird`) per `make_latest=false` aus der
  „Latest“-Anzeige zu nehmen, ändert die Anzeige **nicht**: GitHub berechnet „latest“ als *jüngstes
  nicht-Pre-Release, nicht-Draft-Release*, und das ist weiterhin dieses Release
  (`gh api repos/…/releases/latest` → `Thunderbird`). Zwei saubere Wege, beide bewusst dem Maintainer
  überlassen: (a) das Kandidaten-Release veröffentlichen (A-15), oder (b) das Alt-Release als
  Pre-Release markieren (`gh release edit Thunderbird --prerelease`). Keine dieser Änderungen wurde
  ausgeführt, um die öffentliche Darstellung des Repositories nicht eigenmächtig zu verändern.

- Der Zustand wird beim Start aus `browser.storage.local` gelesen und über `storage.onChanged`
  aktualisiert, damit ein Widerruf im laufenden Popup wirkt.
- Nachweis: Regressionstest in `api.test.js` und `test/consent-and-tier.test.js` (kein `fetch`,
  kein Cache-Eintrag ohne Zustimmung).


## D11 — Version 1.6.2 und Release-Ablauf
**Bezug:** R-1, R-2, R-5, R-6 · **Aufgabe:** R-01 … R-08

**Versionsentscheidung.** Vor dem Bump geprüft: `api/v4/addons/addon/thundy-av@bludau-it-services.de/`
antwortet **HTTP 404** — es existiert **keine** veröffentlichte Version, ATN stellt also keine
Monotonie-Anforderung. Im Repository sind `v1.6` (Commit `351001f`) und `v1.6.1` … `v1.18.0` (divergierte
Linie) bereits belegt. Gewählt: **1.6.2**, weil
1. der Tag `v1.6.2` frei ist und der Tag damit genau den veröffentlichten Commit bezeichnet,
2. es der nächste Patch der Linie ist, die `main` repräsentiert (keine Aussage über die nie
   veröffentlichte 1.7–1.18-Linie),
3. die Add-on-Version bei ATN unabhängig von Git-Tags ist: die erste Einreichung darf 1.6.2 sein.
Bewusst **nicht** 1.19.0 (würde eine Produkthistorie suggerieren, die es nicht gibt) und **nicht**
`v1.6` auf den neuen Commit umschreiben (bestehende Tags werden nicht verändert).

**Release-Ablauf (nachvollziehbar).**
```bash
npm ci
npm run check                        # Pre-Submit + 427 Tests + Lint-Filter + Build/Paketprüfung
sha256sum build/thundy_av_email_scanner_for_thunderbird-1.6.2.zip
git tag -a v1.6.2 -m 'Thundy AV 1.6.2 - Store-Readiness-Release' && git push origin refs/tags/v1.6.2
gh release create v1.6.2 --verify-tag --notes-file <notes> ./thundy-av-1.6.2.xpi
gh release download v1.6.2 -p thundy-av-1.6.2.xpi -D /tmp/dl && sha256sum /tmp/dl/thundy-av-1.6.2.xpi
```
Der Build ist **nicht byte-reproduzierbar** (P2-21: wechselnde Eintragsreihenfolge/Zeitstempel), deshalb
gilt der Hash nur für dieses konkrete Artefakt und wird im Release mitgeführt.

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.2 (`manifest.json`, `package.json`, `package-lock.json`) |
| Commit / Tag | `a94c9ec` / `v1.6.2` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.2 (kein Pre-Release → automatisch „Latest“) |
| Asset | `thundy-av-1.6.2.xpi`, 53.277 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `12cd335b140cb745c158dacb69db2105c253716f7d4d4f0a5bb242b89689cdee` |
| Paketinhalt | 17 Dateien, 196.507 Bytes entpackt |

**Hinweis zur Branch-Lage:** Der Tag zeigt auf einen Commit des Arbeitszweigs `cline/k0d34w90`. Für ein
konsistentes `main` sollte dieser Zweig zusammengeführt werden; der Release bleibt über den Tag auch ohne
Merge erreichbar.

**Nicht Bestandteil dieses Releases:** ATN-Upload/Signierung (benötigt die ATN-API-Schlüssel des
Maintainers), echte Screenshots und der Live-Test in Thunderbird 140 ESR.


## D12 — Version 1.6.3 (Forscher-Ansicht, Benachrichtigungen, Design)
**Bezug:** Runde 3 der Problemanalyse · **Aufgabe:** S-01 … S-08

**Umfang.** Analysesicht für IT-Sicherheitsforscher im Popup, gebündelte Benachrichtigungen und ein
durchgängiges Design-System (Details in [STATUS.md](STATUS.md) und [CHANGELOG.md](../CHANGELOG.md)).

**Bewusste Entscheidungen.**
1. **Keine neuen Berechtigungen.** Alles wird lokal aus der geöffneten Nachricht abgeleitet;
   `messagesRead`, `storage`, `notifications` und `downloads` genügen. Damit bleibt die
   Berechtigungsbegründung im Review unverändert.
2. **Dossier im Hintergrund, Rendern im Popup.** Die Analytik (Header-Parsing, IOC-Extraktion,
   MITRE-Zuordnung, Score-Aufschlüsselung) bleibt im Hintergrundskript; das Popup ruft es über
   `getResearchDossier` ab. So gibt es genau eine Implementierung und das Popup bleibt schlank.
3. **MITRE-Zuordnung ist ausdrücklich heuristisch.** Jede Technik trägt `confidence: 'heuristic'` und
   einen Belegindikator; die Oberfläche kennzeichnet das („kein Nachweis eines Angriffs, keine
   Attribuierung“). Ein Automatismus, der Techniken als Tatsache darstellt, wäre fachlich falsch.
4. **Benachrichtigungen aktualisieren statt stapeln.** Eine stabile ID je Scan-Vorgang
   (`scan-message-<id>`, `scan-links-<id>`, `scan-url-<host>`); `notifications.create(id, options)`
   ersetzt die bestehende Meldung. Thunderbird markiert `buttons` als **nicht unterstützt**, deshalb
   ist der Klick auf die Meldung die einzige Aktion — er öffnet die Nachricht (`messageDisplay.open`).
5. **Export rein lokal.** JSON/CSV/STIX-2.1 werden im Popup erzeugt und über den Download-Manager
   gespeichert (`saveResearchExport`); das STIX-Bundle ist bewusst minimal (Identity + Indikatoren) und
   als heuristisch gelabelt.
6. **Versionierung:** 1.6.3 als nächster Patch der Linie, die `main` repräsentiert (gleiche Begründung
   wie D11; die Tag-Nummern 1.7.0–1.18.0 bleiben der unveröffentlichten Nebenlinie vorbehalten).

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.3 (`manifest.json`, `package.json`, `package-lock.json`) |
| Commit / Tag | `2afddd7` / `v1.6.3` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.3 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.3.xpi`, 75.640 Bytes (byte-identisch mit dem web-ext-Build, per `cmp` geprüft) |
| SHA-256 | `d2a57233ba5ae962b76f58a7ea33f3f6b33e893ce92849907d77f1981df2c108` |
| Paketinhalt | 17 Dateien, 284.739 Bytes entpackt |
| Gates | 452 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 26 kuratierte Warnungen |

**Nicht in dieser Runde:** Screenshots und der Live-Test in Thunderbird 140 ESR (beide manuell,
Kriterien C5/C6 im Store-Gate); die ATN-Einreichung braucht weiterhin die API-Schlüssel des
Maintainers.

## D13 — Version 1.6.4: Selbsttest und wiederverwendete Anbieter-Zustände
**Bezug:** Runde 4 der Problemanalyse (Q-1 … Q-4) · **Aufgabe:** Q-01 … Q-05

**Umfang.** Eingebauter Selbsttest/Diagnose in den Einstellungen, Anzeige gespeicherter
Anbieter-Zustände in der Forscher-Ansicht und ein Hash-Cache für Anhänge.

**Bewusste Entscheidungen.**
1. **Der Selbsttest ersetzt den Live-Test nicht.** Er prüft API-Verfügbarkeit, Sperren, Parser und die
   Injektionskette programmatisch — die **visuelle** Banner-Optik, die Kontextmenüeinträge und die
   Berechtigungsdialoge bleiben manuell (Kriterium C6 des Store-Gates bleibt deshalb offen).
2. **Keine Übertragung im Selbsttest.** Alle Eingaben sind synthetisch; es werden keine Anbieter-Endpunkte
   aufgerufen. Nur die Benachrichtigungs-Prüfung erzeugt eine sichtbare Testmeldung, die sofort wieder
   entfernt wird — das ist gewollt, weil genau dieser Pfad geprüft werden soll.
3. **Keine neuen Berechtigungen** (weiterhin `messagesRead`, `storage`, `notifications`, `downloads`,
   `scripting`, `menus`; optional `sensitiveDataUpload`).
4. **Gespeicherte Anbieter-Zustände statt neuer Anfragen.** Das Dossier liest den lokalen Datensatz
   (IndexedDB, Store `hybridanalysis`) und kennzeichnet übernommene Werte mit `stateSource: 'stored'`,
   damit Rate-Limits und das eigene Kontingent geschont werden.
5. **Hash-Cache je Nachricht und Nachrichtenteil** (`ATTACHMENT_HASH_CACHE`, Obergrenze 200 Einträge):
   wiederholtes Öffnen des Popups hasht große Anhänge nicht erneut.

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.4 (`manifest.json`, `package.json`, `package-lock.json`) |
| Commit / Tag | `7b92d58` / `v1.6.4` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.4 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.4.xpi`, 85.318 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `f7455ae4ea25c11ca9c6308f962a9d0a53b55abcb3ec38800ec883a4e12b98d8` |
| Paketinhalt | 17 Dateien, 322.256 Bytes entpackt |
| Gates | 459 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 30 kuratierte Warnungen |

## D14 — Version 1.6.5: inertes „Entschärfen“, validierte Nachrichtengrenze, Exportgrenzen
**Bezug:** Runde 5 (Thema T2 „Security & Robustheit“ in [ROADMAP.md](ROADMAP.md)) · **Aufgabe:** S2-01 … S2-04

**Bewusste Entscheidungen.**
1. **Entschärfen heißt ab jetzt auch: keine Netzwerkaktivität.** Eine geöffnete Kopie darf weder
   Skripte ausführen noch zum Absender zurückfunken (Tracking-Pixel, CSS-Import). Remote-Ziele werden
   entfernt, aber im Attribut `data-thundy-blocked-*` **lesbar** gehalten — Analysewert ohne Risiko.
2. **`<a href>` bleibt erhalten.** Die Datei ist inert, nicht interaktionsfrei; das ist in README und
   Bedrohungsmodell ausdrücklich benannt (Restrisiko 3).
3. **Die Nachrichtengrenze validiert Typen, nicht nur Aktionen.** Unbekannte Aktionen und falsche
   Payload-Typen werden mit einem Fehlercode beantwortet, statt in die Analytik zu laufen.
4. **Exporte sind begrenzt** (5 MB, MIME-Whitelist) — unabhängig davon, ob sie über die Nachrichtengrenze
   oder direkt (Selbsttest-Bericht) entstehen.
5. **Keine neuen Berechtigungen**; alle Prüfungen bleiben lokal.

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.5 (`manifest.json`, `package.json`, `package-lock.json`) |
| Commit / Tag | `821aafc` / `v1.6.5` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.5 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.5.xpi`, 87.044 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `9311dbd9166a7c644e4dc5dd920b71737cc7814d2768a31605e128f571d781f3` |
| Paketinhalt | 17 Dateien, 329.550 Bytes entpackt |
| Gates | 468 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 30 kuratierte Warnungen |

## D15 — Version 1.6.6: lokaler Indikator-Index, Pivot, Verlaufssuche
**Bezug:** Thema T8 in [ROADMAP.md](ROADMAP.md) · **Aufgabe:** F-01 … F-07

**Bewusste Entscheidungen.**
1. **Triage über Nachrichten hinweg statt Einzelbewertung.** Der Index beantwortet die Analystenfrage
   „wo kommt dieser Indikator sonst vor?“ — die Datenbasis sind ausschließlich **selbst gescannte**
   Nachrichten (kein Nachladen, keine Ordnerdurchläufe ohne Scan).
2. **Keine neuen Berechtigungen.** Der Index lebt in der vorhandenen IndexedDB (`messagesRead`+`storage`);
   das Öffnen eines Treffers nutzt `messageDisplay.open({ headerMessageId })`.
3. **Nur Indikatoren, keine Inhalte** und harte Obergrenze (300 Einträge je Nachricht).
4. **Löschbarkeit ist Teil der Funktion:** „Cache leeren“ entfernt `hybridanalysis` **und** `iocs`; die
   Datenschutzerklärung beschreibt Inhalt, Zweck, Datenbasis und Löschweg (DE §4.1, EN „Local indicator
   index“).
5. **Migration wird geprüft, nicht angenommen:** Der Selbsttest führt einen Index-Roundtrip
   (Schreiben → Pivot → Löschen) in der laufenden Installation aus (DB-Version 3 → 4).

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.6 (`manifest.json`, `package.json`, `package-lock.json`) |
| Commit / Tag | `f2924fe` / `v1.6.6` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.6 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.6.xpi`, 92.202 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `738739f0f3304cec160885c1e7668a50f777bdd8ba7720c95a4bc003b46005f7` |
| Paketinhalt | 17 Dateien, 354.203 Bytes entpackt |
| Gates | 474 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 35 kuratierte Warnungen |

## D16 — Version 1.6.7: Sammel-Scan, Case-Notizen, ZIP-Innenansicht, Evidence-Hash
**Bezug:** Thema T9 in [ROADMAP.md](ROADMAP.md) · **Aufgabe:** T9-1 … T9-4

**Bewusste Entscheidungen.**
1. **Sammel-Scan bleibt lokal und zustimmungsgebunden.** Die Bewertung je Nachricht nutzt dieselben
   Pfade wie der Einzel-Scan; Reputationsabfragen laufen nur mit aktiver Zustimmung und erteiltem
   Host-Recht. Ohne Zustimmung ist der Lauf trotzdem nützlich (lokale Heuristiken, Index).
2. **Keine neuen Berechtigungen:** Der Sammel-Scan nutzt `messages.*` + `menus` (Kontext `message_list`),
   die Case-Notiz die vorhandene IndexedDB, die ZIP-Ansicht einen eigenen Parser, der Evidence-Hash
   `crypto.subtle`.
3. **ZIP wird nicht entpackt.** Gelesen wird ausschließlich das Zentralverzeichnis; damit sieht der
   Analyst Dateinamen, Größen, Kompressionsverfahren und Verschlüsselungsflag, ohne dass Inhalte
   geschrieben oder ausgeführt werden. Grenzen: 32 MB, 200 Einträge.
4. **Der Evidence-Hash ist kanonisch**, d. h. ohne flüchtige Felder (Erhebungszeitpunkt, Reihenfolge). Das
   ist die Voraussetzung dafür, dass zwei Läufe über denselben Inhalt denselben Hash ergeben — nur so ist
   er als Prüfsumme brauchbar.
5. **Obergrenze 100 Nachrichten pro Sammel-Lauf**, damit ein versehentlicher Lauf über einen großen Ordner
   weder Thunderbird noch Anbieter-Kontingente belastet.

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.7 |
| Commit / Tag | `55b346b` / `v1.6.7` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.7 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.7.xpi`, 100.842 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `3d1db952d8309b218c6e5b7ebaafaa53ae65faaa35bff5cce52c58cf78ddb268` |
| Paketinhalt | 17 Dateien, 392.882 Bytes entpackt |
| Gates | 481 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 40 kuratierte Warnungen |

## D17 — Version 1.6.8: Toolbar-Indikator, Inline-Status, Link-Prüfung vor dem Öffnen
**Bezug:** Auftrag „Gefährdungsindikator in der Toolbar, Inline-Darstellung/Informationsgehalt verbessern,
Links nicht mehr ungeprüft extern öffnen"

**Bewusste Entscheidungen.**
1. **Der Badge-Text ist der Score, nicht ein Symbol.** Wer den Button sieht, kennt sofort die Zahl; die
   Farbe liefert die Schweregrad-Klasse. Bei „clean“ und Score 0 bleibt das Badge leer, damit das Add-on
   nicht dauerhaft Alarm signalisiert.
2. **Inline-Kopfzeile auch unterhalb der Warnschwelle.** Der bisherige Warnbanner erschien erst ab
   Score ≥ 50; damit war eine „mittlere“ Nachricht unsichtbar. Die neue Statusleiste zeigt Score,
   Schweregrad, Auth-Status und die Top-Gründe immer — der Warnbanner bleibt für ≥ 50 erhalten.
3. **Link-Prüfung ist ein Gate, kein Verbot.** Der erste Klick prüft und zeigt das Ergebnis; geöffnet wird
   erst nach Bestätigung („Jetzt öffnen“ oder zweiter Klick). Ohne Zustimmung/urlscan-Schlüssel lautet das
   Ergebnis „ungeprüft“ — die Entscheidung bleibt beim Nutzer, es wird nichts blockiert.
4. **Übergabe an den Standardbrowser über `tabs.create`** (bestehender Berechtigungsumfang), nicht über
   einen Umweg aus dem Nachrichtendokument heraus. Keine neuen Berechtigungen.
5. **Weiterhin nur gebündelter Code** in den Injektionen (Funktion + Argumente, keine Code-Strings); der
   Link-Guard bekommt die angereicherten Linkdaten statt reiner URLs.

**Veröffentlichtes Artefakt**

| Feld | Wert |
|---|---|
| Version | 1.6.8 |
| Commit / Tag | `cbbdfb5` / `v1.6.8` (annotiert) |
| Release | https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.6.8 (kein Pre-Release → „Latest“) |
| Asset | `thundy-av-1.6.8.xpi`, 104.580 Bytes (byte-identisch mit dem web-ext-Build) |
| SHA-256 | `5631238afd329962d492b94f8d8d11ca612414a0a2054aad20b9957caba4cb41` |
| Paketinhalt | 17 Dateien, 407.827 Bytes entpackt |
| Gates | 489 Tests / 0 Fehler · Pre-Submit 0 Fehler / 1 Warnung · Lint 0 Fehler / 46 kuratierte Warnungen |

**Bitte im Live-Test prüfen:** Optik/Position von Badge und Inline-Statusleiste, das Banner beim Link-Klick
und der zweistufige Öffnungsweg (das Verhalten ist mit gemockten APIs getestet, die Optik nicht).
