# Aufgabenplan (Iteration 2) – Weg zur Store-Einreichung ab 1.6.1

**Grundlage:** [PROBLEMANALYSE_STORE_READINESS_1.6.1.md](PROBLEMANALYSE_STORE_READINESS_1.6.1.md)
(Befunde N-01…N-09, nachgeprüfte Punkte aus Iteration 1). Dieser Plan ersetzt den
[Aufgabenplan der Iteration 1](AUFGABENPLAN_STORE_READINESS.md) **als Arbeitsliste**; jener bleibt als
Nachweis der abgeschlossenen Maßnahmen bestehen.

| Feld | Wert |
|---|---|
| Ziel | Einreichung von 1.6.1 im ATN als `listed`-Add-on, ohne Ablehnungsschleife |
| Ausgangslage | 3 externe Blocker (Thunderbird-Nachweis, Screenshots, ATN-Konto), 9 neue Nacharbeiten, 2 teilweise erledigte Punkte (CI-Aktivierung, Release-Artefakt) |
| Geschätzter Aufwand | ≈ 0,5 PT Nacharbeiten (sofort ausführbar) + ≈ 1 PT Nachweise/Assets + Review-Wartezeit |
| Fortschrittsmessung | `npm run gate` – Exit-Code 1, solange Einreichungsvoraussetzungen fehlen; `npm run check` für die PR-Qualität |

## Legende

| Kürzel | Bedeutung |
|---|---|
| **N-0x / P1-7 / …** | Befund aus der Analyse dieser Iteration bzw. aus Iteration 1 |
| **Aufwand** | Schätzung in Personentagen (PT), ohne Review-Wartezeit |
| **Status** | ⬜ offen · ⛔ durch fehlende externe Ressource blockiert · 🟨 teilweise · ✅ erledigt |

## 1. Traceability-Matrix (Befund → Aufgabe)

| Befund | Aufgabe(n) |
|---|---|
| N-01 Live-Policy zeigt 1.6 | R-14 |
| N-02 `store_assets.md` Version 1.6 | R-08 |
| N-03 irreführender Benachrichtigungstext | R-09 |
| N-04 Diagnose ohne Zeitstempel | R-10 |
| N-05 Plattform-Berechtigung nicht erzwungen | R-06, R-17 |
| N-06 schwacher Pre-Submit-Guard | R-11 |
| N-07 fester `/tmp`-Pfad | R-12 |
| N-08 fehlende Locale-`description` | R-13 |
| N-09 Dokumentengenerationen ohne Navigation | R-14 (in dieser Iteration erledigt) |
| P0-1 Kernfunktion unbelegt | R-03, R-04, R-06 |
| P0-2 keine Screenshots | R-05 |
| P0-5 keine Store-Präsenz | R-01, R-15, R-16 |
| P1-7 aktive CI zu schwach | R-02 |
| P1-8 kein Release-Artefakt | R-07 |

---

## 2. Phase A – Externe Voraussetzungen (blockiert ohne Ressourcen)

| ID | Aufgabe | Befund | Abh. | Aufwand | Ergebnis / Abnahmekriterium | Status |
|---|---|---|---|---|---|---|
| R-01 | ATN-Entwicklerkonto anlegen, Add-on-Eintrag im Developer Hub erstellen, API-Schlüsselpaar erzeugen und als Repository-Secrets `ATN_API_KEY`/`ATN_API_SECRET` hinterlegen | P0-5 | – | 0,5 | Signieren und Validieren sind möglich; Secrets sind nicht im Repo | ⛔ |
| R-02 | Token/App mit `workflows`-Berechtigung beschaffen, dann `cp docs/ci/ci.yml .github/workflows/ci.yml` und `cp docs/ci/release.yml .github/workflows/release.yml` committen | P1-7 | – | 0,25 | Der aktive Workflow ruft `npm run check` auf; ein absichtlich eingebauter Testfehler lässt die CI fehlschlagen (Gegenprobe) | ⛔ |
| R-03 | Thunderbird-140-ESR-Testumgebung an einem Arbeitsplatz mit Desktop bereitstellen: getrenntes Profil, Testkonto, Testnachrichten importieren (`node scripts/make-testdata.js`, `docs/testdata.md`); Start über `examples/run-in-thunderbird.sh` | P0-1 | – | 0,5 | Testprofil lädt das Add-on und zeigt die Testnachrichten | ⛔ |

---

## 3. Phase B – Nachweise und Assets

| ID | Aufgabe | Befund | Abh. | Aufwand | Ergebnis / Abnahmekriterium | Status |
|---|---|---|---|---|---|---|
| R-04 | Live-Test nach `docs/live_test_protocol.md` durchführen: Banner (Opt-in + Warnung), Consent-/Permission-Flow inkl. Popup-Freigabeweg, `message_display_action`-Kontextmenü, Time-of-Click, `contexts: ["link"]`; Umgebungsfelder und Checkliste vollständig ausfüllen; neue Beobachtungen als Befunde in die Analyse aufnehmen | P0-1 | R-03 | 1,0 | Protokoll vollständig ausgefüllt; `npm run gate` meldet den Protokoll-Blocker nicht mehr; bei Fehlschlägen greift der Alternativplan (`scripting.messageDisplay.registerScripts`) | ⬜ |
| R-05 | Drei echte Screenshots (PNG ≥ 1200 px) gemäß `docs/screenshot_capture.md` aufnehmen: Optionsseite mit Konsent, Opt-in-Banner, Warnbanner; SVG-Platzhalter danach aus `docs/screenshots/` entfernen | P0-2, N-08(cleanup) | R-04 | 0,5 | `npm run gate` meldet keine fehlenden Screenshots mehr; `docs/store_assets.md` beschreibt den echten Stand | ⬜ |
| R-06 | Reviewer-Paket abschließen: Testergebnis aus R-04 in `docs/reviewer_notes.md` verlinken und einen expliziten Prüfschritt für die Plattform-Datenberechtigung ergänzen (Schalter an → Dialog bestätigen/ablehnen → Zustand in *Add-ons verwalten → Berechtigungen und Daten*) | P0-1, N-05 | R-04 | 0,25 | Reviewer kann den Consent-Nachweis nachvollziehen, ohne zu raten | ⬜ |
| R-07 | Release-Artefakt erzeugen: Version taggen, `npm run package:verify`, Signatur über `--amo-base-url https://addons.thunderbird.net/api/v5/` (`listed`), Release mit Releasenotes anlegen | P1-8 | R-01 | 0,25 | Signiertes XPI vorhanden, Tag und Release veröffentlicht | ⬜ |

---

## 4. Phase C – Nacharbeiten aus Iteration 2 (sofort ausführbar, ohne externe Ressourcen)

Diese Aufgaben lassen sich heute umsetzen; sie schließen die neun neuen Befunde und halten den Nachweisstand
konsistent. Reihenfolge innerhalb der Phase ist beliebig.

| ID | Aufgabe | Befund | Abh. | Aufwand | Ergebnis / Abnahmekriterium | Status |
|---|---|---|---|---|---|---|
| R-08 | `docs/store_assets.md` auf Version 1.6.1 aktualisieren und den Status der Icon-Auflösungen mit dem tatsächlichen Skript-Stand abgleichen | N-02 | – | 0,1 | Kein Dokument nennt mehr eine veraltete Add-on-Version | ⬜ |
| R-09 | Benachrichtigungs- und Diagnosetexte präzisieren: nicht „Banner“, sondern der jeweilige Einfüge-Kontext (Banner bzw. Time-of-Click-Hinweis). Umsetzung: `reportMessageDisplayInjectionFailure(error, context)` mit einem Kontextparameter, neue Locale-Schlüssel, Test anpassen | N-03 | – | 0,25 | Meldung benennt den betroffenen UI-Teil; Tests bleiben grün | ⬜ |
| R-10 | Zeitstempel der Diagnose im Popup anzeigen (gespeichertes Feld `at` als lokales Datum/Uhrzeit neben der Fehlermeldung) | N-04 | – | 0,15 | Popup zeigt Fehlertext **und** Zeitpunkt; i18n-Schlüssel ergänzt | ⬜ |
| R-11 | Pre-Submit-Guard zur Daten-Deklaration härten: statt eines String-Vorkommens das Aufrufmuster prüfen (z. B. `permissionsApi.request({ data_collection:` in `options.js`) oder den Guard entfernen und auf `test/store_readiness.test.js` verweisen | N-06 | – | 0,15 | Der Check lässt sich nicht mehr durch einen Kommentar erfüllen; Test deckt beide Fälle ab | ⬜ |
| R-12 | `npm run lint:filtered` plattformneutral machen: Ausgabe in eine Datei im Repo-Temp-Verzeichnis (z. B. `./build/lint.json`, über `node -e` oder ein kleines Skript statt Shell-Redirect) | N-07 | – | 0,15 | Der Befehl läuft unter Windows und bei parallelen Läufen; CI-Verhalten unverändert | ⬜ |
| R-13 | Für die 24 älteren Locale-Schlüssel `description`-Felder ergänzen | N-08 | – | 0,25 | Alle 153 Einträge haben eine Beschreibung; `test/i18n.test.js` könnte das künftig erzwingen | ⬜ |
| R-14 | Dokumentengenerationen verknüpfen (Navigationshinweis + Verweise in `docs/index.md`, `docs/STATUS.md`, README) und unmittelbar vor der Einreichung die veröffentlichte Live-Policy gegen `docs/privacy_policy.md` prüfen | N-09, N-01 | – | 0,15 (Doku-Teilschritt erledigt) | Von jeder Analyse aus ist die aktuelle Fassung auffindbar; Live-Policy und Repo nennen dieselbe Version | 🟨 |

---

## 5. Phase D – Einreichung und Betrieb

| ID | Aufgabe | Befund | Abh. | Aufwand | Ergebnis / Abnahmekriterium | Status |
|---|---|---|---|---|---|---|
| R-15 | ATN-Validator-Lauf mit echtem Zugang: XPI hochladen, Bericht auswerten, Fehler beheben, Warnungen begründen | Restrisiko | R-01, R-07 | 0,5 | Bericht ohne Fehler; jede Warnung dokumentiert | ⬜ |
| R-16 | Listing finalisieren und einreichen: Titel, Summary, Beschreibung (EN), Kategorie, Keywords, Support-/Lizenz-/Privacy-URL, „Thunderbird 140+“, Releasenotes, Screenshots; `listed` signieren und absenden | P0-5 | R-04, R-05, R-07, R-15 | 0,5 | Einreichung im Developer Hub sichtbar; `docs/store_listing.md` ohne offene Punkte | ⬜ |
| R-17 | Reviewer-Rückfragen beantworten; den Antwortkatalog um die Frage „Warum erzwingt der Code die Plattform-Berechtigung nicht?“ erweitern (Antwort: eigener Schalter ist die durchsetzende Instanz, Plattform hat keinen automatischen Prompt, Nachweis über `docs/data_collection_decision.md`) | N-05 | R-16 | 0,25 | Jede Rückfrage mit Beleg beantwortet | ⬜ |
| R-18 | Nach der Listung: Store-URL in README/STATUS/Listing eintragen, Releasenotes pflegen, nächsten ESR-Zyklus einplanen | – | R-16 | 0,25 + laufend | Kein Dokument behauptet mehr, es gebe keine Store-URL | ⬜ |

---

## 6. Kritischer Pfad und Reihenfolge

```
R-01 ATN-Konto ─┐
R-02 CI-Rechte  │   (parallel, unabhängig)
R-03 TB-Desktop ┴─► R-04 Live-Test ─► R-05 Screenshots ─┐
                       │                                ├─► R-16 Einreichung ─► R-17/R-18
                       └─► R-06 Reviewer-Paket ─────────┘
R-01 ─► R-07 Release/Artefakt ─► R-15 Validator-Lauf ───┘

Phase C (R-08…R-14): jederzeit parallel möglich, ohne externe Ressourcen
```

**Empfehlung:** Phase C zuerst abschließen (sie kostet zusammen < 1 PT und entfernt alle Selbstwidersprüche),
dann die drei externen Voraussetzungen beschaffen und in der Reihenfolge
R-04 → R-05/R-06 → R-07 → R-15 → R-16 durchlaufen. Nach jedem Schritt:

```bash
npm run gate    # zeigt sofort, welche Einreichungsvoraussetzung noch fehlt
```

## 7. Risiko-Register

| Risiko | Wahrsch. | Auswirkung | Gegenmaßnahme |
|---|---|---|---|
| Banner-Injektion funktioniert in Thunderbird 140 ESR nicht | mittel | hoch (Kernfunktion) | R-04 früh; Alternativplan `scripting.messageDisplay.registerScripts` (in der Analyse §6 dokumentiert); betroffene Features bis dahin nicht als „funktioniert“ bewerben |
| `permissions.request()` aus dem Banner scheitert an der Nutzer-Geste | niedrig (Mitigation gebaut) | mittel | Popup-Freigabeweg existiert; in R-04 ausdrücklich mitprüfen |
| ATN-Review beanstandet die Daten-Deklaration oder den Consent-Ort | mittel | hoch (Ablehnung) | R-06, R-17; Rückfrage-Entwurf liegt in `docs/data_collection_decision.md` §5 |
| Veröffentlichte Live-Policy weicht weiterhin ab | mittel | mittel | R-14 unmittelbar vor der Einreichung; Gate prüft nur das Repository, nicht die Live-Seite |
| Nacharbeiten (Phase C) werden übersprungen | mittel | niedrig–mittel | Sie sind als nummerierte Aufgaben mit Abnahmekriterien erfasst; N-03/N-04 betreffen die Diagnose, die der Reviewer als Teil von P1-11 prüft |
| CI bleibt mangels `workflows`-Berechtigung inaktiv | hoch (blockiert) | mittel | R-02; bis dahin ist `npm run check` der verbindliche lokale Gate-Befehl (in CONTRIBUTING verankert) |

## 8. Arbeitsweise, Definition of Done und Grenzen

- **DoD je Aufgabe:** Ergebnisartefakt existiert, Abnahmekriterium ist belegt (Kommandoausgabe, Protokollzeile,
  Commit), und `npm run check` bleibt grün.
- **Nachweisführung:** Jede erledigte Aufgabe ergänzt in der Analyse eine Zeile
  „N-0x / P1-x – behoben in <Version> (<Commit>)“. Damit bleiben Befund, Aufgabe und Nachweis verknüpft.
- **Automatische Kontrolle:** `npm run gate` prüft die Einreichungskriterien; `npm run check` das PR-Gate. Beide
  sind die einzige verbindliche Quelle für „fertig“ bzw. „einreichbar“.
- **Nicht-Ziele dieser Iteration:** neue Scan-Funktionen, zusätzliche Anbieter, UI-Umbau. Der Plan dient
  ausschließlich der Store-Einreichung.
- **Grenze dieser Analyse:** Alle Aussagen zur Thunderbird-Laufzeit stammen aus Dokumentation und Unit-Tests mit
  gemockten APIs. Was nur eine echte Installation zeigen kann, steht in §6 der Analyse und wird durch R-04
  geschlossen.

## 9. Zusammenfassung in drei Sätzen

Die Erweiterung ist inhaltlich einreichungsreif; es fehlen der Nachweis in einer echten Thunderbird-Installation,
drei Screenshots und das ATN-Konto. Zusätzlich sind neun kleine Nacharbeiten aus dem neuen Code offen
(Phase C, zusammen unter einem Personentag, jederzeit ausführbar). Ob diese Lücken geschlossen sind, sagt
`npm run gate` – heute mit drei Blockern und Exit-Code 1.



