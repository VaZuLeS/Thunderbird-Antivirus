import React, { useState } from 'react';
import { AccentColor, InformationDensity, Language, PrivacyTier, SettingsState, ThemeMode } from '../types';
import { t } from '../lib/i18n';
import { 
  Palette, Shield, Lock, Globe, Users, Database, 
  Save, CheckCircle2, AlertCircle, Trash2 
} from 'lucide-react';

interface SettingsViewProps {
  lang: Language;
  settings: SettingsState;
  onSaveSettings: (newSettings: SettingsState) => void;
  onOpenTab: (tab: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  settings,
  onSaveSettings,
  onOpenTab,
}) => {
  const [form, setForm] = useState<SettingsState>({ ...settings });
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cacheClearedMsg, setCacheClearedMsg] = useState(false);

  const updateField = <K extends keyof SettingsState>(field: K, value: SettingsState[K]) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      setIsDirty(true);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearCache = () => {
    localStorage.removeItem('thundy_cache');
    setCacheClearedMsg(true);
    setTimeout(() => setCacheClearedMsg(false), 3000);
  };

  return (
    <form className="settings-view" onSubmit={handleSubmit}>
      {/* Hero Header */}
      <div className="thundy-card">
        <span style={{ fontSize: '11px', letterSpacing: '1px', fontWeight: 800, color: 'var(--link-color)', textTransform: 'uppercase' }}>
          {t(lang, 'settingsEyebrow')}
        </span>
        <h2 style={{ margin: '4px 0 8px', fontSize: '24px', fontWeight: 750 }}>
          {t(lang, 'settingsTitle')}
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
          {t(lang, 'settingsSubtitle')}
        </p>
      </div>

      {/* 01 Appearance */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Palette size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            01 {t(lang, 'settingsAppearance')}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
              Theme Mode
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['system', 'light', 'dark'] as ThemeMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={form.appearance === mode ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => updateField('appearance', mode)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {mode === 'system' ? t(lang, 'themeSystem') : mode === 'light' ? t(lang, 'themeLight') : t(lang, 'themeDark')}
                </button>
              ))}
            </div>
          </div>

          {/* Accent */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
              Accent Color
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['ocean', 'violet', 'forest', 'amber'] as AccentColor[]).map(accent => (
                <button
                  key={accent}
                  type="button"
                  className={form.accent === accent ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => updateField('accent', accent)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {accent.charAt(0).toUpperCase() + accent.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
              Information Density
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['comfortable', 'compact'] as InformationDensity[]).map(density => (
                <button
                  key={density}
                  type="button"
                  className={form.density === density ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => updateField('density', density)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  {density === 'comfortable' ? t(lang, 'themeComfortable') : t(lang, 'themeCompact')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 02 Privacy */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Lock size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            02 {t(lang, 'settingsPrivacy')}
          </h3>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 650 }}>
            <input
              type="checkbox"
              checked={form.externalAnalysisConsent}
              onChange={(e) => updateField('externalAnalysisConsent', e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <span>{t(lang, 'consentLabel')}</span>
          </label>
          <p style={{ margin: '4px 0 0 28px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {t(lang, 'consentHelp')}
          </p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
            {t(lang, 'privacyTier')}
          </label>
          <select
            value={form.privacyTier}
            onChange={(e) => updateField('privacyTier', e.target.value as PrivacyTier)}
            disabled={!form.externalAnalysisConsent}
            style={{ width: '100%', maxWidth: '480px' }}
          >
            <option value="strict">{t(lang, 'tierStrict')}</option>
            <option value="balanced">{t(lang, 'tierBalanced')}</option>
            <option value="max">{t(lang, 'tierMax')}</option>
          </select>
        </div>
      </div>

      {/* 03 Protection */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Shield size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            03 {t(lang, 'settingsScanning')}
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 650 }}>
              <input
                type="checkbox"
                checked={form.timeOfClickProtection}
                onChange={(e) => updateField('timeOfClickProtection', e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>{t(lang, 'tocLabel')}</span>
            </label>
            <p style={{ margin: '4px 0 0 28px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {t(lang, 'tocHelp')}
            </p>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 650 }}>
              <input
                type="checkbox"
                checked={form.alwaysManual}
                onChange={(e) => updateField('alwaysManual', e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>{t(lang, 'alwaysManualLabel')}</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 650 }}>
              <input
                type="checkbox"
                checked={form.autoScanLinks}
                onChange={(e) => updateField('autoScanLinks', e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>{t(lang, 'autoScanLabel')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* 04 Providers */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            04 {t(lang, 'settingsProviders')}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Hybrid Analysis API Key (optional)
            </label>
            <input
              type="password"
              value={form.apikey}
              onChange={(e) => updateField('apikey', e.target.value)}
              placeholder="e.g. abcdef123456…"
              style={{ width: '100%' }}
              autoComplete="off"
              spellCheck={false}
              maxLength={255}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              URLhaus API Key (optional)
            </label>
            <input
              type="password"
              value={form.urlhausApikey}
              onChange={(e) => updateField('urlhausApikey', e.target.value)}
              placeholder="e.g. abcdef123456…"
              style={{ width: '100%' }}
              autoComplete="off"
              spellCheck={false}
              maxLength={255}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              urlscan.io API Key (optional)
            </label>
            <input
              type="password"
              value={form.urlscanApikey}
              onChange={(e) => updateField('urlscanApikey', e.target.value)}
              placeholder="e.g. abcdef123456…"
              style={{ width: '100%' }}
              autoComplete="off"
              spellCheck={false}
              maxLength={255}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              VirusTotal API Key (optional)
            </label>
            <input
              type="password"
              value={form.virustotalApikey}
              onChange={(e) => updateField('virustotalApikey', e.target.value)}
              placeholder="e.g. abcdef123456…"
              style={{ width: '100%' }}
              autoComplete="off"
              spellCheck={false}
              maxLength={255}
            />
          </div>
        </div>
      </div>

      {/* 05 Sender Rules */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            05 {t(lang, 'settingsSenders')}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Custom Allowlist (domains or emails, comma-separated)
            </label>
            <textarea
              rows={3}
              value={form.customWhitelist.join(', ')}
              onChange={(e) => updateField('customWhitelist', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g. example.com, boss@company.org"
              style={{ width: '100%' }}
              spellCheck={false}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
              Custom Blocklist (domains or emails, comma-separated)
            </label>
            <textarea
              rows={3}
              value={form.customBlacklist.join(', ')}
              onChange={(e) => updateField('customBlacklist', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder="e.g. spammer.net, phishing.xyz"
              style={{ width: '100%' }}
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* 06 Data & Tools */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Database size={20} style={{ color: 'var(--link-color)' }} />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
            06 {t(lang, 'settingsData')}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClearCache}
            aria-describedby="clear-cache-status"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={14} />
            <span>{t(lang, 'clearCacheBtn')}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenTab('audit')}
          >
            {t(lang, 'navAudit')}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenTab('enterprise')}
          >
            {t(lang, 'navEnterprise')}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenTab('wizard')}
          >
            {t(lang, 'navWizard')}
          </button>

          <span id="clear-cache-status" role="status" aria-live="polite">
            {cacheClearedMsg && (
              <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600 }}>
                ✓ {t(lang, 'cacheCleared')}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="thundy-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', position: 'sticky', bottom: '16px', zIndex: 90, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div id="save-status-container" role="status" aria-live="polite">
          {isDirty ? (
            <span style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={16} />
              {t(lang, 'unsavedChanges')}
            </span>
          ) : saveSuccess ? (
            <span style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              {t(lang, 'settingsSaved')}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Preferences are preserved on this device.
            </span>
          )}
        </div>

        <button
          type="submit"
          className="btn-primary"
          aria-describedby="save-status-container"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}
        >
          <Save size={16} />
          <span>{t(lang, 'saveSettings')}</span>
        </button>
      </div>
    </form>
  );
};
