# AVN-009.e — Identitätsfolgen und konservativer Folgeentwurf

Stand: 9. November 2026. Untersuchung, **keine Bestandsmigration**. Die frühere Aussage „dauerhafte Vorkommensidentität“ in 1.24.8 beschreibt den vorhandenen Metadatenfallback nicht zutreffend.

## Reproduzierbare Beobachtung

`node tools/identity-investigation.dev.cjs` lädt tatsächliche Produktfunktionen für Schlüsselableitung, Ressourcenlesen, Risikoberechnung und geschützte DAO-Schreibzugriffe. Browser- und IndexedDB-Grenzen sind simuliert, nicht nativ. Der Bericht nennt den Quellfingerprint und unterscheidet doppelte/fehlende Header-ID, gleichen Anhang bei anderem Text und bytegleiche Kopien.

- Gleiche Header-ID oder gleiche Metadaten ohne Header-ID führen weiterhin zum selben Datensatz. Der Text gehört nicht zur Fallbackableitung; produktive Aufrufer übergeben dort keine Anhanghashes.
- Abweichende Anhangbytes werden beim Lesen erkannt; ein fremder Anhangbefund wird nicht zur aktuellen Nachricht übernommen. Auch eine gespeicherte Anhangkarte benötigt aktuellen Hashnachweis.
- Eine tatsächlich übereinstimmende URL kann einen vorhandenen URL-Befund teilen. Dies allein beweist keine falsche URL-Reputation; es beweist ebenso wenig gemeinsame Nachrichtenvorkommen.
- Ein neuer Bericht für denselben Partslot ersetzt den gemeinsamen aktuellen Slot. Der vorherige Bericht wird archiviert. Der ursprüngliche Anhang hat danach keinen passenden aktuellen Befund mehr. Im kontrollierten lokalen Scorevergleich sinkt die rein aus diesem Befund abgeleitete Bewertung von 80 auf 0. Diese Werte sind ein Gegenfall, keine allgemeine Erkennungsmetrik.
- Archiv und historische Auditentscheidungen bleiben erhalten. Archivierung allein stellt den ursprünglichen aktuellen Ressourcenbezug nicht wieder her.

Die native Identitätsprobe `--identity-lifecycle-check` verwendet reale Nachrichten, IndexedDB, Ressourcenleser und Writer. Sie erfasst die Slot-/Scorefolgen unter `contentIdentity.runtimeConsequences` sowie Kopieren, Verschieben, Statusänderung, Komprimieren und Neustart. Synthetische Providerberichte werden ausdrücklich als solche markiert. Die Nachweise gelten nur für die jeweils genannten Paketbytes und lokalen mbox-Profile.

## Getrennte Begriffe und vorgeschlagene Schnittstellen

| Begriff | Vertrag des Folgeentwurfs |
| --- | --- |
| Laufzeit-Locator | Hintergrundlaufzeit + numerische Message-ID, ausschließlich in dieser Laufzeit gültig |
| `ContentProof` | Versionierter SHA-256-Nachweis mit exakt benannten Eingaben, Ressourcenhashes und Verfügbarkeitsstatus; bei nicht vollständig überprüfbaren Eingaben kein bestätigter Inhaltsnachweis |
| Vorkommen | Eigene UUID für ein nachgewiesenes Nachrichtenvorkommen. Gleicher Inhalt und gleiche Header-ID sind keine Vorkommensgleichheit |
| Ressource | Anhang über tatsächliche Bytes, Link über tatsächliche analysierte URL; Part-ID und Anzeigename sind Beschreibungen |
| Befund | Eigene ID, Ressourcenbezug, Anbieter, Referenztyp, ursprüngliche Beobachtungszeit und Prüf-/Abschlussstatus |
| Entscheidung | Eigenständige Interaktion mit damaligen Snapshots; niemals aus heutigen Befunden neu erzeugen |

## Migrationsregeln für den Folgeauftrag

1. Bestehenden `hybridanalysis`-Store, Archive und Auditdaten unverändert lesbar halten. Neue Bindungen additiv und versioniert speichern; alte Schlüssel nicht in-place umbenennen.
2. Altbestände ohne sicheren Vorkommensnachweis bleiben als unbestätigte Historie zugänglich. Sie werden weder einer zufällig passenden numerischen ID noch einer bytegleichen Kopie automatisch zugeteilt.
3. Ein neuer Inhaltsnachweis darf übereinstimmende Ressourcenbefunde referenzieren, aber keine damalige Nutzerentscheidung oder Einwilligung übernehmen.
4. Kein ungefilterter Rohdatenhash: lokale X-Mozilla-Header ändern sich bereits durch Statuswechsel. Vor einer produktiven Kanonisierung sind gültige Crypto-/MIME-Fälle und weitere Backends nachzuweisen. Der experimentelle Filter des Prüfrunners ist keine Freigabe.
5. Ein dauerhafter Locator-/Ereignisvertrag muss mit den tatsächlich vorhandenen Thunderbird-Rechten nachgewiesen werden. Ohne Nachweis nach Neustart/Ordnerwechsel keine automatische Wiederbindung. Zusätzliche Rechte gegebenenfalls separat begründen.
6. Atomare Schreib-/Abbruchfälle, voller Speicher, beschädigte Altbereiche, wiederholte Migration, Parallelzugriffe und Profilrestore dürfen keine Originaldaten verlieren oder historische Scores verändern.
7. Bestehende Retention unverändert lassen. Eine Migration ist kein Anlass, alte Datensätze oder volle Archive zur Platzgewinnung zu löschen.

## Abnahme vor Migration

AVN-003 und AVN-009.d müssen den relevanten MIME-/Crypto-/Backendumfang klären. Danach sind genaue Persistenzformen, Schema-Upgradetransaktion, Locatorereignisse und Wiederanlaufregeln in einem eigenen Migrationsauftrag festzuschreiben. Bis dahin ist weder eine allgemeine dauerhafte Vorkommensbindung noch eine verlustfreie automatische Zuordnung behauptet.

OPENED bleibt Thunderbirds Annahme der Öffnungsanforderung. PENDING bleibt nach Prozessverlust offen. Diese Untersuchung ändert weder Zustände noch Daten bestehender Profile.

Der [konkretisierte Vertrag vom 10. November](IDENTITAETSVERTRAG_2026_11_10.md) benennt inzwischen die fehlende Ereignisberechtigung und einen konservativen Rohbyte-Nachweis. Er ist weiterhin keine Migration.
