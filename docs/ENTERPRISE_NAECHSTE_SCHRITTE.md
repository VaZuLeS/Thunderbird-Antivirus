# Priorisierter Ausführungsplan für die offenen Aufgaben

Stand: 14. Oktober 2026. Ergänzung zum [Gesamtkonzept mit 30 Arbeitspaketen](ENTERPRISE_UMSETZUNGSKONZEPT.md) und [aktuellen Umsetzungsstand](ENTERPRISE_UMSETZUNGSSTAND.md). Die Reihenfolge berücksichtigt bereits implementierte Bausteine und fehlende Unternehmenszugänge. Entwicklung erfolgt mit synthetischen Daten; produktive Integrationen werden nicht durch Testdoubles als abgenommen markiert.

| Reihenfolge | Zugeordnete Pakete | Konkretes Ergebnis | Prüfung / Abschlusskriterium | Status |
|---|---|---|---|---|
| N01 | E02, I02 | Separater Public-Key-Verifier und sechssprachiger Report ohne Writer-Schlüssel | Writer-/Readerstatus identisch; keine Journal-/Lockänderung; falsche Roots/Signaturen, abgeschnittene Enden, unzulässige Übergänge und private Config abweisen | **Implementiert und lokal geprüft**; reale Trust-/OS-Verteilung offen |
| N02 | P01, F04 | Dauerhafter Policy-Versions-/Widerrufsstand im vorbereitenden Node-Kern | Vor Entscheidung synchronisieren; Neustart und konkurrierende Updates prüfen; Rollback und fremde Organisation ablehnen | **Implementiert und lokal geprüft**; produktiver Policykanal/OS-Schlüsselschutz offen |
| N03 | I01, I02 | Versionierte Incidentregeln aus verifizierten Entscheidungen, ohne Ticketversand | Score bei Entscheidung verwenden; spätere Neubewertung nicht rückwirkend als damaligen Score behandeln; Deduplizierung und wiederholte Verarbeitung prüfen | **Implementiert und lokal geprüft**; persistente Fälle, Rollen und Tickettransport offen |
| N04 | H02, I04 | Minimierte lokale Betriebsberichte über Queuezustand, Fristen und Fehler mit Alarmdämpfung | Alte Snapshots kennzeichnen; keine erfundenen Geräte-Heartbeats, keine Secrets/URLs; wiederholte Fehler zusammenfassen | **Implementiert und lokal geprüft**; sechssprachige lokale Berichte, dauerhafte Dämpfung; reale Flottenmessung offen |
| N05 | C05, D01 | Optionale SIEM-Exportformate und dauerhafte Connector-Aufträge | Domain-only/Provenienz; keine Aktivierung durch Profilauswahl; Retry/Deduplizierung und Eingabe-/Credential-Lecks prüfen | **Implementiert und lokal geprüft**; vier Offlineformate und dauerhafte Queue; Transport bleibt deaktiviert |
| N06 | E01–E03, A01–A03, F01–F03, Q01–Q02 | Produktive Cloudprüfung, SEALED-Evidenzcommit, SSO-Rollen und echte OS-/Thunderbird-Abnahme | Betreiberidentitäten, Region, Daten-/Retentionfreigaben, IAM/KMS/Restore und getrennte Rollen nachweisen | **Geprüft, produktiv blockiert**; lokale Nachweisprüfung implementiert, reale Systeme/Freigaben und produktive Kernpfade fehlen |

## Automatische Arbeitsreihenfolge innerhalb weiterer Umsetzung

1. Aktuellen Code, Aufgabenstand und CI lesen; lokale Benutzeränderungen erhalten.
2. Den ersten offenen, ohne reale Zugänge ausführbaren Schritt auswählen. N01 bis N05 sind lokal implementiert. N06 wird anhand der [Abnahmevoraussetzungen](ENTERPRISE_N06_ABNAHME.md) fortgesetzt, sobald reale Systeme und Nachweise verfügbar sind; produktive Lücken bleiben offen.
3. Einen konkret nutzbaren Baustein mit negativen Prüfungen, Recoveryfällen und Dokumentation fertigstellen. Lokale Vorarbeit und produktive Abnahme im Status getrennt halten.
4. Relevante Tests und Paketgate ausführen; Code committen/pushen und Pages-Veröffentlichung kontrollieren. Ein XPI-Release nur bei Extension-Änderungen erstellen.
5. Den Plan nach dem tatsächlichen Ergebnis fortschreiben. Reale Aktivierung erst mit den passenden Unternehmensparametern und bereits vorhandener bzw. ausdrücklich erteilter Autorisierung.

Die Umsetzung wird nach dieser Reihenfolge innerhalb der jeweiligen Aufgabe fortgesetzt.

## Noch benötigte reale Nachweise

- **Thunderbird 1.22.0:** tatsächliche Erstinstallation, Update, Zustimmung/Ablehnung und UI in Thunderbird 140 ESR/aktueller Version auf den Zielsystemen; [Prüfliste](live_test_1_22_0.md).
- **Unternehmensbetrieb:** konkrete Betreiber, Datenregion, IdP, Geräteverwaltung und optional freigegebene SIEM-/Ticketsysteme. Verbreitete Anbieter bleiben wählbare Profile.
- **Geschützte Ablage:** unabhängige Live-/Retention-/Schlüssel-/Restoreprüfungen und bestätigter Evidenzcommit. `CLOUD_OBSERVED` bleibt ohne SEALED-Freigabe.

N01 schließt die konkrete Abhängigkeit des Reviewers vom privaten Job-Schlüssel. N02 ergänzt den [dauerhaften Policystand](ENTERPRISE_POLICY_STATE.md). E02, I02 und P01 bleiben insgesamt Vorarbeit; Rotation, unabhängiger Betrieb, SSO, produktiver Policykanal und Gesamtintegration sind nicht abgeschlossen.

N03 ergänzt die [versionierten Incidentregeln](ENTERPRISE_INCIDENTREGELN.md) mit reproduzierbaren IDs, damaligem Assessment und Offline-CLI. I01/I02 bleiben Vorarbeit; ein produktives Incidentportal und Lebenszyklus fehlen.

N04 ergänzt [minimierte sechssprachige Betriebsberichte](ENTERPRISE_BETRIEBSBERICHTE.md) mit dauerhafter Dämpfung; N05 ergänzt [optionale SIEM-Formate und lokale Exportqueue](ENTERPRISE_SIEM_EXPORTQUEUE.md). N06 wurde auf reale Ausführbarkeit geprüft und um [einen ausführbaren Nachweisprüfer](ENTERPRISE_N06_ABNAHME.md) ergänzt. Fehlende Zugänge, Zielsysteme und noch nicht implementierte produktive SEALED-/SSO-/OS-Pfade bleiben explizite Blocker. H02/I04/C05/D01 sind weiterhin Vorarbeit, N06 ist nicht abgenommen.
