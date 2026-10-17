import React, { useState, useEffect, useMemo } from 'react';
import { Language, LinkAuditRecord } from '../types';
import { t } from '../lib/i18n';
import { getAuditRecords, saveAuditRecords, clearAuditLog } from '../lib/auditStorage';
import { 
  FileText, Search, Download, Trash2, RefreshCw, 
  ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';

interface AuditViewProps {
  lang: Language;
}

export const AuditView: React.FC<AuditViewProps> = ({ lang }) => {
  const [records, setRecords] = useState<LinkAuditRecord[]>([]);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pageSize = 10;

  const loadData = () => {
    setRecords(getAuditRecords());
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter(r => {
      if (search && !r.url.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (outcomeFilter && r.outcome !== outcomeFilter) {
        return false;
      }
      if (minScore && (r.score === null || r.score < Number(minScore))) {
        return false;
      }
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (r.clickedAt < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime() + 86400000;
        if (r.clickedAt > toTs) return false;
      }
      return true;
    });
  }, [records, search, outcomeFilter, minScore, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Export JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thundy-link-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['ID', 'ClickTime', 'DecisionTime', 'URL', 'Outcome', 'Score', 'Verdict', 'Provider'];
    const rows = filtered.map(r => [
      r.id,
      new Date(r.clickedAt).toISOString(),
      r.decidedAt ? new Date(r.decidedAt).toISOString() : '',
      `"${r.url.replace(/"/g, '""')}"`,
      r.outcome,
      r.score ?? '',
      r.verdict,
      r.provider,
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thundy-link-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearAuditLog();
    loadData();
    setShowClearConfirm(false);
  };

  return (
    <div className="audit-view">
      {/* Overview header */}
      <div className="thundy-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <FileText size={24} style={{ color: 'var(--link-color)' }} />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 750 }}>
            {t(lang, 'auditTitle')}
          </h2>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {t(lang, 'auditScope')}
        </p>
        <div style={{ padding: '8px 12px', background: 'var(--accent-soft)', color: 'var(--link-color)', borderRadius: '8px', fontSize: '12px' }}>
          🛡️ {t(lang, 'auditPrivacy')}
        </div>

        {/* Quick stats pills */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <div style={{ padding: '8px 14px', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Total Decisions:</span>
            <strong>{records.length}</strong>
          </div>
          <div style={{ padding: '8px 14px', background: 'var(--success-bg)', color: 'var(--color-success)', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ marginRight: '6px' }}>Opened:</span>
            <strong>{records.filter(r => r.outcome === 'OPENED').length}</strong>
          </div>
          <div style={{ padding: '8px 14px', background: 'var(--warning-bg)', color: 'var(--color-warning)', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ marginRight: '6px' }}>Aborted / Blocked:</span>
            <strong>{records.filter(r => r.outcome === 'ABORTED').length}</strong>
          </div>
          <div style={{ padding: '8px 14px', background: 'var(--alert-error-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '13px' }}>
            <span style={{ marginRight: '6px' }}>High Risk (≥50):</span>
            <strong>{records.filter(r => (r.score || 0) >= 50).length}</strong>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="thundy-card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
              {t(lang, 'auditSearch')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="https://..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
              {t(lang, 'auditOutcome')}
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            >
              <option value="">{t(lang, 'auditAll')}</option>
              <option value="OPENED">{t(lang, 'auditOpened')}</option>
              <option value="ABORTED">{t(lang, 'auditAborted')}</option>
              <option value="OPEN_ERROR">{t(lang, 'auditOpenError')}</option>
              <option value="PENDING">{t(lang, 'auditPending')}</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
              {t(lang, 'auditMinScore')}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 50"
              value={minScore}
              onChange={(e) => { setMinScore(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
              {t(lang, 'auditFrom')}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 650, marginBottom: '4px' }}>
              {t(lang, 'auditTo')}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} />
              <span>{t(lang, 'auditRefresh')}</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={handleExportJson}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>{t(lang, 'auditJson')}</span>
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportCsv}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>{t(lang, 'auditCsv')}</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-danger"
            onClick={() => setShowClearConfirm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={14} />
            <span>{t(lang, 'auditClear')}</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="thundy-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="thundy-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="thundy-table">
            <thead>
              <tr>
                <th>{t(lang, 'auditTime')}</th>
                <th>{t(lang, 'auditOutcome')}</th>
                <th>{t(lang, 'auditLocalScore')}</th>
                <th>{t(lang, 'auditVerdict')}</th>
                <th>{t(lang, 'auditAddress')}</th>
              </tr>
            </thead>
            <tbody>
              {currentRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    No audit records match the current filters.
                  </td>
                </tr>
              ) : (
                currentRecords.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {new Date(r.clickedAt).toLocaleString()}
                    </td>
                    <td>
                      <span className={`thundy-badge ${
                        r.outcome === 'OPENED' ? 'success' :
                        r.outcome === 'ABORTED' ? 'warning' : 'danger'
                      }`}>
                        {r.outcome === 'OPENED' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        <span>{r.outcome}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`thundy-badge ${
                        (r.score ?? 0) >= 50 ? 'danger' :
                        (r.score ?? 0) >= 20 ? 'warning' : 'success'
                      }`}>
                        {r.score ?? '—'} / 100
                      </span>
                    </td>
                    <td>
                      <span className="thundy-badge info">
                        {r.verdict} ({r.provider})
                      </span>
                    </td>
                    <td>
                      <div style={{ wordBreak: 'break-all' }}>
                        <code style={{ fontSize: '12px', color: 'var(--link-color)' }}>{r.url}</code>
                      </div>
                      {r.reasons && r.reasons.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {r.reasons.join(' · ')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(filtered.length, page * pageSize)} of {filtered.length} entries
          </span>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <ChevronLeft size={14} />
              <span>{t(lang, 'auditPrevious')}</span>
            </button>

            <span style={{ fontSize: '13px', fontWeight: 650, padding: '0 8px' }}>
              {page} / {totalPages}
            </span>

            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>{t(lang, 'auditNext')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Log */}
      {showClearConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-danger)', marginBottom: '12px' }}>
              <AlertCircle size={28} />
              <h3 style={{ margin: 0, fontSize: '17px' }}>Confirm Deletion</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-color)', marginBottom: '20px' }}>
              {t(lang, 'auditClearConfirm')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleClear}
              >
                {t(lang, 'auditClear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
