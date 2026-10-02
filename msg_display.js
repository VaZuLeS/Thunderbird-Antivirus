/**
 * Thundy AV - Message-Display-Skript (Klick-Gate, Befund F-1).
 *
 * Injiziert von background.js via
 *   browser.scripting.executeScript({ target: { tabId },
 *     files: ['link_gate.js', 'msg_display.js'] })
 * (identisch zum Weg, den die Banner bereits nutzen). link_gate.js wird zuerst
 * geladen; ist die Engine aus irgendeinem Grund nicht vorhanden, arbeitet dieses
 * Skript konservativ (Warnung statt stiller Freigabe).
 *
 * Befund F-1: Links wurden ungeprueft an den Standardbrowser uebergeben. Dieses
 * Skript entzieht daher jedem http(s)-Link das href-Attribut (der Link bleibt
 * sichtbar, ist aber inert) und registriert einen Capture-Phase-Click-Handler.
 * Erst nach einem Verdikt aus dem Hintergrund (oder der lokalen Engine) wird das
 * href fuer genau diesen Link wieder gesetzt und der Klick erneut ausgeloest.
 *
 * Sicherheitsgrundsaetze:
 *  - "block" ist keine Sackgasse: nach ausdruecklicher Bestaetigung darf der
 *    Nutzer oeffnen; die Entscheidung wird mit override:true im Audit-Log
 *    vermerkt (Nachvollziehbarkeit, F-8).
 *  - Faellt der Hintergrund aus, entscheidet die lokal geladene Engine
 *    (link_gate.js); fehlt auch die, wird gewarnt statt still freigegeben.
 *  - Kein innerHTML/outerHTML/insertAdjacentHTML mit Daten aus der Nachricht oder
 *    aus dem Hintergrund - ausschliesslich createElement/textContent.
 *  - Kein top-level await; jede browser.*-Nutzung ist in try/catch gekapselt.
 *
 * Debug-/Test-Hook: window.__thundyLinkGateApi (siehe unten). Der Hook ist
 * ausschliesslich eine Test-/Debug-Oberflaeche und schwaecht das Gate NICHT: er
 * ruft dieselben Funktionen auf, die auch der Click-Handler verwendet.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__thundyLinkGateInstalled) return;
  window.__thundyLinkGateInstalled = true;

  const TOAST_ID = 'thundy-linkgate-toast';
  const DIALOG_ID = 'thundy-linkgate-dialog';
  const DIALOG_BOX_ID = 'thundy-linkgate-dialog-box';
  const REPORT_STATUS_ID = 'thundy-linkgate-report-status';
  const OPEN_BUTTON_ID = 'thundy-linkgate-open';
  const CANCEL_BUTTON_ID = 'thundy-linkgate-cancel';
  const REPORT_BUTTON_ID = 'thundy-linkgate-report';
  const OBSERVER_DELAY_MS = 100;
  const MAX_REASONS = 8;

  // Fallback-Texte (deutsch). Der Hintergrund liefert die uebersetzten Texte
  // ueber 'linkGateConfig' nach; ohne Hintergrund bleibt die Warnung lesbar.
  const FALLBACK_TEXTS = {
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
    gateReportFailed: 'Bericht konnte nicht erstellt werden (kein Administrator-Kontakt hinterlegt?).',
    gateLoading: 'Wird geladen …'
  };
})();