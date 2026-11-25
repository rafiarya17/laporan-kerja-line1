'use strict';

async function buildTfSlipPdf(fields, rows, scope) {
  const { PDFDocument, PageSizes, StandardFonts, rgb } = PDFLib;
  const document = await PDFDocument.create();
  document.setTitle('TF Slip Web · Berlindo');
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  const [height, width] = PageSizes.A4;
  const margin = 30;
  const tableWidth = width - margin * 2;
  const size = fields.length > 11 ? 8 : 9;
  const leading = size + 3;
  const padding = 4;
  const ink = rgb(0.09, 0.18, 0.20);
  const border = rgb(0.79, 0.83, 0.82);
  const headerFill = rgb(0.91, 0.95, 0.94);
  const weights = fields.map(field => field.width || 100);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const minWidth = 29;
  const widths = weights.map(weight => minWidth + (tableWidth - fields.length * minWidth) * weight / total);

  function wrap(value, font, available) {
    const lines = [];
    const safe = Array.from(value.normalize('NFC'), character =>
      supported.has(character.codePointAt(0)) || /\s/u.test(character) ? character : '?').join('');
    for (const paragraph of safe.split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.trim().split(/\s+/u)) {
        const candidate = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(candidate, size) <= available) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = '';
        for (const character of word) {
          if (line && font.widthOfTextAtSize(line + character, size) > available) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  const headings = fields.map((field, index) => wrap(field.label, bold, widths[index] - 2 * padding));
  const headerLines = Math.max(...headings.map(lines => lines.length));
  let page, top, start;

  function drawRow(cells, offset, count, isHeading = false) {
    const rowHeight = 2 * padding + count * leading;
    let left = margin;
    cells.forEach((lines, index) => {
      page.drawRectangle({
        x: left, y: top - rowHeight, width: widths[index], height: rowHeight,
        borderWidth: 0.4, borderColor: border, color: isHeading ? headerFill : undefined
      });
      lines.slice(offset, offset + count).forEach((line, lineIndex) => {
        if (!line) return;
        page.drawText(line, {
          x: left + padding, y: top - padding - size - lineIndex * leading,
          size, color: ink, font: isHeading ? bold : regular
        });
      });
      left += widths[index];
    });
    top -= rowHeight;
  }

  function addPage() {
    page = document.addPage([width, height]);
    page.drawText('Berlindo · Digital Andon', { x: margin, y: height - margin, font: regular, size: 9, color: ink });
    page.drawText('TF Slip Web', { x: margin, y: height - margin - 23, font: bold, size: 19, color: ink });
    const details = wrap(scope, regular, tableWidth);
    details.forEach((line, index) => page.drawText(line, {
      x: margin, y: height - margin - 39 - index * leading, font: regular, size, color: ink
    }));
    top = height - margin - 44 - details.length * leading;
    drawRow(headings, 0, headerLines, true);
    start = top;
  }

  addPage();
  const capacity = () => Math.floor((top - margin - 2 * padding) / leading);
  for (const row of rows) {
    const cells = row.map((value, index) => wrap(value, regular, widths[index] - 2 * padding));
    const lineCount = Math.max(...cells.map(lines => lines.length));
    const fullPage = Math.floor((start - margin - 2 * padding) / leading);
    if (lineCount > capacity() && lineCount <= fullPage) addPage();
    for (let offset = 0; offset < lineCount;) {
      if (capacity() < 1) addPage();
      const count = Math.min(lineCount - offset, capacity());
      drawRow(cells, offset, count);
      offset += count;
    }
  }
  return document.save();
}
