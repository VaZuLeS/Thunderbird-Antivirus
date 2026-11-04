# Entwicklungsprüfung 1.24.4 — Analysequellen

Aktueller Folgeumfang: [Ausführung des Informationsdarstellungsplans](UMSETZUNG_INFORMATIONSDARSTELLUNG_ANALYSEQUELLEN.md), mit eigenen neuen Nachweisen. Die folgenden Zahlen und Paketbytes bleiben als frühere Abnahme erhalten.

Dieser Abschnitt dokumentiert eine historische Entwicklungsabnahme. Der [Freigabeabschluss 1.24.4](VEROEFFENTLICHUNG_1_24_4.md) beschreibt den finalen Umfang; tatsächliche Veröffentlichung und Paketbytes sind am [GitHub-Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.4) zu prüfen. Keine ATN-Freigabe. [Umsetzung](ANALYSEQUELLEN_1_24_4.md), [Entwicklungsnotizen](releases/1.24.4.md).

Die folgenden Fälle betreffen isolierte lokale Linux-Profile und synthetische Nachrichten. Externe Antworten sind Testdaten, keine produktiven Providerabnahmen. Browserprüfungen simulieren Thunderbird-APIs; native Läufe verwenden echtes Thunderbird und dessen APIs. Die sechs Sprachfassungen werden im Browser geprüft; die hier zusätzlich ausgeführten nativen Läufe sind Englisch. CI führt gesondert sechs Sprach-/Upgrade-/Crashläufe aus und erzeugt dafür ihre eigene Paketbindung.

| Prüffall | Umgebung | Ergebnis |
| --- | --- | --- |
| Erfolgreiche Prüfungen aller fünf Dienste einschließlich Ergebnissen ohne Erkennung | simulierte Providerantworten, echte Adapter | OK |
| Upload/Scanauftrag bleibt von fertiger Analyse getrennt | simulierte Antworten für HA und urlscan | OK |
| Ursprüngliches Alter bei Cache und fehlgeschlagener Aktualisierung erhalten | deterministische Modell-/Adapterprüfungen | OK |
| Stärkere Warnung bei gemischten Ergebnissen erhalten | Modell-/Darstellungsprüfungen | OK |
| Prozessverlust: laufend wird unvollständig | persistierte Modell-Testdaten | OK |
| Keine zusätzlichen Übermittlungen durch Quellenansicht | Adapter-/Hintergrundprüfungen mit gezähltem Netzwerk | OK |
| Nachrichtenzuordnung, Parallelität, gleiche Header-ID, verspätete Antworten | Hintergrundprüfungen mit simulierten APIs | OK |
| Popup-Ereignisschnittstelle prüft Herkunft und Ereignistyp | Hintergrundprüfungen | OK |
| Cache-Löschung verwirft Quellenbeobachter | Hintergrundprüfung einschließlich verspäteter Antwort | OK |
| Historische Schlüssel/Hashes erzeugen keinen erfundenen Prüfnachweis | Legacy-/Persistenzprüfungen | OK |
| Sechs Sprachkataloge und gemeinsamer Renderer | DOM-/Browserprüfungen | OK |

**Summe:** 11 OK / 0 FAIL / 0 N/A / 0 OFFEN

Diese Summe zählt die genannten Verhaltensfälle. Browsermatrix und native Ergebnisse werden zusätzlich im [Ausführungsnachweis](audits/analysis-sources-1_24_4.json) mit Paket- und Quellkennung geführt. Sie ersetzen keine allgemeine Freigabe. Frühere fehlgeschlagene Prüfversuche in der Arbeitsumgebung wurden behoben und gehören nicht zum Nachweis des finalen Pakets.

Zusätzlich erfolgreich: **999 automatisierte Tests**, 77 anschließende Katalog-/Modell-/Manifestprüfungen, 12 Themeprüfungen, **48 Popup- und 24 Nachrichtenfälle** in sechs Sprachen sowie vier Popupfälle bei 200 % CSS-Zoom. Der Browserquellstand wurde vor der abschließenden rein sprachlichen Korrektur „derzeit nicht eingerichtet“ erfasst; die Katalogprüfungen und nativen Läufe prüfen diese Korrektur separat.

Das finale Paket wurde in **Thunderbird 140.12.0 und 153.6.0**, jeweils Linux/Englisch, tatsächlich installiert und bedient. Beide Läufe bestätigen lokale Anzeige, nachträgliche Aktualisierung des bereits geöffneten Popups, gespeicherte externe Beobachtung im Nachrichtenfenster und weiterhin korrekt dimensioniertes natives Popup. Die externe Antwort ist ausdrücklich synthetisch; der Renderer und die Thunderbird-APIs sind echt.

Paket-SHA-256: `99406f4b79c3e4300f9640758a92c966cfcaa5fa3808c23bed430a901112dfa3`. Quellfingerprint: `e2665bc9659115ae1f69d1a4151416ea5636ff80e31081326b2d922daff05e50`. Keine Übertragung dieser Bindung auf später erzeugte ZIP-Bytes.

[Nachrichtenansicht, native Linux-Testdaten](screenshots/1.24.4/analysis-sources-message-linux-en.png) · [Toolbar-Popup, native Linux-Testdaten](screenshots/1.24.4/analysis-sources-popup-linux-en.png).

Weiterhin fehlen Windows/macOS, NVDA/VoiceOver, native OS-DPI-/High-Contrast-Abnahme und produktive Providerkonten. Automatische Updateverteilung, ATN-Signierung und Rollback über einen echten Distributionskanal sind durch diese Anzeigeänderung nicht geprüft. Die frühere Abnahme von 1.24.3 wird nicht als Nachweis für 1.24.4 übernommen. Die verbindliche Kandidatenprüfung verlangt weiterhin eigene vollständige Upgrade-/Crash- und Browserberichte; lokale Teilabnahmen umgehen dieses Gate nicht.
