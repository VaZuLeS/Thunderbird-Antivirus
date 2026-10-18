import React, { useState, useMemo } from 'react';
import { LinkAuditRecord, Language } from '../types';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, Search, Filter, 
  ChevronLeft, ChevronRight, Mail, Globe, CheckCircle2, XCircle,
  Calendar, RotateCcw, X, Download, FileSpreadsheet
} from 'lucide-react';

interface RawThreatHistoryTableProps {
  records: LinkAuditRecord[];
  lang: Language;
  onInspectUrl?: (url: string) => void;
}

export type ThreatLevelFilter = 'all' | 'high' | 'medium' | 'low';

export const RawThreatHistoryTable: React.FC<RawThreatHistoryTableProps> = ({
  records,
  lang,
  onInspectUrl
}) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<ThreatLevelFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  // Helper to categorize any audit record into threat level
  const getThreatCategory = (r: LinkAuditRecord): 'high' | 'medium' | 'low' => {
    const score = r.score ?? 0;
    if (score >= 50 || r.verdict === 'MALICIOUS') return 'high';
    if (score >= 20 || r.verdict === 'SUSPICIOUS') return 'medium';
    return 'low';
  };

  // Counts by threat level across all records
  const countsByLevel = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const r of records) {
      const cat = getThreatCategory(r);
      if (cat === 'high') high++;
      else if (cat === 'medium') medium++;
      else low++;
    }

    return {
      all: records.length,
      high,
      medium,
      low,
      threatsTotal: high + medium
    };
  }, [records]);

  // Quick date presets
  const applyDatePreset = (preset: '24h' | '7d' | '30d' | 'all') => {
    setPage(1);
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    const now = new Date();
    const toStr = now.toISOString().split('T')[0];
    setToDate(toStr);

    const past = new Date();
    if (preset === '24h') {
      past.setDate(now.getDate() - 1);
    } else if (preset === '7d') {
      past.setDate(now.getDate() - 7);
    } else if (preset === '30d') {
      past.setDate(now.getDate() - 30);
    }
    setFromDate(past.toISOString().split('T')[0]);
  };

  const handleResetFilters = () => {
    setSearch('');
    setLevelFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || levelFilter !== 'all' || fromDate !== '' || toDate !== '';

  // Filtered threat events
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const cat = getThreatCategory(r);

      // Threat Level filter
      if (levelFilter !== 'all' && cat !== levelFilter) {
        return false;
      }

      // Date range filter
      if (fromDate) {
        const fromTs = new Date(fromDate + 'T00:00:00').getTime();
        if (r.clickedAt < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate + 'T23:59:59.999').getTime();
        if (r.clickedAt > toTs) return false;
      }

      // Search query filter (Sender, Source, URL, reasons)
      if (search) {
        const query = search.toLowerCase();
        const matchesUrl = r.url?.toLowerCase().includes(query);
        const matchesSender = r.sender?.toLowerCase().includes(query);
        const matchesSource = r.source?.toLowerCase().includes(query) || r.messageId?.toLowerCase().includes(query);
        const matchesReasons = r.reasons?.some(reason => reason.toLowerCase().includes(query));
        if (!matchesUrl && !matchesSender && !matchesSource && !matchesReasons) {
          return false;
        }
      }

      return true;
    });
  }, [records, levelFilter, fromDate, toDate, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedThreats = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Relative time helper
  const getRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // CSV Export for Raw Threat History (both filtered records and paginated page)
  const handleExportCsv = (scope: 'filtered' | 'page' = 'filtered') => {
    const dataset = scope === 'page' ? paginatedThreats : filteredRecords;
    if (dataset.length === 0) return;

    const headers = [
      'Timestamp (ISO)',
      'Date',
      'Time',
      'Threat Level',
      'Threat Score',
      'Sender',
      'Source / Message ID',
      'Destination URL',
      'Verdict',
      'Indicators & Detection Heuristics',
      'Outcome',
      'Provider'
    ];

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = dataset.map(threat => {
      const d = new Date(threat.clickedAt);
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cat = getThreatCategory(threat);
      const threatLevelStr = cat === 'high' ? 'High' : cat === 'medium' ? 'Medium' : 'Low';
      const reasonsStr = threat.reasons?.join('; ') || 'None';

      return [
        escapeCsv(d.toISOString()),
        escapeCsv(dateStr),
        escapeCsv(timeStr),
        escapeCsv(threatLevelStr),
        threat.score ?? 0,
        escapeCsv(threat.sender || 'Unknown Sender'),
        escapeCsv(threat.source || (threat.messageId ? `Message ID: ${threat.messageId}` : 'Mail Client')),
        escapeCsv(threat.url),
        escapeCsv(threat.verdict),
        escapeCsv(reasonsStr),
        escapeCsv(threat.outcome === 'ABORTED' ? 'Blocked' : threat.outcome),
        escapeCsv(threat.provider)
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateFormatted = new Date().toISOString().split('T')[0];
    const filename = scope === 'page'
      ? `thundy-threat-history-page-${currentPage}-${dateFormatted}.csv`
      : `thundy-threat-history-${levelFilter !== 'all' ? `${levelFilter}-` : ''}${dateFormatted}.csv`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setExportMessage(
      scope === 'page'
        ? `Exported page ${currentPage} (${dataset.length} threats) to CSV`
        : `Exported ${dataset.length} threat records to CSV`
    );
    setTimeout(() => {
      setExportSuccess(false);
      setExportMessage('');
    }, 4000);
  };

  return (
    <div className="thundy-card raw-threat-history-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* 1. Header & Title Bar */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--alert-error-bg)',
              color: 'var(--color-danger)',
              padding: '6px 10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <ShieldAlert size={18} />
              <strong style={{ fontSize: '13px' }}>Raw Threat History</strong>
            </div>
            <span className="thundy-badge danger" style={{ fontSize: '12px' }}>
              {countsByLevel.threatsTotal} High/Medium Threats
            </span>
            <span className="thundy-badge info" style={{ fontSize: '12px' }}>
              {countsByLevel.all} Total Records
            </span>
            {exportSuccess && (
              <span className="thundy-badge success" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} />
                <span>{exportMessage}</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* CSV Export Buttons for Offline Record-Keeping */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleExportCsv('filtered')}
                disabled={filteredRecords.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  padding: '5px 11px',
                  minHeight: '32px'
                }}
                title="Export all matching threat history records based on current filters to CSV"
              >
                <FileSpreadsheet size={14} />
                <span>Export Threats CSV ({filteredRecords.length})</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleExportCsv('page')}
                disabled={paginatedThreats.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  padding: '5px 10px',
                  minHeight: '32px'
                }}
                title={`Export current page ${currentPage} (${paginatedThreats.length} rows) to CSV`}
              >
                <Download size={13} />
                <span>Page {currentPage} CSV</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--card-border)', paddingLeft: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{ minHeight: '30px', padding: '2px 8px', fontSize: '12px' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Comprehensive Filtering UI Panel */}
        <div style={{
          background: 'var(--input-bg)',
          borderRadius: '10px',
          border: '1px solid var(--card-border)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Filter Row 1: Search & Date Range Presets */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 260px', position: 'relative' }}>
              <input
                type="text"
                placeholder="Search sender, source, destination URL, or heuristics..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: '100%', fontSize: '13px', paddingLeft: '32px' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>

            {/* Quick date preset buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} />
                Quick Range:
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => applyDatePreset('24h')}
                style={{ minHeight: '30px', padding: '3px 9px', fontSize: '11px' }}
              >
                Last 24h
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => applyDatePreset('7d')}
                style={{ minHeight: '30px', padding: '3px 9px', fontSize: '11px' }}
              >
                Last 7d
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => applyDatePreset('30d')}
                style={{ minHeight: '30px', padding: '3px 9px', fontSize: '11px' }}
              >
                Last 30d
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => applyDatePreset('all')}
                style={{ minHeight: '30px', padding: '3px 9px', fontSize: '11px' }}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Filter Row 2: Threat Level (Low, Medium, High) & Custom Date Range */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Threat Level Filter Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={13} />
                Threat Level:
              </span>
              <div style={{ display: 'flex', background: 'var(--card-bg)', borderRadius: '8px', padding: '3px', border: '1px solid var(--input-border)' }}>
                <button
                  type="button"
                  onClick={() => { setLevelFilter('all'); setPage(1); }}
                  style={{
                    background: levelFilter === 'all' ? 'var(--btn-primary-bg)' : 'transparent',
                    color: levelFilter === 'all' ? 'var(--btn-primary-text)' : 'var(--text-color)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  All ({countsByLevel.all})
                </button>

                <button
                  type="button"
                  onClick={() => { setLevelFilter('high'); setPage(1); }}
                  style={{
                    background: levelFilter === 'high' ? 'var(--btn-danger-bg)' : 'transparent',
                    color: levelFilter === 'high' ? '#fff' : 'var(--color-danger)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ShieldAlert size={12} />
                  High ({countsByLevel.high})
                </button>

                <button
                  type="button"
                  onClick={() => { setLevelFilter('medium'); setPage(1); }}
                  style={{
                    background: levelFilter === 'medium' ? 'var(--warning-bg)' : 'transparent',
                    color: levelFilter === 'medium' ? 'var(--color-warning)' : 'var(--color-warning)',
                    border: levelFilter === 'medium' ? '1px solid var(--color-warning)' : 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertTriangle size={12} />
                  Medium ({countsByLevel.medium})
                </button>

                <button
                  type="button"
                  onClick={() => { setLevelFilter('low'); setPage(1); }}
                  style={{
                    background: levelFilter === 'low' ? 'var(--success-bg)' : 'transparent',
                    color: levelFilter === 'low' ? 'var(--color-success)' : 'var(--color-success)',
                    border: levelFilter === 'low' ? '1px solid var(--color-success)' : 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ShieldCheck size={12} />
                  Low ({countsByLevel.low})
                </button>
              </div>
            </div>

            {/* Custom Date Range Filter (From / To) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} />
                Date Range:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '12px' }}
                  />
                </label>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                    style={{ minHeight: '30px', padding: '2px 8px', fontSize: '12px' }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Filter Row 3: Active Filters Summary & Reset Button */}
          {hasActiveFilters && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid var(--card-border)',
              paddingTop: '8px',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active filters:</span>
                {levelFilter !== 'all' && (
                  <span className={`thundy-badge ${levelFilter === 'high' ? 'danger' : levelFilter === 'medium' ? 'warning' : 'success'}`} style={{ fontSize: '11px' }}>
                    Level: {levelFilter.toUpperCase()}
                  </span>
                )}
                {(fromDate || toDate) && (
                  <span className="thundy-badge info" style={{ fontSize: '11px' }}>
                    {fromDate ? `From: ${fromDate}` : ''} {toDate ? `To: ${toDate}` : ''}
                  </span>
                )}
                {search && (
                  <span className="thundy-badge info" style={{ fontSize: '11px' }}>
                    Query: "{search}"
                  </span>
                )}
                <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-color)', marginLeft: '4px' }}>
                  ({filteredRecords.length} match{filteredRecords.length === 1 ? '' : 'es'})
                </span>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetFilters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  minHeight: '26px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--color-danger)'
                }}
              >
                <RotateCcw size={12} />
                <span>Reset Filters</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Table of Threat History */}
      <div className="thundy-table-container" style={{ border: 'none', borderRadius: 0 }}>
        <table className="thundy-table">
          <thead>
            <tr>
              <th style={{ width: '160px' }}>Timestamp</th>
              <th style={{ width: '150px' }}>Threat Level</th>
              <th style={{ width: '240px' }}>Source / Sender</th>
              <th>Destination URL & Indicators</th>
              <th style={{ width: '130px' }}>Verdict</th>
              <th style={{ width: '110px' }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {paginatedThreats.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={32} style={{ color: 'var(--color-success)' }} />
                    <strong style={{ fontSize: '14px', color: 'var(--text-color)' }}>No threat records match your filters</strong>
                    <span style={{ fontSize: '12px' }}>Try adjusting your threat level selection or date range criteria.</span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleResetFilters}
                        style={{ marginTop: '8px', fontSize: '12px', padding: '4px 12px' }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedThreats.map(threat => {
                const score = threat.score ?? 0;
                const cat = getThreatCategory(threat);
                const isHigh = cat === 'high';
                const isMedium = cat === 'medium';
                const isLow = cat === 'low';

                return (
                  <tr key={threat.id} style={{ background: isHigh ? 'rgba(179, 38, 66, 0.03)' : isMedium ? 'rgba(146, 81, 13, 0.02)' : undefined }}>
                    {/* 1. Timestamp */}
                    <td style={{ verticalAlign: 'top', fontSize: '12px' }}>
                      <strong style={{ display: 'block', color: 'var(--text-color)' }}>
                        {new Date(threat.clickedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(threat.clickedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <div style={{ marginTop: '2px' }}>
                        <span className="thundy-badge info" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {getRelativeTime(threat.clickedAt)}
                        </span>
                      </div>
                    </td>

                    {/* 2. Threat Level (High / Medium / Low) */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
                        <span className={`thundy-badge ${isHigh ? 'danger' : isMedium ? 'warning' : 'success'}`} style={{ fontWeight: 750 }}>
                          {isHigh ? <ShieldAlert size={13} /> : isMedium ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
                          <span>{isHigh ? 'High Risk' : isMedium ? 'Medium Risk' : 'Low Risk'}</span>
                        </span>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: isHigh ? 'var(--color-danger)' : isMedium ? 'var(--color-warning)' : 'var(--color-success)',
                          paddingLeft: '2px'
                        }}>
                          Score: {score} / 100
                        </div>
                      </div>
                    </td>

                    {/* 3. Source / Sender Information */}
                    <td style={{ verticalAlign: 'top', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <Mail size={14} style={{ color: 'var(--link-color)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <strong style={{ display: 'block', wordBreak: 'break-all', color: 'var(--text-color)' }}>
                            {threat.sender || 'Unknown Sender'}
                          </strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', wordBreak: 'break-all' }}>
                            {threat.source || `Message ID: ${threat.messageId}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 4. Target Destination & Heuristics */}
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                        <Globe size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                        <code style={{ fontSize: '12px', color: 'var(--link-color)', wordBreak: 'break-all' }}>
                          {threat.url}
                        </code>
                      </div>

                      {/* Reasons & Heuristics Breakdown */}
                      {threat.reasons && threat.reasons.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {threat.reasons.map((reason, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isHigh ? 'var(--alert-error-bg)' : isMedium ? 'var(--warning-bg)' : 'var(--success-bg)',
                                color: isHigh ? 'var(--color-danger)' : isMedium ? 'var(--color-warning)' : 'var(--color-success)',
                                border: '1px solid currentColor',
                                opacity: 0.95
                              }}
                            >
                              • {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* 5. Verdict & Provider */}
                    <td style={{ verticalAlign: 'top', fontSize: '12px' }}>
                      <span className={`thundy-badge ${threat.verdict === 'MALICIOUS' ? 'danger' : threat.verdict === 'SUSPICIOUS' ? 'warning' : 'success'}`}>
                        {threat.verdict}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                        via {threat.provider}
                      </span>
                    </td>

                    {/* 6. Outcome */}
                    <td style={{ verticalAlign: 'top' }}>
                      <span className={`thundy-badge ${threat.outcome === 'ABORTED' ? 'warning' : threat.outcome === 'OPENED' ? 'success' : 'danger'}`}>
                        {threat.outcome === 'ABORTED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{threat.outcome === 'ABORTED' ? 'Blocked' : threat.outcome}</span>
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        borderTop: '1px solid var(--card-border)',
        background: 'var(--card-bg)',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(filteredRecords.length, currentPage * pageSize)} of {filteredRecords.length} records
          {hasActiveFilters && ` (filtered from ${records.length} total)`}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleExportCsv('page')}
            disabled={paginatedThreats.length === 0}
            style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}
            title={`Export page ${currentPage} as CSV`}
          >
            <Download size={13} />
            <span>Export Page CSV</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '12px', fontWeight: 650, padding: '0 8px' }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            className="btn-secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
