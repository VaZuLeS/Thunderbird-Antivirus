# Themen-Roadmap — Thundy AV

**Stand:** 2026-10-01 · **Aktuelle Version:** 1.6.5 (siehe [STATUS.md](STATUS.md))
**Bezug:** [PROBLEMANALYSE_STORE_READINESS.md](PROBLEMANALYSE_STORE_READINESS.md) ·
[AUFGABENPLAN_STORE_READINESS.md](AUFGABENPLAN_STORE_READINESS.md) · [decisions.md](decisions.md)

Diese Roadmap bündelt die offenen Themen nach Nutzen und Abhängigkeit. Sie ersetzt die Befundlisten
nicht, sondern ordnet sie: **was zuerst, warum, und was daran blockiert**.

---

## 1. Themenübersicht

| # | Thema | Status | Wirkung auf die Store-Reife | Aufwand |
|---|---|---|---|---|
| T1 | **Einreichung selbst** (Screenshots, Live-Test, ATN-Listing) | 🟡 vorbereitet, blockiert (manuell) | **Der** letzte Blocker: ohne Screenshots und Live-Test kein GO | 1–2 Tage, nur von Hand |
| T2 | **Security & Robustheit** | 🟢 in 1.6.5 umgesetzt | senkt Review-Risiko, verbessert die „disarm“-Zusage | 1 Tag |
| T3 | **Barrierefreiheit (a11y)** | ⚪ offen | Review-Kosmetik, Nutzen für Tastatur/Screenreader | 0,5 Tage |
| T4 | **Lokalisierung der Oberfläche** | ⚪ offen | Reichweite + Listing-Konsistenz (UI ist deutsch) | 1–1,5 Tage |
| T5 | **Performance/Inkrementalität der Analyse** | ⚪ offen | weniger Anbieter-Anfragen, schnellere Dossiers | 1 Tag |
| T6 | **Release-Automatisierung** | 🟡 teilweise (Workflow-Spiegel) | wiederholbare Releases, weniger Handgriffe | 0,5 Tage |
| T7 | **Nach der Freigabe** (Review-Betreuung, Versionen, Store-Pflege) | ⚪ laufend | hält die Listung gesund | laufend |

Legende: 🟢 erledigt · 🟡 teilweise · ⚪ offen

---

## 2. T1 — Einreichung (der einzige echte Blocker)

**Blockiert durch:** echte Thunderbird-GUI und Bildschirmaufnahmen; ATN-Konto/Schlüssel.

Vorbereitet ist alles: Listing-Texte, Datenschutzerklärung (live), Reviewer-Notes, Testdaten
(`testdata/`), Live-Test-Protokoll mit **Schritt 0 = Selbsttest** und das ausführbare Gate
`npm run store-gate` (Kriterien C1–C7). Offen:

1. Selbsttest in Thunderbird 140 ESR ausführen und den Bericht in `docs/live_test_protocol.md` einfügen.
2. Die verbleibenden manuellen Schritte des Protokolls abarbeiten (Banner-Optik, Kontextmenüs,
   Berechtigungsdialoge) — das Verhalten ist durch C1–C4/C7 und die Testsuiten vorgeprüft.
3. Drei echte PNG-Screenshots aufnehmen (`docs/screenshot_capture.md`) → Kriterium C5.
4. `npm run store-gate` → **GO**; danach signieren und einreichen:
   `npx web-ext sign --amo-base-url https://addons.thunderbird.net/api/v5/ --channel listed --approval-timeout 0`.

**Risiko:** Ohne Schritt 1–2 bleibt C6 formal offen; das ist im Gate dokumentiert, nicht vergessen.

## 3. T2 — Security & Robustheit (umgesetzt in 1.6.5)

- **Bedrohungsmodell** in [threat_model.md](threat_model.md): Schutzgüter, Vertrauensgrenzen, Angreifer,
  Maßnahmen, Restrisiken.
- **„HTML entschärfen“ ist jetzt auch netzwerk-untätig:** Remote-Referenzen (`src`, `srcset`, `poster`,
  `background`, `data`, `ping`, …), `url(...)` in Inline-Styles und `@import` in `<style>` werden durch
  einen inerten Platzhalter ersetzt; der blockierte Zielpfad bleibt im Attribut
  `data-thundy-blocked-*` für die Analyse lesbar.
- **Nachrichten-Grenze gehärtet:** `runtime.onMessage` validiert Aktion und Nutzlasttypen, bevor ein
  Handler läuft (unbekannte Aktionen und falsche Typen werden abgelehnt).
- **Export-Schranken:** Größenlimit 5 MB und Whitelist der MIME-Typen, unabhängig vom Nachrichtenweg.
- **Keine Schlüssel in Berichten:** Ein Test belegt, dass Dossiers/Exporte keine API-Keys enthalten.

Tests: `test/security-hardening.test.js` (9 Fälle).

## 4. T3 — Barrierefreiheit

Offen: Tabs mit Pfeiltasten bedienbar machen (`role="tablist"` + `aria-selected` existieren bereits),
Fokusmanagement beim Umschalten, Tabellenbeschriftungen (`<caption>`), `prefers-reduced-motion` prüfen
(in `theme.css` vorhanden). Aufwand klein, Wirkung: Tastatur- und Screenreader-Tauglichkeit ist im
Review ein Plus.

## 5. T4 — Lokalisierung der Oberfläche

Offen (Befund P2-18): Optionsseite, Popup und Forscher-Ansicht sind **deutsch**; Manifest-Strings und
Banner sind en/de. Vorgehen: `data-i18n`-Attribute + kleines `i18n.js`, Katalog-Erweiterung in
`_locales/en|de`, Umstellung der hartkodierten Strings in `api.js`, `options.js` und den
Forscher-Beschriftungen; der Paritätstest existiert bereits (`test/manifest.test.js`).
Randbedingung: Die Tests prüfen heute deutsche Texte — sie müssen auf den i18n-Weg umgestellt werden
(das ist der Hauptaufwand).

## 6. T5 — Performance/Inkrementalität

Offen: `buildResearchDossier()` führt bei jedem Öffnen die lokale Analyse erneut aus und (mit Zustimmung)
Reputationsabfragen. Idee: zuerst den gespeicherten Datensatz anzeigen (in 1.6.4 eingebaut) und
Netzwerkprüfungen nur auf ausdrückliche Aktion („Neu bewerten“) ausführen; das Anhangs-Hashing läuft
bereits über den Cache. Ziel: keine Anfrage ohne Absicht, kürzere Wartezeit bei großen Nachrichten.

## 7. T6 — Release-Automatisierung

`docs/ci/release.yml` (Spiegel) enthält den ATN-Signierlauf mit korrektem Endpunkt und
`--approval-timeout 0`; der Push unter `.github/workflows/` scheitert am Token ohne `workflows`-Scope.
Offen: Workflow mit passender Berechtigung aktivieren, danach Tag/Build/Hash automatisch. Bis dahin ist
der Ablauf in [decisions.md](decisions.md) dokumentiert und über `npm run check` + `npm run store-gate`
nachvollziehbar.

## 8. T7 — Nach der Freigabe

Review-Rückfragen beantworten, Releasenotes pflegen, Store-URL in README/Listing/Landing-Page
nachtragen, Versionspolitik beibehalten (Patch auf der 1.6-Linie, solange die 1.7–1.18-Linie
unveröffentlicht bleibt) und Doku-Drift regelmäßig prüfen (`test/manifest.test.js` erzwingt Konsistenz).

---

## 9. Empfohlene Reihenfolge

1. **T1 Schritte 1–3** (manuell, sobald eine Thunderbird-Instanz verfügbar ist) → GO.
2. **T3 a11y** (klein, macht die Forscher-Ansicht für alle bedienbar).
3. **T4 i18n** (größter Einzelposten, hebt die Reichweite).
4. **T5 Performance** (Feinschliff nach dem ersten Store-Feedback).
5. **T6/T7** laufend.

