"use strict";
const { decorateHTML } = require("./design_system.cjs");
const crypto = require("node:crypto");
const states = [
  "QUEUED",
  "WRITING",
  "RETRY",
  "DEAD_LETTER",
  "SIMULATION_COMPLETE",
  "CLOUD_OBSERVED",
];
const providers = ["local-simulation", "aws-s3", "azure-blob", "gcp-bucket"];
const keys = [
  "title",
  "notice",
  "generated",
  "utc",
  "total",
  "attention",
  "waiting",
  "cloud",
  "simulation",
  "capacity",
  "search",
  "state",
  "provider",
  "all",
  "onlyAttention",
  "job",
  "attempts",
  "updated",
  "nextAttempt",
  "problem",
  "details",
  "source",
  "hash",
  "entries",
  "version",
  "requested",
  "observed",
  "previous",
  "next",
  "empty",
  "download",
  "head",
  "pinned",
  "unpinned",
  "unknownError",
  "timeout",
  "contentMismatch",
  "expired",
  "interrupted",
  "queued",
  "writing",
  "retry",
  "dead",
  "simulationDone",
  "cloudDone",
];
const translations = {
  en: [
    "Storage job review",
    "Offline snapshot from a locally verified journal. Cloud observations and simulations do not confirm protected storage. SEALED is not implemented. This HTML and its JSON export are unsigned summaries, not independent evidence or a live dashboard.",
    "Snapshot created",
    "All dates: UTC",
    "Jobs",
    "Needs review",
    "Awaiting processing",
    "Storage checked",
    "Simulations complete",
    "Capacity",
    "Search job, source or hash",
    "Processing state",
    "Provider",
    "All",
    "Only jobs needing review",
    "Job",
    "Attempts / total",
    "Updated",
    "Next attempt",
    "Problem",
    "Technical details",
    "Source ID",
    "Content hash",
    "Records in snapshot",
    "Object version",
    "Requested protection until",
    "Observed protection until",
    "Previous page",
    "Next page",
    "No matching jobs",
    "Export complete status snapshot",
    "Journal head",
    "Matches an externally supplied head",
    "No external head supplied; valid tail truncation cannot be detected",
    "Review the cause before retrying. The stored error code is shown below.",
    "Time limit exceeded. A remote write may already have happened; the next attempt checks the same object.",
    "Readback does not match the expected content. Review the object; no replacement or deletion is performed.",
    "The requested protection date has passed. Review retention and the need for a new approved job.",
    "A recorded attempt has not finished. Check that the previous worker stopped before resuming.",
    "Queued",
    "Attempt unfinished",
    "Retry scheduled",
    "Attempt limit reached",
    "Simulation complete",
    "Storage checked",
  ],
  de: [
    "Prüfung der Speicheraufträge",
    "Offline-Stand aus einem lokal geprüften Journal. Cloudbeobachtungen und Simulationen bestätigen keinen Ablageschutz. SEALED ist nicht implementiert. Diese HTML-Datei und ihr JSON-Export sind unsignierte Zusammenfassungen, keine unabhängigen Nachweise oder Liveübersicht.",
    "Stand erstellt",
    "Alle Zeitangaben: UTC",
    "Aufträge",
    "Prüfung erforderlich",
    "Bearbeitung ausstehend",
    "Speicher geprüft",
    "Simulationen abgeschlossen",
    "Kapazität",
    "Auftrag, Quelle oder Hash suchen",
    "Bearbeitungsstatus",
    "Anbieter",
    "Alle",
    "Nur Aufträge mit Prüfbedarf",
    "Auftrag",
    "Versuche / insgesamt",
    "Aktualisiert",
    "Nächster Versuch",
    "Problem",
    "Technische Details",
    "Quell-ID",
    "Inhaltshash",
    "Datensätze im Snapshot",
    "Objektversion",
    "Angeforderter Schutz bis",
    "Beobachteter Schutz bis",
    "Vorherige Seite",
    "Nächste Seite",
    "Keine passenden Aufträge",
    "Vollständigen Statusstand exportieren",
    "Journal-Kettenkopf",
    "Stimmt mit extern vorgegebenem Kettenkopf überein",
    "Kein externer Kettenkopf vorgegeben; gültiges Abschneiden des Endes bleibt unerkennbar",
    "Vor Wiederholung die Ursache prüfen. Der gespeicherte Fehlercode steht darunter.",
    "Zeitlimit überschritten. Remote kann bereits geschrieben worden sein; der nächste Versuch prüft dasselbe Objekt.",
    "Zurückgelesener Inhalt stimmt nicht überein. Objekt prüfen; es wird nicht ersetzt oder gelöscht.",
    "Die angeforderte Schutzfrist ist abgelaufen. Aufbewahrung und Bedarf eines neuen freigegebenen Auftrags prüfen.",
    "Ein gespeicherter Versuch ist nicht abgeschlossen. Vor Wiederaufnahme prüfen, dass der vorige Worker beendet ist.",
    "Eingereiht",
    "Versuch nicht abgeschlossen",
    "Wiederholung geplant",
    "Versuchslimit erreicht",
    "Simulation abgeschlossen",
    "Speicher geprüft",
  ],
  fr: [
    "Contrôle des tâches de stockage",
    "Instantané hors ligne d’un journal vérifié localement. Les observations cloud et les simulations ne confirment pas la protection du stockage. SEALED n’est pas implémenté. Ce fichier HTML et son export JSON sont des résumés non signés, pas des preuves indépendantes ni un tableau de bord en direct.",
    "Instantané créé",
    "Toutes les dates : UTC",
    "Tâches",
    "Contrôle requis",
    "Traitement en attente",
    "Stockage vérifié",
    "Simulations terminées",
    "Capacité",
    "Rechercher tâche, source ou empreinte",
    "État du traitement",
    "Fournisseur",
    "Tous",
    "Uniquement les tâches à contrôler",
    "Tâche",
    "Tentatives / total",
    "Mis à jour",
    "Prochaine tentative",
    "Problème",
    "Détails techniques",
    "ID de source",
    "Empreinte du contenu",
    "Enregistrements de l’instantané",
    "Version de l’objet",
    "Protection demandée jusqu’au",
    "Protection observée jusqu’au",
    "Page précédente",
    "Page suivante",
    "Aucune tâche correspondante",
    "Exporter l’état complet",
    "Tête du journal",
    "Correspond à une tête fournie séparément",
    "Aucune tête externe fournie ; une troncature valide de la fin reste indétectable",
    "Vérifier la cause avant de réessayer. Le code d’erreur enregistré figure ci-dessous.",
    "Délai dépassé. Une écriture distante peut déjà avoir eu lieu ; la prochaine tentative vérifie le même objet.",
    "Le contenu relu ne correspond pas. Vérifier l’objet ; il n’est ni remplacé ni supprimé.",
    "La date de protection demandée est dépassée. Vérifier la conservation et le besoin d’une nouvelle tâche approuvée.",
    "Une tentative enregistrée est inachevée. Vérifier l’arrêt du précédent worker avant de reprendre.",
    "En attente",
    "Tentative inachevée",
    "Nouvelle tentative prévue",
    "Limite de tentatives atteinte",
    "Simulation terminée",
    "Stockage vérifié",
  ],
  es: [
    "Revisión de tareas de almacenamiento",
    "Instantánea sin conexión de un diario verificado localmente. Las observaciones de nube y las simulaciones no confirman la protección del almacenamiento. SEALED no está implementado. Este HTML y su JSON son resúmenes sin firma, no pruebas independientes ni un panel en directo.",
    "Instantánea creada",
    "Todas las fechas: UTC",
    "Tareas",
    "Revisión necesaria",
    "Procesamiento pendiente",
    "Almacenamiento comprobado",
    "Simulaciones completadas",
    "Capacidad",
    "Buscar tarea, fuente o hash",
    "Estado del procesamiento",
    "Proveedor",
    "Todos",
    "Solo tareas que requieren revisión",
    "Tarea",
    "Intentos / total",
    "Actualizado",
    "Próximo intento",
    "Problema",
    "Detalles técnicos",
    "ID de fuente",
    "Hash del contenido",
    "Registros de la instantánea",
    "Versión del objeto",
    "Protección solicitada hasta",
    "Protección observada hasta",
    "Página anterior",
    "Página siguiente",
    "No hay tareas coincidentes",
    "Exportar el estado completo",
    "Cabecera del diario",
    "Coincide con una cabecera proporcionada por separado",
    "No se proporcionó cabecera externa; no se detecta un truncamiento válido del final",
    "Revisar la causa antes de reintentar. El código de error guardado aparece debajo.",
    "Se superó el tiempo límite. Puede haberse escrito en remoto; el siguiente intento comprueba el mismo objeto.",
    "El contenido leído no coincide. Revisar el objeto; no se sustituye ni se elimina.",
    "La fecha de protección solicitada ha pasado. Revisar la conservación y la necesidad de una nueva tarea aprobada.",
    "Un intento registrado no ha finalizado. Comprobar que el worker anterior terminó antes de reanudar.",
    "En cola",
    "Intento sin finalizar",
    "Reintento programado",
    "Límite de intentos alcanzado",
    "Simulación completada",
    "Almacenamiento comprobado",
  ],
  it: [
    "Revisione attività di archiviazione",
    "Istantanea offline di un registro verificato localmente. Le osservazioni cloud e le simulazioni non confermano la protezione dell’archiviazione. SEALED non è implementato. Questo HTML e il JSON esportato sono riepiloghi non firmati, non prove indipendenti né una dashboard in tempo reale.",
    "Istantanea creata",
    "Tutte le date: UTC",
    "Attività",
    "Verifica necessaria",
    "Elaborazione in attesa",
    "Archiviazione verificata",
    "Simulazioni completate",
    "Capacità",
    "Cerca attività, origine o hash",
    "Stato di elaborazione",
    "Fornitore",
    "Tutti",
    "Solo attività da verificare",
    "Attività",
    "Tentativi / totale",
    "Aggiornato",
    "Prossimo tentativo",
    "Problema",
    "Dettagli tecnici",
    "ID origine",
    "Hash del contenuto",
    "Record nell’istantanea",
    "Versione oggetto",
    "Protezione richiesta fino al",
    "Protezione osservata fino al",
    "Pagina precedente",
    "Pagina successiva",
    "Nessuna attività corrispondente",
    "Esporta stato completo",
    "Testa del registro",
    "Corrisponde a una testa fornita separatamente",
    "Nessuna testa esterna fornita; un taglio valido della parte finale non è rilevabile",
    "Verificare la causa prima di riprovare. Il codice di errore salvato è riportato sotto.",
    "Tempo limite superato. Una scrittura remota potrebbe essere avvenuta; il prossimo tentativo verifica lo stesso oggetto.",
    "Il contenuto riletto non corrisponde. Verificare l’oggetto; non viene sostituito né eliminato.",
    "La data di protezione richiesta è trascorsa. Verificare conservazione e necessità di una nuova attività approvata.",
    "Un tentativo registrato non è terminato. Verificare che il worker precedente sia arrestato prima di riprendere.",
    "In coda",
    "Tentativo incompleto",
    "Nuovo tentativo previsto",
    "Limite tentativi raggiunto",
    "Simulazione completata",
    "Archiviazione verificata",
  ],
  pl: [
    "Przegląd zadań przechowywania",
    "Migawka offline z lokalnie sprawdzonego dziennika. Obserwacje chmury i symulacje nie potwierdzają ochrony danych. SEALED nie jest wdrożone. Ten HTML i eksport JSON to niepodpisane podsumowania, nie niezależne dowody ani panel na żywo.",
    "Migawka utworzona",
    "Wszystkie daty: UTC",
    "Zadania",
    "Wymaga sprawdzenia",
    "Oczekuje na przetworzenie",
    "Sprawdzono przechowywanie",
    "Zakończone symulacje",
    "Pojemność",
    "Szukaj zadania, źródła lub skrótu",
    "Stan przetwarzania",
    "Dostawca",
    "Wszystkie",
    "Tylko zadania wymagające sprawdzenia",
    "Zadanie",
    "Próby / łącznie",
    "Zaktualizowano",
    "Następna próba",
    "Problem",
    "Szczegóły techniczne",
    "ID źródła",
    "Skrót zawartości",
    "Rekordy w migawce",
    "Wersja obiektu",
    "Żądana ochrona do",
    "Zaobserwowana ochrona do",
    "Poprzednia strona",
    "Następna strona",
    "Brak pasujących zadań",
    "Eksportuj pełny stan",
    "Koniec łańcucha dziennika",
    "Zgodny z osobno podanym końcem łańcucha",
    "Nie podano zewnętrznego końca łańcucha; poprawne obcięcie końca pozostaje niewykrywalne",
    "Sprawdź przyczynę przed ponowieniem. Zapisany kod błędu jest pokazany poniżej.",
    "Przekroczono limit czasu. Zdalny zapis mógł już nastąpić; kolejna próba sprawdzi ten sam obiekt.",
    "Odczytana zawartość jest niezgodna. Sprawdź obiekt; nie zostanie zastąpiony ani usunięty.",
    "Żądana data ochrony minęła. Sprawdź retencję i potrzebę nowego zatwierdzonego zadania.",
    "Zapisana próba nie została zakończona. Przed wznowieniem sprawdź, czy poprzedni worker został zatrzymany.",
    "W kolejce",
    "Próba niezakończona",
    "Zaplanowano ponowienie",
    "Osiągnięto limit prób",
    "Symulacja zakończona",
    "Sprawdzono przechowywanie",
  ],
};
const supplemental = {
  en: {
    capacityWarning:
      "Capacity is at least 80% used. Review available space before accepting more jobs.",
    localProvider: "Local simulation",
  },
  de: {
    capacityWarning:
      "Mindestens 80 % der Kapazität belegt. Freien Platz vor weiteren Aufträgen prüfen.",
    localProvider: "Lokale Simulation",
  },
  fr: {
    capacityWarning:
      "Au moins 80 % de la capacité est utilisée. Vérifier l’espace libre avant de nouvelles tâches.",
    localProvider: "Simulation locale",
  },
  es: {
    capacityWarning:
      "Se usa al menos el 80 % de la capacidad. Revisar el espacio libre antes de nuevas tareas.",
    localProvider: "Simulación local",
  },
  it: {
    capacityWarning:
      "Almeno l’80% della capacità è utilizzato. Verificare lo spazio libero prima di nuove attività.",
    localProvider: "Simulazione locale",
  },
  pl: {
    capacityWarning:
      "Wykorzystano co najmniej 80% pojemności. Sprawdź wolne miejsce przed nowymi zadaniami.",
    localProvider: "Symulacja lokalna",
  },
};
const labels = Object.fromEntries(
  Object.entries(translations).map(([lang, values]) => {
    if (values.length !== keys.length)
      throw new Error("STORAGE_REVIEW_TRANSLATION_INVALID");
    return [
      lang,
      Object.freeze({
        ...Object.fromEntries(keys.map((key, i) => [key, values[i]])),
        ...supplemental[lang],
      }),
    ];
  }),
);
const need = (ok) => {
  if (!ok) throw new Error("STORAGE_REVIEW_INVALID");
};
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const iso = (value) =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const hash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fields = [
  "jobId",
  "status",
  "queuedAt",
  "updatedAt",
  "observedAt",
  "evidenceStatus",
  "provider",
  "objectVersion",
  "requestedRetainUntil",
  "observedRetainUntil",
  "transportVerified",
  "sourceId",
  "sha256",
  "entryCount",
  "attempts",
  "totalAttempts",
  "nextAttemptAt",
  "error",
  "simulated",
  "sealed",
];
function report(
  status,
  { generatedAt = new Date().toISOString(), headPinned = false } = {},
) {
  need(
    iso(generatedAt) &&
      typeof headPinned === "boolean" &&
      status?.schemaVersion === 1 &&
      status.kind === "thundy-storage-jobs-status" &&
      status.sealed === false &&
      (status.head === "genesis" || hash(status.head)) &&
      Array.isArray(status.jobs) &&
      status.jobs.length <= 10000,
  );
  for (const key of ["journalBytes", "maxBytes", "maxJobs", "maxAttempts"])
    need(integer(status[key]));
  need(
    status.maxBytes > 0 &&
      status.maxJobs > 0 &&
      status.maxAttempts > 0 &&
      status.jobs.length <= status.maxJobs &&
      status.journalBytes <= status.maxBytes,
  );
  const ids = new Set();
  const jobs = status.jobs.map((job) => {
    need(
      hash(job.jobId) &&
        !ids.has(job.jobId) &&
        hash(job.sourceId) &&
        hash(job.sha256) &&
        states.includes(job.status) &&
        providers.includes(job.provider) &&
        job.sealed === false &&
        job.transportVerified === false &&
        job.evidenceStatus === "STAGED",
    );
    ids.add(job.jobId);
    need(
      job.status !== "SIMULATION_COMPLETE" ||
        job.provider === "local-simulation",
    );
    need(
      job.status !== "CLOUD_OBSERVED" ||
        (job.provider !== "local-simulation" &&
          job.objectVersion &&
          job.observedAt &&
          job.observedRetainUntil &&
          job.requestedRetainUntil),
    );
    need(
      iso(job.queuedAt) &&
        iso(job.updatedAt) &&
        [
          "observedAt",
          "requestedRetainUntil",
          "observedRetainUntil",
          "nextAttemptAt",
        ].every((key) => job[key] === null || iso(job[key])),
    );
    need(
      ["entryCount", "attempts", "totalAttempts"].every((key) =>
        integer(job[key]),
      ) && job.attempts <= job.totalAttempts,
    );
    need(
      job.objectVersion === null ||
        (typeof job.objectVersion === "string" &&
          job.objectVersion.length <= 1024),
    );
    need(
      job.error === null ||
        (typeof job.error === "string" &&
          /^[A-Z][A-Z0-9_]{0,79}$/.test(job.error)),
    );
    need(job.simulated === (job.provider === "local-simulation" ? true : null));
    return Object.fromEntries(fields.map((key) => [key, job[key]]));
  });
  return {
    schemaVersion: 1,
    kind: "thundy-storage-jobs-review",
    generatedAt,
    head: status.head,
    headPinned,
    storage: {
      journalBytes: status.journalBytes,
      maxBytes: status.maxBytes,
      maxJobs: status.maxJobs,
      maxAttempts: status.maxAttempts,
      capacityWarning:
        status.journalBytes >= status.maxBytes * 0.8 ||
        jobs.length >= status.maxJobs * 0.8,
    },
    jobs,
    sealed: false,
    transportVerified: false,
  };
}
function reviewHtml(status, language = "en", options) {
  if (!Object.hasOwn(labels, language)) throw new Error("LANGUAGE_INVALID");
  const snapshot = report(status, options),
    t = labels[language],
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
  const providerNames = {
    "local-simulation": t.localProvider,
    "aws-s3": "AWS S3",
    "azure-blob": "Azure Blob Storage",
    "gcp-bucket": "Google Cloud Storage",
  };
  const stateNames = Object.fromEntries(
    states.map((s, i) => [
      s,
      t[
        ["queued", "writing", "retry", "dead", "simulationDone", "cloudDone"][i]
      ],
    ]),
  );
  return decorateHTML(`<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>Thundy AV — ${escape(t.title)}</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:24px;font:16px/1.5 system-ui;background:var(--card-bg);color:var(--text-color)}h1{font-size:1.5rem;color:var(--link-color)}aside{background:var(--warning-bg);border-left:4px solid var(--color-warning);padding:16px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:12px;margin:24px 0}.card{padding:12px;border:1px solid var(--card-border);border-radius:8px}.card strong{display:block;font-size:1.6rem}form{display:flex;gap:16px;flex-wrap:wrap;margin:20px 0}label{display:grid;gap:4px}input,select,button{font:inherit;padding:8px;border:1px solid var(--card-border);border-radius:6px;max-width:100%}button,summary{cursor:pointer}button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--link-color);outline-offset:2px}table{border-collapse:collapse;width:100%;min-width:1100px}th,td{padding:12px;text-align:left;border-bottom:1px solid var(--card-border);vertical-align:top}th{white-space:normal}td:first-child{min-width:180px;max-width:230px}td:last-child{min-width:280px;max-width:400px}td code{display:block}.table-scroll{overflow:auto}.attention{background:var(--warning-bg)}.detail{display:grid;gap:6px;margin:12px 0}dt{font-weight:600}dd{margin:0 0 8px}code,p,dd{overflow-wrap:anywhere}code{font-size:.8rem}time{white-space:nowrap}.muted{font-size:.85rem}details summary{padding:4px 0}.capacity-warning{font-weight:700;color:var(--color-warning)}@media(prefers-color-scheme:dark){body{background:var(--bg-color);color:var(--text-color)}h1{color:var(--link-color)}aside{background:var(--warning-bg)}.attention{background:var(--warning-bg)}input,select,button{background:var(--card-bg);color:var(--text-color)}.capacity-warning{color:var(--color-warning)}}@media(max-width:500px){body{margin:12px}form,label{width:100%}}</style>
<h1>Thundy AV — ${escape(t.title)}</h1><aside>${escape(t.notice)}</aside><p>${escape(t.generated)}: <time datetime="${snapshot.generatedAt}">${snapshot.generatedAt}</time> · ${escape(t.utc)}</p><div class="cards" id="cards"></div><p id="capacity"></p><form id="filters"><label>${escape(t.search)}<input id="query" type="search"></label><label>${escape(t.state)}<select id="state"><option value="">${escape(t.all)}</option>${states.map((s) => `<option value="${s}">${escape(stateNames[s])}</option>`).join("")}</select></label><label>${escape(t.provider)}<select id="provider"><option value="">${escape(t.all)}</option>${providers.map((p) => `<option value="${p}">${escape(providerNames[p])}</option>`).join("")}</select></label><label><span>${escape(t.onlyAttention)}</span><input id="attention" type="checkbox"></label></form><p id="count" role="status"></p><p><button id="previous">${escape(t.previous)}</button> <button id="next">${escape(t.next)}</button></p><div class="table-scroll" tabindex="0"><table><thead><tr>${["job", "state", "provider", "attempts", "nextAttempt", "problem"].map((key) => `<th scope="col">${escape(t[key])}</th>`).join("")}</tr></thead><tbody id="rows"></tbody></table></div><p>${escape(t.head)}: <code>${snapshot.head}</code></p><p>${escape(snapshot.headPinned ? t.pinned : t.unpinned)}</p><button id="download">${escape(t.download)}</button>
<script id="storage-data" type="application/json" nonce="${nonce}">${json({ snapshot, text: t, stateNames, providerNames })}</script><script nonce="${nonce}">
'use strict';const data=JSON.parse(document.getElementById('storage-data').textContent),s=data.snapshot,t=data.text,$=id=>document.getElementById(id),asOf=Date.parse(s.generatedAt);
const expired=j=>j.requestedRetainUntil!==null&&Date.parse(j.requestedRetainUntil)<=asOf;
const attention=j=>['WRITING','RETRY','DEAD_LETTER'].includes(j.status)||expired(j);
const formatter=new Intl.DateTimeFormat(document.documentElement.lang,{dateStyle:'short',timeStyle:'medium',timeZone:'UTC'});const generated=document.querySelector('time[datetime]');generated.textContent=formatter.format(new Date(s.generatedAt));generated.title=s.generatedAt;
function date(value){if(value===null)return document.createTextNode('—');const el=document.createElement('time');el.dateTime=value;el.title=value;el.textContent=formatter.format(new Date(value));return el;}
function text(parent,value,tag='span'){const el=document.createElement(tag);el.textContent=String(value);parent.appendChild(el);return el;}
for(const [key,n] of [['total',s.jobs.length],['attention',s.jobs.filter(attention).length],['waiting',s.jobs.filter(j=>['QUEUED','WRITING','RETRY'].includes(j.status)).length],['cloud',s.jobs.filter(j=>j.status==='CLOUD_OBSERVED').length],['simulation',s.jobs.filter(j=>j.status==='SIMULATION_COMPLETE').length]]){const card=document.createElement('div');card.className='card';text(card,n,'strong');text(card,t[key]);$('cards').appendChild(card);}
$('capacity').textContent=t.capacity+': '+s.storage.journalBytes.toLocaleString(document.documentElement.lang)+' / '+s.storage.maxBytes.toLocaleString(document.documentElement.lang)+' bytes · '+s.jobs.length+' / '+s.storage.maxJobs+' '+t.total;if(s.storage.capacityWarning){$('capacity').className='capacity-warning';$('capacity').appendChild(document.createTextNode(' · '+t.capacityWarning));}
let page=0;function render(reset=true){if(reset)page=0;const query=$('query').value.toLowerCase();const items=s.jobs.filter(j=>(!$('state').value||j.status===$('state').value)&&(!$('provider').value||j.provider===$('provider').value)&&(!$('attention').checked||attention(j))&&[j.jobId,j.sourceId,j.sha256].some(v=>v.toLowerCase().includes(query)));
page=Math.min(page,Math.max(0,Math.ceil(items.length/50)-1));$('previous').disabled=page===0;$('next').disabled=(page+1)*50>=items.length;$('count').textContent=t.total+': '+items.length+' · '+(items.length?page*50+1:0)+'–'+Math.min((page+1)*50,items.length);$('rows').replaceChildren();
for(const j of items.slice(page*50,(page+1)*50)){const tr=document.createElement('tr');if(attention(j))tr.className='attention';const cells=Array.from({length:6},()=>{const td=document.createElement('td');tr.appendChild(td);return td;});const id=text(cells[0],j.jobId.slice(0,12)+'…','code');id.title=j.jobId;const detail=document.createElement('details');text(detail,t.details,'summary');const dl=document.createElement('dl');dl.className='detail';for(const [key,value,isDate] of [['job',j.jobId],['updated',j.updatedAt,true],['source',j.sourceId],['hash',j.sha256],['entries',j.entryCount],['version',j.objectVersion??'—'],['requested',j.requestedRetainUntil,true],['observed',j.observedRetainUntil,true]]){text(dl,t[key],'dt');const dd=document.createElement('dd');if(isDate)dd.appendChild(date(value));else text(dd,value,key==='entries'?'span':'code');dl.appendChild(dd);}detail.appendChild(dl);cells[0].appendChild(detail);text(cells[1],data.stateNames[j.status]);text(cells[1],j.status,'code');text(cells[2],data.providerNames[j.provider]);text(cells[3],j.attempts+' / '+j.totalAttempts);cells[4].appendChild(date(j.nextAttemptAt));
const messages=[];if(j.error==='STORAGE_TIMEOUT')messages.push(t.timeout);else if(j.error==='STORAGE_CONTENT_MISMATCH')messages.push(t.contentMismatch);else if(j.error)messages.push(t.unknownError);if(j.status==='WRITING'||j.error==='JOBS_ATTEMPT_INTERRUPTED')messages.push(t.interrupted);if(expired(j))messages.push(t.expired);for(const m of messages)text(cells[5],m,'p');if(j.error)text(cells[5],j.error,'code');if(!messages.length)text(cells[5],'—');$('rows').appendChild(tr);}
if(!items.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent=t.empty;tr.appendChild(td);$('rows').appendChild(tr);}}
$('filters').addEventListener('submit',e=>e.preventDefault());for(const id of ['query','state','provider','attention'])$(id).addEventListener('input',()=>render());$('previous').addEventListener('click',()=>{page--;render(false)});$('next').addEventListener('click',()=>{page++;render(false)});
$('download').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thundy-storage-status.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});render();
</script></html>`, language);
}
module.exports = { reviewHtml, report, labels };
