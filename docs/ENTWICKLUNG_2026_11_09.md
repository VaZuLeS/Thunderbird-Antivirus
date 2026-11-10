> Dieser Bericht dokumentiert die damalige Umsetzungsstufe und ihre Paketbytes. Die spätere [Inline-Korrektur „Jetzt prüfen“](INLINE_SCAN_KONTEXT.md) hat einen eigenen Nachweis; frühere Prüfergebnisse werden nicht auf neue Paketbytes übertragen.

# Umsetzung des evidenzbasierten Entwicklungsplans — 9. November 2026

Basis: `92b4bad` auf `main`, nach Fast-forward des sauberen Checkouts. Veröffentlicht ist weiterhin **1.25.3** ([Release](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.25.3)); die hier beschriebenen Änderungen sind **unveröffentlicht**. Gleiche Manifestversion bedeutet ausdrücklich keine identischen Paketbytes. Veröffentlichung, ATN und automatische Versorgung sind eigenständige Schritte.

## Themenlandkarte und Status

IDs bleiben stabil. Das weiterhin offene Issue #732 ist kein Nachweis fehlender Schutzprofile: Die Implementierung und v1/v2-Prüfungen sind vorhanden; dafür wird keine Doppelaufgabe angelegt. Die native Slot-/Scorebeobachtung bestätigt die hohe Priorität der verbleibenden Identitätsarbeit vor weiteren Persistenzerweiterungen. Ein Arbeitspaket besitzt einen Hauptbereich; Querschnittsanforderungen werden dort mitgeprüft. „Vorbereitet“ oder eine erfolgreiche Untersuchung bedeutet keine produktive Freigabe.

| Paket | Hauptbereich / Typ | Stand und verbleibende Abnahme |
| --- | --- | --- |
| AVN-009.e | Identität und Historie / Optimierung | Reproduzierbare Untersuchung von Schlüssel, Ressourcenlesern, Score, geschütztem Writer, Archiv und Audit ergänzt; keine Migration. [Befund und Folgeentwurf](IDENTITAET_FOLGEVERTRAG_2026_11_09.md). |
| AVN-019 | Hintergrund und Ressourcen / Optimierung | Harte Grenze von 200 Koordinatoraufträgen vor Vorbereitung; eigener Zustand `deferred`, manueller Wiederholungsweg und sechs Übersetzungen. Laufende Eigentümer werden von der begrenzten Beobachterablage getrennt gehalten. Generationswechsel verhindert nachträgliche Zulassung. |
| AVN-020 | Bedienung und Zugänglichkeit / Verbesserung | Freigabe und Quellenexport in Sprach-/Theme-/Dichte-/Tastaturmatrix; laufende, abgelaufene, fehlerhafte und erfolgreiche Zustände. Scoreanzeige und Fokus auf Abschlussmeldung ergänzt. Screenreader bleiben AVN-006. |
| AVN-016 / #739 | Produktstand und Distribution / Verbesserung | Aktueller Einstieg konsolidiert; historische Identitätszusage eingegrenzt; bestehende Profile als implementiert eingeordnet. Öffentlicher Pages-Browserlauf weiterhin nicht nachgewiesen. |
| AVN-014.c | Releaseprovenienz / Optimierung | Redigiertes, vom bestehenden Kandidatengate abgeleitetes `acceptance-VERSION.json`; CI und unveränderliche Veröffentlichung um das dritte Asset ergänzt. Lokale Negativtests vorhanden. CI-Konfiguration um zwei Clientziele und paketgebundene Upgrade-/Crashnachweise erweitert; tatsächliche neue Remote-Ausführung und Veröffentlichung offen. |
| AVN-008.b / #731 | Werkzeugkette / Optimierung | Frische Installation und Audit nach Synchronisierung; drei niedrige Werkzeugmeldungen. Kein Force-Update/Override. [Aktualisierter Audit](DEPENDENCY_AUDIT_2026-11.md). |
| AVN-004.a | Anbieterreferenzen / Optimierung | Offiziellen VxAPI-Client auf festen Commit abgeglichen; Referenztypen und Grenzen dokumentiert. Kein unbelegtes Umetikettieren historischer IDs. [Vertrag und Gegenfälle](HYBRID_REFERENZEN_2026_11_09.md). Vollständige Typmigration noch offen. |
| AVN-004.b / #727 | Analyseverträge / Verbesserung | Echte Konto-, Rechte- und Quotenabnahme aller fünf Dienste offen: Testkonten, freigegebene Ressourcen und Netzfreigaben fehlen. Synthetische Transportantworten zählen nicht als Live-Abnahme. |
| AVN-003 / #726 | Nachrichteninhalt / Verbesserung | Vorhandene MIME-/Unicode-/Nichtverfügbarkeitsprüfungen weiterverwendet. Erfolgreiche OpenPGP-/S/MIME- und weitere Großnachrichtenfälle bleiben eigenständig offen. |
| AVN-009.d / #725 | Datenschutz und Speicher / Optimierung | Bestehende Retention unverändert. Native lokale Identitäts-/Neustartprüfung und simulierte Archiv-Fehlerprüfungen; kontrollierter IMAP-/Dauerbetriebs-/Restore-Nachweis weiter erforderlich. |
| AVN-007.c / #730 | Bedienung und Sprachen / Verbesserung | Automatisierte sechs Sprachkataloge und Browseraufgaben erweitert. Menschliche Such-/Verständlichkeitsprüfung benötigt sprachkundige Prüfer; kein pauschaler Abschluss. |
| AVN-006 / #729 | Plattformen / Verbesserung | Windows/NVDA und macOS/VoiceOver samt nativer Skalierung weiterhin offen; passende Systeme und Prüfer fehlen. Linux/axe ist kein Ersatz. |
| AVN-015 / #738 | Automatische Versorgung / Erweiterung | ATN-/Updatekanal mit zwei angebotenen Versionen fehlt. Unterstützter Rückweg bleibt sauberer Profilrestore; kein allgemein nachgewiesener In-place-Downgrade. |
| AVN-005 / #728 | Schutzqualität / Optimierung | Synthetischer Korpus bleibt Regression. Unabhängige Daten/Labels und Fachreview fehlen. [Untersuchungsauftrag](UNABHAENGIGE_ABNAHMEN_2026_11_09.md). Keine neuen Scoregewichte. |
| AVN-013 / #735 | Architektur / Optimierung | Cacheinvalidierung in einem gemeinsamen Pfad zusammengeführt. Größere Entkopplung bewusst erst nach Identitätsvertrag und stabiler Koordination; nicht als abgeschlossen markieren. |
| AVN-012 / #734 | Optionale Unternehmensanbindung / Erweiterung | Lokale Node-Werkzeuge, Profile und Offline-Review bleiben nutzbar; realer Betreiber, Zielservice, Identitäten und Betriebsfreigabe fehlen. Vorhandenen [Brückenvertrag](ENTERPRISE_BRUECKE_2026-11.md) wiederverwenden. |

## AVN-019: Ausführungsvertrag

- Maximal 200 Einträge einschließlich laufender Aufträge. Terminale Einträge dürfen vor einer neuen Zulassung aus der flüchtigen Koordinatorablage entfernt werden; gespeicherte Befunde bleiben erhalten.
- Kein freier Platz: `state: deferred`, `reason: capacity`, `assessmentIncomplete: true`, keine Job-ID und keine Provideranfrage. Es wird nichts als abgeschlossene Analyse oder Nutzerentscheidung gespeichert. Erneuter ausdrücklicher Versuch ist möglich.
- Eine bereits laufende Prüfung bleibt bei gleicher Identität wiederverwendbar. Keine automatische Wiederholung von POSTs und kein zusätzlicher unbeschränkter Wartespeicher.
- Aktive Aufträge halten ihren eigenen Kontext; Verdrängung aus dem Beobachtercache beendet sie nicht. Der Cache behält höchstens 200 Einträge, zusätzlich höchstens 200 von zugelassenen Aufträgen gehaltene Kontexte. Das ist keine globale RAM-Garantie.
- Ende/Ersetzung gibt den Eigentümer frei; verdrängte Kontexte werden abschließend gespeichert und entsorgt. Explizite Cachelöschung invalidiert und entsorgt auch aktive Eigentümer, ohne spätes Wiederbefüllen.
- Adminautorisierter und historischer Cacheleerpfad verwenden dieselbe Invalidierung, Kontingentbereinigung und Vorschau-Benachrichtigung. Fehlende Adminfreigabe bleibt ein Fehler.

## AVN-020: Prüfvertrag

Die Browsermatrix enthält für Freigaben `ready/pending/failed/expired/opened`, für Exporte `empty/ready/pending/unavailable/changed/saved/failed`, jeweils EN/DE/FR/ES/IT/PL, hell/dunkel, 320/1280 Pixel und kompakt/bequem. Die CI prüft beide Seiten zusätzlich bei 200 % CSS-Zoom. Kandidaten müssen die tatsächlichen Szenario- und Dichtekennungen enthalten; ein grün behaupteter Bericht ohne Fälle genügt nicht.

Native Passwörter werden getrennt von Quellenexporten in frischen Testprofilen geprüft. Ein durch Adminschutz abgewiesener Cacheleeraufruf darf vom Prüfer nicht als erfolgreiche Löschung behandelt werden. Browser-APIs und Providerantworten in der Browserprüfung sind simuliert; native Läufe und Screenreader bleiben getrennte Belege.

## AVN-014.c: Dauerhafte Belege

`scripts/release-evidence.js` prüft zuerst die vollständige Kandidatenevidenz gegen Paket und Quelle. Erst danach projiziert es die für die Gateprüfung nötigen Felder. Historische Ereignisse werden mit pseudonymisierten IDs und Inhaltsprüfsummen verglichen; URLs, Profilpfade und beliebige Zusatzfelder werden nicht übernommen. Die redigierte Projektion muss dasselbe Kandidatengate erneut bestehen. Ein Digest ist keine Signatur und beweist keine externe Authentizität.

Die native CI hat zwei Ziele: `minimum` mit dem geprüften Debian-Pin `1:140.12.0esr-1~deb13u1` und passenden Sprachpaketen sowie `current` aus den aktuellen Debian-trixie-Paketquellen. Der tatsächlich installierte Client wird im Bericht genannt. „Current“ ist diese Paketlinie und keine unbelegte Zusage der neuesten Upstreamversion. Verschwindet ein gepinntes Paket, muss der Lauf fehlschlagen und der Pin nach erneuter Mindestlinienprüfung gepflegt werden; kein stiller Fallback. Beide Ziele benötigen vollständige sechssprachige Upgrade-/Crashnachweise. Die Konfiguration wurde lokal geparst und ihre Berichtsannotation an einer isolierten Datei tatsächlich ausgeführt; ein erfolgreicher Remote-Lauf ist dadurch noch nicht bestätigt.

Der Publisher erwartet für künftige Ausführungen XPI, Prüfsumme und `acceptance-VERSION.json`. Bereits veröffentlichte Assets werden weder ergänzt noch überschrieben. Das Release darf nur aus einem neu vollständig geprüften, versionskonformen Kandidaten entstehen; dieses Arbeitsverzeichnis ist kein freigegebener Release.

## Validierung und Grenzen

Aktuelle maschinenlesbare lokale Nachweise: [Untersuchung](audits/identity-development-2026-11-09.json) und [Ausführungsnachweis](audits/development-2026-11-09.json). Sie unterscheiden Paketbytes, Quellfingerprints, native Prüfungen, Simulationen und offene Nachweise. Fehlgeschlagene Harnessversuche bleiben getrennt von erfolgreichen Läufen. Keine automatische Migration, keine neue Löschpolitik und keine produktive Enterpriseaktivierung.

Nächste fachliche Folge: nach Backend-/Cryptoabnahme den Identitätsentwurf konkretisieren, dann eine additive Migration mit Abbruch-/Restoreprüfung separat umsetzen. Parallel reale OS-, Sprach-, Provider- und Updateabnahmen beschaffen. Zusätzliche Dienste, neue Scoregewichte und ein vollständiger Portalumbau sind ohne diese Evidenz nicht freigegeben.

Lokaler Abschluss: 1.256 Node-Tests bestanden, 864 Browserfälle für die beiden zusätzlichen Seiten einschließlich sechs Sprachen und 200 % CSS-Zoom bestanden. Vier native Prüfumfänge unter Thunderbird 140.12.0 bestanden: Koordinator/automatische Prüfungen, Identität/MIME/Unicode/Cachegrenze, Administration/Freigabe sowie Quellenexport/Neustart. Die abschließenden Browserberichte gehören zum aktuellen Quellfingerprint; alle vier nativen Berichte gehören zum selben geprüften Paket. Das ist kein vollständiger Release-Gate-Lauf und keine Abnahme von Windows/macOS, Screenreadern oder echten Providerkonten.
