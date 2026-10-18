import React, { useState, useEffect } from 'react';
import { ShortcutToastPayload } from '../lib/keyboardShortcuts';
import { Zap, Shield, FileText, Settings, Sun, Moon, Mail, HelpCircle, Keyboard } from 'lucide-react';

interface ToastItem extends ShortcutToastPayload {
  timestamp: number;
}

interface ShortcutToastProps {
  enabled?: boolean;
}

export const ShortcutToast: React.FC<ShortcutToastProps> = ({ enabled = true }) => {
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ShortcutToastPayload>;
      if (!customEvent.detail) return;

      const item: ToastItem = {
        ...customEvent.detail,
        timestamp: Date.now(),
      };
      setCurrentToast(item);

      const timer = setTimeout(() => {
        setCurrentToast((prev) => (prev?.timestamp === item.timestamp ? null : prev));
      }, 2000);

      return () => clearTimeout(timer);
    };

    window.addEventListener('thundy:shortcut-toast', handleToastEvent);
    return () => {
      window.removeEventListener('thundy:shortcut-toast', handleToastEvent);
    };
  }, [enabled]);

  if (!enabled || !currentToast) return null;

  const renderIcon = () => {
    switch (currentToast.icon) {
      case 'zap':
        return <Zap size={16} style={{ color: 'var(--color-warning)' }} />;
      case 'file':
        return <FileText size={16} style={{ color: 'var(--link-color)' }} />;
      case 'shield':
        return <Shield size={16} style={{ color: 'var(--color-success)' }} />;
      case 'settings':
        return <Settings size={16} style={{ color: 'var(--link-color)' }} />;
      case 'sun':
        return <Sun size={16} style={{ color: 'var(--color-warning)' }} />;
      case 'moon':
        return <Moon size={16} style={{ color: 'var(--accent-color)' }} />;
      case 'mail':
        return <Mail size={16} style={{ color: 'var(--link-color)' }} />;
      case 'help':
        return <HelpCircle size={16} style={{ color: 'var(--link-color)' }} />;
      default:
        return <Keyboard size={16} style={{ color: 'var(--link-color)' }} />;
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 18px',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '30px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
        color: 'var(--text-color)',
        fontSize: '13px',
        fontWeight: 600,
        pointerEvents: 'none',
        animation: 'slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'var(--input-bg)',
        }}
      >
        {renderIcon()}
      </div>

      <span>{currentToast.message}</span>

      {currentToast.keyCombo && (
        <kbd
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 700,
            background: 'var(--input-bg)',
            color: 'var(--link-color)',
            border: '1px solid var(--card-border)',
            borderRadius: '6px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            marginLeft: '4px',
          }}
        >
          {currentToast.keyCombo}
        </kbd>
      )}
    </div>
  );
};
