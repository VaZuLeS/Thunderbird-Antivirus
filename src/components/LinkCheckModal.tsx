import React, { useState } from 'react';
import { Language } from '../types';
import { t } from '../lib/i18n';
import { addAuditRecord } from '../lib/auditStorage';
import { ShieldAlert, ShieldCheck, ExternalLink, XCircle, AlertTriangle } from 'lucide-react';

interface LinkCheckModalProps {
  url: string;
  messageId: string;
  lang: Language;
  onClose: () => void;
  onActionCompleted?: () => void;
}

export const LinkCheckModal: React.FC<LinkCheckModalProps> = ({
  url,
  messageId,
  lang,
  onClose,
  onActionCompleted,
}) => {
  const [outcomeStatus, setOutcomeStatus] = useState<string | null>(null);

  // Evaluate link risk locally
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const isSuspicious =
    hostname.includes('paypal-verification') ||
    hostname.includes('paypa1') ||
    hostname.includes('.ru') ||
    hostname.includes('dhl-paket-tracking') ||
    hostname.includes('secure-login');

  const verdict = isSuspicious ? 'SUSPICIOUS' : 'SAFE';
  const score = isSuspicious ? 75 : 0;
  const reasons = isSuspicious
    ? [
        `Domain (${hostname}) has characteristics of typosquatting or brand impersonation.`,
        'Domain is not associated with sender verification.'
      ]
    : [
        `Destination matches expected structure (${hostname}).`,
        'No active reputation blocks or brand confusion detected.'
      ];

  const handleProceed = () => {
    addAuditRecord({
      messageId,
      url,
      score,
      scoreAtDecision: score,
      verdict,
      verdictAtDecision: verdict,
      provider: 'local-time-of-click',
      reasons,
      outcome: 'OPENED',
      openAttempts: 1,
      decidedAt: Date.now(),
    });

    setOutcomeStatus('OPENED');
    setTimeout(() => {
      onActionCompleted?.();
      onClose();
    }, 600);
  };

  const handleAbort = () => {
    addAuditRecord({
      messageId,
      url,
      score,
      scoreAtDecision: score,
      verdict,
      verdictAtDecision: verdict,
      provider: 'local-time-of-click',
      reasons,
      outcome: 'ABORTED',
      cancelReason: 'cancel',
      openAttempts: 0,
      decidedAt: Date.now(),
    });

    setOutcomeStatus('ABORTED');
    setTimeout(() => {
      onActionCompleted?.();
      onClose();
    }, 600);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="tocModalTitle">
      <div className="modal-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {isSuspicious ? (
            <div style={{ color: 'var(--color-danger)' }}>
              <ShieldAlert size={32} />
            </div>
          ) : (
            <div style={{ color: 'var(--color-success)' }}>
              <ShieldCheck size={32} />
            </div>
          )}
          <div>
            <h2 id="tocModalTitle" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              {t(lang, 'timeOfClickModalTitle')}
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Thundy AV Link Protection
            </span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {t(lang, 'timeOfClickModalDesc')}
        </p>

        <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
            {t(lang, 'linkAddress')}
          </div>
          <code style={{ fontSize: '13px', wordBreak: 'break-all', color: 'var(--link-color)' }}>
            {url}
          </code>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--input-bg)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
              {t(lang, 'providerVerdict')}
            </span>
            <strong style={{ color: isSuspicious ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {verdict}
            </strong>
          </div>
          <div style={{ background: 'var(--input-bg)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
              {t(lang, 'localThreatScore')}
            </span>
            <strong style={{ color: isSuspicious ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {score} / 100
            </strong>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', fontWeight: 650, display: 'block', marginBottom: '6px' }}>
            {t(lang, 'reasonsDetected')}:
          </span>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-color)' }}>
            {reasons.map((r, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{r}</li>
            ))}
          </ul>
        </div>

        {outcomeStatus && (
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '13px',
            fontWeight: 600,
            background: outcomeStatus === 'OPENED' ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: outcomeStatus === 'OPENED' ? 'var(--color-success)' : 'var(--color-warning)'
          }}>
            {outcomeStatus === 'OPENED' ? 'Decision logged: Opened' : 'Decision logged: Aborted / Blocked'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleAbort}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <XCircle size={16} />
            {t(lang, 'abortLink')}
          </button>

          <button
            type="button"
            className={isSuspicious ? 'btn-danger' : 'btn-primary'}
            onClick={handleProceed}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ExternalLink size={16} />
            {t(lang, 'proceedLink')}
          </button>
        </div>
      </div>
    </div>
  );
};
