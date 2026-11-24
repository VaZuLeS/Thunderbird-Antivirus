---
layout: guide
lang: de
title: Datenschutz und Datenflüsse / Privacy and data flows
---

# Datenschutz und Datenflüsse — Thundy AV

[Deutsch](#deutsch) · [English](#english)

Ansprechpartner / Contact: Jan Bludau, bludau.it.services@gmail.com. [Quellcode / Source code](https://github.com/VaZuLeS/Thunderbird-Antivirus)

## Deutsch

Die Erweiterung liest angezeigte Nachrichten einschließlich Absender, Betreff, Kopfzeilen, Text, Links und Anhangmetadaten lokal. Die lokale Heuristik, HTML-Entschärfung und das lokale Linkaudit funktionieren ohne API-Schlüssel. Es gibt keine Telemetrie oder Entwickler-Analyseserver. Ein niedriger Score ist keine Sicherheitsgarantie.

Die Datenmatrix beschreibt die Thunderbird-Erweiterung ab Version 1.26.3. In [Release 1.26.2](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2) können passende automatische Scaneinstellungen ganze Dateien ab „Ausgewogen“ und ganze URLs bei „Maximal“ übertragen. Die Stufe „Strikt“ beschränkt Anbieterabfragen dort auf Reputationsdaten und zulässige Berichtsabfragen.

Externe Analyse ist standardmäßig ausgeschaltet. Sie benötigt eine globale Einwilligung, die erforderlichen optionalen Rechte, einen aktiven Anbieter und eine passende Datenschutzstufe. Der Scanmodus legt fest, ob Thundy alle geöffneten Nachrichten, nur freigegebene Absender oder Nachrichten auf Anforderung prüft. „Nur diese Nachricht“ erteilt keine dauerhafte Absenderfreigabe. Ein Verbindungstest sendet den Schlüssel und feste Testdaten an den gewählten Anbieter. Gewöhnliches Speichern der Einstellungen lässt die bestehende Einwilligung bestehen.

### Datenmatrix

| Aktion / Dienst | Übertragene Daten | Stufe und weitere Voraussetzungen |
| --- | --- | --- |
| Lokale Risikoauswertung / HTML entschärfen / Audit lesen | keine externe Übertragung | ohne Zustimmung und ohne Schlüssel verfügbar |
| Hybrid Analysis / VirusTotal: Dateireputation | SHA-256 eines Anhangs | strict, balanced oder max; globales Opt-in, Schlüssel, Hostrecht und berechtigter Scanpfad |
| URLhaus: Domainreputation | Hostname der gefundenen Links | strict, balanced oder max; globales Opt-in, Schlüssel, Hostrecht; nur berechtigter Analysepfad |
| AbuseIPDB / VirusTotal: IP-Reputation | öffentliche IP aus Received-Kopfzeilen | strict, balanced oder max; ausdrücklich konfigurierter IP-Anbieter, Schlüssel, Opt-in und Hostrecht |
| Hybrid Analysis: Datei-Upload | vollständiger Anhang plus Anbieternachfrage-Metadaten | ab balanced, Opt-in, Schlüssel, Hostrecht und Einzelfreigabe im Popup, Typ- und Größenlimits gelten |
| Hybrid Analysis: URL-Analyse | vollständige URL einschließlich Query und Fragment, falls vorhanden | nur max, Opt-in, Schlüssel, Hostrecht und Einzelfreigabe im Popup |
| urlscan.io: URL-Analyse | vollständige URL | nur max, Einzelfreigabe im Popup, Opt-in, Schlüssel und Hostrecht, Sichtbarkeit „unlisted“ |
| Gespeicherten fertigen Bericht anzeigen | keine zusätzliche Übertragung | lokal lesbar, auch nach Widerruf; erneuter Abruf benötigt wieder Zustimmung/Rechte |
| Enterprise-Profil wählen/exportieren | keine Verbindung; deaktivierter Entwurf | keine Aktivierung durch Auswahl |
| Node-Offline-Audit-Review | lokale Datei wird gelesen, kein Netzverkehr | expliziter CLI-Aufruf; minimierter Report, kein authentifizierter Enterprise-Ingest |

Automatische Reputationsprüfungen können Hashes, Domains und öffentliche IPs übertragen. Berichte lassen sich anhand bestehender Anbieterkennungen abrufen. Vollständige URLs und Dateien werden nur nach Einzelfreigabe versandt. Eine URL-Übertragung verlangt max, ein Datei-Upload mindestens balanced. Externe Prüfungen setzen globales Opt-in voraus.

Anfragen gehen direkt an Hybrid Analysis (`hybrid-analysis.com`), VirusTotal (`www.virustotal.com`), URLhaus (`urlhaus-api.abuse.ch`), urlscan.io (`urlscan.io`) oder AbuseIPDB (`api.abuseipdb.com`). Die Bedingungen und Datenschutzhinweise des gewählten Anbieters gelten zusätzlich; Verarbeitung und Weitergabe außerhalb des eigenen Systems sind möglich. Hashes können bekannte Dateien identifizieren, Domains/IPs können Korrespondenzbezüge erkennen lassen. Vollständige URLs können personenbezogene Daten, Zugriffstoken und vertrauliche Pfade enthalten. urlscan-Anfragen sind „unlisted“, nicht privat. Nur freigegebene Test-/Arbeitsdaten übermitteln.

### Kontrolle und lokale Daten

Firmenmeldungen haben eine eigene Zustimmung und sind standardmäßig aus. Bei verwalteten Schutzregeln können Ereignis-ID, Zeitpunkt, Aktion, Befund, Entscheidung und Richtlinienversion an den angegebenen Firmen-Endpunkt übertragen werden. Optional gehören der Hostname des Links oder der SHA-256 des Anhangs zum Ereignis. Ausstehende Meldungen werden höchstens 24 Stunden lokal zwischengespeichert. Der Widerruf für Firmenmeldungen löscht die Warteschlange. [Einrichtung und Datenfelder](UNTERNEHMENSRICHTLINIE.md)

Aktiviert die Firma den ausführlichen Modus und stimmt der Profilnutzer dem zu, können Auslöser, Scores, Dateiname, Anbieterurteile und Berichtsreferenzen hinzukommen. `reporting.detections` erweitert diesen Umfang nach erneuter Zustimmung um zugeordnete Namen, Kategorien, Signaturen und gegebenenfalls Marken. Der [Python-Empfänger](python-receiver.md#betrieb-und-meldungsinhalt) speichert Gruppierungsbezeichnungen mit den Ereignismetadaten. SMTP-Relay und Zielpostfach unterliegen den Regeln des Unternehmens.

Widerruf stoppt neue Anfragen und bricht wartende/laufende Gateway-Anfragen ab. Der Popup-Lebenszyklus verwirft ungültig gewordene verspätete Ergebnisse und Pollingtimer. Bereits übertragene Daten lassen sich damit nicht zurückholen; anbieterinterne Aufbewahrung und Löschmöglichkeiten richten sich nach dessen Bedingungen.

Einstellungen, Zustimmung, Absenderfreigaben und API-Schlüssel liegen in `browser.storage.local` im Thunderbird-Profil. Schlüssel sind dort nicht gesondert verschlüsselt. Der Profil-/Betriebssystemschutz ist maßgeblich. Keine Schlüssel in Exportdateien, Tickets oder Versionskontrolle ablegen.

Analyseergebnisse liegen in IndexedDB, begrenzt auf 1.000 Nachrichten und 30 Tage, bereinigt beim Datenbanköffnen. Das lokale Linkprotokoll speichert standardmäßig bis zu 2.000 Einträge für 30 Tage mit einem Größenlimit von 2 MiB. Die Administration kann eine andere Frist oder Höchstzahl festlegen oder beide Grenzen aufheben. Bei eigener Aufbewahrung speichert Thundy die Protokolle in einer separaten IndexedDB-Datenbank im Profil. Die Bereinigung erfolgt bei Zugriffen und beim Start. Memoryreputation verfällt nach 15 Minuten bei Zugriff.

Das Audit enthält vollständige URL, Nachrichtenkennung, Zeitpunkt, Score/Prüfstand und damalige Entscheidungssnapshots; Gründe können Absender-/Domainangaben enthalten. `OPENED` bestätigt nur die von Thunderbird angenommene Öffnungsanforderung, weder Browserstart noch Besuch. `PENDING` bleibt nach Prozessverlust offen. Neuere Ergebnisse ändern die damalige Entscheidung nicht. Der Profilnutzer kann lokale Daten ändern/löschen; der JSON-Prüfhash beweist keine unabhängige Authentizität.

„Cache leeren“, „Linkprotokoll löschen“ und Entfernen von Absenderfreigaben sind getrennte Aktionen. Ein Upgrade erteilt keine Zustimmung und schreibt historische Entscheidungen nicht neu. Exportierte JSON-/CSV-Dateien und Profilbackups liegen außerhalb der automatischen Extensionbereinigung; ihre Besitzer müssen sie separat schützen und löschen. Ein Backup-Restore stellt nur den Sicherungsstand wieder her. [Dateninventar und Wiederherstellung](DATENLEBENSZYKLUS.md).

## English

The matrix describes the Thunderbird extension from version 1.26.3. In [release 1.26.2](https://github.com/VaZuLeS/Thunderbird-Antivirus/releases/tag/v1.26.2), automatic scans can transmit whole files in Balanced or Maximum and whole URLs in Maximum when the matching settings are enabled. Strict limits traffic to reputation data and permitted report lookup in that build.

Company incident reporting is off by default and has a separate consent control. Under managed protection rules, reports can include the event ID, time, action, finding, decision and policy version, with an optional link hostname or attachment SHA-256. Pending reports are queued locally for up to 24 hours. Withdrawing reporting consent clears the pending queue. [Configuration and event fields](enterprise-policy.en.md)

Detailed mode requires approval and may include the decision reason, scores, attachment filename, provider verdicts and report references. Enabling `reporting.detections` and approving the expanded scope can add names, categories, signatures and identified brands. The [Python receiver](python-receiver.en.md#operations-and-email-contents) stores grouping labels with event metadata. The company relay and mailbox apply their own policies.

The extension reads the displayed message locally, including sender, subject, headers, text, links and attachment metadata. Local checks, HTML disarming and the local audit work without API credentials. There is no telemetry or developer analysis server. A low score is not a guarantee of safety.

External analysis requires global opt-in, the relevant optional permissions, an enabled provider and the permitted privacy tier. The scan mode controls whether Thundy checks all opened messages, approved senders only, or messages on request. A one-off scan does not permanently authorize a sender. A connection test sends the key and fixed test data to the chosen provider. Ordinary settings saves preserve existing consent.

| Action / service | Data | Required tier / conditions |
| --- | --- | --- |
| Local assessment, sanitization, audit review | no external transmission | available without keys or consent |
| Hybrid Analysis / VirusTotal file reputation | attachment SHA-256 | strict or higher; opt-in, key, host right and authorized action |
| URLhaus domain lookup | link hostname | strict or higher; opt-in, key, host right, authorized analysis path |
| AbuseIPDB / VirusTotal IP reputation | public IP from Received headers | strict or higher; explicitly configured provider, opt-in, key and host right |
| Hybrid Analysis file upload | complete attachment and request metadata | Balanced or Maximum, opt-in, key, host permission and individual confirmation in the popup, subject to type and size limits |
| Hybrid Analysis full URL scan | complete URL, potentially including private query data | Maximum, opt-in, key, host permission and individual confirmation in the popup |
| urlscan.io URL scan | complete URL | Maximum, opt-in, key, host permission and individual confirmation in the popup, with unlisted visibility |
| Stored final report | no new transmission | available locally after consent withdrawal |
| Enterprise profiles and offline review | local configuration or explicitly selected file | no connection or service activation |

Automatic and bulk checks can look up hashes, domains and public IPs with the required permissions. Accepted provider jobs can be queried by reference. Full links and files require individual confirmation. Providers receive requests directly and apply their own terms, sharing and retention practices. A urlscan report with unlisted visibility can be viewed by someone who obtains its report link. URLs can contain identities and access tokens. Hashes can identify known files.

Withdrawing consent blocks new transfers and aborts pending gateway work. It cannot recall data already sent. Keys and preferences are stored in the Thunderbird profile without separate key encryption. IndexedDB scan records are pruned on database opening (30 days / 1,000 messages). The local link audit defaults to 30 days, 2,000 entries and 2 MiB. Administrators may change the age and count limits independently or disable both. Custom retention uses a separate IndexedDB database in the profile. Pruning runs at startup and on audit access. Memory reputation expires after 15 minutes on access.

The audit keeps complete URLs and historical assessment/decision snapshots. OPENED means Thunderbird accepted an opening request, not that a browser started or a website was visited. PENDING remains incomplete after process loss. Later assessments do not rewrite the original decision. The local profile owner can modify the log; an unkeyed export checksum does not authenticate it.

Cache deletion, audit deletion and sender-authorization removal are separate. Upgrades do not grant consent. Exported files and profile backups require separate access control and deletion. Restoring a backup restores its snapshot, not later decisions. The React web demo is a separate simulation: do not enter confidential mail or real keys there.

## Ergänzung: lokaler Supportexport des weiterentwickelten Kandidaten

DE: In den Einstellungen können Sie einen minimierten technischen Bericht zunächst prüfen und dann lokal speichern. Grobe Einstellungen sind optional. Der Bericht enthält keine Schlüssel, Nachrichten, Roh-URLs, Absenderlisten, Profilkennungen oder Fehlerfreitexte. Kein automatischer Versand. Exportdateien müssen Sie selbst schützen und löschen.

EN: Settings offer a minimal technical report with a preview and explicit local download. Coarse configuration is optional. No keys, messages, raw URLs, sender lists, profile identifiers or free-form errors are included. No automatic transmission. Protect and delete exported files separately.

FR : Les paramètres proposent un rapport technique minimal avec aperçu et téléchargement local explicite. Les réglages généraux sont facultatifs. Aucune clé, aucun message, aucune URL brute, liste d’expéditeurs, identification de profil ou erreur en texte libre n’est inclus. Aucun envoi automatique. Protégez et supprimez vous-même les fichiers exportés.

ES: Los ajustes ofrecen un informe técnico mínimo con vista previa y descarga local explícita. La configuración general es opcional. No incluye claves, mensajes, URL completas, listas de remitentes, identificadores de perfil ni errores en texto libre. Sin envío automático. Proteja y elimine los archivos exportados por separado.

IT: Le impostazioni offrono un rapporto tecnico minimo con anteprima e download locale esplicito. La configurazione generale è facoltativa. Non include chiavi, messaggi, URL complete, elenchi di mittenti, identificativi del profilo o errori a testo libero. Nessun invio automatico. Proteggi ed elimina separatamente i file esportati.

PL: Ustawienia udostępniają minimalny raport techniczny z podglądem i wyraźnie wybranym pobraniem lokalnym. Ogólna konfiguracja jest opcjonalna. Raport nie zawiera kluczy, wiadomości, pełnych adresów URL, list nadawców, identyfikatorów profilu ani dowolnych tekstów błędów. Brak automatycznej wysyłki. Pliki eksportu należy samodzielnie chronić i usuwać.

## Ergänzung: lokaler Quellenbericht (ab 1.24.4)

EN: Create a local snapshot of the recorded checks. This does not run a new analysis. Current observations and stored history with unconfirmed association are kept separate. Includes services, states, verdicts and exact observation times. Excludes URLs, filenames, hashes, IPs, keys, message text and internal identifiers. Resource numbers apply only within this report. This is not a complete history or an authenticated record. Nothing is sent automatically. Review before sharing.

DE: Erstellt eine lokale Momentaufnahme der aufgezeichneten Prüfungen. Es startet keine neue Analyse. Aktuelle Beobachtungen und gespeicherte Historie mit unbestätigter Zuordnung bleiben getrennt. Enthält Dienste, Zustände, Bewertungen und genaue Beobachtungszeiten. Ohne URLs, Dateinamen, Hashes, IPs, Schlüssel, Mailtext und interne Kennungen. Ressourcennummern gelten nur innerhalb dieses Berichts. Keine vollständige Historie und kein authentifizierter Beleg. Es wird nichts automatisch übertragen. Vor dem Teilen prüfen.

FR: Crée un instantané local des vérifications enregistrées sans lancer de nouvelle analyse. Les observations actuelles et l’historique enregistré dont l’association n’est pas confirmée restent séparés. Contient les services, états, verdicts et heures exactes des observations. Exclut URL, noms de fichiers, empreintes, adresses IP, clés, texte des messages et identifiants internes. Les numéros de ressources sont propres à ce rapport. Ce n’est ni un historique complet ni une preuve authentifiée. Aucun envoi automatique. Vérifiez avant de partager.

ES: Crea una instantánea local de las comprobaciones registradas sin iniciar un nuevo análisis. Las observaciones actuales y el historial guardado con asociación sin confirmar se mantienen separados. Incluye servicios, estados, veredictos y horas exactas de observación. Excluye URL, nombres de archivo, hashes, IP, claves, texto de mensajes e identificadores internos. Los números de recursos solo se aplican a este informe. No es un historial completo ni una prueba autenticada. No se envía nada automáticamente. Revíselo antes de compartir.

IT: Crea un’istantanea locale dei controlli registrati senza avviare una nuova analisi. Le osservazioni attuali e la cronologia salvata con associazione non confermata restano separate. Include servizi, stati, verdetti e orari esatti delle osservazioni. Esclude URL, nomi di file, hash, IP, chiavi, testo dei messaggi e identificatori interni. I numeri delle risorse valgono solo in questo rapporto. Non è una cronologia completa né una prova autenticata. Nessun invio automatico. Verificare prima di condividere.

PL: Tworzy lokalny obraz zapisanych kontroli bez uruchamiania nowej analizy. Bieżące obserwacje i zapisana historia z niepotwierdzonym powiązaniem pozostają rozdzielone. Zawiera usługi, stany, werdykty i dokładne czasy obserwacji. Nie zawiera adresów URL, nazw plików, skrótów, adresów IP, kluczy, treści wiadomości ani wewnętrznych identyfikatorów. Numery zasobów obowiązują tylko w tym raporcie. To nie jest pełna historia ani uwierzytelniony dowód. Nic nie jest wysyłane automatycznie. Sprawdź przed udostępnieniem.

[Datenvertrag und Kontextgrenzen](QUELLENEXPORT.md).


## Ergänzung: optionaler API-Debugmodus (ab 1.25.7)

EN: Capture new API attempts locally to diagnose failures. Enable, reproduce the failure, then preview or export the report. Admin unlock is required when an admin password is set. Keys, private URLs, message contents and raw bodies are omitted; reference IDs are pseudonymized. Up to 100 entries / 1 MiB are kept in memory for one hour and lost on restart. Disabling clears the report. No additional service request is made.

DE: Neue API-Versuche lokal zur Fehlerdiagnose erfassen. Aktivieren, den Fehler reproduzieren und den Bericht ansehen oder exportieren. Bei gesetztem Adminpasswort ist eine Adminentsperrung nötig. Schlüssel, private URLs, Nachrichteninhalte und Rohdaten werden ausgelassen; Referenz-IDs werden pseudonymisiert. Höchstens 100 Einträge / 1 MiB bleiben eine Stunde im Arbeitsspeicher und gehen beim Neustart verloren. Deaktivieren leert den Bericht. Es erfolgt keine zusätzliche Dienstanfrage.

FR: Enregistrez localement les nouvelles tentatives API. Activez le mode, reproduisez l’erreur, puis consultez ou exportez le rapport. Le déverrouillage administrateur est requis si un mot de passe est défini. Les clés, URL privées, contenus des messages et données brutes sont omis ; les identifiants sont pseudonymisés. Jusqu’à 100 entrées / 1 Mio restent en mémoire pendant une heure et sont perdues au redémarrage. La désactivation efface le rapport. Aucune requête supplémentaire n’est envoyée.

ES: Registra localmente los nuevos intentos de API. Activa el modo, reproduce el error y consulta o exporta el informe. Se requiere desbloqueo de administrador si hay contraseña. Se omiten claves, URL privadas, mensajes y datos sin procesar; los identificadores se seudonimizan. Hasta 100 entradas / 1 MiB permanecen en memoria una hora y se pierden al reiniciar. Desactivar borra el informe. No se envían solicitudes adicionales.

IT: Registra localmente i nuovi tentativi API. Attiva la modalità, riproduci l’errore e visualizza o esporta il rapporto. Se è impostata una password amministratore, occorre sbloccare l’amministrazione. Chiavi, URL privati, messaggi e dati grezzi sono omessi; gli identificatori sono pseudonimizzati. Fino a 100 voci / 1 MiB restano in memoria per un’ora e si perdono al riavvio. La disattivazione cancella il rapporto. Nessuna richiesta aggiuntiva viene inviata.

PL: Zapisuj lokalnie nowe próby API. Włącz tryb, odtwórz błąd, a następnie wyświetl lub wyeksportuj raport. Jeśli ustawiono hasło administratora, wymagane jest odblokowanie administracji. Klucze, prywatne adresy URL, treść wiadomości i surowe dane są pomijane; identyfikatory są pseudonimizowane. Do 100 wpisów / 1 MiB pozostaje w pamięci przez godzinę i znika po ponownym uruchomieniu. Wyłączenie czyści raport. Nie są wysyłane dodatkowe żądania.

Der lokale Bericht enthält ausschließlich begrenzte projizierte Transport- und Antwortmetadaten. Er ist kein Rohmitschnitt. Die Einstellung bleibt im Profil, die Aufzeichnung nicht. Exportierte Dateien werden durch Ausschalten oder Leeren nicht gelöscht. Details: [API-Debugmodus](API_DEBUGMODUS_1_25_7.md).
