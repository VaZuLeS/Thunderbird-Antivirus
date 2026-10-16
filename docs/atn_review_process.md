# ATN-Review-Rücklauf — Prozess (A-24)

**Zweck:** Definiert, wie Reviewer-Kommentare der Thunderbird-Add-ons-Store-Prüfung (ATN)
aufgenommen, in Befunde/Aufgaben überführt und als Nachbesserungs-Runde abgeschlossen werden.
**Gültigkeit:** Ab der Einreichung des Kandidaten 1.23.0 (A-04); Vorbereitung ab Runde 1.
**Bezug:** [AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md) §11/§12 ·
[Problemanalyse 1.23.0](PROBLEMANALYSE_STORE_READINESS_1_23_0.md) ·
[submission-gate](../scripts/submission-gate.js) (C1–C7)

---

## 1. Kanäle

| Kanal | Zweck |
|---|---|
| ATN-Reviewer-Kommentar | **Primärquelle** — nur das wörtliche Zitat/der Link zählt, keine Paraphrase als „Anforderung“ |
| GitHub-Issue „ATN reviewer feedback“ | Aufnahme in das Repository: Vorlage `.github/ISSUE_TEMPLATE/atn_review_feedback.md`, Label `atn-review` |
| [STATUS.md](STATUS.md) | Fortlaufender Eintrag pro Einreichungs-/Nachbesserungsrunde mit Datum |
| Runde-Tabelle im Aufgabenplan §11 | Fortschreibung je Aufgaben-ID mit reproduzierbarem Nachweis |

## 2. Ablauf pro Review-Kommentar (SOP)

1. **Erfassen:** Issue mit der Vorlage anlegen; Reviewer-Wortlaut unverändert einfügen; Version und
   Einreichungsdatum angeben.
2. **Klassifizieren:** Keine Codeänderung (Klarstellung) / Manifest-Rechte / Datenschutz-Deklaration
   bzw. Privacy-Policy / UI-Verhalten / Paket-Signatur / sonstiges.
3. **Zuordnen:** Neuen Befund mit fortlaufender Nummer anlegen (Problemanalyse: B6, B7 …, H3 …,
   M3 …) mit Beleg (Reviewer-Zitat als Quelle, Datei:Zeile im Code als Belegseite) und Aufgabe im
   Aufgabenplan (neue Runde, gleiche Struktur: G0–G6, Traceability, messbare DoD).
4. **Antworten:** Entwidmung an ATN mit präziser Begründung; bei Klarstellungen ohne Codeänderung
   keine neue Version einreichen, sondern antworten und auf die Rückmeldung warten.
5. **Nachbessern (nur bei Änderung an paketierten Dateien):** Version bump in `manifest.json` +
   `package.json` + `package-lock.json`, `CHANGELOG.md`-Eintrag, `docs/releases/<version>.md`
   (Release-Notiz für den Tag-Push-Workflow), dann Tag `v<version>` → der Publish-Workflow
   (`docs/ci/release-publish.yml`) veröffentlicht nur bei **GO**.
6. **Messen:** `npm run goal` muss Exit 0 (GO) liefern, **bevor** die neue Version erneut eingereicht
   wird; C7 erzwingt den neuen Tag automatisch.
7. **Abschließen:** Issue mit Nachweis schließen (Gate-Protokoll, Release-URL, ATN-Antwort);
   Runde-Tabelle und STATUS aktualisieren.

## 3. Reaktions- und Fristregeln

| Fall | Zielreaktionszeit |
|---|---|
| Reviewer-Kommentar (jede Art) | Issue innerhalb von 2 Werktagen, Antwort an ATN innerhalb von 5 Werktagen |
| Klarstellung ohne Codeänderung | Antwort direkt, keine neue Version |
| Codeänderung | Neue Version mit GO-Nachweis innerhalb von 10 Werktagen; sonst Zwischenstand an ATN |
| Sicherheitsrelevante Anmerkung | Sofort über [SECURITY.md](../SECURITY.md) behandeln, kein öffentlicher Issue |

## 4. Eskalationsregeln (Version bump vs. Antwort)

- **Kein Version bump** bei: reinen Rückfragen, Hinweisen, die sich aus der
  Privacy-Policy/Reviewer-Notes beantworten lassen, Wünschen ohne Policy-Basis (hier antworten und
  Begründung dokumentieren; ATN-Reviewer-Entscheidungen haben Vorrang vor Listing-Text).
- **Version bump** bei: jeder Änderung an Dateien aus der Paketliste
  (`scripts/verify-package.js` → `ALLOWED_FILES`), also auch „nur“ UI-Text; das Gate-C7 verlangt
  sonst einen veralteten Tag.
- **Kein „stiller Fix“:** Jede Änderung bekommt eine Befund-ID und einen Task — der Plan ist das
  Ausführungsprotokoll (Kein-Befund-ohne-Aufgabe, Keine-Aufgabe-ohne-Befund).

## 5. Nach der Freigabe (A-05)

- Store-URL in README (EN/DE), [store_listing.md](store_listing.md), Landing-Page und STATUS
  nachtragen; [support_faq.md](support_faq.md) um den Store-Link ergänzen.
- Gate bleibt verbindlich: Der erste Store-Update nach der Freigabe folgt demselben Zyklus
  (Befund → Aufgabe → GO → Tag → Signierung).
- Store-Bewertungen/-Issues werden über [support_faq.md](support_faq.md) auf die Support-Kanäle
  gelenkt und regelmäßig (empfohlen: wöchentlich) gesichtet; ein user report mit reproduzierbarem
  Fehler wird wie ein Reviewer-Kommentar als Befund aufgenommen.