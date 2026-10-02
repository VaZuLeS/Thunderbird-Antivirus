/**
 * Thundy AV - Report-Engine (Plan 1.7, Arbeitspaket A-2)
 * ------------------------------------------------------------------
 * Reine Textfunktionen ohne Seiteneffekte: kein browser.*, kein fetch,
 * keine Timer. Damit ist das Modul im Node-Test vollständig prüfbar
 * und im Message-Display-Kontext wiederverwendbar. Es greift nur auf die
 * übergebenen Daten zu und wirft niemals.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Interne Hilfsfunktionen (defensiv, werfen nie)
  // ------------------------------------------------------------------

  /** Wandelt beliebige Eingaben in ein sicheres Objekt um. */
  function asObject(value) {
    return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  }

  /** Wandelt beliebige Eingaben in ein sicheres Array um. */
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Wandelt beliebige Eingaben in einen String um (null/undefined -> ''). */
  function asString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  /** Einzeilig: entfernt Zeilenumbrüche und normalisiert Leerraum. */
  function oneLine(value) {
    return asString(value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Kürzt einen String auf max. len Zeichen (mit Auslassung). */
  function truncate(text, max) {
    const value = asString(text);
    const limit = (typeof max === 'number' && max > 3) ? max : 120;
    if (value.length <= limit) return value;
    return value.slice(0, limit - 3) + '...';
  }

  /** Kürzt einen Score auf den gültigen Bereich 0..100. */
  function clampScore(score) {
    const n = Number(score);
    if (!isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n);
  }

  /** Formatiert eine Dateigröße in Bytes. */
  function formatSize(size) {
    const n = Number(size);
    if (!isFinite(n) || n < 0) return '(nicht übermittelt)';
    if (n < 1024) return n + ' Bytes';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB (' + n + ' Bytes)';
    return (n / (1024 * 1024)).toFixed(1) + ' MiB (' + n + ' Bytes)';
  }

  /** Ermittelt den Hostnamen aus einer URL, ohne zu werfen. */
  function hostFromUrl(url) {
    const raw = asString(url).trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      return parsed.hostname || '';
    } catch (e) {
      const match = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
      if (!match) return '';
      return match[1].replace(/^[^@]*@/, '').replace(/:\d+$/, '');
    }
  }

  /** Formatiert einen booleschen Zustand als deutsches Ja/Nein. */
  function formatBool(value) {
    if (value === true) return 'ja';
    if (value === false) return 'nein';
    return '(nicht übermittelt)';
  }

  /** Bricht Text auf maximal width Zeichen pro Zeile um (Einzug bleibt erhalten). */
  function wrapLine(text, width) {
    const max = (typeof width === 'number' && width > 10) ? width : 120;
    const raw = asString(text);
    const indentMatch = raw.match(/^[ \t]*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const inner = Math.max(10, max - indent.length);
    const out = [];
    let current = '';
    const words = raw.slice(indent.length).split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      let word = words[i];
      if (word === '') continue;
      while (word.length > inner) {
        if (current !== '') { out.push(current); current = ''; }
        out.push(word.slice(0, inner));
        word = word.slice(inner);
      }
      if (current === '') {
        current = word;
      } else if (current.length + 1 + word.length <= inner) {
        current += ' ' + word;
      } else {
        out.push(current);
        current = word;
      }
    }
    if (current !== '') out.push(current);
    if (out.length === 0) return [indent];
    for (let i = 0; i < out.length; i++) out[i] = indent + out[i];
    return out;
  }

  // ------------------------------------------------------------------
  // Öffentliche API: Kontaktvalidierung und Stufen-Mapping
  // ------------------------------------------------------------------

  /** Einfache, robuste E-Mail-Prüfung (eine Adresse, kein Leerraum). */
  const EMAIL_REGEX = /^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/;

  /**
   * Zerlegt eine ';'-getrennte Liste (oder ein Array) von Administrator-
   * Adressen. Duplikate werden entfernt, Kleinschreibung erzwungen.
   * Rückgabe: { emails: string[], invalid: string[] }
   */
  function parseAdminEmails(raw) {
    const emails = [];
    const invalid = [];
    const seen = {};
    let tokens = [];

    if (Array.isArray(raw)) {
      tokens = raw;
    } else if (typeof raw === 'string') {
      tokens = raw.split(';');
    } else if (raw === null || raw === undefined) {
      tokens = [];
    } else {
      tokens = [raw];
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = asString(tokens[i]).trim();
      if (token === '') continue;
      const candidate = token.toLowerCase();
      if (!EMAIL_REGEX.test(candidate)) {
        invalid.push(token);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(seen, candidate)) {
        seen[candidate] = true;
        emails.push(candidate);
      }
    }
    return { emails: emails, invalid: invalid };
  }

  /**
   * Normalisiert eine Telefonnummer. Erlaubt u. a. "+49 30 1234567",
   * "030/123456" und "(030) 123-456". Rückgabe: { phone, valid }.
   */
  function parseAdminPhone(raw) {
    if (raw === null || raw === undefined) return { phone: '', valid: false };
    const input = asString(raw).trim();
    if (input === '') return { phone: '', valid: false };
    if (!/^[0-9+\-/(). ]+$/.test(input)) return { phone: '', valid: false };

    const hasLeadingPlus = input.charAt(0) === '+';
    const digits = input.replace(/[^0-9]/g, '');
    const phone = (hasLeadingPlus ? '+' : '') + digits;
    const extraPlus = input.slice(1).indexOf('+') !== -1;
    const valid = !extraPlus && digits.length >= 5 && digits.length <= 20;
    return { phone: phone, valid: valid };
  }

  /** Stufen-Tabelle für die Report-Empfehlung. */
  const SEVERITY_TABLE = [
    { min: 80, key: 'critical', label: 'Kritisch',
      recommendation: 'Sofort eskalieren (SLA: innerhalb von 1 Stunde): Nachricht nicht öffnen, Administrator/SOC informieren, ggf. Zugangsdaten ändern.' },
    { min: 60, key: 'high', label: 'Hoch',
      recommendation: 'Dringend eskalieren (SLA: innerhalb von 4 Stunden): Nachricht nicht öffnen, Links und Anhänge nicht anklicken, Administrator/SOC informieren.' },
    { min: 40, key: 'medium', label: 'Mittel',
      recommendation: 'Zeitnah prüfen (SLA: innerhalb eines Arbeitstages): Links und Anhänge nicht öffnen, Absender über einen bekannten Kanal verifizieren.' },
    { min: 15, key: 'low', label: 'Niedrig',
      recommendation: 'Beobachten: Nachricht aufmerksam prüfen, Links und Anhänge nicht ungefragt öffnen.' },
    { min: 0, key: 'info', label: 'Unauffällig',
      recommendation: 'Keine Eskalation erforderlich. Nachricht bei Bedarf normal weiterverwenden.' }
  ];

  /** Repräsentativer Score je Stufenname (falls nur ein Level vorliegt). */
  const LEVEL_TO_SCORE = { clean: 0, info: 0, low: 20, medium: 50, high: 70, critical: 90 };

  /**
   * Ordnet einem Score 0..100 eine Stufe zu.
   * Rückgabe: { key, label, recommendation }
   */
  function severityForScore(score) {
    const value = clampScore(score);
    for (let i = 0; i < SEVERITY_TABLE.length; i++) {
      if (value >= SEVERITY_TABLE[i].min) {
        const entry = SEVERITY_TABLE[i];
        return { key: entry.key, label: entry.label, recommendation: entry.recommendation };
      }
    }
    return { key: 'info', label: 'Unauffällig', recommendation: SEVERITY_TABLE[SEVERITY_TABLE.length - 1].recommendation };
  }

  // ------------------------------------------------------------------
  // Interne Helfer für den Incident-Report
  // ------------------------------------------------------------------

  /** Ermittelt die Stufe bevorzugt aus dem Score, sonst aus dem Level. */
  function resolveSeverity(threat) {
    const t = asObject(threat);
    const rawScore = t.score;
    if (rawScore !== null && rawScore !== undefined && rawScore !== '' && isFinite(Number(rawScore))) {
      return severityForScore(rawScore);
    }
    const level = asString(t.level).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEVEL_TO_SCORE, level)) {
      return severityForScore(LEVEL_TO_SCORE[level]);
    }
    return severityForScore(0);
  }

  /** Formatiert das Ergebnis der Header-Authentifizierung. */
  function formatAuth(authStatus) {
    if (authStatus && typeof authStatus === 'object' && !Array.isArray(authStatus)) {
      const spf = asString(authStatus.spf || authStatus.SPF) || 'n/a';
      const dkim = asString(authStatus.dkim || authStatus.DKIM) || 'n/a';
      const dmarc = asString(authStatus.dmarc || authStatus.DMARC) || 'n/a';
      return 'SPF: ' + spf + ' | DKIM: ' + dkim + ' | DMARC: ' + dmarc;
    }
    const value = asString(authStatus).trim().toLowerCase();
    if (value === 'pass') return 'SPF/DKIM/DMARC: bestanden (pass)';
    if (value === 'fail') return 'SPF/DKIM/DMARC: fehlgeschlagen (fail) - Spoofing-Verdacht';
    if (value === '' || value === 'neutral' || value === 'unknown') {
      return 'SPF/DKIM/DMARC: nicht verfügbar (neutral)';
    }
    return 'SPF/DKIM/DMARC: ' + asString(authStatus);
  }

  /** Erstkontakt-Flag aus mehreren möglichen Quellen ableiten. */
  function resolveFirstContact(input, message, threat) {
    const candidates = [
      message.isFirstCommunication, message.firstContact,
      threat.isFirstCommunication, threat.firstContact,
      input.isFirstCommunication, input.firstContact
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (typeof candidates[i] === 'boolean') return candidates[i];
    }
    return undefined;
  }

  /** Reply-To-Abweichung aus Flag oder aus den Adressen ableiten. */
  function resolveReplyToMismatch(input, message, threat) {
    const flags = [
      message.replyToMismatch, threat.replyToMismatch, input.replyToMismatch
    ];
    for (let i = 0; i < flags.length; i++) {
      if (typeof flags[i] === 'boolean') return flags[i];
    }
    const replyTo = asString(message.replyTo || threat.replyTo).trim();
    const author = asString(message.author).trim();
    if (replyTo && author) return replyTo.toLowerCase() !== author.toLowerCase();
    return undefined;
  }

  /** Stellt eine URL dar - vollständig oder gekürzt (nur Host). */
  function displayUrl(url, includeUrls) {
    const raw = asString(url).trim();
    if (includeUrls) return raw || '(keine URL übermittelt)';
    const host = hostFromUrl(raw);
    if (!host) return '(URL entfernt)';
    return host + '/... (URL gekürzt)';
  }

  /** Sammelt die externen Dienste, die tatsächlich geantwortet haben. */
  function collectSources(input, links) {
    const found = [];
    const seen = {};
    const add = function (name) {
      const label = asString(name).trim();
      if (!label || label.toLowerCase() === 'none') return;
      const key = label.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(seen, key)) return;
      seen[key] = true;
      found.push(label);
    };

    const ipRep = asObject(input.ipReputation);
    add(ipRep.provider);

    for (let i = 0; i < links.length; i++) {
      const sources = asObject(links[i] && links[i].sources);
      const keys = Object.keys(sources);
      for (let k = 0; k < keys.length; k++) {
        if (sources[keys[k]]) add(keys[k]);
      }
    }
    return found;
  }

  /** Normalisiert einen Anhang auf reine Metadaten (nie Inhalte). */
  function attachmentEvidence(attachment) {
    const a = asObject(attachment);
    return {
      name: asString(a.name) || '(ohne Namen)',
      size: (a.size === null || a.size === undefined) ? null : a.size,
      contentType: asString(a.contentType) || '(unbekannt)',
      hash: asString(a.hash) || '(nicht berechnet)',
      verdict: asString(a.verdict) || '(kein Verdikt)'
    };
  }

  /** Normalisiert einen Link auf die öffentlichen Report-Felder. */
  function linkEvidence(link) {
    const l = asObject(link);
    return {
      url: asString(l.url),
      level: asString(l.level) || 'unbekannt',
      action: asString(l.action) || 'unbekannt',
      score: clampScore(l.score),
      reasons: asArray(l.reasons).map(asString)
    };
  }

  // ------------------------------------------------------------------
  // Öffentliche API: Incident-Report
  // ------------------------------------------------------------------

  /**
   * Erzeugt die ausführliche Erstbewertung als Plaintext-E-Mail.
   * Rückgabe: { to, subject, body, severity, evidence }
   * Wirft niemals - auch bei leerer oder fehlerhafter Eingabe.
   */
  function buildIncidentReport(input) {
    try {
      const data = asObject(input);
      const message = asObject(data.message);
      const threat = asObject(data.threat);
      const contacts = asObject(data.contacts);
      const reporter = asObject(data.reporter);
      const meta = asObject(data.meta);

      const rawLinks = asArray(data.links);
      const links = rawLinks.map(linkEvidence);
      const attachments = asArray(data.attachments).map(attachmentEvidence);

      const includeUrls = (data.includeUrls === false || meta.includeUrls === false || meta.reportIncludeUrls === false) ? false : true;

      const severity = resolveSeverity(threat);
      const score = clampScore(threat.score);
      const generatedAt = oneLine(meta.generatedAt) || '(nicht übermittelt)';
      const version = oneLine(meta.version) || '(nicht übermittelt)';

      const reporterName = oneLine(reporter.name);
      const reporterEmail = asString(reporter.email).trim();
      const reporterLine = (reporterName && reporterEmail)
        ? reporterName + ' <' + reporterEmail + '>'
        : (reporterEmail || reporterName || '(nicht übermittelt)');

      const reasons = asArray(threat.reasons).map(oneLine).filter(Boolean);
      const adminParsed = parseAdminEmails(contacts.emails);
      const adminName = oneLine(contacts.name);
      const adminOrg = oneLine(contacts.organization);
      const adminPhone = parseAdminPhone(contacts.phone);

      const lines = [];
      const push = function (text) {
        const parts = wrapLine(text, 120);
        for (let i = 0; i < parts.length; i++) lines.push(parts[i]);
      };

      // 0) Kopf: Dringlichkeit, SLA, Zeitpunkt, Version, Melder
      push('Thundy AV - Incident-Report (Erstbewertung)');
      push('============================================================');
      push('Dringlichkeit: ' + severity.label + ' (' + severity.key.toUpperCase() + ')');
      push('Empfehlung/SLA: ' + severity.recommendation);
      push('Erstellt am: ' + generatedAt);
      push('Add-on-Version: ' + version);
      push('Meldende Person: ' + reporterLine);

      // 1) Übersicht zur Nachricht
      push('');
      push('1. Übersicht zur Nachricht');
      push('------------------------------------------------------------');
      push('- Message-ID: ' + (oneLine(message.headerMessageId) || '(nicht übermittelt)'));
      push('- Betreff: ' + (oneLine(message.subject) || '(kein Betreff)'));
      push('- Absender: ' + (oneLine(message.author) || '(nicht übermittelt)'));
      push('- Empfänger: ' + (oneLine(message.recipient) || '(nicht übermittelt)'));
      push('- Datum: ' + (oneLine(message.date) || '(nicht übermittelt)'));
      push('- Erstkontakt: ' + formatBool(resolveFirstContact(data, message, threat)));
      push('- Reply-To-Abweichung: ' + formatBool(resolveReplyToMismatch(data, message, threat)));

      // 2) Risikobewertung
      push('');
      push('2. Risikobewertung');
      push('------------------------------------------------------------');
      push('- Score: ' + score + '/100');
      push('- Stufe: ' + severity.label + ' (' + severity.key + ')');
      push('- Header-Authentifizierung: ' + formatAuth(threat.authStatus));
      if (reasons.length === 0) {
        push('- Gründe: keine Gründe übermittelt.');
      } else {
        push('- Gründe:');
        for (let i = 0; i < reasons.length; i++) push('  - ' + reasons[i]);
      }

      // 3) Linkanalyse
      push('');
      push('3. Linkanalyse');
      push('------------------------------------------------------------');
      if (links.length === 0) {
        push('- Keine Links übermittelt.');
      } else {
        push('- Anzahl übermittelter Links: ' + links.length);
        for (let i = 0; i < links.length; i++) {
          const l = links[i];
          push('- Link ' + (i + 1) + ': ' + displayUrl(l.url, includeUrls));
          push('  - Stufe: ' + l.level + ' | Aktion: ' + l.action + ' | Score: ' + l.score + '/100');
          if (l.reasons.length === 0) {
            push('  - Gründe: keine übermittelt.');
          } else {
            for (let r = 0; r < l.reasons.length; r++) push('  - Grund: ' + l.reasons[r]);
          }
        }
      }
      if (!includeUrls) {
        push('- Hinweis: Vollständige URLs sind per Einstellung ausgeblendet (reportIncludeUrls=false).');
      }

      // 4) Anhänge (nur Metadaten und Hashwerte)
      push('');
      push('4. Anhänge (nur Metadaten und Hashwerte)');
      push('------------------------------------------------------------');
      if (attachments.length === 0) {
        push('- Keine Anhänge übermittelt.');
      } else {
        for (let i = 0; i < attachments.length; i++) {
          const a = attachments[i];
          push('- Anhang ' + (i + 1) + ': ' + a.name);
          push('  - Größe: ' + formatSize(a.size));
          push('  - Inhaltstyp: ' + a.contentType);
          push('  - SHA-256: ' + a.hash);
          push('  - Verdikt: ' + a.verdict);
        }
      }
      push('- Hinweis: Es wurden keine Anhangsinhalte gelesen, gespeichert oder übertragen.');
      push('  Aufgeführt werden ausschließlich Metadaten und SHA-256-Hashwerte.');

      // 5) Quellen und Datenschutz
      push('');
      push('5. Quellen und Datenschutz');
      push('------------------------------------------------------------');
      const sources = collectSources(data, rawLinks);
      push('- Externe Dienste mit Antwort: ' + (sources.length ? sources.join(', ') : 'keine (nur lokale Analyse)'));
      push('- Datenschutzstufe: ' + (oneLine(meta.privacyTier) || '(nicht übermittelt)'));
      push('- Zustimmung externe Analyse: ' + (meta.consent === true ? 'erteilt' : (meta.consent === false ? 'nicht erteilt' : '(nicht übermittelt)')));
      push('- Gate-Modus: ' + (oneLine(meta.gateMode) || '(nicht übermittelt)'));
      push('- Nicht übertragen wurden: Anhangsinhalte, vollständige E-Mail-Header, Nachrichtentext und Zugangsdaten.');
      if (!includeUrls) push('- Link-URLs wurden gekürzt (nur Host) übermittelt.');
      push('- Übertragen wurden nur Metadaten, Link-Ziele (falls aktiviert) und Hashwerte.');

      // 6) Ansprechpartner
      push('');
      push('6. Ansprechpartner');
      push('------------------------------------------------------------');
      push('- Administrator: ' + ((adminName || adminOrg) ? (adminName + (adminOrg ? ' (' + adminOrg + ')' : '')) : 'nicht konfiguriert'));
      push('- Administrator-E-Mail: ' + (adminParsed.emails.length ? adminParsed.emails.join('; ') : 'nicht konfiguriert'));
      push('- Administrator-Telefon: ' + (adminPhone.phone || 'nicht konfiguriert'));
      push('- Rückfragen an Melder: ' + reporterLine);

      // 7) Handlungs-Checkliste
      push('');
      push('7. Was der Empfänger jetzt tun sollte');
      push('------------------------------------------------------------');
      push('- Nachricht nicht öffnen und keine Links oder Anhänge anklicken.');
      push('- Falls bereits geöffnet: keine Zugangsdaten eingeben und bereits eingegebene Passwörter umgehend ändern.');
      push('- Administrator/SOC über den Verdacht informieren (siehe Abschnitt 6).');
      push('- Nachricht für die forensische Auswertung aufbewahren und nicht löschen.');
      push('- Verdächtigen Absender blockieren bzw. an die IT melden.');
      push('- Bei Unsicherheit Rücksprache mit dem Administrator halten, bevor Aktionen ausgeführt werden.');

      // 8) Datenschutzhinweis
      push('');
      push('8. Datenschutzhinweis');
      push('------------------------------------------------------------');
      push('- Dieser Report enthält ausschließlich Metadaten und Hashwerte der Nachricht.');
      push('  Es wurden keine Anhangsinhalte und keine vollständigen Mail-Header ausgelesen oder übertragen.');
      push('- Die Weitergabe erfolgt nur an die konfigurierten Administrator-Kontakte.');
      push('- Externe Analysedienste wurden nur bei ausdrücklicher Zustimmung kontaktiert.');

      const subjectBase = oneLine(message.subject) || 'Nachricht ohne Betreff';
      const subject = truncate('[Thundy AV] ' + severity.key.toUpperCase() + ': Verdacht in E-Mail - ' + subjectBase, 120);

      // Bei deaktivierter URL-Ausgabe auch die Evidenz auf den Host reduzieren.
      const evidenceLinks = includeUrls ? links : links.map(function (l) {
        return { url: hostFromUrl(l.url), level: l.level, action: l.action, score: l.score, reasons: l.reasons };
      });

      return {
        to: adminParsed.emails.slice(),
        subject: subject,
        body: lines.join('\n'),
        severity: severity,
        evidence: {
          message: {
            headerMessageId: asString(message.headerMessageId),
            subject: asString(message.subject),
            author: asString(message.author),
            recipient: asString(message.recipient),
            date: asString(message.date)
          },
          threat: {
            score: score,
            level: oneLine(threat.level) || severity.key,
            reasons: reasons,
            authStatus: asString(threat.authStatus)
          },
          links: evidenceLinks,
          attachments: attachments,
          ipReputation: asObject(data.ipReputation),
          contacts: {
            emails: adminParsed.emails.slice(),
            phone: adminPhone.phone,
            name: adminName,
            organization: adminOrg
          },
          reporter: { email: reporterEmail, name: reporterName },
          meta: asObject(meta),
          includeUrls: includeUrls,
          generatedAt: generatedAt
        }
      };
    } catch (e) {
      const fallback = severityForScore(0);
      return {
        to: [],
        subject: '[Thundy AV] Incident-Report',
        body: 'Thundy AV - Incident-Report\nDer Report konnte nicht vollständig aufgebaut werden.',
        severity: fallback,
        evidence: {}
      };
    }
  }

  // ------------------------------------------------------------------
  // Öffentliche API: Hilfeanforderung (Vorlage aus den Einstellungen)
  // ------------------------------------------------------------------

  /**
   * Erzeugt die "Hilfeanforderung" an den Administrator.
   * Rückgabe: { to, subject, body }
   */
  function buildHelpRequest(input) {
    try {
      const data = asObject(input);
      const contacts = asObject(data.contacts);
      const reporter = asObject(data.reporter);
      const meta = asObject(data.meta);
      const message = asObject(data.message);

      const adminParsed = parseAdminEmails(contacts.emails);
      const adminName = oneLine(contacts.name);
      const adminOrg = oneLine(contacts.organization);
      const adminPhone = parseAdminPhone(contacts.phone);
      const reporterName = oneLine(reporter.name);
      const reporterEmail = asString(reporter.email).trim();
      const version = oneLine(meta.version) || '(nicht übermittelt)';
      const generatedAt = oneLine(meta.generatedAt) || '(nicht übermittelt)';

      const lines = [];
      const push = function (text) {
        const parts = wrapLine(text, 120);
        for (let i = 0; i < parts.length; i++) lines.push(parts[i]);
      };

      push('Thundy AV - Hilfeanforderung an den Administrator');
      push('============================================================');
      push('');
      push(adminName ? ('Hallo ' + adminName + ',') : 'Hallo,');
      push('');
      push('ich benötige Unterstützung bei der Bewertung einer verdächtigen E-Mail.');
      push('Bitte prüfen Sie den unten beschriebenen Fall und melden sich bei Rückfragen bei mir.');
      push('');
      push('Zweck dieser Nachricht');
      push('------------------------------------------------------------');
      push('- Klärung, ob die beschriebene E-Mail bösartig ist.');
      push('- Einordnung der im Thundy AV angezeigten Warnung.');
      push('- Empfehlung für die nächsten Schritte.');
      push('');
      push('Konfigurierte Administrator-Kontaktdaten');
      push('------------------------------------------------------------');
      push('- Ansprechpartner: ' + (adminName || 'nicht konfiguriert'));
      push('- Organisation: ' + (adminOrg || 'nicht konfiguriert'));
      push('- E-Mail: ' + (adminParsed.emails.length ? adminParsed.emails.join('; ') : 'nicht konfiguriert'));
      push('- Telefon: ' + (adminPhone.phone || 'nicht konfiguriert'));
      push('');
      push('Was ich liefern soll (Checkliste)');
      push('------------------------------------------------------------');
      push('- Betreff der verdächtigen E-Mail.');
      push('- Absenderadresse und Empfängeradresse.');
      push('- Datum und Uhrzeit des Eingangs.');
      push('- Liste der Links (falls vorhanden, ohne diese selbst zu öffnen).');
      push('- Namen der Anhänge (keine Anhänge ausführen oder weiterleiten).');
      push('- Screenshot oder Text der Warnung aus Thundy AV.');
      push('- Angabe, ob bereits ein Link oder Anhang geöffnet wurde.');
      push('- Eigene Beobachtungen (z. B. Zahlungsdruck, unerwartete Aufforderung).');
      push('');
      push('Verdächtige Nachricht (bitte hier einfügen)');
      push('------------------------------------------------------------');
      push('- Betreff: ' + oneLine(message.subject));
      push('- Absender: ' + oneLine(message.author));
      push('- Empfänger: ' + oneLine(message.recipient));
      push('- Datum: ' + oneLine(message.date));
      push('- Beschreibung/Beobachtung:');
      push('');
      push('Datenschutzhinweis');
      push('------------------------------------------------------------');
      push('- Bitte senden Sie keine Anhänge und keine vollständigen E-Mail-Header mit; Name und Hashwert genügen.');
      push('- Diese Hilfeanforderung wurde lokal durch Thundy AV erzeugt.');
      push('- Es wurden keine Daten automatisch an Dritte übertragen.');
      push('');
      push('Mit freundlichen Grüßen');
      push((reporterName || reporterEmail) ? ((reporterName || '') + (reporterEmail ? ' <' + reporterEmail + '>' : '')).trim() : '(Melder nicht angegeben)');
      push('Thundy AV ' + version + ' | ' + generatedAt);

      const subjectBase = oneLine(message.subject);
      const subject = truncate('[Thundy AV] Hilfeanforderung' + (subjectBase ? ': ' + subjectBase : ': verdächtige E-Mail prüfen'), 120);

      return { to: adminParsed.emails.slice(), subject: subject, body: lines.join('\n') };
    } catch (e) {
      return {
        to: [],
        subject: '[Thundy AV] Hilfeanforderung',
        body: 'Thundy AV - Hilfeanforderung\nDie Vorlage konnte nicht vollständig aufgebaut werden.'
      };
    }
  }

  // ------------------------------------------------------------------
  // Export: global (ThundyReport) und Node (module.exports)
  // ------------------------------------------------------------------
  const ThundyReport = {
    parseAdminEmails: parseAdminEmails,
    parseAdminPhone: parseAdminPhone,
    severityForScore: severityForScore,
    buildIncidentReport: buildIncidentReport,
    buildHelpRequest: buildHelpRequest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ThundyReport;
  if (typeof globalThis !== 'undefined') globalThis.ThundyReport = ThundyReport;
})();