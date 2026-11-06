# Detaillierte Ausführungsliste — Thundy AV

Stand: 2. November 2026. Ausgangscommit `6046fe0`; Grundlage: [Produktplan](PRODUKTANALYSE_AUFGABENPLAN_2026-11-02.md).

Status: `[ ]` offen; `[x]` ausgeführt mit Beleg. Eine vorbereitete Prüfanweisung ist kein ausgeführter nativer Test. Extern blockierte Teilaufgaben bleiben offen und erhalten konkrete Voraussetzungen.

## Ausführungsübersicht

46 von 56 Unteraufgaben sind mit den verfügbaren Mitteln ausgeführt. Neun Teilaufgaben benötigen zusätzliche Zielsysteme, Konten oder öffentliche Erreichbarkeit. Ein zusätzlicher Werkzeugkettenbefund bleibt offen, bis eine unterstützte gepatchte Version oder eine geprüfte Migration vorliegt. Fachliches Sprachreview und der tatsächliche Remote-CI-/Pages-Lauf werden von lokalen Automatikergebnissen getrennt.

TAV-018 ergänzt die Liste dynamisch um einen beim Ausführen neu belegten Lieferkettenbefund.

Die Implementierung bereitet 1.24.3 vor. Sie veröffentlicht keinen neuen Release, überschreibt keine bestehenden Tags/Assets und aktiviert keine Unternehmensintegration. Vollständige lokale Prüfungen: Node 22 und 24, 976 Tests; 600 vollständige Browserfälle plus 36 CSS-Zoomfälle; echte Linux-Upgrades/Neustarts/Prozessverluste in sechs Sprachprofilen, Profilrestore und zusätzlicher echter Browserpfad. Die konkreten Grenzen stehen je Paket unten.

[Abschlussprotokoll](audits/ausfuehrung-2026-11-02.md) · [Aktueller Produktstand](AKTUELLER_PRODUKTSTAND.md)

## TAV-001 — Abhängigkeiten und gebündelte Daten reproduzierbar machen

Status: Umgesetzt und lokal geprüft.

- [x] TAV-001.01 Vite-kompatibles React-Plugin wählen; Lockfile und Node-Anforderung aktualisieren.
- [x] TAV-001.02 Frische Installation ohne Peer-Umgehung; gebündelte PSL aus Pin reproduzieren.
- [x] TAV-001.03 Webbuild/TypeScript sowie vollständigen Add-on-Check ausführen.

Ergebnis/Beleg: React-Plugin 6.1.2 mit Vite 8.3.5, reproduzierbares PSL 7.4.19, frisches npm ci, check:web und check unter Node 22.23.4 und 24.19.0 erfolgreich. 976 Tests, Lint 0 Fehler/24 kuratierte Warnungen, 44 Paketdateien. [Releaseabgleich](RELEASE_ABGLEICH_1_24_3.md).

## TAV-002 — Release 1.24.2 mit main funktional abgleichen

Status: Umgesetzt und geprüft; reale Providerabnahme separat offen.

- [x] TAV-002.01 Alle paketwirksamen Differenzen zu v1.24.2 klassifizieren.
- [x] TAV-002.02 Berichtspersistenz, Polling, Protokollmetadaten und Provider-Auth gezielt wiederherstellen.
- [x] TAV-002.03 Widerruf/Popup-Lebenszyklus und veraltete Reportantworten absichern.
- [x] TAV-002.04 Neue unveröffentlichte Kandidatenversion >1.24.2 mit Release-Notizen vorbereiten.

Ergebnis/Beleg: [Dateiweiser Releaseabgleich](RELEASE_ABGLEICH_1_24_3.md), wiederhergestellte Berichte/Polling/Auth und zusätzliche Negativtests. [Kandidat 1.24.3](releases/1.24.3.md) ist vorbereitet, kein Tag/Release geändert. Bestehende Daten in sechs echten Upgradeprofilen erhalten.

## TAV-003 — Releasegates und aktive Workflows vereinheitlichen

Status: Lokal und auf GitHub b3f9f69 geprüft; Remote-Wiederholung für spätere Werkzeugpatches separat.

- [x] TAV-003.01 Schmutzigen Paketarbeitsbaum und ungebundene Live-Evidenz im Gate ablehnen.
- [x] TAV-003.02 Kandidatenprüfung und taggebundene Publikationsprüfung ohne zirkuläre Abhängigkeit trennen.
- [x] TAV-003.03 Aktive CI-/Release-Workflows mit identischer Paketidentität und unveränderlichen Assets verbinden.
- [x] TAV-003.04 Negative Gatefälle und Wiederholung/Assetabweichungen testen.

Ergebnis/Beleg: Aktive CI/Release-Workflows und Referenzkopien synchron; Paket-/Quellbindung, sauberes C7, sechs Sprachberichte und unveränderliche Assets. 17 gezielte Gate-/Releaseprüfungen erfolgreich, YAML geparst. [CI-Verhalten](https://github.com/VaZuLeS/Thunderbird-Antivirus/blob/main/docs/ci/README.md). Vollständiger Kandidatengate nach Implementierungscommit erfolgreich: Exit 0, C1–C7 PASS. Auch [GitHub-CI einschließlich echter GUI und Kandidatengate](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/41384190870) erfolgreich; kein Tag oder Storestatus behauptet.

## TAV-004 — Webdemo und Thunderbird-Produkt verbindlich abgrenzen

Status: Umgesetzt.

- [x] TAV-004.01 React als separate Simulation kennzeichnen und echte Add-on-Anleitung wiederherstellen.
- [x] TAV-004.02 Synthetisches OPENED ohne Thunderbird-Annahme durch eindeutige Demoentscheidung ersetzen.
- [x] TAV-004.03 Demo- und Produktdaten/Paketgrenzen prüfen.

Ergebnis/Beleg: [Browsertest der Demo](audits/demo-review-1_24_3.json), README und sichtbarer sechssprachiger Demohinweis trennen Runtimes. Neue Demoereignisse SIMULATED_OPEN/SIMULATED_ABORT mit null echten Öffnungsversuchen; Providerkey-Eingaben deaktiviert. Originale Browser-Demohistorie bleibt erhalten. Webbuild/TypeScript erfolgreich; XPI enthält weder React noch Enterprise-Node.

## TAV-005 — Datenschutz, Statusdokumentation und Pages korrigieren

Status: Lokale Quellen korrigiert; öffentliche HTTP-/Deployment-Abnahme blockiert.

- [x] TAV-005.01 Aktion/Provider/Stufe/Freigabe-Datenflussmatrix aus Code erstellen.
- [x] TAV-005.02 Privacy-, Status-, Index- und CI-Dokumentation korrigieren; historische Pläne markieren.
- [ ] TAV-005.03 Pages-Quellen/Verweise prüfen; öffentliche Website nach verfügbarem Zugriff lesen.

Ergebnis/Beleg: [Datenflussmatrix](privacy_policy.md), sechs öffentliche Sprachquellen, aktueller Index/Status/Support und historische Kennzeichnung. 24 aktuelle Dokumente und 142 relative Verweise/Permalinks geprüft. Webwerkzeug konnte Pages nicht lesen; hier kein Ruby/Jekyll, kein neuer Pages-Produktivdeploy behauptet.

## TAV-006 — Schutzqualität und Providerverhalten risikobasiert untersuchen

Status: Lokale Untersuchung abgeschlossen; echte Provider-/Feldabnahme offen.

- [x] TAV-006.01 Bedrohungsmodell, legitime Gegenbeispiele und Provider-Verhaltensmatrix anlegen.
- [x] TAV-006.02 Manipulierte Authheader, UNKNOWN/Fehler und Nachrichtenkontext mit repräsentativen EMLs prüfen.
- [ ] TAV-006.03 Reale Providerprüfung nur mit vorhandenem Testkonto ausführen; sonst konkreten Blocker festhalten.

Ergebnis/Beleg: [Bedrohungsmodell und Providerverträge](SCHUTZWIRKUNG_VALIDIERUNG_2026-11.md), neun synthetische Risikofälle und private PSL-Tenants bestanden, Freigabe-/Fehler-/Trustgrenzen geprüft. Keine Fehlalarm-/Erkennungsrate erfunden. Reale Testkonten/Netzfreigaben und unabhängiger Korpus fehlen.

## TAV-007 — Audit an Fehler- und Prozessgrenzen absichern

Status: Umgesetzt und im benannten Umfang geprüft.

- [x] TAV-007.01 Doppelte Aktionen, späte Ergebnisse, Kontextwechsel und Audit-Schreibfehler prüfen.
- [x] TAV-007.02 PENDING-/OPENED-Grenzen im Audit verständlich machen; Snapshots erhalten.
- [x] TAV-007.03 Echten Thunderbird-Neustart/Prozessverlust auf Kandidat prüfen, soweit Runtime installierbar.

Ergebnis/Beleg: PENDING-Erklärung und Abbruchlabels in sechs Sprachen. Rennen zwischen doppeltem Öffnen/Abbruch, Kontextwechsel und angenommener OS-Anforderung vor fehlgeschlagenem Commit getestet. [Echte Linux-SIGKILL-Nachweise](live_test_1_24_3.md); kein Strom-/Datenträgerausfallnachweis.

## TAV-008 — Aufbewahrung und Migration nachvollziehbar definieren

Status: Lokale Untersuchung/Vertragsprüfung abgeschlossen.

- [x] TAV-008.01 Dateninventar und genaue Aufbewahrungs-/Löschtrigger dokumentieren.
- [x] TAV-008.02 Grenzfälle Alter/Anzahl/Bytes, alte Felder und Quotenfehler prüfen.
- [x] TAV-008.03 Upgrade-/Restore-Erhalt ohne implizite Einwilligung oder Historienumschreibung prüfen.

Ergebnis/Beleg: [Dateninventar/Trigger/Migration](DATENLEBENSZYKLUS.md), [Alters-/Byte-/Anzahl-/Uhrgrenzen](audits/retention-boundaries-1_24_3.json) sowie echtes Upgrade/Restore. Keine neue ungefragte Löschfrist oder Uhrkorrektur eingeführt.

## TAV-009 — Windows/macOS und reale Standardbrowser prüfen

Status: Linux geprüft; Windows/macOS blockiert.

- [x] TAV-009.01 Native Plattform-/Browsermatrix und ausführbare Testschritte vorbereiten.
- [x] TAV-009.02 Linux mit echtem Thunderbird prüfen, sofern installierbar.
- [ ] TAV-009.03 Windows/macOS mit echten Browsern prüfen oder fehlende Zielumgebung konkret dokumentieren.

Ergebnis/Beleg: [Native Matrix](NATIVE_ABNAHME_2026-11.md), echte 140/153-ESR-Profile. Zusätzlich [echter Chromiumstart mit kontrolliertem lokalem HTTPS-Abruf](audits/real-browser-1_24_3.json). Keine Windows-/macOS-Runtime vorhanden; andere Standardbrowser bleiben offen.

## TAV-010 — Native Screenreader- und Tastaturabnahme

Status: Automatisierter Teil geprüft; reale Screenreader blockiert.

- [x] TAV-010.01 Screenreader-Protokoll für URL/Score/Status/Fokus/Fehler vorbereiten.
- [x] TAV-010.02 Tastatur-/axe-Prüfung der verfügbaren Oberflächen durchführen und Defekte beheben.
- [ ] TAV-010.03 NVDA/VoiceOver in nativen Zielumgebungen prüfen oder fehlende Ressourcen benennen.

Ergebnis/Beleg: 600 Chromium-/axe-Fälle und Tastatur-/Fokuspfade bestanden. [Screenreader-Protokoll](NATIVE_ABNAHME_2026-11.md) vorbereitet. NVDA/VoiceOver samt nativen Zielsystemen und tatsächlichen Ansagen fehlen; keine WCAG-Zertifizierung behauptet.

## TAV-011 — Sechs Sprachen in dynamischen Pfaden vervollständigen

Status: Automatisch im Produktumfang geprüft; fachliches Sprachreview offen.

- [x] TAV-011.01 Dynamische Rohcodes durch Labels in allen sechs Katalogen ersetzen.
- [x] TAV-011.02 PENDING-/OPENED-/Auditfehlertexte und Übersetzungsplatzhalter vollständig prüfen.
- [x] TAV-011.03 Sechssprachige Browser-/Thunderbird-Darstellung ausführen; Sprachreviewgrenzen dokumentieren.

Ergebnis/Beleg: Sechs Kataloge/Fallbacks einschließlich wiederaufgenommener Reporttexte und neuer dynamischer Abbruch-/PENDING-/Speichertexte vollständig geprüft. 600 Sprachlayouts und sechs echte Sprach-Upgrade-/Dialogprofile bestanden; historische Rohwerte nicht umgeschrieben. Muttersprachliche Gesamtfreigabe ist kein Automatikergebnis.

## TAV-012 — Designsystem unter nativen Bedingungen abnehmen

Status: Gemeinsamer lokaler/browserbasierter Teil geprüft; native DPI/High Contrast offen.

- [x] TAV-012.01 Gemeinsame Add-on-/Admin-Tokens, Themes und Dichte prüfen.
- [x] TAV-012.02 Hell/Dunkel, schmale Ansicht und Zoom in verfügbarer UI-Matrix prüfen.
- [ ] TAV-012.03 Native DPI/High-Contrast-Nachweise mit 009/010 verknüpfen.

Ergebnis/Beleg: Gemeinsame Generatoren/Tokens, echte Linux-Themes und Dichte erfolgreich. Zusätzlich 12 Einstellungs- und 24 Auditfälle bei 200 % CSS-Zoom in sechs Sprachen bestanden. Native OS-DPI/High-Contrast- und Screenreaderfälle bleiben mit 009/010 verknüpft.

## TAV-013 — Updates und Rollback mit Bestandsdaten nachweisen

Status: Manuelles Upgrade/Recovery/Backup-Restore geprüft; automatische Distribution blockiert.

- [x] TAV-013.01 Veröffentlichtes 1.24.2-XPI mit geprüfter Prüfsumme als Vorversion bereitstellen.
- [x] TAV-013.02 Echten dauerhaften Upgrade-/Neustart-/Crash-Test und sicheren Backup-Rückweg vorbereiten/prüfen.
- [ ] TAV-013.03 Automatische Distribution separat prüfen, falls geeigneter Kanal verfügbar ist.

Ergebnis/Beleg: Vorversion 1.24.2 heruntergeladen und veröffentlichte SHA-256 verifiziert. [Echte sechs Upgrades](audits/candidate-1_24_3.json), [Profilrestore](audits/backup-restore-1_24_3.json). Rückweg ist Snapshotrestore ohne nachträglichen Merge; echter automatischer Kanal mit zwei Versionen fehlt.

## TAV-014 — ATN-Einreichung und Distribution abschließen

Status: Einreichungspaket vorbereitet; ATN-Zugang/Signierung/Review blockiert.

- [x] TAV-014.01 Konkretes ATN-Kandidatenpaket, Reviewerpfad und Einreichungscheckliste vorbereiten.
- [ ] TAV-014.02 Aktuellen ATN-Zugang/Kanal und Signierungs-/Listungsstatus prüfen, soweit zugänglich.
- [ ] TAV-014.03 Signierung/Einreichung/Installation nur mit tatsächlichen passenden Voraussetzungen ausführen.

Ergebnis/Beleg: [Konkrete Kandidatencheckliste](ATN_KANDIDAT_1_24_3.md), aktuelle echte Linux-Screenshots, Reviewer-/Privacy-/Releasequellen vorhanden. Keine ATN-Credentials/Identitäten eingerichtet; öffentlicher ATN-Leseversuch nicht zugänglich. Keine Signierung, Listung oder Storefreigabe behauptet.

## TAV-015 — Reale Performanceengpässe messen

Status: Untersuchung abgeschlossen.

- [x] TAV-015.01 Reale Messmethode, deterministische große Nachrichten und begrenztes Audit-Szenario vorbereiten.
- [x] TAV-015.02 Verfügbare echte Thunderbird-Baseline messen; synthetische Messung separat ausweisen.
- [x] TAV-015.03 Nur belegte Engpässe optimieren; keine erfundenen Prozentziele.

Ergebnis/Beleg: [Reale 1-/5-MiB-Baseline und 2.000-Einträge-Audit](PERFORMANCE_BASELINE_2026-11.md) gemessen. Harness-Bereitschaftsrennen korrigiert; keine Klickwiederholung. Kein belegtes Prozentziel, deshalb kein unbegründeter Performanceumbau oder Speichergewinn behauptet.

## TAV-016 — Optionale Enterprise-Brücke entwerfen

Status: Entwurf und begrenzter lokaler Prototyp umgesetzt/geprüft.

- [x] TAV-016.01 Transport-/Trustentscheidung für expliziten optionalen lokalen Auditexport ausarbeiten.
- [x] TAV-016.02 Minimalen lokalen Vertrags-/Prototypnachweis ohne automatische Aktivierung erstellen.
- [x] TAV-016.03 Installations-, Rechte-, Datenminimierungs- und Recoverygrenzen konkret dokumentieren.

Ergebnis/Beleg: [Transport-/Trustentscheidung](ENTERPRISE_BRUECKE_2026-11.md); expliziter domain-only Offline-Auditreview mit Limits, Prüfsumme und unveränderten historischen Snapshots. Drei negative/positive Importprüfungen bestanden. Quelle bleibt unauthentisiert, kein Netzwerk/Enrollment/SEALED und keine Runtimeaktivierung.

## TAV-017 — Einen echten Unternehmenspilot abnehmen

Status: Produktiver Pilot blockiert; Scope und Voraussetzungen konkretisiert.

- [x] TAV-017.01 Vorhandene EN-/N-Arbeiten abgleichen; Pilot auf genau einen freizugebenden Pfad begrenzen.
- [x] TAV-017.02 Betreiber-, Mandanten-, IdP-/Storage- und Datenfreigaben anhand tatsächlicher Bindungen prüfen.
- [ ] TAV-017.03 Liveabnahme nur mit realen Voraussetzungen durchführen; keine STAGED→SEALED-Behauptung erfinden.

Ergebnis/Beleg: [Pilotgrenze und vorhandene EN-/N-Zuordnung](ENTERPRISE_BRUECKE_2026-11.md). Aktuelle Runtime meldet null Secrets/Unternehmensidentitäten/Infrastrukturcapabilities. Betreiber, freigegebener Testmandant, Daten-/Retention-/Rollenfreigaben und gewählte Liveziele fehlen. Kein Produktivbetrieb erfunden.

## TAV-018 — Werkzeug-Lieferkette nach aktuellem npm-Audit

Status: kompatible Patches umgesetzt; verbleibende Werkzeugmeldungen offen. Neu aus der Ausführung, Hauptbereich Lieferfähigkeit/Releaseprovenienz, Typ Optimierung.

- [x] TAV-018.01 Aktuellen Kandidaten statt nur GitHubs Standardbranch-Zähler mit npm audit untersuchen und Runtime-/Toolscope unterscheiden.
- [x] TAV-018.02 Kompatible node-forge-/fast-uri-Patches ohne --force anwenden; frische Installation und relevante Gesamtprüfung erneut ausführen.
- [ ] TAV-018.03 Unterstützte Behebung für die verbleibende web-ext-/Linterkette bestimmen und einschließlich API-, Lint-, Package- und Signierpfad validieren.

Ergebnis/Beleg: [konkrete Priorität, Umfang, Akzeptanz und verbliebene Meldungen](DEPENDENCY_AUDIT_2026-11.md). 12 auf 10 Meldungen reduziert, hohe Meldung behoben; neun mittlere/eine niedrige Werkzeugmeldung bleiben nach kompatibler Standardbehebung offen. Kein betroffenes Werkzeugpaket wird als solches ins XPI gepackt. Kein pauschaler Downgrade oder ungeprüfter Override.
