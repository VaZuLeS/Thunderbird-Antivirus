export interface ShortcutDefinition {
  id: string;
  category: 'navigation' | 'actions' | 'general';
  keyDisplay: string;
  macKeyDisplay: string;
  label: string;
  description: string;
  badge?: string;
}

export const SHORTCUTS_REGISTRY: ShortcutDefinition[] = [
  // Navigation
  {
    id: 'scan-trigger',
    category: 'navigation',
    keyDisplay: 'Ctrl + S',
    macKeyDisplay: '⌘ + S',
    label: 'Trigger Scan / Scanner View',
    description: 'Triggers an immediate scan of the message/attachment and switches to Scanner view',
    badge: 'Popular',
  },
  {
    id: 'nav-audit',
    category: 'navigation',
    keyDisplay: 'Ctrl + A',
    macKeyDisplay: '⌘ + A',
    label: 'Link Decision Log (Audit View)',
    description: 'Navigate to the Audit View and local link decision compliance log',
    badge: 'Popular',
  },
  {
    id: 'nav-scanner',
    category: 'navigation',
    keyDisplay: 'Ctrl + 1 / Alt + 1',
    macKeyDisplay: '⌘ + 1 / ⌥ + 1',
    label: 'Message Scanner',
    description: 'Switch to the Message Scanner view',
  },
  {
    id: 'nav-audit-tab',
    category: 'navigation',
    keyDisplay: 'Ctrl + 2 / Alt + 2',
    macKeyDisplay: '⌘ + 2 / ⌥ + 2',
    label: 'Audit Log Tab',
    description: 'Switch to the Audit View (also Ctrl+A)',
  },
  {
    id: 'nav-settings',
    category: 'navigation',
    keyDisplay: 'Ctrl + 3 / Alt + 3',
    macKeyDisplay: '⌘ + 3 / ⌥ + 3',
    label: 'Settings',
    description: 'Switch to Preferences and Analysis settings',
  },
  {
    id: 'nav-enterprise',
    category: 'navigation',
    keyDisplay: 'Ctrl + 4 / Alt + 4',
    macKeyDisplay: '⌘ + 4 / ⌥ + 4',
    label: 'Enterprise Profiles',
    description: 'Switch to Enterprise Profiles and Policy configuration',
  },
  {
    id: 'nav-wizard',
    category: 'navigation',
    keyDisplay: 'Ctrl + 5 / Alt + 5',
    macKeyDisplay: '⌘ + 5 / ⌥ + 5',
    label: 'Setup Wizard',
    description: 'Switch to Step-by-Step Onboarding Wizard',
  },

  // Actions & Inspection
  {
    id: 'action-quick-scan',
    category: 'actions',
    keyDisplay: 'Ctrl + S',
    macKeyDisplay: '⌘ + S',
    label: 'Trigger Quick Scan',
    description: 'Runs non-intrusive heuristic, ClamAV & entropy scan on the most recent attachment',
    badge: 'Core',
  },
  {
    id: 'action-next-email',
    category: 'actions',
    keyDisplay: 'J or ]',
    macKeyDisplay: 'J or ]',
    label: 'Next Sample Message',
    description: 'Cycle to the next email in the sample / test inbox',
  },
  {
    id: 'action-prev-email',
    category: 'actions',
    keyDisplay: 'K or [',
    macKeyDisplay: 'K or [',
    label: 'Previous Sample Message',
    description: 'Cycle to the previous email in the sample inbox',
  },
  {
    id: 'action-upload-eml',
    category: 'actions',
    keyDisplay: 'Ctrl + U',
    macKeyDisplay: '⌘ + U',
    label: 'Upload .eml File',
    description: 'Open file picker to inspect custom EML or RFC822 message',
  },
  {
    id: 'action-export-pdf',
    category: 'actions',
    keyDisplay: 'Ctrl + Shift + E',
    macKeyDisplay: '⌘ + Shift + E',
    label: 'Export Compliance PDF',
    description: 'Generate compliance audit report with SVG chart and hash ledger',
  },
  {
    id: 'action-thresholds',
    category: 'actions',
    keyDisplay: 'Ctrl + Shift + T',
    macKeyDisplay: '⌘ + Shift + T',
    label: 'Threat Spike Thresholds',
    description: 'Configure 24-hour threat spike notification thresholds',
  },

  // General & Accessibility
  {
    id: 'general-shortcuts',
    category: 'general',
    keyDisplay: '? or Ctrl + /',
    macKeyDisplay: '? or ⌘ + /',
    label: 'Keyboard Shortcuts Cheat Sheet',
    description: 'Open this interactive keyboard shortcuts reference modal',
    badge: 'Help',
  },
  {
    id: 'general-theme',
    category: 'general',
    keyDisplay: 'Ctrl + T / Alt + T',
    macKeyDisplay: '⌘ + T / ⌥ + T',
    label: 'Toggle Theme Mode',
    description: 'Cycle through System, Light, and Dark appearance themes',
  },
  {
    id: 'general-lang',
    category: 'general',
    keyDisplay: 'Ctrl + L / Alt + L',
    macKeyDisplay: '⌘ + L / ⌥ + L',
    label: 'Cycle Display Language',
    description: 'Cycle through available languages (EN, DE, FR, ES, IT, PL)',
  },
  {
    id: 'general-close',
    category: 'general',
    keyDisplay: 'Esc',
    macKeyDisplay: 'Esc',
    label: 'Close Active Modal / Panel',
    description: 'Dismiss any open dialog, modal, drawer, or quick scan dock',
  },
];

export function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

export function formatKeyCombo(keyDisplay: string, macKeyDisplay: string): string {
  return isMac() ? macKeyDisplay : keyDisplay;
}

export interface ShortcutToastPayload {
  id: string;
  message: string;
  keyCombo: string;
  icon?: 'zap' | 'shield' | 'file' | 'settings' | 'sun' | 'moon' | 'mail' | 'help';
}

export function dispatchShortcutToast(payload: ShortcutToastPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('thundy:shortcut-toast', { detail: payload }));
}

export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if ((element as HTMLElement).isContentEditable) {
    return true;
  }
  return false;
}
