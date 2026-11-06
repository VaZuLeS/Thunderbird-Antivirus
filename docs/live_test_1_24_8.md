# Prüfprotokoll 1.24.8 — Vorkommensidentität, Schutzprofile und Risikokorpus

Die folgenden konkreten Verhaltensfälle sind durch lokale Node-/DOM-Prüfungen der Produktfunktionen geprüft. Native Ergänzungen erfolgen im CI-Kandidatenlauf; Providerantworten in automatisierten Läufen bleiben synthetisch. Dieses Protokoll allein ist keine Live-Anbieterabnahme. [Umfang und paketgebundene Evidenz](VEROEFFENTLICHUNG_1_24_8.md).

| ID | Prüffall | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| T01 | Inhaltsbasierte Schlüsselableitung (`deriveMessageContentKey`, `resolveMessageStorageKey`) in `db.js` | OK | `test/cache-lifecycle.test.js`, `db.test.js` |
| T02 | Schlüsselauflösung über Hintergrund- und Analysekontexte (`getMessageAnalysisContext`, `collectAttachmentFindings`, `collectLinkFindings`) | OK | `test/cache-lifecycle.test.js`, `background.test.js` |
| T03 | Schutzprofil-Schema-Validierung gegen JSON-Schema-Draft-2020 (`local-protection-profile-v1.json`) | OK | `test/follow-up.test.js` |
| T04 | Schutzprofil-Vorbereitung und Commit mit Live-Differenzvorschau (`prepare`, `commit`) in `options.js` | OK | `test/follow-up.test.js`, `options.test.js` |
| T05 | Erkennung von Profilkollisionen und Schreibkonflikten (`PROFILE_CHANGED`, Quota-Behandlung) | OK | `test/follow-up.test.js` |
| T06 | Synthetischer Risikokorpus mit PSL- und Subdomain-Separation (`tools/risk-corpus.dev.cjs`) | OK | `test/follow-up.test.js` |
| T07 | Benigne Kontrollfälle für bekannte Marken und offizielle Subdomains (`risk-behavior.json`) | OK | `test/follow-up.test.js`, `api.test.js` |
| T08 | Absender- und Link-Typosquatting-Erkennung sowie Mismatch-Bewertung | OK | `test/follow-up.test.js`, `api.test.js` |
| T09 | Anhang- und Link-Befunde fließen verifiziert mit passenden Gründen in Risikobewertung ein | OK | `test/follow-up.test.js`, `test/report-lifecycle.test.js` |
| T10 | Versionsparität über Dokumentation, Release-Links, Download-URLs und Store-Listings | OK | `tools/docs-links.dev.cjs`, `scripts/pre-submit-checks.js` |
| T11 | Sechssprachige Lokalisierung (DE, EN, ES, FR, IT, PL) und Fallback-Synchronität (`i18n.js`) | OK | `npm run check:i18n`, `test/i18n.test.js` |
| T12 | Reproduzierbares XPI-Paket und Allowlist-Verifikation (`verify-package.js`) | OK | `npm run package` |
| T13 | Statische Quell-, Design-, Vendor- und Dokumentationsprüfungen | OK | `npm run check:source`, `npm run check:web` |
| T14 | Node 24 LTS Runtime- und Toolchain-Kompatibilität | OK | `package.json`, `.github/workflows/ci.yml` |

**Summe:** 14 OK / 0 FAIL / 0 N/A / 0 OFFEN
