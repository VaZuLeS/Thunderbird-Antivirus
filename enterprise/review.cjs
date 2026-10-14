"use strict";
const crypto = require("node:crypto");
const labels = {
  en: {
    title: "Enterprise event review",
    limit:
      "Local development evidence. STAGED confirms local journal storage; it is not immutable SEALED evidence or proof of a website visit. Device keys were enrolled locally; no corporate identity or SSO role is established.",
    domain: "Domain",
    outcome: "Decision",
    score: "Minimum decision score",
    all: "All",
    unknown: "Unknown",
    pending: "Pending",
    opened: "Opened",
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
    risk: "Opened with high risk",
    none: "No matching interactions",
    check:
      "Source records and signatures were checked during generation. Recheck them with the separately trusted server public key. A locally signed chain alone cannot detect removal of its tail without an independent checkpoint.",
  },
  de: {
    title: "Enterprise-Ereignisprüfung",
    limit:
      "Lokale Entwicklungsnachweise. STAGED bestätigt die lokale Journalablage; dies ist keine unveränderliche SEALED-Evidenz und kein Beweis eines Webseitenbesuchs. Geräteschlüssel wurden lokal registriert; Unternehmensidentitäten und SSO-Rollen sind nicht eingerichtet.",
    domain: "Domain",
    outcome: "Entscheidung",
    score: "Mindestscore bei Entscheidung",
    all: "Alle",
    unknown: "Unbekannt",
    pending: "Offen",
    opened: "Geöffnet",
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
    risk: "Mit hohem Risiko geöffnet",
    none: "Keine passenden Interaktionen",
    check:
      "Quelldatensätze und Signaturen wurden beim Erzeugen geprüft. Erneut mit dem separat vertrauenswürdig bezogenen Server-Public-Key prüfen. Eine lokal signierte Kette erkennt ohne unabhängigen Checkpoint kein Abschneiden ihres Endes.",
  },
  fr: {
    title: "Contrôle des événements Enterprise",
    limit:
      "Preuves de développement local. STAGED confirme le journal local, sans preuve SEALED immuable ni preuve de visite. Les clés des appareils sont enregistrées localement ; aucune identité d’entreprise ni aucun rôle SSO n’est établi.",
    domain: "Domaine",
    outcome: "Décision",
    score: "Score minimal à la décision",
    all: "Tous",
    unknown: "Inconnu",
    pending: "En attente",
    opened: "Ouvert",
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
    risk: "Ouvert avec risque élevé",
    none: "Aucune interaction correspondante",
    check:
      "Données et signatures vérifiées à la génération. Revérifier avec une clé publique serveur obtenue par un canal fiable. Sans point de contrôle indépendant, la chaîne locale ne détecte pas la suppression de sa fin.",
  },
  es: {
    title: "Revisión de eventos Enterprise",
    limit:
      "Evidencia de desarrollo local. STAGED confirma el diario local, sin evidencia SEALED inmutable ni prueba de visita. Las claves de dispositivos se registran localmente; no hay identidad empresarial ni roles SSO.",
    domain: "Dominio",
    outcome: "Decisión",
    score: "Puntuación mínima al decidir",
    all: "Todos",
    unknown: "Desconocido",
    pending: "Pendiente",
    opened: "Abierto",
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
    risk: "Abierto con riesgo alto",
    none: "No hay interacciones coincidentes",
    check:
      "Datos y firmas verificados al generar. Vuelva a verificar con una clave pública del servidor obtenida de forma fiable. Sin un punto de control independiente, la cadena local no detecta que se elimine su final.",
  },
  it: {
    title: "Revisione eventi Enterprise",
    limit:
      "Evidenze di sviluppo locale. STAGED conferma il registro locale, senza evidenza SEALED immutabile né prova di visita. Le chiavi dei dispositivi sono registrate localmente; identità aziendali e ruoli SSO non sono configurati.",
    domain: "Dominio",
    outcome: "Decisione",
    score: "Punteggio minimo alla decisione",
    all: "Tutti",
    unknown: "Sconosciuto",
    pending: "In attesa",
    opened: "Aperto",
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
    risk: "Aperto con rischio elevato",
    none: "Nessuna interazione corrispondente",
    check:
      "Dati e firme verificati alla generazione. Verificare di nuovo con una chiave pubblica server ottenuta da un canale fidato. Senza un checkpoint indipendente, la catena locale non rileva il taglio della sua parte finale.",
  },
  pl: {
    title: "Przegląd zdarzeń Enterprise",
    limit:
      "Lokalne dane testowe. STAGED potwierdza zapis w lokalnym dzienniku, bez niezmiennego dowodu SEALED ani dowodu wizyty na stronie. Klucze urządzeń zarejestrowano lokalnie; brak tożsamości firmowej i ról SSO.",
    domain: "Domena",
    outcome: "Decyzja",
    score: "Minimalna ocena przy decyzji",
    all: "Wszystkie",
    unknown: "Nieznana",
    pending: "Oczekuje",
    opened: "Otwarto",
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
    risk: "Otwarto przy wysokim ryzyku",
    none: "Brak pasujących interakcji",
    check:
      "Dane i podpisy sprawdzono podczas generowania. Sprawdź ponownie z zaufanym kluczem publicznym serwera. Bez niezależnego punktu kontrolnego lokalny łańcuch nie wykrywa usunięcia końcowych wpisów.",
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
  Object.assign(labels[language], paging[language]);
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
  const text = labels[language],
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
  return `<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Thundy AV — ${escape(text.title)}</title>
<style nonce="${nonce}">body{font:16px/1.5 system-ui;margin:24px;color:#1f2937;background:#fff}h1{font-size:1.5rem;color:#075985}aside{padding:16px;background:#fffbeb;border-left:4px solid #b45309}form{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}label{display:grid;gap:6px}input,select,button{font:inherit;padding:8px;border:1px solid #9ca3af;border-radius:6px}input{max-width:100%;box-sizing:border-box}button{cursor:pointer}table{border-collapse:collapse;min-width:1600px;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #d1d5db;overflow-wrap:anywhere;max-width:250px}th{white-space:nowrap}td:nth-child(-n+8),td:nth-child(10),td:nth-child(11){white-space:nowrap}.table-scroll{overflow:auto}tr.risk{background:#fef2f2}.meta{font-size:.8rem}p{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#111827;color:#e5e7eb}h1{color:#7dd3fc}aside{background:#292524}input,select,button{background:#1f2937;color:#e5e7eb}tr.risk{background:#450a0a}}@media(max-width:500px){body{margin:12px}form,label{width:100%}}</style>
<h1>Thundy AV — ${escape(text.title)}</h1><aside>${escape(text.limit)}</aside><form id="filters"><label>${escape(text.domain)}<input id="query" type="search"></label><label>${escape(text.outcome)}<select id="outcome"><option value="">${escape(text.all)}</option>${[
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
    )}</select></label><label>${escape(text.score)}<input id="score" type="number" min="0" max="100"></label></form><p id="count" role="status"></p><p><button id="previous">${escape(text.previous)}</button> <button id="next">${escape(text.next)}</button></p><div class="table-scroll" tabindex="0"><table><thead><tr>${["domain", "outcome", "atDecision", "latest", "provider", "clicked", "decided", "received", "device", "events", "status"].map((key) => '<th scope="col">' + escape(text[key]) + "</th>").join("")}</tr></thead><tbody id="rows"></tbody></table></div><p>${escape(text.check)}</p><button id="download">${escape(text.download)}</button>
<script id="review-data" type="application/json" nonce="${nonce}">${json({ text, interactions: project(records), records })}</script><script nonce="${nonce}">
'use strict';const data=JSON.parse(document.getElementById('review-data').textContent),$=id=>document.getElementById(id),t=data.text;
const names={PENDING:t.pending,OPENED:t.opened,ABORTED:t.aborted,BLOCKED:t.blocked,OPEN_ERROR:t.error};
let page=0;function render(reset=true){if(reset)page=0;const query=$('query').value.toLowerCase(),outcome=$('outcome').value,score=$('score').value;
 const items=data.interactions.filter(r=>r.url.toLowerCase().includes(query)&&(!outcome||r.outcome===outcome)&&(score===''||(r.scoreAtDecision!==null&&r.scoreAtDecision>=Number(score))));
 page=Math.min(page,Math.max(0,Math.ceil(items.length/50)-1));$('previous').disabled=page===0;$('next').disabled=(page+1)*50>=items.length;
 $('count').textContent=t.count+': '+items.length+' · '+(items.length?page*50+1:0)+'–'+Math.min((page+1)*50,items.length);$('rows').replaceChildren();
 for(const item of items.slice(page*50,(page+1)*50)){const tr=document.createElement('tr'),risky=item.outcome==='OPENED'&&(item.scoreAtDecision>=70||['MALICIOUS','MALICIOUS_VISUAL'].includes(item.verdictAtDecision));if(risky){tr.className='risk';tr.title=t.risk;}
 for(const value of [item.url,names[item.outcome],item.scoreAtDecision??t.unknown,item.latestScore??t.unknown,t.verdicts[item.verdictAtDecision],item.clickedAt,item.decisionAt??'—',item.receivedAt,item.deviceId,item.eventCount,item.receipt]){const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);}$('rows').appendChild(tr);}
 if(!items.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=11;td.textContent=t.none;tr.appendChild(td);$('rows').appendChild(tr);}}
 $('filters').addEventListener('submit',e=>e.preventDefault());for(const id of ['query','outcome','score'])$(id).addEventListener('input',()=>render());
 $('previous').addEventListener('click',()=>{page--;render(false);});$('next').addEventListener('click',()=>{page++;render(false);});
 $('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({kind:'thundy-staged-journal-export',schemaVersion:1,records:data.records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thundy-staged-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});render();
</script></html>`;
}
module.exports = { project, reviewHtml, labels };
