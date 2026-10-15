"use strict";
const { decorateHTML } = require("./design_system.cjs");
const crypto = require("node:crypto");
const labels = {
  en: {
    title: "Enterprise event review",
    limit:
      "Local development data. The server has stored these records in a local journal; protection against changes and deletion has not been confirmed. Thunderbird API acceptance does not confirm an OS browser launch or a website visit. Device keys were registered locally; corporate identities and SSO roles are not configured.",
    domain: "Domain",
    outcome: "Decision",
    score: "Minimum decision score",
    all: "All",
    unknown: "Unknown",
    pending: "Pending",
    opened: "Opening requested",
    aborted: "Cancelled",
    blocked: "Blocked",
    error: "Opening error",
    clicked: "Clicked",
    decided: "Decision time",
    received: "Server receipt time",
    atDecision: "Score at decision",
    latest: "Latest score",
    provider: "Verdict at decision",
    device: "Device",
    events: "Events",
    status: "Receipt",
    count: "Interactions",
    download: "Export verified source records",
    filter: "Filter",
    risk: "Opening requested at high risk",
    none: "No matching interactions",
    check:
      "Source records and signatures were checked during generation. Recheck them with the separately trusted server public key. A locally signed chain alone cannot detect removal of its tail without an independent checkpoint.",
  },
  de: {
    title: "Enterprise-Ereignisprüfung",
    limit:
      "Lokale Entwicklungsdaten. Der Server hat diese Datensätze im lokalen Journal gespeichert; ein Schutz gegen Änderung und Löschung ist nicht bestätigt. Eine von Thunderbird angenommene Öffnungsanforderung bestätigt weder den Browserstart durch das Betriebssystem noch einen Webseitenbesuch. Geräteschlüssel wurden lokal registriert; Unternehmensidentitäten und SSO-Rollen sind nicht eingerichtet.",
    domain: "Domain",
    outcome: "Entscheidung",
    score: "Mindestscore bei Entscheidung",
    all: "Alle",
    unknown: "Unbekannt",
    pending: "Offen",
    opened: "Öffnung angefordert",
    aborted: "Abgebrochen",
    blocked: "Gesperrt",
    error: "Öffnungsfehler",
    clicked: "Angeklickt",
    decided: "Entscheidungszeit",
    received: "Server-Empfangszeit",
    atDecision: "Score bei Entscheidung",
    latest: "Aktueller Score",
    provider: "Urteil bei Entscheidung",
    device: "Gerät",
    events: "Ereignisse",
    status: "Quittung",
    count: "Interaktionen",
    download: "Geprüfte Quelldatensätze exportieren",
    filter: "Filtern",
    risk: "Öffnung mit hohem Risiko angefordert",
    none: "Keine passenden Interaktionen",
    check:
      "Quelldatensätze und Signaturen wurden beim Erzeugen geprüft. Erneut mit dem separat vertrauenswürdig bezogenen Server-Public-Key prüfen. Eine lokal signierte Kette erkennt ohne unabhängigen Checkpoint kein Abschneiden ihres Endes.",
  },
  fr: {
    title: "Contrôle des événements Enterprise",
    limit:
      "Données de développement local. Le serveur a enregistré ces données dans un journal local ; leur protection contre la modification et la suppression n’est pas confirmée. Une demande acceptée par Thunderbird ne confirme ni le lancement du navigateur par le système ni une visite. Les clés des appareils sont enregistrées localement ; les identités d’entreprise et les rôles SSO ne sont pas configurés.",
    domain: "Domaine",
    outcome: "Décision",
    score: "Score minimal à la décision",
    all: "Tous",
    unknown: "Inconnu",
    pending: "En attente",
    opened: "Ouverture demandée",
    aborted: "Annulé",
    blocked: "Bloqué",
    error: "Erreur d’ouverture",
    clicked: "Cliqué",
    decided: "Heure de décision",
    received: "Heure de réception serveur",
    atDecision: "Score à la décision",
    latest: "Score actuel",
    provider: "Verdict à la décision",
    device: "Appareil",
    events: "Événements",
    status: "Reçu",
    count: "Interactions",
    download: "Exporter les données sources vérifiées",
    filter: "Filtrer",
    risk: "Ouverture demandée avec risque élevé",
    none: "Aucune interaction correspondante",
    check:
      "Données et signatures vérifiées à la génération. Revérifier avec une clé publique serveur obtenue par un canal fiable. Sans point de contrôle indépendant, la chaîne locale ne détecte pas la suppression de sa fin.",
  },
  es: {
    title: "Revisión de eventos Enterprise",
    limit:
      "Datos de desarrollo local. El servidor ha guardado estos registros en un diario local; no se ha confirmado la protección contra cambios y eliminación. Una solicitud aceptada por Thunderbird no confirma que el sistema iniciara un navegador ni una visita. Las claves de dispositivos se registraron localmente; las identidades empresariales y los roles SSO no están configurados.",
    domain: "Dominio",
    outcome: "Decisión",
    score: "Puntuación mínima al decidir",
    all: "Todos",
    unknown: "Desconocido",
    pending: "Pendiente",
    opened: "Apertura solicitada",
    aborted: "Cancelado",
    blocked: "Bloqueado",
    error: "Error de apertura",
    clicked: "Pulsado",
    decided: "Hora de decisión",
    received: "Recepción del servidor",
    atDecision: "Puntuación al decidir",
    latest: "Puntuación actual",
    provider: "Veredicto al decidir",
    device: "Dispositivo",
    events: "Eventos",
    status: "Recibo",
    count: "Interacciones",
    download: "Exportar registros fuente verificados",
    filter: "Filtrar",
    risk: "Apertura solicitada con riesgo alto",
    none: "No hay interacciones coincidentes",
    check:
      "Datos y firmas verificados al generar. Vuelva a verificar con una clave pública del servidor obtenida de forma fiable. Sin un punto de control independiente, la cadena local no detecta que se elimine su final.",
  },
  it: {
    title: "Revisione eventi Enterprise",
    limit:
      "Dati di sviluppo locale. Il server ha salvato questi dati nel registro locale; la protezione da modifiche e cancellazione non è confermata. Una richiesta accettata da Thunderbird non conferma né l’avvio del browser da parte del sistema né una visita. Le chiavi dei dispositivi sono registrate localmente; identità aziendali e ruoli SSO non sono configurati.",
    domain: "Dominio",
    outcome: "Decisione",
    score: "Punteggio minimo alla decisione",
    all: "Tutti",
    unknown: "Sconosciuto",
    pending: "In attesa",
    opened: "Apertura richiesta",
    aborted: "Annullato",
    blocked: "Bloccato",
    error: "Errore di apertura",
    clicked: "Cliccato",
    decided: "Ora della decisione",
    received: "Ricezione server",
    atDecision: "Punteggio alla decisione",
    latest: "Punteggio attuale",
    provider: "Verdetto alla decisione",
    device: "Dispositivo",
    events: "Eventi",
    status: "Ricevuta",
    count: "Interazioni",
    download: "Esporta dati sorgente verificati",
    filter: "Filtra",
    risk: "Apertura richiesta con rischio elevato",
    none: "Nessuna interazione corrispondente",
    check:
      "Dati e firme verificati alla generazione. Verificare di nuovo con una chiave pubblica server ottenuta da un canale fidato. Senza un checkpoint indipendente, la catena locale non rileva il taglio della sua parte finale.",
  },
  pl: {
    title: "Przegląd zdarzeń Enterprise",
    limit:
      "Lokalne dane testowe. Serwer zapisał te dane w lokalnym dzienniku; ochrona przed zmianą i usunięciem nie została potwierdzona. Przyjęcie żądania przez Thunderbirda nie potwierdza uruchomienia przeglądarki przez system ani wizyty na stronie. Klucze urządzeń zarejestrowano lokalnie; tożsamości firmowe i role SSO nie są skonfigurowane.",
    domain: "Domena",
    outcome: "Decyzja",
    score: "Minimalna ocena przy decyzji",
    all: "Wszystkie",
    unknown: "Nieznana",
    pending: "Oczekuje",
    opened: "Żądanie otwarcia",
    aborted: "Anulowano",
    blocked: "Zablokowano",
    error: "Błąd otwarcia",
    clicked: "Kliknięto",
    decided: "Czas decyzji",
    received: "Odbiór na serwerze",
    atDecision: "Ocena przy decyzji",
    latest: "Aktualna ocena",
    provider: "Werdykt przy decyzji",
    device: "Urządzenie",
    events: "Zdarzenia",
    status: "Potwierdzenie",
    count: "Interakcje",
    download: "Eksportuj sprawdzone dane źródłowe",
    filter: "Filtruj",
    risk: "Żądanie otwarcia przy wysokim ryzyku",
    none: "Brak pasujących interakcji",
    check:
      "Dane i podpisy sprawdzono podczas generowania. Sprawdź ponownie z zaufanym kluczem publicznym serwera. Bez niezależnego punktu kontrolnego lokalny łańcuch nie wykrywa usunięcia końcowych wpisów.",
  },
};
const storageLabels = {
  en: {
    storageTitle: "Storage status of this export",
    statusGuide: "What do the storage statuses mean?",
    staged: "Stored locally",
    stagedHelp:
      "The server has accepted the records and stored them durably in its local journal. This does not confirm protection against changes or deletion.",
    cloud: "Storage checked",
    cloudHelp:
      "The adapter has checked the object version, content and retention conditions through its storage client. This is not independent confirmation of a live cloud service or protected storage.",
    sealed: "Protected storage confirmed",
    sealedHelp:
      "Planned status: storage is protected against changes and deletion until a specified date and independently checked and confirmed. This status is not implemented yet.",
    status: "Server storage",
  },
  de: {
    storageTitle: "Speicherstatus dieses Exports",
    statusGuide: "Was bedeuten die Speicherstatus?",
    staged: "Lokal gespeichert",
    stagedHelp:
      "Der Server hat die Datensätze angenommen und dauerhaft in seinem lokalen Journal gespeichert. Ein Schutz gegen Änderung und Löschung ist damit nicht bestätigt.",
    cloud: "Speicher geprüft",
    cloudHelp:
      "Der Adapter hat Objektversion, Inhalt und Aufbewahrungsbedingungen über seinen Speicherclient geprüft. Das bestätigt noch keinen unabhängig geprüften Cloudbetrieb oder Ablageschutz.",
    sealed: "Geschützte Ablage bestätigt",
    sealedHelp:
      "Geplanter Status: Die Ablage ist bis zu einem festgelegten Datum gegen Änderung und Löschung geschützt und wurde unabhängig geprüft und bestätigt. Dieser Status ist noch nicht implementiert.",
    status: "Serverablage",
  },
  fr: {
    storageTitle: "État de stockage de cet export",
    statusGuide: "Que signifient les états de stockage ?",
    staged: "Enregistré localement",
    stagedHelp:
      "Le serveur a accepté les données et les a enregistrées durablement dans son journal local. Cela ne confirme pas leur protection contre la modification et la suppression.",
    cloud: "Stockage vérifié",
    cloudHelp:
      "L’adaptateur a vérifié la version, le contenu et les conditions de conservation via son client de stockage. Cela ne confirme pas indépendamment le service cloud ni la protection du stockage.",
    sealed: "Stockage protégé confirmé",
    sealedHelp:
      "État prévu : le stockage est protégé contre la modification et la suppression jusqu’à une date définie, puis vérifié et confirmé indépendamment. Cet état n’est pas encore implémenté.",
    status: "Stockage serveur",
  },
  es: {
    storageTitle: "Estado de almacenamiento de esta exportación",
    statusGuide: "¿Qué significan los estados de almacenamiento?",
    staged: "Guardado localmente",
    stagedHelp:
      "El servidor ha aceptado los registros y los ha guardado de forma duradera en su diario local. Esto no confirma la protección contra cambios y eliminación.",
    cloud: "Almacenamiento comprobado",
    cloudHelp:
      "El adaptador ha comprobado la versión, el contenido y las condiciones de conservación mediante su cliente de almacenamiento. Esto no confirma de forma independiente el servicio en la nube ni la protección del almacenamiento.",
    sealed: "Almacenamiento protegido confirmado",
    sealedHelp:
      "Estado previsto: el almacenamiento está protegido contra cambios y eliminación hasta una fecha definida, con verificación y confirmación independientes. Este estado aún no está implementado.",
    status: "Almacenamiento del servidor",
  },
  it: {
    storageTitle: "Stato di archiviazione di questa esportazione",
    statusGuide: "Che cosa significano gli stati di archiviazione?",
    staged: "Salvato localmente",
    stagedHelp:
      "Il server ha accettato i dati e li ha salvati in modo duraturo nel registro locale. Ciò non conferma la protezione da modifiche e cancellazione.",
    cloud: "Archiviazione verificata",
    cloudHelp:
      "L’adattatore ha verificato versione, contenuto e condizioni di conservazione tramite il client di archiviazione. Ciò non conferma in modo indipendente il servizio cloud né la protezione dell’archiviazione.",
    sealed: "Archiviazione protetta confermata",
    sealedHelp:
      "Stato previsto: l’archiviazione è protetta da modifiche e cancellazione fino a una data definita, con verifica e conferma indipendenti. Questo stato non è ancora implementato.",
    status: "Archiviazione sul server",
  },
  pl: {
    storageTitle: "Stan przechowywania tego eksportu",
    statusGuide: "Co oznaczają stany przechowywania?",
    staged: "Zapisano lokalnie",
    stagedHelp:
      "Serwer przyjął dane i trwale zapisał je w lokalnym dzienniku. Nie potwierdza to ochrony przed zmianą i usunięciem.",
    cloud: "Sprawdzono przechowywanie",
    cloudHelp:
      "Adapter sprawdził wersję obiektu, zawartość i warunki przechowywania przez klienta magazynu. Nie potwierdza to niezależnie działania chmury ani ochrony przechowywanych danych.",
    sealed: "Potwierdzono chronione przechowywanie",
    sealedHelp:
      "Planowany stan: dane są chronione przed zmianą i usunięciem do ustalonej daty, a ochrona została niezależnie sprawdzona i potwierdzona. Ten stan nie został jeszcze wdrożony.",
    status: "Magazyn serwera",
  },
};
const paging = {
  en: { previous: "Previous page", next: "Next page" },
  de: { previous: "Vorherige Seite", next: "Nächste Seite" },
  fr: { previous: "Page précédente", next: "Page suivante" },
  es: { previous: "Página anterior", next: "Página siguiente" },
  it: { previous: "Pagina precedente", next: "Pagina successiva" },
  pl: { previous: "Poprzednia strona", next: "Następna strona" },
};
const verdicts = {
  en: [
    "No threat reported",
    "Suspicious",
    "Malicious",
    "Visually malicious",
    "Error",
    "Timed out",
    "Not checked",
  ],
  de: [
    "Keine Bedrohung gemeldet",
    "Verdächtig",
    "Schädlich",
    "Visuell schädlich",
    "Fehler",
    "Zeitüberschreitung",
    "Nicht geprüft",
  ],
  fr: [
    "Aucune menace signalée",
    "Suspect",
    "Malveillant",
    "Visuellement malveillant",
    "Erreur",
    "Délai dépassé",
    "Non vérifié",
  ],
  es: [
    "Sin amenaza notificada",
    "Sospechoso",
    "Malicioso",
    "Visualmente malicioso",
    "Error",
    "Tiempo agotado",
    "Sin comprobar",
  ],
  it: [
    "Nessuna minaccia segnalata",
    "Sospetto",
    "Malevolo",
    "Visivamente malevolo",
    "Errore",
    "Tempo scaduto",
    "Non verificato",
  ],
  pl: [
    "Nie zgłoszono zagrożenia",
    "Podejrzany",
    "Złośliwy",
    "Wizualnie złośliwy",
    "Błąd",
    "Przekroczony czas",
    "Nie sprawdzono",
  ],
};
for (const language of Object.keys(labels)) {
  Object.assign(labels[language], paging[language], storageLabels[language]);
  labels[language].verdicts = {
    UNKNOWN: labels[language].unknown,
    ...Object.fromEntries(
      [
        "CLEAN",
        "SUSPICIOUS",
        "MALICIOUS",
        "MALICIOUS_VISUAL",
        "ERROR",
        "TIMEOUT",
        "NOT_CHECKED",
      ].map((key, index) => [key, verdicts[language][index]]),
    ),
  };
}

function project(records) {
  const interactions = new Map();
  for (const record of records) {
    const e = record.eventEnvelope.payload,
      r = record.receipt.payload,
      key =
        r.organizationId +
        ":" +
        e.deviceId +
        ":" +
        e.streamEpoch +
        ":" +
        e.interactionId;
    let item = interactions.get(key);
    if (!item) {
      item = {
        organizationId: r.organizationId,
        deviceId: e.deviceId,
        interactionId: e.interactionId,
        url: e.urlRedacted,
        clickedAt: e.observedAt,
        decisionAt: null,
        receivedAt: r.receivedAt,
        outcome: "PENDING",
        scoreAtDecision: null,
        latestScore: null,
        verdictAtDecision: "UNKNOWN",
        eventCount: 0,
        receipt: "STAGED",
      };
      interactions.set(key, item);
    }
    item.eventCount++;
    item.latestScore = e.assessment.localScore;
    item.receivedAt = r.receivedAt;
    if (e.kind === "DECISION") {
      item.outcome = e.outcome;
      item.decisionAt = e.observedAt;
      item.scoreAtDecision = e.assessment.localScore;
      item.verdictAtDecision = e.assessment.providerVerdict;
    }
  }
  return [...interactions.values()];
}
function reviewHtml(records, language = "en") {
  if (!Object.hasOwn(labels, language)) throw new Error("LANGUAGE_INVALID");
  const extra = {en:["Details","Sort by time","Newest first","Oldest first"],de:["Details","Nach Zeitpunkt sortieren","Neueste zuerst","Älteste zuerst"],fr:["Détails","Trier par date","Plus récents","Plus anciens"],es:["Detalles","Ordenar por fecha","Más recientes","Más antiguos"],it:["Dettagli","Ordina per data","Più recenti","Più vecchi"],pl:["Szczegóły","Sortuj według czasu","Najnowsze","Najstarsze"]}[language];
  const text = {...labels[language], details:extra[0],sort:extra[1],newest:extra[2],oldest:extra[3]},
    nonce = crypto.randomBytes(18).toString("base64");
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const json = (value) =>
    JSON.stringify(value).replace(
      /[<>&\u2028\u2029]/g,
      (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
    );
  return decorateHTML(`<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Thundy AV — ${escape(text.title)}</title>
<style nonce="${nonce}">body{font:16px/1.5 system-ui;margin:24px;color:var(--text-color);background:var(--card-bg)}h1{font-size:1.5rem;color:var(--link-color)}aside{padding:16px;background:var(--warning-bg);border-left:4px solid var(--color-warning)}form{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:6px}input,select,button{font:inherit;padding:8px;border:1px solid var(--card-border);border-radius:6px}input{max-width:100%;box-sizing:border-box}button{cursor:pointer}table{border-collapse:collapse;min-width:740px;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid var(--card-border);overflow-wrap:anywhere;max-width:250px}th{white-space:nowrap}td:first-child{white-space:nowrap}td:nth-child(2){min-width:200px;white-space:normal}.table-scroll{overflow:auto}tr.risk{background:var(--alert-error-bg)}.meta{font-size:.8rem}p{overflow-wrap:anywhere}.storage-status{margin:24px 0;padding:16px;border:1px solid var(--card-border);border-radius:8px}.storage-status h2{font-size:1.1rem;margin:0 0 8px}.storage-status p{margin:8px 0}.storage-status code{font-size:.8rem;overflow-wrap:anywhere}summary{cursor:pointer;font-weight:600;padding:8px 0}summary:focus-visible{outline:3px solid var(--link-color);outline-offset:3px}.status-guide{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px}.status-guide dt{font-weight:600}.status-guide code{display:block;font-weight:400}.status-guide dd{margin:8px 0 0}@media(prefers-color-scheme:dark){body{background:var(--bg-color);color:var(--text-color)}h1{color:var(--link-color)}aside{background:var(--warning-bg)}input,select,button{background:var(--card-bg);color:var(--text-color)}tr.risk{background:var(--alert-error-bg)}}@media(max-width:500px){body{margin:12px}form,label{width:100%}}</style>
<h1>Thundy AV — ${escape(text.title)}</h1><aside>${escape(text.limit)}</aside><section class="storage-status" aria-labelledby="storage-status-title"><h2 id="storage-status-title">${escape(text.storageTitle)}</h2><p><strong>${escape(text.staged)}</strong> · <code>STAGED</code></p><p>${escape(text.stagedHelp)}</p><details id="storage-guide"><summary>${escape(text.statusGuide)}</summary><dl class="status-guide">${[
    ["staged", "STAGED"],
    ["cloud", "CLOUD_OBSERVED"],
    ["sealed", "SEALED"],
  ]
    .map(
      ([key, code]) =>
        `<div><dt>${escape(text[key])}<code>${code}</code></dt><dd>${escape(text[key + "Help"])}</dd></div>`,
    )
    .join(
      "",
    )}</dl></details></section><form id="filters"><label>${escape(text.domain)}<input id="query" type="search"></label><label>${escape(text.outcome)}<select id="outcome"><option value="">${escape(text.all)}</option>${[
    ["PENDING", "pending"],
    ["OPENED", "opened"],
    ["ABORTED", "aborted"],
    ["BLOCKED", "blocked"],
    ["OPEN_ERROR", "error"],
  ]
    .map(
      ([value, key]) =>
        `<option value="${value}">${escape(text[key])}</option>`,
    )
    .join(
      "",
    )}</select></label><label>${escape(text.score)}<input id="score" type="number" min="0" max="100"></label><label>${escape(text.sort)}<select id="sort"><option value="newest">${escape(text.newest)}</option><option value="oldest">${escape(text.oldest)}</option></select></label></form><p id="count" role="status"></p><p><button id="previous">${escape(text.previous)}</button> <button id="next">${escape(text.next)}</button></p><div class="table-scroll" tabindex="0"><table><thead><tr>${["clicked", "domain", "outcome", "atDecision", "status"].map((key) => '<th scope="col">' + escape(text[key]) + "</th>").join("")}</tr></thead><tbody id="rows"></tbody></table></div><p>${escape(text.check)}</p><button id="download">${escape(text.download)}</button>
<script id="review-data" type="application/json" nonce="${nonce}">${json({ text, interactions: project(records), records })}</script><script nonce="${nonce}">
'use strict';const data=JSON.parse(document.getElementById('review-data').textContent),$=id=>document.getElementById(id),t=data.text;
const names={PENDING:t.pending,OPENED:t.opened,ABORTED:t.aborted,BLOCKED:t.blocked,OPEN_ERROR:t.error};
let page=0;function render(reset=true){if(reset)page=0;const query=$('query').value.toLowerCase(),outcome=$('outcome').value,score=$('score').value;
 const items=data.interactions.filter(r=>r.url.toLowerCase().includes(query)&&(!outcome||r.outcome===outcome)&&(score===''||(r.scoreAtDecision!==null&&r.scoreAtDecision>=Number(score)))).sort((a,b)=>($('sort').value==='oldest'?1:-1)*(Date.parse(a.clickedAt)-Date.parse(b.clickedAt)));
 page=Math.min(page,Math.max(0,Math.ceil(items.length/50)-1));$('previous').disabled=page===0;$('next').disabled=(page+1)*50>=items.length;
 $('count').textContent=t.count+': '+items.length+' · '+(items.length?page*50+1:0)+'–'+Math.min((page+1)*50,items.length);$('rows').replaceChildren();
 for(const item of items.slice(page*50,(page+1)*50)){const tr=document.createElement('tr'),risky=item.outcome==='OPENED'&&(item.scoreAtDecision>=70||['MALICIOUS','MALICIOUS_VISUAL'].includes(item.verdictAtDecision));if(risky){tr.className='risk';tr.title=t.risk;}
 const cell=value=>{const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);return td;};
 const timestamp=document.createElement('time'),instant=new Date(item.clickedAt);timestamp.dateTime=item.clickedAt;timestamp.textContent=Number.isFinite(instant.getTime())?new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'short',timeStyle:'short'}).format(instant):String(item.clickedAt);cell('').appendChild(timestamp);const address=cell('');const host=document.createElement('strong');try{host.textContent=new URL(item.url).host;}catch(_){host.textContent=item.url;}address.appendChild(host);
 const detail=document.createElement('details'),summary=document.createElement('summary'),url=document.createElement('code'),values=document.createElement('dl');summary.textContent=t.details;url.textContent=item.url;
 for(const [name,value] of [[t.clicked,item.clickedAt],[t.latest,item.latestScore??t.unknown],[t.provider,t.verdicts[item.verdictAtDecision]??t.unknown],[t.decided,item.decisionAt??'—'],[t.received,item.receivedAt],[t.device,item.deviceId],[t.events,item.eventCount]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=String(value);values.append(dt,dd);}detail.append(summary,url,values);address.appendChild(detail);
 const decision=cell(''),badge=document.createElement('span');badge.className='badge'+(risky?' high':'');badge.textContent=names[item.outcome];decision.appendChild(badge);cell(item.scoreAtDecision??t.unknown);cell(item.receipt==='STAGED'?t.staged+' · STAGED':item.receipt);$('rows').appendChild(tr);}
 if(!items.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent=t.none;tr.appendChild(td);$('rows').appendChild(tr);}}
 $('filters').addEventListener('submit',e=>e.preventDefault());for(const id of ['query','outcome','score','sort'])$(id).addEventListener('input',()=>render());
 $('previous').addEventListener('click',()=>{page--;render(false);});$('next').addEventListener('click',()=>{page++;render(false);});
 $('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({kind:'thundy-staged-journal-export',schemaVersion:1,records:data.records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thundy-staged-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});render();
</script></html>`, language);
}
module.exports = { project, reviewHtml, labels };
