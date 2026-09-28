/**
 * Thundy AV - Link-Guard fuer die Nachrichtenansicht.
 *
 * Wird in ALLE Frames der Nachrichtenansicht injiziert (der Nachrichtentext
 * liegt in einem eigenen Frame). Aufgaben:
 *   1. Hinweis-Modus: beim Ueberfahren eines Links zeigt ein Tooltip die
 *      Zusatzinformationen (Ziel-Domain, dekodierter IDN-Host, Merkmale,
 *      Pruefstand).
 *   2. Bestaetigungs-Modus: Klicks werden abgefangen. Ein Link wird erst
 *      geoeffnet, nachdem er lokal geprueft und freigegeben wurde - inline im
 *      Tooltip oder ueber das Add-on-Popup.
 *
 * Das Script rendert nur und fragt den Hintergrund; es uebertraegt selbst nichts.
 */

const THUNDY_GUARD_FALLBACKS = {
  guardTooltipTitle: 'Thundy AV Link-Guard',
  guardCheck: 'Prüfen',
  guardOpen: 'Öffnen (nach Prüfung)',
  guardOpenPopup: 'Im Popup prüfen',
  guardChecking: 'Prüfe…',
  guardUnknown: 'Noch nicht geprüft',
  guardKnownClean: 'Bekannt und unauffällig',
  guardKnownMalicious: 'Als bösartig bekannt',
  guardBlocked: 'Durch eigene Regel blockiert',
  guardAlreadyOpen: 'Link wurde freigegeben und geöffnet.',
  guardBlockedClick: 'Klick abgefangen – bitte zuerst prüfen.',
  guardInPopupHint: 'Zum Öffnen das Add-on-Popup dieser Nachricht verwenden.',
  guardCheckFailed: 'Prüfung nicht möglich.',
  guardOpenFailed: 'Öffnen fehlgeschlagen.',
  guardCancel: 'Abbrechen',
  guardPending: 'Prüfung läuft – Ergebnis kommt zeitverzögert',
  guardPopupUnavailable: 'Das Add-on-Popup lässt sich hier nicht automatisch öffnen – bitte den Button in der Nachrichtenkopfzeile verwenden.'
};

let guardSettings = { mode: 'hint', target: 'inline' };
const guardAllowed = new Set();
let guardTooltip = null;

function guardText(key) {
  try {
    const localized = browser.i18n.getMessage(key);
    if (localized) return localized;
  } catch (e) { /* Fallback */ }
  return THUNDY_GUARD_FALLBACKS[key] || key;
}

function guardRemoveTooltip() {
  if (guardTooltip && guardTooltip.parentNode) guardTooltip.parentNode.removeChild(guardTooltip);
  guardTooltip = null;
}

async function guardEvaluate(url) {
  try {
    const response = await browser.runtime.sendMessage({ action: 'evaluateLink', url: url });
    return response && response.status === 'success' ? response.evaluation : null;
  } catch (e) {
    return null;
  }
}

function guardVerdictLabel(verdict) {
  if (verdict === 'KNOWN_CLEAN') return guardText('guardKnownClean');
  if (verdict === 'KNOWN_MALICIOUS') return guardText('guardKnownMalicious');
  if (verdict === 'BLOCKED_BY_RULE') return guardText('guardBlocked');
  return guardText('guardUnknown');
}
function guardRenderTooltip(link, evaluation) {
  guardRemoveTooltip();
  const tooltip = document.createElement('div');
  tooltip.id = 'thundy-link-tooltip';
  tooltip.setAttribute('role', 'dialog');

  const title = document.createElement('div');
  title.className = 'thundy-guard-title';
  title.textContent = guardText('guardTooltipTitle');
  tooltip.appendChild(title);

  const rows = [
    ['Ziel', evaluation ? evaluation.display : link.href],
    ['Host', evaluation ? evaluation.host : ''],
    ['Domain', evaluation ? evaluation.registrableDomain : ''],
    ['Prüfstand', guardVerdictLabel(evaluation ? evaluation.verdict : 'UNKNOWN')]
  ];
  if (evaluation && evaluation.decodedHost && evaluation.decodedHost !== evaluation.host) {
    rows.push(['Liest sich als', evaluation.decodedHost]);
  }

  for (const row of rows) {
    if (!row[1]) continue;
    const line = document.createElement('div');
    line.className = 'thundy-guard-row';
    const strong = document.createElement('strong');
    strong.textContent = row[0] + ': ';
    line.appendChild(strong);
    const span = document.createElement('span');
    span.textContent = String(row[1]);
    line.appendChild(span);
    tooltip.appendChild(line);
  }

  if (evaluation && (evaluation.flags || []).length > 0) {
    const list = document.createElement('ul');
    list.className = 'thundy-guard-flags';
    for (const flag of evaluation.flags) {
      const item = document.createElement('li');
      item.textContent = flag;
      list.appendChild(item);
    }
    tooltip.appendChild(list);
  }

  const actions = document.createElement('div');
  actions.className = 'thundy-guard-actions';

  const checkButton = document.createElement('button');
  checkButton.type = 'button';
  checkButton.className = 'thundy-guard-check';
  checkButton.textContent = guardText('guardCheck');
  actions.appendChild(checkButton);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'thundy-guard-open';
  openButton.textContent = guardText('guardOpen');
  openButton.disabled = true;
  actions.appendChild(openButton);

  const popupButton = document.createElement('button');
  popupButton.type = 'button';
  popupButton.className = 'thundy-guard-popup';
  popupButton.textContent = guardText('guardOpenPopup');
  actions.appendChild(popupButton);

  const status = document.createElement('div');
  status.className = 'thundy-guard-status';
  status.setAttribute('role', 'status');
  status.textContent = guardVerdictLabel(evaluation ? evaluation.verdict : 'UNKNOWN');
  tooltip.appendChild(actions);
  tooltip.appendChild(status);

  checkButton.addEventListener('click', async () => {
    checkButton.disabled = true;
    status.textContent = guardText('guardChecking');
    const result = await guardEvaluate(link.href);
    checkButton.disabled = false;
    if (result) {
      status.textContent = guardVerdictLabel(result.verdict) +
        ((result.flags || []).length ? ' - ' + result.flags.join('; ') : '');
      openButton.disabled = false;
    } else {
      status.textContent = guardText('guardCheckFailed');
    }
  });

  popupButton.addEventListener('click', async () => {
    try {
      await browser.runtime.sendMessage({ action: 'openLinkGuardPopup', url: link.href });
    } catch (e) { /* Popup optional */ }
    status.textContent = guardText('guardInPopupHint');
  });

  openButton.addEventListener('click', async () => {
    guardAllowed.add(link.href);
    try {
      await browser.runtime.sendMessage({
        action: 'openLinkAfterCheck',
        url: link.href,
        headerMessageId: evaluation ? evaluation.messageHeaderId : null
      });
      status.textContent = guardText('guardAlreadyOpen');
    } catch (e) {
      status.textContent = guardText('guardOpenFailed');
    }
    guardRemoveTooltip();
  });

  document.body.appendChild(tooltip);
  guardTooltip = tooltip;
  return tooltip;
}


/**
 * Overlay im Nachrichtentext: zeigt den ECHTEN Ziel-Link gross und deutlich und
 * fragt vor dem Oeffnen nach. Wird im Bestaetigungsmodus immer angezeigt - auch
 * dann, wenn zusaetzlich das Add-on-Popup geoeffnet wird (dieses kann in
 * manchen Thunderbird-Versionen nicht programmatisch geoeffnet werden).
 */
function guardShowOverlay(link, evaluation, options) {
  const opts = options || {};
  guardRemoveTooltip();

  const overlay = document.createElement('div');
  overlay.id = 'thundy-link-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const box = document.createElement('div');
  box.className = 'thundy-overlay-box';
  overlay.appendChild(box);

  const title = document.createElement('div');
  title.className = 'thundy-overlay-title';
  title.textContent = opts.reason === 'click'
    ? guardText('guardBlockedClick')
    : guardText('guardTooltipTitle');
  box.appendChild(title);

  const urlLabel = document.createElement('div');
  urlLabel.className = 'thundy-overlay-url-label';
  urlLabel.textContent = 'Ziel:';
  box.appendChild(urlLabel);

  const urlValue = document.createElement('div');
  urlValue.className = 'thundy-overlay-url';
  urlValue.textContent = (evaluation && evaluation.url) || link.href;
  box.appendChild(urlValue);

  const meta = document.createElement('div');
  meta.className = 'thundy-overlay-meta';
  const host = evaluation ? evaluation.host : null;
  const domain = evaluation ? evaluation.registrableDomain : null;
  const decoded = evaluation && evaluation.decodedHost && evaluation.decodedHost !== evaluation.host
    ? evaluation.decodedHost : null;
  meta.textContent = [host ? 'Host: ' + host : null, domain ? 'Domain: ' + domain : null,
    decoded ? 'liest sich als: ' + decoded : null].filter(Boolean).join(' | ');
  box.appendChild(meta);

  if (evaluation && (evaluation.flags || []).length > 0) {
    const flagList = document.createElement('ul');
    flagList.className = 'thundy-overlay-flags';
    for (const flag of evaluation.flags) {
      const item = document.createElement('li');
      item.textContent = flag;
      flagList.appendChild(item);
    }
    box.appendChild(flagList);
  }

  const status = document.createElement('div');
  status.className = 'thundy-overlay-status';
  status.setAttribute('role', 'status');
  status.textContent = guardVerdictLabel(evaluation ? evaluation.verdict : 'UNKNOWN') +
    (evaluation && evaluation.state === 'pending' ? ' (' + guardText('guardPending') + ')' : '');
  box.appendChild(status);

  const actions = document.createElement('div');
  actions.className = 'thundy-overlay-actions';
  box.appendChild(actions);

  const checkButton = document.createElement('button');
  checkButton.type = 'button';
  checkButton.className = 'thundy-guard-check';
  checkButton.textContent = guardText('guardCheck');
  actions.appendChild(checkButton);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'thundy-guard-open';
  openButton.textContent = guardText('guardOpen');
  openButton.disabled = true;
  actions.appendChild(openButton);

  const popupButton = document.createElement('button');
  popupButton.type = 'button';
  popupButton.className = 'thundy-guard-popup';
  popupButton.textContent = guardText('guardOpenPopup');
  actions.appendChild(popupButton);

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'thundy-guard-cancel';
  cancelButton.textContent = guardText('guardCancel');
  actions.appendChild(cancelButton);

  let currentVerdict = evaluation ? evaluation.verdict : 'UNKNOWN';

  checkButton.addEventListener('click', async () => {
    checkButton.disabled = true;
    status.textContent = guardText('guardChecking');
    const result = await guardEvaluate(link.href);
    checkButton.disabled = false;
    if (result) {
      currentVerdict = result.verdict;
      status.textContent = guardVerdictLabel(result.verdict) +
        ((result.flags || []).length ? ' - ' + result.flags.join('; ') : '');
      openButton.disabled = result.verdict === 'BLOCKED_BY_RULE';
    } else {
      status.textContent = guardText('guardCheckFailed');
    }
  });

  popupButton.addEventListener('click', async () => {
    const response = await browser.runtime.sendMessage({ action: 'openLinkGuardPopup' }).catch(() => null);
    status.textContent = response && response.status === 'success'
      ? guardText('guardInPopupHint')
      : guardText('guardPopupUnavailable');
  });

  openButton.addEventListener('click', async () => {
    if (currentVerdict === 'BLOCKED_BY_RULE') {
      status.textContent = guardText('guardBlocked');
      return;
    }
    guardAllowed.add(link.href);
    try {
      const response = await browser.runtime.sendMessage({
        action: 'openLinkAfterCheck', url: link.href,
        headerMessageId: evaluation ? evaluation.messageHeaderId : null
      });
      status.textContent = response && response.status === 'success'
        ? guardText('guardAlreadyOpen') : guardText('guardOpenFailed');
      if (response && response.status === 'success') guardRemoveOverlay();
    } catch (e) {
      status.textContent = guardText('guardOpenFailed');
    }
  });

  cancelButton.addEventListener('click', () => guardRemoveOverlay());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) guardRemoveOverlay();
  });
  document.addEventListener('keydown', function onEscape(event) {
    if (event.key === 'Escape') {
      guardRemoveOverlay();
      document.removeEventListener('keydown', onEscape, true);
    }
  }, true);

  const parent = document.body || document.documentElement;
  parent.appendChild(overlay);
  return overlay;
}

function guardRemoveOverlay() {
  const overlay = document.getElementById('thundy-link-overlay');
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

/**
 * Gemeinsame Abfanglogik fuer Klicks im Bestaetigungsmodus: verhindert das
 * Oeffnen, holt den Stand und zeigt das Overlay mit dem echten Ziel.
 */
async function guardHandleIntercept(anchor, event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  const evaluation = await guardEvaluate(anchor.href);
  guardShowOverlay(anchor, evaluation, { reason: 'click' });
  if (guardSettings.target === 'popup') {
    // Best effort: zusaetzlich das Add-on-Popup oeffnen (falls unterstuetzt).
    browser.runtime.sendMessage({ action: 'openLinkGuardPopup' }).catch(() => {});
  }
}

function guardDecorate(link) {
  if (!link || !link.href || !/^https?:/i.test(link.href)) return;
  if (link.getAttribute('data-thundy-guard') === '1') return;
  link.setAttribute('data-thundy-guard', '1');
  link.classList.add('thundy-guard-link');
  if (!link.title) link.title = link.href;

  link.addEventListener('mouseenter', async () => {
    if (guardSettings.mode === 'off') return;
    const evaluation = await guardEvaluate(link.href);
    guardRenderTooltip(link, evaluation);
  });

  link.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (guardTooltip && !guardTooltip.matches(':hover')) guardRemoveTooltip();
    }, 250);
  });

  const intercept = (event) => {
    if (guardSettings.mode !== 'confirm') return;
    if (guardAllowed.has(link.href)) return;
    // Capture-Phase: Thunderbird darf den Link nicht selbst oeffnen.
    guardHandleIntercept(link, event);
  };

  link.addEventListener('click', intercept, true);
  link.addEventListener('auxclick', intercept, true);
  link.addEventListener('mousedown', (event) => {
    if (guardSettings.mode === 'confirm' && (event.button === 1 || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
    }
  }, true);

  link.addEventListener('click', (event) => {
    if (guardSettings.mode !== 'hint') return;
    guardRenderTooltip(link, null);
  });
}

/** Faengt auch Links ab, die (noch) nicht dekoriert wurden. */
function guardInstallFallbackInterceptor() {
  document.addEventListener('click', (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || !/^https?:/i.test(anchor.href)) return;
    guardDecorate(anchor);
    if (guardSettings.mode !== 'confirm') return;
    if (guardAllowed.has(anchor.href)) return;
    guardHandleIntercept(anchor, event);
  }, true);
}

function guardDecorateAll(context) {
  const root = context || document;
  if (!root.querySelectorAll) return 0;
  let count = 0;
  root.querySelectorAll('a[href]').forEach(link => { guardDecorate(link); count++; });
  return count;
}

async function guardInit() {
  try {
    const settings = await browser.runtime.sendMessage({ action: 'getLinkGuardSettings' });
    if (settings && settings.status === 'success') {
      guardSettings = { mode: settings.mode || 'hint', target: settings.target || 'inline' };
    }
  } catch (e) { /* Standardwerte bleiben */ }

  if (guardSettings.mode === 'off') return;

  guardDecorateAll(document);
  guardInstallFallbackInterceptor();
  try {
    const observer = new MutationObserver(() => guardDecorateAll(document));
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* Beobachtung optional */ }

  try {
    browser.runtime.onMessage.addListener((message) => {
      if (message && message.action === 'updateLinkGuard') {
        guardSettings = { mode: message.mode || 'hint', target: message.target || 'inline' };
        guardRemoveTooltip();
        if (guardSettings.mode !== 'off') guardDecorateAll(document);
      }
    });
  } catch (e) { /* Listener optional */ }
}

if (typeof globalThis !== 'undefined') {
  globalThis.thundyGuardDecorate = guardDecorate;
  globalThis.thundyGuardDecorateAll = guardDecorateAll;
  globalThis.thundyGuardRenderTooltip = guardRenderTooltip;
  globalThis.thundyGuardInit = guardInit;
  globalThis.thundyGuardSettings = () => guardSettings;
  globalThis.thundyGuardAllow = (url) => guardAllowed.add(url);
  globalThis.thundyGuardShowOverlay = guardShowOverlay;
  globalThis.thundyGuardHandleIntercept = guardHandleIntercept;
  globalThis.thundyGuardRemoveOverlay = guardRemoveOverlay;
  globalThis.thundyGuardInstallFallbackInterceptor = guardInstallFallbackInterceptor;
}

guardInit();

