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
  const dayMs = 86400000;

  const rawSeed = [
    { daysAgo: 0.1, url: 'https://portal.example.net/rechnung/4711?uid=123', score: 60, verdict: 'SUSPICIOUS' as const, provider: 'urlscan.io', reasons: ['Urgency keywords detected in context', 'External domain mismatch'], outcome: 'ABORTED' as const, messageId: 'testdata-03-urgency@example.net', sender: 'Buchhaltung <buchhaltung@example.net>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 0.3, url: 'https://docs.example.org/guide', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Domain matches verified sender', 'SPF/DKIM/DMARC valid'], outcome: 'OPENED' as const, messageId: 'testdata-01-safe@example.org', sender: 'Anna Weber <anna.weber@example.org>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 1, url: 'http://secure-login.paypal-verification.net/update', score: 90, verdict: 'MALICIOUS' as const, provider: 'URLhaus', reasons: ['Domain resembles paypal.com (Levenshtein distance 2)', 'Listed on URLhaus blacklist'], outcome: 'ABORTED' as const, messageId: 'spoofed-brand@bank.fake', sender: 'PayPal Security Alert <security@paypal-verification.net>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 2, url: 'https://cdn.marketing-promo.com/survey', score: 25, verdict: 'SUSPICIOUS' as const, provider: 'local-heuristic', reasons: ['First contact with sender', 'Untrusted tracking link'], outcome: 'ABORTED' as const, messageId: 'promo@marketing.com', sender: 'Survey Operations <promo@marketing.com>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 3, url: 'https://github.com/VaZuLeS/Thunderbird-Antivirus', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Domain verified in sender allowlist'], outcome: 'OPENED' as const, messageId: 'newsletter@dev-updates.org', sender: 'Dev Newsletter <newsletter@dev-updates.org>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 4, url: 'http://login-verification-service.xyz/reset', score: 85, verdict: 'MALICIOUS' as const, provider: 'VirusTotal', reasons: ['Known phishing redirect target', 'Critical threat rating'], outcome: 'ABORTED' as const, messageId: 'support@bank-security.de', sender: 'Bank Security Support <support@bank-security.de>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 6, url: 'https://team-share.workspace.net/f/9921', score: 10, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Authenticated SPF server'], outcome: 'OPENED' as const, messageId: 'team@workspace.net', sender: 'Collaboration Hub <team@workspace.net>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 7, url: 'https://paypa1-update-center.org/login', score: 95, verdict: 'MALICIOUS' as const, provider: 'urlscan.io', reasons: ['Typosquatting against PayPal', 'Brand spoofing detected'], outcome: 'ABORTED' as const, messageId: 'alert@paypa1.org', sender: 'PayPal Customer Care <alert@paypa1.org>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 7.1, url: 'http://paypal-security-verification.biz/confirm', score: 90, verdict: 'MALICIOUS' as const, provider: 'URLhaus', reasons: ['Phishing campaign cluster', 'Known credential harvester'], outcome: 'ABORTED' as const, messageId: 'service-71@paypal-security.biz', sender: 'PayPal Account Team <service@paypal-security.biz>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 7.2, url: 'https://paypa1-billing-check.com/account', score: 85, verdict: 'MALICIOUS' as const, provider: 'VirusTotal', reasons: ['High-confidence phishing kit signature', 'Brand spoofing'], outcome: 'ABORTED' as const, messageId: 'notice-72@paypa1-billing.com', sender: 'PayPal Resolution Desk <notice@paypa1-billing.com>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 9, url: 'https://intranet.partner-consulting.de/file', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Allowed domain'], outcome: 'OPENED' as const, messageId: 'project@partner.de', sender: 'Partner Consulting <project@partner.de>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 11, url: 'http://urgent-invoice-payment.cc/pdf', score: 80, verdict: 'MALICIOUS' as const, provider: 'URLhaus', reasons: ['Severe BEC urgency pattern', 'Listed on URLhaus'], outcome: 'ABORTED' as const, messageId: 'billing@urgent-invoice.cc', sender: 'Urgent Invoicing <billing@urgent-invoice.cc>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 13, url: 'https://newsletter.tech-review.eu/weekly', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['SPF/DKIM passed'], outcome: 'OPENED' as const, messageId: 'news@tech-review.eu', sender: 'Tech Review Weekly <news@tech-review.eu>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 14, url: 'https://dhl-paket-tracking-ru.com/express', score: 75, verdict: 'SUSPICIOUS' as const, provider: 'VirusTotal', reasons: ['Sender Reply-To mismatch', 'Suspicious tracking domain'], outcome: 'ABORTED' as const, messageId: 'support@dhl-fake.ru', sender: 'DHL Tracking Notification <support@dhl-fake.ru>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 14.1, url: 'https://dhl-express-sendung-online.info/paket', score: 80, verdict: 'MALICIOUS' as const, provider: 'urlscan.io', reasons: ['Package phishing campaign signature', 'Domain age < 24h'], outcome: 'ABORTED' as const, messageId: 'paket-141@dhl-express.info', sender: 'DHL Express Service <paket@dhl-express.info>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 16, url: 'https://status.cloud-provider.io', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Clean domain reputation'], outcome: 'OPENED' as const, messageId: 'ops@cloud-provider.io', sender: 'Cloud Status <ops@cloud-provider.io>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 18, url: 'http://microsoft-office365-verify.top/auth', score: 90, verdict: 'MALICIOUS' as const, provider: 'URLhaus', reasons: ['Office 365 brand impersonation', 'Auth failure'], outcome: 'ABORTED' as const, messageId: 'admin@o365-fake.top', sender: 'Microsoft 365 Admin <admin@o365-fake.top>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 20, url: 'https://vendor-invoices.local-firm.de/download', score: 30, verdict: 'SUSPICIOUS' as const, provider: 'local-heuristic', reasons: ['First communication', 'Urgency keyword found'], outcome: 'OPENED' as const, messageId: 'accounting@vendor.de', sender: 'Local Firm Vendor <accounting@vendor.de>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 22, url: 'https://cloud-storage.example.com/share/901', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['Trusted sender'], outcome: 'OPENED' as const, messageId: 'colleague@example.com', sender: 'Colleague Direct <colleague@example.com>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 25, url: 'http://sparkasse-sicherheit-abgleich.com/tan', score: 95, verdict: 'MALICIOUS' as const, provider: 'URLhaus', reasons: ['Typosquatting sparkasse.de', 'High-confidence credential harvester'], outcome: 'ABORTED' as const, messageId: 'service@sparkasse-fake.com', sender: 'Sparkasse Kundenservice <service@sparkasse-fake.com>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 27, url: 'https://customer-portal.legit-store.com/orders', score: 0, verdict: 'SAFE' as const, provider: 'local-heuristic', reasons: ['SPF & DKIM pass'], outcome: 'OPENED' as const, messageId: 'orders@legit-store.com', sender: 'Online Shop Orders <orders@legit-store.com>', source: 'Thunderbird Mailbox / Inbound' },
    { daysAgo: 28, url: 'http://verify-bank-details.biz/urgent', score: 70, verdict: 'SUSPICIOUS' as const, provider: 'urlscan.io', reasons: ['Urgency signal words in subject and text', 'Unverified domain'], outcome: 'ABORTED' as const, messageId: 'alert@verify-bank.biz', sender: 'Urgent Bank Verification <alert@verify-bank.biz>', source: 'Thunderbird Mailbox / Inbound' },
  ];

  return rawSeed.map((item, index) => {
    const clickedAt = now - Math.round(item.daysAgo * dayMs);
    return {
      id: `demo-audit-${index + 1}`,
      clickedAt,
      decidedAt: clickedAt + 2500,
      messageId: item.messageId,
      sender: item.sender,
      source: item.source,
      url: item.url,
      score: item.score,
      verdict: item.verdict,
      provider: item.provider,
      reasons: item.reasons,
      outcome: item.outcome,
      openAttempts: item.outcome === 'OPENED' ? 1 : 0,
      extensionVersion: '1.23.0',
    };
  });
}
