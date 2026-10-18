import React, { useState } from 'react';
import { AccentColor, InformationDensity, Language, PrivacyTier, SettingsState, ThemeMode } from '../types';
import { t } from '../lib/i18n';
import { 
  Palette, Shield, Lock, Globe, Users, Database, 
  Save, CheckCircle2, AlertCircle, Trash2, Keyboard, Sparkles 
} from 'lucide-react';
import { isMac } from '../lib/keyboardShortcuts';

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

          {cacheClearedMsg && (
            <span style={{ color: 'var(--color-success)', fontSize: '13px', fontWeight: 600 }}>
              ✓ {t(lang, 'cacheCleared')}
            </span>
          )}
        </div>
      </div>

      {/* 07 Power User & Keyboard Shortcuts */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={20} style={{ color: 'var(--link-color)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750 }}>
              07 Power User & Keyboard Shortcuts
            </h3>
            <span className="thundy-badge info" style={{ fontSize: '11px', fontWeight: 700 }}>
              WCAG Accessible
            </span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('keydown', { bubbles: true }));
              // Dispatch open cheatsheet
              const evt = new KeyboardEvent('keydown', { key: '?', bubbles: true });
              window.dispatchEvent(evt);
            }}
            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} style={{ color: 'var(--color-warning)' }} />
            <span>Open Shortcut Cheat Sheet (?)</span>
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
          High-velocity keyboard controls for quick attachment scans, compliance log navigation, and theme toggling without leaving your hands off the keyboard.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {/* Enable shortcuts toggle */}
          <div style={{ padding: '14px', background: 'var(--input-bg)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 650, fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={form.keyboardShortcutsEnabled ?? true}
                onChange={(e) => updateField('keyboardShortcutsEnabled', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Enable Keyboard Shortcuts System</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Enables global hotkeys (e.g. {isMac() ? '⌘+S' : 'Ctrl+S'}, {isMac() ? '⌘+A' : 'Ctrl+A'}, {isMac() ? '⌘+1..5' : 'Ctrl+1..5'}).
            </p>
          </div>

          {/* Show toast hints toggle */}
          <div style={{ padding: '14px', background: 'var(--input-bg)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 650, fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={form.showShortcutToasts ?? true}
                onChange={(e) => updateField('showShortcutToasts', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Show Floating Shortcut Confirmation Hints</span>
            </label>
            <p style={{ margin: '6px 0 0 28px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Displays an unobtrusive toast notification whenever a shortcut triggers an action.
            </p>
          </div>
        </div>

        {/* Quick cheat-sheet table */}
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
            Primary Shortcuts Overview ({isMac() ? 'macOS' : 'Windows / Linux'})
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>Trigger Scan</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>{isMac() ? '⌘S' : 'Ctrl+S'}</kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>Audit Log View</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>{isMac() ? '⌘A' : 'Ctrl+A'}</kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>Toggle Theme</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>{isMac() ? '⌘T' : 'Ctrl+T'}</kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>Cycle Sample Emails</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>J / K</kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>Upload .eml File</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>{isMac() ? '⌘U' : 'Ctrl+U'}</kbd>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '12px' }}>
              <span>All Shortcuts Modal</span>
              <kbd style={{ padding: '2px 6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--link-color)' }}>? or {isMac() ? '⌘/' : 'Ctrl+/'}</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="thundy-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', position: 'sticky', bottom: '16px', zIndex: 90, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div>
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px' }}
        >
          <Save size={16} />
          <span>{t(lang, 'saveSettings')}</span>
        </button>
      </div>
    </form>
  );
};
