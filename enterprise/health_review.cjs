"use strict";
const { decorateHTML } = require("./design_system.cjs");
const crypto = require("node:crypto");
const { need } = require("./durable_journal.cjs");
const labels = {
  en: {
    title: "Thundy AV · Operational report",
    intro:
      "Local queue snapshot. This report contains no link or device identifiers.",
    fresh: "Current snapshot",
    stale: "Out-of-date snapshot",
    time: "Captured at (UTC)",
    age: "Snapshot age (seconds)",
    queue: "Queue",
    state: "State",
    count: "Count",
    capacity: "Storage capacity used",
    errors: "Grouped errors",
    alarms: "Alert candidates",
    condition: "Condition",
    none: "None",
    foot: "No fleet heartbeat measured. No external delivery or protected storage confirmed. This is an unsigned summary.",
    outbox: "Event queue",
    storage: "Evidence storage jobs",
    connectors: "SIEM export jobs",
    high: "High",
    medium: "Medium",
    severity: "Priority",
    notifications: "New alert candidates",
    unknown: "Unclassified error",
    codes: [
      "Event delivery needs intervention",
      "Event queue nearing capacity",
      "Storage jobs need intervention",
      "Storage queue nearing capacity",
      "Storage retries due",
      "Retention deadline approaching",
      "Retention period expired",
      "SIEM exports need intervention",
      "SIEM queue nearing capacity",
      "Snapshot is out of date",
    ],
    states: [
      "Queued",
      "Retry scheduled",
      "Locally received",
      "Needs intervention",
      "Write in progress",
      "Simulation complete",
      "Cloud storage observed",
      "Exported locally",
    ],
  },
  de: {
    title: "Thundy AV · Betriebsbericht",
    intro:
      "Lokale Queue-Momentaufnahme. Dieser Bericht enthält keine Link- oder Gerätekennungen.",
    fresh: "Aktuelle Momentaufnahme",
    stale: "Veraltete Momentaufnahme",
    time: "Erfasst am (UTC)",
    age: "Alter der Momentaufnahme (Sekunden)",
    queue: "Warteschlange",
    state: "Status",
    count: "Anzahl",
    capacity: "Genutzte Speicherkapazität",
    errors: "Zusammengefasste Fehler",
    alarms: "Alarmkandidaten",
    condition: "Befund",
    none: "Keine",
    foot: "Keine Flotten-Heartbeats gemessen. Keine externe Zustellung oder geschützte Ablage bestätigt. Dies ist eine unsignierte Zusammenfassung.",
    outbox: "Ereignisqueue",
    storage: "Ablageaufträge",
    connectors: "SIEM-Exportaufträge",
    high: "Hoch",
    medium: "Mittel",
    severity: "Priorität",
    notifications: "Neue Alarmkandidaten",
    unknown: "Nicht klassifizierter Fehler",
    codes: [
      "Ereigniszustellung benötigt Eingriff",
      "Ereignisqueue fast voll",
      "Ablageaufträge benötigen Eingriff",
      "Ablagequeue fast voll",
      "Ablage-Wiederholungen fällig",
      "Aufbewahrungsfrist endet bald",
      "Aufbewahrungsfrist abgelaufen",
      "SIEM-Exporte benötigen Eingriff",
      "SIEM-Queue fast voll",
      "Momentaufnahme ist veraltet",
    ],
    states: [
      "Eingereiht",
      "Wiederholung geplant",
      "Lokal angenommen",
      "Eingriff erforderlich",
      "Schreibvorgang läuft",
      "Simulation abgeschlossen",
      "Cloudablage beobachtet",
      "Lokal exportiert",
    ],
  },
  fr: {
    title: "Thundy AV · Rapport opérationnel",
    intro:
      "Instantané local des files. Ce rapport ne contient aucun identifiant de lien ou d’appareil.",
    fresh: "Instantané actuel",
    stale: "Instantané périmé",
    time: "Capturé le (UTC)",
    age: "Âge de l’instantané (secondes)",
    queue: "File",
    state: "État",
    count: "Nombre",
    capacity: "Capacité de stockage utilisée",
    errors: "Erreurs regroupées",
    alarms: "Alertes proposées",
    condition: "Constat",
    none: "Aucun",
    foot: "Aucun signal de flotte mesuré. Aucune livraison externe ni conservation protégée confirmée. Résumé non signé.",
    outbox: "File d’événements",
    storage: "Tâches de stockage",
    connectors: "Exports SIEM",
    high: "Élevée",
    medium: "Moyenne",
    severity: "Priorité",
    notifications: "Nouvelles alertes proposées",
    unknown: "Erreur non classée",
    codes: [
      "La livraison nécessite une intervention",
      "File d’événements presque pleine",
      "Le stockage nécessite une intervention",
      "File de stockage presque pleine",
      "Nouvelles tentatives de stockage dues",
      "Échéance de conservation proche",
      "Durée de conservation expirée",
      "Les exports SIEM nécessitent une intervention",
      "File SIEM presque pleine",
      "Instantané périmé",
    ],
    states: [
      "En attente",
      "Nouvelle tentative prévue",
      "Reçu localement",
      "Intervention nécessaire",
      "Écriture en cours",
      "Simulation terminée",
      "Stockage cloud observé",
      "Exporté localement",
    ],
  },
  es: {
    title: "Thundy AV · Informe operativo",
    intro:
      "Instantánea local de las colas. No contiene identificadores de enlaces ni de dispositivos.",
    fresh: "Instantánea actual",
    stale: "Instantánea desactualizada",
    time: "Capturado el (UTC)",
    age: "Antigüedad de la instantánea (segundos)",
    queue: "Cola",
    state: "Estado",
    count: "Cantidad",
    capacity: "Capacidad de almacenamiento utilizada",
    errors: "Errores agrupados",
    alarms: "Alertas propuestas",
    condition: "Hallazgo",
    none: "Ninguno",
    foot: "No se midieron señales de la flota. No se confirmó entrega externa ni almacenamiento protegido. Resumen sin firma.",
    outbox: "Cola de eventos",
    storage: "Trabajos de almacenamiento",
    connectors: "Exportaciones SIEM",
    high: "Alta",
    medium: "Media",
    severity: "Prioridad",
    notifications: "Nuevas alertas propuestas",
    unknown: "Error sin clasificar",
    codes: [
      "La entrega necesita intervención",
      "Cola de eventos casi llena",
      "El almacenamiento necesita intervención",
      "Cola de almacenamiento casi llena",
      "Reintentos de almacenamiento pendientes",
      "La retención vence pronto",
      "Plazo de retención vencido",
      "Las exportaciones SIEM necesitan intervención",
      "Cola SIEM casi llena",
      "Instantánea desactualizada",
    ],
    states: [
      "En cola",
      "Reintento programado",
      "Recibido localmente",
      "Requiere intervención",
      "Escritura en curso",
      "Simulación completada",
      "Almacenamiento cloud observado",
      "Exportado localmente",
    ],
  },
  it: {
    title: "Thundy AV · Rapporto operativo",
    intro:
      "Istantanea locale delle code. Non contiene identificatori di link o dispositivi.",
    fresh: "Istantanea aggiornata",
    stale: "Istantanea obsoleta",
    time: "Acquisita il (UTC)",
    age: "Età dell’istantanea (secondi)",
    queue: "Coda",
    state: "Stato",
    count: "Numero",
    capacity: "Capacità di archiviazione utilizzata",
    errors: "Errori raggruppati",
    alarms: "Avvisi proposti",
    condition: "Riscontro",
    none: "Nessuno",
    foot: "Nessun segnale della flotta misurato. Nessuna consegna esterna o archiviazione protetta confermata. Riepilogo non firmato.",
    outbox: "Coda eventi",
    storage: "Attività di archiviazione",
    connectors: "Esportazioni SIEM",
    high: "Alta",
    medium: "Media",
    severity: "Priorità",
    notifications: "Nuovi avvisi proposti",
    unknown: "Errore non classificato",
    codes: [
      "La consegna richiede intervento",
      "Coda eventi quasi piena",
      "L’archiviazione richiede intervento",
      "Coda di archiviazione quasi piena",
      "Tentativi di archiviazione in scadenza",
      "La conservazione scade a breve",
      "Periodo di conservazione scaduto",
      "Le esportazioni SIEM richiedono intervento",
      "Coda SIEM quasi piena",
      "Istantanea obsoleta",
    ],
    states: [
      "In coda",
      "Nuovo tentativo previsto",
      "Ricevuto localmente",
      "Intervento necessario",
      "Scrittura in corso",
      "Simulazione completata",
      "Archiviazione cloud osservata",
      "Esportato localmente",
    ],
  },
  pl: {
    title: "Thundy AV · Raport operacyjny",
    intro:
      "Lokalny zrzut stanu kolejek. Nie zawiera identyfikatorów linków ani urządzeń.",
    fresh: "Aktualny zrzut stanu",
    stale: "Nieaktualny zrzut stanu",
    time: "Zarejestrowano (UTC)",
    age: "Wiek zrzutu stanu (sekundy)",
    queue: "Kolejka",
    state: "Stan",
    count: "Liczba",
    capacity: "Wykorzystana pojemność pamięci",
    errors: "Pogrupowane błędy",
    alarms: "Proponowane alarmy",
    condition: "Ustalenie",
    none: "Brak",
    foot: "Nie zmierzono sygnałów floty. Nie potwierdzono dostarczenia zewnętrznego ani chronionego przechowywania. Niepodpisane podsumowanie.",
    outbox: "Kolejka zdarzeń",
    storage: "Zadania przechowywania",
    connectors: "Eksporty SIEM",
    high: "Wysoki",
    medium: "Średni",
    severity: "Priorytet",
    notifications: "Nowe proponowane alarmy",
    unknown: "Niesklasyfikowany błąd",
    codes: [
      "Dostarczanie wymaga interwencji",
      "Kolejka zdarzeń prawie pełna",
      "Przechowywanie wymaga interwencji",
      "Kolejka przechowywania prawie pełna",
      "Ponowienia przechowywania są wymagane",
      "Termin retencji wkrótce upływa",
      "Okres retencji wygasł",
      "Eksporty SIEM wymagają interwencji",
      "Kolejka SIEM prawie pełna",
      "Zrzut stanu jest nieaktualny",
    ],
    states: [
      "W kolejce",
      "Zaplanowano ponowienie",
      "Przyjęto lokalnie",
      "Wymaga interwencji",
      "Trwa zapis",
      "Symulacja zakończona",
      "Zaobserwowano przechowywanie cloud",
      "Wyeksportowano lokalnie",
    ],
  },
};
const codes = [
  "OUTBOX_DEAD_LETTER",
  "OUTBOX_CAPACITY",
  "STORAGE_DEAD_LETTER",
  "STORAGE_CAPACITY",
  "STORAGE_RETRY_DUE",
  "STORAGE_RETENTION_DUE",
  "STORAGE_RETENTION_EXPIRED",
  "CONNECTOR_DEAD_LETTER",
  "CONNECTOR_CAPACITY",
  "SNAPSHOT_STALE",
];
const states = [
  "QUEUED",
  "RETRY",
  "STAGED",
  "DEAD_LETTER",
  "WRITING",
  "SIMULATION_COMPLETE",
  "CLOUD_OBSERVED",
  "EXPORTED",
  "PENDING",
];
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeCount = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
function reviewHtml(report, language = "en") {
  need(
    Object.hasOwn(labels, language) &&
      report?.kind === "thundy-local-health" &&
      report.schemaVersion === 1 &&
      report.sealed === false &&
      typeof report.stale === "boolean" &&
      Number.isFinite(Date.parse(report.capturedAt)) &&
      Number.isSafeInteger(report.ageMs) &&
      report.ageMs >= 0 &&
      report.metrics &&
      Array.isArray(report.conditions) &&
      Array.isArray(report.errors),
    "HEALTH_REVIEW_INVALID",
  );
  const l = labels[language],
    nonce = crypto.randomBytes(18).toString("base64");
  const table = (headers, rows) =>
    `<div class="scroll" tabindex="0"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c, i) => `<td data-label="${esc(headers[i])}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const metrics = [];
  for (const name of ["outbox", "storage", "connectors"]) {
    const m = report.metrics[name];
    if (!m) continue;
    for (const state of states) {
      const count = m.counts?.[state];
      if (count !== undefined)
        metrics.push([
          l[name],
          l.states[state === "PENDING" ? 0 : states.indexOf(state)],
          safeCount(count),
        ]);
    }
    const ratio =
      Number.isFinite(m.capacityRatio) &&
      m.capacityRatio >= 0 &&
      m.capacityRatio <= 1
        ? m.capacityRatio
        : 0;
    metrics.push([l[name], l.capacity, Math.round(ratio * 100) + "%"]);
  }
  // Unknown supplied text is never reflected into a display column.
  const alerts = report.conditions.map((c) => [
    l.codes[codes.indexOf(c.code)] || l.unknown,
    l[c.severity] || l.medium,
    safeCount(c.count),
  ]);
  const errors = report.errors.map((e) => [
    typeof e.code === "string" &&
    [
      "DELIVERY_TIMEOUT",
      "STORAGE_TIMEOUT",
      "LOCAL_EXPORT_FAILED",
      "LOCAL_EXPORT_CONFLICT",
      "STORAGE_CONTENT_MISMATCH",
      "UNCLASSIFIED_ERROR",
    ].includes(e.code)
      ? e.code
      : l.unknown,
    safeCount(e.count),
  ]);
  return decorateHTML(`<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>${esc(l.title)}</title><style nonce="${nonce}">:root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif}body{margin:0;background:var(--bg-color);color:var(--text-color)}main{max-width:960px;margin:auto;padding:clamp(16px,4vw,40px)}header,section,footer{background:var(--card-bg);border:1px solid var(--card-border);border-radius:16px;padding:20px;margin:16px 0}h1{font-size:clamp(23px,4vw,34px);line-height:1.2}h2{font-size:21px}.badge{display:inline-block;border-radius:8px;padding:6px 12px;background:${report.stale ? "var(--color-warning)" : "var(--color-success)"};color:var(--text-color);font-weight:700}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid var(--card-border);padding:10px;overflow-wrap:anywhere}footer{font-size:14px}dt{font-weight:600}dd{margin:0 0 8px}@media(prefers-color-scheme:dark){body{background:var(--bg-color);color:var(--text-color)}header,section,footer{background:var(--card-bg);border-color:var(--card-border)}th,td{border-color:var(--card-border)}}@media(max-width:600px){thead{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%)}tr{display:block;border:1px solid var(--card-border);border-radius:10px;margin:12px 0;padding:8px}td{display:block;border:0;padding:6px}td::before{content:attr(data-label);display:block;font-weight:650;color:inherit}table{border-collapse:separate}}@media print{body{background:white;color:black}main{padding:0}.scroll{overflow:visible}}</style></head><body><main><header><h1>${esc(l.title)}</h1><p>${esc(l.intro)}</p><p class="badge ${report.stale ? "warning" : "recent"}">${esc(report.stale ? l.stale : l.fresh)}</p><dl><dt>${esc(l.time)}</dt><dd>${esc(new Date(report.capturedAt).toISOString())}</dd><dt>${esc(l.age)}</dt><dd>${Math.floor(report.ageMs / 1000)}</dd></dl></header><section><h2>${esc(l.queue)}</h2>${table([l.queue, l.state, l.count], metrics)}</section><section><h2>${esc(l.alarms)}</h2>${alerts.length ? table([l.condition, l.severity, l.count], alerts) : `<p>${esc(l.none)}</p>`}${Array.isArray(report.notifications) ? `<p>${esc(l.notifications)}: ${safeCount(report.notifications.length)}</p>` : ""}</section><section><h2>${esc(l.errors)}</h2>${errors.length ? table([l.condition, l.count], errors) : `<p>${esc(l.none)}</p>`}</section><footer>${esc(l.foot)}</footer></main></body></html>`, language);
}
module.exports = { reviewHtml, labels };
