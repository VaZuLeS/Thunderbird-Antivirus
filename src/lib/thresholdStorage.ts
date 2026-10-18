import { ThreatNotificationThresholds, SpikeThresholdBreach, LinkAuditRecord } from '../types';

export const THRESHOLD_STORAGE_KEY = 'thundy_threat_thresholds';

export const DEFAULT_THRESHOLDS: ThreatNotificationThresholds = {
  enabled: true,
  spikeCountThreshold: 3, // 3 threats in a 24-hour window
  windowHours: 24,
  metricBasis: 'all_threats',
  notifyInApp: true,
  notifyDesktop: false,
  notifySound: true,
  emailAlertRecipient: 'secops-alert@internal.corp',
};

/**
 * Retrieve saved notification threshold settings from localStorage
 */
export function getNotificationThresholds(): ThreatNotificationThresholds {
  try {
    const raw = localStorage.getItem(THRESHOLD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_THRESHOLDS,
        ...parsed,
        // sanitize numeric boundary
        spikeCountThreshold: Math.max(1, Number(parsed.spikeCountThreshold) || 3),
      };
    }
  } catch (err) {
    console.warn('Failed to parse saved threat notification thresholds:', err);
  }
  return DEFAULT_THRESHOLDS;
}

/**
 * Persist notification threshold settings to localStorage
 */
export function saveNotificationThresholds(settings: ThreatNotificationThresholds): void {
  try {
    localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('thundy_thresholds_updated', { detail: settings }));
  } catch (err) {
    console.error('Failed to save notification thresholds:', err);
  }
}

/**
 * Synthesize an elegant, non-intrusive security alert chime using Web Audio API
 */
export function playAlertChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (D5 ~ 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone higher chime (A5 ~ 880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch (e) {
    // Non-fatal if browser audio permissions block auto-play
    console.debug('Audio chime playback omitted or blocked:', e);
  }
}

/**
 * Request browser desktop notification permissions
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Dispatch desktop notification if supported and granted
 */
export function sendDesktopNotification(title: string, options?: NotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (Notification.permission === 'granted') {
    try {
      return new Notification(title, {
        icon: '/img/icon-48px.png',
        badge: '/img/icon-48px.png',
        ...options,
      });
    } catch (e) {
      console.warn('Could not launch system notification:', e);
    }
  }
  return null;
}

/**
 * Evaluate 24-hour window spikes across audit records against configured threshold
 */
export function evaluateSpikeBreaches(
  records: LinkAuditRecord[],
  thresholds: ThreatNotificationThresholds,
  lang: string = 'en'
): {
  breaches: SpikeThresholdBreach[];
  hasActiveRecentBreach: boolean;
  recentBreach: SpikeThresholdBreach | null;
  totalThreatsInScope: number;
} {
  if (!thresholds.enabled) {
    return {
      breaches: [],
      hasActiveRecentBreach: false,
      recentBreach: null,
      totalThreatsInScope: 0,
    };
  }

  const dayMs = 86400000;
  const now = Date.now();
  const todayEnd = new Date().setHours(23, 59, 59, 999);
  const thirtyDaysAgo = todayEnd - 30 * dayMs;

  // Filter 30-day records
  const recentRecords = records.filter(r => r && r.clickedAt >= thirtyDaysAgo);

  // Group into daily 24h buckets
  const dayBuckets = new Map<string, {
    date: string;
    fullDate: string;
    timestamp: number;
    threatCount: number;
    highThreats: number;
    mediumThreats: number;
    aborted: number;
  }>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayEnd - i * dayMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const displayDate = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    const fullDate = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    dayBuckets.set(key, {
      date: displayDate,
      fullDate,
      timestamp: d.getTime(),
      threatCount: 0,
      highThreats: 0,
      mediumThreats: 0,
      aborted: 0,
    });
  }

  let totalThreatsInScope = 0;

  for (const r of recentRecords) {
    const d = new Date(r.clickedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;

    const score = r.score ?? 0;
    const isCritical = score >= 50 || r.verdict === 'MALICIOUS';
    const isMedium = (score >= 20 && score < 50) || r.verdict === 'SUSPICIOUS';
    const isAborted = r.outcome === 'ABORTED';

    if (isCritical) bucket.highThreats += 1;
    if (isMedium) bucket.mediumThreats += 1;
    if (isAborted) bucket.aborted += 1;

    // Check if counts under selected basis
    let matchesBasis = false;
    if (thresholds.metricBasis === 'critical_only') {
      matchesBasis = isCritical;
    } else if (thresholds.metricBasis === 'blocked_only') {
      matchesBasis = isAborted;
    } else {
      // all_threats
      matchesBasis = isCritical || isMedium || isAborted;
    }

    if (matchesBasis) {
      bucket.threatCount += 1;
      totalThreatsInScope += 1;
    }
  }

  const breaches: SpikeThresholdBreach[] = [];
  const limit = thresholds.spikeCountThreshold;

  dayBuckets.forEach(bucket => {
    if (bucket.threatCount >= limit) {
      // Check if this occurred within the recent 24-48 hours relative to current time
      const hoursAgo = Math.abs(now - bucket.timestamp) / 3600000;
      const isRecent24h = hoursAgo <= 36; // Within recent rolling 24-36h window

      breaches.push({
        date: bucket.date,
        fullDate: bucket.fullDate,
        timestamp: bucket.timestamp,
        threatCount: bucket.threatCount,
        highThreats: bucket.highThreats,
        mediumThreats: bucket.mediumThreats,
        aborted: bucket.aborted,
        threshold: limit,
        excess: bucket.threatCount - limit,
        isRecent24h,
      });
    }
  });

  // Sort descending by timestamp
  breaches.sort((a, b) => b.timestamp - a.timestamp);

  const recentBreach = breaches.find(b => b.isRecent24h) || (breaches.length > 0 ? breaches[0] : null);
  const hasActiveRecentBreach = breaches.some(b => b.isRecent24h);

  return {
    breaches,
    hasActiveRecentBreach,
    recentBreach,
    totalThreatsInScope,
  };
}
