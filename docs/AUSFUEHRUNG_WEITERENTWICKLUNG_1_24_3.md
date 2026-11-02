# Ausführung des nächsten Aufgabenplans — Thundy AV 1.24.3

Grundlage: [Aufgabenplan](AUFGABENPLAN_WEITERENTWICKLUNG_1_24_3.md), analysierter Ausgangscommit `3024636`. Der aktuelle Auftrag umfasst die Umsetzung. Veröffentlicht bleibt 1.24.2; diese Änderungen bereiten neue Kandidatenbytes für 1.24.3 vor. Eine vorhandene Freigabe früherer Paketbytes gilt dafür nicht.

## Aufgabenstatus

| Aufgabe | Ergebnis / Beleg | Abnahmegrenze |
| --- | --- | --- |
| TAV-019 | Strukturierter Parser `risk.js::parseAuthenticationResults`; exakte Tokens, verschachtelte/escapte Kommentare, quoted strings, Faltung, konservative Konflikte; Negativkorpus in `test/follow-up.test.js` | echte MIME-Probe mit vertrautem Authserver, `passage` bleibt neutral; keine kryptografische SPF/DKIM-Prüfung |
| TAV-020 | Writer-/Lesermatrix und Ergebnisvertrag in [Verträge](WEITERENTWICKLUNG_VERTRAEGE.md); `checkHybridAnalysisResult`, Dialog und Audit trennen Herkunft, Versuch, Fehler und Beobachtung | Providerfehler/Rechte/Consent mit Testdoubles; echte Anbieterabnahme bleibt TAV-006.03 |
| TAV-021 | Optionale unveränderliche Begründungssnapshots bei Entscheidung, getrennte Auditdarstellung und additive JSON-/CSV-Felder; alte Originaldaten bleiben erhalten | Node-Rennen-/Legacy-/Exportfälle und echter Upgrade-/Neustart-/Prozessverlustlauf |
| TAV-022 | Lokale Mengen-/Fehler-/Auslassungszähler für Anhänge, Domainprüfung und Kontextmenüstapel; Popup/Benachrichtigung erklärt Grenzen; Limits unverändert | 101 Anhänge/101 Domains/21 Links synthetisch; echter 101-Anhänge-MIME-Fall in Thunderbird |
| TAV-023 | `validateReports` prüft echte Zeilen, Summen, erwartete Fall-IDs/Dimensionen, Sprachen, Recovery-/PENDING-Daten und Paketbindung | manipulierte/fehlende/übersprungene/widersprüchliche Fixtures werden verworfen; echte alte konsistente Reports bleiben semantisch gültig |
| TAV-024 | Gemessen und optimiert: serialisierte Audit-Lesezugriffe schreiben nur bei tatsächlicher Bereinigung oder fehlender Profil-ID | [synthetische API-Messung](audits/audit-io-weiterentwicklung.json); echte Client-Latenzen in den neuen Liveberichten; keine physische Datenträgergarantie |
| TAV-025 | [CI-Triggeranalyse](CI_WEITERENTWICKLUNG.md), `route` mit Fehlerfallback auf vollständige Prüfungen, PR-/Push-Concurrency; kein Import ungeprüfter Testergebnisse | Remote-Abnahme über den [aktuellen PR-Prüfstatus](https://github.com/VaZuLeS/Thunderbird-Antivirus/pull/719/checks); frühere grüne Läufe gelten nicht als Nachweis der Änderung; zweiter Node-Gatelauf bleibt zur Absicherung erhalten |
| TAV-026 | Einstellungen: abwählbare grobe Konfiguration, Vorschau, ausdrücklich lokaler Supportdownload. Strikte Feldprojektion; keine Roh-URLs, Keys, Senderlisten, Profilpfade oder Fehlerfreitexte | Canary-/Schema-/Browserprüfungen, echte Thunderbird-Vorschau und nativer Dateiauswahldialog; kein Versand/keine Telemetrie |
| TAV-027 | Konzeptphase abgeschlossen: [Schemaentwurf](schemas/local-settings-profile-v1.proposal.json), Import-/Consent-/Datenschutzgrenzen dokumentiert | kein Runtimeimport implementiert; mangels bestätigter übertragbarer Schutzentscheidungen bleibt die Erweiterung entsprechend dem bedingten Plan zurückgestellt |
| TAV-028 | Runtimes/Abhängigkeiten und optionale Legacyfelder dokumentiert; reiner Parser und strukturierter Resultatvertrag, gemeinsame Validierung der Linknachrichten | negative Payloadtests; keine neue Berechtigung und kein Framework-/Bundlerwechsel |
| TAV-018.03, fortgeführt | web-ext 10.8.0 explizit gepinnt, Lint kompatibel; erneutes Audit 9 mittel / 1 niedrig, keine hohe/kritische Meldung | keine unterstützte gepatchte Gesamtkette verfügbar; inkompatibler Downgrade/ungeprüfter Override nicht durchgeführt; bleibt offen |

## Validierung

Die vollständigen Läufe unter Node **22.23.4** und **24.19.0** bestehen jeweils mit **985 Tests**, ohne Fehler/übersprungene Fälle. Die Tests prüfen Verhalten und Fehlergrenzen; die Anzahl ist kein eigenständiges Ziel. Die aktuellen paketgebundenen Abnahmen bestehen mit **600 Browserfällen und 36 CSS-Zoomfällen**, echten Upgrades in sechs Sprachen und je zwei erzwungenen Wiederanläufen. EN wurde zusätzlich mit sauberem Profilrestore (daher drei statt zwei sauberen Neustarts) geprüft. Native Parser-/101-Anhänge-/Supportdownloadfälle bestehen in EN unter 140 ESR und DE/FR/ES/IT/PL unter 153 ESR; zusätzliche EN-Erstinstallation unter 153 ESR. Die systemeigene Dateiauswahl wurde auch mit Großbuchstaben/Unterstrichen wie in GitHub-Runnerpfaden geprüft. Der Browserrunner prüft zusätzlich Vorschau, Abwahl, Downloadinhalt sowie gespeichertes CLEAN bei fehlgeschlagenem Abruf in sechs Sprachen. API-Testdoubles sind ausdrücklich keine echten Provider-/Screenreader-/OS-Nachweise.

Native Prüfungen laufen mit echten Thunderbird-APIs und importierten synthetischen MIME-Nachrichten offline, ohne Provider-API-Mocks. Der Supportdownload verwendet `browser.downloads.download`, den echten GTK-Dateidialog und XTest-Tastatureingaben; der abgeschlossene Dateiinhalt wird gegen die Vorschau verglichen. Temporäre Datei-/Navigationszustände werden lesend abgewartet, nicht als Erfolg ausgegeben.

## Ressourcenabhängig offen

Keine zusätzlichen Ressourcen wurden zugesagt. Weiterhin getrennt offen: öffentlicher Pages-Nachweis (TAV-005.03), reale Providerverträge/Testkonten (006.03), Windows/macOS-Standardbrowser (009.03), NVDA/VoiceOver (010.03), native DPI/High Contrast (012.03), automatische Updateverteilung mit zwei geeigneten Versionen (013.03), tatsächliche ATN-Zugänge/Signierung/Review (014.02/.03) und ein real freigegebener Unternehmenspilot (017.03). Keine dieser Abnahmen wird durch lokale Simulation ersetzt. Die verbleibenden Werkzeugmeldungen unter 018.03 bleiben transparent offen.

Die bestehenden IDs und Prüfanweisungen gelten weiter. Es wurden keine Produktivintegrationen aktiviert, keine externen Analysen eingeschaltet und keine veröffentlichten Releases ersetzt. OPENED und PENDING behalten ihren bestehenden Vertrag.

## Exakte lokale Kandidatenidentität

XPI/ZIP-SHA-256: `a150e885188d72703cecc7cf8812b396902e5fa04c0565032b5848b3ed7a2627`. Quellfingerprint: `35a5174d43da3592df604e322becd5a5b345580f28ecd1f3dc647a4c982b8f77`. [Maschinenlesbarer Nachweis](audits/candidate-1_24_3.json), [native Vorschau](screenshots/1.24.3/weiterentwicklung/upgrade-en-support-preview.png), [nativer Prüfumfang](screenshots/1.24.3/weiterentwicklung/upgrade-en-coverage-popup.png). Nur abgeschlossene passende Läufe werden in diesen Nachweis übernommen; fehlgeschlagene Automatisierungsversuche bleiben außerhalb des Freigabepakets in den lokalen Arbeitsprotokollen.

Die Untersuchung deckte außerdem Wartezustände im Liveprüfer auf: Eine angelegte Datei ist noch kein abgeschlossener JSON-Schreibvorgang; der Runner wartet nun lesend auf den vollständigen Inhalt. Native Tastatureingaben berücksichtigen Großbuchstaben/Unterstriche. Diese Korrekturen ersetzen keine Produktprüfung durch Testdoubles. Der Snapshot-/Hashprüfer authentifiziert keine unabhängige Geräte- oder Herausgeberquelle.
