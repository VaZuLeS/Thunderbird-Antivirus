// Port of link_audit.js for client-side persistent storage and export
import { LinkAuditRecord } from '../types';

const LINK_AUDIT_KEY = 'thundy_linkAuditLog';
const LINK_AUDIT_DAYS = 30;
const LINK_AUDIT_LIMIT = 2000;

export function getAuditRecords(): LinkAuditRecord[] {
  try {
    const raw = localStorage.getItem(LINK_AUDIT_KEY);
    if (!raw) return getDefaultAuditRecords();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultAuditRecords();
    return parsed;
  } catch {
    return getDefaultAuditRecords();
  }
}

export function saveAuditRecords(records: LinkAuditRecord[]): void {
  try {
    const now = Date.now();
    const pruned = records
      .filter(r => r && Number.isFinite(r.clickedAt) && now - r.clickedAt <= LINK_AUDIT_DAYS * 86400000)
      .slice(0, LINK_AUDIT_LIMIT);
    localStorage.setItem(LINK_AUDIT_KEY, JSON.stringify(pruned));
  } catch (e) {
    console.error('Failed to save audit records', e);
  }
}

export function addAuditRecord(record: Omit<LinkAuditRecord, 'id' | 'clickedAt' | 'extensionVersion'>): LinkAuditRecord {
  const fullRecord: LinkAuditRecord = {
    ...record,
    id: crypto.randomUUID ? crypto.randomUUID() : 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    clickedAt: Date.now(),
    extensionVersion: '1.23.0',
  };
  const current = getAuditRecords();
  current.unshift(fullRecord);
  saveAuditRecords(current);
  return fullRecord;
}

export function clearAuditLog(): void {
  localStorage.removeItem(LINK_AUDIT_KEY);
}

function getDefaultAuditRecords(): LinkAuditRecord[] {
  const now = Date.now();
  return [
    {
      id: 'demo-audit-1',
      clickedAt: now - 1000 * 60 * 15,
      decidedAt: now - 1000 * 60 * 14,
      messageId: 'testdata-03-urgency@example.net',
      url: 'https://portal.example.net/rechnung/4711?uid=123',
      score: 60,
      verdict: 'SUSPICIOUS',
      provider: 'urlscan.io',
      reasons: ['Urgency keywords detected in context', 'External domain mismatch'],
      outcome: 'ABORTED',
      openAttempts: 0,
      extensionVersion: '1.23.0',
    },
    {
      id: 'demo-audit-2',
      clickedAt: now - 1000 * 60 * 60 * 2,
      decidedAt: now - 1000 * 60 * 60 * 2 + 5000,
      messageId: 'testdata-01-safe@example.org',
      url: 'https://docs.example.org/guide',
      score: 0,
      verdict: 'SAFE',
      provider: 'local-heuristic',
      reasons: ['Domain matches verified sender', 'SPF/DKIM/DMARC valid'],
      outcome: 'OPENED',
      openAttempts: 1,
      extensionVersion: '1.23.0',
    },
    {
      id: 'demo-audit-3',
      clickedAt: now - 1000 * 60 * 60 * 5,
      decidedAt: now - 1000 * 60 * 60 * 5 + 3000,
      messageId: 'spoofed-brand@bank.fake',
      url: 'http://secure-login.paypal-verification.net/update',
      score: 90,
      verdict: 'MALICIOUS',
      provider: 'URLhaus',
      reasons: ['Domain resembles paypal.com (Levenshtein distance 2)', 'Listed on URLhaus blacklist'],
      outcome: 'ABORTED',
      openAttempts: 0,
      extensionVersion: '1.23.0',
    }
  ];
}
