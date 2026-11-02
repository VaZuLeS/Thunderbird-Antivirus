# Kandidatenprüfung 1.24.3 — reale Linux-Teilabnahme

Datum: 2. November 2026. Das Paket ist vorbereitet, nicht durch dieses Protokoll veröffentlicht oder ATN-signiert. Linux X11/Xvfb, Thunderbird **140.12.0 ESR** (EN) und **153.6.0 ESR** (DE/FR/ES/IT/PL; zusätzliche EN-Erstinstallation). Synthetische Nachrichten, keine Provider-API-Mocks in den echten Clientläufen, externer Netzbetrieb deaktiviert.

Paket-SHA-256: `1c3ba1f8f2f24197c82cb3335dce0901b27f1611c6230665229e16e915778e39`. Quellfingerprint: `a52a9fc477143ff3adf709c2d3c8dadec17937867941add4321899f63614d0aa`. Der [maschinenlesbare Kandidatennachweis](audits/candidate-1_24_3.json) bindet alle Sprachberichte und Browserchecks an diese Inhalte. ZIP-Container werden nach Liveprüfung nicht neu gebaut; abweichende Neubuild-Bytes dürfen nicht denselben Nachweis beanspruchen.

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
