# Live-Abnahme 1.24.0 — Analyse-Protokoll und CI-Läufe

Status: Der CI-anteilige Live-Umfang ist mit **realem Thunderbird 140 ESR** ausgeführt
([CI 38983009136](https://github.com/VaZuLeS/Thunderbird-Antivirus/actions/runs/38983009136),
Job „Thunderbird Linux GUI", Runner `tools/thunderbird-live.dev.py`, Artefakt
`thunderbird-linux-live`: Report `report.json` + Screenshots je Lauf). **Offen bleiben die
Schritte, die einen Hybrid-Analysis-API-Schlüssel bzw. interaktive Zustimmungs- und
Netzwerkbeobachtung brauchen** — diese führt der Maintainer mit
[live_test_protocol.md](live_test_protocol.md) (Version 1.24.0) aus; erst danach meldet
`npm run store-gate` GO (Kriterium C6).

## 1. Im CI mit realem Thunderbird belegt (automatisiert, reproduzierbar)

| Prüfung | Nachweis im Runner-Report (`report.json` des Artefakts) |
|---|---|
| Frischinstallation 1.24.0 aus dem XPI (EN) | `extensionVersion` = 1.24.0; `previousInstallation` im Upgrade-Lauf |
| Upgrade 1.22.0 → 1.24.0 mit erhaltener Konfiguration | `upgrade.statePreserved = true` (vorgängige Installation des gepinnten 1.22.0-XPI mit SHA-256-Prüfung) |
| Sprachpakete und UI-Sprache je Locale (EN/DE/FR/ES/IT/PL) | `appLocale`, `uiLanguage` je Lauf; Langpack-SHA-256 |
| Einrichtungsassistent, sechs Sprachen, Abschluss speichert | `wizardVersion`, `wizardLanguages`, `wizardSaved` |
| Banner-Injektion in die Nachrichtenansicht + Time-of-Click-Marker | `documentElement.dataset.thundyClickProtection === "true"` (wait_for-Schritt im Runner) |
| Linkdialog: zwei Buttons, Fokus, URL unverändert, Markenname, Abbruch | `linkDialog` (Breite ≥ 500 px, `url` = Test-URL, Fokus auf Abbrechen) |
| OS-Übergabe ohne URL-Veränderung; Negativfall ohne zusätzliche Zustellung | `osHandoff` = `{'argv': [URL]}`, `blockedOsDispatch` |
| Audit-Eintrag mit damaligem Score/Verdict; Sichtprüfung im Audit | `auditRecord`, `openedAuditRecord`, `blockedOsAuditRecord` |
| Natives Popup in der Client-Sprache | `nativePopup` |
| Hell-/Dunkel-Themes, Akzent und Dichte im realen Client | `appearanceSaved`, `nativeThemes` |
| Lokalisierte Add-on-Seiten je Sprache | `localizedPages` |
| Wiederherstellung nach erzwungenem Prozessabbruch; Neustart-Prüfung | `--restart-check --crash-check`-Läufe je Sprache |
| Protokoll 9.13: Banner-Dedup beim Nachrichtenwechsel (keine Doppel-Banner) | `bannerDedup` (zwei Wechsel, Bannerzahl je Nachricht identisch, ≤ 1 pro Banner-Typ) |
| Protokoll 9.12: „Cache leeren“ mit Bestätigungsdialog leert den Objektspeicher, Einstellungen/Zustimmung bleiben | `cacheClear` (Bestätigungs-Stub, Statusmeldung `ui_082` je Sprache, Store-Count = 0, `externalAnalysisConsent` unverändert) |

## 2. Offen für den Maintainer (manuell, mit Hybrid-Analysis-API-Schlüssel)

Schritte aus [live_test_protocol.md](live_test_protocol.md) §9, die ohne Schlüssel/GUI-Interaktion
nicht belegbar sind — darunter:

- 9.6/9.8: Consent-Gesten, `permissions.request` aus dem Banner, Scan fortsetzen/verweigern.
- 9.9: Stufen-Gate mit echten Provider-Aufrufen (`balanced`/`max`, vollständige URL bei `max`).
- 9.11: Entzug der Host-Berechtigung → `HOST_PERMISSION_MISSING`.
- **9.14 (neu): Analyse-Protokoll live** — Upload → Karte „Analyse läuft noch (IN_PROGRESS)" mit
  automatischem Nachfragen (alle 5 s, max. 3 Versuche) → fertiges Protokoll mit Job-/Submission-ID
  und Abrufzeitpunkt; Popup schließen/öffnen → Protokoll wird **offline** angezeigt; Rescan leert
  das alte Protokoll und startet neu.
- Ergänzend 9.3 und 9.10 (Absenderfreigabe, HTML-Entschärfung) als interaktive Sichtprüfungen.
  9.12 und 9.13 sind inzwischen im CI belegt (siehe §1).

Erst wenn diese Schritte mit Ist-Werten und Status (OK/N/A) im Protokoll stehen, ist Kriterium C6
erfüllt und der Store-Gate meldet GO.
