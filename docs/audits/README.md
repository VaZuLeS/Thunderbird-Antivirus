# Audit-Berichte — Thundy AV (Store-Readiness, Snapshot 1.6)

Dieser Ordner enthält die **Rohberichte** der drei unabhängigen Auditläufe, auf denen die
[Problemanalyse](../PROBLEMANALYSE_STORE_READINESS.md) und der
[Aufgabenplan](../AUFGABENPLAN_STORE_READINESS.md) aufbauen. Prüfgegenstand aller drei Berichte ist derselbe
Snapshot: Branch `cline/k0d34w90`, Basis-Commit `4c4898c`, `manifest.json` Version 1.6.

| Datei | Auditgegenstand |
|---|---|
| [code-audit.md](code-audit.md) | Manifest-/MV3-Konformität, Consent-Erzwingung, Permission-Flüsse, Sicherheit, toter Code |
| [docs-audit.md](docs-audit.md) | Datenschutz-/Listing-/Reviewer-Dokumentation gegen Code und Mozilla-/Thunderbird-Vorgaben |
| [pipeline-audit.md](pipeline-audit.md) | Build/Paket (XPI), CI/CD, Signier- und Releasefähigkeit, Versionskonsistenz |

**Hinweise zur Nutzung**

- Die Berichte sind **Belege, keine Freigabe**: einzelne Bewertungen (z. B. Schweregrad-Einschätzungen,
  „UNVERIFIZIERT“-Markierungen) sind im jeweiligen Bericht begründet; maßgeblich für die Befundliste ist die
  Zusammenführung in der Problemanalyse (§4–§6), in der jede übernommene Aussage gegen die Messwerte aus §2
  nachgeprüft wurde.
- Alle drei Läufe waren rein lesend; es wurden keine getrackten Dateien verändert (Nachweis: `git status`
  in den Berichten).
- Die Berichte sind auf Deutsch verfasst und nennen Zeilennummern des oben genannten Commits. Bei späteren
  Änderungen am Code veralten die Zeilennummern — die Befunde selbst bleiben über die genannten Symbole
  (Funktions-/Dateinamen) nachvollziehbar.
