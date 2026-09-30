# Live-Test-Protokoll (Thunderbird 140 ESR)

**Bezug:** Store-Readiness P0-1 / Aufgaben A-03 und A-11 bis A-13
**Ziel:** Nachweis, dass die Kernfunktionen in einer echten Thunderbird-Installation wie beschrieben
arbeiten – der einzige Nachweis, den Unit-Tests mit gemockten APIs **nicht** liefern können.

## 0. Umgebung (vor dem Test ausfüllen)

| Feld | Wert |
|---|---|
| Datum | |
| Thunderbird-Version (Hilfe → Über Thunderbird) | |
| Betriebssystem / Build | |
| Add-on-Version (`manifest.json`) | |
| Commit-Hash | |
| Profil (Test-/Alltagsprofil) | |
| Verwendete API-Schlüssel (Anbieter) | |
| Getestet von | |

## 1. Vorbereitung

- [ ] Testprofil und Testkonto eingerichtet, Fixtures importiert → [testdata.md](testdata.md)
- [ ] Add-on temporär geladen (`about:debugging`) bzw. via `web-ext run`
- [ ] „Externe Analyse erlauben“ ist **aus**, Datenschutz-Stufe ist `strict`
- [ ] Thunderbird-Entwicklerwerkzeuge → Konsole und Netzwerk geöffnet

## 2. A-11 – Banner-Injektion in der Nachrichtenansicht

| # | Schritt | Erwartet | Beobachtet | ✓/✗ | Beleg |
|---|---|---|---|---|---|
| 1 | `01-harmless-attachment.eml` öffnen | Opt-in-Banner über der Nachricht mit **zwei** Schaltflächen („Nur diese Nachricht scannen“, „Absender dauerhaft scannen“) | | | Screenshot |
| 2 | Im Banner Text prüfen | Hinweis, dass ohne Zustimmung nichts übertragen wird | | | |
| 3 | `03-risky-urgency-link.eml` öffnen | Warnbanner mit Score und Begründungsliste | | | Screenshot |
| 4 | Konsole beobachten | **keine** Meldung „Injecting into the message display failed“ | | | Konsolenauszug |
| 5 | Nachricht mit **ohne** Zustimmung erneut öffnen | Banner erscheint weiterhin, System-Benachrichtigung **nicht** | | | |

**Zu prüfende technische Fragen (Befund P0-1):**
1. Wirkt `browser.scripting.executeScript({ target: { tabId }, func, args })` auf dem Tab der
   Nachrichtenansicht **ohne** Host-Berechtigung für Nachrichteninhalte? (Wenn nein: Umbau auf
   `scripting.messageDisplay.registerScripts` mit dateibasiertem Message-Display-Script – Alternativplan
   im Aufgabenplan, A-17.)
2. Erscheint das Banner früh genug (Injektionszeitpunkt `document_idle`), um sichtbar zu sein?
3. Wird `browser.i18n.getMessage()` im injizierten Kontext aufgelöst (Sprache des Banners = UI-Sprache)?
4. Erscheint bei einem Fehlschlag genau **eine** Benachrichtigung („Banner konnte nicht … eingefügt werden“)
   und liegen die Diagnosedaten unter `messageDisplayInjectionFailed` im Speicher des Add-ons?

## 3. A-12 – Consent- und Permission-Flow

| # | Schritt | Erwartet | Beobachtet | ✓/✗ | Beleg |
|---|---|---|---|---|---|
| 1 | Zustimmung **aus**, Nachricht mit Anhang öffnen (Netzwerk-Panel) | **keine** Anfrage an Anbieter-Domains | | | Netzwerkmitschrift |
| 2 | Einstellungen öffnen, API-Schlüssel eintragen, „Externe Analyse erlauben“ **an**, Speichern | Thunderbird fragt die Host-Berechtigung an; zusätzlich erscheint die Abfrage der **optionalen Datenberechtigung** (`personalCommunications`) | | | Screenshot |
| 3 | Beide Abfragen **bestätigen** | Einstellungen gespeichert, Statusmeldung sichtbar | | | |
| 4 | Zustimmung wieder **aus**, Speichern | Datenberechtigung wird zurückgegeben (Eintrag verschwindet in *Add-ons verwalten → Berechtigungen und Daten*) | | | |
| 5 | Wieder **an**, Speichern, Banner-Button „Nur diese Nachricht scannen“ klicken | Scan startet (bei fehlender Host-Berechtigung erscheint der Hinweis „… darf den Analysedienst noch nicht kontaktieren“ **plus** Schaltfläche „Open options“) | | | |
| 6 | Negativtest: Zustimmung aus, Banner-Button klicken | Meldung „Externe Analyse ist in den Einstellungen deaktiviert – es wurde nichts übertragen.“ | | | |

**Zusätzlicher Pfad (Mitigation):** Ist die Host-Berechtigung nicht erteilt, zeigt das Popup einen Hinweis mit
der Schaltfläche „Zugriff erteilen“; dieser Klick ist garantiert eine Nutzer-Geste und muss die Berechtigung
erteilen (danach lädt das Popup neu). Bitte mitprüfen, wenn die Banner-Anfrage in Schritt 5 fehlschlägt.

**Kritische Frage (Befund P0-1/P1-11):** Bleibt die Nutzer-Geste erhalten, wenn der Banner-Button über
`runtime.sendMessage` im Hintergrundskript `browser.permissions.request()` auslöst? Wenn **nein**, ist die
Alternative „Freigabe ausschließlich aus der Optionsseite, Banner verweist dorthin“ umzusetzen
(Risiko-Register im Aufgabenplan).

## 4. A-13 – Kontextmenü und Time-of-Click

| # | Schritt | Erwartet | Beobachtet | ✓/✗ | Beleg |
|---|---|---|---|---|---|
| 1 | Rechtsklick auf den `message_display_action`-Button | Eintrag „Alle Links dieser Nachricht scannen“ | | | Screenshot |
| 2 | Eintrag ausführen (Zustimmung an) | Links werden geprüft; Benachrichtigung erscheint | | | |
| 3 | Rechtsklick auf einen Link im Nachrichtentext | Eintrag „Scan link with Thundy AV“ **oder** dokumentierte Abweichung | | | Screenshot |
| 4 | `03-risky-urgency-link.eml` mit aktivierter Time-of-Click-Protection öffnen, Link überfahren | Hinweis wird angezeigt | | | Screenshot |

> `contexts: ["link"]` ist in der Thunderbird-`menus`-API dokumentiert, aber nicht ausdrücklich für den
> Nachrichtentext. Falls der Eintrag nicht auslöst, ist er zu entfernen und aus Listing/Reviewer-Notes zu
> streichen (Aufgabenplan A-13/A-17).

## 5. Ergebnis und Nachbereitung

- [ ] Alle Tabellen vollständig ausgefüllt, Abweichungen mit Screenshot/Konsolenauszug belegt
- [ ] Fehlschläge als neue Befunde in `PROBLEMANALYSE_STORE_READINESS.md` ergänzt
- [ ] Fixes umgesetzt (A-17) und `npm test`, `npm run pre-submit-checks`, `npm run lint` erneut grün
- [ ] Bei Codeänderungen: Version/Changelog erhöht (A-18) und Artefakt neu gebaut (A-20)
- [ ] Protokoll im Release/PR verlinken (Nachweis für Tor T1 des Go/No-Go-Kriteriums)

## 6. Falls keine Desktop-Umgebung verfügbar ist

In der Sandbox dieser Arbeitsumgebung ist der Live-Test **nicht** ausführbar: es gibt kein
GTK/Display-Paket, keine Xvfb-Installation und keinen Root-Zugang zum Nachinstallieren
(`ls /usr/lib/x86_64-linux-gnu | grep libgtk-3` → 0 Treffer; `sudo`/`Xvfb` nicht vorhanden).
Der Test ist daher auf einem Arbeitsplatz mit Desktop und Thunderbird 140 ESR nachzuholen; dieses
Protokoll ist dafür fertig vorbereitet. Bis dahin bleiben P0-1, P0-2 und P0-3 offen.
