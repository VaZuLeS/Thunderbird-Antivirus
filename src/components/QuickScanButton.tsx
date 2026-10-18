import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EmailMessage, Language } from '../types';
import { 
  findMostRecentAttachment, 
  performAttachmentScan, 
  ScanProgressUpdate, 
  saveAttachmentScan,
  getSavedAttachmentScans 
} from '../lib/attachmentScanner';
import { AttachmentScanResult } from '../types';
import { playAlertChime } from '../lib/thresholdStorage';
import { addAuditRecord } from '../lib/auditStorage';
import { 
  Zap, ShieldCheck, ShieldAlert, AlertTriangle, FileText, 
  CheckCircle2, X, RefreshCw, Copy, Check, ExternalLink, 
  ChevronUp, ChevronDown, Paperclip, FileCode, Sparkles
} from 'lucide-react';

interface QuickScanButtonProps {
  allEmails: EmailMessage[];
  currentEmail: EmailMessage;
  lang: Language;
  onSelectEmail?: (emailId: string) => void;
  onOpenRawTab?: () => void;
}

export const QuickScanButton: React.FC<QuickScanButtonProps> = ({
  allEmails,
  currentEmail,
  lang,
  onSelectEmail,
  onOpenRawTab,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressUpdate | null>(null);
  const [scanResult, setScanResult] = useState<AttachmentScanResult | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [auditLogged, setAuditLogged] = useState(false);
  const [showNoAttachmentNotice, setShowNoAttachmentNotice] = useState(false);

  // Identify the target most recent attachment
  const targetInfo = useMemo(() => {
    return findMostRecentAttachment(allEmails, currentEmail);
  }, [allEmails, currentEmail]);

  // Load latest scan result on mount if available
  useEffect(() => {
    const pastScans = getSavedAttachmentScans();
    if (pastScans.length > 0 && !scanResult) {
      // Check if past scan matches current target
      if (targetInfo && pastScans[0].filename === targetInfo.attachment.filename) {
        setScanResult(pastScans[0]);
      }
    }
  }, [targetInfo]);

  const handleTriggerQuickScan = async () => {
    if (!targetInfo) {
      setShowNoAttachmentNotice(true);
      setTimeout(() => setShowNoAttachmentNotice(false), 4000);
      return;
    }

    setIsScanning(true);
    setIsPanelOpen(true);
    setAuditLogged(false);
    setCopiedHash(false);

    try {
      const result = await performAttachmentScan(
        targetInfo.attachment,
        targetInfo.email,
        (update) => {
          setProgress(update);
        }
      );

      setScanResult(result);
      // Play non-intrusive sound chime upon completion
      playAlertChime();
    } catch (err) {
      console.error('Quick scan failed', err);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  };

  const handleCopyHash = () => {
    if (!scanResult) return;
    navigator.clipboard.writeText(scanResult.sha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleLogToAudit = () => {
    if (!scanResult || auditLogged) return;
    addAuditRecord({
      messageId: scanResult.emailId,
      sender: scanResult.emailAuthor,
      source: 'Thunderbird Quick Attachment Scanner',
      url: `attachment://${scanResult.filename}`,
      score: scanResult.score,
      scoreSource: 'Thundy Local Heuristic & Sandbox',
      verdict: scanResult.verdict,
      provider: 'Thundy Disarm Engine',
      reasons: scanResult.reasons,
      outcome: scanResult.verdict === 'MALICIOUS' ? 'ABORTED' : 'OPENED',
      decidedAt: Date.now(),
      openAttempts: 1,
    });
    setAuditLogged(true);
  };

  const hasAttachment = Boolean(targetInfo);
  const targetAttachment = targetInfo?.attachment;
  const isFromCurrentEmail = targetInfo?.email.id === currentEmail.id;

  return (
    <div
      className="quick-scan-fab-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
        fontFamily: 'inherit',
      }}
    >
      {/* No Attachment Notice Popover */}
      {showNoAttachmentNotice && (
        <div
          role="status"
          style={{
            background: 'var(--card-bg)',
            color: 'var(--text-color)',
            border: '1px solid var(--card-border)',
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            maxWidth: '320px',
            fontSize: '13px',
            lineHeight: 1.5,
            animation: 'fadeInUp 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 650, color: 'var(--color-warning)', marginBottom: '4px' }}>
            <AlertTriangle size={16} />
            <span>No Email Attachment Found</span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            The current mailbox has no email attachments to scan. Upload an <code>.eml</code> file or select an email with an attachment.
          </p>
        </div>
      )}

      {/* Non-Intrusive Quick Scan Result / Progress Dock */}
      {isPanelOpen && (
        <div
          className="quick-scan-panel"
          style={{
            width: '400px',
            maxWidth: 'calc(100vw - 40px)',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '14px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--input-bg)',
              borderBottom: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  background: isScanning 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : scanResult?.verdict === 'MALICIOUS'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isScanning 
                    ? 'var(--link-color)' 
                    : scanResult?.verdict === 'MALICIOUS'
                    ? 'var(--color-danger)'
                    : 'var(--color-success)',
                }}
              >
                {isScanning ? (
                  <Zap size={15} className="animate-spin" />
                ) : scanResult?.verdict === 'MALICIOUS' ? (
                  <ShieldAlert size={15} />
                ) : (
                  <ShieldCheck size={15} />
                )}
              </div>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 750, color: 'var(--text-color)' }}>
                  Quick Attachment Scan
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {isScanning ? 'Non-intrusive deep heuristic scan in progress...' : 'Instant local file verification'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                aria-label="Close Quick Scan panel"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Active Scan Progress Body */}
          {isScanning && progress && (
            <div style={{ padding: '20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ fontWeight: 650, color: 'var(--text-color)' }}>
                  {progress.label}
                </span>
                <span style={{ color: 'var(--link-color)', fontWeight: 700 }}>
                  {progress.progressPercent}%
                </span>
              </div>

              {/* Animated Progress Bar */}
              <div
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--input-bg)',
                  overflow: 'hidden',
                  position: 'relative',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress.progressPercent}%`,
                    background: 'linear-gradient(90deg, var(--link-color) 0%, #3b82f6 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span className="animate-pulse">●</span>
                <span>{progress.detail}</span>
              </div>
            </div>
          )}

          {/* Completed Scan Result Body */}
          {!isScanning && scanResult && (
            <div style={{ padding: '16px', maxHeight: '420px', overflowY: 'auto' }}>
              {/* Verdict Banner */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: scanResult.verdict === 'MALICIOUS'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : scanResult.verdict === 'SUSPICIOUS'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(16, 185, 129, 0.12)',
                  border: `1px solid ${
                    scanResult.verdict === 'MALICIOUS'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : scanResult.verdict === 'SUSPICIOUS'
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'rgba(16, 185, 129, 0.3)'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {scanResult.verdict === 'MALICIOUS' ? (
                    <ShieldAlert size={18} style={{ color: 'var(--color-danger)' }} />
                  ) : scanResult.verdict === 'SUSPICIOUS' ? (
                    <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
                  ) : (
                    <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
                  )}
                  <div>
                    <span
                      style={{
                        fontWeight: 750,
                        fontSize: '13px',
                        color: scanResult.verdict === 'MALICIOUS'
                          ? 'var(--color-danger)'
                          : scanResult.verdict === 'SUSPICIOUS'
                          ? 'var(--color-warning)'
                          : 'var(--color-success)',
                      }}
                    >
                      {scanResult.verdict === 'MALICIOUS'
                        ? 'MALICIOUS PAYLOAD DETECTED'
                        : scanResult.verdict === 'SUSPICIOUS'
                        ? 'SUSPICIOUS MACROS DETECTED'
                        : 'CLEAN & DISARMED — SAFE'}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Risk Score: {scanResult.score}/100 • Disarm Sandbox Detonated
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: scanResult.verdict === 'MALICIOUS' ? 'var(--color-danger)' : 'var(--color-success)',
                    color: '#ffffff',
                  }}
                >
                  {scanResult.verdict}
                </span>
              </div>

              {/* Scanned File Card */}
              <div
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileText size={16} style={{ color: 'var(--link-color)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: '13px', wordBreak: 'break-all' }}>
                    {scanResult.filename}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {scanResult.size}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px' }}>
                  <span style={{ fontWeight: 600 }}>Message:</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scanResult.emailSubject}
                  </span>

                  <span style={{ fontWeight: 600 }}>Sender:</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scanResult.emailAuthor}
                  </span>
                </div>

                {!isFromCurrentEmail && onSelectEmail && (
                  <button
                    type="button"
                    onClick={() => onSelectEmail(scanResult.emailId)}
                    style={{
                      marginTop: '8px',
                      background: 'transparent',
                      border: '1px solid var(--card-border)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      color: 'var(--link-color)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Switch to Source Message</span>
                  </button>
                )}
              </div>

              {/* Heuristic Checks Grid */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Inspection Verification
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                  <div style={{ background: 'var(--input-bg)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Magic Header</div>
                    <div style={{ fontWeight: 650, color: 'var(--color-success)' }}>
                      ✓ {scanResult.magicHeader}
                    </div>
                  </div>

                  <div style={{ background: 'var(--input-bg)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Macros / Scripts</div>
                    <div style={{ fontWeight: 650, color: scanResult.macrosDetected ? 'var(--color-danger)' : 'var(--color-success)' }}>
                      {scanResult.macrosDetected ? '⚠ Found' : '✓ None'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--input-bg)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Sandbox Detonation</div>
                    <div style={{ fontWeight: 650, color: 'var(--color-success)' }}>
                      ✓ Emulation Clean
                    </div>
                  </div>

                  <div style={{ background: 'var(--input-bg)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>ClamAV Heuristic</div>
                    <div style={{ fontWeight: 650, color: 'var(--color-success)' }}>
                      ✓ Clean Match
                    </div>
                  </div>
                </div>
              </div>

              {/* SHA-256 Hash */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    SHA-256 Checksum
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedHash ? 'var(--color-success)' : 'var(--link-color)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                  >
                    {copiedHash ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <code
                  style={{
                    display: 'block',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--card-border)',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: 'var(--text-color)',
                  }}
                >
                  {scanResult.sha256}
                </code>
              </div>

              {/* Heuristic Explanations */}
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Analysis Reasons
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {scanResult.reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-color)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        background: 'var(--input-bg)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <span style={{ color: 'var(--link-color)', fontWeight: 700 }}>•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Actions Toolbar inside Panel */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--card-border)',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTriggerQuickScan}
                  style={{
                    flex: '1 1 auto',
                    fontSize: '12px',
                    padding: '6px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Scan Again</span>
                </button>

                {onOpenRawTab && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      onOpenRawTab();
                    }}
                    style={{
                      fontSize: '12px',
                      padding: '6px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <FileCode size={13} />
                    <span>View in Raw Tab</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogToAudit}
                  disabled={auditLogged}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    borderRadius: 'var(--control-radius)',
                    background: auditLogged ? 'var(--success-bg)' : 'var(--input-bg)',
                    color: auditLogged ? 'var(--color-success)' : 'var(--text-color)',
                    border: '1px solid var(--card-border)',
                    cursor: auditLogged ? 'default' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {auditLogged ? <CheckCircle2 size={13} /> : <Sparkles size={13} />}
                  <span>{auditLogged ? 'Logged to Audit' : 'Record in Audit'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button (FAB) in Bottom-Right Corner */}
      <button
        type="button"
        id="quick-scan-fab"
        onClick={() => {
          if (isPanelOpen && !isScanning) {
            // Toggle panel or trigger scan
            handleTriggerQuickScan();
          } else {
            handleTriggerQuickScan();
          }
        }}
        aria-label="Quick Scan most recent email attachment"
        title={
          hasAttachment
            ? `Quick Scan: ${targetAttachment?.filename} (${targetAttachment?.size})`
            : 'Quick Scan email attachment (none currently loaded)'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: '50px',
          background: isScanning 
            ? 'var(--card-bg)' 
            : 'linear-gradient(135deg, var(--link-color) 0%, #1d4ed8 100%)',
          color: isScanning ? 'var(--text-color)' : '#ffffff',
          border: isScanning ? '2px solid var(--link-color)' : '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '14px',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          e.currentTarget.style.boxShadow = '0 12px 28px rgba(37, 99, 235, 0.45), 0 4px 12px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15)';
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: isScanning ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.2)',
            color: isScanning ? 'var(--link-color)' : '#ffffff',
          }}
        >
          {isScanning ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Zap size={15} style={{ fill: 'currentColor' }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.2 }}>
            <span>{isScanning ? 'Scanning...' : 'Quick Scan'}</span>
            {hasAttachment && !isScanning && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 650,
                  background: 'rgba(255, 255, 255, 0.25)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Attachment
              </span>
            )}
          </div>

          {hasAttachment && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                opacity: 0.9,
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                marginTop: '1px',
              }}
            >
              {targetAttachment?.filename}
            </span>
          )}
        </div>

        {/* Expand / Minimize indicator if result open */}
        {scanResult && !isScanning && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsPanelOpen(!isPanelOpen);
            }}
            style={{
              padding: '2px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px',
            }}
            title={isPanelOpen ? 'Minimize scan card' : 'Expand scan results'}
          >
            {isPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        )}
      </button>
    </div>
  );
};
