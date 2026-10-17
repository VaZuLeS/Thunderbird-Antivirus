// Port of risk.js preserving all transparent heuristics, optimizations, and security rules
import { ThreatEvaluationResult, ThreatReasonDetail } from '../types';

const STRONG_URGENCY_WORDS = [
  'schnell', 'dringend', 'sofort', 'wichtig', 'urgent', 'asap', 'immediately', 
  'immédiatement', 'urgente', 'inmediatamente', 'subito', 'immediatamente', 
  'pilne', 'pilnie', 'natychmiast', 'ważne', 'szybko'
];

const URGENCY_WORDS = [
  ...STRONG_URGENCY_WORDS, 
  'überweisung', 'ceo', 'payment', 'rechnung', 'fällig', 'passwort', 'konto', 
  'transfer', 'bank', 'facture', 'virement', 'pago', 'contraseña', 'pagamento', 
  'fattura', 'przelew', 'hasło'
];

const STRONG_URGENCY_SET = new Set(STRONG_URGENCY_WORDS);
const URGENCY_REGEX = new RegExp('(^|[^\\p{L}\\p{N}_])(' + URGENCY_WORDS.join('|') + ')(?![\\p{L}\\p{N}_])', 'giu');
const FAST_URGENCY_REGEX = new RegExp(STRONG_URGENCY_WORDS.join('|'), 'iu');

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let strA = a;
  let strB = b;
  if (strA.length > strB.length) {
    const tmp = strA;
    strA = strB;
    strB = tmp;
  }

  const aLen = strA.length;
  const bLen = strB.length;
  let prevRow = new Uint16Array(aLen + 1);
  let currRow = new Uint16Array(aLen + 1);

  for (let j = 0; j <= aLen; j++) prevRow[j] = j;

  for (let i = 1; i <= bLen; i++) {
    currRow[0] = i;
    const bChar = strB.charCodeAt(i - 1);
    for (let j = 1; j <= aLen; j++) {
      if (bChar === strA.charCodeAt(j - 1)) {
        currRow[j] = prevRow[j - 1];
      } else {
        const sub = prevRow[j - 1];
        const del = prevRow[j];
        const ins = currRow[j - 1];
        let min = sub < del ? sub : del;
        if (ins < min) min = ins;
        currRow[j] = 1 + min;
      }
    }
    const tmp = prevRow;
    prevRow = currRow;
    currRow = tmp;
  }
  return prevRow[aLen];
}

export const KNOWN_BRANDS = [
  'paypal.com', 'amazon.de', 'amazon.com', 'apple.com', 'microsoft.com', 
  'google.com', 'facebook.com', 'netflix.com', 'dhl.de', 'postbank.de', 
  'sparkasse.de', 'volksbank.de'
];
const KNOWN_BRANDS_SET = new Set(KNOWN_BRANDS);

export function extractEmailAddress(rawAuthor: string): string {
  let email = rawAuthor;
  const start = rawAuthor.lastIndexOf('<');
  if (start !== -1) {
    const end = rawAuthor.indexOf('>', start + 1);
    if (end !== -1) {
      email = rawAuthor.substring(start + 1, end);
    }
  }
  return email.trim().toLowerCase();
}

export function extractEmailDomain(emailAddress: string): string {
  const atIndex = emailAddress.indexOf('@');
  return atIndex !== -1 ? emailAddress.substring(atIndex + 1).toLowerCase() : "";
}

export function getMainDomain(domain: string): string {
  if (KNOWN_BRANDS_SET.has(domain)) return domain;
  const lastDot = domain.lastIndexOf('.');
  if (lastDot !== -1) {
    const secondLastDot = domain.lastIndexOf('.', lastDot - 1);
    if (secondLastDot !== -1) {
      return domain.substring(secondLastDot + 1);
    }
  }
  return domain;
}

export interface EvaluateOptions {
  authHeaders?: string[];
  urlhausDomains?: string[];
  isFirstCommunication?: boolean;
  messageText?: string;
  subject?: string;
  replyTo?: string;
  customWhitelist?: string[];
  customBlacklist?: string[];
}

export function evaluateThreatScore(author: string, urls: string[], options: EvaluateOptions = {}): ThreatEvaluationResult {
  const {
    authHeaders = [],
    urlhausDomains = [],
    isFirstCommunication = false,
    messageText = '',
    subject = '',
    replyTo = '',
    customWhitelist = [],
    customBlacklist = [],
  } = options;

  let score = 0;
  const reasons: string[] = [];
  const reasonDetails: ThreatReasonDetail[] = [];

  const addReason = (code: string, fallback: string, params: string[] = []) => {
    reasons.push(fallback);
    reasonDetails.push({ code, params });
  };

  const email = extractEmailAddress(author);
  const senderDomain = extractEmailDomain(email);

  // Check Blacklist
  const blacklistSet = new Set(customBlacklist.map(s => s.toLowerCase().trim()).filter(Boolean));
  if (blacklistSet.size > 0) {
    if (blacklistSet.has(email) || blacklistSet.has(senderDomain)) {
      return {
        score: 100,
        reasons: [`Sender (${email || senderDomain}) is on the blocked list.`],
        reasonDetails: [{ code: 'reasonBlocked', params: [email || senderDomain] }],
        authStatus: 'neutral',
        listType: 'blacklist'
      };
    }
  }

  // Check Whitelist
  const whitelistSet = new Set(customWhitelist.map(s => s.toLowerCase().trim()).filter(Boolean));
  if (whitelistSet.size > 0) {
    if (whitelistSet.has(email) || whitelistSet.has(senderDomain)) {
      return {
        score: 0,
        reasons: [`Sender (${email || senderDomain}) is on the allowed list.`],
        reasonDetails: [{ code: 'reasonAllowed', params: [email || senderDomain] }],
        authStatus: 'pass',
        listType: 'whitelist'
      };
    }
  }

  // Authentication Evaluation (SPF, DKIM, DMARC)
  let authStatus: 'pass' | 'fail' | 'neutral' = 'neutral';
  if (authHeaders.length > 0) {
    const headerStr = authHeaders.join(' ').toLowerCase();
    const hasSpfFail = headerStr.includes('spf=fail') || headerStr.includes('spf=softfail');
    const hasDkimFail = headerStr.includes('dkim=fail');
    const hasDmarcFail = headerStr.includes('dmarc=fail');

    if (hasSpfFail || hasDkimFail || hasDmarcFail) {
      authStatus = 'fail';
      if (hasSpfFail) {
        score += 50;
        addReason('ui_087', 'SPF check failed (Possible spoofing / unauthorized sender).', ['spf']);
      }
      if (hasDkimFail) {
        score += 50;
        addReason('ui_088', 'DKIM signature invalid (Possible spoofing or tampered content).', ['dkim']);
      }
      if (hasDmarcFail) {
        score += 50;
        addReason('ui_089', 'DMARC alignment check failed.', ['dmarc']);
      }
    } else if (headerStr.includes('spf=pass') && headerStr.includes('dkim=pass') && headerStr.includes('dmarc=pass')) {
      authStatus = 'pass';
    }
  }

  // URLhaus check
  if (urlhausDomains.length > 0) {
    for (const d of urlhausDomains) {
      score += 80;
      addReason('ui_090', `Domain (${d}) is listed on URLhaus as malicious.`, [d]);
    }
  }

  // Reply-To mismatch
  if (replyTo && senderDomain) {
    const replyToEmail = extractEmailAddress(replyTo);
    const replyDomain = extractEmailDomain(replyToEmail);
    if (replyDomain && replyDomain !== senderDomain) {
      score += 50;
      addReason('ui_091', `Discrepancy: Reply-To domain (${replyDomain}) differs from sender domain (${senderDomain}).`, [replyDomain, senderDomain]);
    }
  }

  // Urgency & BEC Evaluation
  const mixedCaseText = (subject + ' ' + messageText).normalize('NFC');
  if (FAST_URGENCY_REGEX.test(mixedCaseText)) {
    const foundUrgencyWords: string[] = [];
    URGENCY_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URGENCY_REGEX.exec(mixedCaseText)) !== null) {
      const m = match[2].toLowerCase();
      if (!foundUrgencyWords.includes(m)) {
        foundUrgencyWords.push(m);
      }
    }

    if (foundUrgencyWords.some(w => STRONG_URGENCY_SET.has(w))) {
      if (isFirstCommunication) {
        score += 50;
        addReason('ui_092', `Possible BEC (Business Email Compromise): First communication from sender with urgency keywords: [${foundUrgencyWords.join(', ')}].`, [foundUrgencyWords.join(', ')]);
      } else {
        score += 20;
        addReason('ui_093', `Urgency signal words found: [${foundUrgencyWords.join(', ')}]. Exercise caution.`, [foundUrgencyWords.join(', ')]);
      }
    }
  } else if (isFirstCommunication) {
    score += 10;
    addReason('ui_094', 'First time communicating with this sender address.', []);
  }

  // Sender Domain Brand Impersonation / Typosquatting
  const senderMainDomain = getMainDomain(senderDomain);
  if (senderDomain && !KNOWN_BRANDS_SET.has(senderMainDomain)) {
    for (const brand of KNOWN_BRANDS) {
      if (senderMainDomain.length >= 4 && Math.abs(senderMainDomain.length - brand.length) <= 2) {
        const dist = levenshteinDistance(senderMainDomain, brand);
        if (dist > 0 && dist <= 2) {
          score += 60;
          addReason('ui_095', `Sender domain (${senderMainDomain}) suspiciously resembles known brand (${brand}).`, [senderMainDomain, brand]);
          break;
        }
      }
    }
  }

  // Links Evaluation
  const linkDomains = new Set<string>();
  for (const urlStr of urls) {
    try {
      const u = new URL(urlStr);
      if (u.hostname) linkDomains.add(u.hostname.toLowerCase());
    } catch {
      // ignore
    }
  }

  if (linkDomains.size > 0 && senderDomain) {
    let matchFound = false;
    let typosquatFound = false;
    const dotSender = '.' + senderDomain;
    const dotSenderMain = senderMainDomain ? '.' + senderMainDomain : '';

    for (const ld of linkDomains) {
      if (ld === senderDomain || ld.endsWith(dotSender) || senderDomain.endsWith('.' + ld)) {
        matchFound = true;
      } else if (senderMainDomain && (ld === senderMainDomain || ld.endsWith(dotSenderMain))) {
        matchFound = true;
      }

      const linkMain = getMainDomain(ld);
      if (!KNOWN_BRANDS_SET.has(linkMain)) {
        for (const brand of KNOWN_BRANDS) {
          if (linkMain.length >= 4 && Math.abs(linkMain.length - brand.length) <= 2) {
            const dist = levenshteinDistance(linkMain, brand);
            if (dist > 0 && dist <= 2) {
              typosquatFound = true;
              addReason('ui_096', `Link domain (${linkMain}) suspiciously resembles brand (${brand}).`, [linkMain, brand]);
              break;
            }
          }
        }
      }
    }

    if (!matchFound) {
      score += 40;
      addReason('ui_097', `None of the links point to the sender domain (${senderDomain}).`, [senderDomain]);
    }
    if (typosquatFound) {
      score += 60;
    }
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    reasons,
    reasonDetails,
    authStatus,
  };
}
