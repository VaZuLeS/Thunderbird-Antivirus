/**
 * Thundy AV message display script.
 *
 * Registered by background.js through the documented Manifest V3 API
 * (`browser.scripting.messageDisplay.registerScripts`). It renders every
 * in-message UI element: threat banner, sender-verified badge, per-message
 * opt-in banner (scan once / scan sender permanently) and the Time-of-Click
 * link markers.
 *
 * All state comes from the background script - the script itself never talks to
 * an analysis provider, so no data can leave the device from here.
 */

const THUNDY_FALLBACKS = {
  bannerScanOnce: 'Scan this message once',
  bannerScanSender: 'Always scan this sender',
  bannerTitleOptIn: 'Thundy AV: real-time scanning is not enabled for this message.',
  bannerNoteOptIn: 'Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you gave your consent. See the add-on options.',
  bannerScanRunning: 'Scanning…',
  bannerScanDone: 'Scan finished',
  bannerScanFailed: 'Scan failed',
  bannerPermissionDenied: 'Required host permission was denied',
  bannerConsentMissing: 'External analysis is disabled in the options – nothing was transmitted.',
  bannerThreatTitle: 'Thundy AV warning',
  bannerThreatScore: 'Risk score: $SCORE$ of 100',
  bannerAuthPass: 'Sender verified (SPF/DKIM/DMARC passed)',
  bannerOpenOptions: 'Open options',
  bannerSenderOptIn: 'This sender is now scanned automatically.',
  bannerNoApiKey: 'No Hybrid Analysis API key configured - please add it in the options.',
  bannerScanFailedWithReason: 'Scan failed: $ERROR$',
  bannerStatusRealtime: 'Local checks finished (real time): risk score $SCORE$ of 100.',
  bannerStatusExternalStarted: 'External analysis started - the result is delayed and will be fetched automatically.',
  bannerStatusRunning: 'Analysis running at the provider$DETAIL$. The result is fetched automatically.',
  bannerStatusPendingDetail: ' (checked every $MIN$ minute(s), attempt $ATTEMPT$)',
  bannerStatusFinished: 'External analysis finished (delayed): verdict $VERDICT$.',
  bannerStatusTimeout: 'No result within the time window - you can trigger the check again later.',
  bannerStatusFailed: 'Analysis failed: $ERROR$',
  bannerStatusDone: 'Analysis finished - the result is shown in the popup (Thundy AV button).',
  bannerStatusBusiness: 'Local check: score $SCORE$ of 100$TRANSMISSIONS$',
  bannerTransmissionSummary: ' | transmitted: $COUNT$ item(s) to $PROVIDERS$ (last: $TIME$)',
  bannerStatusResearch: 'Local check finished (real time), score $SCORE$ of 100. Attachments hashed: $HASHES$',
  bannerHistoryHint: 'Full history and export: add-on options, section "History".'
};

function thundyText(key, fallback, subs) {
  let text = fallback;
  try {
    const localized = browser.i18n.getMessage(key, subs);
    if (localized) text = localized;
  } catch (e) { /* use the fallback */ }
  return spinPlaceholders(text, subs);
}

function spinPlaceholders(text, subs) {
  const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
  return text.replace(/\$(SCORE|URL|JOBID|ERROR|NAME|VERDICT|DETAIL|MIN|ATTEMPT)\$/g, () => (values.length ? String(values.shift()) : ''));
}

function thundyRemove(id) {
  const node = document.getElementById(id);
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

function thundyRenderThreat(state) {
  const threat = state.threat || {};
  const score = typeof threat.score === 'number' ? threat.score : 0;

  if (score >= 50) {
    thundyRemove('thundy-auth-badge');
    let banner = document.getElementById('thundy-threat-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'thundy-threat-banner';
      document.body.prepend(banner);
    }
    banner.textContent = '';

    const title = document.createElement('div');
    title.className = 'thundy-banner-title';
    title.textContent = '🔴 ⚠️ ' + thundyText('bannerThreatTitle', THUNDY_FALLBACKS.bannerThreatTitle) +
      ' (' + thundyText('bannerThreatScore', THUNDY_FALLBACKS.bannerThreatScore, [String(score)]) + ')';
    banner.appendChild(title);

    const reasons = Array.isArray(threat.reasons) ? threat.reasons : [];
    if (reasons.length > 0) {
      const list = document.createElement('ul');
      list.className = 'thundy-banner-reasons';
      for (const reason of reasons) {
        const item = document.createElement('li');
        item.textContent = String(reason);
        list.appendChild(item);
      }
      banner.appendChild(list);
    }
    return;
  }

  thundyRemove('thundy-threat-banner');

  if (threat.authStatus === 'pass') {
    let badge = document.getElementById('thundy-auth-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'thundy-auth-badge';
      document.body.prepend(badge);
    }
    badge.textContent = '🟢 🛡️ ' + thundyText('bannerAuthPass', THUNDY_FALLBACKS.bannerAuthPass);
    return;
  }

  thundyRemove('thundy-auth-badge');
}

function thundyRenderOptIn(state, actions) {
  if (!state.showOptIn) {
    thundyRemove('thundy-optin-banner');
    return;
  }

  let banner = document.getElementById('thundy-optin-banner');
  if (banner) return;

  banner = document.createElement('div');
  banner.id = 'thundy-optin-banner';

  const title = document.createElement('span');
  title.textContent = thundyText('bannerTitleOptIn', THUNDY_FALLBACKS.bannerTitleOptIn);
  banner.appendChild(title);

  const actionsRow = document.createElement('span');
  actionsRow.className = 'thundy-banner-actions';
  banner.appendChild(actionsRow);

  const note = document.createElement('div');
  note.className = 'thundy-banner-note';
  note.textContent = state.consent
    ? thundyText('bannerNoteOptIn', THUNDY_FALLBACKS.bannerNoteOptIn)
    : thundyText('bannerConsentMissing', THUNDY_FALLBACKS.bannerConsentMissing);
  banner.appendChild(note);

  function showOptionsButton() {
    if (banner.querySelector('#thundy-open-options')) return;
    const optionsButton = document.createElement('button');
    optionsButton.id = 'thundy-open-options';
    optionsButton.type = 'button';
    optionsButton.textContent = thundyText('bannerOpenOptions', THUNDY_FALLBACKS.bannerOpenOptions);
    optionsButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    note.appendChild(optionsButton);
  }

  function createButton(label, persist) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', async () => {
      const all = actionsRow.querySelectorAll('button');
      all.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
      button.textContent = thundyText('bannerScanRunning', THUNDY_FALLBACKS.bannerScanRunning);
      try {
        const response = await actions.requestScan({ persist });
        if (response && response.success) {
          button.textContent = thundyText('bannerScanDone', THUNDY_FALLBACKS.bannerScanDone);
          button.removeAttribute('aria-busy');
          all.forEach(b => { b.disabled = false; });
          if (persist) note.textContent = thundyText('bannerSenderOptIn', THUNDY_FALLBACKS.bannerSenderOptIn);
          // Klar kommunizieren: lokal sofort, extern zeitverzoegert.
          if (response.timing === 'delayed' || response.pendingScans) {
            thundyRenderScanStatus(banner, thundyText('bannerStatusExternalStarted', THUNDY_FALLBACKS.bannerStatusExternalStarted));
            thundyWatchScanStatus(banner, { messageId: state.messageId, headerMessageId: state.headerMessageId, intervalMs: 30000 });
          } else {
            thundyRenderScanStatus(banner, thundyText('bannerStatusFinished', THUNDY_FALLBACKS.bannerStatusFinished, [(response.verdict || '-')]));
          }
        } else if (response && response.error === 'permission_required') {
          note.textContent = thundyText('bannerPermissionDenied', THUNDY_FALLBACKS.bannerPermissionDenied);
          showOptionsButton();
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
          button.textContent = label;
        } else if (response && response.error === 'EXTERNAL_ANALYSIS_DISABLED') {
          note.textContent = thundyText('bannerConsentMissing', THUNDY_FALLBACKS.bannerConsentMissing);
          showOptionsButton();
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
          button.textContent = label;
        } else if (response && response.code === 'NO_API_KEY') {
          // Haeufigste Ursache: kein API-Schluessel hinterlegt.
          note.textContent = thundyText('bannerNoApiKey', THUNDY_FALLBACKS.bannerNoApiKey);
          showOptionsButton();
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
          button.textContent = label;
        } else {
          // Die konkrete Ursache anzeigen statt eines nichtssagenden "fehlgeschlagen".
          const detail = response && response.error ? String(response.error) : '';
          const stage = response && response.stage ? ' (' + response.stage + ')' : '';
          button.textContent = thundyText('bannerScanFailed', THUNDY_FALLBACKS.bannerScanFailed);
          note.textContent = detail
            ? thundyText('bannerScanFailedWithReason', THUNDY_FALLBACKS.bannerScanFailedWithReason, [(stage + ' ' + detail).trim()])
            : thundyText('bannerScanFailed', THUNDY_FALLBACKS.bannerScanFailed);
          all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
        }
      } catch (e) {
        button.textContent = thundyText('bannerScanFailed', THUNDY_FALLBACKS.bannerScanFailed);
        all.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
      }
    });
    actionsRow.appendChild(button);
  }

  createButton(thundyText('bannerScanOnce', THUNDY_FALLBACKS.bannerScanOnce), false);
  createButton(thundyText('bannerScanSender', THUNDY_FALLBACKS.bannerScanSender), true);

  if (!state.consent) showOptionsButton();

  document.body.prepend(banner);
}

function thundyRenderTimeOfClick(state) {
  if (!state.timeOfClickProtection) return;
  const urls = Array.isArray(state.urls) ? state.urls : [];
  if (urls.length === 0) return;

  const links = document.querySelectorAll('a');
  links.forEach(link => {
    if (link.href && link.href.startsWith('http')) {
      link.title = 'Protected by Thundy Time-of-Click';
      link.classList.add('thundy-toc-link');
    }
  });
}

/**
 * Statuszeile: kommuniziert klar, was sofort (Echtzeit) geprueft wurde und was
 * erst zeitverzoegert beim Anbieter vorliegt.
 */
function thundyRenderScanStatus(container, statusText) {
  let status = container.querySelector('#thundy-scan-status');
  if (!status) {
    status = document.createElement('div');
    status.id = 'thundy-scan-status';
    status.className = 'thundy-banner-note';
    status.setAttribute('role', 'status');
    container.appendChild(status);
  }
  status.textContent = statusText;
}

function thundyDescribeJob(job, texts) {
  if (job.state === 'finished') return texts.finished(job.verdict || '?');
  if (job.state === 'timeout') return texts.timeout;
  if (job.state === 'failed') return texts.failed(job.error || '');
  return texts.running(job.attempts || 0);
}

/**
 * Beobachtet die zeitverzoegerten Auftraege der Nachricht und aktualisiert die
 * Statuszeile, bis ein Ergebnis vorliegt oder das Zeitfenster abgelaufen ist.
 */
function thundyWatchScanStatus(container, options) {
  const texts = {
    running: (attempt) => thundyText('bannerStatusRunning', THUNDY_FALLBACKS.bannerStatusRunning, [
      thundyText('bannerStatusPendingDetail', THUNDY_FALLBACKS.bannerStatusPendingDetail, [
        String(options.intervalMinutes || 1), String(attempt)
      ])
    ]),
    finished: (verdict) => thundyText('bannerStatusFinished', THUNDY_FALLBACKS.bannerStatusFinished, [verdict]),
    timeout: thundyText('bannerStatusTimeout', THUNDY_FALLBACKS.bannerStatusTimeout),
    failed: (error) => thundyText('bannerStatusFailed', THUNDY_FALLBACKS.bannerStatusFailed, [error])
  };

  let rounds = 0;
  const maxRounds = options.maxRounds || 40;

  async function tick() {
    rounds++;
    try {
      const response = await browser.runtime.sendMessage({ action: 'scanStatus', headerMessageId: options.headerMessageId, messageId: options.messageId });
      const jobs = response && Array.isArray(response.jobs) ? response.jobs : [];
      if (jobs.length === 0) {
        // Alle Auftraege sind abgeschlossen: kein Platzhalter-Verdikt anzeigen.
        thundyRenderScanStatus(container, thundyText('bannerStatusDone', THUNDY_FALLBACKS.bannerStatusDone));
        return;
      }
      thundyRenderScanStatus(container, jobs.map(job => thundyDescribeJob(job, texts)).join(' '));
      const open = jobs.some(job => job.canPollNow);
      if (open && rounds < maxRounds) {
        setTimeout(tick, options.intervalMs || 30000);
      }
    } catch (e) {
      /* Statusanzeige ist optional */
    }
  }

  thundyRenderScanStatus(container, thundyText('bannerStatusExternalStarted', THUNDY_FALLBACKS.bannerStatusExternalStarted));
  // Sofort einmal fragen, danach im Intervall weitermachen.
  tick();
}

/** Renders the complete banner state. Exposed for unit tests. */
function thundyDetailLevel(viewMode) {
  switch (viewMode) {
    case 'quiet': return 0;
    case 'research':
    case 'audit': return 2;
    case 'business': return 1;
    default: return 1;
  }
}

function thundyRenderDisplayState(state) {
  if (!state || state.mode !== 'ready' || !document.body) return;

  const viewMode = state.viewMode || 'private';
  const detail = thundyDetailLevel(viewMode);
  const threat = state.threat || {};

  // "Nur Warnungen": keinerlei Hinweisbanner, solange nichts auffaellig ist.
  if (viewMode === 'quiet' && !(typeof threat.score === 'number' && threat.score >= 50)) {
    thundyRemove('thundy-optin-banner');
    thundyRemove('thundy-threat-banner');
    return;
  }
  if (viewMode === 'quiet') {
    thundyRemove('thundy-optin-banner');
  }

  thundyRenderThreat(state);
  thundyRenderOptIn(state, {
    requestScan: ({ persist }) => browser.runtime.sendMessage({
      action: 'requestScan',
      messageId: state.messageId,
      senderEmail: state.senderEmail,
      persist
    })
  });
  thundyRenderTimeOfClick(state);

  // Immer klarstellen, was sofort geprueft wurde und was noch aussteht.
  const pending = Array.isArray(state.pendingJobs) ? state.pendingJobs : [];
  const statusContainer = document.getElementById('thundy-optin-banner') || document.body;
  if (pending.some(job => job.canPollNow)) {
    thundyWatchScanStatus(statusContainer, {
      messageId: state.messageId,
      headerMessageId: state.headerMessageId,
      intervalMs: 30000,
      intervalMinutes: state.pollIntervalMinutes || 1
    });
  } else if (state.localChecks && state.localChecks.finished) {
    const score = state.threat && typeof state.threat.score === 'number' ? state.threat.score : 0;
    const summary = (state.history && state.history.summary) || null;

    if (detail >= 2) {
      const recent = (state.history && state.history.recent) || [];
      const hashes = recent.filter(entry => entry.sha256).slice(-3)
        .map(entry => entry.sha256.slice(0, 16) + '…').join(', ') || 'keine';
      thundyRenderScanStatus(statusContainer, thundyText('bannerStatusResearch', THUNDY_FALLBACKS.bannerStatusResearch, [String(score), hashes]));
      if (viewMode === 'audit') {
        const status = statusContainer.querySelector('#thundy-scan-status');
        if (status) status.title = thundyText('bannerHistoryHint', THUNDY_FALLBACKS.bannerHistoryHint);
      }
    } else if (summary && summary.transmissions > 0) {
      const providers = Object.keys(summary.providers).join(', ');
      const time = summary.lastTransmissionAt ? new Date(summary.lastTransmissionAt).toLocaleTimeString() : '-';
      thundyRenderScanStatus(statusContainer, thundyText('bannerStatusBusiness', THUNDY_FALLBACKS.bannerStatusBusiness, [
        String(score),
        thundyText('bannerTransmissionSummary', THUNDY_FALLBACKS.bannerTransmissionSummary, [String(summary.transmissions), providers, time])
      ]));
    } else {
      thundyRenderScanStatus(statusContainer, thundyText('bannerStatusRealtime', THUNDY_FALLBACKS.bannerStatusRealtime, [String(score)]));
    }
  }
}

(async function thundyBannerMain() {
  let attempts = 0;
  const maxAttempts = 8;

  async function refresh() {
    try {
      const state = await browser.runtime.sendMessage({ action: 'getDisplayState' });
      if (state && state.mode === 'ready') {
        thundyRenderDisplayState(state);
        return;
      }
      if (attempts++ < maxAttempts) {
        setTimeout(refresh, 400);
      }
    } catch (e) {
      /* background not reachable yet - the next message display will retry */
    }
  }

  try {
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'updateDisplayState') {
        attempts = maxAttempts;
        thundyRenderDisplayState(message.state);
      }
    });
  } catch (e) { /* ignore */ }

  await refresh();
})();
