import React, { useState } from 'react';
import { Language, PrivacyTier, SettingsState } from '../types';
import { t } from '../lib/i18n';
import { Wand2, CheckCircle, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

interface WizardViewProps {
  lang: Language;
  onSelectLang: (lang: Language) => void;
  settings: SettingsState;
  onSaveSettings: (newSettings: SettingsState) => void;
  onFinishWizard: () => void;
}

export const WizardView: React.FC<WizardViewProps> = ({
  lang,
  onSelectLang,
  settings,
  onSaveSettings,
  onFinishWizard,
}) => {
  const [step, setStep] = useState<number>(0);
  const [linkProtection, setLinkProtection] = useState<boolean>(settings.timeOfClickProtection);
  const [externalAnalysis, setExternalAnalysis] = useState<boolean>(settings.externalAnalysisConsent);
  const [privacyTier, setPrivacyTier] = useState<PrivacyTier>(settings.privacyTier);

  const handleNext = () => {
    if (step < 2) {
      setStep(s => s + 1);
    } else {
      // Save setup
      onSaveSettings({
        ...settings,
        timeOfClickProtection: linkProtection,
        externalAnalysisConsent: externalAnalysis,
        privacyTier,
      });
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  return (
    <div className="wizard-view" style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="thundy-card">
        {/* Wizard Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Wand2 size={28} style={{ color: 'var(--link-color)' }} />
            <div>
              <span style={{ fontSize: '12px', fontWeight: 750, color: 'var(--link-color)', letterSpacing: '1px' }}>THUNDY AV</span>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 750 }}>
                {t(lang, 'wizardTitle')}
              </h2>
            </div>
          </div>

          <div>
            <label htmlFor="wizardLangSelect" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden' }}>Language</label>
            <select
              id="wizardLangSelect"
              value={lang}
              onChange={(e) => onSelectLang(e.target.value as Language)}
              style={{ fontSize: '12px', padding: '4px 8px' }}
            >
              <option value="en">English (EN)</option>
              <option value="de">Deutsch (DE)</option>
              <option value="fr">Français (FR)</option>
              <option value="es">Español (ES)</option>
              <option value="it">Italiano (IT)</option>
              <option value="pl">Polski (PL)</option>
            </select>
          </div>
        </div>

        {/* Progress indicator */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['Welcome', 'Protection', 'External Analysis', 'Done'].map((label, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 700,
                background: step >= idx ? 'var(--btn-primary-bg)' : 'var(--input-bg)',
                color: step >= idx ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                border: '1px solid var(--card-border)',
                transition: 'all 0.2s ease'
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 750, margin: '0 0 12px' }}>
              {t(lang, 'wizardWelcome')}
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-color)', marginBottom: '16px' }}>
              {t(lang, 'wizardIntro')}
            </p>
            <div style={{ padding: '12px 16px', background: 'var(--accent-soft)', borderRadius: '8px', borderLeft: '4px solid var(--link-color)', marginBottom: '20px' }}>
              <strong style={{ color: 'var(--link-color)', display: 'block', marginBottom: '4px' }}>
                {t(lang, 'localByDefault')}
              </strong>
              <span style={{ fontSize: '13px', color: 'var(--text-color)' }}>
                {t(lang, 'wizardLocalNotice')}
              </span>
            </div>
          </div>
        )}

        {/* Step 1: Link Protection */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 750, margin: '0 0 12px' }}>
              {t(lang, 'wizardProtection')}
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-color)', marginBottom: '16px' }}>
              Thundy AV can pause navigation when clicking a link inside an email, displaying threat information and letting you decide whether to proceed or block.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={linkProtection}
                onChange={(e) => setLinkProtection(e.target.checked)}
                style={{ width: '20px', height: '20px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 650 }}>
                {t(lang, 'wizardLinkChoice')}
              </span>
            </label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Decisions are logged into your local, private Link Decision Log.
            </p>
          </div>
        )}

        {/* Step 2: Optional Analysis */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 750, margin: '0 0 12px' }}>
              {t(lang, 'wizardExternal')}
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-color)', marginBottom: '16px' }}>
              Local checks run on your device without any external network traffic. Optionally, you can enable external reputation providers.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px', background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={externalAnalysis}
                onChange={(e) => setExternalAnalysis(e.target.checked)}
                style={{ width: '20px', height: '20px' }}
              />
              <div>
                <span style={{ fontSize: '14px', fontWeight: 650, display: 'block' }}>
                  {t(lang, 'consentLabel')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Disabled by default. Requires explicit opt-in.
                </span>
              </div>
            </label>

            {externalAnalysis && (
              <div style={{ padding: '14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                  {t(lang, 'privacyTier')}
                </label>
                <select
                  value={privacyTier}
                  onChange={(e) => setPrivacyTier(e.target.value as PrivacyTier)}
                  style={{ width: '100%' }}
                >
                  <option value="strict">{t(lang, 'tierStrict')}</option>
                  <option value="balanced">{t(lang, 'tierBalanced')}</option>
                  <option value="max">{t(lang, 'tierMax')}</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ color: 'var(--color-success)', display: 'inline-flex', marginBottom: '16px' }}>
              <CheckCircle size={48} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 750, margin: '0 0 8px' }}>
              {t(lang, 'wizardDone')}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Your Thundy AV configuration is active and saved locally.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={onFinishWizard}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px' }}
            >
              <ShieldCheck size={18} />
              <span>{t(lang, 'wizardOpenScanner')}</span>
            </button>
          </div>
        )}

        {/* Navigation Buttons */}
        {step < 3 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '16px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={step === 0}
              onClick={handleBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>{t(lang, 'wizardBack')}</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleNext}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{step === 2 ? t(lang, 'wizardFinish') : t(lang, 'wizardNext')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
