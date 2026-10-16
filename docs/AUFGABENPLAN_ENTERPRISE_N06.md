# Aufgabenplan Enterprise-N06 & Produktivbetrieb — „Thundy AV“ (Folgeplan nach dem Store-GO)

**Bezug:** Aufgabe A-25 in [AUFGABENPLAN_STORE_READINESS_1_23_0.md](AUFGABENPLAN_STORE_READINESS_1_23_0.md) ·
Quellen: [ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md) (N01–N18),
[ENTERPRISE_N06_ABNAHME.md](ENTERPRISE_N06_ABNAHME.md), [ENTERPRISE_UMSETZUNGSKONZEPT.md](ENTERPRISE_UMSETZUNGSKONZEPT.md),
[THUNDERBIRD_LINUX_ABNAHME.md](THUNDERBIRD_LINUX_ABNAHME.md) (Grenzen), Store-Plan A-16 – A-21
**Snapshot:** Branch `cline/rxk1fthv`, Stand 2026-10-16, Basis: Store-GO (v1.23.0, Gate C1–C7 PASS)
**Ziel:** Produktivfähigkeit der Enterprise-Kernpfade (N06) und der offenen realen Nachweise —
ausdrücklich **nicht** blockierend für die ATN-Einreichung
**Struktur:** identisch zum Store-Plan (G0–G6, Traceability, messbare DoD, ✋-Markierung)

---

## 1. Legende und Ausgangslage

N01–N18 (aus [ENTERPRISE_NAECHSTE_SCHRITTE.md](ENTERPRISE_NAECHSTE_SCHRITTE.md)) sind **implementiert
und lokal geprüft**; die unten geplanten Punkte sind genau die dort benannten offenen Blocker:
produktive Systeme/Freigaben (N06), reale Plattform-/Betriebsabnahmen und Flottenmessung. Keine
Aufgabe dieses Plans simuliert einen produktiven Nachweis; ✋-Aufgaben brauchen reale Zugänge.

| Kürzel | Bedeutung |
|---|---|
| **Quelle** | Beleg-Stelle in N01–N18 bzw. Abnahme-Grenzen |
| **DoD** | messbarer Nachweis; für N06-Pfade der ausführbare Prüfer aus [ENTERPRISE_N06_ABNAHME.md](ENTERPRISE_N06_ABNAHME.md) |
| **✋** | braucht reale Umgebung/Zugang (Cloud, IdP, Flotte, Windows/macOS) |

## 2. Traceability-Matrix (Quelle → Aufgabe)

| Quelle (offener Punkt) | Aufgaben |
|---|---|
| N06: produktive Cloudprüfung (E01–E03) | EN-01, EN-02 |
| N06: SEALED-Evidenzcommit (F01–F03) | EN-03 |
| N06: SSO/RBAC-Rollen (A01–A03) | EN-04 |
| N06: echte OS-/Thunderbird-Abnahme (Q01–Q02) | EN-05 – EN-08 (= Store-Plan A-16 – A-19) |
| N01: Trust-/OS-Schlüsselverteilung | EN-09 |
| N02: produktiver Policykanal | EN-10 |
| N03/N07/N09: Unternehmensrollen/Portal | EN-11 |
| N04/N11: reale Flottenmessung | EN-12 |
| N05: SIEM-Transport (bewusst deaktiviert) | EN-13 |
| Geschützte Ablage: Live-/Retention-/Schlüssel-/Restore | EN-14 |

## 3. Phase G0 — Entscheidungen & Vorbereitung

| ID | Aufgabe | DoD | Aufwand |
|---|---|---|---|
| **EN-00a** | Zielbetreiber/-umgebung festlegen: konkreter Betreiber, Datenregion, IdP, Geräteverwaltung, optional freigegebene SIEM-/Ticketsysteme | Entscheidung in [decisions.md](decisions.md) (D15) | 4 h ✋ |
| **EN-00b** | Reihenfolge der N06-Freigaben festlegen (Cloud → SEALED → SSO → OS-Abnahme) und Zugänge beantragen | Freigabeliste notiert | 2 h ✋ |

## 4. Phase G1 — Blocker: N06-Kernpfade

| ID | Aufgabe | Quelle | DoD | Aufwand |
|---|---|---|---|---|
| **EN-01** | Produktive Cloudprüfung: Betreiberidentitäten, Region, Daten-/Retentionfreigaben | E01–E03 | Nachweisprüfer (N06) meldet Cloudteil PASS mit realen Verträgen/Konfigurationen | 16 h ✋ |
| **EN-02** | IAM/KMS/Restore-Prüfung inkl. getrennter Rollen | E01–E03 | Restore-Test dokumentiert; Prüfer-PASS | 12 h ✋ |
| **EN-03** | SEALED-Evidenzcommit produktiv; `CLOUD_OBSERVED` bleibt ohne Freigabe ausdrücklich nicht SEALED | F01–F03 | Evidenzcommit mit unabhängiger Prüfbarkeit; Prüfer-PASS | 12 h ✋ |
| **EN-04** | SSO-/RBAC-Rollen produktiv (getrennte Rollen, kein Self-Approval) | A01–A03 | Rollenmatrix live geprüft; Prüfer-PASS | 16 h ✋ |

## 5. Phase G2 — Verteilung, Update, Plattform (nach Store-Einreichung A-03/A-04)

| ID | Aufgabe | Quelle | DoD | Aufwand |
|---|---|---|---|---|
| **EN-05** | Automatische Updateverteilung über ATN mit Neustart | Grenzen ABNAHME | Updatepfad produktiv nachgewiesen (Version + Hash im Profil) | 6 h ✋ |
| **EN-06** | Rollback-/Absturzverhalten bei fehlgeschlagener Verteilung | Grenzen ABNAHME | Bericht; vorherige Version funktionsfähig | 6 h ✋ |
| **EN-07** | Windows-/macOS-Abnahme (= Store-Plan A-16/A-17) | A-16, A-17 | Abnahme-Abschnitte + Screenshots | 8 h ✋ |
| **EN-08** | Screenreader/DPI/Zoom + reale Standardbrowser-Übergabe mit Fehler/Retry/`OPENED` (= A-18/A-19) | A-18, A-19 | Berichte; `OPENED`-Semantik in realer Übergabe geprüft | 8 h ✋ |

## 6. Phase G3 — Trust, Policy, Rollen, Flotte

| ID | Aufgabe | Quelle | DoD | Aufwand |
|---|---|---|---|---|
| **EN-09** | Trust-/OS-Schlüsselverteilung produktiv (Writer-/Reader-Trennung bleibt) | N01 | Verifizierer über reale Verteilung beliefert; falsche Roots weiter abgewiesen | 8 h ✋ |
| **EN-10** | Produktiver Policykanal mit Rotation und Widerruf | N02 | Neustart/konkurrierende Updates/Rollback am echten Kanal geprüft | 10 h ✋ |
| **EN-11** | Unternehmensrollen/Portal-Integration für Incidenzfälle | N03/N07/N09 | Kein Ticketversand ohne Freigabe; Rollenmatrix angewendet | 12 h ✋ |
| **EN-12** | Reale Flottenmessung (Heartbeats, Betriebsberichte) | N04/N11 | Erste echte Flotte gemessen; Selbstauskunfts-Grenzen dokumentiert | 8 h ✋ |
| **EN-13** | SIEM-Transport-Aktivierung — nur mit expliziter Freigabe; bleibt standardmäßig deaktiviert | N05 | Aktivierungsentscheidung + Transportnachweis oder bewusste Deaktivierung dokumentiert | 6 h ✋ |
| **EN-14** | Geschützte Ablage: unabhängige Live-/Retention-/Schlüssel-/Restoreprüfungen | „Noch benötigte reale Nachweise“ | Vier Prüfungen mit unabhängigem Prüfer; Prüfer-PASS | 16 h ✋ |

## 7. Phase G4–G6 — QS, Doku, Erweiterungen

| ID | Aufgabe | DoD |
|---|---|---|
| **EN-15** (G4/QS) | Gesamtabnahme N06 mit dem ausführbaren Prüfer; Runde-Tabelle hier fortgeschrieben | Prüfer-GO dokumentiert |
| **EN-16** (G5/Doku) | [ENTERPRISE_UMSETZUNGSSTAND.md](ENTERPRISE_UMSETZUNGSSTAND.md) je erledigtem EN-Task aktualisieren | Stand stimmt mit Nachweisen überein |
| **EN-17** (G5/Doku) | Sechssprachige Admin-Ansichten gegen reale Nutzung prüfen (aktuell nur Browser-/Chromium-Matrix) | Abnahmeberichte |
| **EN-18** (G6) | Unabhängige Unternehmensabnahme durch Dritten | Prüfbericht eines unabhängigen Prüfers |
| **EN-19** (G6) | Portal-/Ticket-Integration nach EN-11-Freigabe | Dokumentierter Datenfluss ohne Credential-Lecks |

**Summe:** ≈ 150 h, davon ≈ 146 h ✋ (reale Umgebungen) — dieser Plan ist bewusst vollständig
handlungsbedarfsgerecht geschnitten und kann erst nach EN-00a/00b beginnen; er blockiert die
ATN-Einreichung nicht.

**Startreihenfolge:** EN-00a → EN-00b → EN-01 → EN-02 → EN-03 → EN-04 → EN-05 → … (G2+ kann
parallel zur ATN-Einreichung vorbereitet werden, soweit Zugänge bestehen).

**Fortführung:** Status je ID in einer Runde-Tabelle in diesem Plan — identisches Muster wie
Store-Plan §11. Neue Erkenntnisse werden als Befunde in die Problemanalyse-Erweiterung geschrieben.