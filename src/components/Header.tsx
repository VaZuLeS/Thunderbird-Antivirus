import React from 'react';
import { Language, ThemeMode } from '../types';
import { t } from '../lib/i18n';
import { Shield, FileText, Settings, Building, Wand2, Sun, Moon, Laptop } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  lang: Language;
  onSelectLang: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  lang,
  onSelectLang,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="thundy-navbar" role="banner">
      <div className="thundy-brand-cluster">
        <img 
          src="/img/icon-48px.png" 
          alt="Thundy AV" 
          className="thundy-logo" 
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div>
          <h1 className="thundy-title">
            Thundy AV
            <span className="thundy-badge info" style={{ fontSize: '11px', fontWeight: 600 }}>
              v1.23.0
            </span>
          </h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t(lang, 'localByDefault')}
          </span>
        </div>
      </div>

      <nav className="thundy-nav-tabs" aria-label="Main Navigation">
        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'scanner' ? 'active' : ''}`}
          onClick={() => onSelectTab('scanner')}
        >
          <Shield size={16} />
          <span>{t(lang, 'navScanner')}</span>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'audit' ? 'active' : ''}`}
          onClick={() => onSelectTab('audit')}
        >
          <FileText size={16} />
          <span>{t(lang, 'navAudit')}</span>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
        >
          <Settings size={16} />
          <span>{t(lang, 'navSettings')}</span>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'enterprise' ? 'active' : ''}`}
          onClick={() => onSelectTab('enterprise')}
        >
          <Building size={16} />
          <span>{t(lang, 'navEnterprise')}</span>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'wizard' ? 'active' : ''}`}
          onClick={() => onSelectTab('wizard')}
        >
          <Wand2 size={16} />
          <span>{t(lang, 'navWizard')}</span>
        </button>
      </nav>

      <div className="thundy-header-actions">
        <label htmlFor="languageSelect" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>Language</label>
        <select
          id="languageSelect"
          value={lang}
          onChange={(e) => onSelectLang(e.target.value as Language)}
          style={{ minHeight: '34px', fontSize: '13px', padding: '4px 8px' }}
        >
          <option value="en">English (EN)</option>
          <option value="de">Deutsch (DE)</option>
          <option value="fr">Français (FR)</option>
          <option value="es">Español (ES)</option>
          <option value="it">Italiano (IT)</option>
          <option value="pl">Polski (PL)</option>
        </select>

        <button
          type="button"
          className="btn-secondary"
          onClick={onToggleTheme}
          style={{ minHeight: '34px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Laptop size={16} />}
        </button>
      </div>
    </header>
  );
};
