# Quellenhistorie und unbestätigte Zuordnung

Stand: **3. November 2026**, unveröffentlichte 1.24.4. Weiterer abgegrenzter Schritt aus AVN-001/009.c. Die bisherige [Identitätsuntersuchung](IDENTITAET_ANALYSEBEFUNDE.md) hat gezeigt, dass numerische Nachrichten-IDs nach Neustarts andere Nachrichten bezeichnen können. Ein gespeicherter Quellenstand unter derselben Zahl darf deshalb keine aktuelle Prüfung belegen.

## Verhalten im Produkt

Die Quellenkarte unterscheidet jetzt zwei Bereiche:

- **Aktueller Prüfstand:** tatsächliche Beobachtungen des aktiven Kontexts sowie gespeicherte Inhaltsbefunde, deren Ressourcenbezug aktuell geprüft wurde. Lokale Abschlusszustände werden aus alten numerischen Besitzfeldern nicht übernommen.
- **Gespeicherte Historie — Zuordnung unbestätigt:** frühere Quellenbeobachtungen, deren Nachrichtenvorkommen nicht dauerhaft nachgewiesen ist. Die geschlossene Zusammenfassung nennt die vorhandenen Dienste. Aufklappen zeigt Prüfumfang, Ergebniszustand und ursprüngliche Zeitangaben. Der Hinweis erklärt, dass Einträge zu einer anderen Nachricht mit derselben Message-ID gehören können.

Historische Warnungen färben die aktuelle Karte nicht als aktuellen bösartigen Befund ein und machen sie nicht zu einer aktuellen externen oder gemischten Prüfung. Die historischen Zeilen besitzen in der Rückgabe keine Ressourcenreferenz. Alte Dateinamen, URLs, IPs, Hashes und Konfigurationswerte werden durch diese Projektion nicht in den historischen Zeilen dupliziert. Bestehende Daten bleiben im Originaldatensatz erhalten.

Die drei neuen Meldungen zu Historie, unbestätigter Zuordnung und fehlgeschlagener Speicherung sind in **Englisch, Deutsch, Französisch, Spanisch, Italienisch und Polnisch** mitgeliefert. Der gemeinsame Renderer verwendet die bestehende Darstellung, Tastatur-/Fokusbehandlung und höfliche Liveansage. Er funktioniert auch als isoliert in die Nachricht übertragene Funktion; ein eigener Regressionstest verhindert die Abhängigkeit von Modulvariablen.

## Ressourcenbezug und Wiederverwendung

`background.js::getMessageAnalysisContext` lädt `analysisStatus`, `analysisStatusByMessage` und alte Besitznummern nicht mehr als aktuelle Quellenzustände. `ThundyAnalysis.history` projiziert sie getrennt, einschließlich optionaler `analysisStatusLegacy`- und neuer Snapshotdaten. Laufende alte Quellenaufträge erscheinen dabei als unvollständig. Ein PENDING aus dem getrennten Entscheidungsjournal wird hier weder gelesen noch umgedeutet.

Für benannte gespeicherte **Anhangberichte** reichen Partnummer, Dateiname und Größe nicht mehr. Der bestehende Anhangprozess liest die tatsächlichen Dateibytes und berechnet bereits einen SHA-256. Erst danach registriert `forAttachment` diesen Hash im aktiven Kontext. Der Popup-Lesepfad und die Übernahme gespeicherter Quellenzeilen verlangen übereinstimmenden Part, tatsächlichen Namen und Hash. Ohne einen erfolgreichen Hashvergleich im aktiven Kontext liefert der Lesepfad keinen benannten alten Anhangbericht. Das ist keine Zusage einer laufenden Neuverifikation nach jeder möglichen Inhaltsänderung unter derselben API-ID. Die Ergänzung startet beim Öffnen der Historie keinen zusätzlichen vollständigen Dateiscan.

Ein Bericht mit nachgewiesen gleichem Inhalt kann als **gespeicherter Inhaltsbefund** verwendet werden. Das ist keine Bestätigung, dass gerade diese Nachricht den früheren Auftrag ausgelöst hat. Historische Interaktionen werden dadurch nicht übernommen. Links bleiben an die tatsächlich vorliegende, exakt übereinstimmende URL gebunden und behalten ihre ursprünglichen Listenpositionen. Eine gekürzte Anzeige-URL ist kein Vergleichsschlüssel.

Gespeicherte Abdeckungszahlen werden nur im passenden aktuellen Hintergrundlauf und Nachrichtenkontext angezeigt. Die neuen `scanCoverageBindings` enthalten dafür eine zufällige Laufzeitkennung und die temporäre Nachrichten-ID. Nach einem Prozesswechsel reicht die alte Zahl nicht aus. Das ist ebenfalls kein dauerhafter Vorkommensnachweis.

## Additive Speicherung ohne Umschreiben alter Quellenfelder

Neue aktive Quellenstände werden im optionalen Feld `analysisSourceSnapshots` innerhalb des bestehenden IndexedDB-Headerdatensatzes gespeichert. Der Datenbankname, Store und Version 3 bleiben bestehen. Ein Kontext besitzt eine zufällige UUID, die als Schlüssel seines aktuellen kumulativen Quellenstands dient. Diese Kennung ist **kein dauerhafter Nachrichtenschlüssel**.

`flush` aktualisiert nur den eigenen neuen Snapshotbereich und `updatedAt`. Die vorhandenen Felder `analysisStatus`, `analysisStatusOwner`, `analysisStatusByMessage` und `analysisStatusLegacy` werden nicht überschrieben oder anhand wiederverwendeter Zahlen neu zugeordnet. Eine unerwartet bereits belegte neue Kennung wird abgewiesen. Schreibzugriffe eines Kontexts werden serialisiert; ein fehlgeschlagener Commit sperrt spätere Versuche nicht dauerhaft.

Nach einem Cacheverlust oder Neustart werden auch neue Snapshots nicht automatisch wieder aktuelle Prüfungen. Sie erscheinen als unbestätigte Historie, bis ein geeigneter dauerhafter Inhalts-/Vorkommensvertrag implementiert ist. Ein erneut ausgeführter lokaler Check oder eine neue Quellenbeobachtung kann unabhängig davon einen aktuellen Stand erzeugen.

Der Bereich enthält den **letzten kumulativen Stand je Quellenkontext**, keinen unveränderlichen Eintrag für jeden Netzwerkversuch. Zähler, ursprüngliche Befundzeiten und der stärkste beobachtete Befund bleiben im vorhandenen Quellenmodell enthalten. Dies ist kein revisionssicheres Archiv und keine Ersetzung des Entscheidungsjournals.

## Grenzen, Fehler und Datenlebenszyklus

Für den neuen Bereich gelten höchstens **64 Kontextsnapshots und 1 MiB serialisierte Snapshotdaten je Headerdatensatz**. Bei voller Kapazität, ungültigem Container, Kennungskollision oder Commitfehler wird die neue Speicherung abgewiesen und im Quellenbereich sichtbar gewarnt. Vorhandene Einträge werden zur Platzgewinnung nicht gelöscht. Aktuelle Beobachtungen können bis zum Kontextverlust im Arbeitsspeicher sichtbar bleiben, sind bei dieser Warnung aber nicht als erfolgreich gespeichert anzusehen.

Die lesende Historienprojektion ist auf 1.200 normalisierte Quellenzeilen und jeweils 128 Alt-/Snapshotfelder pro Container begrenzt; die Karte zeigt höchstens 120 historische Zeilen. Gleiche normalisierte Beobachtungen werden zusammengefasst, Ressourcenbezüge entfernt und eine erreichte Grenze angezeigt. Das sind **Darstellungsgrenzen**, keine Löschvorgänge. Die Originalstrukturen bleiben erhalten.

Die bereits vorhandene [Cache-Aufbewahrung](DATENLEBENSZYKLUS.md) von 30 Tagen bzw. 1.000 Headerdatensätzen gilt weiterhin für den gesamten Cache. Eine explizite Cachelöschung entfernt weiterhin diesen Cache. Es gibt keine zusätzliche automatische Löschmigration, keine neue Frist für das Linkaudit und keine Zusage unbegrenzter Historie. Der allgemeine Retentionsvertrag aus AVN-009 bleibt offen.

**Anschließender Fortschritt:** Die [begrenzte Protokollhistorie AVN-001/009.d](PROTOKOLLHISTORIE.md) schützt inzwischen die fünf vorhandenen Ressourcen-/Protokollwriter vor verlustbehafteter Ersetzung innerhalb des Headercaches. Sie sichert die bisher gespeicherten Originalprotokolle atomar und verweigert eine Ersetzung bei voller Kapazität. Ein unabhängiges Langzeitarchiv, vollständige Ressourcen-/Protokollmigration und dauerhafte Vorkommensbindung bleiben Voraussetzungen für weitergehende Erhaltungs-/Isolationszusagen.

## Validierung

Der [maschinenlesbare Nachweis](audits/avn-001-009-history-2026-11-03.json) bindet Tests und native Prüfläufe an die geprüften Paketbytes. Die neuen gezielten Fälle prüfen:

- keine Übernahme alter lokaler oder externer Abschlüsse anhand derselben Zahl;
- Erhalt alter Quellenfelder und neuer eigenständiger Snapshots, einschließlich Quellenzeiten;
- gleiche Namen/Parts/Größen mit abweichendem Dateiinhalt sowie erlaubte Wiederverwendung nach tatsächlichem Hashvergleich;
- Anzahl-/Bytegrenzen, Kollision, fehlgeschlagenen Commit, geordnete konkurrierende Schreibvorgänge und erneute erfolgreiche Speicherung;
- Trennung aktueller und historischer Bewertungen, alle fünf Dienste, sechs Sprachen, Fokus/Liveansage und isoliert serialisierten Renderer.

Die nativen Linux-Läufe unter **140.12.0 und 153.6.0** erzeugen zwei echte MIME-Nachrichten mit gleicher Header-Message-ID und gleichen Ressourcenmetadaten, aber unterschiedlichen Bytes. Gespeicherte Beobachtungen aller fünf Dienste und eine neue aktuelle Beobachtung sind ausdrücklich **synthetisch eingespeist**. Geprüft werden reale Datenbank-/Runtime-APIs und die tatsächliche E-Mail-/Toolbar-Popup-Anzeige, keine Live-Providerverträge.

Im anschließenden Neustart erhält Nachricht A tatsächlich die frühere ID 3 von B. Die alten Felder bleiben gleich; A erhält daraus keine aktiven Quellenzeilen. Die Historie bleibt unbestätigt und der neue Snapshot erhalten. [Nachrichtenansicht](screenshots/1.24.4/source-history-message.png), [Toolbar-Popup](screenshots/1.24.4/source-history-popup.png).

```sh
node --test test/optimization.test.js test/analysis-sources.test.js
python3 tools/thunderbird-live.dev.py \
  --thunderbird /absolute/path/to/thunderbird-bin \
  --xvfb /absolute/path/to/Xvfb \
  --xpi /absolute/path/to/verified-1.24.4.xpi \
  --source-history-check --out /absolute/path/to/new-result-directory
```

Der direkte EN-CI-Ablauf führt die Historienprüfung separat von der bestehenden Inventar-/205-Kontext-/Identitäts-/MIME-/Unicode-Matrix aus. Upgrade, SIGKILL und Profilrestore bleiben ein eigener Nachweis. Browser-/DOM-Simulationen werden nicht als native Screenreaderabnahme ausgegeben; der fehlende lokale Chromium-Download wird nicht erneut versucht oder als Erfolg gezählt.

Abschluss: **1.033 automatisierte Tests erfolgreich**, vollständige Source-/Sprach-/Design-/Lint-/Paketprüfung erfolgreich; drei vorhandene Byte-Regressionen des Prüfrunners bestehen zusätzlich. Die Historienläufe unter 140.12.0 und 153.6.0 bestehen jeweils mit einem echten normalen Neustart und der tatsächlichen ID-3-Neuvergabe an die Geschwisternachricht. Der kombinierte 153-Lauf mit Ressourcenprüfung, 205 Kontexten, Identitätsmatrix, MIME und Unicode besteht ebenfalls, einschließlich zweier normaler Neustarts. Der separate Lauf von veröffentlichter 1.24.3 auf dieselben Paketbytes besteht mit drei normalen Neustarts einschließlich Profilrestore sowie zwei SIGKILL-Neustarts. Es handelt sich um Linux-Abnahmen mit ausdrücklich synthetischen Quellenbeobachtungen, nicht um reale Providerkonten oder automatische Updates.

AVN-001/009.c ist damit **teilweise umgesetzt**: konservative Historienanzeige, Inhaltsprüfung für gespeicherte Anhangkarten und additive Quellenstände sind vorhanden. Die vollständige Inhalts-/Vorkommens-/Protokollmigration, andere Speicherbackends, Dauerbetriebsretention und zusätzliche Plattform-/Providerabnahmen bleiben offen. **1.24.4 bleibt unveröffentlicht.**
