/* The review/export UI does not navigate to logged URLs or contact providers. */
const AuditExport = (() => {
    const fields = ['id', 'clickedAt', 'decidedAt', 'outcome', 'url', 'score', 'scoreSource', 'scoreAtDecision', 'verdict', 'verdictAtDecision', 'providerAtDecision', 'provider', 'messageId', 'cancelReason', 'openAttempts', 'extensionVersion', 'scoredAt', 'checkedAt', 'reasons', 'providerReasons', 'reasonDetails'];
    function csvCell(value) {
        let text = value == null ? '' : Array.isArray(value) ? JSON.stringify(value) : String(value);
        // Spreadsheet formula injection includes leading spaces/control characters.
        if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
        return '"' + text.replaceAll('"', '""') + '"';
    }
    function csv(records) {
        return '\ufeff' + fields.join(',') + '\r\n' + records.map(record => fields.map(field => csvCell(['clickedAt', 'decidedAt', 'scoredAt', 'checkedAt'].includes(field) && record[field] != null ? new Date(record[field]).toISOString() : record[field])).join(',')).join('\r\n');
    }
    async function json(records, metadata, cryptoApi = crypto) {
        const payload = { schemaVersion: 1, exportedAt: new Date().toISOString(), ...metadata, records };
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
        const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
        return JSON.stringify({ payload, sha256 }, null, 2);
    }
    function filter(records, options) {
        const query = (options.query || '').toLowerCase();
        const from = options.from ? new Date(options.from + 'T00:00:00').getTime() : -Infinity;
        const to = options.to ? new Date(options.to + 'T23:59:59.999').getTime() : Infinity;
        return records.filter(record => (!options.outcome || record.outcome === options.outcome) && (!query || record.url.toLowerCase().includes(query)) &&
            (options.minScore === '' || options.minScore == null || (Number.isFinite(record.score) && record.score >= Number(options.minScore))) && record.clickedAt >= from && record.clickedAt <= to);
    }
    const riskyOpened = record => record.outcome === 'OPENED' && ((Number.isFinite(record.scoreAtDecision) && record.scoreAtDecision >= 50) || /MALICIOUS|SUSPICIOUS/.test(record.verdictAtDecision || ''));
    return { csv, json, filter, riskyOpened };
})();

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    const t = key => ThundyI18n.get(key);
    const $ = id => document.getElementById(id);
    let records = [], snapshot = null, page = 0;
    const pageSize = 50;
    const decisionKeys = { OPENED: 'auditOpened', ABORTED: 'auditAborted', OPEN_ERROR: 'auditOpenError', PENDING: 'auditPending' };
    const verdictLabel = value => {
        if (!value) return t('auditUnavailable');
        const keys = { CLEAN: 'providerNoDetection', MALICIOUS: 'providerMalicious', MALICIOUS_VISUAL: 'providerMalicious', SUSPICIOUS: 'providerSuspicious', PENDING: 'providerPending', UNKNOWN: 'providerUnknown', ERROR: 'providerUnknown', NOT_CHECKED: 'providerUnknown' };
        return Object.hasOwn(keys, value) ? t(keys[value]) : String(value);
    };
    const selected = () => AuditExport.filter(records, { query: $('auditSearch').value, outcome: $('auditOutcome').value, minScore: $('auditMinScore').value, from: $('auditFrom').value, to: $('auditTo').value });
    const date = value => value == null ? '—' : new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
    const node = (tag, value, className = '') => { const element = document.createElement(tag); element.textContent = value; element.className = className; return element; };
    function render() {
        const filtered = selected(); page = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
        $('auditRows').replaceChildren(); $('auditSummary').replaceChildren();
        for (const [outcome, key] of Object.entries(decisionKeys)) $('auditSummary').appendChild(node('div', t(key) + ': ' + records.filter(record => record.outcome === outcome).length, 'card'));
        $('auditSummary').appendChild(node('div', t('auditRiskyOpened') + ': ' + records.filter(AuditExport.riskyOpened).length, 'card'));
        $('auditCount').textContent = t('auditRecords') + ': ' + filtered.length + ' / ' + records.length;
        for (const record of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
            const row = document.createElement('tr');
            if (AuditExport.riskyOpened(record)) row.className = 'audit-risky';
            const time = document.createElement('td'); time.append(node('div', date(record.clickedAt)), node('small', date(record.decidedAt)));
            const decision = node('td', t(decisionKeys[record.outcome] || 'auditPending')); decision.className = 'audit-' + record.outcome.toLowerCase();
            const score = document.createElement('td'); score.append(node('div', record.score == null ? t('auditUnavailable') : record.score + ' / 100'), node('small', t('auditScoreAtDecision') + ': ' + (record.scoreAtDecision == null ? t('auditUnavailable') : record.scoreAtDecision)));
            const verdict = document.createElement('td'); verdict.append(node('div', t('auditVerdictAtDecision') + ': ' + verdictLabel(record.verdictAtDecision)), node('small', !record.providerAtDecision || record.providerAtDecision === 'none' ? t('auditUnavailable') : record.providerAtDecision));
            const address = document.createElement('td');
            let domain; try { domain = new URL(record.url).host; } catch (error) { domain = '—'; }
            address.appendChild(node('strong', domain));
            const details = document.createElement('details'); details.append(node('summary', t('auditDetails')), node('code', record.url));
            details.append(node('p', t('auditEventId') + ': ' + record.id));
            if (record.cancelReason) details.append(node('p', t('auditCancelReason') + ': ' + record.cancelReason));
            if (record.checkedAt) details.append(node('p', t('auditFinalResult') + ': ' + verdictLabel(record.verdict) + ' · ' + date(record.checkedAt)));
            const reasons = document.createElement('ul');
            for (const reason of [...(record.reasons || []), ...(record.providerReasons || [])]) reasons.appendChild(node('li', reason));
            details.appendChild(reasons); address.appendChild(details); row.append(time, decision, score, verdict, address); $('auditRows').appendChild(row);
        }
        $('auditPage').textContent = (page + 1) + ' / ' + Math.max(1, Math.ceil(filtered.length / pageSize));
        $('auditPrevious').disabled = page === 0; $('auditNext').disabled = (page + 1) * pageSize >= filtered.length;
        $('auditJson').disabled = !snapshot; $('auditCsv').disabled = !snapshot;
    }
    async function refresh() {
        $('auditStatus').textContent = t('linkChecking');
        try {
            const data = await browser.runtime.sendMessage({ action: 'getLinkAudit' });
            if (!data || !data.success) throw new Error('Cannot read audit');
            records = data.records; snapshot = data; render();
            $('auditStatus').textContent = t('auditProfile') + ': ' + data.profileId;
        } catch (error) { snapshot = null; render(); $('auditStatus').textContent = t('auditFailure'); }
    }
    async function download(format) {
        if (!snapshot) return;
        const data = selected().map(record => ({ ...record }));
        try {
            const content = format === 'json' ? await AuditExport.json(data, { profileId: snapshot.profileId, extensionVersion: browser.runtime.getManifest().version, retentionDays: snapshot.retentionDays, maxRecords: snapshot.maxRecords, filters: { query: $('auditSearch').value, outcome: $('auditOutcome').value, minScore: $('auditMinScore').value, from: $('auditFrom').value, to: $('auditTo').value } }) : AuditExport.csv(data);
            const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' }));
            try { await browser.downloads.download({ url, filename: 'thundy-link-audit-' + new Date().toISOString().slice(0, 10) + '.' + format, saveAs: true }); }
            finally { URL.revokeObjectURL(url); }
            $('auditStatus').textContent = t('auditExported');
        } catch (error) { $('auditStatus').textContent = t('auditExportFailed'); }
    }
    $('auditFilters').addEventListener('submit', event => event.preventDefault());
    $('auditFilters').addEventListener('input', () => { page = 0; render(); });
    $('auditRefresh').addEventListener('click', refresh);
    $('auditJson').addEventListener('click', () => download('json')); $('auditCsv').addEventListener('click', () => download('csv'));
    $('auditPrevious').addEventListener('click', () => { page--; render(); }); $('auditNext').addEventListener('click', () => { page++; render(); });
    $('auditClear').addEventListener('click', () => $('auditConfirm').showModal());
    $('auditKeep').addEventListener('click', () => $('auditConfirm').close());
    $('auditDelete').addEventListener('click', async () => {
        try { const result = await browser.runtime.sendMessage({ action: 'clearLinkAudit' }); if (!result || !result.success) throw new Error('Cannot clear audit'); $('auditConfirm').close(); await refresh(); }
        catch (error) { $('auditStatus').textContent = t('auditFailure'); }
    });
    refresh();
});
