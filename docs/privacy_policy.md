# Datenschutz und Datenflüsse — Thundy AV

Technischer Dokumentationsstand: 2. November 2026. Veröffentlicht: GitHub 1.24.2 (unsigniert); vorbereitet: 1.24.3. Dies beschreibt die echte Thunderbird-Erweiterung, nicht die separate React-Websimulation. Ansprechpartner: Jan Bludau, bludau.it.services@gmail.com. Quellcode: [VaZuLeS/Thunderbird-Antivirus](https://github.com/VaZuLeS/Thunderbird-Antivirus).

## Deutsch

Die Erweiterung liest angezeigte Nachrichten einschließlich Absender, Betreff, Kopfzeilen, Text, Links und Anhangmetadaten lokal. Die lokale Heuristik, HTML-Entschärfung und das lokale Linkaudit funktionieren ohne API-Schlüssel. Es gibt keine Telemetrie oder Entwickler-Analyseserver. Ein niedriger Score ist keine Sicherheitsgarantie.

Externe Analyse ist standardmäßig ausgeschaltet. Globales Opt-in, erforderliche optionale Daten-/Hostberechtigungen, ein konfigurierter Anbieter und die zulässige Datenschutzstufe werden zusätzlich geprüft. Automatische Nachrichtenscans benötigen eine Absenderfreigabe und beachten den manuellen Modus. „Nur diese Nachricht“ ist keine dauerhafte Absenderfreigabe. Manuelle Aktionen bleiben an Zustimmung, Berechtigung und Stufe gebunden.

### Datenmatrix

| Aktion / Dienst | Übertragene Daten | Stufe und weitere Voraussetzungen |
| --- | --- | --- |
| Lokale Risikoauswertung / HTML entschärfen / Audit lesen | keine externe Übertragung | ohne Zustimmung und ohne Schlüssel verfügbar |
| Hybrid Analysis / VirusTotal: Dateireputation | SHA-256 eines Anhangs | strict, balanced oder max; globales Opt-in, Schlüssel, Hostrecht und berechtigter Scanpfad |
| URLhaus: Domainreputation | Hostname der gefundenen Links | strict, balanced oder max; globales Opt-in, Schlüssel, Hostrecht; nur berechtigter Analysepfad |
| AbuseIPDB / VirusTotal: IP-Reputation | öffentliche IP aus Received-Kopfzeilen | strict, balanced oder max; ausdrücklich konfigurierter IP-Anbieter, Schlüssel, Opt-in und Hostrecht |
| Hybrid Analysis: Datei-Upload | vollständiger Anhang plus Anbieternachfrage-Metadaten | ab balanced; Opt-in, Schlüssel, Hostrecht, freigegebener Scan oder manuelle Aktion; Typ-/Größenlimits gelten |
| Hybrid Analysis: URL-Analyse | vollständige URL, einschließlich Query/Fragment soweit im Eingabewert enthalten | nur max; Opt-in, Schlüssel, Hostrecht und freigegebener automatischer oder manueller Scan |
| urlscan.io: Time-of-Click-Analyse | vollständige URL | nur max; ausdrückliche Linkaktion, Opt-in, Schlüssel und Hostrecht; Ergebnisabruf authentifiziert |
| Gespeicherten fertigen Bericht anzeigen | keine zusätzliche Übertragung | lokal lesbar, auch nach Widerruf; erneuter Abruf benötigt wieder Zustimmung/Rechte |
| Enterprise-Profil wählen/exportieren | keine Verbindung; deaktivierter Entwurf | keine Aktivierung durch Auswahl |
| Node-Offline-Audit-Review | lokale Datei wird gelesen, kein Netzverkehr | expliziter CLI-Aufruf; minimierter Report, kein authentifizierter Enterprise-Ingest |

**Strikt bedeutet nicht „ausschließlich Hashes“:** bei ausdrücklich konfigurierten und freigegebenen Reputationspfaden können auch Domains und öffentliche IPs übertragen werden. Vollständige URL-Übertragung verlangt max; Datei-Upload mindestens balanced. Ohne globales Opt-in wird keiner dieser externen Pfade ausgeführt.

Anfragen gehen direkt an Hybrid Analysis (`hybrid-analysis.com`), VirusTotal (`www.virustotal.com`), URLhaus (`urlhaus-api.abuse.ch`), urlscan.io (`urlscan.io`) oder AbuseIPDB (`api.abuseipdb.com`). Die Bedingungen und Datenschutzhinweise des gewählten Anbieters gelten zusätzlich; Verarbeitung und Weitergabe außerhalb des eigenen Systems sind möglich. Hashes können bekannte Dateien identifizieren, Domains/IPs können Korrespondenzbezüge erkennen lassen. Vollständige URLs können personenbezogene Daten, Zugriffstoken und vertrauliche Pfade enthalten. urlscan-Anfragen sind „unlisted“, nicht privat. Nur freigegebene Test-/Arbeitsdaten übermitteln.

### Kontrolle und lokale Daten

Widerruf stoppt neue Anfragen und bricht wartende/laufende Gateway-Anfragen ab. Der Popup-Lebenszyklus verwirft ungültig gewordene verspätete Ergebnisse und Pollingtimer. Bereits übertragene Daten lassen sich damit nicht zurückholen; anbieterinterne Aufbewahrung und Löschmöglichkeiten richten sich nach dessen Bedingungen.

Einstellungen, Zustimmung, Absenderfreigaben und API-Schlüssel liegen in `browser.storage.local` im Thunderbird-Profil. Schlüssel sind dort nicht gesondert verschlüsselt. Der Profil-/Betriebssystemschutz ist maßgeblich. Keine Schlüssel in Exportdateien, Tickets oder Versionskontrolle ablegen.

Analyseergebnisse liegen in IndexedDB, begrenzt auf 1.000 Nachrichten und 30 Tage, bereinigt beim Datenbanköffnen. Auditdaten liegen separat lokal: höchstens 30 Tage, 2.000 Einträge und 2 MiB, bereinigt bei Audit-Lese-/Schreibzugriffen. Dies sind auslösergebundene Bereinigungen, keine minutengenaue Löschzusage für einen dauerhaft unbenutzten Speicher. Memoryreputation verfällt nach 15 Minuten bei Zugriff; sie ist kein dauerhaftes Archiv.

Das Audit enthält vollständige URL, Nachrichtenkennung, Zeitpunkt, Score/Prüfstand und damalige Entscheidungssnapshots; Gründe können Absender-/Domainangaben enthalten. `OPENED` bestätigt nur die von Thunderbird angenommene Öffnungsanforderung, weder Browserstart noch Besuch. `PENDING` bleibt nach Prozessverlust offen. Neuere Ergebnisse ändern die damalige Entscheidung nicht. Der Profilnutzer kann lokale Daten ändern/löschen; der JSON-Prüfhash beweist keine unabhängige Authentizität.

„Cache leeren“, „Linkprotokoll löschen“ und Entfernen von Absenderfreigaben sind getrennte Aktionen. Ein Upgrade erteilt keine Zustimmung und schreibt historische Entscheidungen nicht neu. Exportierte JSON-/CSV-Dateien und Profilbackups liegen außerhalb der automatischen Extensionbereinigung; ihre Besitzer müssen sie separat schützen und löschen. Ein Backup-Restore stellt nur den Sicherungsstand wieder her. [Dateninventar und Wiederherstellung](DATENLEBENSZYKLUS.md).

## English

The extension reads the displayed message locally, including sender, subject, headers, text, links and attachment metadata. Local checks, HTML disarming and the local audit work without API credentials. There is no telemetry or developer analysis server. A low score is not a guarantee of safety.

External access requires global opt-in, the relevant optional data/host permissions, provider configuration and the permitted privacy tier. Automatic scans additionally require sender authorization and respect manual mode. A one-off scan does not permanently authorize a sender. Manual actions remain subject to consent, permissions and tier checks.

| Action / service | Data | Required tier / conditions |
| --- | --- | --- |
| Local assessment, sanitization, audit review | no external transmission | available without keys or consent |
| Hybrid Analysis / VirusTotal file reputation | attachment SHA-256 | strict or higher; opt-in, key, host right and authorized action |
| URLhaus domain lookup | link hostname | strict or higher; opt-in, key, host right, authorized analysis path |
| AbuseIPDB / VirusTotal IP reputation | public IP from Received headers | strict or higher; explicitly configured provider, opt-in, key and host right |
| Hybrid Analysis file upload | complete attachment and request metadata | balanced or max; opt-in, key, host right and authorized scan/manual action; type/size limits apply |
| Hybrid Analysis full URL scan | complete URL, potentially including private query data | max only; opt-in, key, host right and authorized action |
| urlscan.io click-time scan | complete URL | max only; explicit link action, opt-in, key and host right |
| Stored final report | no new transmission | available locally after consent withdrawal |
| Enterprise profiles and offline review | local configuration or explicitly selected file | no connection or service activation |

Strict is not hash-only: authorized domain and public-IP reputation may also run. Full URL uploads require max; full file uploads require balanced or max. No external path runs without global opt-in. Providers receive requests directly and apply their own terms, sharing and retention practices. urlscan submissions are unlisted, not private. URLs can contain identities and access tokens; hashes can identify known files.

Withdrawing consent blocks new transfers and aborts pending gateway work. It cannot recall data already sent. Keys and preferences are stored in the Thunderbird profile without separate key encryption. IndexedDB scan records are pruned on database opening (30 days / 1,000 messages). The independent audit is pruned on audit reads/writes (30 days / 2,000 records / 2 MiB). These are trigger-based limits, not a scheduled exact deletion time. Memory reputation expires after 15 minutes on access.

The audit keeps complete URLs and historical assessment/decision snapshots. OPENED means Thunderbird accepted an opening request, not that a browser started or a website was visited. PENDING remains incomplete after process loss. Later assessments do not rewrite the original decision. The local profile owner can modify the log; an unkeyed export checksum does not authenticate it.

Cache deletion, audit deletion and sender-authorization removal are separate. Upgrades do not grant consent. Exported files and profile backups require separate access control and deletion. Restoring a backup restores its snapshot, not later decisions. The React web demo is a separate simulation: do not enter confidential mail or real keys there.

## Ergänzung: lokaler Supportexport des weiterentwickelten Kandidaten

DE: In den Einstellungen können Sie einen minimierten technischen Bericht zunächst prüfen und dann lokal speichern. Grobe Einstellungen sind optional. Der Bericht enthält keine Schlüssel, Nachrichten, Roh-URLs, Absenderlisten, Profilkennungen oder Fehlerfreitexte. Kein automatischer Versand. Exportdateien müssen Sie selbst schützen und löschen.

EN: Settings offer a minimal technical report with a preview and explicit local download. Coarse configuration is optional. No keys, messages, raw URLs, sender lists, profile identifiers or free-form errors are included. No automatic transmission. Protect and delete exported files separately.

FR : Les paramètres proposent un rapport technique minimal avec aperçu et téléchargement local explicite. Les réglages généraux sont facultatifs. Aucune clé, aucun message, aucune URL brute, liste d’expéditeurs, identification de profil ou erreur en texte libre n’est inclus. Aucun envoi automatique. Protégez et supprimez vous-même les fichiers exportés.

ES: Los ajustes ofrecen un informe técnico mínimo con vista previa y descarga local explícita. La configuración general es opcional. No incluye claves, mensajes, URL completas, listas de remitentes, identificadores de perfil ni errores en texto libre. Sin envío automático. Proteja y elimine los archivos exportados por separado.

IT: Le impostazioni offrono un rapporto tecnico minimo con anteprima e download locale esplicito. La configurazione generale è facoltativa. Non include chiavi, messaggi, URL complete, elenchi di mittenti, identificativi del profilo o errori a testo libero. Nessun invio automatico. Proteggi ed elimina separatamente i file esportati.

PL: Ustawienia udostępniają minimalny raport techniczny z podglądem i wyraźnie wybranym pobraniem lokalnym. Ogólna konfiguracja jest opcjonalna. Raport nie zawiera kluczy, wiadomości, pełnych adresów URL, list nadawców, identyfikatorów profilu ani dowolnych tekstów błędów. Brak automatycznej wysyłki. Pliki eksportu należy samodzielnie chronić i usuwać.
