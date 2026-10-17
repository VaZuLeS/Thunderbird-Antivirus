import React, { useState, useEffect } from 'react';
import { Language, SettingsState } from './types';
import { Header } from './components/Header';
import { ScannerView } from './components/ScannerView';
import { AuditView } from './components/AuditView';
import { SettingsView } from './components/SettingsView';
import { EnterpriseView } from './components/EnterpriseView';
import { WizardView } from './components/WizardView';

const SETTINGS_STORAGE_KEY = 'thundy_settings';

const DEFAULT_SETTINGS: SettingsState = {
  appearance: 'system',
  accent: 'ocean',
  density: 'comfortable',
  externalAnalysisConsent: false,
  privacyTier: 'strict',
  timeOfClickProtection: true,
  alwaysManual: false,
  autoScanLinks: false,
  apikey: '',
  urlhausApikey: '',
  urlscanApikey: '',
  virustotalApikey: '',
  ipReputationProvider: 'none',
  ipReputationApiKey: '',
  scanningEnabledSenders: [],
  trustedAuthServers: [],
  customWhitelist: [],
  customBlacklist: [],
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('thundy_lang');
    if (saved && ['en', 'de', 'fr', 'es', 'it', 'pl'].includes(saved)) {
      return saved as Language;
    }
    return 'en';
  });

  const [currentTab, setCurrentTab] = useState<string>('scanner');

  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  // Apply theme attributes to document.documentElement
  useEffect(() => {
    const root = document.documentElement;

    // Theme mode
    if (settings.appearance === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', settings.appearance);
    }

    // Accent
    root.setAttribute('data-accent', settings.accent);

    // Density
    root.setAttribute('data-density', settings.density);
  }, [settings.appearance, settings.accent, settings.density]);

  const handleSaveSettings = (newSettings: SettingsState) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
  };

  const handleSelectLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('thundy_lang', newLang);
  };

  const handleToggleTheme = () => {
    const current = settings.appearance;
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    handleSaveSettings({ ...settings, appearance: next });
  };

  return (
    <div className="thundy-app">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        lang={lang}
        onSelectLang={handleSelectLang}
        theme={settings.appearance}
        onToggleTheme={handleToggleTheme}
      />

      <main className="thundy-main" id="main-content">
        {currentTab === 'scanner' && (
          <ScannerView lang={lang} settings={settings} />
        )}

        {currentTab === 'audit' && (
          <AuditView lang={lang} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            lang={lang}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onOpenTab={setCurrentTab}
          />
        )}

        {currentTab === 'enterprise' && (
          <EnterpriseView lang={lang} />
        )}

        {currentTab === 'wizard' && (
          <WizardView
            lang={lang}
            onSelectLang={handleSelectLang}
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onFinishWizard={() => setCurrentTab('scanner')}
          />
        )}
      </main>

      <footer style={{ borderTop: '1px solid var(--card-border)', padding: '20px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <p style={{ margin: '0 0 6px' }}>
          <strong>Thundy AV</strong> — Local email attachment & link scanner.
        </p>
        <p style={{ margin: 0 }}>
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer" style={{ color: 'var(--link-color)' }}>GNU GPL v3</a>
          {' · '}
          <span>Local by default — No telemetry or unconsented transmission</span>
        </p>
      </footer>
    </div>
  );
};
export default App;
