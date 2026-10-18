import React, { useState, useEffect, useMemo } from 'react';
import { ThreatNotificationThresholds, LinkAuditRecord, Language } from '../types';
import { 
  getNotificationThresholds, 
  saveNotificationThresholds, 
  playAlertChime, 
  requestDesktopNotificationPermission, 
  sendDesktopNotification,
  evaluateSpikeBreaches 
} from '../lib/thresholdStorage';
import { 
  Bell, BellRing, BellOff, Volume2, ShieldAlert, AlertTriangle, 
  Check, X, Sliders, Smartphone, Mail, Info, Flame, Sparkles 
} from 'lucide-react';

interface ThreatThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: LinkAuditRecord[];
  lang: Language;
  onThresholdsUpdated?: (updated: ThreatNotificationThresholds) => void;
}

export const ThreatThresholdModal: React.FC<ThreatThresholdModalProps> = ({
  isOpen,
  onClose,
  records,
  lang,
  onThresholdsUpdated,
}) => {
  const [config, setConfig] = useState<ThreatNotificationThresholds>(getNotificationThresholds);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [testedSuccess, setTestedSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getNotificationThresholds());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermissionStatus(Notification.permission);
      }
    }
  }, [isOpen]);

  // Compute live preview of breaches with current config state
  const breachStats = useMemo(() => {
    return evaluateSpikeBreaches(records, config, lang);
  }, [records, config, lang]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const perm = await requestDesktopNotificationPermission();
    setPermissionStatus(perm);
    if (perm === 'granted') {
      setConfig(prev => ({ ...prev, notifyDesktop: true }));
      sendDesktopNotification('Thundy AV – Notification Active', {
        body: 'Desktop threat alerts have been successfully activated.',
      });
    }
  };

  const handleTestAlert = () => {
    if (config.notifySound) {
      playAlertChime();
    }
    if (config.notifyDesktop && permissionStatus === 'granted') {
      sendDesktopNotification('🚨 Thundy AV: Threat Spike Alert Test', {
        body: `Threshold test: Exceeded ${config.spikeCountThreshold} threats within a 24-hour window.`,
      });
    }
    setTestedSuccess(true);
    setTimeout(() => setTestedSuccess(false), 3500);
  };

  const handleSave = () => {
    saveNotificationThresholds(config);
    if (onThresholdsUpdated) {
      onThresholdsUpdated(config);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const presetThresholds = [1, 2, 3, 5, 8, 10];

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="threshold-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="thundy-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
          background: 'var(--card-bg)',
          color: 'var(--text-color)',
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: config.enabled ? 'rgba(239, 68, 68, 0.15)' : 'var(--input-bg)',
              color: config.enabled ? 'var(--color-danger)' : 'var(--text-muted)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
            }}>
              {config.enabled ? <BellRing size={20} /> : <BellOff size={20} />}
            </div>
            <div>
              <h3 id="threshold-modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Threat Spike Notification Thresholds
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure real-time alerting when threat detections spike within a 24-hour window
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Master Alert Enable Switch */}
        <div style={{
          background: config.enabled ? 'rgba(239, 68, 68, 0.08)' : 'var(--input-bg)',
          border: `1px solid ${config.enabled ? 'var(--color-danger)' : 'var(--card-border)'}`,
          borderRadius: '8px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <strong style={{ fontSize: '13px', display: 'block', color: config.enabled ? 'var(--color-danger)' : 'var(--text-color)' }}>
              {config.enabled ? '24-Hour Threat Spike Alerting Enabled' : 'Threshold Alerting Disabled'}
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Automatically scans link events and visualizes threshold lines on the activity chart
            </span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: config.enabled ? 'var(--color-danger)' : 'var(--input-border)',
              transition: '0.2s',
              borderRadius: '24px',
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '18px',
                width: '18px',
                left: config.enabled ? '23px' : '3px',
                bottom: '3px',
                backgroundColor: 'white',
                transition: '0.2s',
                borderRadius: '50%',
              }} />
            </span>
          </label>
        </div>

        {/* Threshold Value Setting */}
        <div style={{ opacity: config.enabled ? 1 : 0.6, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, marginBottom: '6px' }}>
            Alert Threshold Limit (Threats per 24-Hour Window)
          </label>
          <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Trigger an alert and draw a reference threshold line whenever threat events equal or exceed this count in any 24h day.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={config.spikeCountThreshold}
              onChange={(e) => setConfig({ ...config, spikeCountThreshold: Number(e.target.value) })}
              style={{ flex: 1, accentColor: 'var(--color-danger)' }}
            />
            <div style={{
              minWidth: '55px',
              textAlign: 'center',
              background: 'var(--input-bg)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontWeight: 750,
              fontSize: '15px',
            }}>
              ≥ {config.spikeCountThreshold}
            </div>
          </div>

          {/* Quick preset selector buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              Quick Presets:
            </span>
            {presetThresholds.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setConfig({ ...config, spikeCountThreshold: count })}
                style={{
                  background: config.spikeCountThreshold === count ? 'var(--color-danger)' : 'var(--input-bg)',
                  color: config.spikeCountThreshold === count ? '#ffffff' : 'var(--text-color)',
                  border: `1px solid ${config.spikeCountThreshold === count ? 'var(--color-danger)' : 'var(--input-border)'}`,
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ≥ {count} {count === 1 ? 'threat' : 'threats'}/24h
              </button>
            ))}
          </div>
        </div>

        {/* Metric Evaluation Scope */}
        <div style={{ opacity: config.enabled ? 1 : 0.6, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, marginBottom: '6px' }}>
            Threat Evaluation Scope
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setConfig({ ...config, metricBasis: 'all_threats' })}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${config.metricBasis === 'all_threats' ? 'var(--link-color)' : 'var(--card-border)'}`,
                background: config.metricBasis === 'all_threats' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <strong style={{ display: 'block', fontSize: '12px', color: config.metricBasis === 'all_threats' ? 'var(--link-color)' : 'inherit' }}>
                All Threats
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Critical (≥50) + Elevated Risk (≥20)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...config, metricBasis: 'critical_only' })}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${config.metricBasis === 'critical_only' ? 'var(--color-danger)' : 'var(--card-border)'}`,
                background: config.metricBasis === 'critical_only' ? 'var(--alert-error-bg)' : 'var(--input-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <strong style={{ display: 'block', fontSize: '12px', color: config.metricBasis === 'critical_only' ? 'var(--color-danger)' : 'inherit' }}>
                Critical Only
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Score ≥ 50 or Malicious Verdict
              </span>
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...config, metricBasis: 'blocked_only' })}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${config.metricBasis === 'blocked_only' ? 'var(--color-warning)' : 'var(--card-border)'}`,
                background: config.metricBasis === 'blocked_only' ? 'var(--warning-bg)' : 'var(--input-bg)',
                color: 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <strong style={{ display: 'block', fontSize: '12px', color: config.metricBasis === 'blocked_only' ? 'var(--color-warning)' : 'inherit' }}>
                Blocked Only
              </strong>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Outcome = ABORTED
              </span>
            </button>
          </div>
        </div>

        {/* Notification Channels */}
        <div style={{ opacity: config.enabled ? 1 : 0.6, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, marginBottom: '6px' }}>
            Alert Delivery Channels
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* In-app banner */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', background: 'var(--input-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
              <input
                type="checkbox"
                checked={config.notifyInApp}
                onChange={(e) => setConfig({ ...config, notifyInApp: e.target.checked })}
              />
              <div style={{ flex: 1 }}>
                <strong>In-App Alert Banner & Visual Chart Highlights</strong>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Displays priority warning banner and plots dashed threshold line across the chart
                </span>
              </div>
            </label>

            {/* Audible tone */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', background: 'var(--input-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
              <input
                type="checkbox"
                checked={config.notifySound}
                onChange={(e) => setConfig({ ...config, notifySound: e.target.checked })}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={14} style={{ color: 'var(--link-color)' }} />
                  <strong>Audible Chime Alert</strong>
                </div>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Synthesized two-tone security chime on spike detection
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  playAlertChime();
                }}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--input-border)',
                  color: 'var(--text-color)',
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Test Tone
              </button>
            </label>

            {/* Desktop Push Notification */}
            <div style={{ background: 'var(--input-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Smartphone size={14} style={{ color: 'var(--color-danger)' }} />
                  <strong style={{ fontSize: '12px' }}>Browser Desktop Notifications</strong>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: permissionStatus === 'granted' ? 'var(--success-bg)' : 'var(--input-border)',
                    color: permissionStatus === 'granted' ? 'var(--color-success)' : 'var(--text-muted)',
                    fontWeight: 650,
                  }}>
                    {permissionStatus === 'granted' ? 'Allowed' : permissionStatus === 'denied' ? 'Blocked' : 'Needs Permission'}
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sends native OS notifications when a spike is confirmed
                </span>
              </div>

              {permissionStatus !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  style={{
                    background: 'var(--link-color)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Enable OS Alerts
                </button>
              ) : (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config.notifyDesktop}
                    onChange={(e) => setConfig({ ...config, notifyDesktop: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              )}
            </div>

            {/* SOC Recipient Simulator */}
            <div style={{ background: 'var(--input-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={14} style={{ color: 'var(--text-muted)' }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                  SOC / Admin Notification Recipient
                </span>
                <input
                  type="email"
                  value={config.emailAlertRecipient || ''}
                  onChange={(e) => setConfig({ ...config, emailAlertRecipient: e.target.value })}
                  placeholder="secops-alerts@internal.corp"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--input-border)',
                    fontSize: '12px',
                    padding: '2px 0',
                    color: 'var(--text-color)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Real-time 30-Day Simulation & Current Breach Preview */}
        <div style={{
          background: breachStats.breaches.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--input-bg)',
          border: `1px solid ${breachStats.breaches.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--card-border)'}`,
          borderRadius: '8px',
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {breachStats.breaches.length > 0 ? (
                <Flame size={16} style={{ color: 'var(--color-danger)' }} />
              ) : (
                <Check size={16} style={{ color: 'var(--color-success)' }} />
              )}
              <strong style={{ fontSize: '12px', color: breachStats.breaches.length > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {breachStats.breaches.length > 0
                  ? `Simulation Result: ${breachStats.breaches.length} 24h Window${breachStats.breaches.length > 1 ? 's' : ''} Exceed Threshold`
                  : 'Simulation Result: No Days Exceed Threshold'}
              </strong>
            </div>
            {breachStats.hasActiveRecentBreach && (
              <span style={{
                background: 'var(--color-danger)',
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
              }}>
                Active in Last 24-48h!
              </span>
            )}
          </div>

          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
            With threshold at <strong>≥{config.spikeCountThreshold} threats/24h</strong> under <strong>{config.metricBasis.replace('_', ' ')}</strong>, {breachStats.breaches.length} day(s) trigger alerts.
          </p>

          {breachStats.breaches.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {breachStats.breaches.map(b => (
                <div
                  key={b.date}
                  style={{
                    background: b.isRecent24h ? 'var(--color-danger)' : 'var(--alert-error-bg)',
                    color: b.isRecent24h ? '#ffffff' : 'var(--color-danger)',
                    border: `1px solid ${b.isRecent24h ? 'var(--color-danger)' : 'rgba(239, 68, 68, 0.4)'}`,
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{b.fullDate}</span>: <strong>{b.threatCount} threats</strong> (+{b.excess} over limit)
                  {b.isRecent24h && <span>🚨</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={handleTestAlert}
            style={{
              background: 'transparent',
              border: '1px solid var(--input-border)',
              color: 'var(--text-color)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {testedSuccess ? <Check size={14} style={{ color: 'var(--color-success)' }} /> : <Sparkles size={14} />}
            <span>{testedSuccess ? 'Alert Dispatched!' : 'Test Notification Now'}</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--input-border)',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {saveSuccess ? <Check size={14} /> : null}
              <span>{saveSuccess ? 'Saved!' : 'Save & Apply Threshold'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
