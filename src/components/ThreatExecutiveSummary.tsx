import React, { useState, useMemo } from 'react';
import { LinkAuditRecord, Language } from '../types';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, Crosshair, 
  Target, TrendingUp, Award, CheckCircle2, XCircle, 
  ChevronRight, Info, ExternalLink, Zap, Layers, BarChart2,
  FileText, Activity
} from 'lucide-react';

interface ThreatExecutiveSummaryProps {
  records: LinkAuditRecord[];
  lang: Language;
  onNavigateToThreats?: () => void;
  onFilterThreatVector?: (vectorName: string) => void;
}

export interface ClassifiedThreatVector {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
  avgScore: number;
  severity: 'high' | 'medium' | 'low';
  color: string;
  badgeBg: string;
  targetedBrands: string[];
  sampleReasons: string[];
  records: LinkAuditRecord[];
}

/**
 * Classify a threat audit record into a high-level cyber attack vector
 */
function classifyRecordVector(r: LinkAuditRecord): {
  id: string;
  name: string;
  description: string;
  brand?: string;
  severity: 'high' | 'medium' | 'low';
  color: string;
  badgeBg: string;
} {
  const urlLower = (r.url || '').toLowerCase();
  const reasonsText = (r.reasons || []).join(' ').toLowerCase();
  const senderLower = (r.sender || '').toLowerCase();

  // 1. Brand Impersonation & Typosquatting
  if (
    reasonsText.includes('typosquatting') ||
    reasonsText.includes('brand spoofing') ||
    reasonsText.includes('levenshtein') ||
    reasonsText.includes('impersonat') ||
    reasonsText.includes('resembles') ||
    reasonsText.includes('spoofed-brand') ||
    senderLower.includes('paypal') && !urlLower.includes('paypal.com') ||
    senderLower.includes('sparkasse') && !urlLower.includes('sparkasse.de')
  ) {
    let brand = 'Corporate Identity';
    if (reasonsText.includes('paypal') || urlLower.includes('paypa') || senderLower.includes('paypal')) brand = 'PayPal';
    else if (reasonsText.includes('sparkasse') || urlLower.includes('sparkasse')) brand = 'Sparkasse';
    else if (reasonsText.includes('office') || reasonsText.includes('microsoft') || urlLower.includes('microsoft') || urlLower.includes('o365')) brand = 'Microsoft 365';
    else if (reasonsText.includes('dhl') || urlLower.includes('dhl')) brand = 'DHL Logistics';

    return {
      id: 'brand_impersonation',
      name: 'Brand Impersonation & Typosquatting',
      description: 'Deceptive domain spoofing resembling reputable brands to manipulate trust.',
      brand,
      severity: 'high',
      color: 'var(--color-danger)',
      badgeBg: 'var(--alert-error-bg)',
    };
  }

  // 2. Package & Delivery Logistics Phishing
  if (
    reasonsText.includes('package') ||
    reasonsText.includes('dhl') ||
    reasonsText.includes('paket') ||
    urlLower.includes('tracking') ||
    urlLower.includes('paket') ||
    urlLower.includes('express') ||
    reasonsText.includes('tracking domain')
  ) {
    return {
      id: 'package_phishing',
      name: 'Package & Logistics Delivery Phishing',
      description: 'Fake parcel tracking and delivery fee notifications soliciting credentials or payments.',
      brand: 'DHL / Postal Express',
      severity: 'high',
      color: '#ea580c',
      badgeBg: 'rgba(234, 88, 12, 0.12)',
    };
  }

  // 3. Credential Harvesting & Phishing Kits
  if (
    reasonsText.includes('credential harvester') ||
    reasonsText.includes('phishing kit') ||
    reasonsText.includes('credential') ||
    urlLower.includes('login') ||
    urlLower.includes('auth') ||
    urlLower.includes('tan') ||
    urlLower.includes('confirm')
  ) {
    return {
      id: 'credential_harvesting',
      name: 'Credential Harvesting & Phishing Kits',
      description: 'Weaponized portals designed to capture passwords, 2FA TAN tokens, and session keys.',
      brand: 'Auth Portals',
      severity: 'high',
      color: '#dc2626',
      badgeBg: 'rgba(220, 38, 38, 0.12)',
    };
  }

  // 4. Business Email Compromise (BEC) & Invoice Urgency
  if (
    reasonsText.includes('bec') ||
    reasonsText.includes('urgency') ||
    reasonsText.includes('invoice') ||
    urlLower.includes('invoice') ||
    urlLower.includes('payment') ||
    senderLower.includes('billing')
  ) {
    return {
      id: 'bec_urgency',
      name: 'Business Email Compromise (BEC) & Invoice Fraud',
      description: 'Urgency-driven financial deceit and fake invoice downloads bypassing static content filters.',
      brand: 'Accounts Payable',
      severity: 'medium',
      color: 'var(--color-warning)',
      badgeBg: 'var(--warning-bg)',
    };
  }

  // 5. Malicious Redirects & Link Tracking Exploitation
  if (
    reasonsText.includes('redirect target') ||
    reasonsText.includes('tracking link') ||
    reasonsText.includes('untrusted tracking') ||
    urlLower.includes('redirect')
  ) {
    return {
      id: 'redirect_tracking',
      name: 'Suspicious Redirects & Tracking Abuse',
      description: 'Open redirectors and unverified ad-tracking endpoints obscuring ultimate destination.',
      severity: 'medium',
      color: '#d97706',
      badgeBg: 'rgba(217, 119, 6, 0.12)',
    };
  }

  // 6. Blacklisted / Malicious Infrastructure
  if (
    reasonsText.includes('urlhaus') ||
    reasonsText.includes('virustotal') ||
    reasonsText.includes('critical threat') ||
    r.verdict === 'MALICIOUS'
  ) {
    return {
      id: 'blacklisted_domain',
      name: 'Blacklisted & Malicious Infrastructure',
      description: 'Domains and hosts flagged on global intelligence blacklists (URLhaus / VirusTotal).',
      severity: 'high',
      color: '#b91c1c',
      badgeBg: 'rgba(185, 28, 28, 0.12)',
    };
  }

  // 7. Identity & Auth Spoofing
  if (
    reasonsText.includes('reply-to mismatch') ||
    reasonsText.includes('auth failure') ||
    reasonsText.includes('first communication')
  ) {
    return {
      id: 'identity_spoofing',
      name: 'Sender Identity Mismatch & Header Spoofing',
      description: 'Discrepancies in envelope sender, reply-to routing, and SPF/DKIM authentication.',
      severity: 'medium',
      color: '#8b5cf6',
      badgeBg: 'rgba(139, 92, 246, 0.12)',
    };
  }

  return {
    id: 'heuristic_anomaly',
    name: 'Behavioral & Heuristic Anomaly',
    description: 'Unusual patterns identified by local privacy-preserving heuristic evaluation.',
    severity: 'low',
    color: 'var(--link-color)',
    badgeBg: 'var(--accent-soft)',
  };
}

export const ThreatExecutiveSummary: React.FC<ThreatExecutiveSummaryProps> = ({
  records,
  lang,
  onNavigateToThreats,
  onFilterThreatVector,
}) => {
  const [showDetailedVectors, setShowDetailedVectors] = useState(false);
  const [selectedVectorId, setSelectedVectorId] = useState<string | null>(null);

  // Time horizon: 30 days
  const dayMs = 86400000;
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * dayMs;

  const dateRangeDisplay = useMemo(() => {
    const start = new Date(thirtyDaysAgo);
    const end = new Date(now);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const locale = lang === 'de' ? 'de-DE' : 'en-US';
    return `${start.toLocaleDateString(locale, options)} – ${end.toLocaleDateString(locale, options)}`;
  }, [thirtyDaysAgo, now, lang]);

  // Scanned links in the 30-day window
  const recentScannedRecords = useMemo(() => {
    return records.filter(r => r && r.clickedAt >= thirtyDaysAgo);
  }, [records, thirtyDaysAgo]);

  // Detected threats in the 30-day window
  const threats30d = useMemo(() => {
    return recentScannedRecords.filter(
      r => (r.score ?? 0) >= 20 || r.verdict === 'MALICIOUS' || r.verdict === 'SUSPICIOUS' || r.outcome === 'ABORTED'
    );
  }, [recentScannedRecords]);

  // 1. Key Metric: Total Threats
  const totalThreats = threats30d.length;
  const highSeverityThreats = useMemo(() => {
    return threats30d.filter(r => (r.score ?? 0) >= 50 || r.verdict === 'MALICIOUS').length;
  }, [threats30d]);

  const mediumSeverityThreats = useMemo(() => {
    return threats30d.filter(
      r => ((r.score ?? 0) >= 20 && (r.score ?? 0) < 50 && r.verdict !== 'MALICIOUS') || 
           (r.verdict === 'SUSPICIOUS' && (r.score ?? 0) < 50)
    ).length;
  }, [threats30d]);

  const abortedCount = useMemo(() => {
    return threats30d.filter(r => r.outcome === 'ABORTED').length;
  }, [threats30d]);

  const blockRate = totalThreats > 0 ? Math.round((abortedCount / totalThreats) * 100) : 100;

  // 2. Key Metric: Average Threat Score
  const avgThreatScore = useMemo(() => {
    if (threats30d.length === 0) return 0;
    const sum = threats30d.reduce((acc, r) => acc + (r.score ?? 0), 0);
    return Number((sum / threats30d.length).toFixed(1));
  }, [threats30d]);

  const maxThreatScore = useMemo(() => {
    if (threats30d.length === 0) return 0;
    return Math.max(...threats30d.map(r => r.score ?? 0));
  }, [threats30d]);

  // 3. Key Metric: Classified Threat Vectors & Most Common Vector
  const vectorSummary = useMemo(() => {
    const vectorMap = new Map<string, ClassifiedThreatVector>();

    for (const threat of threats30d) {
      const classification = classifyRecordVector(threat);
      const existing = vectorMap.get(classification.id);

      if (existing) {
        existing.count += 1;
        existing.records.push(threat);
        if (classification.brand && !existing.targetedBrands.includes(classification.brand)) {
          existing.targetedBrands.push(classification.brand);
        }
        for (const reason of (threat.reasons || [])) {
          if (!existing.sampleReasons.includes(reason) && existing.sampleReasons.length < 4) {
            existing.sampleReasons.push(reason);
          }
        }
      } else {
        vectorMap.set(classification.id, {
          id: classification.id,
          name: classification.name,
          description: classification.description,
          count: 1,
          percentage: 0,
          avgScore: 0,
          severity: classification.severity,
          color: classification.color,
          badgeBg: classification.badgeBg,
          targetedBrands: classification.brand ? [classification.brand] : [],
          sampleReasons: (threat.reasons || []).slice(0, 3),
          records: [threat],
        });
      }
    }

    const vectors = Array.from(vectorMap.values()).map(v => {
      const sumScore = v.records.reduce((acc, r) => acc + (r.score ?? 0), 0);
      return {
        ...v,
        percentage: totalThreats > 0 ? Number(((v.count / totalThreats) * 100).toFixed(1)) : 0,
        avgScore: v.records.length > 0 ? Number((sumScore / v.records.length).toFixed(1)) : 0,
      };
    });

    // Sort descending by incident count, then avg score
    vectors.sort((a, b) => b.count - a.count || b.avgScore - a.avgScore);

    return {
      vectors,
      mostCommon: vectors.length > 0 ? vectors[0] : null,
    };
  }, [threats30d, totalThreats]);

  const mostCommonVector = vectorSummary.mostCommon;

  // Risk Rating Level
  const riskPosture = useMemo(() => {
    if (totalThreats === 0) {
      return {
        label: 'Nominal Baseline',
        color: 'var(--color-success)',
        bg: 'var(--success-bg)',
        icon: ShieldCheck,
        description: 'Zero malicious or suspicious links intercepted in the last 30 days.'
      };
    }
    if (avgThreatScore >= 70 || highSeverityThreats >= 5) {
      return {
        label: 'High Threat Vigilance',
        color: 'var(--color-danger)',
        bg: 'var(--alert-error-bg)',
        icon: ShieldAlert,
        description: 'Active phishing campaigns and deceptive brand lures targeting incoming correspondence.'
      };
    }
    if (avgThreatScore >= 40 || mediumSeverityThreats >= 2) {
      return {
        label: 'Elevated Threat Surface',
        color: 'var(--color-warning)',
        bg: 'var(--warning-bg)',
        icon: AlertTriangle,
        description: 'Suspicious delivery tracking and unverified links detected and neutralized.'
      };
    }
    return {
      label: 'Low Risk Landscape',
      color: 'var(--link-color)',
      bg: 'var(--accent-soft)',
      icon: Activity,
      description: 'Occasional low-confidence heuristics flagged with no high-severity breaches.'
    };
  }, [totalThreats, avgThreatScore, highSeverityThreats, mediumSeverityThreats]);

  const RiskIcon = riskPosture.icon;

  return (
    <div className="thundy-card threat-executive-summary" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Executive Card Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid var(--card-border)',
        paddingBottom: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(200, 16, 46, 0.12), rgba(200, 16, 46, 0.04))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-danger)',
            border: '1px solid rgba(200, 16, 46, 0.25)',
            boxShadow: '0 2px 8px rgba(200, 16, 46, 0.1)'
          }}>
            <Target size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 750, color: 'var(--text-color)' }}>
                Threat Executive Summary
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--input-bg)',
                color: 'var(--text-muted)',
                border: '1px solid var(--card-border)'
              }}>
                30-Day Window
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Consolidated intelligence and threat posture calculated from local link inspection logs ({dateRangeDisplay})
            </p>
          </div>
        </div>

        {/* Risk Posture Pill & Navigation Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: riskPosture.bg,
            color: riskPosture.color,
            fontSize: '12px',
            fontWeight: 700,
            border: `1px solid ${riskPosture.color}40`
          }}>
            <RiskIcon size={16} />
            <span>{riskPosture.label}</span>
          </div>

          {onNavigateToThreats && (
            <button
              type="button"
              onClick={onNavigateToThreats}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '6px 12px',
                cursor: 'pointer'
              }}
              title="Navigate to raw threat history table"
            >
              <span>View Threat Records</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Primary Key Metrics Grid (Total Threats, Average Threat Score, Most Common Vector, Defense Rate) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Metric 1: Total Threats */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Threats Detected
              </span>
              <ShieldAlert size={18} style={{ color: 'var(--color-danger)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: totalThreats > 0 ? 'var(--color-danger)' : 'var(--color-success)', lineHeight: 1 }}>
                {totalThreats}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                incidents / 30d
              </span>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--card-border)', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Critical / High (≥50):</span>
              <strong>{highSeverityThreats}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Medium / Suspicious:</span>
              <strong>{mediumSeverityThreats}</strong>
            </div>
          </div>
        </div>

        {/* Metric 2: Average Threat Score */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Average Threat Score
              </span>
              <Activity size={18} style={{ color: avgThreatScore >= 50 ? 'var(--color-danger)' : avgThreatScore >= 20 ? 'var(--color-warning)' : 'var(--color-success)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 800,
                color: avgThreatScore >= 50 ? 'var(--color-danger)' : avgThreatScore >= 20 ? 'var(--color-warning)' : 'var(--color-success)',
                lineHeight: 1
              }}>
                {avgThreatScore}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                / 100
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                marginLeft: 'auto',
                padding: '2px 8px',
                borderRadius: '6px',
                background: avgThreatScore >= 50 ? 'var(--alert-error-bg)' : avgThreatScore >= 20 ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: avgThreatScore >= 50 ? 'var(--color-danger)' : avgThreatScore >= 20 ? 'var(--color-warning)' : 'var(--color-success)'
              }}>
                {avgThreatScore >= 50 ? 'Severe' : avgThreatScore >= 20 ? 'Elevated' : 'Nominal'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--card-border)' }}>
            {/* Visual Risk Spectrum Bar */}
            <div style={{ height: '6px', width: '100%', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden', position: 'relative', marginBottom: '6px' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, avgThreatScore))}%`,
                background: avgThreatScore >= 50 ? 'var(--color-danger)' : avgThreatScore >= 20 ? 'var(--color-warning)' : 'var(--color-success)',
                borderRadius: '3px',
                transition: 'width 0.4s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Peak: <strong>{maxThreatScore}/100</strong></span>
              <span>Baseline: <strong>0-100 scale</strong></span>
            </div>
          </div>
        </div>

        {/* Metric 3: Most Common Threat Vector */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Most Common Threat Vector
              </span>
              <Crosshair size={18} style={{ color: mostCommonVector ? mostCommonVector.color : 'var(--color-success)' }} />
            </div>
            <div style={{ marginBottom: '6px' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: 750,
                color: mostCommonVector ? 'var(--text-color)' : 'var(--color-success)',
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {mostCommonVector ? mostCommonVector.name : 'No Threat Vectors (Clean)'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--card-border)', fontSize: '12px' }}>
            {mostCommonVector ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Frequency:</span>
                  <strong>{mostCommonVector.count} incidents ({mostCommonVector.percentage}% of threats)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Primary Target:</span>
                  <strong style={{ color: mostCommonVector.color }}>{mostCommonVector.targetedBrands[0] || 'Direct User'}</strong>
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>No attack patterns recorded</span>
            )}
          </div>
        </div>

        {/* Metric 4: Defense & Interception Efficacy */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '12px',
          padding: '16px 18px',
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Interception & Block Rate
              </span>
              <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-success)', lineHeight: 1 }}>
                {blockRate}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                neutralized
              </span>
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--card-border)', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pre-Click Aborts:</span>
              <strong style={{ color: 'var(--color-success)' }}>{abortedCount} blocked</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>30d Scanned Volume:</span>
              <strong>{recentScannedRecords.length} links inspected</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Vector Distribution Breakdown & Intelligence Bar */}
      {vectorSummary.vectors.length > 0 && (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--link-color)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-color)' }}>
                30-Day Threat Vector Distribution
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({vectorSummary.vectors.length} distinct attack patterns identified)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowDetailedVectors(!showDetailedVectors)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--link-color)',
                fontSize: '12px',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px'
              }}
            >
              <span>{showDetailedVectors ? 'Hide Technical Details' : 'View Vector Breakdown'}</span>
              <ChevronRight size={14} style={{ transform: showDetailedVectors ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
          </div>

          {/* Proportional Vector Stacked Bar */}
          <div style={{
            display: 'flex',
            height: '12px',
            width: '100%',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: 'var(--input-bg)',
            marginBottom: '12px',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
          }}>
            {vectorSummary.vectors.map((vec) => (
              <div
                key={vec.id}
                style={{
                  width: `${vec.percentage}%`,
                  backgroundColor: vec.color,
                  transition: 'width 0.3s ease',
                  cursor: 'pointer'
                }}
                title={`${vec.name}: ${vec.count} incidents (${vec.percentage}%)`}
                onClick={() => setSelectedVectorId(selectedVectorId === vec.id ? null : vec.id)}
              />
            ))}
          </div>

          {/* Interactive Vector Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {vectorSummary.vectors.map((vec) => {
              const isSelected = selectedVectorId === vec.id;
              return (
                <button
                  key={vec.id}
                  type="button"
                  onClick={() => setSelectedVectorId(isSelected ? null : vec.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: isSelected ? vec.color : vec.badgeBg,
                    color: isSelected ? '#ffffff' : vec.color,
                    border: `1px solid ${vec.color}40`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isSelected ? '#ffffff' : vec.color
                  }} />
                  <span>{vec.name}</span>
                  <strong style={{ marginLeft: '4px' }}>
                    {vec.count} ({vec.percentage}%)
                  </strong>
                </button>
              );
            })}
          </div>

          {/* Expanded Vector Details / Evidence Drawer */}
          {(showDetailedVectors || selectedVectorId) && (
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--card-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {vectorSummary.vectors
                .filter(v => !selectedVectorId || v.id === selectedVectorId)
                .map(vec => (
                  <div
                    key={vec.id}
                    style={{
                      padding: '12px',
                      background: 'var(--input-bg)',
                      borderRadius: '8px',
                      border: `1px solid ${vec.color}30`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-color)' }}>{vec.name}</strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: vec.badgeBg,
                        color: vec.color
                      }}>
                        Avg Score: {vec.avgScore}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {vec.description}
                    </p>

                    {vec.targetedBrands.length > 0 && (
                      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Targeted: </span>
                        <strong style={{ color: 'var(--text-color)' }}>{vec.targetedBrands.join(', ')}</strong>
                      </div>
                    )}

                    {vec.sampleReasons.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600 }}>Observed Heuristics:</span>
                        {vec.sampleReasons.map((reason, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '4px' }}>
                            <span style={{ color: vec.color }}>•</span>
                            <span style={{ fontStyle: 'italic' }}>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Executive Key Finding Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        background: 'var(--accent-soft)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--link-color)',
        border: '1px solid rgba(0, 82, 204, 0.15)'
      }}>
        <Info size={16} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, lineHeight: 1.4 }}>
          <strong>Executive Assessment: </strong>
          {totalThreats > 0 ? (
            <span>
              Over the last 30 days, <strong>{totalThreats} total threats</strong> were detected with an average score of <strong>{avgThreatScore}/100</strong>. The predominant threat vector is <strong>{mostCommonVector?.name}</strong> accounting for {mostCommonVector?.percentage}% of attacks, with a <strong>{blockRate}% pre-click neutralization rate</strong> preserving system integrity.
            </span>
          ) : (
            <span>
              All {recentScannedRecords.length} inspected links in the 30-day monitoring window conformed to safety heuristics with no threat anomalies detected.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
