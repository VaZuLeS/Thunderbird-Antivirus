import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { LinkAuditRecord, Language, ThreatNotificationThresholds } from '../types';
import { 
  ShieldAlert, TrendingUp, BarChart2, ShieldCheck, Activity, 
  FileDown, CheckCircle2, Zap, Flame, AlertTriangle, Info,
  Bell, BellRing, BellOff, Sliders, Volume2, X
} from 'lucide-react';
import { generateCompliancePdfReport } from '../lib/pdfReportGenerator';
import { getNotificationThresholds, evaluateSpikeBreaches } from '../lib/thresholdStorage';
import { ThreatThresholdModal } from './ThreatThresholdModal';

interface ThreatActivityChartProps {
  records: LinkAuditRecord[];
  lang: Language;
}

type ViewMode = 'severity' | 'decisions';

export interface SpikeAnnotation {
  date: string;
  fullDate: string;
  threats: number;
  highThreats: number;
  mediumThreats: number;
  aborted: number;
  isGlobalPeak: boolean;
  pctAboveAvg: number;
  label: string;
  type: 'peak' | 'surge';
}

export const ThreatActivityChart: React.FC<ThreatActivityChartProps> = ({ records, lang }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('severity');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedSpikeDate, setSelectedSpikeDate] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [thresholds, setThresholds] = useState<ThreatNotificationThresholds>(getNotificationThresholds);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Sync thresholds across windows / storage updates
  React.useEffect(() => {
    const handleThresholdsUpdated = (e: any) => {
      if (e.detail) {
        setThresholds(e.detail);
        setIsAlertDismissed(false);
      }
    };
    window.addEventListener('thundy_thresholds_updated', handleThresholdsUpdated);
    return () => window.removeEventListener('thundy_thresholds_updated', handleThresholdsUpdated);
  }, []);

  // Compute 24-hour threshold breaches
  const breachEval = useMemo(() => {
    return evaluateSpikeBreaches(records, thresholds, lang);
  }, [records, thresholds, lang]);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const svgEl = chartContainerRef.current?.querySelector('svg') || null;
      await generateCompliancePdfReport({
        records,
        lang,
        chartSvgElement: svgEl,
      });
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to export compliance PDF report', e);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Compute 30-day timeline data & Trend Analysis Annotations
  const { chartData, metrics, detectedSpikes } = useMemo(() => {
    const dayMs = 86400000;
    const now = new Date();
    // Normalize to start of today
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const thirtyDaysAgo = todayEnd - 30 * dayMs;

    // Filter records within last 30 days
    const recentRecords = records.filter(r => r && r.clickedAt >= thirtyDaysAgo);

    // Map each day
    const dayBuckets = new Map<string, {
      date: string;
      fullDate: string;
      timestamp: number;
      highThreats: number;
      mediumThreats: number;
      safeLinks: number;
      aborted: number;
      opened: number;
      total: number;
    }>();

    // Initialize all 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayEnd - i * dayMs);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const displayDate = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });
      dayBuckets.set(key, {
        date: displayDate,
        fullDate: d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        timestamp: d.getTime(),
        highThreats: 0,
        mediumThreats: 0,
        safeLinks: 0,
        aborted: 0,
        opened: 0,
        total: 0,
      });
    }

    // Populate with records
    let totalHigh = 0;
    let totalMedium = 0;
    let totalSafe = 0;
    let totalAborted = 0;
    let totalOpened = 0;

    for (const r of recentRecords) {
      const d = new Date(r.clickedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const bucket = dayBuckets.get(key);
      if (bucket) {
        bucket.total += 1;
        const score = r.score ?? 0;
        if (score >= 50 || r.verdict === 'MALICIOUS') {
          bucket.highThreats += 1;
          totalHigh += 1;
        } else if (score >= 20 || r.verdict === 'SUSPICIOUS') {
          bucket.mediumThreats += 1;
          totalMedium += 1;
        } else {
          bucket.safeLinks += 1;
          totalSafe += 1;
        }

        if (r.outcome === 'ABORTED') {
          bucket.aborted += 1;
          totalAborted += 1;
        } else if (r.outcome === 'OPENED') {
          bucket.opened += 1;
          totalOpened += 1;
        }
      }
    }

    const data = Array.from(dayBuckets.values());

    // Compute Threat Values per day based on active viewMode
    const getThreatCount = (d: typeof data[0]) => {
      return viewMode === 'severity'
        ? (d.highThreats + d.mediumThreats)
        : d.aborted;
    };

    const totalThreats = data.reduce((sum, d) => sum + getThreatCount(d), 0);
    const avgThreats = totalThreats / 30;

    // Calculate Variance and Standard Deviation
    const variance = data.reduce((acc, d) => acc + Math.pow(getThreatCount(d) - avgThreats, 2), 0) / 30;
    const stdDev = Math.sqrt(variance);

    // Find Global Maximum Peak Day
    let maxVal = 0;
    let peakDay = data[0];
    for (const d of data) {
      const v = getThreatCount(d);
      if (v > maxVal) {
        maxVal = v;
        peakDay = d;
      }
    }

    // Spike Detection Threshold:
    // A point is a significant spike if count >= 2 and exceeds (mean + 1.2 * stdDev) or (1.8 * mean)
    const spikeThreshold = Math.max(avgThreats + 1.2 * stdDev, avgThreats * 1.8, 2);

    const spikes: SpikeAnnotation[] = [];

    if (maxVal > 0) {
      // 1. Register Global Peak(s)
      data.forEach((d) => {
        const v = getThreatCount(d);
        if (v === maxVal) {
          const pctAbove = avgThreats > 0 ? Math.round(((v - avgThreats) / avgThreats) * 100) : 100;
          spikes.push({
            date: d.date,
            fullDate: d.fullDate,
            threats: v,
            highThreats: d.highThreats,
            mediumThreats: d.mediumThreats,
            aborted: d.aborted,
            isGlobalPeak: true,
            pctAboveAvg: pctAbove,
            label: `🚨 Peak: ${v}`,
            type: 'peak'
          });
        }
      });

      // 2. Register Secondary Outbreak Surges (local maxima or significant deviations below global max)
      data.forEach((d, idx) => {
        const v = getThreatCount(d);
        if (v < maxVal && v >= spikeThreshold && v >= 2) {
          const prev = data[idx - 1] ? getThreatCount(data[idx - 1]) : 0;
          const next = data[idx + 1] ? getThreatCount(data[idx + 1]) : 0;
          // Must be a local maximum / inflection surge
          if (v >= prev && v >= next) {
            const pctAbove = avgThreats > 0 ? Math.round(((v - avgThreats) / avgThreats) * 100) : 100;
            spikes.push({
              date: d.date,
              fullDate: d.fullDate,
              threats: v,
              highThreats: d.highThreats,
              mediumThreats: d.mediumThreats,
              aborted: d.aborted,
              isGlobalPeak: false,
              pctAboveAvg: pctAbove,
              label: `⚠️ Surge: ${v}`,
              type: 'surge'
            });
          }
        }
      });
    }

    const totalScanned = recentRecords.length;
    const blockRate = totalScanned > 0 ? Math.round((totalAborted / totalScanned) * 100) : 0;
    const peakPctAboveAvg = avgThreats > 0 ? Math.round(((maxVal - avgThreats) / avgThreats) * 100) : 0;

    return {
      chartData: data,
      detectedSpikes: spikes,
      metrics: {
        totalScanned,
        totalHigh,
        totalMedium,
        totalSafe,
        totalAborted,
        totalOpened,
        blockRate,
        peakDayDate: maxVal > 0 ? peakDay.date : 'None',
        peakDayFullDate: maxVal > 0 ? peakDay.fullDate : 'None',
        peakDayCount: maxVal,
        peakPctAboveAvg,
        avgThreats,
        maxDailyThreats: maxVal,
      }
    };
  }, [records, lang, viewMode]);

  // Custom Tooltip with Trend Spike Badge
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      const matchingSpike = detectedSpikes.find(s => s.date === dataPoint?.date);

      return (
        <div style={{
          background: 'var(--card-bg)',
          color: 'var(--text-color)',
          border: '1px solid var(--card-border)',
          borderRadius: '8px',
          padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          fontSize: '12px',
          minWidth: '200px'
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, borderBottom: '1px solid var(--card-border)', paddingBottom: '4px' }}>
            {dataPoint?.fullDate || label}
          </p>

          {/* Trend Spike Annotation Tag in Tooltip */}
          {matchingSpike && (
            <div style={{
              background: matchingSpike.isGlobalPeak ? 'rgba(179, 38, 66, 0.12)' : 'rgba(234, 88, 12, 0.12)',
              border: `1px solid ${matchingSpike.isGlobalPeak ? '#b32642' : '#ea580c'}`,
              borderRadius: '6px',
              padding: '4px 8px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 700,
              color: matchingSpike.isGlobalPeak ? '#b32642' : '#ea580c'
            }}>
              <span>{matchingSpike.isGlobalPeak ? '🚨 30-Day Peak Spike' : '⚠️ Detection Surge'}</span>
              <span>+{matchingSpike.pctAboveAvg}% vs avg</span>
            </div>
          )}

          {/* 24-Hour Threshold Breach Tag in Tooltip */}
          {thresholds.enabled && (() => {
            const breach = breachEval.breaches.find(b => b.date === dataPoint?.date);
            if (!breach) return null;
            return (
              <div style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid #f43f5e',
                borderRadius: '6px',
                padding: '4px 8px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 700,
                color: '#f43f5e'
              }}>
                <span>🚨 24h Threshold Breached</span>
                <span>{breach.threatCount} ≥ {thresholds.spikeCountThreshold}</span>
              </div>
            );
          })()}

          {viewMode === 'severity' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b32642', margin: '3px 0' }}>
                <span>Critical / High:</span>
                <strong>{dataPoint.highThreats}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706', margin: '3px 0' }}>
                <span>Elevated Risk:</span>
                <strong>{dataPoint.mediumThreats}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', margin: '3px 0' }}>
                <span>Safe Links:</span>
                <strong>{dataPoint.safeLinks}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', margin: '3px 0' }}>
                <span>Blocked / Aborted:</span>
                <strong>{dataPoint.aborted}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', margin: '3px 0' }}>
                <span>Opened:</span>
                <strong>{dataPoint.opened}</strong>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: '4px', marginTop: '4px', fontWeight: 700 }}>
            <span>Total Events:</span>
            <span>{dataPoint.total}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="thundy-card threat-activity-component" style={{ marginBottom: '24px' }}>
      {/* Title & Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'var(--alert-error-bg)',
            color: 'var(--color-danger)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 750, color: 'var(--text-color)' }}>
              Threat Activity Over Time
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              30-day link inspection trends & heuristic detections with spike detection
            </span>
          </div>
        </div>

        {/* View toggles & Annotation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Severity vs Decision toggle */}
          <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '8px', padding: '2px', border: '1px solid var(--input-border)' }}>
            <button
              type="button"
              onClick={() => setViewMode('severity')}
              style={{
                background: viewMode === 'severity' ? 'var(--btn-primary-bg)' : 'transparent',
                color: viewMode === 'severity' ? 'var(--btn-primary-text)' : 'var(--text-color)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                minHeight: '28px',
                cursor: 'pointer'
              }}
            >
              Severity Breakdown
            </button>
            <button
              type="button"
              onClick={() => setViewMode('decisions')}
              style={{
                background: viewMode === 'decisions' ? 'var(--btn-primary-bg)' : 'transparent',
                color: viewMode === 'decisions' ? 'var(--btn-primary-text)' : 'var(--text-color)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                minHeight: '28px',
                cursor: 'pointer'
              }}
            >
              Decisions (Blocked vs Opened)
            </button>
          </div>

          {/* Area vs Bar type toggle */}
          <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '8px', padding: '2px', border: '1px solid var(--input-border)' }}>
            <button
              type="button"
              onClick={() => setChartType('area')}
              title="Area trend chart"
              style={{
                background: chartType === 'area' ? 'var(--accent-soft)' : 'transparent',
                color: chartType === 'area' ? 'var(--link-color)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                minHeight: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <TrendingUp size={14} />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Bar chart view"
              style={{
                background: chartType === 'bar' ? 'var(--accent-soft)' : 'transparent',
                color: chartType === 'bar' ? 'var(--link-color)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '12px',
                minHeight: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <BarChart2 size={14} />
            </button>
          </div>

          {/* Trend Analysis Spikes Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAnnotations(!showAnnotations)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              minHeight: '28px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: showAnnotations ? 'var(--color-danger)' : 'var(--input-border)',
              background: showAnnotations ? 'rgba(179, 38, 66, 0.12)' : 'var(--input-bg)',
              color: showAnnotations ? 'var(--color-danger)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: showAnnotations ? 650 : 500,
              transition: 'all 0.15s ease'
            }}
            title="Toggle peak detection markers and trend baseline annotations"
          >
            <Zap size={14} />
            <span>Spike Annotations: {showAnnotations ? 'ON' : 'OFF'}</span>
            {detectedSpikes.length > 0 && (
              <span style={{
                background: showAnnotations ? 'var(--color-danger)' : 'var(--card-border)',
                color: '#fff',
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {detectedSpikes.length}
              </span>
            )}
          </button>

          {/* Notification Thresholds Config Button */}
          <button
            type="button"
            onClick={() => setIsThresholdModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '12px',
              minHeight: '28px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: thresholds.enabled && breachEval.breaches.length > 0
                ? 'var(--color-danger)'
                : thresholds.enabled
                ? 'var(--link-color)'
                : 'var(--input-border)',
              background: thresholds.enabled && breachEval.breaches.length > 0
                ? 'rgba(239, 68, 68, 0.12)'
                : thresholds.enabled
                ? 'var(--accent-soft)'
                : 'var(--input-bg)',
              color: thresholds.enabled && breachEval.breaches.length > 0
                ? 'var(--color-danger)'
                : thresholds.enabled
                ? 'var(--link-color)'
                : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
            title="Configure notification thresholds for 24-hour threat spikes"
          >
            {thresholds.enabled ? (
              breachEval.breaches.length > 0 ? (
                <BellRing size={14} style={{ color: 'var(--color-danger)' }} />
              ) : (
                <Bell size={14} style={{ color: 'var(--link-color)' }} />
              )
            ) : (
              <BellOff size={14} />
            )}
            <span>Threshold: {thresholds.enabled ? `≥${thresholds.spikeCountThreshold}/24h` : 'OFF'}</span>
            {thresholds.enabled && breachEval.breaches.length > 0 && (
              <span style={{
                background: 'var(--color-danger)',
                color: '#fff',
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '10px',
                fontWeight: 700,
              }}>
                {breachEval.breaches.length} {breachEval.hasActiveRecentBreach ? '🚨' : ''}
              </span>
            )}
          </button>

          {/* Compliance PDF Export Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              fontSize: '12px',
              minHeight: '32px'
            }}
          >
            {pdfSuccess ? <CheckCircle2 size={14} /> : <FileDown size={14} />}
            <span>{isExportingPdf ? 'Generating PDF...' : pdfSuccess ? 'PDF Downloaded' : 'Export Compliance PDF'}</span>
          </button>
        </div>
      </div>

      {/* 30-Day Highlight Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        marginBottom: '14px'
      }}>
        <div style={{ padding: '10px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total 30-Day Events</span>
          <strong style={{ fontSize: '18px' }}>{metrics.totalScanned}</strong>
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--alert-error-bg)', borderRadius: '8px', border: '1px solid var(--color-danger)' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-danger)', display: 'block', fontWeight: 650 }}>Critical Threats</span>
          <strong style={{ fontSize: '18px', color: 'var(--color-danger)' }}>{metrics.totalHigh}</strong>
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: '8px', border: '1px solid var(--color-warning)' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-warning)', display: 'block', fontWeight: 650 }}>Elevated Risk</span>
          <strong style={{ fontSize: '18px', color: 'var(--color-warning)' }}>{metrics.totalMedium}</strong>
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--success-bg)', borderRadius: '8px', border: '1px solid var(--color-success)' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-success)', display: 'block', fontWeight: 650 }}>Safe / Verified</span>
          <strong style={{ fontSize: '18px', color: 'var(--color-success)' }}>{metrics.totalSafe}</strong>
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Block / Abort Rate</span>
          <strong style={{ fontSize: '18px', color: 'var(--link-color)' }}>{metrics.blockRate}%</strong>
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Peak Activity Day</span>
          <strong style={{ fontSize: '14px', lineHeight: 1.6, color: metrics.peakDayCount > 0 ? 'var(--color-danger)' : 'var(--text-color)' }}>
            {metrics.peakDayDate} {metrics.peakDayCount > 0 && `(${metrics.peakDayCount})`}
          </strong>
        </div>
      </div>

      {/* 24-Hour Threat Spike Alert Banner */}
      {thresholds.enabled && thresholds.notifyInApp && breachEval.breaches.length > 0 && !isAlertDismissed && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid var(--color-danger)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '260px' }}>
            <div style={{
              background: 'var(--color-danger)',
              color: '#ffffff',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              marginTop: '2px',
            }}>
              <BellRing size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '13px', color: 'var(--color-danger)' }}>
                  24-Hour Threat Spike Threshold Alert
                </strong>
                <span style={{
                  background: 'var(--alert-error-bg)',
                  border: '1px solid var(--color-danger)',
                  color: 'var(--color-danger)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}>
                  Limit: ≥{thresholds.spikeCountThreshold} threats / 24h ({thresholds.metricBasis.replace('_', ' ')})
                </span>
                {breachEval.hasActiveRecentBreach && (
                  <span style={{
                    background: 'var(--color-danger)',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}>
                    Active Spike (Recent 24-48h)
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-color)' }}>
                {breachEval.breaches.length} daily window{breachEval.breaches.length > 1 ? 's' : ''} exceeded your threshold limit.
                {breachEval.recentBreach && (
                  <span>
                    {' '}Latest spike on <strong>{breachEval.recentBreach.fullDate}</strong> registered <strong>{breachEval.recentBreach.threatCount} threats</strong> (+{breachEval.recentBreach.excess} over threshold).
                  </span>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsThresholdModalOpen(true)}
              style={{
                background: 'var(--color-danger)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 650,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Sliders size={13} />
              <span>Adjust Threshold</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAlertDismissed(true)}
              title="Dismiss alert banner for this session"
              style={{
                background: 'transparent',
                border: '1px solid var(--input-border)',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Trend Analysis & Spike Intelligence Banner */}
      <div style={{
        background: detectedSpikes.length > 0 ? 'var(--input-bg)' : 'var(--input-bg)',
        border: '1px solid var(--card-border)',
        borderLeft: `4px solid ${detectedSpikes.length > 0 ? 'var(--color-danger)' : 'var(--color-success)'}`,
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {detectedSpikes.length > 0 ? (
              <Flame size={18} style={{ color: 'var(--color-danger)' }} />
            ) : (
              <ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />
            )}
            <strong style={{ fontSize: '13px', color: 'var(--text-color)' }}>
              {detectedSpikes.length > 0
                ? `Trend Analysis: ${detectedSpikes.length} Significant Threat Spike${detectedSpikes.length > 1 ? 's' : ''} Identified`
                : 'Trend Analysis: Nominal Baseline (No Threat Spikes Detected)'}
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>30-Day Avg Baseline: <strong style={{ color: 'var(--text-color)' }}>{metrics.avgThreats.toFixed(2)} threats/day</strong></span>
            <span>Max Velocity: <strong style={{ color: 'var(--color-danger)' }}>{metrics.maxDailyThreats} threats/day</strong></span>
          </div>
        </div>

        {detectedSpikes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>
              Peak Detections & Surges:
            </span>
            {detectedSpikes.map(spike => (
              <button
                key={spike.date}
                type="button"
                onClick={() => setSelectedSpikeDate(selectedSpikeDate === spike.date ? null : spike.date)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: selectedSpikeDate === spike.date
                    ? (spike.isGlobalPeak ? 'var(--color-danger)' : 'var(--color-warning)')
                    : (spike.isGlobalPeak ? 'var(--alert-error-bg)' : 'var(--warning-bg)'),
                  color: selectedSpikeDate === spike.date
                    ? '#ffffff'
                    : (spike.isGlobalPeak ? 'var(--color-danger)' : 'var(--color-warning)'),
                  border: `1px solid ${spike.isGlobalPeak ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={`Click to focus annotation for ${spike.fullDate}`}
              >
                <span>{spike.isGlobalPeak ? '🚨' : '⚠️'}</span>
                <span><strong>{spike.fullDate}</strong>: {spike.threats} threats (+{spike.pctAboveAvg}% vs avg)</span>
                <span style={{
                  fontSize: '9px',
                  background: selectedSpikeDate === spike.date ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {spike.isGlobalPeak ? 'Global Peak' : 'Surge'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Heuristic inspections reflect stable link traffic across mail sessions without anomalous bursts or coordinated threat waves.
          </div>
        )}
      </div>

      {/* Main Chart Canvas with Peak Detection Markers & Trend Baseline */}
      <div ref={chartContainerRef} style={{ width: '100%', height: 280, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={chartData} margin={{ top: 24, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#b32642" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#b32642" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorMed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorAborted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                interval={Math.floor(chartData.length / 7)}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[0, (dataMax: number) => Math.max(dataMax + (dataMax >= 5 ? 2 : 1), 2)]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
              />

              {viewMode === 'severity' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="highThreats"
                    name="Critical / High Risk"
                    stroke="#b32642"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHigh)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="mediumThreats"
                    name="Elevated Risk"
                    stroke="#d97706"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMed)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="safeLinks"
                    name="Safe / Verified"
                    stroke="#16a34a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSafe)"
                    stackId="1"
                  />
                </>
              ) : (
                <>
                  <Area
                    type="monotone"
                    dataKey="aborted"
                    name="Blocked / Aborted"
                    stroke="#dc2626"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAborted)"
                    stackId="2"
                  />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    name="Opened"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorOpened)"
                    stackId="2"
                  />
                </>
              )}

              {/* Trend Analysis Annotations (Baseline & Peak Detection Markers) */}
              {showAnnotations && metrics.avgThreats > 0 && (
                <ReferenceLine
                  y={Number(metrics.avgThreats.toFixed(2))}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Baseline Avg (${metrics.avgThreats.toFixed(1)}/day)`,
                    position: 'insideTopLeft',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              )}

              {/* 24-Hour Threat Spike Alert Threshold Reference Line */}
              {thresholds.enabled && (
                <ReferenceLine
                  y={thresholds.spikeCountThreshold}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Alert Threshold: ≥${thresholds.spikeCountThreshold}/24h`,
                    position: 'insideTopRight',
                    fill: '#f43f5e',
                    fontSize: 10,
                    fontWeight: 750,
                  }}
                />
              )}

              {showAnnotations && detectedSpikes.map(spike => (
                <ReferenceLine
                  key={`ref-line-${spike.date}`}
                  x={spike.date}
                  stroke={spike.isGlobalPeak ? '#b32642' : '#ea580c'}
                  strokeDasharray={selectedSpikeDate === spike.date ? '2 2' : '3 3'}
                  strokeWidth={selectedSpikeDate === spike.date ? 2.5 : 1.5}
                  opacity={0.85}
                />
              ))}

              {showAnnotations && detectedSpikes.map(spike => (
                <ReferenceDot
                  key={`ref-dot-${spike.date}`}
                  x={spike.date}
                  y={spike.threats}
                  r={selectedSpikeDate === spike.date ? 8 : 6}
                  fill={spike.isGlobalPeak ? '#b32642' : '#ea580c'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{
                    value: spike.isGlobalPeak ? `▲ Peak: ${spike.threats}` : `▲ Surge: ${spike.threats}`,
                    position: 'top',
                    fill: spike.isGlobalPeak ? '#b32642' : '#ea580c',
                    fontSize: 10,
                    fontWeight: 750,
                    offset: 8,
                  }}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 24, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                interval={Math.floor(chartData.length / 7)}
              />
              <YAxis
                allowDecimals={false}
                stroke="var(--text-muted)"
                fontSize={11}
                tickLine={false}
                domain={[0, (dataMax: number) => Math.max(dataMax + (dataMax >= 5 ? 2 : 1), 2)]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
              />

              {viewMode === 'severity' ? (
                <>
                  <Bar dataKey="highThreats" name="Critical / High Risk" fill="#b32642" stackId="s1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="mediumThreats" name="Elevated Risk" fill="#d97706" stackId="s1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="safeLinks" name="Safe / Verified" fill="#16a34a" stackId="s1" radius={[4, 4, 0, 0]} />
                </>
              ) : (
                <>
                  <Bar dataKey="aborted" name="Blocked / Aborted" fill="#dc2626" stackId="d1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="opened" name="Opened" fill="#2563eb" stackId="d1" radius={[4, 4, 0, 0]} />
                </>
              )}

              {/* Trend Analysis Annotations (Baseline & Peak Detection Markers) in Bar View */}
              {showAnnotations && metrics.avgThreats > 0 && (
                <ReferenceLine
                  y={Number(metrics.avgThreats.toFixed(2))}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Baseline Avg (${metrics.avgThreats.toFixed(1)}/day)`,
                    position: 'insideTopLeft',
                    fill: '#64748b',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
              )}

              {/* 24-Hour Threat Spike Alert Threshold Reference Line */}
              {thresholds.enabled && (
                <ReferenceLine
                  y={thresholds.spikeCountThreshold}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Alert Threshold: ≥${thresholds.spikeCountThreshold}/24h`,
                    position: 'insideTopRight',
                    fill: '#f43f5e',
                    fontSize: 10,
                    fontWeight: 750,
                  }}
                />
              )}

              {showAnnotations && detectedSpikes.map(spike => (
                <ReferenceLine
                  key={`ref-bar-line-${spike.date}`}
                  x={spike.date}
                  stroke={spike.isGlobalPeak ? '#b32642' : '#ea580c'}
                  strokeDasharray={selectedSpikeDate === spike.date ? '2 2' : '3 3'}
                  strokeWidth={selectedSpikeDate === spike.date ? 2.5 : 1.5}
                  opacity={0.85}
                />
              ))}

              {showAnnotations && detectedSpikes.map(spike => (
                <ReferenceDot
                  key={`ref-bar-dot-${spike.date}`}
                  x={spike.date}
                  y={spike.threats}
                  r={selectedSpikeDate === spike.date ? 8 : 6}
                  fill={spike.isGlobalPeak ? '#b32642' : '#ea580c'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{
                    value: spike.isGlobalPeak ? `▲ Peak: ${spike.threats}` : `▲ Surge: ${spike.threats}`,
                    position: 'top',
                    fill: spike.isGlobalPeak ? '#b32642' : '#ea580c',
                    fontSize: 10,
                    fontWeight: 750,
                    offset: 8,
                  }}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Threat Threshold Notification Configuration Modal */}
      <ThreatThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        records={records}
        lang={lang}
        onThresholdsUpdated={(updated) => {
          setThresholds(updated);
          setIsAlertDismissed(false);
        }}
      />
    </div>
  );
};

