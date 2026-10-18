import React, { useState, useMemo } from 'react';
import { EmailMessage, Language, SettingsState } from '../types';
import { t } from '../lib/i18n';
import { SAMPLE_EMAILS } from '../lib/sampleEmails';
import { evaluateThreatScore } from '../lib/riskEngine';
import { disarmHTML, extractLinksFromHtml } from '../lib/sanitizer';
import { LinkCheckModal } from './LinkCheckModal';
import { QuickScanButton } from './QuickScanButton';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, ExternalLink, 
  Mail, Link as LinkIcon, CheckCircle2, XCircle, FileCode, Upload
} from 'lucide-react';

interface ScannerViewProps {
  lang: Language;
  settings: SettingsState;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ lang, settings }) => {
  const [selectedEmailId, setSelectedEmailId] = useState<string>(SAMPLE_EMAILS[0].id);
  const [customEmails, setCustomEmails] = useState<EmailMessage[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'disarmed' | 'links' | 'headers' | 'raw'>('disarmed');
  const [testingLinkUrl, setTestingLinkUrl] = useState<string | null>(null);

  const allEmails = useMemo(() => [...SAMPLE_EMAILS, ...customEmails], [customEmails]);
  const currentEmail = useMemo(() => {
    return allEmails.find(e => e.id === selectedEmailId) || allEmails[0];
  }, [allEmails, selectedEmailId]);

  // Extract all links
  const extractedLinks = useMemo(() => {
    const fromHtml = currentEmail.bodyHtml ? extractLinksFromHtml(currentEmail.bodyHtml) : [];
    const textLinks: string[] = [];
    const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
    let match;
    while ((match = urlRegex.exec(currentEmail.bodyText)) !== null) {
      if (!fromHtml.includes(match[1]) && !textLinks.includes(match[1])) {
        textLinks.push(match[1]);
      }
    }
    return [...fromHtml, ...textLinks];
  }, [currentEmail]);

  // Run real threat scoring engine
  const threatResult = useMemo(() => {
    return evaluateThreatScore(currentEmail.author, extractedLinks, {
      authHeaders: currentEmail.authHeaders,
      subject: currentEmail.subject,
      messageText: currentEmail.bodyText,
      replyTo: currentEmail.replyTo,
      customWhitelist: settings.customWhitelist,
      customBlacklist: settings.customBlacklist,
      isFirstCommunication: currentEmail.id === 'eml-3' || currentEmail.id === 'eml-5',
    });
  }, [currentEmail, extractedLinks, settings]);

  const scoreLevel = threatResult.score >= 50 ? 'high' : threatResult.score >= 20 ? 'medium' : 'low';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // Basic EML parse
      const lines = content.split(/\r?\n/);
      let subject = 'Custom Imported Message';
      let from = 'unknown@example.com';
      let date = new Date().toUTCString();
      let messageId = `<custom-${Date.now()}@imported>`;
      let inBody = false;
      const bodyLines: string[] = [];

      for (const line of lines) {
        if (!inBody) {
          if (line.toLowerCase().startsWith('subject:')) {
            subject = line.substring(8).trim();
          } else if (line.toLowerCase().startsWith('from:')) {
            from = line.substring(5).trim();
          } else if (line.toLowerCase().startsWith('date:')) {
            date = line.substring(5).trim();
          } else if (line.toLowerCase().startsWith('message-id:')) {
            messageId = line.substring(11).trim();
          } else if (line.trim() === '') {
            inBody = true;
          }
        } else {
          bodyLines.push(line);
        }
      }

      const body = bodyLines.join('\n');
      const newEml: EmailMessage = {
        id: 'imported-' + Date.now(),
        author: from,
        fromEmail: from,
        subject,
        date,
        messageId,
        authHeaders: ['spf=pass', 'dkim=neutral'],
        receivedHeaders: ['from mail.custom.eml by mx.local'],
        bodyText: body,
        bodyHtml: `<pre>${body}</pre>`,
      };

      setCustomEmails(prev => [newEml, ...prev]);
      setSelectedEmailId(newEml.id);
    };
    reader.readAsText(file);
  };

  return (
    <div className="scanner-view">
      {/* Test Email Selector bar */}
      <div className="thundy-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Mail size={18} style={{ color: 'var(--link-color)' }} />
          <span style={{ fontWeight: 650, fontSize: '13px' }}>{t(lang, 'testEmails')}:</span>
          <select
            value={selectedEmailId}
            onChange={(e) => setSelectedEmailId(e.target.value)}
            style={{ fontSize: '13px', minHeight: '36px', maxWidth: '380px' }}
          >
            {allEmails.map(eml => (
              <option key={eml.id} value={eml.id}>
                {eml.subject.length > 40 ? eml.subject.substring(0, 40) + '…' : eml.subject} ({eml.fromName || eml.fromEmail})
              </option>
            ))}
          </select>
        </div>

        <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', padding: '6px 12px' }}>
          <Upload size={15} />
          <span>{t(lang, 'uploadEml')}</span>
          <input type="file" accept=".eml,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Main Analysis Card */}
      <div className="thundy-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 300px' }}>
            <span className="thundy-badge info" style={{ marginBottom: '8px' }}>
              {t(lang, 'statusProtected')}
            </span>
            <h2 style={{ margin: '4px 0 12px', fontSize: '20px', fontWeight: 750 }}>
              {currentEmail.subject}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t(lang, 'from')}:</span>
              <span><strong>{currentEmail.author}</strong></span>

              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t(lang, 'date')}:</span>
              <span>{currentEmail.date}</span>

              {currentEmail.replyTo && (
                <>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t(lang, 'replyTo')}:</span>
                  <span style={{ color: currentEmail.replyTo !== currentEmail.fromEmail ? 'var(--color-warning)' : 'inherit' }}>
                    {currentEmail.replyTo}
                  </span>
                </>
              )}

              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t(lang, 'messageId')}:</span>
              <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentEmail.messageId}</code>
            </div>
          </div>

          {/* Threat Score Indicator */}
          <div className="risk-meter-container" style={{ margin: 0, minWidth: '220px' }}>
            <div className={`risk-circle ${scoreLevel}`}>
              {threatResult.score}
            </div>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                {t(lang, 'threatScore')}
              </span>
              <div style={{ fontSize: '15px', fontWeight: 750 }}>
                {threatResult.score >= 50
                  ? t(lang, 'scoreHigh')
                  : threatResult.score >= 20
                  ? t(lang, 'scoreMedium')
                  : t(lang, 'scoreLow')}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Scale: 0 (Safe) to 100 (Critical)
              </span>
            </div>
          </div>
        </div>

        {/* Threat Reasons / Heuristics */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--card-border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {threatResult.reasons.length > 0 ? (
              <AlertTriangle size={16} style={{ color: scoreLevel === 'high' ? 'var(--color-danger)' : 'var(--color-warning)' }} />
            ) : (
              <ShieldCheck size={16} style={{ color: 'var(--color-success)' }} />
            )}
            {t(lang, 'reasonsDetected')}
          </h3>

          {threatResult.reasons.length === 0 ? (
            <div style={{ padding: '10px 14px', background: 'var(--success-bg)', color: 'var(--color-success)', borderRadius: '8px', fontSize: '13px' }}>
              {t(lang, 'noRisksFound')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {threatResult.reasons.map((r, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: scoreLevel === 'high' ? 'var(--alert-error-bg)' : 'var(--warning-bg)',
                    color: scoreLevel === 'high' ? 'var(--color-danger)' : 'var(--color-warning)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontWeight: 700 }}>•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inspection Sub-Tabs */}
      <div className="thundy-card">
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`thundy-nav-tab ${activeSubTab === 'disarmed' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('disarmed')}
          >
            <ShieldCheck size={15} />
            <span>{t(lang, 'tabDisarmed')}</span>
          </button>

          <button
            type="button"
            className={`thundy-nav-tab ${activeSubTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('links')}
          >
            <LinkIcon size={15} />
            <span>{t(lang, 'tabLinks')} ({extractedLinks.length})</span>
          </button>

          <button
            type="button"
            className={`thundy-nav-tab ${activeSubTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('headers')}
          >
            <CheckCircle2 size={15} />
            <span>{t(lang, 'tabHeaders')}</span>
          </button>

          <button
            type="button"
            className={`thundy-nav-tab ${activeSubTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('raw')}
          >
            <FileCode size={15} />
            <span>{t(lang, 'tabRaw')}</span>
          </button>
        </div>

        {/* Tab 1: Disarmed HTML */}
        {activeSubTab === 'disarmed' && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              🛡️ {t(lang, 'disarmedNotice')}
            </p>
            <div
              style={{
                border: '1px solid var(--card-border)',
                borderRadius: '8px',
                padding: '16px',
                background: 'var(--input-bg)',
                lineHeight: 1.6
              }}
              dangerouslySetInnerHTML={{
                __html: disarmHTML(currentEmail.bodyHtml || `<p>${currentEmail.bodyText}</p>`)
              }}
            />
          </div>
        )}

        {/* Tab 2: Extracted Links */}
        {activeSubTab === 'links' && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {t(lang, 'linksNotice')}
            </p>
            {extractedLinks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No links found in this message.</p>
            ) : (
              <div className="thundy-table-container">
                <table className="thundy-table">
                  <thead>
                    <tr>
                      <th>{t(lang, 'linkAddress')}</th>
                      <th>{t(lang, 'domain')}</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedLinks.map((url, i) => {
                      let host = '';
                      try { host = new URL(url).hostname; } catch { host = 'invalid'; }
                      return (
                        <tr key={i}>
                          <td>
                            <code style={{ fontSize: '12px', color: 'var(--link-color)' }}>{url}</code>
                          </td>
                          <td>
                            <span className="thundy-badge info">{host}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => setTestingLinkUrl(url)}
                              style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <ExternalLink size={13} />
                              <span>{t(lang, 'testLinkBtn')}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Headers & Auth */}
        {activeSubTab === 'headers' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700 }}>
                Sender Authentication (SPF / DKIM / DMARC)
              </h4>
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: threatResult.authStatus === 'pass' ? 'var(--success-bg)' : threatResult.authStatus === 'fail' ? 'var(--alert-error-bg)' : 'var(--input-bg)',
                color: threatResult.authStatus === 'pass' ? 'var(--color-success)' : threatResult.authStatus === 'fail' ? 'var(--color-danger)' : 'var(--text-color)',
                fontSize: '13px',
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {threatResult.authStatus === 'pass' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <span>
                  {threatResult.authStatus === 'pass'
                    ? t(lang, 'authPassed')
                    : threatResult.authStatus === 'fail'
                    ? t(lang, 'authFailed')
                    : t(lang, 'authNeutral')}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700 }}>Authentication-Results Headers:</h4>
              <pre style={{ background: 'var(--input-bg)', padding: '10px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--card-border)', overflowX: 'auto' }}>
                {currentEmail.authHeaders.join('\n') || 'None recorded'}
              </pre>
            </div>

            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700 }}>Received IP Transport Path:</h4>
              <pre style={{ background: 'var(--input-bg)', padding: '10px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--card-border)', overflowX: 'auto' }}>
                {currentEmail.receivedHeaders.join('\n') || 'None recorded'}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 4: Raw Text & Attachments */}
        {activeSubTab === 'raw' && (
          <div>
            {currentEmail.attachments && currentEmail.attachments.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700 }}>Attachments ({currentEmail.attachments.length})</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {currentEmail.attachments.map((att, i) => (
                    <div key={i} style={{ padding: '6px 12px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>{att.filename}</strong> <span style={{ color: 'var(--text-muted)' }}>({att.size})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700 }}>Plaintext Message Body:</h4>
            <pre style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '8px', fontSize: '12px', border: '1px solid var(--card-border)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {currentEmail.bodyText}
            </pre>
          </div>
        )}
      </div>

      {/* Link Time-of-Click Modal */}
      {testingLinkUrl && (
        <LinkCheckModal
          url={testingLinkUrl}
          messageId={currentEmail.messageId}
          sender={currentEmail.fromName ? `${currentEmail.fromName} <${currentEmail.fromEmail}>` : currentEmail.author}
          lang={lang}
          onClose={() => setTestingLinkUrl(null)}
        />
      )}

      {/* Quick Scan Floating Action Button (FAB) & Non-Intrusive Result Dock */}
      <QuickScanButton
        allEmails={allEmails}
        currentEmail={currentEmail}
        lang={lang}
        onSelectEmail={(id) => setSelectedEmailId(id)}
        onOpenRawTab={() => setActiveSubTab('raw')}
      />
    </div>
  );
};
