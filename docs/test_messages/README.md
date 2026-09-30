# Testnachrichten für die manuelle Verifikation

Diese Dateien sind **Testdaten** für den Live-Test in Thunderbird (siehe
[docs/reviewer_notes.md](../reviewer_notes.md), Abschnitt 8). Sie liegen unter `docs/` und sind
**nicht** Bestandteil des Add-on-Pakets (`web-ext` ignoriert `docs/`, geprüft durch
`scripts/verify-package.js`). Alle Namen, Adressen und Domains sind frei erfunden; es werden keine
echten personenbezogenen Daten verwendet.

## `suspicious_message.eml`

Eine Nachricht, die genau die Pfade auslösen soll, die sonst nur mit echten Bedrohungsdaten sichtbar
werden — **ohne** API-Schlüssel und **ohne** Zustimmung:

| Merkmal | Wirkung im Add-on |
|---|---|
| Absender `service@paypal-support.com` (Lookalike-Domain) | Absender-Domain-Bewertung, Typosquatting-Heuristik |
| Betreff/Dringlichkeitswörter („Action required“, „immediately“) | Verhaltensbewertung |
| `Reply-To` auf eine andere Domain (`mail-verify.example.net`) | Reply-To-Abweichung |
| `Received`-Header mit öffentlicher IP `203.0.113.42` | IP-Reputation (nur mit konfiguriertem Anbieter) |
| `Authentication-Results: spf=fail … dmarc=fail` | Auth-Auswertung (kein grüner Badge) |
| HTTP-Link auf `login.amaz0n.de` (Typosquatting) | Link-Bewertung, Banner-Begründungen |
| HTML-Anhang `invoice_98231.html` mit `<script>`, Formular und `http:`-Aktion | Anhang-Warnung **und** Test von „HTML entschärfen“ (lokales CDR) |

Erwartetes Verhalten beim Öffnen: Risikoscore ≥ 50 ⇒ **Warnbanner** mit Begründungsliste; zusätzlich
erscheint das **Opt-in-Banner** (solange nichts freigegeben ist bzw. kein API-Schlüssel hinterlegt
ist). Im **Popup** stehen die lokale Bewertung (Score/Begründungen/Auth-Ergebnis) und der Hinweis, dass
für Anbieter-Daten Zustimmung + API-Schlüssel nötig sind.

## Einspielen in Thunderbird

1. Add-on temporär laden (siehe [docs/quickstart.md](../quickstart.md)).
2. Datei `docs/test_messages/suspicious_message.eml` in einen Ordner ziehen (Thunderbird importiert
   `.eml`-Dateien per Drag & Drop in die Ordnerliste) — alternativ den Inhalt als Testmail an das
   eigene lokale Postfach senden.
3. Nachricht öffnen und die Schritte 8 ff. aus [docs/reviewer_notes.md](../reviewer_notes.md)
   durchgehen (Banner, Popup, Time-of-Click, „HTML entschärfen“, Cache leeren).

## Hinweis

Die Datei enthält absichtlich unsicheren Inhalt (Skript-Tag, Formular, externe Links). Sie darf
**nicht** außerhalb einer Testumgebung geöffnet werden; der HTML-Anhang ist ausschließlich dafür
gedacht, vom Add-on entschärft zu werden.
