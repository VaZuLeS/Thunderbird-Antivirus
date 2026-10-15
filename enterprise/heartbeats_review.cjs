"use strict";
const crypto = require("node:crypto");
const { need } = require("./durable_journal.cjs");
const labels = {
  en: {
    minimum: "Minimum extension version",
    lateAfter: "Late after (seconds)",
    unknownAfter: "Too old after (seconds)",

    title: "Test device reports",
    intro:
      "Local overview of explicitly registered test devices. No production fleet or enterprise access control has been verified.",
    caveat:
      "Versions, policy and queues are signed self-reports, not installation or compliance attestations. A recent report does not prove that a device is online.",
    snapshot:
      "Snapshot evaluated at (UTC); statuses do not update automatically",
    devices: "Registered devices",
    search: "Search device or key identifier",
    status: "Report status",
    all: "All",
    issues: "Reported problems",
    onlyIssues: "Only reported problems",
    results: "Displayed / matching / registered",
    previous: "Previous",
    next: "Next",
    download: "Export all devices (JSON)",
    device: "Device identifier",
    key: "Key identifier",
    received: "Received at (UTC)",
    observed: "Observed on device (UTC)",
    age: "Report age (seconds)",
    extension: "Reported extension version",
    policy: "Reported policy version",
    expected: "Expected policy version",
    broker: "Reported broker readiness",
    pending: "Pending",
    retry: "Retry",
    deadLetter: "Needs intervention",
    bytes: "Queue size (bytes)",
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    head: "Journal head",
    fingerprint: "Writer key fingerprint",
    pinned: "External head checked",
    unpinned:
      "No external head: truncation to a valid journal prefix cannot be detected",
    empty: "No matching devices",
    never: "Never reported",
    current: "Recent report",
    late: "Late report",
    stale: "Report too old",
    revoked: "Registration revoked",
    notReported: "Not reported",
    below: "Below minimum",
    meets: "Meets minimum",
    behind: "Behind",
    ahead: "Ahead",
    matches: "Matches",
    proof:
      "Device and journal signatures checked. This HTML and its JSON export are unsigned snapshots; verify the original journal again for a new review.",
  },
  de: {
    minimum: "Extension-Mindestversion",
    lateAfter: "Verspätet ab (Sekunden)",
    unknownAfter: "Zu alt ab (Sekunden)",

    title: "Testgeräte-Meldungen",
    intro:
      "Lokale Übersicht ausdrücklich registrierter Testgeräte. Keine produktive Flotte oder zentrale Zugriffskontrolle wurde abgenommen.",
    caveat:
      "Versionen, Policy und Warteschlangen sind signierte Selbstauskünfte, keine Installations- oder Complianceattestation. Eine aktuelle Meldung belegt keinen Onlinestatus.",
    snapshot:
      "Momentaufnahme ausgewertet am (UTC); Status aktualisiert sich nicht automatisch",
    devices: "Registrierte Geräte",
    search: "Geräte- oder Schlüsselkennung suchen",
    status: "Meldestatus",
    all: "Alle",
    issues: "Gemeldete Probleme",
    onlyIssues: "Nur gemeldete Probleme",
    results: "Angezeigt / passend / registriert",
    previous: "Zurück",
    next: "Weiter",
    download: "Alle Geräte exportieren (JSON)",
    device: "Gerätekennung",
    key: "Schlüsselkennung",
    received: "Empfangen am (UTC)",
    observed: "Am Gerät beobachtet (UTC)",
    age: "Meldungsalter (Sekunden)",
    extension: "Gemeldete Extension-Version",
    policy: "Gemeldete Policy-Version",
    expected: "Erwartete Policy-Version",
    broker: "Gemeldete Brokerbereitschaft",
    pending: "Ausstehend",
    retry: "Wiederholung",
    deadLetter: "Eingriff erforderlich",
    bytes: "Queuegröße (Bytes)",
    yes: "Ja",
    no: "Nein",
    unknown: "Unbekannt",
    head: "Journal-Endhash",
    fingerprint: "Fingerabdruck des Writer-Schlüssels",
    pinned: "Externer Endhash geprüft",
    unpinned:
      "Kein externer Endhash: Abschneiden auf einen gültigen Journal-Anfang bleibt unerkannt",
    empty: "Keine passenden Geräte",
    never: "Nie gemeldet",
    current: "Aktuelle Meldung",
    late: "Verspätete Meldung",
    stale: "Meldung zu alt",
    revoked: "Registrierung widerrufen",
    notReported: "Nicht gemeldet",
    below: "Unter Mindestversion",
    meets: "Mindestversion erfüllt",
    behind: "Im Rückstand",
    ahead: "Voraus",
    matches: "Entspricht",
    proof:
      "Geräte- und Journalsignaturen geprüft. HTML und JSON-Export sind unsignierte Momentaufnahmen; für eine neue Prüfung das Originaljournal erneut verifizieren.",
  },
  fr: {
    minimum: "Version minimale de l’extension",
    lateAfter: "En retard après (secondes)",
    unknownAfter: "Trop ancien après (secondes)",

    title: "Rapports des appareils de test",
    intro:
      "Vue locale des appareils de test explicitement enregistrés. Aucun parc de production ni contrôle central des accès n’a été validé.",
    caveat:
      "Versions, politique et files sont des déclarations signées, pas des attestations d’installation ou de conformité. Un rapport récent ne prouve pas que l’appareil est en ligne.",
    snapshot:
      "Instantané évalué le (UTC) ; les états ne se mettent pas à jour automatiquement",
    devices: "Appareils enregistrés",
    search: "Rechercher un identifiant d’appareil ou de clé",
    status: "État du rapport",
    all: "Tous",
    issues: "Problèmes signalés",
    onlyIssues: "Uniquement les problèmes signalés",
    results: "Affichés / correspondants / enregistrés",
    previous: "Précédent",
    next: "Suivant",
    download: "Exporter tous les appareils (JSON)",
    device: "Identifiant de l’appareil",
    key: "Identifiant de clé",
    received: "Reçu le (UTC)",
    observed: "Observé sur l’appareil (UTC)",
    age: "Âge du rapport (secondes)",
    extension: "Version déclarée de l’extension",
    policy: "Version déclarée de la politique",
    expected: "Version attendue de la politique",
    broker: "Disponibilité déclarée du broker",
    pending: "En attente",
    retry: "Nouvelle tentative",
    deadLetter: "Intervention requise",
    bytes: "Taille de la file (octets)",
    yes: "Oui",
    no: "Non",
    unknown: "Inconnu",
    head: "Empreinte de fin du journal",
    fingerprint: "Empreinte de la clé du rédacteur",
    pinned: "Empreinte externe vérifiée",
    unpinned:
      "Sans empreinte externe : une troncature en préfixe valide du journal reste indétectable",
    empty: "Aucun appareil correspondant",
    never: "Aucun rapport reçu",
    current: "Rapport récent",
    late: "Rapport en retard",
    stale: "Rapport trop ancien",
    revoked: "Enregistrement révoqué",
    notReported: "Non déclaré",
    below: "Sous le minimum",
    meets: "Minimum atteint",
    behind: "En retard",
    ahead: "En avance",
    matches: "Conforme à la version attendue",
    proof:
      "Signatures des appareils et du journal vérifiées. Ce HTML et son export JSON sont des instantanés non signés ; vérifiez à nouveau le journal original pour une nouvelle analyse.",
  },
  es: {
    minimum: "Versión mínima de la extensión",
    lateAfter: "Retrasado tras (segundos)",
    unknownAfter: "Demasiado antiguo tras (segundos)",

    title: "Informes de dispositivos de prueba",
    intro:
      "Vista local de dispositivos de prueba registrados explícitamente. No se ha validado una flota de producción ni el control central de acceso.",
    caveat:
      "Las versiones, políticas y colas son declaraciones firmadas, no certificaciones de instalación o cumplimiento. Un informe reciente no demuestra que el dispositivo esté conectado.",
    snapshot:
      "Instantánea evaluada en (UTC); los estados no se actualizan automáticamente",
    devices: "Dispositivos registrados",
    search: "Buscar identificador de dispositivo o clave",
    status: "Estado del informe",
    all: "Todos",
    issues: "Problemas notificados",
    onlyIssues: "Solo problemas notificados",
    results: "Mostrados / coincidentes / registrados",
    previous: "Anterior",
    next: "Siguiente",
    download: "Exportar todos los dispositivos (JSON)",
    device: "Identificador del dispositivo",
    key: "Identificador de clave",
    received: "Recibido en (UTC)",
    observed: "Observado en el dispositivo (UTC)",
    age: "Antigüedad del informe (segundos)",
    extension: "Versión declarada de la extensión",
    policy: "Versión declarada de la política",
    expected: "Versión esperada de la política",
    broker: "Disponibilidad declarada del broker",
    pending: "Pendientes",
    retry: "Reintento",
    deadLetter: "Requiere intervención",
    bytes: "Tamaño de la cola (bytes)",
    yes: "Sí",
    no: "No",
    unknown: "Desconocido",
    head: "Hash final del registro",
    fingerprint: "Huella de la clave del escritor",
    pinned: "Hash externo verificado",
    unpinned:
      "Sin hash externo: no se detecta el truncamiento a un prefijo válido del registro",
    empty: "Sin dispositivos coincidentes",
    never: "Nunca ha informado",
    current: "Informe reciente",
    late: "Informe retrasado",
    stale: "Informe demasiado antiguo",
    revoked: "Registro revocado",
    notReported: "Sin declarar",
    below: "Por debajo del mínimo",
    meets: "Cumple el mínimo",
    behind: "Atrasada",
    ahead: "Adelantada",
    matches: "Coincide",
    proof:
      "Firmas de dispositivos y del registro verificadas. Este HTML y su exportación JSON son instantáneas sin firma; vuelva a verificar el registro original para una nueva revisión.",
  },
  it: {
    minimum: "Versione minima dell’estensione",
    lateAfter: "In ritardo dopo (secondi)",
    unknownAfter: "Troppo vecchio dopo (secondi)",

    title: "Rapporti dei dispositivi di test",
    intro:
      "Panoramica locale dei dispositivi di test registrati esplicitamente. Nessuna flotta di produzione o controllo centrale degli accessi è stato convalidato.",
    caveat:
      "Versioni, criteri e code sono autodichiarazioni firmate, non attestazioni di installazione o conformità. Un rapporto recente non prova che il dispositivo sia online.",
    snapshot:
      "Istantanea valutata il (UTC); gli stati non si aggiornano automaticamente",
    devices: "Dispositivi registrati",
    search: "Cerca identificativo del dispositivo o della chiave",
    status: "Stato del rapporto",
    all: "Tutti",
    issues: "Problemi segnalati",
    onlyIssues: "Solo problemi segnalati",
    results: "Visualizzati / corrispondenti / registrati",
    previous: "Precedente",
    next: "Successivo",
    download: "Esporta tutti i dispositivi (JSON)",
    device: "Identificativo del dispositivo",
    key: "Identificativo della chiave",
    received: "Ricevuto il (UTC)",
    observed: "Osservato sul dispositivo (UTC)",
    age: "Età del rapporto (secondi)",
    extension: "Versione dichiarata dell’estensione",
    policy: "Versione dichiarata dei criteri",
    expected: "Versione prevista dei criteri",
    broker: "Disponibilità dichiarata del broker",
    pending: "In attesa",
    retry: "Nuovo tentativo",
    deadLetter: "Intervento necessario",
    bytes: "Dimensione della coda (byte)",
    yes: "Sì",
    no: "No",
    unknown: "Sconosciuto",
    head: "Hash finale del registro",
    fingerprint: "Impronta della chiave del redattore",
    pinned: "Hash esterno verificato",
    unpinned:
      "Senza hash esterno: il troncamento a un prefisso valido del registro non è rilevabile",
    empty: "Nessun dispositivo corrispondente",
    never: "Mai segnalato",
    current: "Rapporto recente",
    late: "Rapporto in ritardo",
    stale: "Rapporto troppo vecchio",
    revoked: "Registrazione revocata",
    notReported: "Non dichiarato",
    below: "Sotto il minimo",
    meets: "Minimo soddisfatto",
    behind: "Precedente",
    ahead: "Successiva",
    matches: "Corrispondente",
    proof:
      "Firme dei dispositivi e del registro verificate. Questo HTML e la sua esportazione JSON sono istantanee non firmate; verifica nuovamente il registro originale per una nuova analisi.",
  },
  pl: {
    minimum: "Minimalna wersja rozszerzenia",
    lateAfter: "Spóźniony po (sekundy)",
    unknownAfter: "Zbyt stary po (sekundy)",

    title: "Raporty urządzeń testowych",
    intro:
      "Lokalny przegląd jawnie zarejestrowanych urządzeń testowych. Nie zatwierdzono floty produkcyjnej ani centralnej kontroli dostępu.",
    caveat:
      "Wersje, zasady i kolejki to podpisane deklaracje, a nie poświadczenia instalacji lub zgodności. Niedawny raport nie dowodzi, że urządzenie jest online.",
    snapshot:
      "Migawka oceniona o (UTC); stany nie aktualizują się automatycznie",
    devices: "Zarejestrowane urządzenia",
    search: "Szukaj identyfikatora urządzenia lub klucza",
    status: "Stan raportu",
    all: "Wszystkie",
    issues: "Zgłoszone problemy",
    onlyIssues: "Tylko zgłoszone problemy",
    results: "Wyświetlone / pasujące / zarejestrowane",
    previous: "Wstecz",
    next: "Dalej",
    download: "Eksportuj wszystkie urządzenia (JSON)",
    device: "Identyfikator urządzenia",
    key: "Identyfikator klucza",
    received: "Odebrano o (UTC)",
    observed: "Zaobserwowano na urządzeniu (UTC)",
    age: "Wiek raportu (sekundy)",
    extension: "Zgłoszona wersja rozszerzenia",
    policy: "Zgłoszona wersja zasad",
    expected: "Oczekiwana wersja zasad",
    broker: "Zgłoszona gotowość brokera",
    pending: "Oczekujące",
    retry: "Ponowienie",
    deadLetter: "Wymagana interwencja",
    bytes: "Rozmiar kolejki (bajty)",
    yes: "Tak",
    no: "Nie",
    unknown: "Nieznany",
    head: "Końcowy skrót dziennika",
    fingerprint: "Odcisk klucza autora dziennika",
    pinned: "Sprawdzono zewnętrzny skrót",
    unpinned:
      "Bez zewnętrznego skrótu: obcięcie dziennika do prawidłowego prefiksu jest niewykrywalne",
    empty: "Brak pasujących urządzeń",
    never: "Nigdy nie zgłoszono",
    current: "Niedawny raport",
    late: "Spóźniony raport",
    stale: "Raport zbyt stary",
    revoked: "Rejestracja unieważniona",
    notReported: "Nie zgłoszono",
    below: "Poniżej minimum",
    meets: "Spełnia minimum",
    behind: "Starsza",
    ahead: "Nowsza",
    matches: "Zgodna",
    proof:
      "Sprawdzono podpisy urządzeń i dziennika. Ten HTML i eksport JSON są niepodpisanymi migawkami; przed kolejną oceną ponownie zweryfikuj oryginalny dziennik.",
  },
};
const states = ["NEVER_SEEN", "CURRENT", "LATE", "UNKNOWN", "REVOKED"];
const stateLabels = ["never", "current", "late", "stale", "revoked"];
const fields =
  "keyId,deviceId,status,receivedAt,observedAt,ageMs,sequence,extensionVersion,extensionState,policyVersion,expectedPolicyVersion,policyState,brokerReady".split(
    ",",
  );
function project(report) {
  need(
    report?.kind === "thundy-local-heartbeat-status" &&
      report.schemaVersion === 1 &&
      report.coverage === "explicit-test-registry-only" &&
      typeof report.criteria?.minimumExtensionVersion === "string" &&
      /^\d+\.\d+\.\d+$/.test(report.criteria.minimumExtensionVersion) &&
      Number.isSafeInteger(report.criteria.lateAfterMs) &&
      report.criteria.lateAfterMs > 0 &&
      Number.isSafeInteger(report.criteria.unknownAfterMs) &&
      report.criteria.unknownAfterMs > report.criteria.lateAfterMs &&
      report.runtimeIntegrated === false &&
      report.productionFleetVerified === false &&
      report.sealed === false &&
      Number.isFinite(Date.parse(report.evaluatedAt)) &&
      report.verification?.deviceSignaturesVerified === true &&
      report.verification.journalSignaturesVerified === true &&
      typeof report.verification.headPinned === "boolean" &&
      /^[a-f0-9]{64}$/.test(report.verification.signerFingerprint) &&
      (report.journalHead === null ||
        /^[a-f0-9]{64}$/.test(report.journalHead)) &&
      Array.isArray(report.devices) &&
      report.devices.length <= 1000,
    "HEARTBEAT_REVIEW_INVALID",
  );
  const devices = report.devices.map((d) => {
    need(
      states.includes(d.status) &&
        typeof d.deviceId === "string" &&
        typeof d.keyId === "string" &&
        [d.deviceId, d.keyId].every((s) => s.length > 0 && s.length <= 256) &&
        [d.receivedAt, d.observedAt].every(
          (v) =>
            v === null ||
            (typeof v === "string" && Number.isFinite(Date.parse(v))),
        ) &&
        [d.ageMs, d.sequence, d.policyVersion].every(
          (v) => v === null || (Number.isSafeInteger(v) && v >= 0),
        ) &&
        Number.isSafeInteger(d.expectedPolicyVersion) &&
        d.expectedPolicyVersion > 0 &&
        (d.extensionVersion === null ||
          (typeof d.extensionVersion === "string" &&
            d.extensionVersion.length <= 64)) &&
        [true, false, null].includes(d.brokerReady) &&
        ["not_reported", "below_minimum", "meets_minimum"].includes(
          d.extensionState,
        ) &&
        ["not_reported", "behind", "ahead", "matches"].includes(
          d.policyState,
        ) &&
        (d.queue === null ||
          ["pending", "retry", "deadLetter", "bytes"].every(
            (k) => Number.isSafeInteger(d.queue[k]) && d.queue[k] >= 0,
          )),
      "HEARTBEAT_REVIEW_INVALID",
    );
    const row = Object.fromEntries(fields.map((k) => [k, d[k]]));
    row.queue =
      d.queue === null
        ? null
        : Object.fromEntries(
            ["pending", "retry", "deadLetter", "bytes"].map((k) => [
              k,
              d.queue[k],
            ]),
          );
    return row;
  });
  need(
    new Set(devices.map((d) => d.deviceId)).size === devices.length &&
      new Set(devices.map((d) => d.keyId)).size === devices.length,
    "HEARTBEAT_REVIEW_INVALID",
  );
  return {
    schemaVersion: 1,
    kind: "thundy-unsigned-heartbeat-review",
    evaluatedAt: report.evaluatedAt,
    coverage: report.coverage,
    criteria: {
      minimumExtensionVersion: report.criteria.minimumExtensionVersion,
      lateAfterMs: report.criteria.lateAfterMs,
      unknownAfterMs: report.criteria.unknownAfterMs,
    },
    runtimeIntegrated: false,
    productionFleetVerified: false,
    sealed: false,
    source: {
      journalHead: report.journalHead,
      signerFingerprint: report.verification.signerFingerprint,
      headPinned: report.verification.headPinned,
    },
    devices,
  };
}
function client(data, l, states, stateLabels, language) {
  const $ = (id) => document.getElementById(id),
    make = (tag, text) => {
      const e = document.createElement(tag);
      if (text !== undefined) e.textContent = text;
      return e;
    };
  const number = (n) =>
    n === null ? l.unknown : new Intl.NumberFormat(language).format(n);
  const time = (t) =>
    t === null
      ? l.notReported
      : new Intl.DateTimeFormat(language, {
          dateStyle: "medium",
          timeStyle: "medium",
          timeZone: "UTC",
        }).format(new Date(t));
  const problem = (d) =>
    d.brokerReady === false ||
    d.queue?.retry > 0 ||
    d.queue?.deadLetter > 0 ||
    d.extensionState === "below_minimum" ||
    ["behind", "ahead"].includes(d.policyState);
  let page = 0;
  const pair = (dl, label, value) => {
    dl.append(make("dt", label), make("dd", value));
  };
  function render() {
    const query = $("search").value.trim().toLocaleLowerCase(language);
    const rows = data.devices.filter(
      (d) =>
        (!$("status").value || d.status === $("status").value) &&
        (!$("issues").checked || problem(d)) &&
        (d.deviceId + " " + d.keyId)
          .toLocaleLowerCase(language)
          .includes(query),
    );
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / 25) - 1));
    const shown = rows.slice(page * 25, (page + 1) * 25);
    $("cards").replaceChildren();
    for (const d of shown) {
      const article = make("article"),
        title = make("h3", d.keyId),
        badge = make("p", l[stateLabels[states.indexOf(d.status)]]);
      badge.className =
        "badge " + (d.status === "CURRENT" ? "recent" : "attention");
      const dl = make("dl");
      pair(dl, l.device, d.deviceId);
      pair(dl, l.received, time(d.receivedAt));
      pair(dl, l.observed, time(d.observedAt));
      pair(
        dl,
        l.age,
        number(d.ageMs === null ? null : Math.floor(d.ageMs / 1000)),
      );
      pair(
        dl,
        l.extension,
        (d.extensionVersion ?? l.notReported) +
          " · " +
          l[
            {
              not_reported: "notReported",
              below_minimum: "below",
              meets_minimum: "meets",
            }[d.extensionState]
          ],
      );
      pair(
        dl,
        l.policy,
        number(d.policyVersion) +
          " · " +
          l[
            {
              not_reported: "notReported",
              behind: "behind",
              ahead: "ahead",
              matches: "matches",
            }[d.policyState]
          ],
      );
      pair(dl, l.expected, number(d.expectedPolicyVersion));
      pair(
        dl,
        l.broker,
        d.brokerReady === null ? l.unknown : d.brokerReady ? l.yes : l.no,
      );
      for (const k of ["pending", "retry", "deadLetter", "bytes"])
        pair(dl, l[k], number(d.queue === null ? null : d.queue[k]));
      article.append(title, badge, dl);
      $("cards").append(article);
    }
    if (!rows.length) $("cards").append(make("p", l.empty));
    $("results").textContent =
      l.results +
      ": " +
      [shown.length, rows.length, data.devices.length].map(number).join(" / ");
    $("previous").disabled = page === 0;
    $("next").disabled = (page + 1) * 25 >= rows.length;
  }
  for (const id of ["search", "status", "issues"])
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
    );
    const a = make("a");
    a.href = url;
    a.download = "thundy-heartbeat-review.json";
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
function reviewHtml(report, language = "en") {
  need(Object.hasOwn(labels, language), "HEARTBEAT_LANGUAGE_INVALID");
  const data = project(report),
    l = labels[language],
    nonce = crypto.randomBytes(18).toString("base64");
  const counts = states
    .map(
      (s, i) =>
        `<li><strong>${data.devices.filter((d) => d.status === s).length}</strong> ${esc(l[stateLabels[i]])}</li>`,
    )
    .join("");
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>Thundy AV · ${esc(l.title)}</title><style nonce="${nonce}">
:root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;background:#f2f5fa;color:#18263a}main{max-width:1080px;margin:auto;padding:clamp(16px,4vw,40px)}header,section,footer,article{background:#fff;border:1px solid #ccd7e5;border-radius:16px;padding:20px;margin:16px 0}h1{font-size:clamp(24px,4vw,36px);line-height:1.2}h2{font-size:22px}h3{font-size:19px}h1,h2,h3,dd,li,p{overflow-wrap:anywhere}header{border-top:5px solid #176c80}.brand{font-weight:800;letter-spacing:.1em;color:#176c80}dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:8px 20px}dt{font-weight:650}dd{margin:0;min-width:0}ul{display:flex;flex-wrap:wrap;gap:10px;padding:0;list-style:none}li{background:#edf3f8;border-radius:10px;padding:10px 14px}.badge{display:inline-block;border-radius:8px;padding:5px 10px;font-weight:700}.recent{background:#d7f4e9;color:#173d32}.attention{background:#fff0c2;color:#4b3500}.filters{display:flex;flex-wrap:wrap;gap:18px;align-items:end}.filters label{display:flex;flex-direction:column;gap:5px;flex:1;min-width:180px}.filters .check{flex-direction:row;align-items:center}input,select,button{font:inherit;padding:9px 12px;border:1px solid #9aafbf;border-radius:8px;max-width:100%}input[type=search],select{width:100%;min-width:0}input[type=checkbox]{width:20px;height:20px;flex-shrink:0}button{cursor:pointer;background:#176c80;color:white}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #ad6800;outline-offset:3px}.actions{display:flex;flex-wrap:wrap;gap:12px}footer{font-size:14px}article{background:#f8fafc}#results{font-weight:650}@media(prefers-color-scheme:dark){body{background:#101827;color:#e4edf8}header,section,footer{background:#18243a;border-color:#344560}article,li{background:#111d30;border-color:#344560}.brand{color:#8edee8}input,select{background:#111d30;color:#e4edf8}}@media(max-width:600px){dl{display:block}dd{margin:0 0 12px}header,section,footer,article{padding:16px}.filters label{min-width:0;flex-basis:100%}}@media print{.filters,.actions{display:none}body,header,section,footer,article{background:white;color:black}main{padding:0}}
</style></head><body><main><header><p class="brand">THUNDY AV</p><h1>${esc(l.title)}</h1><p>${esc(l.intro)}</p><p>${esc(l.caveat)}</p><dl><dt>${esc(l.snapshot)}</dt><dd>${esc(data.evaluatedAt)}</dd><dt>${esc(l.devices)}</dt><dd>${data.devices.length}</dd><dt>${esc(l.minimum)}</dt><dd>${esc(data.criteria.minimumExtensionVersion)}</dd><dt>${esc(l.lateAfter)}</dt><dd>${data.criteria.lateAfterMs / 1000}</dd><dt>${esc(l.unknownAfter)}</dt><dd>${data.criteria.unknownAfterMs / 1000}</dd></dl><ul>${counts}</ul></header><section><h2>${esc(l.devices)}</h2><div class="filters"><label>${esc(l.search)}<input id="search" type="search" autocomplete="off"></label><label>${esc(l.status)}<select id="status"><option value="">${esc(l.all)}</option>${states.map((s, i) => `<option value="${s}">${esc(l[stateLabels[i]])}</option>`).join("")}</select></label><label class="check"><input id="issues" type="checkbox">${esc(l.onlyIssues)}</label></div><p id="results" role="status" aria-live="polite"></p><div id="cards"></div><div class="actions"><button id="previous" type="button">${esc(l.previous)}</button><button id="next" type="button">${esc(l.next)}</button><button id="download" type="button">${esc(l.download)}</button></div></section><footer><p>${esc(l.proof)}</p><p>${esc(data.source.headPinned ? l.pinned : l.unpinned)}</p><dl><dt>${esc(l.head)}</dt><dd>${esc(data.source.journalHead ?? l.notReported)}</dd><dt>${esc(l.fingerprint)}</dt><dd>${esc(data.source.signerFingerprint)}</dd></dl></footer></main><script nonce="${nonce}">(${client.toString()})(${json(data)},${json(l)},${json(states)},${json(stateLabels)},${json(language)});</script></body></html>`;
}
module.exports = { reviewHtml, project, labels };
