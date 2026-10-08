// Excel helpers: dates, cell reading, dated day-blocks.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}
function toISO(y, m, d) {
  return y + "-" + pad2(m) + "-" + pad2(d);
}
function parseSheetDateISO(sheetName) {
  const m = SHEET_DATE_RE.exec(sheetName);
  if (!m) return null;
  const month = parseInt(m[1], 10), day = parseInt(m[2], 10), year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return toISO(year, month, day);
}
function isoToUTCDate(iso) {
  const parts = iso.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}
// SheetJS builds date cells at the browser's local midnight (plus any time of day), so the
// calendar day is read with local getters: UTC ones moved "10/6 11:45 PM" to 10/7.
function excelDateCellToISO(value) {
  return toISO(value.getFullYear(), value.getMonth() + 1, value.getDate());
}
function weekdayIndex(iso) {
  return (isoToUTCDate(iso).getUTCDay() + 6) % 7;
}
function weekMondayISO(iso) {
  const d = isoToUTCDate(iso);
  d.setUTCDate(d.getUTCDate() - weekdayIndex(iso));
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function compareISO(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
/**
 * The day a cell stands for, e.g. the "8/5/26" that heads each day-block.
 * Excel's own formatted text is preferred over the date object, which can slip a
 * day depending on the machine's timezone.
 */
function cellDayISO(cell) {
  if (!cell || cell.v === void 0 || cell.v === null) return null;
  const text = String(cell.w !== void 0 ? cell.w : cell.v instanceof Date ? "" : cell.v).trim();
  const m = CELL_DATE_RE.exec(text);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2e3;
    const month = parseInt(m[1], 10), day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return toISO(year, month, day);
  }
  if (cell.v instanceof Date) return excelDateCellToISO(cell.v);
  return null;
}
function addDaysISO(iso, days) {
  const d = isoToUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

// src/js/xlsxHelpers.js
function getCell(sheet, addr) {
  return sheet[addr];
}
function cellIsError(cell) {
  return !!cell && cell.t === "e";
}
function getRawText(cell) {
  if (!cell) return "";
  return cell.w ? String(cell.w) : String(cell.v || "");
}
function cellText(cell) {
  if (!cell || cellIsError(cell)) return null;
  if (cell.v === void 0 || cell.v === null) return null;
  if (cell.v instanceof Date) return null;
  return String(cell.v);
}
/** People present: a number, or "4/5" read as 4. Blank or text stays null ("--"). */
function cellHeadcount(cell, warnings, context) {
  const raw = getRawText(cell).trim();
  const frac = /^(\d+)\s*\/\s*\d+$/.exec(raw);
  if (frac) return Number(frac[1]);
  return cellNumber(cell, warnings, context);
}
function cellNumber(cell, warnings, context) {
  if (!cell || cell.v === void 0 || cell.v === null) return null;
  if (cellIsError(cell)) {
    const errText = cell.w || "formula error";
    if (warnings) warnings.push("Formula error " + errText + " treated as missing data - " + context);
    return null;
  }
  if (typeof cell.v === "number") return cell.v;
  if (typeof cell.v === "string") {
    const s = cell.v.trim();
    if (s === "") return null;
    if (ERROR_STRINGS.has(s)) {
      if (warnings) warnings.push("Formula error " + s + " treated as missing data - " + context);
      return null;
    }
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
    // Numbers typed as text: "1,250", "$1,200", "85%".
    const cleaned = s.replace(/[\s\u00A0$,]/g, "");
    const pct = /^(-?\d*\.?\d+)%$/.exec(cleaned);
    if (pct) return parseFloat(pct[1]) / 100;
    if (/^-?\d*\.?\d+$/.test(cleaned)) return parseFloat(cleaned);
    if (warnings) warnings.push('Expected a number but found text "' + cell.v + '" - ' + context);
    return null;
  }
  return null;
}
function cellDateISO(cell) {
  if (!cell || cell.v === void 0 || cell.v === null) return null;
  if (cell.v instanceof Date) return excelDateCellToISO(cell.v);
  return null;
}
function colOffset(letter, offset) {
  if (typeof XLSX === "undefined") return letter;
  return XLSX.utils.encode_col(XLSX.utils.decode_col(letter) + offset);
}
/**
 * Address of the value next to a label: scans rows fromRow..toRow, columns A..lastCol,
 * for a text cell matching labelRe and returns the first non-empty cell up to 3 columns
 * to its right (a text cell there is another label, so it stops). null when not found.
 */
function findLabeledValue(sheet, labelRe, fromRow, toRow, lastCol) {
  const last = XLSX.utils.decode_col(lastCol || "Z");
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = 0; c <= last; c++) {
      const t = getRawText(getCell(sheet, XLSX.utils.encode_col(c) + r)).trim();
      if (!t || !labelRe.test(t)) continue;
      for (let k = 1; k <= 3; k++) {
        const addr = XLSX.utils.encode_col(c + k) + r;
        const cell = getCell(sheet, addr);
        if (!cell || cell.v === void 0 || cell.v === null || cell.v === "") continue;
        if (typeof cell.v === "string" && /[A-Za-z]/.test(cell.v) && !ERROR_STRINGS.has(cell.v.trim()) && !/^\s*\d+\s*\/\s*\d+\s*$/.test(cell.v)) break;
        return addr;
      }
    }
  }
  return null;
}
function expectHeaderNear(sheet, addr, expectedSubstrings, warnings, context) {
  const header = getRawText(getCell(sheet, addr)).toLowerCase().trim();
  const expected = Array.isArray(expectedSubstrings) ? expectedSubstrings : [expectedSubstrings];
  if (!header) {
    warnings.push('Expected header near "' + expected.join("/") + '" at ' + addr + " but the cell is empty - " + context + ". Sheet layout may have changed.");
    return false;
  }
  const matches = expected.some((s) => header.includes(s.toLowerCase()));
  if (!matches) {
    warnings.push('Expected header near "' + expected.join("/") + '" at ' + addr + ' but found "' + getRawText(getCell(sheet, addr)) + '" - ' + context + ". Sheet layout may have changed - check columns weren't inserted/reordered.");
  }
  return matches;
}

// src/js/blocks.js
/**
 * A weekly sheet lays each day out as a block of columns side by side, with the
 * day's date sitting under a label ("UPLH Goal - 4.67", "DATE"). Finding the block
 * by reading that date beats counting columns: FAB's blocks are 5 columns apart but
 * WELDING's first block is 6 wide, and either could change again.
 */
function findDateBlocks(sheet, labelRe) {
  if (!sheet || typeof XLSX === "undefined") return [];
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const blocks = [];
  const lastRow = Math.min(range.e.r, range.s.r + 24);
  const lastCol = Math.min(range.e.c, range.s.c + 60);
  for (let r = range.s.r; r <= lastRow; r++) {
    for (let c = range.s.c; c <= lastCol; c++) {
      const iso = cellDayISO(getCell(sheet, XLSX.utils.encode_cell({ r, c })));
      if (!iso) continue;
      if (r === range.s.r) continue;
      const label = getRawText(getCell(sheet, XLSX.utils.encode_cell({ r: r - 1, c })));
      if (!labelRe.test(label.trim())) continue;
      blocks.push({ iso, col: XLSX.utils.encode_col(c), labelRow: r, valueRow: r + 1 });
    }
  }
  return blocks;
}
/**
 * Forecast/actual for one day-block. Uses the sheet's own DAILY row when it has one,
 * otherwise adds up the part rows — these workbooks list parts and no total row.
 */
function readBlockTotals(sheet, block, range, opts, warnings) {
  let forecast = null, actual = null, sawDaily = false;
  let computedForecast = 0, computedActual = 0, rows = 0;
  const shortages = [];
  const fabIssueMap = new Map();
  const firstDataRow = block.valueRow + 2;
  for (let rowNum = firstDataRow; rowNum <= range.e.r + 1; rowNum++) {
    const partName = cellText(getCell(sheet, colOffset(block.col, 0) + rowNum));
    const forecastCell = getCell(sheet, colOffset(block.col, 1) + rowNum);
    const actualCell = getCell(sheet, colOffset(block.col, 2) + rowNum);
    const deltaOrStatusCell = getCell(sheet, colOffset(block.col, 3) + rowNum);
    const attainmentOrStatusCell = getCell(sheet, colOffset(block.col, 4) + rowNum);
    if (partName && partName.trim().toUpperCase() === "DAILY") {
      sawDaily = true;
      forecast = cellNumber(forecastCell, warnings, opts.name + " DAILY forecast");
      actual = cellNumber(actualCell, warnings, opts.name + " DAILY actual");
      break;
    }
    if (partName && partName.trim() !== "") {
      const partLabel = partName.trim();
      const partUpper = partLabel.toUpperCase();
      const forecastN = cellNumber(forecastCell, null, "");
      const actualN = cellNumber(actualCell, null, "");
      const actualRaw = getRawText(actualCell).trim();
      if (opts.id === "fab" && forecastN !== null && actualN === null && actualRaw && !cellIsError(actualCell)) {
        const normalizedIssue = actualRaw.replace(/\s+/g, " ").trim();
        if (!/^(?:-|—|n\/?a|na)$/i.test(normalizedIssue)) {
          const issueKey = normalizedIssue.toUpperCase();
          const issue = fabIssueMap.get(issueKey) || { message: normalizedIssue, parts: [] };
          if (issue.parts.indexOf(partLabel) === -1) issue.parts.push(partLabel);
          fabIssueMap.set(issueKey, issue);
        }
      }
      // TOTAL / SUBTOTAL / SCRAP rows are not parts: adding them would double the day.
      if (forecastN !== null && !/^(SUB\s*)?TOTAL|^SCRAP/.test(partUpper)) {
        computedForecast += forecastN;
        computedActual += actualN !== null ? actualN : 0;
        rows++;
      }
      const textToSearch = [forecastCell, actualCell, deltaOrStatusCell, attainmentOrStatusCell]
        .map((cell) => getRawText(cell))
        .join(" ")
        .toLowerCase();
      if (textToSearch.includes("material") && !partUpper.startsWith("SCRAP") && !partUpper.includes("TOTAL")) {
        if (shortages.indexOf(partLabel) === -1) shortages.push(partLabel);
      }
    }
  }
  if ((forecast === null || actual === null) && computedForecast > 0) {
    if (sawDaily && warnings) warnings.push(opts.name + ": the DAILY row did not hold usable numbers - totalled the part rows instead.");
    forecast = computedForecast;
    actual = computedActual;
  }
  return { forecast, actual, shortages, rows, issues: Array.from(fabIssueMap.values()) };
}
function blockForDate(blocks, dateISO) {
  return blocks.find((b) => b.iso === dateISO) || null;
}
/** Blocks from Monday through the selected day, in order — used for the week bar. */
function blocksThroughDate(blocks, selectedDateISO) {
  const monday = weekMondayISO(selectedDateISO);
  return blocks
    .filter((b) => compareISO(b.iso, monday) >= 0 && compareISO(b.iso, selectedDateISO) <= 0)
    .sort((a, b) => compareISO(a.iso, b.iso));
}
