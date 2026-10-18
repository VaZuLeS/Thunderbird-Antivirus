import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LinkAuditRecord, Language } from '../types';
import { getNotificationThresholds, evaluateSpikeBreaches } from './thresholdStorage';

interface GeneratePdfOptions {
  records: LinkAuditRecord[];
  lang: Language;
  chartSvgElement?: SVGSVGElement | null;
}

export async function generateCompliancePdfReport({ records, lang, chartSvgElement }: GeneratePdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const reportDateStr = now.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const fileDateStr = now.toISOString().split('T')[0];

  // Colors
  const primaryColor: [number, number, number] = [20, 107, 128]; // #146b80 (Ocean)
  const dangerColor: [number, number, number] = [179, 38, 66];   // #b32642
  const warningColor: [number, number, number] = [146, 81, 13];  // #92510d
  const successColor: [number, number, number] = [33, 99, 65];   // #216341
  const darkTextColor: [number, number, number] = [25, 43, 64];

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('THUNDY AV – COMPLIANCE & THREAT AUDIT REPORT', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Local-First Link Protection · Threat Trend Analysis · Verification Log', 14, 18);
  doc.text(`Generated: ${reportDateStr}`, 155, 18);

  const thresholds = getNotificationThresholds();
  const thresholdEval = evaluateSpikeBreaches(records, thresholds, lang);

  // 2. Compliance & Verification Metadata Box
  doc.setDrawColor(220, 227, 236);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 32, 182, 25, 2, 2, 'FD');

  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('AUDIT & COMPLIANCE METADATA', 18, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Add-on Version: 1.23.0 (Local Engine)    |    Scope: 30-Day Window    |    Audit Storage: Local Durable Log`, 18, 44);
  doc.text(`Alert Threshold: ${thresholds.enabled ? `≥${thresholds.spikeCountThreshold} threats/24h (${thresholdEval.breaches.length} spikes detected)` : 'Alerts Disabled'}    |    Scope Basis: ${thresholds.metricBasis.replace('_', ' ')}`, 18, 49);
  doc.text('Standard Alignment: ISO/IEC 27001 §A.12.4, NIS-2 & GDPR Art. 32 (Zero Telemetry, Local Processing)', 18, 54);

  // 3. Compute 30-day metrics
  const dayMs = 86400000;
  const thirtyDaysAgo = now.getTime() - 30 * dayMs;
  const recentRecords = records.filter(r => r && r.clickedAt >= thirtyDaysAgo);

  const totalScanned = recentRecords.length;
  const totalHigh = recentRecords.filter(r => (r.score ?? 0) >= 50 || r.verdict === 'MALICIOUS').length;
  const totalMedium = recentRecords.filter(r => (r.score ?? 0) >= 20 && (r.score ?? 0) < 50 && r.verdict !== 'MALICIOUS').length;
  const totalSafe = recentRecords.filter(r => (r.score ?? 0) < 20 && r.verdict !== 'MALICIOUS' && r.verdict !== 'SUSPICIOUS').length;
  const totalAborted = recentRecords.filter(r => r.outcome === 'ABORTED').length;
  const totalOpened = recentRecords.filter(r => r.outcome === 'OPENED').length;
  const blockRate = totalScanned > 0 ? Math.round((totalAborted / totalScanned) * 100) : 0;

  // 4. Executive Summary KPI Cards
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('30-DAY EXECUTIVE SUMMARY', 14, 62);

  const cardWidth = 42;
  const cardHeight = 18;
  const cardY = 66;

  // Card 1: Total Scanned
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(83, 101, 121);
  doc.text('TOTAL LINK SCANS', 18, cardY + 6);
  doc.setFontSize(13);
  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totalScanned), 18, cardY + 14);

  // Card 2: Critical Threats
  doc.setFillColor(255, 240, 243);
  doc.roundedRect(60, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...dangerColor);
  doc.text('CRITICAL THREATS', 64, cardY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totalHigh), 64, cardY + 14);

  // Card 3: Elevated Risk
  doc.setFillColor(255, 244, 229);
  doc.roundedRect(106, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...warningColor);
  doc.text('ELEVATED RISK', 110, cardY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(String(totalMedium), 110, cardY + 14);

  // Card 4: Intercept / Block Rate
  doc.setFillColor(235, 245, 239);
  doc.roundedRect(152, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setTextColor(...successColor);
  doc.text('INTERCEPT / BLOCK RATE', 156, cardY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${blockRate}% (${totalAborted} blocked)`, 156, cardY + 14);

  // Threat calculations
  const threats30dRecords = recentRecords.filter(
    r => (r.score ?? 0) >= 20 || r.verdict === 'MALICIOUS' || r.verdict === 'SUSPICIOUS' || r.outcome === 'ABORTED'
  );
  const avgThreatScore = threats30dRecords.length > 0 
    ? (threats30dRecords.reduce((sum, r) => sum + (r.score ?? 0), 0) / threats30dRecords.length).toFixed(1)
    : '0';

  const vectorCounts: Record<string, number> = {};
  for (const t of threats30dRecords) {
    const reasons = (t.reasons || []).join(' ').toLowerCase();
    const url = (t.url || '').toLowerCase();
    let v = 'Suspicious Link Heuristics';
    if (reasons.includes('typosquatting') || reasons.includes('brand spoofing') || reasons.includes('levenshtein') || reasons.includes('resembles')) {
      v = 'Brand Impersonation & Typosquatting';
    } else if (reasons.includes('package') || reasons.includes('dhl') || url.includes('tracking')) {
      v = 'Package Logistics Scam';
    } else if (reasons.includes('credential harvester') || reasons.includes('phishing kit') || url.includes('login') || url.includes('tan')) {
      v = 'Credential Harvesting Kit';
    } else if (reasons.includes('bec') || reasons.includes('urgency') || reasons.includes('invoice')) {
      v = 'BEC & Invoice Fraud';
    } else if (reasons.includes('redirect target') || reasons.includes('tracking link')) {
      v = 'Malicious Redirect Abuse';
    } else if (reasons.includes('urlhaus') || reasons.includes('virustotal')) {
      v = 'Blacklisted Malware Host';
    }
    vectorCounts[v] = (vectorCounts[v] || 0) + 1;
  }
  let topVectorName = 'None detected (Clean baseline)';
  let topVectorCount = 0;
  for (const [vName, count] of Object.entries(vectorCounts)) {
    if (count > topVectorCount) {
      topVectorCount = count;
      topVectorName = vName;
    }
  }

  // Executive Sub-summary Banner
  doc.setFillColor(240, 244, 250);
  doc.roundedRect(14, cardY + 20, 180, 7, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkTextColor);
  doc.text(
    `Executive Highlights: Threats: ${threats30dRecords.length}   |   Avg Score: ${avgThreatScore}/100   |   Vector: ${topVectorName} (${topVectorCount})   |   Threshold: ≥${thresholds.spikeCountThreshold}/24h (${thresholdEval.breaches.length} spikes)`,
    17,
    cardY + 24.5
  );

  let currentY = 96;

  // 5. Embed Chart Graphic if available
  if (chartSvgElement) {
    try {
      const svgString = new XMLSerializer().serializeToString(chartSvgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 420;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => {
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = blobURL;
      });

      const imgData = canvas.toDataURL('image/png');
      URLObj.revokeObjectURL(blobURL);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text('THREAT ACTIVITY OVER TIME (30-DAY VISUALIZATION)', 14, currentY);

      doc.addImage(imgData, 'PNG', 14, currentY + 3, 182, 54);
      currentY += 64;
    } catch (e) {
      console.warn('Could not rasterize chart SVG to PDF image:', e);
    }
  }

  // 6. Aggregate 30-Day Daily Activity Table
  const dayBuckets = new Map<string, {
    date: string;
    total: number;
    high: number;
    medium: number;
    safe: number;
    blocked: number;
    opened: number;
  }>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const dateKey = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    dayBuckets.set(dateKey, {
      date: displayDate,
      total: 0,
      high: 0,
      medium: 0,
      safe: 0,
      blocked: 0,
      opened: 0,
    });
  }

  for (const r of recentRecords) {
    const dateKey = new Date(r.clickedAt).toISOString().split('T')[0];
    const bucket = dayBuckets.get(dateKey);
    if (bucket) {
      bucket.total++;
      const score = r.score ?? 0;
      if (score >= 50 || r.verdict === 'MALICIOUS') bucket.high++;
      else if (score >= 20 || r.verdict === 'SUSPICIOUS') bucket.medium++;
      else bucket.safe++;

      if (r.outcome === 'ABORTED') bucket.blocked++;
      else if (r.outcome === 'OPENED') bucket.opened++;
    }
  }

  // Only include days with activity or sampled overview
  const activeDays = Array.from(dayBuckets.values()).filter(d => d.total > 0);

  if (activeDays.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text('DAILY ACTIVITY SUMMARY (DAYS WITH DETECTIONS)', 14, currentY);

    const dailyRows = activeDays.map(d => [
      d.date,
      String(d.total),
      String(d.high),
      String(d.medium),
      String(d.safe),
      String(d.blocked),
      String(d.opened),
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Date', 'Total Scans', 'Critical Threats', 'Elevated Risk', 'Safe Links', 'Blocked', 'Opened']],
      body: dailyRows,
      theme: 'grid',
      headStyles: { fillColor: [20, 107, 128], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page for detailed incident log
  if (currentY > 210) {
    doc.addPage();
    currentY = 20;
  }

  // 7. Recent High & Elevated Threat Incidents Log Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('NOTABLE THREAT DETECTIONS & BLOCKED INCIDENTS', 14, currentY);

  const threatRecords = recentRecords
    .filter(r => (r.score ?? 0) >= 20 || r.verdict === 'MALICIOUS' || r.outcome === 'ABORTED')
    .slice(0, 15);

  const incidentRows = threatRecords.map(r => {
    const timeStr = new Date(r.clickedAt).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const cleanUrl = r.url.length > 45 ? r.url.substring(0, 42) + '...' : r.url;
    const reasonsStr = r.reasons?.join(', ') || 'N/A';
    return [
      timeStr,
      cleanUrl,
      `${r.score ?? 0} / 100`,
      r.verdict,
      r.outcome,
      reasonsStr.length > 50 ? reasonsStr.substring(0, 48) + '...' : reasonsStr,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Time', 'Target Destination / URL', 'Score', 'Verdict', 'Decision', 'Detection Heuristics']],
    body: incidentRows.length > 0 ? incidentRows : [['None recorded', 'No high risk links detected in the period', '0', 'SAFE', 'OPENED', 'Clean']],
    theme: 'striped',
    headStyles: { fillColor: [179, 38, 66], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    margin: { left: 14, right: 14 },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 227, 236);
    doc.line(14, 285, 196, 285);
    doc.setFontSize(7.5);
    doc.setTextColor(130, 145, 160);
    doc.text('Thundy AV Compliance Report · Generated locally via client-side verification engine · Confidential', 14, 290);
    doc.text(`Page ${i} of ${totalPages}`, 180, 290);
  }

  // Trigger download
  doc.save(`thundy-av-compliance-report-${fileDateStr}.pdf`);
}
