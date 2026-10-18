import { useEffect } from 'react';
import { Language, SettingsState } from '../types';
import { 
  isEditableElement, 
  dispatchShortcutToast, 
  isMac,
  formatKeyCombo 
} from '../lib/keyboardShortcuts';

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  showToasts?: boolean;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onToggleTheme: () => void;
  lang: Language;
  onSelectLang: (lang: Language) => void;
  isShortcutsModalOpen: boolean;
  onToggleShortcutsModal: () => void;
  onCloseShortcutsModal: () => void;
}

const SUPPORTED_LANGS: Language[] = ['en', 'de', 'fr', 'es', 'it', 'pl'];

export function useKeyboardShortcuts({
  enabled = true,
  showToasts = true,
  currentTab,
  onSelectTab,
  onToggleTheme,
  lang,
  onSelectLang,
  isShortcutsModalOpen,
  onToggleShortcutsModal,
  onCloseShortcutsModal,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifierActive = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key;
      const activeEl = document.activeElement;
      const inInput = isEditableElement(activeEl);

      // 1. Help Cheat Sheet: '?' (Shift + /) or 'Ctrl+/' / 'Cmd+/'
      if ((key === '?' && !inInput) || (isModifierActive && key === '/')) {
        e.preventDefault();
        onToggleShortcutsModal();
        if (showToasts && !isShortcutsModalOpen) {
          dispatchShortcutToast({
            id: 'shortcuts-modal',
            message: 'Keyboard Shortcuts Cheat Sheet',
            keyCombo: isMac() ? '⌘ + /' : 'Ctrl + /',
            icon: 'help',
          });
        }
        return;
      }

      // 2. Escape closes open modal/dock
      if (key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          onCloseShortcutsModal();
          return;
        }
        // Let other modals/docks handle Esc as well
        window.dispatchEvent(new CustomEvent('thundy:close-panels'));
        return;
      }

      // 3. Ctrl+S or Cmd+S: Trigger Scan / Quick Scan
      if (isModifierActive && (key === 's' || key === 'S') && !e.shiftKey) {
        e.preventDefault(); // Prevent browser "Save page"
        if (currentTab !== 'scanner') {
          onSelectTab('scanner');
        }
        // Give time for ScannerView / QuickScanButton to mount if switching
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('thundy:trigger-quick-scan'));
        }, currentTab === 'scanner' ? 10 : 150);

        if (showToasts) {
          dispatchShortcutToast({
            id: 'trigger-scan',
            message: 'Quick Scan Initiated',
            keyCombo: isMac() ? '⌘ + S' : 'Ctrl + S',
            icon: 'zap',
          });
        }
        return;
      }

      // 4. Ctrl+A or Cmd+A: Navigate to AuditView (unless inside input/textarea)
      if (isModifierActive && (key === 'a' || key === 'A') && !e.shiftKey) {
        if (inInput) {
          // Allow standard text select-all in input fields
          return;
        }
        e.preventDefault();
        onSelectTab('audit');
        if (showToasts) {
          dispatchShortcutToast({
            id: 'nav-audit',
            message: 'Navigated to Link Decision Log',
            keyCombo: isMac() ? '⌘ + A' : 'Ctrl + A',
            icon: 'file',
          });
        }
        return;
      }

      // 5. Navigation Tabs via Number keys (Ctrl+1..5 or Alt+1..5)
      if ((isModifierActive || isAlt) && !e.shiftKey) {
        if (key === '1') {
          e.preventDefault();
          onSelectTab('scanner');
          if (showToasts) {
            dispatchShortcutToast({
              id: 'nav-scanner',
              message: 'Message Scanner',
              keyCombo: formatKeyCombo('Ctrl + 1', '⌘ + 1'),
              icon: 'shield',
            });
          }
          return;
        }
        if (key === '2') {
          e.preventDefault();
          onSelectTab('audit');
          if (showToasts) {
            dispatchShortcutToast({
              id: 'nav-audit-tab',
              message: 'Link Decision Log',
              keyCombo: formatKeyCombo('Ctrl + 2', '⌘ + 2'),
              icon: 'file',
            });
          }
          return;
        }
        if (key === '3' || key === ',') {
          e.preventDefault();
          onSelectTab('settings');
          if (showToasts) {
            dispatchShortcutToast({
              id: 'nav-settings',
              message: 'Settings & Preferences',
              keyCombo: formatKeyCombo('Ctrl + 3', '⌘ + 3'),
              icon: 'settings',
            });
          }
          return;
        }
        if (key === '4') {
          e.preventDefault();
          onSelectTab('enterprise');
          if (showToasts) {
            dispatchShortcutToast({
              id: 'nav-enterprise',
              message: 'Enterprise Profiles',
              keyCombo: formatKeyCombo('Ctrl + 4', '⌘ + 4'),
              icon: 'shield',
            });
          }
          return;
        }
        if (key === '5') {
          e.preventDefault();
          onSelectTab('wizard');
          if (showToasts) {
            dispatchShortcutToast({
              id: 'nav-wizard',
              message: 'Setup Wizard',
              keyCombo: formatKeyCombo('Ctrl + 5', '⌘ + 5'),
              icon: 'help',
            });
          }
          return;
        }
      }

      // 6. Theme Toggle: Ctrl+T or Alt+T
      if ((isModifierActive || isAlt) && (key === 't' || key === 'T') && !e.shiftKey) {
        e.preventDefault();
        onToggleTheme();
        if (showToasts) {
          dispatchShortcutToast({
            id: 'toggle-theme',
            message: 'Theme Mode Toggled',
            keyCombo: formatKeyCombo('Ctrl + T', '⌘ + T'),
            icon: 'sun',
          });
        }
        return;
      }

      // 7. Cycle Language: Ctrl+L or Alt+L
      if ((isModifierActive || isAlt) && (key === 'l' || key === 'L') && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = SUPPORTED_LANGS.indexOf(lang);
        const nextLang = SUPPORTED_LANGS[(currentIndex + 1) % SUPPORTED_LANGS.length];
        onSelectLang(nextLang);
        if (showToasts) {
          dispatchShortcutToast({
            id: 'cycle-lang',
            message: `Language: ${nextLang.toUpperCase()}`,
            keyCombo: formatKeyCombo('Ctrl + L', '⌘ + L'),
            icon: 'help',
          });
        }
        return;
      }

      // 8. Upload .eml file: Ctrl+U or Alt+U
      if ((isModifierActive || isAlt) && (key === 'u' || key === 'U') && !e.shiftKey) {
        e.preventDefault();
        if (currentTab !== 'scanner') {
          onSelectTab('scanner');
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('thundy:upload-eml'));
        }, currentTab === 'scanner' ? 10 : 150);

        if (showToasts) {
          dispatchShortcutToast({
            id: 'upload-eml',
            message: 'Upload Message (.eml)',
            keyCombo: formatKeyCombo('Ctrl + U', '⌘ + U'),
            icon: 'mail',
          });
        }
        return;
      }

      // 9. Export PDF Report: Ctrl+Shift+E or Alt+Shift+E
      if ((isModifierActive || isAlt) && e.shiftKey && (key === 'e' || key === 'E')) {
        e.preventDefault();
        if (currentTab !== 'audit') {
          onSelectTab('audit');
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('thundy:export-pdf'));
        }, currentTab === 'audit' ? 10 : 200);

        if (showToasts) {
          dispatchShortcutToast({
            id: 'export-pdf',
            message: 'Exporting Compliance PDF',
            keyCombo: formatKeyCombo('Ctrl + Shift + E', '⌘ + ⇧ + E'),
            icon: 'file',
          });
        }
        return;
      }

      // 10. Threat Spike Thresholds: Ctrl+Shift+T or Alt+Shift+T
      if ((isModifierActive || isAlt) && e.shiftKey && (key === 't' || key === 'T')) {
        e.preventDefault();
        if (currentTab !== 'audit') {
          onSelectTab('audit');
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('thundy:open-thresholds'));
        }, currentTab === 'audit' ? 10 : 200);

        if (showToasts) {
          dispatchShortcutToast({
            id: 'open-thresholds',
            message: 'Threat Spike Thresholds',
            keyCombo: formatKeyCombo('Ctrl + Shift + T', '⌘ + ⇧ + T'),
            icon: 'settings',
          });
        }
        return;
      }

      // 11. Cycle Sample Messages: J / K or [ / ] (only when NOT in input)
      if (!inInput && !isModifierActive && !isAlt && !e.shiftKey) {
        if (key === 'j' || key === ']') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('thundy:next-email'));
          if (showToasts) {
            dispatchShortcutToast({
              id: 'next-email',
              message: 'Next Message',
              keyCombo: key.toUpperCase(),
              icon: 'mail',
            });
          }
          return;
        }
        if (key === 'k' || key === '[') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('thundy:prev-email'));
          if (showToasts) {
            dispatchShortcutToast({
              id: 'prev-email',
              message: 'Previous Message',
              keyCombo: key.toUpperCase(),
              icon: 'mail',
            });
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    showToasts,
    currentTab,
    onSelectTab,
    onToggleTheme,
    lang,
    onSelectLang,
    isShortcutsModalOpen,
    onToggleShortcutsModal,
    onCloseShortcutsModal,
  ]);
}
