import React, { useState, useMemo, useEffect } from 'react';
import { EnterpriseCategoryKey, EnterpriseSelection, Language } from '../types';
import { t } from '../lib/i18n';
import { ENTERPRISE_BUNDLES, ENTERPRISE_CATEGORIES, buildEnterpriseDraft } from '../lib/enterpriseEngine';
import { Building, Download, Save, RotateCcw, CheckCircle2, ChevronRight, FileJson } from 'lucide-react';

const SAVED_PROFILE_KEY = 'thundy_enterpriseSelection';

interface EnterpriseViewProps {
  lang: Language;
}

export const EnterpriseView: React.FC<EnterpriseViewProps> = ({ lang }) => {
  const [savedSelection, setSavedSelection] = useState<EnterpriseSelection>(() => {
    try {
      const stored = localStorage.getItem(SAVED_PROFILE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return { ...ENTERPRISE_BUNDLES.local };
  });

  const [selection, setSelection] = useState<EnterpriseSelection>({ ...savedSelection });
  const [bundle, setBundle] = useState<string>('local');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Check which bundle matches
  useEffect(() => {
    let matched = 'custom';
    for (const [key, val] of Object.entries(ENTERPRISE_BUNDLES)) {
      if (
        val.hosting === selection.hosting &&
        val.sso === selection.sso &&
        val.devices === selection.devices &&
        val.siem === selection.siem &&
        val.tickets === selection.tickets
      ) {
        matched = key;
        break;
      }
    }
    setBundle(matched);
  }, [selection]);

  const handleBundleChange = (newBundle: string) => {
    setBundle(newBundle);
    if (newBundle !== 'custom' && ENTERPRISE_BUNDLES[newBundle]) {
      setSelection({ ...ENTERPRISE_BUNDLES[newBundle] });
    }
  };

  const handleCategoryChange = (cat: EnterpriseCategoryKey, id: string) => {
    setSelection(prev => ({ ...prev, [cat]: id }));
  };

  // Build draft
  const draft = useMemo(() => buildEnterpriseDraft(selection), [selection]);

  // Compare with saved
  const hasChanges = useMemo(() => {
    return Object.keys(selection).some(
      k => selection[k as EnterpriseCategoryKey] !== savedSelection[k as EnterpriseCategoryKey]
    );
  }, [selection, savedSelection]);

  const handleSave = () => {
    localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(selection));
    setSavedSelection({ ...selection });
    setStatusMsg(t(lang, 'profilesSaved'));
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleDiscard = () => {
    setSelection({ ...savedSelection });
  };

  const handleReset = () => {
    setSelection({ ...ENTERPRISE_BUNDLES.local });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thundy-enterprise-draft-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="enterprise-view">
      {/* Header */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <Building size={24} style={{ color: 'var(--link-color)' }} />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 750 }}>
            {t(lang, 'profilesTitle')}
          </h2>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {t(lang, 'profilesIntro')}
        </p>

        {hasChanges && (
          <span className="thundy-badge warning" style={{ marginBottom: '10px' }}>
            Unsaved changes compared to local profile
          </span>
        )}

        {statusMsg && (
          <div style={{ padding: '8px 12px', background: 'var(--success-bg)', color: 'var(--color-success)', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
            ✓ {statusMsg}
          </div>
        )}
      </div>

      {/* Profile Form */}
      <div className="thundy-card">
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
            {t(lang, 'profilesBundle')}
          </label>
          <select
            value={bundle}
            onChange={(e) => handleBundleChange(e.target.value)}
            style={{ width: '100%', maxWidth: '380px' }}
          >
            <option value="local">{t(lang, 'profilesLocal')}</option>
            <option value="microsoft">Microsoft (Azure, Entra ID, Intune, Sentinel, ServiceNow)</option>
            <option value="openSource">Open Source (Self-hosted, Keycloak, Ansible, Elastic, GitLab)</option>
            <option value="cloud">AWS / Okta / Generic MDM / Splunk / Jira Cloud</option>
            <option value="custom">Custom selection</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {(Object.keys(ENTERPRISE_CATEGORIES) as EnterpriseCategoryKey[]).map(catKey => {
            const list = ENTERPRISE_CATEGORIES[catKey];
            const catLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1);
            return (
              <div key={catKey}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  {catLabel}
                </label>
                <select
                  value={selection[catKey]}
                  onChange={(e) => handleCategoryChange(catKey, e.target.value)}
                  style={{ width: '100%' }}
                >
                  {list.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label || 'Disabled'}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Required Configuration Checklist */}
      <div className="thundy-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 750 }}>
          {t(lang, 'profilesRequirements')} ({draft.readiness.requiredSettings.length})
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Organizational settings required to validate and verify this profile.
        </p>

        {draft.readiness.requiredSettings.length === 0 ? (
          <div style={{ padding: '10px 14px', background: 'var(--success-bg)', color: 'var(--color-success)', borderRadius: '8px', fontSize: '13px' }}>
            No external service configuration parameters required for purely local operation.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
            {draft.readiness.requiredSettings.map((s, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ChevronRight size={14} style={{ color: 'var(--link-color)' }} />
                <code>{s}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration Draft JSON Preview */}
      <div className="thundy-card">
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '14px', color: 'var(--link-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileJson size={16} />
            <span>{t(lang, 'profilesPreview')} (JSON Draft)</span>
          </summary>
          <pre
            style={{
              marginTop: '12px',
              padding: '14px',
              background: 'var(--input-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '8px',
              fontSize: '12px',
              maxHeight: '350px',
              overflow: 'auto',
              fontFamily: 'monospace'
            }}
          >
            {JSON.stringify(draft, null, 2)}
          </pre>
        </details>
      </div>

      {/* Action Bar */}
      <div className="thundy-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Save size={16} />
            <span>{t(lang, 'profilesSave')}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleExport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} />
            <span>{t(lang, 'profilesExport')}</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {hasChanges && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDiscard}
            >
              {t(lang, 'profilesDiscard')}
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} />
            <span>{t(lang, 'profilesReset')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
