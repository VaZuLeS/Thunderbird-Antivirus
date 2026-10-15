# Einheitliches Designsystem für Thundy AV

Stand: 15. Oktober 2026. Ziel ist eine durchgängige Produktsprache für die Add-on-Oberfläche und die Admin-Werkzeuge. Die [bedienbare Designreferenz](UI_DESIGNSYSTEM.html) zeigt den Vorschlag mit ausschließlich synthetischen Beispieldaten. Ihre Theme-Auswahl verändert keine Add-on-Einstellungen. Die Referenz stellt keine aktive Unternehmenskonsole oder Rechteprüfung bereit.

## Leitentscheidung

Ein gemeinsames Designsystem, zwei aufgabengerechte Arbeitsbereiche:

| Anwender | Unternehmens-Admin |
| --- | --- |
| Was wurde geprüft? Wie sicher ist die Aussage? Was kann ich jetzt tun? | Was ist passiert? Welche Evidenz liegt vor? Welcher Schritt ist erforderlich? |
| Ruhige Übersicht, verständliche Ergebnisse, wenige vorrangige Aktionen | Übersicht, Filter, vergleichbare Tabellen, Details, Änderungsverlauf |
| Nachricht, Linkziel, lokaler Score, Ergebnis und Grenzen der Prüfung | Organisation/Quelle, Ereignis, Entscheidung, Score zum Entscheidungszeitpunkt, Prüfstand und Nachweise |
| Einstellungen für Darstellung, Datenschutz, Schutz und optionale Dienste | Konfiguration für Richtlinien, Integrationen, Rollen und Aufbewahrung; Freigabe und Aktivierung explizit |

Beide Bereiche verwenden dieselben Tokens und Komponenten. Der Admin-Bereich erhält eine höhere Informationsdichte, ohne Schriftgrößen, Statusfarben und Bedienprinzipien auszutauschen. Ein Navigationspunkt „Admin“ ist keine Zugriffskontrolle. Die bestehende lokale Protokollansicht hat kein Unternehmens-SSO/RBAC; diese Grenze muss sichtbar bleiben.

## 1. Gemeinsame Gestaltungsgrundlage

Die neue Add-on-Darstellung bildet die Grundlage: kühle neutrale Flächen, dunkle gut lesbare Texte, ein zurückhaltender Akzent, klare Umrisse und sparsame Schatten.

| Element | Vorgabe |
| --- | --- |
| Erscheinungsbild | Thunderbird folgen, hell, dunkel; geeignete native Farben vor System-Fallback |
| Akzente | Ozean als Standard; Violett, Wald, Bernstein als Auswahl |
| Statusfarben | Erfolg, Hinweis, Warnung, Fehler getrennt vom wählbaren Akzent |
| Typografie | Systemschrift; 16 px Fließtext, 14 px dichte Tabellen, 12 px ergänzende Metadaten, 20–24 px Bereichstitel, 32–40 px Seitentitel |
| Abstände | Gemeinsame Skala 4 / 8 / 12 / 16 / 24 / 32 / 48 px |
| Radien | 8–10 px Eingaben und Buttons, 16–18 px Flächen; keine neue Radiusfamilie je Seite |
| Linien und Schatten | 1 px Flächengrenzen; Schatten nur für Hierarchie und schwebende Elemente |
| Breite | Inhaltsbereiche typischerweise 1.120–1.280 px; breite Admin-Datentabellen bei Bedarf größer |
| Bewegung | Kurz und funktional; reduzierte Bewegung respektieren |

Als einzige Farbdefinition für die kommende Konsolidierung dienen die geprüften Theme-Tokens. Die Designreferenz wird aus dem aktuellen Theme und den vorhandenen Styles generiert. Die sieben bestehenden Offline-Renderer betten denselben Kern ein, damit exportierte HTML-Dateien weiterhin vollständig offline funktionieren. Eine HTML-Datei darf keine externe Schrift, Icon-Bibliothek oder CSS-CDN benötigen.

## 2. Einheitlicher Seitenaufbau

Jede Hauptansicht besitzt dieselbe Reihenfolge:

1. **Kontext:** Produkt, Arbeitsbereich und tatsächliche Quelle. Organisations- und Umgebungsangaben nur anzeigen, wenn sie aus einem authentifizierten Kontext stammen.
2. **Seitentitel:** kurze Beschreibung der Aufgabe; höchstens eine dominante Hauptaktion.
3. **Prüfstand:** Quelle, Aufnahmezeit und gegebenenfalls Hinweis auf veraltete/unvollständige Daten. Eine Offline-Aufnahme erhält keine Live-Kennzeichnung.
4. **Arbeitsbereich:** Übersicht, Filter und Ergebnisse oder geordnete Formularabschnitte.
5. **Details:** fachliche Erläuterungen zuerst, technische Evidenz gezielt aufklappbar.
6. **Aktionen und Rückmeldung:** eindeutiger Zustand für Laden, Speichern, Erfolg und Fehler; Fehler bleiben bis zur Behebung sichtbar.

Für das Add-on genügt eine kompakte Navigation. Ein Admin-Portal könnte Übersicht, Linkereignisse, Vorfälle, Geräte, Richtlinien, Integrationen, Nachweise und Einstellungen bündeln. Heute vorhandene Offline-Berichte behalten einen klaren Dokumentcharakter; eine gemeinsame Sidebar darf keine nicht vorhandenen Zielseiten vortäuschen.

## 3. Gemeinsame Komponenten

| Komponente | Verbindliches Verhalten |
| --- | --- |
| Button | Primär, sekundär, destruktiv; benanntes Verb statt unklarer Icons; Ladezustand verhindert doppelte Ausführung |
| Statusbadge | Text und bei Bedarf Symbol zusätzlich zur Farbe; „Ungeprüft“, „Unbekannt“, „Veraltet“ und „Fehler“ unterscheiden |
| Ergebniskarte | Aussage, Bezugszeitpunkt, Quelle, Einschränkung und nächste Aktion |
| Formulare | Sichtbare Labels, Hilfetext direkt beim Feld, Fehler am Feld und als Zusammenfassung; keine Placeholders als Labelersatz |
| Einstellungen | Abschnitte, Änderungsstatus, Speichern und nachvollziehbarer Fehler; automatisch gespeicherte Darstellung ausdrücklich separat kennzeichnen |
| Tabelle | Stabile Kernspalten, sortierbarer Zeitpunkt, Filter, Trefferzahl, Pagination und nachvollziehbarer Exportumfang |
| Detailansicht | Auswahlkontext erhalten, Fachinformationen vor Hashes/IDs; vollständige Werte kopierbar |
| Dialog | Klarer Zweck, sichtbares Abbrechen, sinnvoller Fokus, Tastaturbedienung und Fehler ohne Verlust der Auswahl |
| Leerzustand | Erklären, ob Daten fehlen, Filter keine Treffer liefern oder noch keine Konfiguration existiert |
| Fehlerzustand | Problem und konkrete Wiederholung; vorhandene Daten nicht als aktuellen Erfolg darstellen |

Für Symbole ist eine kleine lokal mitgelieferte Familie vorzusehen. Dekorative Symbole bleiben für Screenreader verborgen; funktionale Symbole benötigen Namen. Emoji sollen keine Sicherheitszustände oder Navigation tragen.

## 4. Informationsdarstellung für Links und Evidenz

Ein Risiko-Score ist eine lokale Einschätzung und kein Sicherheitsnachweis. „Keine Erkennung“ ist keine Garantie. Der Ergebnistext nennt immer Quelle und Prüfstand.

Die primäre Ereignistabelle konzentriert sich auf Zeitpunkt, Domain, Entscheidung, damaligen Score und Prüfergebnis. Vollständige URL, aktuelle Neubewertung, technische IDs, Originaljournal-Köpfe und Signatur-/Pinstatus gehören in die Detailansicht. Beide Scores müssen ausdrücklich als damaliger bzw. aktueller Stand beschriftet werden. „Geöffnet“ bezeichnet die bestätigte Browserübergabe und belegt nicht den erfolgreichen Seitenabruf.

Die vollständige URL bleibt bei berechtigter Prüfung erreichbar und kopierbar. Ein zukünftiges Unternehmensportal benötigt dafür eine tatsächlich implementierte Berechtigungsprüfung und gegebenenfalls Reveal-/Zugriffsaudit. Die Designreferenz zeigt lediglich einen statischen Beispieldatensatz.

Exporte nennen Filter, Zeitraum, Datengrundlage und enthaltene Felder. Eine verkürzte Bildschirmansicht darf den tatsächlichen Exportumfang nicht verschleiern. Signaturen, externe Pins, Originalevidenz und unsignierte Berichte bleiben begrifflich getrennt. SEALED wird ausschließlich bei vorliegendem, entsprechend geprüftem Nachweis angezeigt.

## 5. Admin-Einstellungen als nachvollziehbarer Arbeitsablauf

Zukünftige Admin-Einstellungen gliedern sich in Organisation, Rollen und Zugriff, Schutzrichtlinien, Daten und Aufbewahrung, Integrationen sowie Darstellung. Die Bearbeitung folgt einem einheitlichen Ablauf:

**Aktueller Stand → Änderung → Feldprüfung → Änderungsvergleich → erforderliche Freigabe → Aktivierung → überprüfbares Ergebnis.**

- Lokale Profilwahl bleibt ein deaktivierter Konfigurationsentwurf; „Speichern“ bedeutet keine Verbindung zu SSO, SIEM oder Storage.
- Verbindungstests, Speichern und Aktivieren sind getrennte Aktionen mit ehrlichen Ergebnissen.
- Geheimnisse werden maskiert und über einen vorgesehenen Secret-/Vaultkanal referenziert. Die Oberfläche behauptet keine aktive Vaultintegration.
- Destruktive und sicherheitsrelevante Aktionen nennen Umfang und Folgen. Aufbewahrung, Löschung, Öffnungsregeln und produktive Aktivierung benötigen die tatsächlich implementierten Freigaben.
- Änderungen erhalten einen sichtbaren Zustand: unverändert, ungespeichert, Entwurf, freigabebedürftig, aktiv oder fehlgeschlagen. Rollen- und Freigabezustände werden erst nach Backend-Implementierung verwendet.

Die Referenz zeigt die Formstruktur und eindeutige Kennzeichnung eines nicht verbundenen Entwurfs. Sie speichert keine Einstellungen und führt keine administrativen Aktionen aus.

## 6. Barrierefreiheit und sechs Sprachen

Ziel ist WCAG 2.2 AA. Textkontrast mindestens 4,5:1, relevante Bedienelemente und Fokus mindestens 3:1. Alle Aufgaben müssen mit Tastatur erreichbar sein; Eingaben bleiben bei 200 Prozent Zoom und schmalen Fenstern nutzbar. Im Popup wird die feste, getestete Breite erhalten, damit das frühere Streifenproblem nicht zurückkehrt.

EN, DE, FR, ES, IT und PL gehören zur Produktabnahme. Layouts dürfen keine englischen Wortlängen voraussetzen. Zahlen und Zeiten werden lokalisiert, exakte Evidenzzeitpunkte zusätzlich eindeutig angegeben. Risiko, Quelle, Datenalter und Entscheidung dürfen auch ohne Farbe verständlich sein. Tooltips ergänzen sichtbare Angaben, ersetzen sie nicht.

## 7. Bestandsaufnahme und Umstellungsplan

| Schritt | Ergebnis | Stand |
| --- | --- | --- |
| UX01 | Moderne Einstellungen und gemeinsame Themes für die sechs Add-on-Seiten einschließlich lokaler Adminwerkzeuge und Nachrichtendialoge | Implementiert im Quellstand 1.23.0; automatisiert und in Chromium geprüft, reale Thunderbird-Abnahme offen |
| UX02 | Übergreifende Designprinzipien und bedienbare Referenz für Anwender, Adminübersicht und Admin-Einstellungen | Mit diesem Dokument ausgearbeitet; Beispieldaten, keine aktive Konsole |
| UX03 | Gemeinsamen Token-/Komponentenkern als einzige Quelle für Add-on und sieben Offline-Adminrenderer extrahieren | **Implementiert**; reiner gemeinsamer Designvertrag, generiertes CSS und Renderer-Einbettung; CSP, Offline-Fähigkeit, Sprachen und Exporte geprüft |
| UX04 | Renderer für Ereignisse, Storage, Fälle, Betriebszustand, Geräte, Alarme und Kapazität angleichen | **Implementiert**; gemeinsame Header, Formulare, Status, Theme-/Dichteauswahl; Ereignistabelle mit fünf Kernspalten, Details und Sortierung; Paketreview nutzt denselben Alarmrenderer |
| UX05 | Einheitliche Navigation, Informationsdichte und Tastatur-/Screenreader-Abnahme über alle Oberflächen | Automatisierte Layout-, Theme-, Tastatur-, Filter- und Exportprüfung umgesetzt; versionierter [Browser-/axe-Prüflauf](UI_BROWSERPRUEFUNG.md) und sechssprachige CI ergänzt; echte Thunderbird-/OS- und Screenreader-Abnahme bleibt offen |
| UX06 | Authentifiziertes Unternehmensportal und produktive Admin-Einstellungen auf diese Komponenten aufsetzen | Abhängig von den offenen Enterprise-Kernfunktionen; UI allein erfüllt weder SSO/RBAC noch SEALED |

UX03 und UX04 sind als gemeinsame Konsolidierung umgesetzt. Jeder umgestellte Renderer erhält Vergleiche für leere, volle, gefilterte, veraltete und fehlerhafte Zustände. Bestehende Signaturprüfung, Datenminimierung, Pagination und Exportbedeutung sind Abnahmekriterien. Neue Farben allein schließen diese Schritte nicht ab.

Die automatische Vorarbeit bleibt getrennt von der [produktiven Enterprise-Abnahme](ENTERPRISE_N06_ABNAHME.md). Die [aktuelle Theme-Dokumentation](DESIGN_THEMES.md) beschreibt die bereits implementierten Funktionen.

## Referenz reproduzieren und prüfen

`npm run design:reference` erzeugt die eigenständige Referenz aus den implementierten Theme-Tokens und Styles. `npm run check:design` prüft den erzeugten Stand und ist Teil von `npm run check`. Die Vorschau benötigt weder Netzwerkressourcen noch persistente Einstellungen. Ihre Texte sind deutschsprachige Entwurfsdokumentation; die sechs Produktsprachen bleiben verbindliche Abnahmeanforderung der Umsetzung.

Chromium-Prüfung: 144 Panel-Layouts aus drei Ansichten und 48 Kombinationen von Breite, Systemfarbschema, Erscheinungsbild und Akzent. Filter, Leerzustand, Tastaturwechsel und inaktive Demoaktionen geprüft; keine Seitenfehler oder externen Ressourcenabrufe.

## Implementierter Kern und tatsächliche Admin-Einstellungen

`design_system.js` enthält Farbpaletten, Kontrastprüfung, normalisierte Theme-/Dichtevorgaben und sichere native Farbauswertung. `design_components.css` enthält die gemeinsam genutzten Komponenten. `npm run design:build` erzeugt daraus `design.css`; `npm run check:design` verhindert veraltete generierte Assets. Die Generierung selbst bleibt außerhalb des XPI.

`theme.js` bindet ausschließlich lokale Darstellungsvorgaben und native Thunderbird-Änderungen an diesen Kern. Die sieben Offline-Renderer verwenden `enterprise/design_system.cjs` zum Einbetten desselben CSS. Ihre bestehenden Datenprüfungen und Exportverträge bleiben bestehen. Die Auswahl in Offline-Dateien erfordert keine neuen Skripte; statische Berichte bleiben statisch.

Die realen Profil-Einstellungen zeigen gespeicherte und ungespeicherte Auswahl, einen Feldvergleich, Verwerfen, Ladefehler und wiederholbares Speichern. Bestehende Auswahl wird nach Ladefehlern nicht mit Standardwerten überschrieben. Technische JSON-Vorschau und Prüfdaten sind gezielt aufklappbar; Daten- und Signaturwarnungen bleiben sichtbar.

Automatisierte Gesamtprüfung: 919 Tests; keine Lintfehler, 24 bekannte Thunderbird-Warnungen. 324 wesentliche Browserlayouts über Einstellungen und Adminrenderer sowie zusätzliche Prüfungen der optimierten Assets. Echte SSO-/RBAC-/SEALED-Funktionen werden dadurch nicht ergänzt; UX06 bleibt von den bestehenden Enterprise-Kernaufgaben abhängig.

N18 ergänzt die achte Offline-Adminansicht für [Kapazitätswarnungen](ENTERPRISE_KAPAZITAETSALARME.md). Sie bettet denselben Designkern ein und stellt Erholung, aktive Warnung und Übernahme getrennt dar; Originalhashes sind aufklappbar. Die ursprünglichen sieben Renderer und deren Prüfverträge bleiben erhalten.

## UX05 reproduzierbar ausführen

`npm run check:ui` prüft 528 synthetische Browserfälle über acht Adminansichten und sechs Add-on-Seiten. Die CI prüft alle sechs Sprachen unabhängig und speichert Berichte sowie Fehlerscreenshots. [Umfang, Befehle, axe-Prüfumfang und verbleibende Live-Abnahmen](UI_BROWSERPRUEFUNG.md). Hauptbereiche, Linkkennzeichnung, Tabellenfokus und Dialogbeschriftung wurden anhand der gefundenen Befunde verbessert.
