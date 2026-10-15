"use strict";
const { decorateHTML } = require("./design_system.cjs");
const crypto = require("node:crypto");
const { need, hex } = require("./durable_journal.cjs");
const { redactUrl } = require("./contracts.cjs");
const fields = [
  "title",
  "intro",
  "proof",
  "pinned",
  "unpinned",
  "limits",
  "search",
  "all",
  "state",
  "priority",
  "outcome",
  "minimum",
  "unknownOnly",
  "unassigned",
  "assignee",
  "decision",
  "score",
  "policy",
  "rule",
  "revision",
  "history",
  "actor",
  "action",
  "time",
  "resolution",
  "previous",
  "next",
  "download",
  "none",
  "unknown",
  "footer",
  "provenance",
];
const translations = {
  en: [
    "Thundy AV · Incident review",
    "Read-only local snapshot of verified incident cases.",
    "Verification basis",
    "Journal head matches supplied reference",
    "No external head reference: a valid truncated prefix cannot be detected",
    "The case-writer signatures and transitions are verified. Original device evidence requires separate review. No SEALED storage or SSO permissions are confirmed.",
    "Search domain, rule or assignee",
    "All",
    "Case state",
    "Priority",
    "Recorded outcome",
    "Minimum score",
    "Only unknown scores",
    "Unassigned",
    "Assignee",
    "Decision at (UTC)",
    "Score at decision",
    "Policy version",
    "Rule",
    "Revision",
    "Case history",
    "Local actor",
    "Action",
    "Time (UTC)",
    "Resolution",
    "Previous",
    "Next",
    "Download all cases (JSON)",
    "No matching cases",
    "Unknown",
    "Unsigned snapshot. Filters do not change source data; this page performs no write or network actions.",
    "Provenance",
  ],
  de: [
    "Thundy AV · Fallübersicht",
    "Schreibgeschützte lokale Momentaufnahme geprüfter Incidentfälle.",
    "Prüfgrundlage",
    "Journalstand stimmt mit angegebenem Referenzhash überein",
    "Kein externer Referenzhash: gültiges Abschneiden bleibt unerkennbar",
    "Fallwriter-Signaturen und Übergänge sind geprüft. Original-Geräteevidenz benötigt eine separate Prüfung. Keine SEALED-Ablage oder SSO-Rechte bestätigt.",
    "Domain, Regel oder Bearbeiter suchen",
    "Alle",
    "Fallstatus",
    "Priorität",
    "Protokolliertes Ergebnis",
    "Mindestscore",
    "Nur unbekannte Scores",
    "Nicht zugewiesen",
    "Bearbeiter",
    "Entscheidung am (UTC)",
    "Score bei Entscheidung",
    "Policyversion",
    "Regel",
    "Revision",
    "Fallverlauf",
    "Lokaler Akteur",
    "Aktion",
    "Zeit (UTC)",
    "Abschluss",
    "Zurück",
    "Weiter",
    "Alle Fälle herunterladen (JSON)",
    "Keine passenden Fälle",
    "Unbekannt",
    "Unsignierte Momentaufnahme. Filter verändern keine Quelldaten; diese Seite führt keine Schreib- oder Netzwerkaktionen aus.",
    "Herkunftsnachweise",
  ],
  fr: [
    "Thundy AV · Suivi des incidents",
    "Instantané local en lecture seule des incidents vérifiés.",
    "Base de vérification",
    "Le journal correspond à la référence fournie",
    "Sans référence externe : une troncature valide reste indétectable",
    "Les signatures du rédacteur et les transitions sont vérifiées. Les preuves des appareils exigent un contrôle séparé. Aucun stockage SEALED ni droit SSO confirmé.",
    "Rechercher un domaine, une règle ou un responsable",
    "Tous",
    "État du dossier",
    "Priorité",
    "Résultat enregistré",
    "Score minimum",
    "Scores inconnus uniquement",
    "Non attribué",
    "Responsable",
    "Décision le (UTC)",
    "Score lors de la décision",
    "Version de politique",
    "Règle",
    "Révision",
    "Historique du dossier",
    "Acteur local",
    "Action",
    "Heure (UTC)",
    "Résolution",
    "Précédent",
    "Suivant",
    "Télécharger tous les dossiers (JSON)",
    "Aucun dossier correspondant",
    "Inconnu",
    "Instantané non signé. Les filtres ne modifient pas les données ; cette page ne réalise aucune écriture ni requête réseau.",
    "Provenance",
  ],
  es: [
    "Thundy AV · Revisión de incidentes",
    "Instantánea local de solo lectura de los casos verificados.",
    "Base de verificación",
    "El diario coincide con la referencia proporcionada",
    "Sin referencia externa: no se detecta un truncamiento válido",
    "Se verificaron las firmas del escritor y las transiciones. Las pruebas de dispositivos requieren revisión separada. No se confirma almacenamiento SEALED ni permisos SSO.",
    "Buscar dominio, regla o responsable",
    "Todos",
    "Estado del caso",
    "Prioridad",
    "Resultado registrado",
    "Puntuación mínima",
    "Solo puntuaciones desconocidas",
    "Sin asignar",
    "Responsable",
    "Decisión (UTC)",
    "Puntuación al decidir",
    "Versión de política",
    "Regla",
    "Revisión",
    "Historial del caso",
    "Actor local",
    "Acción",
    "Hora (UTC)",
    "Resolución",
    "Anterior",
    "Siguiente",
    "Descargar todos los casos (JSON)",
    "No hay casos coincidentes",
    "Desconocido",
    "Instantánea sin firma. Los filtros no alteran los datos; esta página no realiza escrituras ni solicitudes de red.",
    "Procedencia",
  ],
  it: [
    "Thundy AV · Revisione incidenti",
    "Istantanea locale di sola lettura dei casi verificati.",
    "Base di verifica",
    "Il registro corrisponde al riferimento fornito",
    "Senza riferimento esterno: un troncamento valido non è rilevabile",
    "Le firme del redattore e le transizioni sono verificate. Le prove dei dispositivi richiedono una verifica separata. Nessuna archiviazione SEALED o autorizzazione SSO confermata.",
    "Cerca dominio, regola o responsabile",
    "Tutti",
    "Stato del caso",
    "Priorità",
    "Esito registrato",
    "Punteggio minimo",
    "Solo punteggi sconosciuti",
    "Non assegnato",
    "Responsabile",
    "Decisione (UTC)",
    "Punteggio alla decisione",
    "Versione della policy",
    "Regola",
    "Revisione",
    "Cronologia del caso",
    "Attore locale",
    "Azione",
    "Ora (UTC)",
    "Risoluzione",
    "Precedente",
    "Successivo",
    "Scarica tutti i casi (JSON)",
    "Nessun caso corrispondente",
    "Sconosciuto",
    "Istantanea non firmata. I filtri non alterano i dati; questa pagina non effettua scritture o richieste di rete.",
    "Provenienza",
  ],
  pl: [
    "Thundy AV · Przegląd incydentów",
    "Lokalny zrzut zweryfikowanych spraw tylko do odczytu.",
    "Podstawa weryfikacji",
    "Dziennik odpowiada podanemu skrótowi odniesienia",
    "Brak zewnętrznego skrótu: prawidłowe obcięcie pozostaje niewykrywalne",
    "Zweryfikowano podpisy autora spraw i przejścia stanów. Dowody urządzeń wymagają osobnej kontroli. Nie potwierdzono przechowywania SEALED ani uprawnień SSO.",
    "Szukaj domeny, reguły lub osoby przypisanej",
    "Wszystkie",
    "Stan sprawy",
    "Priorytet",
    "Zapisany wynik",
    "Minimalny wynik",
    "Tylko nieznane wyniki",
    "Nie przypisano",
    "Osoba przypisana",
    "Decyzja (UTC)",
    "Wynik w chwili decyzji",
    "Wersja zasad",
    "Reguła",
    "Rewizja",
    "Historia sprawy",
    "Lokalny wykonawca",
    "Działanie",
    "Czas (UTC)",
    "Rozstrzygnięcie",
    "Poprzednia",
    "Następna",
    "Pobierz wszystkie sprawy (JSON)",
    "Brak pasujących spraw",
    "Nieznany",
    "Niepodpisany zrzut. Filtry nie zmieniają danych; strona nie wykonuje zapisu ani żądań sieciowych.",
    "Pochodzenie",
  ],
};
const enums = {
  en: {
    states: ["New", "Acknowledged", "In progress", "Resolved"],
    priorities: ["Low", "Medium", "High", "Critical"],
    outcomes: ["Opening requested", "Aborted", "Blocked", "Opening failed"],
    actions: ["Created", "Assigned", "State changed", "Reopened"],
    resolutions: ["False positive", "Remediated", "Risk accepted"],
  },
  de: {
    states: ["Neu", "Bestätigt", "In Bearbeitung", "Abgeschlossen"],
    priorities: ["Niedrig", "Mittel", "Hoch", "Kritisch"],
    outcomes: ["Öffnung angefordert", "Abgebrochen", "Blockiert", "Öffnen fehlgeschlagen"],
    actions: [
      "Erstellt",
      "Zugewiesen",
      "Status geändert",
      "Wieder aufgenommen",
    ],
    resolutions: ["Fehlalarm", "Behoben", "Risiko akzeptiert"],
  },
  fr: {
    states: ["Nouveau", "Confirmé", "En cours", "Résolu"],
    priorities: ["Faible", "Moyenne", "Élevée", "Critique"],
    outcomes: ["Ouverture demandée", "Annulé", "Bloqué", "Échec d’ouverture"],
    actions: ["Créé", "Attribué", "État modifié", "Rouvert"],
    resolutions: ["Faux positif", "Corrigé", "Risque accepté"],
  },
  es: {
    states: ["Nuevo", "Confirmado", "En curso", "Resuelto"],
    priorities: ["Baja", "Media", "Alta", "Crítica"],
    outcomes: ["Apertura solicitada", "Cancelado", "Bloqueado", "Error de apertura"],
    actions: ["Creado", "Asignado", "Estado modificado", "Reabierto"],
    resolutions: ["Falso positivo", "Corregido", "Riesgo aceptado"],
  },
  it: {
    states: ["Nuovo", "Confermato", "In corso", "Risolto"],
    priorities: ["Bassa", "Media", "Alta", "Critica"],
    outcomes: ["Apertura richiesta", "Annullato", "Bloccato", "Apertura fallita"],
    actions: ["Creato", "Assegnato", "Stato modificato", "Riaperto"],
    resolutions: ["Falso positivo", "Risolto", "Rischio accettato"],
  },
  pl: {
    states: ["Nowa", "Potwierdzona", "W toku", "Zamknięta"],
    priorities: ["Niski", "Średni", "Wysoki", "Krytyczny"],
    outcomes: ["Żądanie otwarcia", "Anulowano", "Zablokowano", "Błąd otwierania"],
    actions: ["Utworzono", "Przypisano", "Zmieniono stan", "Ponownie otwarto"],
    resolutions: ["Fałszywy alarm", "Naprawiono", "Zaakceptowano ryzyko"],
  },
};
const labels = Object.fromEntries(
  Object.entries(translations).map(([lang, values]) => [
    lang,
    {
      ...Object.fromEntries(fields.map((f, i) => [f, values[i]])),
      ...enums[lang],
    },
  ]),
);
const extraLabels = {
  en: [
    "Case ID",
    "Decision event ID",
    "Signed event hash",
    "Receipt hash",
    "Rule set hash",
    "Journal head hash",
    "Signer key fingerprint",
    "Provider verdict",
    "Score model",
  ],
  de: [
    "Fall-ID",
    "Entscheidungsereignis-ID",
    "Hash des signierten Ereignisses",
    "Quittungshash",
    "Regelsethash",
    "Journalstand-Hash",
    "Fingerabdruck des Signierschlüssels",
    "Providerbefund",
    "Scoremodell",
  ],
  fr: [
    "ID du dossier",
    "ID de décision",
    "Empreinte de l’événement signé",
    "Empreinte du reçu",
    "Empreinte des règles",
    "Empreinte finale du journal",
    "Empreinte de la clé de signature",
    "Verdict du fournisseur",
    "Modèle de score",
  ],
  es: [
    "ID del caso",
    "ID del evento de decisión",
    "Hash del evento firmado",
    "Hash del recibo",
    "Hash de las reglas",
    "Hash final del diario",
    "Huella de la clave de firma",
    "Veredicto del proveedor",
    "Modelo de puntuación",
  ],
  it: [
    "ID del caso",
    "ID dell’evento di decisione",
    "Hash dell’evento firmato",
    "Hash della ricevuta",
    "Hash delle regole",
    "Hash finale del registro",
    "Impronta della chiave di firma",
    "Verdetto del provider",
    "Modello di punteggio",
  ],
  pl: [
    "ID sprawy",
    "ID zdarzenia decyzji",
    "Skrót podpisanego zdarzenia",
    "Skrót potwierdzenia",
    "Skrót zestawu reguł",
    "Końcowy skrót dziennika",
    "Odcisk klucza podpisu",
    "Werdykt dostawcy",
    "Model wyniku",
  ],
};
for (const [lang, values] of Object.entries(extraLabels))
  Object.assign(
    labels[lang],
    Object.fromEntries(
      [
        "caseId",
        "decisionEventId",
        "eventEnvelopeHash",
        "receiptHash",
        "ruleSetHash",
        "journalHead",
        "fingerprint",
        "provider",
        "model",
      ].map((key, i) => [key, values[i]]),
    ),
  );
const extraUi = {
  en: ["Snapshot generated (UTC)", "Matching cases", "Page"],
  de: ["Momentaufnahme erstellt (UTC)", "Passende Fälle", "Seite"],
  fr: ["Instantané créé (UTC)", "Dossiers correspondants", "Page"],
  es: ["Instantánea creada (UTC)", "Casos coincidentes", "Página"],
  it: ["Istantanea creata (UTC)", "Casi corrispondenti", "Pagina"],
  pl: ["Zrzut utworzono (UTC)", "Pasujące sprawy", "Strona"],
};
for (const [lang, values] of Object.entries(extraUi))
  Object.assign(
    labels[lang],
    Object.fromEntries(
      ["snapshotTime", "matching", "page"].map((key, i) => [key, values[i]]),
    ),
  );
const verdictLabels = {
  en: [
    "Unknown",
    "Clean",
    "Suspicious",
    "Malicious",
    "Visually malicious",
    "Error",
    "Timeout",
    "Not checked",
  ],
  de: [
    "Unbekannt",
    "Unauffällig",
    "Verdächtig",
    "Bösartig",
    "Visuell bösartig",
    "Fehler",
    "Zeitüberschreitung",
    "Nicht geprüft",
  ],
  fr: [
    "Inconnu",
    "Sain",
    "Suspect",
    "Malveillant",
    "Visuellement malveillant",
    "Erreur",
    "Délai dépassé",
    "Non vérifié",
  ],
  es: [
    "Desconocido",
    "Limpio",
    "Sospechoso",
    "Malicioso",
    "Visualmente malicioso",
    "Error",
    "Tiempo agotado",
    "Sin comprobar",
  ],
  it: [
    "Sconosciuto",
    "Pulito",
    "Sospetto",
    "Malevolo",
    "Visivamente malevolo",
    "Errore",
    "Tempo scaduto",
    "Non verificato",
  ],
  pl: [
    "Nieznany",
    "Bez zagrożeń",
    "Podejrzany",
    "Złośliwy",
    "Wizualnie złośliwy",
    "Błąd",
    "Przekroczony czas",
    "Nie sprawdzono",
  ],
};
for (const lang of Object.keys(labels))
  labels[lang].verdicts = verdictLabels[lang];
const states = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"],
  priorities = ["low", "medium", "high", "critical"],
  outcomes = ["OPENED", "ABORTED", "BLOCKED", "OPEN_ERROR"],
  actions = ["CREATED", "ASSIGNED", "TRANSITIONED", "REOPENED"],
  resolutions = ["false_positive", "remediated", "risk_accepted"];
function project(report) {
  need(
    report?.kind === "thundy-incident-case-status" &&
      report.schemaVersion === 1 &&
      report.sealed === false &&
      (report.head === null || hex(report.head)) &&
      report.verification?.signaturesVerified === true &&
      report.verification.originalDeviceEvidenceReverified === false &&
      typeof report.verification.headPinned === "boolean" &&
      hex(report.verification.signerFingerprint) &&
      Array.isArray(report.cases) &&
      report.cases.length <= 10000,
    "CASES_REVIEW_INVALID",
  );
  let historyCount = 0;
  const seen = new Set();
  const cases = report.cases.map((c) => {
    const i = c.incident,
      a = i?.assessmentAtDecision;
    need(
      hex(c.caseId) &&
        !seen.has(c.caseId) &&
        states.includes(c.status) &&
        priorities.includes(i?.severity) &&
        outcomes.includes(i.outcome) &&
        i.urlMode === "domain_only" &&
        redactUrl(i.urlRedacted).urlRedacted === i.urlRedacted &&
        a &&
        (a.localScore === null ||
          (Number.isInteger(a.localScore) &&
            a.localScore >= 0 &&
            a.localScore <= 100)) &&
        Array.isArray(c.history) &&
        c.history.length <= 10000,
      "CASES_REVIEW_INVALID",
    );
    seen.add(c.caseId);
    historyCount += c.history.length;
    need(historyCount <= 10000, "CASES_REVIEW_CAPACITY");
    return {
      caseId: c.caseId,
      status: c.status,
      severity: i.severity,
      outcome: i.outcome,
      url: i.urlRedacted,
      score: a.localScore,
      providerVerdict: a.providerVerdict,
      modelVersion: a.modelVersion,
      decisionAt: i.decisionAt,
      policyVersion: i.policyVersion,
      ruleId: i.ruleId,
      ruleSetVersion: c.ruleSet.version,
      revision: c.revision,
      assigneeId: c.assigneeId,
      resolutionCode: c.resolutionCode,
      provenance: {
        decisionEventId: i.decisionEventId,
        eventEnvelopeHash: i.eventEnvelopeHash,
        receiptHash: i.receiptHash,
        ruleSetHash: c.ruleSet.hash,
      },
      history: c.history.map((h) => ({
        index: h.index,
        at: h.at,
        actorId: h.actorId,
        action: h.action,
        status: h.status,
        revision: h.revision,
        assigneeId: h.assigneeId,
        resolutionCode: h.resolutionCode,
      })),
    };
  });
  return {
    schemaVersion: 1,
    kind: "thundy-incident-case-review-snapshot",
    generatedAt: new Date().toISOString(),
    head: report.head,
    verification: {
      signaturesVerified: true,
      headPinned: report.verification.headPinned,
      originalDeviceEvidenceReverified: false,
      signerFingerprint: report.verification.signerFingerprint,
    },
    cases,
    sealed: false,
  };
}
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function client() {
  const $ = (id) => document.getElementById(id);
  let page = 0;
  const perPage = 25;
  const names = (values, localized, value) =>
    localized[values.indexOf(value)] || L.unknown;
  const element = (tag, text) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = String(text);
    return e;
  };
  const date = (value) => {
    const time = Date.parse(value);
    return Number.isFinite(time)
      ? new Intl.DateTimeFormat(document.documentElement.lang, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(time)
      : L.unknown;
  };
  function row(dl, title, value) {
    dl.append(
      element("dt", title),
      element("dd", value === null || value === undefined ? L.unknown : value),
    );
  }
  function render() {
    const query = $("search").value.toLowerCase(),
      minimum = $("minimum").value;
    const filtered = SNAPSHOT.cases.filter(
      (c) =>
        (!query ||
          [c.url, c.ruleId, c.assigneeId || ""].some((v) =>
            v.toLowerCase().includes(query),
          )) &&
        (!$("state").value || c.status === $("state").value) &&
        (!$("priority").value || c.severity === $("priority").value) &&
        (!$("outcome").value || c.outcome === $("outcome").value) &&
        (!$("unknown").checked || c.score === null) &&
        (!minimum || (c.score !== null && c.score >= Number(minimum))),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / perPage));
    page = Math.min(page, pages - 1);
    $("results").replaceChildren();
    for (const c of filtered.slice(page * perPage, (page + 1) * perPage)) {
      const card = element("article");
      card.append(element("h2", c.url));
      const badge = element(
        "p",
        names(STATES, L.states, c.status) +
          " · " +
          names(PRIORITIES, L.priorities, c.severity),
      );
      badge.className = "badge";
      card.append(badge);
      const dl = element("dl");
      row(dl, L.outcome, names(OUTCOMES, L.outcomes, c.outcome));
      row(dl, L.score, c.score === null ? L.unknown : c.score + "/100");
      row(dl, L.provider, names(VERDICTS, L.verdicts, c.providerVerdict));
      row(dl, L.model, c.modelVersion || L.unknown);
      row(dl, L.decision, date(c.decisionAt));
      row(dl, L.policy, c.policyVersion);
      row(dl, L.rule, c.ruleId + " · v" + c.ruleSetVersion);
      row(dl, L.revision, c.revision);
      row(dl, L.assignee, c.assigneeId || L.unassigned);
      row(
        dl,
        L.resolution,
        c.resolutionCode
          ? names(RESOLUTIONS, L.resolutions, c.resolutionCode)
          : "—",
      );
      card.append(dl);
      const history = element("details");
      history.append(
        element("summary", L.history + " (" + c.history.length + ")"),
      );
      history.className = "case-history";
      const ol = element("ol"),
        historyNav = element("nav"),
        back = element("button", L.previous),
        forward = element("button", L.next),
        position = element("span");
      back.type = "button";
      forward.type = "button";
      historyNav.append(back, position, forward);
      let historyPage = 0;
      function fillHistory() {
        ol.replaceChildren();
        for (const h of c.history.slice(
          historyPage * 50,
          (historyPage + 1) * 50,
        )) {
          const li = element("li");
          li.append(element("strong", names(ACTIONS, L.actions, h.action)));
          const detail = element("dl");
          row(detail, L.time, date(h.at));
          row(detail, L.actor, h.actorId);
          row(detail, L.state, names(STATES, L.states, h.status));
          row(detail, L.revision, h.revision);
          row(detail, L.assignee, h.assigneeId || L.unassigned);
          row(
            detail,
            L.resolution,
            h.resolutionCode
              ? names(RESOLUTIONS, L.resolutions, h.resolutionCode)
              : "—",
          );
          li.append(detail);
          ol.append(li);
        }
        ol.start = historyPage * 50 + 1;
        back.disabled = historyPage === 0;
        forward.disabled = (historyPage + 1) * 50 >= c.history.length;
        position.textContent =
          L.page +
          " " +
          (historyPage + 1) +
          " / " +
          Math.max(1, Math.ceil(c.history.length / 50));
      }
      back.addEventListener("click", () => {
        historyPage--;
        fillHistory();
      });
      forward.addEventListener("click", () => {
        historyPage++;
        fillHistory();
      });
      history.addEventListener("toggle", () => {
        if (history.open) fillHistory();
      });
      history.append(ol, historyNav);
      card.append(history);
      const provenance = element("details");
      provenance.append(element("summary", L.provenance));
      const refs = element("dl");
      row(refs, L.caseId, c.caseId);
      for (const [k, v] of Object.entries(c.provenance)) row(refs, L[k], v);
      provenance.append(refs);
      card.append(provenance);
      $("results").append(card);
    }
    if (!filtered.length) $("results").append(element("p", L.none));
    $("count").textContent =
      L.matching +
      ": " +
      filtered.length +
      " / " +
      SNAPSHOT.cases.length +
      " · " +
      L.page +
      " " +
      (page + 1) +
      " / " +
      pages;
    $("previous").disabled = page === 0;
    $("next").disabled = page >= pages - 1;
  }
  for (const id of [
    "search",
    "state",
    "priority",
    "outcome",
    "minimum",
    "unknown",
  ])
    $(id).addEventListener("input", () => {
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
        new Blob([JSON.stringify(SNAPSHOT, null, 2)], {
          type: "application/json",
        }),
      ),
      a = element("a");
    a.href = url;
    a.download = "thundy-incident-cases.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}
function reviewHtml(report, lang = "en") {
  need(Object.hasOwn(labels, lang), "CASES_REVIEW_LANGUAGE_INVALID");
  const snapshot = project(report),
    l = labels[lang],
    nonce = crypto.randomBytes(18).toString("base64"),
    json = (v) =>
      JSON.stringify(v)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
  const select = (id, label, values, names) =>
    `<label>${esc(label)}<select id="${id}"><option value="">${esc(l.all)}</option>${values.map((v, i) => `<option value="${v}">${esc(names[i])}</option>`).join("")}</select></label>`;
  return decorateHTML(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'"><title>${esc(l.title)}</title><style nonce="${nonce}">:root{color-scheme:light dark;font:16px/1.55 system-ui,sans-serif}body{margin:0;background:var(--bg-color);color:var(--text-color)}main{max-width:1120px;padding:clamp(16px,4vw,40px);margin:auto}header,article,.filters,footer{background:var(--card-bg);border:1px solid var(--card-border);border-radius:16px;padding:20px;margin:16px 0}h1{font-size:clamp(24px,4vw,36px)}h2{font-size:21px;overflow-wrap:anywhere}.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}label{display:flex;flex-direction:column;gap:6px}input,select,button{font:inherit;padding:10px;border-radius:8px;border:1px solid var(--card-border);min-width:0}button{cursor:pointer;background:var(--btn-primary-bg);color:var(--btn-primary-text)}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:3px solid var(--link-color);outline-offset:3px}dl{display:grid;grid-template-columns:minmax(100px,1fr) minmax(0,2fr);gap:8px 16px}dt{font-weight:650}dd{margin:0;overflow-wrap:anywhere}.badge{display:inline-block;padding:5px 10px;border-radius:7px;background:var(--input-bg)}details{border-top:1px solid var(--card-border);padding:12px 0}summary{cursor:pointer;font-weight:650}nav{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.check{flex-direction:row;align-items:center}li{padding:10px 0}footer{font-size:14px}.warn{background:var(--warning-bg);color:var(--color-warning);padding:12px;border-radius:8px}code{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:var(--bg-color);color:var(--text-color)}header,article,.filters,footer{background:var(--card-bg);border-color:var(--card-border)}.badge{background:var(--input-bg)}}@media(max-width:600px){dl{display:block}dt{margin-top:12px}.filters{grid-template-columns:minmax(0,1fr)}article{padding:16px}ol{padding-left:20px}}@media print{.filters,nav,button{display:none}article{break-inside:avoid}}</style></head><body><main><header><h1>${esc(l.title)}</h1><p>${esc(l.intro)}</p><p>${esc(l.snapshotTime)}: ${esc(snapshot.generatedAt)}</p><p class="warn">${esc(snapshot.verification.headPinned ? l.pinned : l.unpinned)}</p><p>${esc(l.limits)}</p><details><summary>${esc(l.proof)}</summary><dl><dt>${esc(l.journalHead)}</dt><dd><code>${esc(snapshot.head || "—")}</code></dd><dt>${esc(l.fingerprint)}</dt><dd><code>${esc(snapshot.verification.signerFingerprint)}</code></dd></dl></details><button id="download" type="button">${esc(l.download)}</button></header><section class="filters" aria-label="${esc(l.search)}"><label>${esc(l.search)}<input id="search" type="search"></label>${select("state", l.state, states, l.states)}${select("priority", l.priority, priorities, l.priorities)}${select("outcome", l.outcome, outcomes, l.outcomes)}<label>${esc(l.minimum)}<input id="minimum" type="number" min="0" max="100"></label><label class="check"><input id="unknown" type="checkbox">${esc(l.unknownOnly)}</label></section><nav aria-label="${esc(l.state)}"><button id="previous" type="button">${esc(l.previous)}</button><span id="count" role="status" aria-live="polite"></span><button id="next" type="button">${esc(l.next)}</button></nav><section id="results"></section><footer>${esc(l.footer)}</footer></main><script nonce="${nonce}">const SNAPSHOT=${json(snapshot)},L=${json(l)},STATES=${json(states)},PRIORITIES=${json(priorities)},OUTCOMES=${json(outcomes)},ACTIONS=${json(actions)},RESOLUTIONS=${json(resolutions)},VERDICTS=${json(["UNKNOWN", "CLEAN", "SUSPICIOUS", "MALICIOUS", "MALICIOUS_VISUAL", "ERROR", "TIMEOUT", "NOT_CHECKED"])};(${client.toString()})();</script></body></html>`, lang);
}
module.exports = { reviewHtml, project, labels };
