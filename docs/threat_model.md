# Bedrohungsmodell — Thundy AV (Thunderbird-WebExtension, MV3)

**Stand:** 2026-10-01 · **Version:** 1.6.5 · **Bezug:** [ROADMAP.md](ROADMAP.md) T2,
[PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md), [decisions.md](decisions.md)

Dieses Dokument beschreibt, was das Add-on schützt, wem man vertraut, was ein Angreifer versuchen könnte
und welche Maßnahmen (mit Fundstelle im Code) dagegen greifen. Es ist bewusst nüchtern: Wo etwas nicht
bewiesen ist, steht das dabei.

---

## 1. Schutzgüter

| Schutzgut | Warum es zählt |
|---|---|
| Vertraulichkeit der Nachricht | Der Nutzer öffnet private E-Mails; Inhalte dürfen den Rechner nur mit Zustimmung verlassen |
| Zustimmung und Kontrolle | Kein Scan, keine Übermittlung, keine Kosten ohne ausdrückliche Entscheidung |
| API-Schlüssel des Nutzers | Zugangsdaten zu quota-limitierten Diensten |
| Integrität des Add-ons | Ein kompromittiertes Add-on hätte weitreichenden Zugriff auf alle Nachrichten |
| Verfügbarkeit | Das Add-on darf Thunderbird nicht blockieren (große Nachrichten, viele Anhänge) |
| Integrität der Aussagen | Ein falsches „clean“ ist gefährlicher als „unbekannt“ |

## 2. Vertrauensgrenzen

```
Nutzer ──(Klick)──▶ Optionen/Popup ──(runtime.sendMessage)──▶ Hintergrundskript
Nachricht (fremd) ──▶ messages.* ──▶ Analyse ──▶ Anbieter-APIs (nur mit Zustimmung)
HTML-Anhang (fremd) ──▶ disarmHTML ──▶ lokale Datei (inert gespeichert)
```

- **Fremd und misstrauisch:** Nachrichteninhalte, Header, Anhänge, Links – alles kann vom Angreifer
  kontrolliert sein. Sie werden niemals ausgeführt, nur geparst.
- **Vertrauenswürdig:** der eigene Code (Popup, Optionen, Hintergrund, injizierte Skripte).
- **Bedingt vertrauenswürdig:** die Analyse-Anbieter – sie erhalten nur, was die Stufe erlaubt.

## 3. Angreifer und Szenarien

| # | Szenario | Maßnahme | Fundstelle |
|---|---|---|---|
| A1 | **Remote-Code über einen Anhang** (HTML mit `<script>`, `onerror`, `javascript:`-Links, mXSS über `<template>`/`<svg>`) | Aktive Tags entfernt, `on*`-Attribute gestrichen, gefährliche URI-Schemata (inkl. Kontrollzeichen-Tarnung) verworfen, Template-Inhalte rekursiv bearbeitet | `background.js` `disarmHTML()` |
| A2 | **Beaconing beim Öffnen der „entschärften“ Datei** (Tracking-Pixel, CSS-`@import`, `background:url(...)`) | Remote-Referenzen in Ressourcen-Attributen und CSS werden durch einen inerten Platzhalter ersetzt; der Originalpfad bleibt nur als `data-thundy-blocked-*` lesbar | `disarmHTML()`, `resourceAttributes`, `CSS_URL_REGEX` |
| A3 | **Datenabfluss ohne Zustimmung** | Ein zentrales Gate (`mayTransmitExternally()`/`assertExternalAnalysisAllowed()`) vor **jedem** Anbieteraufruf; das Popup prüft zusätzlich selbst | `background.js`, `api.js` |
| A4 | **Zugriff auf Anbieter ohne Berechtigung** | Host-Rechte ausschließlich optional; Prüfung vor jedem Aufruf (`HOST_PERMISSION_MISSING`) | `requireHostPermission()` |
| A5 | **Missbrauch der Nachrichten-Grenze** (fremde Kontexte, präparierte Payloads, unbekannte Aktionen) | Absenderprüfung (`sender.id`), Whitelist der Aktionen, Typprüfung der Nutzlast vor jedem Handler | `validateRequest()`, `MESSAGE_ACTIONS` |
| A6 | **Ressourcen-Erschöpfung** (riesige Anhänge, tausende Links, große Exporte, viele Meldungen) | Kappen: 25 Anhänge/Dossier, 100 IOC-Einträge, 50 Notification-Kontexte, 200 Hash-Cache-Einträge, 5 MB Exportlimit, MIME-Whitelist | Konstanten in `background.js`, `handleSaveResearchExport()` |
| A7 | **Abfluss eigener Zugangsdaten** (API-Key in Bericht/Log/Meldung) | Schlüssel erscheinen nur in Anfrage-Headern; Dossier/Export enthalten nur „konfiguriert: ja/nein“ – per Test abgesichert | `test/security-hardening.test.js` |
| A8 | **Tarnung des Absenders** (Spoofing, Look-alike-Domain, Punycode, Reply-To-Abweichung) | Auth-Auswertung, Levenshtein-Markenvergleich, Punycode-/Homoglyph-Erkennung, Reply-To-Abgleich; Ergebnis als **Hinweis**, nicht als Beweis | `parseAuthenticationResults()`, `analyseLinkAnatomy()`, `findBrandLookalike()` |
| A9 | **Nachträgliche Manipulation der Ergebnisse** | Ergebnisse liegen lokal in IndexedDB; das Dossier kennzeichnet die Herkunft (`computedLocally`, `stateSource: 'stored'`) | `buildResearchDossier()`, `readStoredScanRecord()` |
| A10 | **Unsichere Einbindung von Fremdcode** | Kein `eval`/`new Function`, kein Remote-Skript, CSP `script-src 'self'; object-src 'none'`, Injektionen nur mit gebündeltem Code | `manifest.json`, Pre-Submit-Check, `test/manifest.test.js` |

## 4. Bewusste Grenzen (Restrisiko)

1. **Die Analyse ist heuristisch.** Ein niedriger Score ist kein Beweis für Ungefährlichkeit; die
   Oberfläche formuliert das entsprechend („geprüft, keine Auffälligkeiten“ statt „sicher“).
2. **MITRE-Zuordnung ist heuristisch** und wird so gekennzeichnet (`confidence: 'heuristic'`).
3. **Links bleiben lesbar.** Beim Entschärfen werden `<a href>`-Ziele bewusst nicht entfernt (Analysewert);
   ein Klick führt die Navigation aus — die Datei ist „inert“, nicht „interaktionsfrei“.
4. **API-Schlüssel liegen unverschlüsselt** im Thunderbird-Profil (`browser.storage.local`). Das ist in
   der Datenschutzerklärung benannt; Schutz bieten die Profil-/Betriebssystem-Rechte.
5. **Anbieter sind Dritte.** Was einmal übertragen wurde, liegt außerhalb der Kontrolle des Add-ons
   (Retention/Weitergabe richten sich nach deren Bedingungen).
6. **Zustimmung kann nicht erzwungen werden** — das Add-on kann nur sicherstellen, dass es ohne sie
   nichts sendet.
7. **Kein Live-Test in Thunderbird 140 ESR** in der Entwicklungsumgebung: API-Verfügbarkeit ist statisch
   (Schemas) und über den eingebauten Selbsttest prüfbar, das visuelle Verhalten nicht.

## 5. Prüfungen, die diese Aussagen stützen

| Aussage | Nachweis |
|---|---|
| Aktive Inhalte werden entfernt (A1, A2) | `test/security-hardening.test.js`, `disarmHTML`-Suite in `background.test.js` |
| Keine Übermittlung ohne Zustimmung (A3) | `test/consent-and-tier.test.js`, Consent-Suiten in `background.test.js` |
| Keine Anbieteraufrufe ohne Host-Recht (A4) | Store-Readiness-Gates in `background.test.js` |
| Ungültige Nachrichten werden abgelehnt (A5) | Message-Boundary-Tests in `test/security-hardening.test.js` |
| Schranken greifen (A6) | `test/security-hardening.test.js`, Cache-Grenzen in `background.test.js` |
| Keine Schlüssel in Berichten (A7) | `test/security-hardening.test.js` |
| Kein Fremdcode, CSP intakt (A10) | `test/manifest.test.js`, Pre-Submit-Check, `web-ext lint` (0 Fehler) |

**Fazit:** Die Angriffsflächen sind benannt und durch Tests abgedeckt, soweit das ohne echte
Thunderbird-Instanz möglich ist. Die verbleibenden Risiken stehen in §4 und sind in der
Reviewer-Dokumentation sichtbar („no surprises“).

