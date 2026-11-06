# 1.24.8 — Dauerhafte Vorkommensidentität, Schutzprofile mit Differenzvorschau und Heuristik-Benchmarking

Stand: 6. November 2026. Tatsächlicher [Veröffentlichungsstatus, XPI und Prüfsumme](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.24.8). Ein vorbereiteter Quellstand oder dieses Dokument allein bestätigt keine Veröffentlichung. [1.24.7](VEROEFFENTLICHUNG_1_24_7.md) und seine Assets bleiben unverändert erhalten.

## Umfang und abgeschlossene Arbeitspakete

### 1. Dauerhafte Vorkommensidentität und sichere Speicherschlüssel (AVN-009)
- `db.js::deriveMessageContentKey`: Deterministische Ableitung robuster Speicherschlüssel aus kanonischen Nachrichteninhalten (Autor, bereinigter Betreff, normalisiertes Datum und sortierte SHA-256-Hashes von Anhängen), falls keine stabile `headerMessageId` vorliegt.
- `db.js::resolveMessageStorageKey`: Zentrale Weiche zur konsistenten Adressierung in IndexedDB (`hybridanalysis`), die unverändert bevorzugt `headerMessageId` nutzt und bei Fehlen auf den inhaltsbasierten Schlüssel zurückgreift.
- `background.js`: Nutzung von `resolveMessageStorageKey` in `getMessageAnalysisContext`, `persistThreatIntelSummary`, `collectAttachmentFindings` und `collectLinkFindings`. Dadurch bleiben Analysebefunde und Audit-Snapshots auch nach Ordnerverschiebungen oder Reindizierungen stabil erhalten.

### 2. Lokale Schutzprofile mit verpflichtender Differenzvorschau (AVN-010)
- `options.js::LocalProtectionProfile`: Strukturierte Verarbeitung von Schutzrichtlinien (`privacyTier`, `alwaysManual`, `timeOfClickProtection`) mit `prepare` und `commit`.
- Formale Schema-Spezifikation unter `docs/schemas/local-protection-profile-v1.json` (JSON-Schema Draft 2020-12).
- Transparente Differenzanzeige im Optionen-Dialog vor Übernahme von Einstellungen; Schutz vor Überschreiben bei zwischenzeitlichen Speicheränderungen (`PROFILE_CHANGED`) sowie strikte Fehlerbehandlung bei Quota-Limits.

### 3. Heuristik-Benchmarking & Risikokorpus (AVN-005)
- Erweiterung des Testkorpus in `testdata/risk-behavior.json` um 8 reale und synthetische Grenzfälle (Benigne Subdomains unter Berücksichtigung der Public Suffix List, offizielle Markenlinks, bekannte Kontakte mit Dringlichkeit, Absender-/Link-Typosquatting sowie verifizierte Malware- und Link-Urteile).
- Absicherung über `tools/risk-corpus.dev.cjs` und automatisierte Regressionsprüfungen in `test/follow-up.test.js`.

### 4. Dokumentations- und Versionsparität (AVN-016)
- `tools/docs-links.dev.cjs` validiert Release-Tag-Links, XPI-Download-URLs und Versionseinträge in allen Sprachfassungen (`docs/index_*.html`, `README.md`, `README.de.md`, `store_listing.md`, `reviewer_notes.md`).
- `scripts/pre-submit-checks.js` prüft die Konsistenz der Landing-Page-Links gegen `manifest.version`.
- Upgrade der GitHub Actions und Toolchain auf Node.js 24 LTS.

## Validierung

- Vollständige automatisierte Testsuite: **1.113 / 1.113 Tests bestanden** (`npm test`).
- Pre-submit Checks (`npm run check:source`), Web-Build (`npm run check:web`), Linter (`npm run lint:filtered`, **0 Fehler**) und reproduzierbarer Paketbau (`npm run package`) erfolgreich verifiziert.
- [Versionsgebundenes Prüfprotokoll](live_test_1_24_8.md).
- Der Tag-Workflow (`v1.24.8`) führt die vollständige CI einschließlich Browser-UI-Matrix (6 Sprachen) und nativer Linux-Thunderbird-Prüfung (Upgrade von `1.24.7`, Neustarts, Absturz-Recovery und Profilrestore) vor der Veröffentlichung aus.
