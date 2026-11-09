# urlscan.io: Kontingente und nachvollziehbare Wartezeiten

Ab 1.25.3 unterscheidet der gemeinsame Transport die Kontingente für Einreichungen, Ergebnisabrufe und Suche. Ein ausgeschöpftes Einreichungskontingent verhindert dadurch nicht den Abruf bereits bekannter Berichte. Hybrid Analysis wird davon nicht blockiert. Die vorhandenen Regeln für Einwilligung, Berechtigungen, Datenschutzstufe und Ressourcenbindung bleiben vor jedem Versand verbindlich.

## Verarbeitung

Das Anbieterregister beschreibt feste Aktionskennungen für öffentliche, nicht gelistete und private Einreichungen sowie Ergebnisabruf und Suche. Die tatsächlichen urlscan-Einreichungen der Erweiterung bleiben `unlisted`; die zusätzlichen Kennungen erlauben die korrekte Einordnung gemeldeter Kontingente und aktivieren keine weiteren Übertragungsarten. Die dokumentierten Aktionsheader dürfen eine Einreichung dem tatsächlich gemeldeten Sichtbarkeitskontingent zuordnen. Sie dürfen daraus kein Ergebnis- oder Suchkontingent machen.

Der Transport berücksichtigt `Retry-After` und die dokumentierten `X-Rate-Limit-*`-Header: Action, Scope, Window, Limit, Remaining, Reset und Reset-After. Null verbleibende Anfragen sind ein gültiger Wert. Bei erschöpftem Kontingent werden gültige Warteangaben zusammengeführt und die längste Wartezeit verwendet. Ohne brauchbare Angabe gilt bei HTTP 429 eine Minute. urlscan-Wartezeiten sind lokal auf 24 Stunden begrenzt; ein weiterhin erschöpftes Kontingent wird bei einer späteren Antwort erneut übernommen. Andere Anbieter behalten die bisherige Begrenzung von einer Stunde.

Bereits wartende Anfragen prüfen das Kontingent nach Erhalt des Transportplatzes erneut. Alle Bedienwege teilen weiterhin höchstens eine gleichzeitige urlscan-POST-Einreichung. POST-Anfragen werden nicht automatisch wiederholt. Die vorhandenen, begrenzten GET-Wiederholungen gelten nur bei kurzer Wartezeit und weiterhin gültiger Freigabe. Die fünfminütige Scanauftragsgrenze bleibt unverändert; eine längere Kontingentsperre verlängert einen Auftrag nicht.

Bei einem Schlüsselwechsel werden ausschließlich ausdrücklich benutzerbezogene urlscan-Wartezeiten verworfen. IP-bezogene oder nicht näher zugeordnete Sperren bleiben bestehen. Gleichzeitig gemeldete Benutzer- und IP-Sperren werden unabhängig verwaltet. Schlüssel, Schlüsselabdrücke, URLs und Auftragskennungen sind kein Bestandteil der Kontingentschlüssel. Die Sperren liegen nur im Hintergrundspeicher; nach einem Neustart wird ein fortbestehendes Anbieterkontingent erst durch eine neue Antwort bekannt.

## Darstellung und Export

Die Fachansicht in Popup und Nachricht zeigt die erlaubten Kontingentangaben, den gemeldeten Reset und den frühesten lokalen Wiederholungszeitpunkt. Eine lokal zurückgestellte Anfrage wird ausdrücklich als solche bezeichnet. Sie erhält weder eine neue Anbieterbeobachtungszeit noch einen erfundenen HTTP-Status oder Antwortzähler. Ein tatsächlich empfangenes HTTP 429 bleibt dagegen eine dokumentierte Anbieterantwort. Die Standardansicht verwendet weiterhin den verständlichen Kontingent-/Unvollständigkeitsstatus.

Der ausdrücklich ausgelöste lokale Quellenexport enthält dieselben erlaubten Kontingentfelder. Unbekannte Headerfelder werden verworfen; Authentifizierungsheader, Schlüssel und Passwörter werden nicht übernommen. Nach einer neuen erfolgreichen Anbieterantwort werden überholte Fehlermeldungen und Warteangaben ersetzt; Fehlerzähler und vorherige Gefahrenbefunde bleiben erhalten. Kontingentmetadaten verändern weder Anbieterurteile noch historische Linkentscheidungen.

## Verifizierte Dokumentation und Grenzen

Dokumentationsabgleich vom 9. November 2026:

- [Offizielle urlscan-Kontingentdokumentation](https://docs.urlscan.io/pages/api-rate-limits)
- [Offizielle API-Empfehlungen](https://docs.urlscan.io/pages/api-best-practices)
- [Offizielle Scan-API](https://docs.urlscan.io/apis/urlscan-openapi/scanning)

Automatisierte und native Prüfungen verwenden synthetische Antworten. Sie bestätigen die lokale Verarbeitung dokumentierter Felder, keine aktuelle Kontingentgröße oder reale Kontoberechtigung. Die [Hybrid-Fachansicht](HYBRID_FACHANSICHT.md) und die [gemeinsamen Bewertungsregeln](ANBIETER_AUSWERTUNG.md) beschreiben die davon unabhängige Berichtsauswertung.
