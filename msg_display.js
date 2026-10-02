/**
 * Thundy AV - Message-Display-Skript (Link-Gate).
 *
 * Injiziert von background.js via
 *   browser.scripting.executeScript({ target: { tabId },
 *     files: [link_gate.js, msg_display.js] })
 * (identisch zum Weg, den die Banner bereits nutzen).
 *
 * Befund F-1: Links wurden ungeprueft an den Standardbem Browser uebergeben.
 * Dieses Skript entzieht daher jedem Link das href-Attribut (der Link bleibt
 * sichtbar, ist aber inert) und registriert einen Capture-Phase-Click-Handler.
 * Erst nach einem Verdikt aus dem Hintergrund wird das href fuer genau diesen
 * Link wieder gesetzt und der Klick erneut ausgeloest.
 *
 * Sicherheitsgrundsaetze:
 *  - Faellt der Hintergrund aus, entscheidet die lokal geladene Engine
 *    (link_gate.js); der Nutzer sieht dann "unbekannt" statt "sicher".
 *  - "block" ist keine Sackgasse: nach ausdruecklicher Bestaetigung darf der
 *    Nutzer oeffnen; die Entscheidung wird im Audit-Log vermerkt.
 *  - Kein innerHTML mit Daten aus der Nachricht - ausschliesslich textContent.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__thundyLinkGateInstalled) return;
  const LOG_PREFIX = '[Thundy AV Link-Gate]';
  const TOAST_TIMEOUT_MS = 4000;
  const MAX_REASONS = 8;

  // Fallback-Texte (deutsch). Der Hintergrund liefert die uebersetzten Texte
  // ueber 'linkGateConfig' nach; ohne Hintergrund bleibt die Warnung lesbar.
  const TEXTS = {
    gateChecking: 'Thundy AV prüft diesen Link …',
    gateBlocked: 'Link blockiert: Die Prüfung hat ein hohes Risiko ergeben.',
    gateWarning: 'Link geprüft: auffällig – bitte Ziel und Absender prüfen.',
    gateAllowed: 'Link geprüft: keine Auffälligkeit gefunden.',
    gateUnknown: 'Link geprüft: keine externe Quelle verfügbar, Bewertung nur lokal.',
    gateOpenAnyway: 'Trotzdem öffnen',
    gateCancel: 'Abbrechen',
    gateDetails: 'Details anzeigen',
    gateReportAdmin: 'An Administrator melden',
    gateConfirmOverride: 'Sie öffnen einen als riskant bewerteten Link. Die Entscheidung wird im Thundy-AV-Audit-Log vermerkt. Fortfahren?',
    gateHost: 'Zielhost',
    gateReasonTitle: 'Gründe',
    gateReportSent: 'Bericht an den Administrator vorbereitet.',
    gateReportFailed: 'Bericht konnte nicht erstellt werden (kein Administrator-Kontakt hinterlegt?).'
  high: { color: '#8a3400', background: '#fff0e6', border: '#e8620c', icon: '🟠' },
    critical: { color: '#8a1010', background: '#ffeeee', border: '#c81e1e', icon: '🔴' },
    unknown: { color: '#333333', background: '#f2f2f2', border: '#999999', icon: '⚪' }
  };

  // Farbwelt je Stufe: identisch zu ThundyLinkGate.levelStyle(), damit Toolbar,
  // Banner und Dialog dieselbe Sprache sprechen.
  const STYLES = {
    clean: { color: '#145c14', background: '#e6ffe6', border: '#2e8b2e', icon: '🟢' },
    low: { color: '#4d6b00', background: '#f6ffe6', border: '#8ebe2d', icon: '🟢' },
    medium: { color: '#7a5200', background: '#fff6e6', border: '#f0a500', icon: '🟡' },