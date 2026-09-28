# Enterprise-Verteilung (verwaltete Vorgaben)

Thundy AV kann zentral gesteuert werden: Administratoren verteilen Vorgaben über die
**Managed-Storage**-Mechanik von Thunderbird (`browser.storage.managed`). Verwaltete Werte haben immer Vorrang vor
den lokalen Einstellungen der Nutzer.

## 1. Policy-Datei

Vorlage: [`policy.json`](policy.json) (die Add-on-ID `thundy-av@bludau-it-services.de` ist der Schlüssel).

| Schlüssel | Typ | Wirkung |
|---|---|---|
| `externalAnalysisConsent` | bool | `false` = es wird **nichts** an Analyse-Dienste übertragen (nur lokale Prüfung). |
| `privacyTier` | `strict` \| `balanced` \| `max` | Erzwingt die Datenschutz-Stufe; `strict` lässt nur SHA-256-Hashes übertragen. |
| `viewMode` | `quiet` \| `private` \| `business` \| `research` \| `audit` | Legt die Darstellung fest (Informationsmenge/Unterbrechung). |
| `historyEnabled` | bool | Erzwingt den lokalen Verlauf an oder aus (Compliance). |
| `historyLimit` | 50–5000 | Maximale Zahl der Verlaufseinträge. |
| `alwaysManual` | bool | Verhindert automatische Uploads vollständig. |
| `timeOfClickProtection` | bool | Linkmarkierung in der Nachrichtenansicht. |
| `ipReputationProvider` | `none` \| `virustotal` \| `abuseipdb` | Reputationsprüfung von Absender-IPs. |
| `customWhitelist` / `customBlacklist` | Array | Domains/Absenderadressen, die nicht geprüft bzw. immer markiert werden. |

API-Schlüssel werden **nicht** zentral verteilt und bleiben beim Nutzer (jeder Nutzer nutzt sein eigenes Konto
bei den Analyse-Diensten – Fair-Use-Vorgabe der Anbieter).

## 2. Auslieferung

**Windows (Gruppenrichtlinie/Registry)**
1. `policy.json` ablegen, z. B. unter `C:\ProgramData\ThundyAV\policy.json`.
2. Registry-Schlüssel setzen (Firefox/Thunderbird-Konvention):
   `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Mozilla\Thunderbird\3rdparty\Extensions\thundy-av@bludau-it-services.de`
   mit dem Wert `path` (REG_SZ) auf die Datei.

**macOS (Configuration Profile)**
- Bevorzugt ein Konfigurationsprofil mit dem Nutzlast-Typ `com.mozilla.thunderbird.firefoxpolicies` bzw. dem
  Firefox-Nutzlastformat `3rdparty.Extensions`.

**Linux/Paketierung**
- Systemweite Policy-Dateien: `/etc/thunderbird/policies.json` bzw. `/etc/thunderbird/policies/policies.json`
  mit dem oben gezeigten Aufbau.

> Genaue Pfade je Version: Mozilla dokumentiert die `policies.json`-Mechanik unter „Firefox/Thunderbird Enterprise
deployment“. Da sich Pfade zwischen Versionen ändern können, bitte gegen die eigene Thunderbird-Version prüfen.

## 3. Wirkung prüfen

In den Add-on-Einstellungen, Abschnitt **Diagnose / Selbsttest** auf „Diagnose starten“ klicken. Der Punkt
„Enterprise-Policy“ zeigt die aktiven verwalteten Schlüssel; die Statistikansicht weist verwaltete Vorgaben ebenfalls
aus. Änderungen an der Policy greifen ohne Neustart (der Add-on hört auf `storage.onChanged` für `managed`).

## 4. Datenschutz

Verwaltete Vorgaben sind reine **Steuerungsdaten** aus der Geräte-Policy. Sie werden gelesen, aber nicht übertragen
und erscheinen nicht im Verlauf (nur die Auswirkungen, z. B. „keine Übertragung“).
