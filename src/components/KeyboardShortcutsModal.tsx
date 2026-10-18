import React, { useState, useMemo, useEffect } from 'react';
import { Language } from '../types';
import { SHORTCUTS_REGISTRY, isMac, ShortcutDefinition } from '../lib/keyboardShortcuts';
import { 
  Keyboard, X, Search, Sparkles, Navigation, Zap, Sliders, CheckCircle2, Command
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSelectTab?: (tab: string) => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSelectTab,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'navigation' | 'actions' | 'general'>('all');
  const [forcePlatform, setForcePlatform] = useState<'auto' | 'mac' | 'windows'>('auto');

  // Detect platform
  const isPlatformMac = useMemo(() => {
    if (forcePlatform === 'mac') return true;
    if (forcePlatform === 'windows') return false;
    return isMac();
  }, [forcePlatform]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    return SHORTCUTS_REGISTRY.filter((sc) => {
      const matchCategory = activeCategory === 'all' || sc.category === activeCategory;
      const q = search.toLowerCase().trim();
      if (!q) return matchCategory;
      const matchText = 
        sc.label.toLowerCase().includes(q) ||
        sc.description.toLowerCase().includes(q) ||
        sc.keyDisplay.toLowerCase().includes(q) ||
        sc.macKeyDisplay.toLowerCase().includes(q);
      return matchCategory && matchText;
    });
  }, [activeCategory, search]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
    >
      <div
        className="thundy-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--header-bg, var(--card-bg))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--accent-soft, rgba(0, 102, 204, 0.1))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--link-color)',
              }}
            >
              <Keyboard size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 id="shortcuts-dialog-title" style={{ margin: 0, fontSize: '18px', fontWeight: 750 }}>
                  Keyboard Shortcuts
                </h2>
                <span className="thundy-badge info" style={{ fontSize: '11px', fontWeight: 700 }}>
                  Power User
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Navigate, scan, and inspect with instant single-key and modifier commands
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '6px',
              borderRadius: '8px',
              minHeight: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close shortcuts modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Platform Filter Bar */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            background: 'var(--input-bg)',
          }}
        >
          {/* Search Input */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search shortcuts (e.g. scan, audit, eml, theme)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                outline: 'none',
              }}
            />
          </div>

          {/* Platform Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Keys:</span>
            <button
              type="button"
              className={forcePlatform === 'auto' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setForcePlatform('auto')}
              style={{ padding: '4px 8px', fontSize: '11px', minHeight: '26px' }}
            >
              Auto ({isMac() ? 'macOS' : 'Win/Linux'})
            </button>
            <button
              type="button"
              className={forcePlatform === 'windows' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setForcePlatform('windows')}
              style={{ padding: '4px 8px', fontSize: '11px', minHeight: '26px' }}
            >
              Ctrl
            </button>
            <button
              type="button"
              className={forcePlatform === 'mac' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setForcePlatform('mac')}
              style={{ padding: '4px 8px', fontSize: '11px', minHeight: '26px' }}
            >
              ⌘ Cmd
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            gap: '8px',
            background: 'var(--card-bg)',
          }}
        >
          <button
            type="button"
            className={`thundy-nav-tab ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => setActiveCategory('all')}
            style={{ padding: '5px 12px', fontSize: '12px' }}
          >
            All ({SHORTCUTS_REGISTRY.length})
          </button>
          <button
            type="button"
            className={`thundy-nav-tab ${activeCategory === 'navigation' ? 'active' : ''}`}
            onClick={() => setActiveCategory('navigation')}
            style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Navigation size={13} />
            <span>Navigation</span>
          </button>
          <button
            type="button"
            className={`thundy-nav-tab ${activeCategory === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveCategory('actions')}
            style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Zap size={13} />
            <span>Actions & Scan</span>
          </button>
          <button
            type="button"
            className={`thundy-nav-tab ${activeCategory === 'general' ? 'active' : ''}`}
            onClick={() => setActiveCategory('general')}
            style={{ padding: '5px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Sliders size={13} />
            <span>General</span>
          </button>
        </div>

        {/* Shortcuts List Content */}
        <div
          style={{
            padding: '16px 24px',
            overflowY: 'auto',
            maxHeight: '440px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {filteredShortcuts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <Keyboard size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>No shortcuts matched "{search}"</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearch('');
                  setActiveCategory('all');
                }}
                style={{ marginTop: '12px', fontSize: '12px', padding: '6px 14px' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredShortcuts.map((sc) => {
              const displayCombo = isPlatformMac ? sc.macKeyDisplay : sc.keyDisplay;
              const keys = displayCombo.split(' / ');

              return (
                <div
                  key={sc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--card-border)',
                    gap: '16px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-color)' }}>
                        {sc.label}
                      </span>
                      {sc.badge && (
                        <span
                          className="thundy-badge info"
                          style={{ fontSize: '10px', padding: '1px 6px', textTransform: 'uppercase' }}
                        >
                          {sc.badge}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {sc.description}
                    </p>
                  </div>

                  {/* KBD Display Container */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {keys.map((combo, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>or</span>}
                        <kbd
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            background: 'var(--card-bg)',
                            color: 'var(--link-color)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08), 0 1px 0 rgba(0, 0, 0, 0.1)',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {combo}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--header-bg, var(--card-bg))',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} style={{ color: 'var(--color-warning)' }} />
            <span>Shortcuts work across the whole application anytime outside text fields</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px' }}>
              Press <kbd style={{ padding: '2px 6px', background: 'var(--input-bg)', borderRadius: '4px', border: '1px solid var(--card-border)' }}>Esc</kbd> to exit
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
