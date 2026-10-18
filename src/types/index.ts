export type Language = 'en' | 'de' | 'fr' | 'es' | 'it' | 'pl';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'ocean' | 'violet' | 'forest' | 'amber';
export type InformationDensity = 'comfortable' | 'compact';
export type PrivacyTier = 'strict' | 'balanced' | 'max';

export interface SettingsState {
  // Appearance
  appearance: ThemeMode;
  accent: AccentColor;
  density: InformationDensity;

  // Privacy
  externalAnalysisConsent: boolean;
  privacyTier: PrivacyTier;

  // Protection
  timeOfClickProtection: boolean;
  alwaysManual: boolean;
  autoScanLinks: boolean;

  // Analysis Providers
  apikey: string; // Hybrid Analysis
  urlhausApikey: string;
  urlscanApikey: string;
  virustotalApikey: string;
  ipReputationProvider: 'none' | 'virustotal' | 'abuseipdb';
  ipReputationApiKey: string;

  // Sender Rules
  scanningEnabledSenders: string[];
  trustedAuthServers: string[];
  customWhitelist: string[];
  customBlacklist: string[];

  // Power User & Accessibility
  keyboardShortcutsEnabled?: boolean;
  showShortcutToasts?: boolean;
}

export interface ThreatReasonDetail {
  code: string;
  params: string[];
}

export interface ThreatEvaluationResult {
  score: number;
  reasons: string[];
  reasonDetails: ThreatReasonDetail[];
  authStatus: 'pass' | 'fail' | 'neutral';
  listType?: 'whitelist' | 'blacklist';
}

export interface LinkAuditRecord {
  id: string;
  clickedAt: number;
  decidedAt: number | null;
  messageId: string;
  sender?: string;
  source?: string;
  url: string;
  score: number | null;
  scoreSource?: string;
  scoreAtDecision?: number | null;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN';
  verdictAtDecision?: string | null;
  providerAtDecision?: string | null;
  provider: string;
  reasons: string[];
  providerReasons?: string[];
  outcome: 'OPENED' | 'ABORTED' | 'OPEN_ERROR' | 'PENDING';
  cancelReason?: string | null;
  openAttempts: number;
  extensionVersion: string;
}

export interface EmailAttachment {
  filename: string;
  size: string;
  type: string;
}

export interface EmailMessage {
  id: string;
  author: string;
  fromName?: string;
  fromEmail: string;
  subject: string;
  date: string;
  replyTo?: string;
  messageId: string;
  authHeaders: string[];
  receivedHeaders: string[];
  bodyText: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
}

export interface AttachmentScanResult {
  id: string;
  filename: string;
  size: string;
  type: string;
  scannedAt: number;
  emailSubject: string;
  emailAuthor: string;
  emailId: string;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS';
  score: number;
  sha256: string;
  magicBytesVerified: boolean;
  magicHeader: string;
  macrosDetected: boolean;
  scriptsDetected: boolean;
  suspiciousStreamsCount: number;
  extractedUrls: string[];
  sandboxDetonation: 'clean' | 'suspicious' | 'blocked';
  engineResults: {
    clamAvSignature: string;
    heuristicEngine: string;
    entropyScore: number;
    disarmedPdfValid: boolean;
  };
  reasons: string[];
}

export interface EnterpriseProfileItem {
  id: string;
  label: string | null;
  protocol: string;
  requiredSettings: string[];
  secretRefs: string[];
  components: string[];
  implementation: string;
}

export interface EnterpriseCategories {
  hosting: EnterpriseProfileItem[];
  sso: EnterpriseProfileItem[];
  devices: EnterpriseProfileItem[];
  siem: EnterpriseProfileItem[];
  tickets: EnterpriseProfileItem[];
}

export type EnterpriseCategoryKey = keyof EnterpriseCategories;

export interface EnterpriseSelection {
  hosting: string;
  sso: string;
  devices: string;
  siem: string;
  tickets: string;
}

export interface ThreatNotificationThresholds {
  enabled: boolean;
  spikeCountThreshold: number; // count of threat events in a 24-hour window that triggers an alert
  windowHours: number; // default 24
  metricBasis: 'all_threats' | 'critical_only' | 'blocked_only';
  notifyInApp: boolean;
  notifyDesktop: boolean;
  notifySound: boolean;
  emailAlertRecipient?: string;
}

export interface SpikeThresholdBreach {
  date: string;
  fullDate: string;
  timestamp: number;
  threatCount: number;
  highThreats: number;
  mediumThreats: number;
  aborted: number;
  threshold: number;
  excess: number;
  isRecent24h: boolean;
}

