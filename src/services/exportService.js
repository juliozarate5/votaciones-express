const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatDateTime } = require('../utils/dates');

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Prioridad: si hay total final, usa finales; si no, usa en vivo.
 */
function toOfficialReport(summary) {
  const rows = (summary.rows || []).map((row) => {
    const useFinal = Number(row.totalReports || 0) > 0 || Number(row.totalVotes || 0) > 0;

    if (useFinal) {
      return {
        reporterName: row.reporterName,
        women: row.totalWomen || 0,
        men: row.totalMen || 0,
        total: row.totalVotes || 0,
        source: 'final',
        sourceLabel: 'Total final',
        reportedAt: row.lastTotalAt || null,
      };
    }

    return {
      reporterName: row.reporterName,
      women: row.realtimeFemale || 0,
      men: row.realtimeMale || 0,
      total: row.realtimeTotal || 0,
      source: 'realtime',
      sourceLabel: 'En vivo',
      reportedAt: row.lastRealtimeAt || null,
    };
  });

  const grand = rows.reduce(
    (acc, row) => {
      acc.women += row.women;
      acc.men += row.men;
      acc.total += row.total;
      if (row.source === 'final') acc.fromFinal += 1;
      else acc.fromRealtime += 1;
      return acc;
    },
    { women: 0, men: 0, total: 0, fromFinal: 0, fromRealtime: 0 }
  );

  return { rows, grand };
}

async function buildExcelBuffer(summary) {
  const official = toOfficialReport(summary);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Reporte de Votaciones';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte oficial');
  sheet.columns = [
    { header: 'Persona', key: 'reporterName', width: 24 },
    { header: 'Mujeres', key: 'women', width: 12 },
    { header: 'Hombres', key: 'men', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Origen', key: 'sourceLabel', width: 14 },
    { header: 'Fecha/hora', key: 'reportedAtLabel', width: 22 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F4C5C' },
  };

  official.rows.forEach((row) =>
    sheet.addRow({
      ...row,
      reportedAtLabel: formatDateTime(row.reportedAt),
    })
  );

  const totalRow = sheet.addRow({
    reporterName: 'TOTAL GENERAL',
    women: official.grand.women,
    men: official.grand.men,
    total: official.grand.total,
    sourceLabel: '',
    reportedAtLabel: '',
  });
  totalRow.font = { bold: true };

  const meta = workbook.addWorksheet('Resumen');
  meta.columns = [
    { header: 'Métrica', key: 'metric', width: 36 },
    { header: 'Valor', key: 'value', width: 18 },
  ];
  meta.getRow(1).font = { bold: true };
  meta.addRows([
    { metric: 'Mujeres (oficial)', value: official.grand.women },
    { metric: 'Hombres (oficial)', value: official.grand.men },
    { metric: 'Total votos (oficial)', value: official.grand.total },
    { metric: 'Reporteros con total final', value: official.grand.fromFinal },
    { metric: 'Reporteros solo en vivo', value: official.grand.fromRealtime },
    { metric: 'Reporteros', value: official.rows.length },
    {
      metric: 'Regla',
      value: 'Si hay total final se usa ese; si no, se usa en vivo',
    },
    { metric: 'Generado', value: new Date().toLocaleString('es-CO') },
  ]);

  return workbook.xlsx.writeBuffer();
}

function buildPdfBuffer(summary) {
  return new Promise((resolve, reject) => {
    const official = toOfficialReport(summary);
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#0f4c5c').fontSize(18).text('Reporte de Votaciones — Oficial', { align: 'left' });
    doc.moveDown(0.3);
    doc.fillColor('#64748b').fontSize(10).text(`Generado: ${new Date().toLocaleString('es-CO')}`);
    doc.moveDown(0.2);
    doc
      .fontSize(9)
      .text('Prioridad: total final. Si no hay final, se usa reporte en vivo.');
    doc.moveDown(0.8);

    doc.fillColor('#0a2f38').fontSize(11).text('Resumen oficial');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#334155');
    doc.text(
      `Mujeres ${official.grand.women} · Hombres ${official.grand.men} · Total ${official.grand.total}`
    );
    doc.text(
      `Con final: ${official.grand.fromFinal} · Solo en vivo: ${official.grand.fromRealtime}`
    );
    doc.moveDown(0.8);

    const headers = ['Persona', 'Mujeres', 'Hombres', 'Total', 'Origen', 'Fecha/hora'];
    const colWidths = [110, 55, 55, 50, 70, 120];
    const startX = doc.x;
    let y = doc.y;

    const drawRow = (cells, opts = {}) => {
      let x = startX;
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      cells.forEach((cell, i) => {
        if (opts.header) {
          doc.rect(x, y - 2, colWidths[i], 16).fill('#0f4c5c');
          doc.fillColor('#ffffff');
        } else {
          doc.fillColor('#0f172a');
        }
        doc.text(String(cell), x + 3, y, {
          width: colWidths[i] - 6,
          align: i === 0 || i >= 4 ? 'left' : 'right',
        });
        x += colWidths[i];
      });
      y += 16;
      doc.x = startX;
      doc.y = y;
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 40;
        doc.y = y;
      }
    };

    drawRow(headers, { header: true, bold: true });

    official.rows.forEach((row) => {
      drawRow([
        row.reporterName,
        row.women,
        row.men,
        row.total,
        row.sourceLabel,
        formatDateTime(row.reportedAt),
      ]);
    });

    drawRow(
      ['TOTAL', official.grand.women, official.grand.men, official.grand.total, '', ''],
      { bold: true }
    );

    doc.end();
  });
}

function chartPayload(summary) {
  const labels = summary.rows.map((r) => r.reporterName);
  return {
    byUserRealtime: {
      labels,
      female: summary.rows.map((r) => r.realtimeFemale),
      male: summary.rows.map((r) => r.realtimeMale),
      total: summary.rows.map((r) => r.realtimeTotal),
    },
    byUserFinal: {
      labels,
      women: summary.rows.map((r) => r.totalWomen),
      men: summary.rows.map((r) => r.totalMen),
      total: summary.rows.map((r) => r.totalVotes),
    },
    genderRealtime: {
      labels: ['Mujeres', 'Hombres'],
      values: [summary.grand.realtimeFemale, summary.grand.realtimeMale],
    },
    genderFinal: {
      labels: ['Mujeres', 'Hombres'],
      values: [summary.grand.totalWomen, summary.grand.totalMen],
    },
    modeComparison: {
      labels: ['Tiempo real', 'Total final'],
      values: [summary.grand.realtimeTotal, summary.grand.totalVotes],
    },
    grand: summary.grand,
    reporters: summary.rows.length,
  };
}

module.exports = {
  stamp,
  toOfficialReport,
  buildExcelBuffer,
  buildPdfBuffer,
  chartPayload,
};
