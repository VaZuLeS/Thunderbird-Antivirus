# Aufgabenplan – Store-Readiness „Thundy AV“ (Thunderbird Add-ons Store)

**Grundlage:** [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) (Befunde P0-1 … P3-17).
Dieser Plan ist die Umsetzung der dortigen Befunde: jede Aufgabe nennt die Befund-ID, ein prüfbares
Ergebnisartefakt und ein Abnahmekriterium. Er ist so geschrieben, dass er direkt als Arbeitsliste
(Board/Checkliste) verwendet werden kann.

| Feld | Wert |
|---|---|
| Ziel | Einreichung von Version 1.6/1.6.x im ATN als `listed`-Add-on, ohne Ablehnungsschleife |
| Ausgangslage | 5 Blocker, 6 hohe Risiken, 6 mittlere, 1 kleiner Punkt |
| Geschätzter Gesamtaufwand | ≈ 8–10 Personentage (zzgl. Wartezeit im Review) |
| Kritischer Pfad | A-01/A-02 → A-11/A-12/A-13 → A-17 → A-16 → A-15 → A-21 → A-22 → A-31 → A-32 |

## Legende

| Kürzel | Bedeutung |
|---|---|
| **P0 / P1 / P2 / P3** | Priorität aus der Problemanalyse (P0 = Einreichungsblocker) |
| **Aufwand** | Schätzung in Personentagen (PT), ohne Review-Wartezeit |
| **Status** | ⬜ offen · 🟨 in Arbeit · ✅ erledigt · ⛔ blockiert |
| **DoD** | Definition of Done: Ergebnis ist prüfbar, nicht „gefühlt fertig“ |

---

## 1. Traceability-Matrix (Befund → Aufgabe)

| Befund | Aufgabe(n) |
|---|---|
| P0-1 Kernfunktion nicht nachgewiesen | A-02, A-03, A-11, A-12, A-13, A-17 |
| P0-2 keine echten Screenshots | A-16 |
| P0-3 keine Reviewer-Testmittel | A-02, A-15 |
| P0-4 Datendeklaration/Consent | A-04, A-14 |
| P0-5 keine Store-Präsenz | A-01, A-31, A-32 |
| P1-6 Signierweg zielt auf AMO | A-22, A-25 |
| P1-7 aktive CI zu schwach | A-19 |
| P1-8 kein Release-Artefakt | A-20, A-22 |
| P1-9 UI nur deutsch | A-23 |
| P1-10 MV2-Altpfade/Linter-Rauschen | A-24 |
| P1-11 Fehler bleiben unsichtbar | A-17 |
| P2-12 Dokumentationsdrift | A-25 |
| P2-13 Reviewer-Origins ≠ Manifest | A-25 |
| P2-14 Listing-Metadaten offen | A-32 |
| P2-15 Kompatibilitätsaussage | A-32 |
| P2-16 Umgehung des ApiGateway | A-26 |
| P3-17 doppelte Ignore-Konfiguration | A-26 |

---

## 2. Phase 0 – Vorbereitung und Entscheidungen (Ziel: 1–2 Tage)

| ID | Aufgabe | Prio | Abh. | Aufwand | Ergebnisartefakt | Abnahmekriterium | Status |
|---|---|---|---|---|---|---|---|
| A-01 | ATN-Entwicklerkonto anlegen, Add-on-Eintrag im Developer Hub erstellen, API-Schlüsselpaar für automatisiertes Signieren erzeugen und als Repository-Secrets `ATN_API_KEY`/`ATN_API_SECRET` hinterlegen | P0-5 | – | 0,5 | Konto + Secrets + reservierter Add-on-Slug | Signier- und Validator-Aufruf sind möglich; Secrets sind nirgends im Repo | ⬜ |
| A-02 | Testumgebung bereitstellen: Thunderbird 140 ESR mit separatem Profil, Test-Mailkonto, feste Testdaten (Mail mit harmlosem Anhang, HTML-Anhang, HTTP-Link, SPF/DKIM-Probe, verdächtige Betreffzeile) | P0-1, P0-3 | – | 0,5 | `docs/testdata.md` mit Testmails/Profil-Setup, Testdateien im Repo | Testdaten sind reproduzierbar erzeugbar und enthalten keine Echtdaten | ⬜ |
| A-03 | Live-Test-Protokoll als Vorlage anlegen (Schritte, erwartetes Verhalten, tatsächliches Verhalten, TB-Version, Logauszug, Screenshotverweis) | P0-1 | – | 0,25 | `docs/live_test_protocol.md` | Jeder Schritt aus A-11/A-12/A-13 hat eine Zeile mit Erwartung/Ergebnis | ⬜ |
| A-04 | Policy-Klärung vorbereiten und beim ATN/AMO-Reviewteam anfragen: Muss `personalCommunications` bei rein Opt-in-basierter Weitergabe `optional` statt `required` sein, und genügt die Optionsseiten-Checkbox als Consent-Ort (Policy 6.2.2 „immediately after installation“)? | P0-4 | – | 0,25 | E-Mail-Entwurf + Dokumentation der Antwort in `docs/reviewer_notes.md` | Es liegt eine schriftliche Auslegung oder eine begründete Eigenentscheidung mit Policy-Zitaten vor | ⬜ |

---

## 3. Phase 1 – Blocker auflösen (Ziel: 2–3 Tage)

| ID | Aufgabe | Prio | Abh. | Aufwand | Ergebnisartefakt | Abnahmekriterium | Status |
|---|---|---|---|---|---|---|---|
| A-11 | Live-Test der Banner-Injektion: beim Öffnen einer Testnachricht mit Anhang erscheinen Opt-in-Banner (beide Buttons) und bei Risiko-Score über Schwelle das Warnbanner; zusätzlich prüfen, ob `scripting.executeScript` mit `target.tabId` ohne Host-Berechtigung auf dem Nachrichtenansichts-Tab greift und ob `browser.i18n.getMessage()` im injizierten Kontext aufgelöst wird | P0-1 | A-02, A-03 | 0,5 | Ausgefülltes Protokoll + Screenshot-Beleg + Codefix oder Feature-Korrektur im Listing | Banner erscheint in TB 140 ESR reproduzierbar; bei Fehlschlag ist die Ursache dokumentiert und entweder behoben oder das Feature aus Listing/Reviewer-Notes entfernt | ⬜ |
| A-12 | Live-Test des Consent-/Permission-Flows: Opt-in-Schalter aus → keine Netzwerkanfrage (Netzwerk-Panel); Schalter an + Schlüssel speichern → Host-Permission-Prompt; danach Button „Nur diese Nachricht scannen“ aus dem Banner (prüft, ob die User-Geste über `runtime.sendMessage` bis `permissions.request()` erhalten bleibt) | P0-1, P1-11 | A-11 | 0,5 | Ausgefülltes Protokoll + Netzwerk-Mitschrift | Beide Wege (Optionsseite, Banner-Button) führen zu einer erfolgreichen, nachvollziehbaren Freigabe **oder** der Banner-Weg wurde auf einen gestengerechten Ablauf umgebaut | ⬜ |
| A-13 | Live-Test Kontextmenü und Time-of-Click: Eintrag „Alle Links dieser Nachricht scannen“ am `message_display_action`-Button, Eintrag am Link-Kontext (`contexts: ["link"]`) und der Hover-Hinweis im Nachrichtentext | P0-1 | A-11 | 0,25 | Ausgefülltes Protokoll | Jeder Eintrag löst nachweislich aus; nicht funktionierende Kontexte werden entfernt und aus Listing/Reviewer-Notes gestrichen | ⬜ |
| A-14 | Daten-Deklaration und Consent-Nachweis in Übereinstimmung bringen: Ergebnis aus A-04 umsetzen (`required`/`optional` in `manifest.json`, ggf. `permissions.request({ data_collection: [...] })` beim Aktivieren der externen Analyse), `privacy_policy.md`, `README*.md`, `store_listing.md` und `reviewer_notes.md` darauf ausrichten | P0-4 | A-04 | 0,5 | Geändertes `manifest.json` + konsistente Doku | Deklaration, Consent-UI und Beschreibungstexte widersprechen sich nachweislich nicht mehr; Pre-Submit-Checks bleiben grün | ⬜ |
| A-15 | Reviewer-Paket vollständig machen: Schritt-für-Schritt-Testanleitung mit Testdaten (A-02), definierter Test-API-Zugang bzw. dokumentierter Umgang damit, Liste „was ohne Schlüssel prüfbar ist“ | P0-3 | A-02, A-11 | 0,5 | Aktualisierte `docs/reviewer_notes.md` + `docs/testdata.md` | Ein Reviewer kann den Hauptflow ohne Rückfragen nachvollziehen; jeder Schritt nennt Erwartung und Gegenprobe | ⬜ |
| A-16 | Echte Screenshots erstellen (Optionsseite mit Consent, Opt-in-Banner, Warnbanner), als PNG ≥ 1200 px breit in `docs/screenshots/` ablegen, SVG-Platzhalter entfernen/archivieren und `docs/store_assets.md` aktualisieren | P0-2 | A-11 | 0,5 | 3 PNG-Dateien + aktualisierte Asset-Doku | Pre-Submit-Checks laufen ohne Screenshot-Warnung durch; keine Echtdaten auf den Bildern | ⬜ |
| A-17 | Fixes aus A-11–A-13 umsetzen **und** Fehler sichtbar machen: Injektions-/Permission-Fehler dem Nutzer als Zustand im Banner bzw. Popup anzeigen (statt nur `Logger.warn`), unerreichbaren Zweig `scripting.messageDisplay.executeScript` entfernen | P0-1, P1-11 | A-11–A-13 | 1,0 | Codefix + Unit-Test für den Fehlerpfad | Es gibt einen Test, der das sichtbare Fehlerfeedback prüft; `npm test` und Lint bleiben grün | ⬜ |
| A-18 | Neue Version vergeben (z. B. 1.6.1) falls A-14/A-17 Codeänderungen mitbringen: `manifest.json`, `package.json` und `CHANGELOG.md` synchron aktualisieren | P1-8 | A-14, A-17 | 0,25 | Konsistente Versionsangaben + Changelog-Eintrag | Pre-Submit-Check „package.json und manifest.json versions match“ bestätigt die Gleichheit | ⬜ |

---

## 4. Phase 2 – Review-Festigkeit und Release-Prozess (Ziel: 2 Tage)

| ID | Aufgabe | Prio | Abh. | Aufwand | Ergebnisartefakt | Abnahmekriterium | Status |
|---|---|---|---|---|---|---|---|
| A-19 | CI auf den vollen Umfang bringen: `.github/workflows/ci.yml` durch die Fassung aus `docs/ci/ci.yml` ersetzen (`npm test` statt nur `background.test.js`, Lint mit `scripts/filter-lint-warnings.js`, `web-ext build` + `scripts/verify-package.js`); `docs/ci/release.yml` nach `.github/workflows/` übernehmen; `docs/ci/README.md` entsprechend aktualisieren | P1-7 | – | 0,25 | Aktive Workflows im Repository | Ein Pull Request durchläuft alle Schritte; ein absichtlich eingebauter Fehler in `api.test.js` lässt die CI fehlschlagen (Gegenprobe) | ⬜ |
| A-20 | Release-Fähigkeit herstellen: Version taggen, Build erzeugen, Artefakt-Namen dokumentieren, Release im Repository anlegen (zunächst `unlisted`-Build als Selbstverteilungs-Artefakt für die GitHub-Pages-Links) | P1-8 | A-18 | 0,25 | Git-Tag + Release mit `.xpi`/`.zip` | Der Download-Link auf `docs/index_*.html` funktioniert nachweislich | ⬜ |
| A-21 | ATN-Validator-Lauf mit echtem Zugang: XPI hochladen und Validierungsbericht auswerten; alle Fehler beheben, alle Warnungen entweder beseitigen oder in `docs/reviewer_notes.md` begründen | Rest-Risiko (P1-10) | A-01, A-20 | 0,5 | Validierungsbericht + Behebungsnachweis | Bericht enthält 0 Fehler; jede Warnung hat eine dokumentierte Begründung | ⬜ |
| A-22 | Signier-/Release-Test mit **ATN**-Endpunkt: `npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed` (bzw. `WEB_EXT_AMO_BASE_URL`) im `release.yml` und in `docs/quickstart.md`/`docs/STATUS.md`/`docs/ci/README.md` korrigieren | P1-6 | A-01, A-19 | 0,25 | Korrigierter Workflow + funktionierende Signatur | Signatur wird von ATN ausgestellt; kein Aufruf ohne `--amo-base-url` bleibt im Repo | ⬜ |
| A-23 | Lokalisierung: entweder Optionsseite und Popup auf `browser.i18n`/`_locales` umstellen (EN/DE) **oder** die Sprachangabe im Listing und in den README-Dateien eindeutig als „UI: Deutsch“ kennzeichnen und die EN-Hauptbeschreibung um diesen Hinweis ergänzen | P1-9 | – | 1,0 | Lokalisierte UI **oder** konsistente Sprachdeklaration | Kein Dokument behauptet mehr eine Lokalisierung, die es nicht gibt; Strings liegen in `_locales` oder die Angabe ist eindeutig | ⬜ |
| A-24 | MV3-Cleanup: MV2-Fallbacks (`getDisplayedMessage`, `onMessageDisplayed` in `background.js`/`api.js`) entfernen, toten `scripting.messageDisplay.executeScript`-Zweig streichen, `scripts/filter-lint-warnings.js`-Begründung in `docs/reviewer_notes.md` verlinken; Lint-Warnungszahl dokumentieren | P1-10 | A-17 | 0,5 | Bereinigter Code + aktualisierte Doku | Lint bleibt bei 0 Fehlern; die verbleibenden Warnungen sind vollständig begründet | ⬜ |
| A-25 | Dokumentationsdrift beseitigen: Paketkennzahlen korrigieren (17 Dateien / 179.276 Bytes statt „15 Dateien/≈176 KB“), `docs/quickstart.md` auf die realen Testdateien korrigieren, `CONTRIBUTING.md` (`npm run lint` existiert), `docs/reviewer_notes.md` §2.2 an die tatsächlichen Manifest-Origins angleichen | P2-12, P2-13 | – | 0,5 | Korrigierte Dokumente | Stichprobenprüfung: jede Zahl/jeder Dateiname/Origin in den Dokumenten stimmt mit dem Repository überein | ⬜ |
| A-26 | Kleinhygiene: die beiden `fetch`-Direktaufrufe (`background.js:1447`, `api.js:530`) über `apiGateway.fetchWithTimeout` leiten; `.webextignore` entfernen oder in `web-ext-config.mjs` überführen und die Entscheidung dokumentieren | P2-16, P3-17 | – | 0,5 | Codeänderung + Konsolidierung der Ignore-Konfiguration | Upload-/Scanpfade nutzen überall denselben Timeout; es gibt genau eine Ignore-Quelle | ⬜ |

---

## 5. Phase 3 – Freigabe und Einreichung (Ziel: 1 Tag)

| ID | Aufgabe | Prio | Abh. | Aufwand | Ergebnisartefakt | Abnahmekriterium | Status |
|---|---|---|---|---|---|---|---|
| A-31 | Go/No-Go-Review: die sieben Kriterien aus §10 der Problemanalyse Punkt für Punkt abhaken, offene Punkte benennen, Entscheidung dokumentieren | P0-5 | A-11…A-26 | 0,25 | Ausgefüllte Go/No-Go-Checkliste | Alle sieben Kriterien sind erfüllt; kein Kriterium ist „voraussichtlich“ erfüllt | ⬜ |
| A-32 | Listing finalisieren und einreichen: Titel, Summary (EN), Beschreibung (EN), Kategorie, Keywords, Support-/Lizenz-/Privacy-Angaben, Kompatibilität „Thunderbird 140+“, Releasenotes der eingereichten Version, Screenshots hochladen, `listed`-Kanal signieren und Einreichung absenden | P0-5, P2-14, P2-15 | A-31 | 0,5 | Store-Einreichung + `docs/store_listing.md` ohne „open“-Einträge | Die Einreichung ist im Developer Hub sichtbar; `docs/store_listing.md` enthält den tatsächlichen Status und die Kompatibilitätsangabe | ⬜ |
| A-33 | Antwortkatalog für Review-Rückfragen vorbereiten: je erwarteter Frage (fehlende MV2-APIs, 26 Linter-Warnungen, `data_collection_permissions`, Host-Permission-Modell, API-Schlüssel-Ablage, `strict_min_version`) eine fertige, mit Codezeilen belegte Antwort | P1-10, P0-4 | A-21, A-24 | 0,25 | Abschnitt in `docs/reviewer_notes.md` | Zu jeder der genannten Fragen existiert eine Antwort mit Belegstelle | ⬜ |

---

## 6. Phase 4 – Nach der Einreichung (laufend)

| ID | Aufgabe | Prio | Abh. | Aufwand | Ergebnisartefakt | Abnahmekriterium | Status |
|---|---|---|---|---|---|---|---|
| A-41 | Review-Rückfragen innerhalb von 48 h beantworten; bei Ablehnung: Ursache in dieser Problemanalyse als neuen Befund ergänzen und in einer Nachbesserungsversion beheben | – | A-32 | laufend | Antworten + ggf. Patch-Release | Jede Rückfrage ist beantwortet; Ursachen sind dokumentiert (Lernschleife) | ⬜ |
| A-42 | Nach Veröffentlichung: Store-URL in `README.md`, `README.de.md`, `docs/STATUS.md`, `docs/index_*.html` und `docs/store_listing.md` eintragen; „not listed yet“-Hinweise entfernen | – | A-32 | 0,25 | Aktualisierte Dokumente | Kein Dokument behauptet mehr, es gebe keine Store-URL | ⬜ |
| A-43 | Betrieb etablieren: Bugfix-/Releasenotes-Prozess im Listing, Überwachung der Kompatibilität mit der nächsten Thunderbird-ESR, Pflege von `CHANGELOG.md` und `docs/STATUS.md` je Release | – | A-42 | laufend | Prozessbeschreibung in `CONTRIBUTING.md` | Der nächste Release durchläuft A-19/A-22 ohne neue Einmalarbeit | ⬜ |

---

## 7. Risiko-Register

| Risiko | Eintrittswahrscheinlichkeit | Auswirkung | Gegenmaßnahme |
|---|---|---|---|
| Banner-Injektion funktioniert in TB 140 ESR nicht (`executeScript` auf Nachrichtenansichts-Tab) | mittel | hoch – Kernfunktion im Review unbestätigt | A-11 früh durchführen; bei Fehlschlag auf `scripting.messageDisplay.registerScripts` mit Datei-basiertem Message-Display-Script umbauen (A-17); Feature bis dahin aus dem Listing streichen |
| `permissions.request()` schlägt im Banner-Pfad wegen fehlender User-Geste fehl | mittel | hoch – Opt-in-Flow unbenutzbar | A-12; Alternative: Freigabe ausschließlich aus der Optionsseite und Banner verweist dorthin |
| ATN-Review bewertet die Daten-Deklaration als unzureichend | mittel | hoch – Ablehnung | A-04 vorab klären, A-14 umsetzen, A-33 vorbereiten |
| Lokalisierungsentscheidung (A-23) zieht sich | mittel | mittel – Listing wirkt inkonsistent | Minimalvariante: Sprachangabe korrigieren (Aufwand 0,25 PT) |
| ATN-Validator meldet Fehler zu Thunderbird-Permissions/APIs | niedrig | mittel – Verzögerung | A-21 vor der Einreichung; Behebungsnachweis dokumentieren |
| Neue Befunde nach dem Live-Test erzwingen eine 1.6.1 | mittel | niedrig – nur eine zusätzliche Version | A-18 als eigene Aufgabe eingeplant |

---

## 8. Arbeitsweise und Definition of Done

- **Reihenfolge:** erst A-01/A-02/A-03 (Voraussetzungen), dann der kritische Pfad
  A-11 → A-12 → A-13 → A-17 → A-16 → A-15. Parallel möglich: A-19, A-25, A-26 (rein technisch/dokumentarisch).
- **DoD je Aufgabe:** Ergebnisartefakt existiert, Abnahmekriterium ist nachvollziehbar belegt (Kommandoausgabe,
  Protokollzeile oder Commit), und die Pre-Submit-Checks (`npm run pre-submit-checks`) sowie `npm test`
  laufen weiter fehlerfrei.
- **Statuspflege:** Status-Spalte in diesem Dokument ist die einzige Wahrheit für den Fortschritt;
  `docs/STATUS.md` fasst nach jeder Phase den Gesamtstand zusammen.
- **Nachweisführung:** Jede erledigte Aufgabe, die einen Befund schließt, ergänzt in
  `PROBLEMANALYSE_STORE_READINESS.md` eine Zeile „P0-x/P1-x – behoben in <Version> (<Commit>)“, damit
  Befund, Aufgabe und Nachweis dauerhaft verknüpft bleiben.
- **Nicht-Ziele:** keine neue Scan-Funktion, kein neuer Anbieter, kein UI-Redesign vor der ersten
  Listung – der Plan dient ausschließlich der Store-Readiness.

---

## 9. Zusammenfassung in einem Satz

**Zuerst den Funktionsnachweis in Thunderbird 140 ESR und das Review-Paket liefern (A-11…A-17),
parallel den falschen Signierweg und die zu schwache CI korrigieren (A-19, A-22) – danach ist die
Einreichung bei ATN realistisch in einem Zyklus durchführbar.**



