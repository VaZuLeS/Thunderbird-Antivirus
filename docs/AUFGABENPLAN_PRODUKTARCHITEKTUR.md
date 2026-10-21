# Thundy AV — Evidenzbasierte Produktarchitektur-Analyse & Priorisierter Aufgabenplan

**Rolle:** Technischer Produktarchitekt & Thunderbird-Extension-Entwickler
**Projekt:** Thundy AV (Email Scanner & Link Protection für Mozilla Thunderbird, Manifest V3)
**Stand Quellcode & Repository:** Extension Version 1.23.0 (Commit `df63c76` / GitHub Release `v1.23.0`)
**Datum:** 16. Oktober 2026

---

## 1. Kompakte Bestandsaufnahme (Tatsächlicher Entwicklungs- und Abnahmestand)

Die Untersuchung von Quellcode, Architektur, Testsuiten (953 automatisierte Tests), Skripten, CI-Workflows (`docs/ci/`), Dokumentation und GitHub Releases ergibt ein klares, evidenzbasiertes Bild des aktuellen Systemstands.

### 1.1 Differenzierte Reifegrad-Klassifizierung

| Reifegrad | Beschreibung & Abgrenzung | Evidenz & Nachweise im Repository |
|---|---|---|
| **1. Implementiert und nachgewiesen** | Vollständig im Code umgesetzt, durch 953 automatisierte Node.js/JSDOM-Tests abgedeckt und in realer Thunderbird-Linux-Xvfb-Umgebung nachgewiesen. | • **Extension-Kern 1.23.0:** `manifest.json` (MV3, Add-on ID `thundy-av@bludau-it-services.de`), `background.js`, `api.js`, `providers.js`, `link_audit.js`, `risk.js`, `sanitize.js`.<br>• **6 Sprachen vollständig:** EN, DE, FR, ES, IT, PL in `_locales/` & `i18n.js` (`check:i18n` im Gate).<br>• **Link-Schutz & Audit:** Injektion (`message_ui.js`), Audit-Persistence (`link_audit.js`, `db.js`), Sechssprachiges Audit-Dashboard (`audit.html`, `audit.js`).<br>• **UI & Design-System:** Modernes CSS (`design.css`, `design_components.css`, `theme.css`), Theme-Umschaltung (`theme.js`), Informationsdichte, Barrierefreiheit/Focus-Trap.<br>• **Reale Linux-Live-Abnahme:** Thunderbird 140.17.0 ESR unter Xvfb (`docs/THUNDERBIRD_LINUX_ABNAHME.md`, `audits/thunderbird-140-repeat.json`), 6 Sprachprofile, 2 Neustarts, Prozessabbruch-Recovery.<br>• **Release v1.23.0:** GitHub Release `v1.23.0` mit Asset `thundy-av-1.23.0.xpi` (SHA-256 `00ab882d7e90bda5b97850b6076afda9b9403f75ee1b593f97782830cd3e6234`). |
| **2. Implementiert, aber unzureichend geprüft** | Funktionalitäten sind vollständig im Quellcode vorhanden und synthetisch getestet, wurden aber noch nicht in echten Ziel-Betriebssystemen oder Spezial-Hardware verifiziert. | • **Screenreader-Bedienung:** ARIA-Rollen, `aria-live`, Focus-Traps sind eingebaut (`message_ui.js`, `audit.html`), aber echte Screenreader-Tests (NVDA/JAWS/Orca/VoiceOver) fehlen ✋.<br>• **DPI-/Skalierungs-Matrix:** Multi-Monitore mit 125%/150%/200% Zoom synthetisch simuliert (`UI_BROWSERPRUEFUNG.md`), aber keine echte OS-HighDPI-Prüfung ✋.<br>• **Browserübergabe:** `handleOpenCheckedLink` ruft `windows.openDefaultBrowser` bzw. `downloads.open` auf; Isolation geprüft, aber reale Handoff-Tests mit Chrome/Edge/Safari auf Ziel-OS stehen aus ✋. |
| **3. Teilweise umgesetzt** | Grundlegende Datenstrukturen und Logiken sind vorhanden, aber wesentliche Verarbeitungs- oder Rückmeldeschleifen fehlen noch. | • **ATN Store-Integration:** Submission-Gate `npm run store-gate` meldet GO (C1–C7 PASS), `store_listing.md` und Assets vorbereitet, aber ATN-Signierung und Einreichung bei `addons.thunderbird.net` stehen wegen Maintainer-Schlüsseln aus ✋.<br>• **Store-Asset Motiv 7:** Screenshot mit echtem Threat-Banner-Befund im Thunderbird-Fenster fehlt noch als physische Aufnahme ✋.<br>• **Automatic Update & Rollback:** Update-Manifest und ATN-Channel konfiguriert; echtes Update-Verhalten mit Profil-Rollback unter Thunderbird ESR noch nicht live verifiziert ✋. |
| **4. Konzeptionell vorbereitet** | Architektur, Datenmodelle, CLI-Tools und Contract-Tests existieren offline im Repository, sind aber bewusst deaktiviert oder unvollständig an die Extension-Runtime gebunden. | • **Enterprise-Service (N01–N05, N07–N18):** In `enterprise/` vollständig als Node.js-Klassen & CLI implementiert (JCS/Ed25519-Evidenzen, Outbox, Policy-State, Incident-Cases, Heartbeats, Capacity-Alerts, SIEM-Queue).<br>• **Unternehmensprofile:** `enterprise_profiles.js` & `enterprise_setup.html` erlauben das Erstellen von Inactive-Draft-Profilen in den Einstellungen, greifen aber nicht aktiv in den Live-Traffic ein (Opt-in / Deaktiviert als Standard). |
| **5. Offen / Durch Voraussetzungen blockiert** | Aufgaben, die zwingend externe Produktiv-Zugänge, Cloud-Infrastruktur oder Herstellersignaturen benötigen und in einer isolierten Dev-Umgebung nicht ausgeführt werden können. | • **ATN Signierung & Store-URL (A-03, A-04, A-05):** Benötigt AMO/ATN-API-Credentials des Maintainers.<br>• **Windows & macOS Live-Abnahme (A-16, A-17):** Benötigt physische Windows 11 / macOS Testgeräte mit Thunderbird ESR.<br>• **Enterprise N06 Produktivbetrieb (EN-01 bis EN-04):** Benötigt reale Cloud-Mandanten (AWS S3/Azure Blob/GCP), KMS, IdP (OIDC/SAML) und Unternehmensflotte. |

---

## 2. Dynamische Themenlandkarte (Substantiierte Gruppierung)

Die Befunde aus Codebase und Dokumentation werden in 8 primäre Themenbereiche strukturiert. Jedes Potenzial erhält Schlüsselwörter sowie die Klassifizierung in **Optimierung**, **Verbesserung** oder **Erweiterung**.

```
                         THUNDY AV THEMENLANDKARTE
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 1. Schutzwirkung, Score & Analysequalität (ANALYSIS)                  │
 │ 2. Link-Schutz, Audit & Nutzerentscheidungs-Lifecycle (AUDIT)          │
 │ 3. Bedienung, Designsystem, Themes & Barrierefreiheit (UX_A11Y)       │
 │ 4. Mehrsprachigkeit & i18n-Konsistenz (I18N)                          │
 │ 5. Systemeinrichtung, Richtlinien & Enterprise-Profile (POLICY)       │
 │ 6. Performance, Speicher & Prozessfestigkeit (PERF_RECOVERY)          │
 │ 7. Plattformkompatibilität, OS-Integration & Verteilung (PLATFORM)    │
 │ 8. Unternehmensverwaltung, Evidenzketten & SIEM (ENTERPRISE)          │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Verbindliche Produktanforderungen & Leitplanken

Aus den technischen Spezifikationen und Fachvorgaben leiten sich folgende verbindliche Systemanforderungen ab:

1. **Vollständige Mehrsprachigkeit:** Die sechs Sprachen Englisch (en), Deutsch (de), Französisch (fr), Spanisch (es), Italienisch (it) und Polnisch (pl) sind in allen Benutzeroberflächen, Hinweisen, Dialogen, Audit-Logs und Exporten zu 100 % gleichwertig mitzuliefern.
2. **Einheitliches modernes Designsystem:** Eigene Add-on-Seiten (`options.html`, `audit.html`, `onboarding.html`, `enterprise_setup.html`) nutzen gemeinsame CSS-Variablen (`theme.css`, `design.css`, `design_components.css`) und ein modulares Komponentensystem (`design_system.js`).
3. **Thunderbird-Theme & A11y-Integration:** Automatische Anpassung an helle/dunkle OS-/Thunderbird-Themes, konfigurierbare Informationsdichte (kompakt vs. komfortabel), vollständige Tastaturbedienbarkeit (Tab-Order, Focus-Trap) sowie Screenreader-Semantik.
4. **Optionale externe Dienste:** Externe Bedrohungsanalysen (Hybrid Analysis, VirusTotal, urlscan.io, URLhaus, AbuseIPDB) und Enterprise-Integrationen bleiben strikt Opt-in. Das Add-on funktioniert vollständig autark ohne externe Netzwerkaufrufe.
5. **Transparente Unterscheidung von Betriebsmodi:** Lokale Heuristik, Konfigurationsprofile und produktive Cloud-/Enterprise-Dienste werden im UI und in den Datenmodellen unmissverständlich voneinander abgegrenzt (z. B. Entwurfs-Status `DRAFT`/`INACTIVE`).
6. **Nachvollziehbarer Entscheidungsstand:** Jede Linkprüfung speichert die vollständige Ziel-URL, den lokalen Bedrohungsscore (0–100), den Prüfstand (lokal / Provider-Verdacht), den Zeitpunkt der Entscheidung sowie den exakten Entscheidungs-Snapshot.
7. **Präzise `OPENED`-Semantik:** Der Status `OPENED` dokumentiert ausschließlich, dass Thunderbird die Übergabeaufforderung an die System-Schnittstelle (`windows.openDefaultBrowser` / `downloads.open`) fehlerfrei übergeben hat. Er bestätigt **nicht**, dass der externe Browser erfolgreich gestartet wurde oder die Webseite geladen wurde.
8. **Strikte `PENDING`-Invariante:** Bei einem Prozessverlust, Browser-Absturz oder System-Reboot verbleiben unbestätigte Vorgänge dauerhaft im Status `PENDING`. Sie dürfen **niemals** nachträglich als bestätigte Nutzerentscheidung umgedeutet werden.
9. **Datenkonservierung bei Upgrades:** Bestehende Audit-Logs, Benutzerentscheidungen, Scan-Caches und Konfigurationen müssen bei Version-Upgrades (z. B. 1.22.0 → 1.23.0) unversehrt erhalten bleiben.

---

## 4. Priorisierungsmatrix & Bewertungsmodell

Jedes Arbeitspaket wird anhand von 6 Kriterien bewertet:
- **Nutzen:** Mehrwert für Endanwender oder Enterprise-Admins.
- **Zuverlässigkeit & Schutzwirkung:** Verminderung von Sicherheitsrisiken und Fehlentscheidungen.
- **Häufigkeit & Reichweite:** Anteil der betroffenen Nutzer/Systeme.
- **Aufwand & Risiko:** Komplexität und Regressionsgefahr.
- **Abhängigkeiten:** Voraussetzungen und Blocker.
- **Evidenzstärke:** Fundierung durch konkrete Repositoriumsbefunde.

---

## 5. Priorisierter Concrete Aufgabenplan

### 5.1 Übersicht aller Arbeitspakete

| Aufgaben-ID | Themenbereich | Typ | Kurztitel | Prio | Aufwand | Blocker / Voraussetzungen |
|---|---|---|---|---|---|---|
| **PLATFORM-01** | Plattform & Release | Optimierung | ATN Store-Signierung & Einreichung v1.23.0 | **P1 (Kritisch)** | S (1–2 h) | ✋ Credentials des Maintainers |
| **PLATFORM-02** | Plattform & OS | Verbesserung | Windows 11 & macOS Live-Abnahme in TB 140 ESR | **P1 (Kritisch)** | M (4–8 h) | ✋ Windows / macOS Testgeräte |
| **UX_A11Y-01** | UX & A11y | Verbesserung | Screenreader-Validierung (NVDA/Orca/VoiceOver) | **P1 (Kritisch)** | S (2–4 h) | ✋ OS-Screenreader-Umgebung |
| **AUDIT-01** | Audit & Lifecycle | Optimierung | `PENDING`-Recovery & Re-Engagement nach Crash | **P2 (Hoch)** | M (4–6 h) | keine (rein lokal ausführbar) |
| **PLATFORM-03** | Plattform & Deploy | Verbesserung | Echte Standardbrowser-Handoff-Verifikation | **P2 (Hoch)** | M (4–6 h) | ✋ Multi-Browser OS-Testbed |
| **PLATFORM-04** | Plattform & Deploy | Optimierung | Automatische Update- & Rollback-Prüfung | **P2 (Hoch)** | M (4–6 h) | ✋ ATN Release-Channel |
| **ANALYSIS-01** | Schutzwirkung | Optimierung | Resilienz & Circuit-Breaker für Provider-APIs | **P2 (Hoch)** | M (4–6 h) | keine (rein lokal ausführbar) |
| **UX_A11Y-02** | UX & Design | Verbesserung | Threat-Banner Screenshot-Aufnahme (Motiv 7) | **P2 (Hoch)** | S (1–2 h) | ✋ TB Live-GUI mit Test-Payload |
| **I18N-01** | Mehrsprachigkeit | Verbesserung | Dynamische Pluralisierung & Datumsformatierung | **P3 (Mittel)** | S (2–3 h) | keine (rein lokal ausführbar) |
| **PERF_RECOVERY-01**| Performance | Optimierung | IndexedDB Audit-Log Migration & Pruning | **P3 (Mittel)** | M (6–8 h) | keine (rein lokal ausführbar) |
| **ENTERPRISE-01** | Enterprise | Erweiterung | N06 Produktive Cloud- & Identity-Freigaben | **P4 (Später)** | XL (40+ h) | ✋ Corporate Cloud/IdP Tenant |

---

### 5.2 Detaillierte Arbeitspakete (Spezifikation)

#### Paket 1: PLATFORM-01 — ATN Store-Signierung & Einreichung Version 1.23.0
- **Themenbereich:** Installation, Updates & Veröffentlichung
- **Entwicklungstyp:** Optimierung
- **Befund & Beleg:** Submission-Gate `npm run store-gate` liefert Status **GO** (C1–C7 PASS). Das unsignierte XPI `thundy-av-1.23.0.xpi` ist im GitHub Release veröffentlicht (`docs/STATUS.md`). ATN kennt die Add-on-ID `thundy-av@bludau-it-services.de` noch nicht (Status 404).
- **Gewünschtes Ergebnis & Nutzwert:** Offizielle Veröffentlichung und ATN-Signierung im Thunderbird Add-ons Store, damit Nutzer die Extension ohne Developer-Override installieren können.
- **Abgegrenzter Umfang:** Ausführen von `web-ext sign` über den ATN-Kanal, Hochladen des XPI und Ausfüllen der Store-Formulare gemäß `docs/store_listing.md`.
- **Priorität & Aufwand:** **P1 (Kritisch)** | Aufwandsklasse **S** (approx. 1–2 h).
- **Abhängigkeiten / Blocker:** ✋ Blockiert durch fehlende AMO/ATN-API-Keys (Maintainer-Zugang erforderlich).
- **Akzeptanzkriterien:**
  1. `web-ext sign` liefert ein von Mozilla/Thunderbird digital signiertes `.xpi`.
  2. Das Add-on ist unter `https://addons.thunderbird.net/...` gelistet und durchsuchbar.
  3. Die Store-URL ist in `README.md`, `README.de.md` und `docs/store_listing.md` eingetragen.
- **Validierung & Testumgebung:** Echte ATN-API-Verbindung und anschließende Installation in unmodifiziertem Thunderbird ESR.

---

#### Paket 2: PLATFORM-02 — Windows 11 & macOS Live-Abnahme in Thunderbird 140 ESR
- **Themenbereich:** Plattformkompatibilität & Wiederherstellung
- **Entwicklungstyp:** Verbesserung
- **Befund & Beleg:** Die Live-Abnahme für Thunderbird 140.17.0 ESR wurde erfolgreich unter Linux Xvfb durchgeführt (`docs/THUNDERBIRD_LINUX_ABNAHME.md`). Ein systematischer Testnachweis unter Windows 11 und macOS Sequoia fehlt im Repository.
- **Gewünschtes Ergebnis & Nutzwert:** Nachweis der plattformübergreifenden Lauffähigkeit, korrekten UI-Darstellung und OS-Schnittstellenintegration unter Windows und macOS.
- **Abgegrenzter Umfang:** Installation des XPI in Thunderbird 140 ESR unter Windows 11 und macOS, Durchlauf aller 25 Abnahmeschritte (Wizard, Linkschutz, Popup, Settings, Dark-Theme) und Erstellung von Protokollen.
- **Priorität & Aufwand:** **P1 (Kritisch)** | Aufwandsklasse **M** (approx. 4–8 h).
- **Abhängigkeiten / Blocker:** ✋ Blockiert durch Verfügbarkeit von Windows- und macOS-Testsystemen.
- **Akzeptanzkriterien:**
  1. Der Linkschutz fängt Klicks auf allen Betriebssystemen zuverlässig ab.
  2. Schriftgrößen, HighDPI-Skalierung und Popups rendern ohne Layout-Brüche.
  3. Das Abnahmedokument `docs/THUNDERBIRD_OS_ABNAHME.md` ist mit Screenshots dokumentiert.
- **Validierung & Testumgebung:** Manuelle Tests auf physischen/virtuellen Windows 11- und macOS-Instanzen mit Thunderbird ESR.

---

#### Paket 3: UX_A11Y-01 — Screenreader-Validierung (NVDA, Orca, VoiceOver)
- **Themenbereich:** Bedienung, Informationsdarstellung & Barrierefreiheit
- **Entwicklungstyp:** Verbesserung
- **Befund & Beleg:** HTML-Seiten und Injektions-Dialoge enthalten ARIA-Attribute (`role="dialog"`, `aria-live="polite"`, `aria-describedby`) und Focus-Traps (`message_ui.js`). Der tatsächliche Sprachausgabe-Fluss wurde jedoch noch nicht mit aktiven Assistenztechnologien geprüft.
- **Gewünschtes Ergebnis & Nutzwert:** Barrierefreie Nutzbarkeit für sehbehinderte Anwender gemäß WCAG 2.1 AA Kriterien.
- **Abgegrenzter Umfang:** Testen des Interzeptions-Dialogs, der Popup-Analyse und der Optionsseiten mit NVDA (Windows), Orca (Linux) und VoiceOver (macOS).
- **Priorität & Aufwand:** **P1 (Kritisch)** | Aufwandsklasse **S** (approx. 2–4 h).
- **Abhängigkeiten / Blocker:** ✋ Blockiert durch Testumgebung mit installierten Assistenzsystemen.
- **Akzeptanzkriterien:**
  1. Wenn der Link-Warn-Dialog erscheint, liest der Screenreader den Dialog-Titel, die Risiko-Warnung und das Ziel unmittelbar vor.
  2. Der Tastatur-Fokus bleibt im Modal gefangen und springt primär auf die sichere Aktion ("Abbrechen").
  3. Dynamische Statusmeldungen werden via `role="status"` zuverlässig angesagt.
- **Validierung & Testumgebung:** Interaktive Prüfung mit Tastatur und Screenreader.

---

#### Paket 4: AUDIT-01 — Robustheit der `PENDING`-Anfragen & Crash-Recovery
- **Themenbereich:** Performance, Speicher & Hintergrundverarbeitung / Linkentscheidungen
- **Entwicklungstyp:** Optimierung
- **Befund & Beleg:** In `link_audit.js` wird ein Link-Check mit Status `PENDING` angelegt. Bei einem abrupten Thunderbird-Beenden oder Prozessabsturz bleibt der Datensatz im Speicher als `PENDING` stehen.
- **Gewünschtes Ergebnis & Nutzwert:** Vermeidung unklarer Schwebezustände im Audit-Log nach unerwartetem Beenden.
- **Abgegrenzter Umfang:** Beim Extension-Start (`runtime.js` / `background.js`) wird ein Einmal-Scan ausgeführt: Datensätze im Status `PENDING`, deren Zeitstempel älter als 5 Minuten ist, werden explizit mit `outcome: 'ABORTED'`, `cancelReason: 'process_loss'` markiert. Sie werden **nicht** als erfolgreich geöffnet umgedeutet.
- **Priorität & Aufwand:** **P2 (Hoch)** | Aufwandsklasse **M** (approx. 4–6 h).
- **Abhängigkeiten / Blocker:** Keine (vollständig im lokalen Code umsetzbar).
- **Akzeptanzkriterien:**
  1. Nach einem Neustart geplante Alt-Einträge wechseln von `PENDING` zu `ABORTED` mit Grund `process_loss`.
  2. Kein `PENDING`-Eintrag wird fälschlicherweise als `OPENED` deklariert.
  3. Unit-Tests in `background.test.js` bestätigen das Bereinigungsverhalten.
- **Validierung & Testumgebung:** Synthetische Testsuite (`npm test`) mit simuliertem Speicherzustand.

---

#### Paket 5: PLATFORM-03 — Verifikation der Standardbrowser-Übergabe (`OPENED`-Semantik)
- **Themenbereich:** Plattformkompatibilität & Linkentscheidungen
- **Entwicklungstyp:** Verbesserung
- **Befund & Beleg:** `handleOpenCheckedLink` in `message_ui.js` ruft `windows.openDefaultBrowser` bzw. `downloads.open` auf. Die Entkopplung wurde in Linux Xvfb mit einem Dummy-Empfänger geprüft.
- **Gewünschtes Ergebnis & Nutzwert:** Sicherstellen, dass die Übergabe an reale Standardbrowser (Firefox, Chrome, Edge) auf allen Betriebssystemen fehlerfrei funktioniert und Fehlschläge als `OPEN_ERROR` protokolliert werden.
- **Abgegrenzter Umfang:** Testen von Sonderzeichen, Anker-URLs, langen Parametern und Fehlschlägen der OS-Übergabe.
- **Priorität & Aufwand:** **P2 (Hoch)** | Aufwandsklasse **M** (approx. 4–6 h).
- **Abhängigkeiten / Blocker:** ✋ Multi-Browser OS-Testumgebung.
- **Akzeptanzkriterien:**
  1. Wenn die OS-Schnittstelle einen Fehler zurückgibt, speichert das Audit `OPEN_ERROR` und der Dialog zeigt einen Retry-Button.
  2. Bei erfolgreicher Übergabe speichert das Audit `OPENED` (Bedeutung: Übergabe an OS akzeptiert).
- **Validierung & Testumgebung:** Manuelle OS-Browser-Tests.

---

#### Paket 6: PLATFORM-04 — Verifikation von automatischen Updates & Rollbacks
- **Themenbereich:** Installation, Updates, Rollback & Veröffentlichung
- **Entwicklungstyp:** Optimierung
- **Befund & Beleg:** Die Dauerhaftigkeit von Upgrades (1.22.0 → 1.23.0) wurde manuell nachgewiesen (`THUNDERBIRD_LINUX_ABNAHME.md`). Der automatische Hintergrund-Update-Mechanismus über ATN/Update-Manifest steht noch aus.
- **Gewünschtes Ergebnis & Nutzwert:** Reibungslose automatische Aktualisierung für Endanwender ohne Datenverlust oder erneute Einrichtungsaufforderung.
- **Abgegrenzter Umfang:** Bereitstellen einer Test-Version (z. B. 1.23.1-test) über einen lokalen Update-Server, Prüfung der Hintergrund-Aktualisierung in Thunderbird.
- **Priorität & Aufwand:** **P2 (Hoch)** | Aufwandsklasse **M** (approx. 4–6 h).
- **Abhängigkeiten / Blocker:** ✋ Signierter Update-Channel oder Test-Update-Server.
- **Akzeptanzkriterien:**
  1. Thunderbird erkennt das Update im Hintergrund und wendet es beim nächsten Neustart an.
  2. Vorhandene Audit-Logs, Einstellungen und Freigaben bleiben 100 % erhalten.
- **Validierung & Testumgebung:** Thunderbird Profil-Update-Test.

---

#### Paket 7: ANALYSIS-01 — Resilienz & Circuit-Breaker für externe Provider-APIs
- **Themenbereich:** Schutzwirkung & Analysequalität / Performance
- **Entwicklungstyp:** Optimierung
- **Befund & Beleg:** `api_gateway.js` verarbeitet API-Aufrufe mit Timeouts und Retry-After-Headern. Wenn ein Anbieter (z. B. urlscan.io) anhaltend 5xx-Fehler liefert, werden weiterhin Anfragen gesendet.
- **Gewünschtes Ergebnis & Nutzwert:** Vermeidung unnötiger Netzwerk-Timeouts und Schutz der Anwender vor hängenden Link-Dialogen bei Anbieterausfällen.
- **Abgegrenzter Umfang:** Implementierung eines einfachen Circuit-Breakers in `api_gateway.js`: Nach 3 aufeinanderfolgenden Netzwerk-/Serverfehlern wird der jeweilige Anbieter für 5 Minuten pausiert (`CIRCUIT_OPEN`) und Anfragen liefern sofort `UNKNOWN`.
- **Priorität & Aufwand:** **P2 (Hoch)** | Aufwandsklasse **M** (approx. 4–6 h).
- **Abhängigkeiten / Blocker:** Keine (vollständig lokal umsetzbar).
- **Akzeptanzkriterien:**
  1. Anfallende Fehler schalten den Circuit-Breaker vorübergehend stumm.
  2. Nach Ablauf des Cooldowns wird eine Testanfrage zugelassen (`HALF_OPEN`).
  3. `api_gateway.test.js` deckt das Circuit-Breaker-Verhalten ab.
- **Validierung & Testumgebung:** Automated Unit Tests in `api_gateway.test.js`.

---

#### Paket 8: UX_A11Y-02 — Erstellung des Threat-Banner Screenshots (Store-Asset Motiv 7)
- **Themenbereich:** Bedienung, Informationsdarstellung & Store-Assets
- **Entwicklungstyp:** Verbesserung
- **Befund & Beleg:** `docs/store_assets.md` dokumentiert 23 echte Screenshots. Motiv 7 (Echtzeit-Threat-Banner im Thunderbird-Nachrichtenfenster bei einer verdächtigen E-Mail) fehlt noch als reales PNG.
- **Gewünschtes Ergebnis & Nutzwert:** Vollständigkeit aller 7 Store-Listing-Motive gemäß Mozilla-Store-Richtlinien.
- **Abgegrenzter Umfang:** Erzeugen einer Test-Nachricht mit hohem Bedrohungsscore in Thunderbird 140 ESR, Aufnehmen des Screenshots in 1280 × 1000 px und Speichern unter `docs/screenshots/threat-banner.png`.
- **Priorität & Aufwand:** **P2 (Hoch)** | Aufwandsklasse **S** (approx. 1–2 h).
- **Abhängigkeiten / Blocker:** ✋ Thunderbird Live-GUI mit Test-Payload.
- **Akzeptanzkriterien:**
  1. PNG ist mindestens 1200 px breit und zeigt das rote Threat-Banner im Thunderbird-Fenster.
  2. `npm run store-gate` listet Motiv 7 als vorhanden auf.
- **Validierung & Testumgebung:** Live-Screenshot in Thunderbird.

---

#### Paket 9: I18N-01 — Dynamische Pluralisierung & Datumsformatierung in Audit-Logs
- **Themenbereich:** Mehrsprachigkeit
- **Entwicklungstyp:** Verbesserung
- **Befund & Beleg:** Datumsangaben und Zeitspannen ("vor X Tagen") in `audit.js` nutzen teilweise feste Zeichenketten.
- **Gewünschtes Ergebnis & Nutzwert:** Perfekte sprachliche Passgenauigkeit in allen 6 Sprachen unter Nutzung nativer Browser-APIs (`Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`).
- **Abgegrenzter Umfang:** Ersetzen eigener Formatierer in `audit.js` durch `Intl`-APIs mit der aktiven Add-on-Sprache (`i18n.getLanguage()`).
- **Priorität & Aufwand:** **P3 (Mittel)** | Aufwandsklasse **S** (approx. 2–3 h).
- **Abhängigkeiten / Blocker:** Keine.
- **Akzeptanzkriterien:**
  1. Datums- und Zeitangaben passen sich nahtlos an en, de, fr, es, it, pl an.
  2. Unit-Tests in `test/i18n.test.js` bestätigen die korrekte Ausgabe.
- **Validierung & Testumgebung:** Automated Tests (`npm test`).

---

#### Paket 10: PERF_RECOVERY-01 — IndexedDB Migration & Pruning für Audit-Logs
- **Themenbereich:** Performance, Speicher & Hintergrundverarbeitung
- **Entwicklungstyp:** Optimierung
- **Befund & Beleg:** `link_audit.js` speichert bis zu 2.000 Einträge bzw. 2 MB in `browser.storage.local`. Bei intensiver Nutzung kann das Parsen und Schreiben des gesamten JSON-Arrays Performance-Overhead erzeugen.
- **Gewünschtes Ergebnis & Nutzwert:** Skalierbare, performante Speicherung auch bei vielen Interaktionen ohne Blockieren des Event-Loops.
- **Abgegrenzter Umfang:** Evaluieren einer optionalen IndexedDB-Ablage für Audit-Einträge mit automatischem Pruning älterer Datensätze (> 30 Tage).
- **Priorität & Aufwand:** **P3 (Mittel)** | Aufwandsklasse **M** (approx. 6–8 h).
- **Abhängigkeiten / Blocker:** Keine.
- **Akzeptanzkriterien:**
  1. Schreib- und Lesezugriffe bleiben unter 5 ms.
  2. Bestehende `browser.storage.local`-Daten werden nahtlos migriert.
- **Validierung & Testumgebung:** Benchmark & Unit Tests in `db.test.js`.

---

#### Paket 11: ENTERPRISE-01 — N06 Produktive Cloud- & Identity-Freigaben
- **Themenbereich:** Unternehmensadministration & optionale Integrationen
- **Entwicklungstyp:** Erweiterung
- **Befund & Beleg:** Das Enterprise-Modul in `enterprise/` ist konzeptionell und lokal vollständig als Node.js/CLI-Suite umgesetzt (`docs/AUFGABENPLAN_ENTERPRISE_N06.md`). Es fehlen reale Anbindungen an Unternehmensinfrastrukturen.
- **Gewünschtes Ergebnis & Nutzwert:** Einsatzfähigkeit in Enterprise-Flotten mit zentralem Ingest, SIEM-Export und HSM-signierten Evidenzketten.
- **Abgegrenzter Umfang:** Produktive Freigabe von S3/Azure-Blob-Speichern, OIDC-IdP-Anbindung, RBAC-Rollen und SEALED-Evidenzcommits.
- **Priorität & Aufwand:** **P4 (Später / Optional)** | Aufwandsklasse **XL** (approx. 40+ h).
- **Abhängigkeiten / Blocker:** ✋ Produktiver Unternehmens-Mandant, Cloud-Credentials, IdP.
- **Akzeptanzkriterien:**
  1. Evidenz-Logs werden signiert an den zentralen Ingest übermittelt.
  2. `enterprise:acceptance` meldet PASS auf realer Infrastruktur.
- **Validierung & Testumgebung:** Enterprise Staging-Umgebung.

---

## 6. Roadmap für die nächsten Entwicklungsschritte

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: KURZFRISTIG (RELEASE & STORE)                                 │
│ ───► PLATFORM-01: ATN Store-Signierung & Einreichung v1.23.0 ✋          │
│ ───► UX_A11Y-02: Threat-Banner Screenshot (Motiv 7) ✋                   │
│ ───► AUDIT-01: PENDING-Recovery & Crash-Resilienz (Lokal)               │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: MITTELFRISTIG (PLATTFORMBREITE & OS-QUALITÄT)                  │
│ ───► PLATFORM-02: Windows 11 & macOS Live-Abnahme ✋                    │
│ ───► UX_A11Y-01: Screenreader-Validierung (NVDA/Orca/VoiceOver) ✋      │
│ ───► PLATFORM-03: Standardbrowser-Handoff-Verifikation ✋                │
│ ───► ANALYSIS-01: Resilienz & Circuit-Breaker für Provider-APIs          │
├─────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: SPÄTER / ENTERPRISE (OPTIONALE EXPANSION)                      │
│ ───► PLATFORM-04: Automatische Update- & Rollback-Prüfung ✋            │
│ ───► I18N-01: Dynamische Pluralisierung & Datumsformatierung            │
│ ───► PERF_RECOVERY-01: IndexedDB Audit-Log Migration                    │
│ ───► ENTERPRISE-01: N06 Produktive Cloud- & Identity-Freigaben ✋       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Die Top 3 empfohlenen nächsten Arbeitspakete

1. **PLATFORM-01: ATN Store-Signierung & Einreichung v1.23.0**
   - **Begründung:** Der Stand v1.23.0 ist im Repository vollständig ausgereift und hat das lokale Submission-Gate `npm run store-gate` mit **GO** bestanden (953 Tests grün, Lint ok, Paket valid). Die Einreichung bei Mozilla/Thunderbird ist der entscheidende Engpass, um den Nutzern die Extension bereitzustellen.
   - **Voraussetzung:** ✋ AMO/ATN-API-Credentials des Maintainers.

2. **AUDIT-01: `PENDING`-Recovery & Crash-Resilienz**
   - **Begründung:** Kann **sofort mit den vorhandenen Mitteln** ohne externe Zugänge umgesetzt werden. Erhöht die Systemzuverlässigkeit und stellt sicher, dass unerwartete Thunderbird-Abstürze niemals fälschlicherweise als Nutzer-Einwilligung gewertet werden.
   - **Voraussetzung:** Keine (vollständig lokal im Codebase umsetzbar).

3. **UX_A11Y-02: Threat-Banner Screenshot (Motiv 7)**
   - **Begründung:** Schließt die allerletzte Dokumentationslücke in den Store-Assets (`docs/store_assets.md`), sodass das Listing-Set zu 100 % vollständig vorliegt.
   - **Voraussetzung:** ✋ Kurze Ausführung in Thunderbird Live-GUI zur Aufnahme des Screenshots.

---

## 8. Abschließende Empfehlungen & Handlungsbedarf

1. **Sofort ausführen (Ohne externe Voraussetzungen):**
   - Umsetzbar im aktuellen Sandbox-Kontext: **AUDIT-01** (PENDING Crash-Recovery), **ANALYSIS-01** (Circuit Breaker für APIs), **I18N-01** (Intl Datumsformatierung) und **PERF_RECOVERY-01** (IndexedDB Evaluation).

2. **Anforderung externer Voraussetzungen:**
   - **Maintainer-Schlüssel:** Bereitstellung der ATN-API-Keys für **PLATFORM-01**.
   - **Test-Systeme:** Zugriff auf Windows 11, macOS sowie Screenreader-Software für **PLATFORM-02**, **UX_A11Y-01** und **PLATFORM-03**.
   - **Enterprise-Mandant:** Bereitstellung von Cloud-Speicher und Identity-Provider für **ENTERPRISE-01**.
