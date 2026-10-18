import React from 'react';
import { Language, ThemeMode } from '../types';
import { t } from '../lib/i18n';
import { isMac } from '../lib/keyboardShortcuts';
import { Shield, FileText, Settings, Building, Wand2, Sun, Moon, Laptop, Keyboard } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  lang: Language;
  onSelectLang: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  lang,
  onSelectLang,
  theme,
  onToggleTheme,
  onOpenShortcuts,
}) => {
  const metaKey = isMac() ? '⌘' : 'Ctrl';

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
          title={`Message Scanner [${metaKey}+1 or ${metaKey}+S]`}
        >
          <Shield size={16} />
          <span>{t(lang, 'navScanner')}</span>
          <kbd
            style={{
              fontSize: '10px',
              opacity: currentTab === 'scanner' ? 0.9 : 0.65,
              marginLeft: '2px',
              fontFamily: 'monospace',
              padding: '1px 4px',
              borderRadius: '4px',
              background: currentTab === 'scanner' ? 'rgba(255,255,255,0.2)' : 'var(--input-bg)',
              border: currentTab === 'scanner' ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--card-border)',
            }}
          >
            {metaKey}+1
          </kbd>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'audit' ? 'active' : ''}`}
          onClick={() => onSelectTab('audit')}
          title={`Link Decision Log [${metaKey}+A or ${metaKey}+2]`}
        >
          <FileText size={16} />
          <span>{t(lang, 'navAudit')}</span>
          <kbd
            style={{
              fontSize: '10px',
              opacity: currentTab === 'audit' ? 0.9 : 0.65,
              marginLeft: '2px',
              fontFamily: 'monospace',
              padding: '1px 4px',
              borderRadius: '4px',
              background: currentTab === 'audit' ? 'rgba(255,255,255,0.2)' : 'var(--input-bg)',
              border: currentTab === 'audit' ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--card-border)',
            }}
          >
            {metaKey}+A
          </kbd>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          title={`Settings [${metaKey}+3]`}
        >
          <Settings size={16} />
          <span>{t(lang, 'navSettings')}</span>
          <kbd
            style={{
              fontSize: '10px',
              opacity: currentTab === 'settings' ? 0.9 : 0.65,
              marginLeft: '2px',
              fontFamily: 'monospace',
              padding: '1px 4px',
              borderRadius: '4px',
              background: currentTab === 'settings' ? 'rgba(255,255,255,0.2)' : 'var(--input-bg)',
              border: currentTab === 'settings' ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--card-border)',
            }}
          >
            {metaKey}+3
          </kbd>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'enterprise' ? 'active' : ''}`}
          onClick={() => onSelectTab('enterprise')}
          title={`Enterprise Profiles [${metaKey}+4]`}
        >
          <Building size={16} />
          <span>{t(lang, 'navEnterprise')}</span>
        </button>

        <button
          type="button"
          className={`thundy-nav-tab ${currentTab === 'wizard' ? 'active' : ''}`}
          onClick={() => onSelectTab('wizard')}
          title={`Setup Wizard [${metaKey}+5]`}
        >
          <Wand2 size={16} />
          <span>{t(lang, 'navWizard')}</span>
        </button>
      </nav>

      <div className="thundy-header-actions">
        {/* Keyboard Shortcuts Cheat Sheet Button */}
        <button
          type="button"
          className="btn-secondary"
          onClick={onOpenShortcuts}
          style={{ minHeight: '34px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title={`Keyboard Shortcuts Cheat Sheet [${metaKey}+/ or ?]`}
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard size={16} />
          <kbd style={{ fontSize: '10px', padding: '1px 5px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '4px', fontFamily: 'monospace' }}>
            ?
          </kbd>
        </button>

        <label htmlFor="languageSelect" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>Language</label>
        <select
          id="languageSelect"
          value={lang}
          onChange={(e) => onSelectLang(e.target.value as Language)}
          style={{ minHeight: '34px', fontSize: '13px', padding: '4px 8px' }}
          title={`Display Language [${metaKey}+L to cycle]`}
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
          title={`Toggle Theme Mode [${metaKey}+T]`}
        >
          {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Laptop size={16} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
