"use strict";
const crypto = require("node:crypto");
const { need, iso, hex, identifier } = require("./durable_journal.cjs");
const base = require("./heartbeats_review.cjs").labels;
const translations = {
  en: {
    packageTitle: "Verified review package",
    packageStatus:
      "File hashes verified and public configuration matched against a separately trusted reference. Package files were not extracted.",
    packageHash: "Package SHA-256",
    packageManifest: "Manifest SHA-256",
    packagePin: "External package hash check",
    packagePinned: "Independently supplied package hash matches",
    packageUnpinned: "No independent package hash supplied",
    packageEntries: "Verified package entries",
    packageHeadsPinned:
      "No separate journal head pin; the external package hash binds the complete package content",

    scopeProofVerified:
      "Alert and original device journals verified; historical report states matched.",
    proofVerified:
      "Both original journals were verified and all historical report states matched. Device reports remain self-reports. HTML and JSON are unsigned snapshots; verify the original journals again for a new review.",
    scopeProofEmpty:
      "Source comparison complete; these observations reference no original device reports.",
    proofEmpty:
      "Both journals were verified; no original device reports are referenced. This proves no device contact or health. HTML and JSON are unsigned snapshots.",
    sourceReview: "Independent source comparison",
    sourceProvidedHead: "Supplied source journal head",
    sourceFingerprint: "Source writer key fingerprint",
    sourcePinStatus: "External source head check",
    sourceObservations: "Matched observations",
    sourceDeviceComparisons: "Device state comparisons",
    sourceReferenced: "Referenced source actions",
    sourceUnreferenced: "Additional verified source actions",

    scopeProof:
      "Alert journal verified; original device signatures were not rechecked here.",
    candidateAt: "Evaluation that generated candidate (UTC)",
    page: "Page",
    reviewed: "Review created at (UTC)",
    title: "Test device alert review",
    intro:
      "Local, read-only review of explicitly registered test devices. No production fleet, enterprise access control or external delivery has been verified.",
    caveat:
      "Acknowledging receipt does not resolve a device problem. A recovery candidate means a recent signed report was received, not that the device is healthy.",
    proof:
      "The alert writer journal was verified. Original device signatures were not rechecked during this review. HTML and JSON export are unsigned snapshots; verify the original journals again for a new review.",
    snapshot:
      "Last worker evaluation (UTC); report states do not update automatically",
    notifications: "Alert candidates",
    pending: "Awaiting acknowledgement",
    acknowledged: "Receipt acknowledged",
    delivery: "Receipt status",
    search: "Search candidate, device, key or consumer identifier",
    kind: "Candidate type",
    severity: "Priority",
    high: "High",
    medium: "Medium",
    info: "Information",
    recovered: "Report became recent again",
    latest: "Report state at last worker evaluation",
    historical: "Report state when candidate was generated",
    first: "First detected late/old report (UTC)",
    ackAt: "Receipt acknowledged at (UTC)",
    consumer: "Local consumer identifier",
    details: "Times and evidence references",
    generated: "Generated at (UTC)",
    notificationId: "Candidate identifier",
    rule: "Rule version",
    sequence: "Device sequence",
    sourceHead: "Referenced heartbeat journal head",
    sourceCount: "Referenced heartbeat action count",
    sourcePin: "Source head check at that evaluation",
    sourcePinned: "Source head checked by worker",
    sourceUnpinned: "No source head check recorded",
    observation: "Alarm observation index",
    notEvaluated: "Not evaluated",
    registered: "Registered devices",
    showing: "Displayed / matching / total",
    download: "Export all candidates and device states (JSON)",
    empty: "No matching candidates; this does not establish healthy devices",
    noOutage: "No outage time recorded",
    devices: "Device report states at last evaluation",
    proofPin: "Alert journal head check",
  },
  de: {
    packageTitle: "Geprüftes Reviewpaket",
    packageStatus:
      "Dateihashes geprüft und öffentliche Konfiguration mit einer separat vertrauenswürdigen Vorgabe abgeglichen. Paketdateien wurden nicht entpackt.",
    packageHash: "Paket-SHA-256",
    packageManifest: "Manifest-SHA-256",
    packagePin: "Externe Paket-Hashprüfung",
    packagePinned: "Unabhängig vorgegebener Paket-Hash stimmt überein",
    packageUnpinned: "Kein unabhängiger Paket-Hash vorgegeben",
    packageEntries: "Geprüfte Paketeinträge",
    packageHeadsPinned:
      "Kein separater Journal-Endhash-Pin; der externe Paket-Hash bindet den vollständigen Paketinhalt",

    scopeProofVerified:
      "Alarm- und Original-Gerätejournal geprüft; historische Meldestände abgeglichen.",
    proofVerified:
      "Beide Originaljournale wurden geprüft und sämtliche historischen Meldestände abgeglichen. Gerätemeldungen bleiben Selbstauskünfte. HTML und JSON sind unsignierte Momentaufnahmen; für eine neue Review die Originaljournale erneut prüfen.",
    scopeProofEmpty:
      "Quellenabgleich vollständig; diese Beobachtungen referenzieren keine Original-Gerätemeldungen.",
    proofEmpty:
      "Beide Journale wurden geprüft; es sind keine Original-Gerätemeldungen referenziert. Dies belegt weder Gerätekontakt noch Gerätefunktion. HTML und JSON sind unsignierte Momentaufnahmen.",
    sourceReview: "Unabhängiger Quellenabgleich",
    sourceProvidedHead: "Endhash des mitgelieferten Quelljournals",
    sourceFingerprint: "Fingerabdruck des Quellwriter-Schlüssels",
    sourcePinStatus: "Externe Quell-Endhashprüfung",
    sourceObservations: "Abgeglichene Beobachtungen",
    sourceDeviceComparisons: "Vergleiche von Geräteständen",
    sourceReferenced: "Referenzierte Quellaktionen",
    sourceUnreferenced: "Zusätzliche geprüfte Quellaktionen",

    scopeProof:
      "Alarmjournal geprüft; Original-Gerätesignaturen wurden hier nicht erneut geprüft.",
    candidateAt: "Auswertung bei Kandidatenerzeugung (UTC)",
    page: "Seite",
    reviewed: "Review erstellt am (UTC)",
    title: "Testgeräte-Alarme prüfen",
    intro:
      "Lokale, nur lesende Review ausdrücklich registrierter Testgeräte. Keine produktive Flotte, zentrale Zugriffskontrolle oder externe Zustellung wurde abgenommen.",
    caveat:
      "Eine Übernahmebestätigung behebt kein Geräteproblem. Ein Erholungskandidat bedeutet eine wieder aktuelle signierte Meldung, keine bestätigte Gerätefunktion.",
    proof:
      "Das Alarmwriterjournal wurde geprüft. Original-Gerätesignaturen wurden bei dieser Review nicht erneut geprüft. HTML und JSON-Export sind unsignierte Momentaufnahmen; für eine neue Prüfung die Originaljournale erneut verifizieren.",
    snapshot:
      "Letzte Workerauswertung (UTC); Meldestatus aktualisiert sich nicht automatisch",
    notifications: "Alarmkandidaten",
    pending: "Übernahme ausstehend",
    acknowledged: "Übernahme bestätigt",
    delivery: "Übernahmestatus",
    search: "Kandidaten-, Geräte-, Schlüssel- oder Verbraucherkennung suchen",
    kind: "Kandidatentyp",
    severity: "Priorität",
    high: "Hoch",
    medium: "Mittel",
    info: "Information",
    recovered: "Meldung wieder aktuell",
    latest: "Meldestand bei letzter Workerauswertung",
    historical: "Meldestand bei Kandidatenerzeugung",
    first: "Erstmals verspätete/alte Meldung erkannt (UTC)",
    ackAt: "Übernahme bestätigt am (UTC)",
    consumer: "Lokale Verbraucherkennung",
    details: "Zeiten und Prüfreferenzen",
    generated: "Erzeugt am (UTC)",
    notificationId: "Kandidatenkennung",
    rule: "Regelversion",
    sequence: "Gerätesequenz",
    sourceHead: "Referenzierter Heartbeat-Endhash",
    sourceCount: "Referenzierte Heartbeat-Aktionszahl",
    sourcePin: "Quell-Endhashprüfung bei damaliger Auswertung",
    sourcePinned: "Quell-Endhash vom Worker geprüft",
    sourceUnpinned: "Keine Quell-Endhashprüfung protokolliert",
    observation: "Index der Alarmbeobachtung",
    notEvaluated: "Nicht ausgewertet",
    registered: "Registrierte Geräte",
    showing: "Angezeigt / passend / insgesamt",
    download: "Alle Kandidaten und Gerätestände exportieren (JSON)",
    empty: "Keine passenden Kandidaten; dies belegt keine gesunden Geräte",
    noOutage: "Keine Ausfallzeit erfasst",
    devices: "Gerätemeldestände bei letzter Auswertung",
    proofPin: "Alarmjournal-Endhashprüfung",
  },
  fr: {
    packageTitle: "Paquet de revue vérifié",
    packageStatus:
      "Empreintes des fichiers vérifiées et configuration publique comparée à une référence de confiance distincte. Aucun fichier du paquet n’a été extrait.",
    packageHash: "SHA-256 du paquet",
    packageManifest: "SHA-256 du manifeste",
    packagePin: "Vérification externe de l’empreinte du paquet",
    packagePinned: "L’empreinte indépendante fournie correspond au paquet",
    packageUnpinned: "Aucune empreinte indépendante du paquet fournie",
    packageEntries: "Entrées du paquet vérifiées",
    packageHeadsPinned:
      "Aucune empreinte de fin distincte ; l’empreinte externe du paquet lie tout son contenu",

    scopeProofVerified:
      "Journaux des alertes et des appareils vérifiés ; états historiques des rapports concordants.",
    proofVerified:
      "Les deux journaux originaux ont été vérifiés et tous les états historiques concordent. Les rapports restent des autodéclarations. HTML et JSON sont des instantanés non signés ; revérifiez les journaux originaux pour une nouvelle analyse.",
    scopeProofEmpty:
      "Comparaison des sources terminée ; ces observations ne référencent aucun rapport original d’appareil.",
    proofEmpty:
      "Les deux journaux ont été vérifiés ; aucun rapport original d’appareil n’est référencé. Cela ne prouve ni contact ni bon fonctionnement. HTML et JSON sont des instantanés non signés.",
    sourceReview: "Comparaison indépendante des sources",
    sourceProvidedHead: "Empreinte du journal source fourni",
    sourceFingerprint: "Empreinte de la clé du rédacteur source",
    sourcePinStatus: "Vérification externe de l’empreinte source",
    sourceObservations: "Observations concordantes",
    sourceDeviceComparisons: "Comparaisons des états des appareils",
    sourceReferenced: "Actions source référencées",
    sourceUnreferenced: "Actions source supplémentaires vérifiées",

    scopeProof:
      "Journal d’alertes vérifié ; signatures originales des appareils non revérifiées ici.",
    candidateAt: "Évaluation ayant généré l’alerte (UTC)",
    page: "Page",
    reviewed: "Revue créée le (UTC)",
    title: "Examiner les alertes des appareils de test",
    intro:
      "Vue locale en lecture seule des appareils de test explicitement enregistrés. Aucun parc de production, contrôle central des accès ou envoi externe n’a été validé.",
    caveat:
      "Un accusé de réception ne résout pas un problème d’appareil. Un rétablissement signifie un rapport signé redevenu récent, pas un appareil sain.",
    proof:
      "Le journal du rédacteur des alertes a été vérifié. Les signatures originales des appareils n’ont pas été revérifiées ici. Le HTML et l’export JSON sont des instantanés non signés ; revérifiez les journaux originaux pour une nouvelle analyse.",
    snapshot:
      "Dernière évaluation du worker (UTC) ; les états ne se mettent pas à jour automatiquement",
    notifications: "Alertes candidates",
    pending: "Réception à confirmer",
    acknowledged: "Réception confirmée",
    delivery: "État de réception",
    search:
      "Rechercher un identifiant d’alerte, d’appareil, de clé ou de consommateur",
    kind: "Type d’alerte",
    severity: "Priorité",
    high: "Élevée",
    medium: "Moyenne",
    info: "Information",
    recovered: "Rapport redevenu récent",
    latest: "État du rapport à la dernière évaluation",
    historical: "État du rapport lors de la création de l’alerte",
    first: "Premier rapport en retard/ancien détecté (UTC)",
    ackAt: "Réception confirmée le (UTC)",
    consumer: "Identifiant local du consommateur",
    details: "Dates et références de preuve",
    generated: "Créé le (UTC)",
    notificationId: "Identifiant de l’alerte",
    rule: "Version des règles",
    sequence: "Séquence de l’appareil",
    sourceHead: "Empreinte du journal de rapports référencé",
    sourceCount: "Nombre d’actions de rapports référencées",
    sourcePin: "Vérification de l’empreinte source à cette évaluation",
    sourcePinned: "Empreinte source vérifiée par le worker",
    sourceUnpinned: "Aucune vérification d’empreinte source enregistrée",
    observation: "Index de l’observation d’alerte",
    notEvaluated: "Non évalué",
    registered: "Appareils enregistrés",
    showing: "Affichés / correspondants / total",
    download: "Exporter toutes les alertes et états des appareils (JSON)",
    empty:
      "Aucune alerte correspondante ; cela ne prouve pas que les appareils sont sains",
    noOutage: "Aucune heure de panne enregistrée",
    devices: "États des rapports à la dernière évaluation",
    proofPin: "Vérification de l’empreinte du journal d’alertes",
  },
  es: {
    packageTitle: "Paquete de revisión verificado",
    packageStatus:
      "Hashes de archivos verificados y configuración pública contrastada con una referencia de confianza separada. No se extrajeron archivos del paquete.",
    packageHash: "SHA-256 del paquete",
    packageManifest: "SHA-256 del manifiesto",
    packagePin: "Verificación externa del hash del paquete",
    packagePinned:
      "El hash independiente proporcionado coincide con el paquete",
    packageUnpinned: "Sin hash independiente del paquete",
    packageEntries: "Entradas del paquete verificadas",
    packageHeadsPinned:
      "Sin hash final separado del registro; el hash externo del paquete vincula todo su contenido",

    scopeProofVerified:
      "Registros de alertas y de dispositivos originales verificados; estados históricos de informes contrastados.",
    proofVerified:
      "Se verificaron ambos registros originales y todos los estados históricos coincidieron. Los informes siguen siendo declaraciones propias. HTML y JSON son instantáneas sin firma; vuelva a verificar los registros originales para una nueva revisión.",
    scopeProofEmpty:
      "Comparación de fuentes completa; estas observaciones no hacen referencia a informes originales de dispositivos.",
    proofEmpty:
      "Se verificaron ambos registros; no hay informes originales de dispositivos referenciados. Esto no demuestra contacto ni buen funcionamiento. HTML y JSON son instantáneas sin firma.",
    sourceReview: "Comparación independiente de fuentes",
    sourceProvidedHead: "Hash del registro de origen proporcionado",
    sourceFingerprint: "Huella de la clave del escritor de origen",
    sourcePinStatus: "Verificación externa del hash de origen",
    sourceObservations: "Observaciones contrastadas",
    sourceDeviceComparisons: "Comparaciones de estados de dispositivos",
    sourceReferenced: "Acciones de origen referenciadas",
    sourceUnreferenced: "Acciones de origen adicionales verificadas",

    scopeProof:
      "Registro de alertas verificado; las firmas originales de dispositivos no se volvieron a verificar aquí.",
    candidateAt: "Evaluación que generó la alerta (UTC)",
    page: "Página",
    reviewed: "Revisión creada en (UTC)",
    title: "Revisar alertas de dispositivos de prueba",
    intro:
      "Revisión local de solo lectura de dispositivos de prueba registrados explícitamente. No se ha validado una flota de producción, el control central de acceso ni el envío externo.",
    caveat:
      "Confirmar la recepción no resuelve un problema del dispositivo. Una recuperación significa un informe firmado reciente, no un dispositivo sano.",
    proof:
      "Se verificó el registro del escritor de alertas. No se volvieron a verificar las firmas originales de los dispositivos. El HTML y la exportación JSON son instantáneas sin firma; vuelva a verificar los registros originales para una nueva revisión.",
    snapshot:
      "Última evaluación del worker (UTC); los estados no se actualizan automáticamente",
    notifications: "Alertas candidatas",
    pending: "Recepción pendiente",
    acknowledged: "Recepción confirmada",
    delivery: "Estado de recepción",
    search: "Buscar identificador de alerta, dispositivo, clave o consumidor",
    kind: "Tipo de alerta",
    severity: "Prioridad",
    high: "Alta",
    medium: "Media",
    info: "Información",
    recovered: "El informe vuelve a ser reciente",
    latest: "Estado del informe en la última evaluación",
    historical: "Estado del informe al generar la alerta",
    first: "Primer informe retrasado/antiguo detectado (UTC)",
    ackAt: "Recepción confirmada en (UTC)",
    consumer: "Identificador local del consumidor",
    details: "Fechas y referencias de evidencia",
    generated: "Generado en (UTC)",
    notificationId: "Identificador de alerta",
    rule: "Versión de reglas",
    sequence: "Secuencia del dispositivo",
    sourceHead: "Hash del registro de informes referenciado",
    sourceCount: "Número de acciones de informes referenciadas",
    sourcePin: "Verificación del hash de origen en esa evaluación",
    sourcePinned: "Hash de origen verificado por el worker",
    sourceUnpinned: "Sin verificación registrada del hash de origen",
    observation: "Índice de observación de alerta",
    notEvaluated: "Sin evaluar",
    registered: "Dispositivos registrados",
    showing: "Mostrados / coincidentes / total",
    download: "Exportar todas las alertas y estados de dispositivos (JSON)",
    empty:
      "Sin alertas coincidentes; esto no demuestra que los dispositivos estén sanos",
    noOutage: "Sin hora de fallo registrada",
    devices: "Estados de informes en la última evaluación",
    proofPin: "Verificación del hash del registro de alertas",
  },
  it: {
    packageTitle: "Pacchetto di revisione verificato",
    packageStatus:
      "Hash dei file verificati e configurazione pubblica confrontata con un riferimento attendibile separato. Nessun file del pacchetto è stato estratto.",
    packageHash: "SHA-256 del pacchetto",
    packageManifest: "SHA-256 del manifesto",
    packagePin: "Verifica esterna dell’hash del pacchetto",
    packagePinned: "L’hash indipendente fornito corrisponde al pacchetto",
    packageUnpinned: "Nessun hash indipendente del pacchetto fornito",
    packageEntries: "Voci del pacchetto verificate",
    packageHeadsPinned:
      "Nessun hash finale separato del registro; l’hash esterno del pacchetto vincola tutto il contenuto",

    scopeProofVerified:
      "Registri degli avvisi e dei dispositivi originali verificati; stati storici dei rapporti confrontati.",
    proofVerified:
      "Entrambi i registri originali sono stati verificati e tutti gli stati storici coincidono. I rapporti restano autodichiarazioni. HTML e JSON sono istantanee non firmate; verifica nuovamente i registri originali per una nuova analisi.",
    scopeProofEmpty:
      "Confronto delle fonti completato; queste osservazioni non fanno riferimento a rapporti originali dei dispositivi.",
    proofEmpty:
      "Entrambi i registri sono stati verificati; nessun rapporto originale dei dispositivi è referenziato. Ciò non prova contatto né buon funzionamento. HTML e JSON sono istantanee non firmate.",
    sourceReview: "Confronto indipendente delle fonti",
    sourceProvidedHead: "Hash del registro sorgente fornito",
    sourceFingerprint: "Impronta della chiave del redattore sorgente",
    sourcePinStatus: "Verifica esterna dell’hash sorgente",
    sourceObservations: "Osservazioni confrontate",
    sourceDeviceComparisons: "Confronti degli stati dei dispositivi",
    sourceReferenced: "Azioni sorgente referenziate",
    sourceUnreferenced: "Azioni sorgente aggiuntive verificate",

    scopeProof:
      "Registro degli avvisi verificato; firme originali dei dispositivi non ricontrollate qui.",
    candidateAt: "Valutazione che ha generato l’avviso (UTC)",
    page: "Pagina",
    reviewed: "Revisione creata il (UTC)",
    title: "Esamina gli avvisi dei dispositivi di test",
    intro:
      "Revisione locale in sola lettura dei dispositivi di test registrati esplicitamente. Nessuna flotta di produzione, controllo centrale degli accessi o consegna esterna è stato convalidato.",
    caveat:
      "Confermare la ricezione non risolve un problema del dispositivo. Un ripristino indica un rapporto firmato tornato recente, non un dispositivo funzionante.",
    proof:
      "Il registro del redattore degli avvisi è stato verificato. Le firme originali dei dispositivi non sono state ricontrollate. HTML ed esportazione JSON sono istantanee non firmate; verifica nuovamente i registri originali per una nuova analisi.",
    snapshot:
      "Ultima valutazione del worker (UTC); gli stati non si aggiornano automaticamente",
    notifications: "Avvisi candidati",
    pending: "Ricezione da confermare",
    acknowledged: "Ricezione confermata",
    delivery: "Stato di ricezione",
    search: "Cerca identificativo di avviso, dispositivo, chiave o consumatore",
    kind: "Tipo di avviso",
    severity: "Priorità",
    high: "Alta",
    medium: "Media",
    info: "Informazione",
    recovered: "Rapporto tornato recente",
    latest: "Stato del rapporto all’ultima valutazione",
    historical: "Stato del rapporto alla creazione dell’avviso",
    first: "Primo rapporto in ritardo/vecchio rilevato (UTC)",
    ackAt: "Ricezione confermata il (UTC)",
    consumer: "Identificativo locale del consumatore",
    details: "Date e riferimenti di prova",
    generated: "Generato il (UTC)",
    notificationId: "Identificativo dell’avviso",
    rule: "Versione delle regole",
    sequence: "Sequenza del dispositivo",
    sourceHead: "Hash del registro dei rapporti referenziato",
    sourceCount: "Numero di azioni dei rapporti referenziate",
    sourcePin: "Verifica dell’hash di origine in quella valutazione",
    sourcePinned: "Hash di origine verificato dal worker",
    sourceUnpinned: "Nessuna verifica dell’hash di origine registrata",
    observation: "Indice dell’osservazione dell’avviso",
    notEvaluated: "Non valutato",
    registered: "Dispositivi registrati",
    showing: "Visualizzati / corrispondenti / totale",
    download: "Esporta tutti gli avvisi e stati dei dispositivi (JSON)",
    empty:
      "Nessun avviso corrispondente; ciò non prova che i dispositivi siano funzionanti",
    noOutage: "Nessun orario di guasto registrato",
    devices: "Stati dei rapporti all’ultima valutazione",
    proofPin: "Verifica dell’hash del registro degli avvisi",
  },
  pl: {
    packageTitle: "Sprawdzony pakiet przeglądu",
    packageStatus:
      "Sprawdzono skróty plików i porównano konfigurację publiczną z osobnym zaufanym wzorcem. Nie wypakowano plików pakietu.",
    packageHash: "SHA-256 pakietu",
    packageManifest: "SHA-256 manifestu",
    packagePin: "Zewnętrzne sprawdzenie skrótu pakietu",
    packagePinned: "Podany niezależny skrót odpowiada pakietowi",
    packageUnpinned: "Nie podano niezależnego skrótu pakietu",
    packageEntries: "Sprawdzone wpisy pakietu",
    packageHeadsPinned:
      "Brak osobnego skrótu końcowego dziennika; zewnętrzny skrót pakietu wiąże całą jego zawartość",

    scopeProofVerified:
      "Sprawdzono oryginalne dzienniki alertów i urządzeń; porównano historyczne stany raportów.",
    proofVerified:
      "Sprawdzono oba oryginalne dzienniki i potwierdzono zgodność wszystkich historycznych stanów. Raporty pozostają deklaracjami urządzeń. HTML i JSON są niepodpisanymi migawkami; przed kolejną analizą ponownie zweryfikuj oryginalne dzienniki.",
    scopeProofEmpty:
      "Porównanie źródeł zakończone; te obserwacje nie wskazują żadnych oryginalnych raportów urządzeń.",
    proofEmpty:
      "Sprawdzono oba dzienniki; brak wskazanych oryginalnych raportów urządzeń. Nie dowodzi to kontaktu ani sprawności urządzeń. HTML i JSON są niepodpisanymi migawkami.",
    sourceReview: "Niezależne porównanie źródeł",
    sourceProvidedHead: "Skrót dostarczonego dziennika źródłowego",
    sourceFingerprint: "Odcisk klucza autora źródła",
    sourcePinStatus: "Zewnętrzne sprawdzenie skrótu źródła",
    sourceObservations: "Porównane obserwacje",
    sourceDeviceComparisons: "Porównania stanów urządzeń",
    sourceReferenced: "Wskazane działania źródłowe",
    sourceUnreferenced: "Dodatkowe sprawdzone działania źródłowe",

    scopeProof:
      "Dziennik alertów sprawdzony; oryginalne podpisy urządzeń nie zostały tu ponownie zweryfikowane.",
    candidateAt: "Ocena, która utworzyła alert (UTC)",
    page: "Strona",
    reviewed: "Przegląd utworzono o (UTC)",
    title: "Przegląd alertów urządzeń testowych",
    intro:
      "Lokalny przegląd tylko do odczytu jawnie zarejestrowanych urządzeń testowych. Nie zatwierdzono floty produkcyjnej, centralnej kontroli dostępu ani wysyłki zewnętrznej.",
    caveat:
      "Potwierdzenie odbioru nie rozwiązuje problemu urządzenia. Powrót świeżego podpisanego raportu nie oznacza, że urządzenie działa prawidłowo.",
    proof:
      "Sprawdzono dziennik autora alertów. Oryginalne podpisy urządzeń nie zostały ponownie sprawdzone. HTML i eksport JSON są niepodpisanymi migawkami; przed kolejną analizą ponownie zweryfikuj oryginalne dzienniki.",
    snapshot:
      "Ostatnia ocena workera (UTC); stany nie aktualizują się automatycznie",
    notifications: "Kandydaci na alerty",
    pending: "Odbiór oczekuje na potwierdzenie",
    acknowledged: "Odbiór potwierdzony",
    delivery: "Stan odbioru",
    search: "Szukaj identyfikatora alertu, urządzenia, klucza lub odbiorcy",
    kind: "Typ alertu",
    severity: "Priorytet",
    high: "Wysoki",
    medium: "Średni",
    info: "Informacja",
    recovered: "Raport ponownie świeży",
    latest: "Stan raportu podczas ostatniej oceny",
    historical: "Stan raportu przy utworzeniu alertu",
    first: "Pierwsze wykrycie spóźnionego/starego raportu (UTC)",
    ackAt: "Odbiór potwierdzony o (UTC)",
    consumer: "Lokalny identyfikator odbiorcy",
    details: "Czasy i odwołania do dowodów",
    generated: "Utworzono o (UTC)",
    notificationId: "Identyfikator alertu",
    rule: "Wersja reguł",
    sequence: "Sekwencja urządzenia",
    sourceHead: "Skrót wskazanego dziennika raportów",
    sourceCount: "Liczba wskazanych działań raportów",
    sourcePin: "Sprawdzenie skrótu źródła podczas tej oceny",
    sourcePinned: "Skrót źródła sprawdzony przez worker",
    sourceUnpinned: "Brak zapisanego sprawdzenia skrótu źródła",
    observation: "Indeks obserwacji alertu",
    notEvaluated: "Nie oceniono",
    registered: "Zarejestrowane urządzenia",
    showing: "Wyświetlone / pasujące / łącznie",
    download: "Eksportuj wszystkie alerty i stany urządzeń (JSON)",
    empty: "Brak pasujących alertów; nie dowodzi to sprawności urządzeń",
    noOutage: "Nie zapisano czasu awarii",
    devices: "Stany raportów podczas ostatniej oceny",
    proofPin: "Sprawdzenie skrótu dziennika alertów",
  },
};
const labels = Object.fromEntries(
  Object.entries(translations).map(([lang, text]) => [
    lang,
    {
      ...Object.fromEntries(
        "device,key,received,observed,unknown,head,fingerprint,all,previous,next,never,current,late,stale,revoked,notReported,pinned,unpinned"
          .split(",")
          .map((k) => [k, base[lang][k]]),
      ),
      ...text,
    },
  ]),
);
const states = ["NEVER_SEEN", "CURRENT", "LATE", "UNKNOWN", "REVOKED"],
  stateLabels = ["never", "current", "late", "stale", "revoked"];
const codes = [
    "HEARTBEAT_NEVER_SEEN",
    "HEARTBEAT_LATE",
    "HEARTBEAT_UNKNOWN",
    "HEARTBEAT_RECOVERED",
  ],
  codeLabels = ["never", "late", "stale", "recovered"];
const severities = ["info", "medium", "high"],
  delivery = ["PENDING", "ACKNOWLEDGED"],
  deliveryLabels = ["pending", "acknowledged"];
const notificationFields =
  "notificationId,ruleVersion,code,severity,keyId,deviceId,observedStatus,evaluatedAt,generatedAt,firstDetectedAt,lastReceivedAt,deviceObservedAt,sequence,sourceHead,sourceActionCount,sourceHeadPinned,observationIndex,status,acknowledgedAt,consumerId".split(
    ",",
  );
const deviceFields =
  "keyId,deviceId,status,receivedAt,observedAt,sequence,firstDetectedAt".split(
    ",",
  );
const positive = (n) => Number.isSafeInteger(n) && n > 0,
  count = (n) => Number.isSafeInteger(n) && n >= 0;
function project(report) {
  need(
    report?.kind === "thundy-local-heartbeat-alert-status" &&
      report.schemaVersion === 1 &&
      report.ruleVersion === 1 &&
      report.coverage === "explicit-test-registry-only" &&
      report.runtimeIntegrated === false &&
      report.productionFleetVerified === false &&
      report.externalDeliveryVerified === false &&
      report.sealed === false &&
      report.verification?.journalSignaturesVerified === true &&
      typeof report.verification.sourceDeviceEvidenceReverified === "boolean" &&
      typeof report.verification.headPinned === "boolean" &&
      hex(report.verification.signerFingerprint) &&
      (report.journalHead === null || hex(report.journalHead)) &&
      (report.sourceHead === null || hex(report.sourceHead)) &&
      count(report.sourceActionCount) &&
      (report.evaluatedAt === null || iso(report.evaluatedAt)) &&
      positive(report.registeredDevices) &&
      report.registeredDevices <= 1000 &&
      positive(report.maxPending) &&
      report.maxPending <= 10000 &&
      Array.isArray(report.devices) &&
      Array.isArray(report.notifications),
    "HEARTBEAT_ALERT_REVIEW_INVALID",
  );
  need(
    report.devices.length <= 1000 && report.notifications.length <= 10000,
    "HEARTBEAT_ALERT_REVIEW_CAPACITY",
  );
  let sourceComparison = null;
  if (report.sourceComparison !== undefined) {
    const c = report.sourceComparison;
    need(
      c?.schemaVersion === 1 &&
        c.kind === "thundy-heartbeat-history-comparison" &&
        c.comparisonComplete === true &&
        c.sourceJournalSignaturesVerified === true &&
        c.sourceDeviceSignaturesVerified === true &&
        c.sealed === false &&
        (c.sourceJournalHead === null || hex(c.sourceJournalHead)) &&
        hex(c.sourceSignerFingerprint) &&
        typeof c.sourceHeadPinned === "boolean" &&
        [
          c.observationCount,
          c.deviceComparisonCount,
          c.referencedSourceActionCount,
          c.unreferencedSourceActions,
          c.sourceActionCount,
        ].every(count) &&
        c.observationCount <= 10000 &&
        c.deviceComparisonCount <= 200000 &&
        c.sourceActionCount <= 10000 &&
        c.referencedSourceActionCount === report.sourceActionCount &&
        c.unreferencedSourceActions ===
          c.sourceActionCount - c.referencedSourceActionCount &&
        c.deviceComparisonCount ===
          c.observationCount * report.registeredDevices &&
        report.verification.sourceDeviceEvidenceReverified ===
          (c.observationCount > 0 && c.referencedSourceActionCount > 0),
      "HEARTBEAT_ALERT_REVIEW_INVALID",
    );
    sourceComparison = Object.fromEntries(
      "schemaVersion,kind,comparisonComplete,observationCount,deviceComparisonCount,referencedSourceActionCount,unreferencedSourceActions,sourceJournalHead,sourceActionCount,sourceHeadPinned,sourceSignerFingerprint,sourceJournalSignaturesVerified,sourceDeviceSignaturesVerified,sealed"
        .split(",")
        .map((k) => [k, c[k]]),
    );
  } else
    need(
      report.verification.sourceDeviceEvidenceReverified === false,
      "HEARTBEAT_ALERT_REVIEW_INVALID",
    );
  let packageVerification = null;
  if (report.packageVerification !== undefined) {
    const p = report.packageVerification;
    need(
      sourceComparison !== null &&
        p?.schemaVersion === 1 &&
        p.kind === "thundy-review-package-verification" &&
        hex(p.packageHash) &&
        typeof p.packageHashPinned === "boolean" &&
        p.externalConfigurationMatched === true &&
        p.entryHashesVerified === true &&
        p.entryCount === 3 &&
        hex(p.manifestHash) &&
        p.embeddedKeysTrustedAutomatically === false &&
        p.extracted === false &&
        p.sealed === false,
      "HEARTBEAT_ALERT_REVIEW_INVALID",
    );
    packageVerification = Object.fromEntries(
      "schemaVersion,kind,packageHash,packageHashPinned,externalConfigurationMatched,entryHashesVerified,entryCount,manifestHash,embeddedKeysTrustedAutomatically,extracted,sealed"
        .split(",")
        .map((k) => [k, p[k]]),
    );
  }
  const devices = report.devices.map((d) => {
    need(
      identifier(d.keyId) &&
        typeof d.deviceId === "string" &&
        d.deviceId.length <= 80 &&
        states.includes(d.status) &&
        (d.firstDetectedAt === null || iso(d.firstDetectedAt)) &&
        ((d.sequence === null &&
          d.receivedAt === null &&
          d.observedAt === null) ||
          (positive(d.sequence) && iso(d.receivedAt) && iso(d.observedAt))),
      "HEARTBEAT_ALERT_REVIEW_INVALID",
    );
    return Object.fromEntries(deviceFields.map((k) => [k, d[k]]));
  });
  need(
    new Set(devices.map((d) => d.deviceId)).size === devices.length &&
      new Set(devices.map((d) => d.keyId)).size === devices.length &&
      report.notEvaluatedDevices ===
        report.registeredDevices - devices.length &&
      report.notEvaluatedDevices >= 0 &&
      (report.evaluatedAt !== null ||
        (!devices.length && !report.notifications.length)),
    "HEARTBEAT_ALERT_REVIEW_INVALID",
  );
  const current = new Map(devices.map((d) => [d.deviceId, d]));
  const notifications = report.notifications.map((n) => {
    const i = codes.indexOf(n.code);
    need(
      hex(n.notificationId) &&
        n.ruleVersion === 1 &&
        i !== -1 &&
        n.severity === ["info", "medium", "high", "info"][i] &&
        n.observedStatus === ["NEVER_SEEN", "LATE", "UNKNOWN", "CURRENT"][i] &&
        delivery.includes(n.status) &&
        current.get(n.deviceId)?.keyId === n.keyId &&
        iso(n.evaluatedAt) &&
        iso(n.generatedAt) &&
        Date.parse(n.generatedAt) >= Date.parse(n.evaluatedAt) &&
        Date.parse(n.evaluatedAt) <= Date.parse(report.evaluatedAt) &&
        (i === 0
          ? n.firstDetectedAt === null
          : iso(n.firstDetectedAt) &&
            Date.parse(n.firstDetectedAt) <= Date.parse(n.evaluatedAt)) &&
        ((n.sequence === null &&
          n.lastReceivedAt === null &&
          n.deviceObservedAt === null) ||
          (positive(n.sequence) &&
            iso(n.lastReceivedAt) &&
            iso(n.deviceObservedAt))) &&
        (n.sourceHead === null || hex(n.sourceHead)) &&
        count(n.sourceActionCount) &&
        typeof n.sourceHeadPinned === "boolean" &&
        positive(n.observationIndex) &&
        (n.status === "PENDING"
          ? n.acknowledgedAt === null && n.consumerId === null
          : iso(n.acknowledgedAt) &&
            Date.parse(n.acknowledgedAt) >= Date.parse(n.generatedAt) &&
            identifier(n.consumerId)),
      "HEARTBEAT_ALERT_REVIEW_INVALID",
    );
    return Object.fromEntries(notificationFields.map((k) => [k, n[k]]));
  });
  need(
    new Set(notifications.map((n) => n.notificationId)).size ===
      notifications.length,
    "HEARTBEAT_ALERT_REVIEW_INVALID",
  );
  const pending = notifications.filter((n) => n.status === "PENDING").length;
  need(pending <= report.maxPending, "HEARTBEAT_ALERT_REVIEW_INVALID");
  return {
    schemaVersion: 1,
    kind: "thundy-unsigned-heartbeat-alert-review",
    reviewedAt: new Date().toISOString(),
    evaluatedAt: report.evaluatedAt,
    ruleVersion: 1,
    registeredDevices: report.registeredDevices,
    notEvaluatedDevices: report.notEvaluatedDevices,
    pending,
    acknowledged: notifications.length - pending,
    maxPending: report.maxPending,
    counts: Object.fromEntries(
      states.map((s) => [s, devices.filter((d) => d.status === s).length]),
    ),
    coverage: "explicit-test-registry-only",
    runtimeIntegrated: false,
    productionFleetVerified: false,
    externalDeliveryVerified: false,
    sealed: false,
    proof: {
      journalHead: report.journalHead,
      headPinned: report.verification.headPinned,
      signerFingerprint: report.verification.signerFingerprint,
      journalSignaturesVerified: true,
      sourceDeviceEvidenceReverified:
        report.verification.sourceDeviceEvidenceReverified,
    },
    sourceHead: report.sourceHead,
    sourceActionCount: report.sourceActionCount,
    ...(sourceComparison === null ? {} : { sourceComparison }),
    ...(packageVerification === null ? {} : { packageVerification }),
    devices,
    notifications,
  };
}
function client(
  data,
  l,
  language,
  states,
  stateLabels,
  codes,
  codeLabels,
  delivery,
  deliveryLabels,
) {
  const $ = (id) => document.getElementById(id),
    make = (tag, text) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      return e;
    };
  const number = (n) => new Intl.NumberFormat(language).format(n),
    time = (t) =>
      t === null
        ? l.notReported
        : new Intl.DateTimeFormat(language, {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "UTC",
          }).format(new Date(t));
  const current = new Map(data.devices.map((d) => [d.deviceId, d])),
    stateText = (s) => l[stateLabels[states.indexOf(s)]] ?? l.notEvaluated;
  const pair = (dl, label, value) =>
    dl.append(make("dt", label), make("dd", value));
  const ordered = [...data.notifications].sort(
    (a, b) =>
      b.observationIndex - a.observationIndex ||
      a.keyId.localeCompare(b.keyId) ||
      a.notificationId.localeCompare(b.notificationId),
  );
  let page = 0;
  function render() {
    const query = $("search").value.trim().toLocaleLowerCase(language);
    const rows = ordered.filter(
      (n) =>
        (!$("delivery").value || n.status === $("delivery").value) &&
        (!$("kind").value || n.code === $("kind").value) &&
        (!$("severity").value || n.severity === $("severity").value) &&
        (!$("freshness").value ||
          current.get(n.deviceId)?.status === $("freshness").value) &&
        [n.notificationId, n.deviceId, n.keyId, n.consumerId ?? ""]
          .join(" ")
          .toLocaleLowerCase(language)
          .includes(query),
    );
    const pages = Math.max(1, Math.ceil(rows.length / 25));
    page = Math.min(page, pages - 1);
    const shown = rows.slice(page * 25, (page + 1) * 25);
    $("cards").replaceChildren();
    for (const n of shown) {
      const article = make("article"),
        title = make("h3", l[codeLabels[codes.indexOf(n.code)]]),
        badges = make("div");
      const priority = make("span", l[n.severity]);
      priority.className = "badge " + n.severity;
      const receipt = make(
        "span",
        l[deliveryLabels[delivery.indexOf(n.status)]],
      );
      receipt.className = "badge attention";
      badges.className = "actions";
      badges.append(priority, receipt);
      const dl = make("dl");
      pair(dl, l.key, n.keyId);
      pair(dl, l.device, n.deviceId);
      pair(dl, l.latest, stateText(current.get(n.deviceId)?.status));
      pair(dl, l.historical, stateText(n.observedStatus));
      pair(dl, l.candidateAt, time(n.evaluatedAt));
      pair(
        dl,
        l.first,
        n.firstDetectedAt === null ? l.noOutage : time(n.firstDetectedAt),
      );
      pair(dl, l.ackAt, time(n.acknowledgedAt));
      pair(dl, l.consumer, n.consumerId ?? l.notReported);
      const details = make("details"),
        summary = make("summary", l.details),
        references = make("dl");
      pair(references, l.notificationId, n.notificationId);
      pair(references, l.kind, n.code);
      pair(references, l.rule, number(n.ruleVersion));
      pair(references, l.generated, time(n.generatedAt));
      pair(references, l.received, time(n.lastReceivedAt));
      pair(references, l.observed, time(n.deviceObservedAt));
      pair(
        references,
        l.sequence,
        n.sequence === null ? l.notReported : number(n.sequence),
      );
      pair(references, l.sourceHead, n.sourceHead ?? l.notReported);
      pair(references, l.sourceCount, number(n.sourceActionCount));
      pair(
        references,
        l.sourcePin,
        n.sourceHeadPinned ? l.sourcePinned : l.sourceUnpinned,
      );
      pair(references, l.observation, number(n.observationIndex));
      details.append(summary, references);
      article.append(title, badges, dl, details);
      $("cards").append(article);
    }
    if (!rows.length) $("cards").append(make("p", l.empty));
    $("results").textContent =
      l.showing +
      ": " +
      [shown.length, rows.length, data.notifications.length]
        .map(number)
        .join(" / ") +
      " · " +
      l.page +
      ": " +
      number(page + 1) +
      " / " +
      number(pages);
    $("previous").disabled = page === 0;
    $("next").disabled = page + 1 >= pages;
  }
  for (const id of ["search", "delivery", "kind", "severity", "freshness"])
    $(id).addEventListener(id === "search" ? "input" : "change", () => {
      page = 0;
      render();
    });
  $("previous").addEventListener("click", () => {
    page--;
    render();
  });
  $("next").addEventListener("click", () => {
    page++;
    render();
  });
  $("download").addEventListener("click", () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2) + "\n"], {
          type: "application/json",
        }),
      ),
      a = make("a");
    a.href = url;
    a.download = "thundy-heartbeat-alert-review.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const json = (s) =>
  JSON.stringify(s)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

const css =
  ":root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#f2f5fa;color:#18263a}main{max-width:1080px;margin:auto;padding:clamp(16px,4vw,40px)}header,section,footer,article{background:#fff;border:1px solid #ccd7e5;border-radius:16px;padding:20px;margin:16px 0}h1{font-size:clamp(24px,4vw,36px);line-height:1.2}h2{font-size:22px}h3{font-size:19px}h1,h2,h3,dd,li,p{overflow-wrap:anywhere}header{border-top:5px solid #176c80}.brand{font-weight:800;letter-spacing:.1em;color:#176c80}dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:8px 20px}dt{font-weight:650}dd{margin:0;min-width:0}ul{display:flex;flex-wrap:wrap;gap:10px;padding:0;list-style:none}li{background:#edf3f8;border-radius:10px;padding:10px 14px}.badge{display:inline-block;border-radius:8px;padding:5px 10px;font-weight:700}.recent{background:#d7f4e9;color:#173d32}.attention{background:#fff0c2;color:#4b3500}.filters{display:flex;flex-wrap:wrap;gap:18px;align-items:end}.filters label{display:flex;flex-direction:column;gap:5px;flex:1;min-width:180px}.filters .check{flex-direction:row;align-items:center}input,select,button{font:inherit;padding:9px 12px;border:1px solid #9aafbf;border-radius:8px;max-width:100%}input[type=search],select{width:100%;min-width:0}input[type=checkbox]{width:20px;height:20px;flex-shrink:0}button{cursor:pointer;background:#176c80;color:white}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ad6800;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:12px}footer{font-size:14px}article{background:#f8fafc}#results{font-weight:650}@media(prefers-color-scheme:dark){body{background:#101827;color:#e4edf8}header,section,footer{background:#18243a;border-color:#344560}article,li{background:#111d30;border-color:#344560}.brand{color:#8edee8}input,select{background:#111d30;color:#e4edf8}}@media(max-width:600px){dl{display:block}dd{margin:0 0 12px}header,section,footer,article{padding:16px}.filters label{min-width:0;flex-basis:100%}}@media print{.filters,.actions{display:none}body,header,section,footer,article{background:white;color:black}main{padding:0}}details{border-top:1px solid #ccd7e5;padding-top:12px}summary{cursor:pointer;font-weight:650;overflow-wrap:anywhere}summary:focus-visible{outline:3px solid #ad6800;outline-offset:3px}.high{background:#fce6e6;color:#681c1c}.medium{background:#fff0c2;color:#4b3500}.info{background:#e5f0ff;color:#183a64}";
function reviewHtml(report, language = "en") {
  need(Object.hasOwn(labels, language), "HEARTBEAT_ALERT_LANGUAGE_INVALID");
  const data = project(report),
    l = labels[language],
    nonce = crypto.randomBytes(18).toString("base64");
  const sourceChecked = data.sourceComparison !== undefined;
  const scopeProof = sourceChecked
    ? data.proof.sourceDeviceEvidenceReverified
      ? l.scopeProofVerified
      : l.scopeProofEmpty
    : l.scopeProof;
  const proof = sourceChecked
    ? data.proof.sourceDeviceEvidenceReverified
      ? l.proofVerified
      : l.proofEmpty
    : l.proof;
  const sourceDetails = !sourceChecked
    ? ""
    : `<section><h2>${esc(l.sourceReview)}</h2><dl>${[
        [
          l.sourceProvidedHead,
          data.sourceComparison.sourceJournalHead ?? l.notReported,
        ],
        [l.sourceFingerprint, data.sourceComparison.sourceSignerFingerprint],
        [
          l.sourcePinStatus,
          data.sourceComparison.sourceHeadPinned
            ? l.pinned
            : data.packageVerification?.packageHashPinned
              ? l.packageHeadsPinned
              : l.unpinned,
        ],
        [l.sourceObservations, data.sourceComparison.observationCount],
        [
          l.sourceDeviceComparisons,
          data.sourceComparison.deviceComparisonCount,
        ],
        [l.sourceReferenced, data.sourceComparison.referencedSourceActionCount],
        [l.sourceUnreferenced, data.sourceComparison.unreferencedSourceActions],
      ]
        .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`)
        .join("")}</dl></section>`;
  const packageDetails =
    data.packageVerification === undefined
      ? ""
      : `<section><h2>${esc(l.packageTitle)}</h2><p>${esc(l.packageStatus)}</p><dl>${[
          [l.packageHash, data.packageVerification.packageHash],
          [l.packageManifest, data.packageVerification.manifestHash],
          [
            l.packagePin,
            data.packageVerification.packageHashPinned
              ? l.packagePinned
              : l.packageUnpinned,
          ],
          [l.packageEntries, data.packageVerification.entryCount],
        ]
          .map(
            ([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`,
          )
          .join("")}</dl></section>`;
  const select = (id, label, values, text) =>
    `<label>${esc(label)}<select id="${id}"><option value="">${esc(l.all)}</option>${values.map((v, i) => `<option value="${v}">${esc(l[text[i]])}</option>`).join("")}</select></label>`;
  const deviceCounts =
    states
      .map(
        (s, i) =>
          `<li><strong>${data.counts[s]}</strong> ${esc(l[stateLabels[i]])}</li>`,
      )
      .join("") +
    `<li><strong>${data.notEvaluatedDevices}</strong> ${esc(l.notEvaluated)}</li>`;
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>Thundy AV · ${esc(l.title)}</title><style nonce="${nonce}">${css}</style></head><body><main><header><p class="brand">THUNDY AV</p><h1>${esc(l.title)}</h1><p>${esc(l.intro)}</p><p>${esc(l.caveat)}</p><p>${esc(scopeProof)}</p><dl><dt>${esc(l.reviewed)}</dt><dd>${esc(data.reviewedAt)}</dd><dt>${esc(l.snapshot)}</dt><dd>${esc(data.evaluatedAt ?? l.notEvaluated)}</dd><dt>${esc(l.registered)}</dt><dd>${data.registeredDevices}</dd></dl><ul><li><strong>${data.pending}</strong> ${esc(l.pending)}</li><li><strong>${data.acknowledged}</strong> ${esc(l.acknowledged)}</li></ul><h2>${esc(l.devices)}</h2><ul>${deviceCounts}</ul></header><section><h2>${esc(l.notifications)}</h2><div class="filters"><label>${esc(l.search)}<input id="search" type="search" autocomplete="off"></label>${select("delivery", l.delivery, delivery, deliveryLabels)}${select("kind", l.kind, codes, codeLabels)}${select("severity", l.severity, severities, severities)}${select("freshness", l.latest, states, stateLabels)}</div><p id="results" role="status" aria-live="polite"></p><div id="cards"></div><div class="actions"><button id="previous" type="button">${esc(l.previous)}</button><button id="next" type="button">${esc(l.next)}</button><button id="download" type="button">${esc(l.download)}</button></div></section>${sourceDetails}${packageDetails}<footer><p>${esc(proof)}</p><dl><dt>${esc(l.proofPin)}</dt><dd>${esc(data.proof.headPinned ? l.pinned : data.packageVerification?.packageHashPinned ? l.packageHeadsPinned : l.unpinned)}</dd><dt>${esc(l.head)}</dt><dd>${esc(data.proof.journalHead ?? l.notReported)}</dd><dt>${esc(l.fingerprint)}</dt><dd>${esc(data.proof.signerFingerprint)}</dd></dl></footer></main><script nonce="${nonce}">(${client.toString()})(${json(data)},${json(l)},${json(language)},${json(states)},${json(stateLabels)},${json(codes)},${json(codeLabels)},${json(delivery)},${json(deliveryLabels)});</script></body></html>`;
}
module.exports = { reviewHtml, project, labels };
