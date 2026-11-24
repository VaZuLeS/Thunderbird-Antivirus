---
layout: guide
lang: de
title: Lokale Bewertung / Local score
---

# Lokaler Score und Entscheidungswert

[Deutsch](#deutsch) · [English](#english)

## Deutsch

In der Nachrichtenansicht und im Popup lässt sich **Lokale Bewertung** aufklappen. Die Liste zeigt, welche Regeln Punkte beigetragen haben, gefolgt von der ungekürzten Summe und dem angezeigten Wert. Thundy addiert die lokalen Punkte und begrenzt das Ergebnis auf 100. Der Score beschreibt das Gewicht der Hinweise im Regelmodell.

| Lokaler Hinweis | Punkte |
| --- | ---: |
| Treffer auf der lokalen Sperrliste für Absenderadresse oder Domain | 100, beendet die Berechnung |
| Fehlgeschlagenes SPF, DKIM oder DMARC aus einem vertrauten `Authentication-Results`-Header. Für SPF zählt auch `softfail`. | +50 je Verfahren |
| Die Domain von `Reply-To` weicht von der Absenderdomain ab | +50 |
| Erster Kontakt und erkanntes Dringlichkeitswort in Betreff oder Nachricht | +50 zusammen |
| Dringlichkeitswort bei bekanntem Kontakt | +20 |
| Erster Kontakt ohne erkanntes Dringlichkeitswort | +10 |
| Registrierbare Absenderdomain ähnelt einer bekannten Marke. Thundy verwendet eine begrenzte Liste bekannter Domains und einen Editierabstand von 1 bis 2. | +60 einmal |
| Bei bekannter Absenderdomain und vorhandenen Links passt keine Linkdomain zum Absender | +40 einmal |
| Mindestens eine Linkdomain ähnelt einem Eintrag der Markenliste | +60 einmal, auch bei mehreren passenden Links |
| Treffer auf der lokalen Zulassungsliste | +0, wird als Hinweis angezeigt |

Die drei Kontakt- und Dringlichkeitsregeln sind Alternativen. Fehlende oder neutrale Authentifizierungsergebnisse ergeben für das jeweilige Verfahren keine Punkte. Beispiel einer Nachricht mit erster Kontaktaufnahme, ausgewiesenem Dringlichkeitshinweis und unpassender Linkdomain ergibt `50 + 40 = 90`. Wenn zusätzlich SPF fehlschlägt, lautet die Anzeige `min(140, 100) = 100`.

**Lokale Bewertung** verwendet die Nachrichtendaten und die lokal verfügbaren Einstellungen. Der getrennt ausgewiesene **Entscheidungsscore** kann zusätzlich konkrete zugeordnete Anbieterbefunde enthalten. Firmenregeln wenden darauf ihre Schwellen sowie die Regeln für bösartige und unvollständige Befunde an. Der Anhangschutz nutzt für seine eigene numerische Schwelle den verfügbaren Hybrid-Analysis-Datei-Score. [Firmenrichtlinie](UNTERNEHMENSRICHTLINIE.md)

## English

Expand **Local assessment** in the message view or popup to see every contributing rule, the raw sum and the displayed score. Thundy adds the local points and caps the result at 100. The score expresses the weight of the signals in the rules.

| Local signal | Points |
| --- | ---: |
| Sender address or domain is on the local blocklist | 100 and stop |
| Failed SPF, DKIM or DMARC in a trusted `Authentication-Results` header. SPF `softfail` also counts. | +50 per method |
| `Reply-To` domain differs from the sender domain | +50 |
| First contact and an urgency word in the subject or body | +50 together |
| Urgency word and an existing contact | +20 |
| First contact without a detected urgency word | +10 |
| Registrable sender domain resembles an entry in the known brand list, with an edit distance of 1 to 2 | +60 once |
| The sender domain is known, the message contains links, and none match the sender domain | +40 once |
| At least one link domain resembles an entry in the brand list | +60 once, even when several links match |
| Match on the local allowlist | +0 and a note |

The three contact and urgency rules are alternatives. Missing or neutral authentication yields no points for that method. A first urgent message with links that do not match the sender domain scores `50 + 40 = 90`. With an additional SPF failure, the displayed result is `min(140, 100) = 100`.

The **local assessment** uses message data and locally available settings. The separately displayed **decision score** can also include provider findings bound to the resource. Managed rules use their own thresholds and handling for malicious and incomplete results. The attachment policy uses the available Hybrid Analysis file score for its numeric threshold. [Managed Thunderbird policy](enterprise-policy.en.md)
