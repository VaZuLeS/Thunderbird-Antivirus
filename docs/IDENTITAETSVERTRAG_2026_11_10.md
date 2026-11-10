# AVN-009.f — konkretisierter Identitäts- und Migrationsvertrag

Stand: 10. November 2026. Forschungsvertrag für die vorbereitete 1.25.4; keine produktive Migration und keine zusätzliche Berechtigung. Der [Slot-/Scoregegenfall](IDENTITAET_FOLGEVERTRAG_2026_11_09.md) bleibt eine bestehende Einschränkung.

## Belegte API-Grenze

Das installierte Thunderbird 140.12.0 liefert `messages.json` im eigenen `omni.ja`, SHA-256 `4c6cf7726947fcb776db44ae0fb0ca1dee349650d114de98059fb5f470dce6b9`. Namespace `messages` verlangt `messagesRead`; `onMoved`, `onCopied`, `onDeleted` zusätzlich `accountsRead`. `move`/`copy` verlangen außerdem `messagesMove`. `onUpdated` ist mit `messagesRead` verfügbar, liefert aber keinen dauerhaften Vorkommensschlüssel. Das aktuelle Manifest besitzt weder `accountsRead` noch `messagesMove`. Das Prüfen nativer Ordneroperationen über privilegierte Testautomation beweist deshalb nicht, dass die Erweiterung deren Ereignisse selbst empfangen kann.

Die native 1.25.4-Probe bestätigt `onUpdated: available`, die drei genannten Vorkommensereignisse dagegen `unavailable` und `accountsRead: false`.

Eine vollständige ereignisgestützte Wiederbindung benötigt einen separat begründeten Berechtigungsauftrag und Abnahme auf Mindest-/aktueller Linie. Bis dahin gilt: neue Laufzeit bedeutet keine automatische Zuordnung alter Vorkommen. Ordnername, numerische Message-ID, Header-ID und bytegleiche Kopie reichen einzeln oder gemeinsam nicht als dauerhafter Vorkommensbeweis.

## Begriffe und Schreibvertrag

| Objekt | Identität und zulässige Verwendung |
| --- | --- |
| Laufzeit-Locator | Zufällige Laufzeit-ID plus numerische Nachrichten-ID. Nach Neustart ungültig; nur zur aktuellen Anzeige und laufenden Auftragsbindung. |
| Inhaltsnachweis | Das [v1-Schema](schemas/content-proof-v1.json) belegt ausschließlich exakt gelesene `getRaw(..., {decrypt:false})`-Bytes. SHA-256, Bytelänge und Algorithmusversion; kein Filtern lokaler Header, keine Unicode-/Zeilenenden-/MIME-Normalisierung. |
| Vorkommen | Eigene UUID. Eine bytegleiche Kopie bekommt eine eigene UUID. Ohne nachgewiesenes Ereignis wird keine frühere UUID übernommen. |
| Ressource | Anhang über tatsächlich gelesene Bytes/SHA-256, URL über die tatsächlich analysierte URL. Partslot und Dateiname sind Beschreibung, kein Identitätsbeweis. |
| Befund | Eigene UUID, Ressourcenbezug, Anbieter und typisierte Referenz, ursprüngliche Beobachtungszeit, Abschluss-/Fehlerstand. Ressourcenbefunde dürfen bei neuem passenden Nachweis referenziert werden; ihre Herkunft bleibt historisch. |
| Entscheidung | Bestehende Audit-ID und damaliger vollständiger Snapshot bleiben unverändert. Keine Vererbung über Inhalt, Vorkommen, Ressource oder Profilimport. |

Ein Rohdatenhash ist absichtlich konservativ: veränderte lokale Statusheader erzeugen einen anderen Nachweis. Das verhindert eine unbewiesene Gleichsetzung, löst aber keine dauerhafte Identität. Ein Hash über verschlüsselte Rohdaten belegt nur diese Hülle, nicht erfolgreiche Entschlüsselung oder vollständige Analyse. Fehlende/abgeschnittene Bytes erzeugen keinen bestätigten Nachweis. Der Forschungshelfer `tools/content-proof.dev.cjs` liest ausschließlich explizit angegebene Dateien und gibt keine Inhalte aus.

## Additive Persistenz für den späteren Implementierungsauftrag

Der bestehende Store und seine Schlüssel bleiben unverändert lesbar. Neue Bereiche werden getrennt vorgesehen: Vorkommen nach UUID, Inhaltsnachweise nach Algorithmus/Hash/Bytelänge, Ressourcenbefunde nach eigener UUID und explizite Beziehungen zwischen ihnen. Altbestände erhalten den Bindungsstatus `unconfirmed-legacy`; weder aktuelle Message-ID noch bloße Metadaten werden zur Bestätigung verwendet. Vorhandene Berichte bleiben als solche sichtbar, ohne als aktuelle abgeschlossene Prüfung ausgegeben zu werden.

Der spätere Schemawechsel darf erst nach Backend-/Cryptoabnahme festgelegt werden. Bis dahin bleibt die produktive IndexedDB-Version 3. Ein Folgemigrationsauftrag muss in einer Transaktion ausschließlich neue Datensätze/Beziehungen schreiben und eine versionierte Fortschrittsmarke setzen. Bei Abbruch wird die Transaktion zurückgerollt; Wiederholung ist idempotent. Beschädigte oder mehrdeutige Altbereiche werden nicht verändert. Kein Löschen/Umbenennen alter Schlüssel, keine rückwirkende Scoreberechnung, keine Änderung von Einwilligung oder Retention. Bei Kapazitätsmangel wird die neue Bindung verweigert; Originaldaten bleiben lesbar.

## Abnahmematrix und konkrete Stopbedingungen

1. Gleiche/fehlende Header-ID, anderer Text, gleicher Anhang und bytegleiche Kopien: Inhalts- und Vorkommensgleichheit getrennt ausweisen; bisherigen Scoregegenfall beibehalten, bis dessen produktiver Folgefix abgenommen ist.
2. Statusänderung, Kopieren, Verschieben, Löschen, Komprimieren und Neustart: lokale mbox und kontrolliertes IMAP getrennt prüfen. Fehlendes Ereignis oder unvollständiger Nachweis bedeutet keine Wiederbindung.
3. Erfolgreiche/teilweise/fehlende OpenPGP-/S/MIME-Entschlüsselung, Signaturen und verschachteltes MIME: Rohbytes und tatsächlich lesbare Ressourcen unabhängig vergleichen. Kein allgemeiner kanonischer Hash aus einer negativen Crypto-Fixture ableiten.
4. Voller Speicher, Commitfehler, parallele Writer, wiederholter Start und vollständiger Profilrestore: Originalbereiche und historische Audit-Snapshots müssen bytegleich bleiben. PENDING bleibt offen; OPENED bleibt Öffnungsannahme.

**Freigabegrenze:** Der konservative Rohbytevertrag und die Berechtigungsgrenze sind konkretisiert. Eine allgemeine dauerhafte Bindung, IMAP-/Cryptoabnahme und Migration sind damit nicht abgeschlossen. Diese Arbeit benötigt AVN-003/009.d sowie gegebenenfalls den separat abgenommenen Ereignis-/Berechtigungsauftrag.

Die [native Speicherabnahme](SPEICHERABNAHME_2026_11_10.md) liefert inzwischen abgegrenzte Commit-/Kapazitäts-/Restorebelege. Sie löst die Ereignis- und Vorkommensgrenze nicht; vollständiger lokaler/IMAP-Lifecycle und parallele Migrationswriter bleiben vor der Migration separat abzunehmen.

Die anschließende [IMAP-Lifecycleprobe](audits/imap-lifecycle-2026-11-10.json) beobachtet Kopieren, Verschieben, Flags, Löschen, Komprimieren und Neustart im realen Client am isolierten Dovecot. Änderungen erfolgen durch privilegierte Testautomation, nicht durch zusätzliche Add-on-Rechte. Laufzeit-IDs unterscheiden gleichzeitige Kopien; eine Wiederbindung über Neustart wird daraus weiterhin nicht abgeleitet. Die drei Vorkommensereignisse bleiben tatsächlich nicht verfügbar. Netz-/UIDVALIDITY-Wechsel und die weitere Clientmatrix sind noch nicht abgenommen.

Die [Parallelitäts-/Wiederanlaufprobe](SPEICHERWIEDERANLAUF_2026_11_10.md) bestätigt atomare Berichtsrevisionen und Abort-/Folgewriterverhalten im bestehenden Store. Sie konkretisiert AVN-009.d, ersetzt aber weder eine künftige Transaktion über mehrere Stores noch idempotente Migrationsmarker.
