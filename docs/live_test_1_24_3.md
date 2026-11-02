# Kandidatenprüfung 1.24.3 — reale Linux-Teilabnahme

Jüngster Umfang einschließlich portabler Darstellungsprofile und eigener aktueller Paketbindung: [Veröffentlichungsabschluss](VEROEFFENTLICHUNG_1_24_3.md). Die nachfolgenden Tabellen bleiben als zeitgebundene frühere Abnahmen erhalten.

## Aktuelle Weiterentwicklung — eigene Abnahme

Neue lokale Paketbytes: SHA-256 `a150e885188d72703cecc7cf8812b396902e5fa04c0565032b5848b3ed7a2627`; Quellfingerprint `35a5174d43da3592df604e322becd5a5b345580f28ecd1f3dc647a4c982b8f77`. Vollständige [Ausführung und Grenzen](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md); aktuelle [Reportbindung](audits/candidate-1_24_3.json). Keine Veröffentlichung oder ATN-Freigabe.

| Gruppierter aktueller Prüffall | Ergebnis |
| --- | --- |
| Upgrades 1.24.2 → 1.24.3 in sechs Sprachprofilen | OK |
| Saubere Neustarts (mindestens zwei je Sprachprofil; EN zusätzlich Restore) | OK |
| Zwei echte SIGKILL-Wiederanläufe je Sprachprofil | OK |
| Originaldaten, Versionen und historische Entscheidungssnapshots unverändert | OK |
| PENDING ohne erfundene Nutzerentscheidung | OK |
| Keine erneute OS-Zustellung bei Recovery | OK |
| Sauberes Profilbackup unter 153 ESR wiederhergestellt | OK |
| Authentifizierungsheader aus echter importierter MIME bleiben bei passage neutral | OK |
| 101 MIME-Anhänge: 100 bearbeitet, einer ausgelassen, im nativen Popup sichtbar | OK |
| Lokale Supportvorschau und echter GTK-/Downloads-Export, sechs Sprachen | OK |
| Audit-Leseprüfung mit echten APIs bei 0/50/2.000 synthetischen Einträgen | OK |
| Eigene Themes, Dichte, Dialog und getrennte Entscheidungsinformationen | OK |
| 600 Chromium-/axe-Fälle; simulierte Extension-APIs | OK |
| 36 CSS-Zoomfälle; keine native OS-DPI-Abnahme | OK |

**Summe:** 14 OK / 0 FAIL / 0 N/A / 0 OFFEN

Diese Summe gilt nur für die genannten lokalen Prüffälle. Externe/native Ressourcenblocker aus dem Ausführungsprotokoll bleiben offen.

## Historische erste Kandidatenfassung


Datum: 2. November 2026. Das Paket ist vorbereitet, nicht durch dieses Protokoll veröffentlicht oder ATN-signiert. Linux X11/Xvfb, Thunderbird **140.12.0 ESR** (EN) und **153.6.0 ESR** (DE/FR/ES/IT/PL; zusätzliche EN-Erstinstallation). Synthetische Nachrichten, keine Provider-API-Mocks in den echten Clientläufen, externer Netzbetrieb deaktiviert.

Die folgende ursprüngliche Abnahme beschreibt die erste Kandidatenfassung vor dem neuen Aufgabenplan (Ausgangscommit `3024636`). Neue Paketbytes und Nachweise werden im [aktuellen Ausführungsprotokoll](AUSFUEHRUNG_WEITERENTWICKLUNG_1_24_3.md) separat geführt.

Ursprüngliche Paket-SHA-256: `1c3ba1f8f2f24197c82cb3335dce0901b27f1611c6230665229e16e915778e39`. Quellfingerprint: `a52a9fc477143ff3adf709c2d3c8dadec17937867941add4321899f63614d0aa`. Der ursprüngliche maschinenlesbare Nachweis ist im Git-Stand `3024636` erhalten. Die Datei [Kandidatennachweis](audits/candidate-1_24_3.json) wird für die neue Fassung erst nach ihren eigenen erfolgreichen Läufen aktualisiert. ZIP-Container werden nach Liveprüfung nicht neu gebaut; abweichende Neubuild-Bytes dürfen nicht denselben Nachweis beanspruchen.

| Gruppierter Prüffall | Tatsächlicher Nachweis | Ergebnis |
| --- | --- | --- |
| Erstinstallation | echter Thunderbird 153.6.0, isoliertes EN-Profil, Add-on aktiv | OK |
| Wizard und Opt-in | sechs Wizardtexte im direkten Lauf, keine automatische externe Einwilligung | OK |
| Dauerhaftes Upgrade | 1.24.2 → 1.24.3 in sechs Sprachprofilen | OK |
| Saubere Neustarts | je zwei Neustarts in sechs Upgradeprofilen | OK |
| Erzwungene Wiederanläufe | je zwei SIGKILL-Wiederanläufe in sechs Upgradeprofilen | OK |
| Historische Entscheidungen | URL/Score/Snapshots/Versionen vor Upgrade nach Neustart/Crash unverändert | OK |
| Offener Vorgang | PENDING nach Prozessverlust ohne erfundene Entscheidung | OK |
| Keine erneute Öffnung | isolierter Desktopempfänger bekommt beim Wiederanlauf keine neue URL | OK |
| Neue Interaktion | neue Entscheidung nach Recovery mit Kandidatenversion, alte Einträge erhalten | OK |
| Darstellung | echte Add-on-Themeeinstellungen und lokaler Dialog im direkten Linuxlauf | OK |
| Profilrückweg | separater 140-ESR-Lauf: sauberes Pre-Upgrade-Backup wiederhergestellt, 1.24.2 und drei ursprüngliche Datensätze erhalten | OK |
| UI-Matrix | ergänzend 600 vollständige Chromium-/axe-Fälle, sechs Sprachen; ausdrücklich simulierte Extension-APIs | OK |

**Summe:** 12 OK / 0 FAIL / 0 N/A / 0 OFFEN

Die Summe zählt die hier gruppierten Fälle, keine Testassertions und keine weltweite Produktfreigabe. Diese Fälle schließen Windows/macOS, native Screenreader/DPI, echte Standardbrowser, automatische Updateverteilung, Strom-/Datenträgerausfall und produktive Provider-/Enterpriseabnahme nicht ein. Der Desktopempfänger beweist OS-Zustellung; OPENED bleibt ausschließlich Thunderbirds angenommene Öffnungsanforderung. Im lokalen 140-Prefix war das OpenPGP-RNP-Modul nicht geladen; verschlüsselte/OpenPGP-Nachrichten sind nicht Teil dieser Abnahme.
