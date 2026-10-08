// Workbook to dashboard data: file matching, board info, loading sign-off.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

function statusFromAttainment(attainment) {
  if (attainment >= 80) return "on_target";
  if (attainment >= 60) return "at_risk";
  return "critical";
}
function weekAttainmentFromBlocks(sheet, blockStarts, uptoWeekday, range) {
  if (!sheet || typeof XLSX === "undefined") return null;
  if (!range) range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  let dailyRow = null;
  for (let r = range.s.r + 3; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const labelA = cellText(getCell(sheet, "A" + rowNum));
    if (labelA && labelA.trim().toUpperCase() === "DAILY") {
      dailyRow = rowNum;
      break;
    }
  }
  if (dailyRow === null) return null;
  let sumActual = 0, sumForecast = 0, daysCounted = 0;
  for (let d = 0; d <= uptoWeekday && d < blockStarts.length; d++) {
    const bs = blockStarts[d];
    const forecast = cellNumber(getCell(sheet, colOffset(bs, 1) + dailyRow), [], "");
    const actual = cellNumber(getCell(sheet, colOffset(bs, 2) + dailyRow), [], "");
    if (forecast !== null && forecast > 0) {
      sumForecast += forecast;
      sumActual += actual !== null ? actual : 0;
      daysCounted++;
    }
  }
  if (daysCounted === 0 || sumForecast <= 0) return null;
  return Math.round(sumActual / sumForecast * 100);
}
function findSheetsForDept(wb, prefix) {
  const out = [];
  for (const name of wb.SheetNames) {
    if (name.trim().toLowerCase().startsWith(prefix)) {
      const dateISO = parseSheetDateISO(name);
      if (dateISO) out.push({ name, dateISO });
    }
  }
  out.sort((a, b) => compareISO(a.dateISO, b.dateISO));
  return out;
}
function selectWeeklySheet(wb, prefix, selectedDateISO, warnings, label) {
  const monday = weekMondayISO(selectedDateISO);
  const sheets = findSheetsForDept(wb, prefix);
  const found = sheets.find((s) => s.dateISO === monday);
  if (!found) {
    warnings.push(label + ": no sheet found for week starting " + monday + ".");
    return null;
  }
  return found.name;
}
function selectPaintSheet(wb, selectedDateISO, warnings) {
  const sheets = findSheetsForDept(wb, "paint");
  const found = sheets.find((s) => s.dateISO === selectedDateISO);
  if (!found) {
    warnings.push("PAINT: no sheet found with name-date matching " + selectedDateISO + ".");
    return null;
  }
  return found.name;
}
/** Which department a file belongs to, read off its name. */
// Department by the file's own name (not its folder). A name that fits two departments
// ("Tank Paint Colors.xlsx") or looks like a copy / backup / OneDrive conflict copy
// belongs to none, so it can't replace the real workbook just by being newer.
var COPY_FILE_RE = /(^|[\s_-])(copy|backup|bak|old)([\s_.-]|$)|^copy of |\(\d+\)\.\w+$|-(desktop|laptop|pc)-[a-z0-9]+/i;
var ARCHIVE_DIR_RE = /(^|\/)(archive|archived|old|backup|backups)[^/]*\//i;
function deptsForFileName(fileName) {
  const path = String(fileName || "");
  const base = path.split("/").pop();
  if (ARCHIVE_DIR_RE.test(path) || COPY_FILE_RE.test(base)) return [];
  return DEPT_SOURCES.filter((d) => d.fileMatch.test(base));
}
function deptForFileName(fileName) {
  const hits = deptsForFileName(fileName);
  return hits.length === 1 ? hits[0] : null;
}
/**
 * The tab for a day. Tabs are named only with a date ("8.5.2026"), so an exact
 * name match wins over one that merely contains the date ("12.15.2025.1").
 */
function sheetNameForDate(sheetNames, dateISO) {
  const matches = sheetNames.filter((name) => parseSheetDateISO(name) === dateISO);
  if (matches.length === 0) return null;
  const exact = matches.find((name) => {
    const m = SHEET_DATE_RE.exec(name);
    return m && name.trim() === m[0];
  });
  return exact || matches[0];
}
/**
 * Reads one department workbook. Sheet names are listed first and only the needed
 * tabs are parsed — the welding book alone is 2.4 MB across 300+ tabs, so unchanged
 * workbooks are reused between the 10-second checks.
 */
function readDeptWorkbook(source, buffer, selectedDateISO, warnings) {
  const names = XLSX.read(buffer, { type: "array", bookSheets: true }).SheetNames || [];
  const wantISO = source.cadence === "day" ? selectedDateISO : weekMondayISO(selectedDateISO);
  const wanted = [];
  let mainName = sheetNameForDate(names, wantISO);
  // Weekly tab not named exactly for Monday (holiday Monday, tab dated the Sunday or the
  // first workday): take the latest tab dated from that Sunday up to the selected day.
  if (!mainName && source.cadence === "week") {
    const from = addDaysISO(weekMondayISO(selectedDateISO), -1);
    const near = names.map((n) => ({ n, iso: parseSheetDateISO(n) })).filter((x) => x.iso && compareISO(x.iso, from) >= 0 && compareISO(x.iso, selectedDateISO) <= 0);
    near.sort((a, b) => compareISO(a.iso, b.iso));
    if (near.length) mainName = near[near.length - 1].n;
  }
  if (mainName) wanted.push(mainName);
  // Paint's week bar needs Monday through today, each on its own tab.
  const weekNames = {};
  if (source.cadence === "day") {
    const monday = weekMondayISO(selectedDateISO);
    for (let d = 0; d < 5; d++) {
      const dayISO = addDaysISO(monday, d);
      if (compareISO(dayISO, selectedDateISO) > 0) break;
      const dayName = sheetNameForDate(names, dayISO);
      if (dayName) {
        weekNames[dayISO] = dayName;
        if (wanted.indexOf(dayName) === -1) wanted.push(dayName);
      }
    }
  }
  if (!mainName) {
    const dated = names.filter((n) => parseSheetDateISO(n)).slice(-6).join(", ");
    warnings.push(source.label + ": no tab named " + wantISO + (source.cadence === "week" ? " (the Monday of that week)" : "") + " in " + source.fileName + ". Most recent dated tabs: " + (dated || "none") + ".");
    return null;
  }
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, sheets: wanted });
  const weekSheets = {};
  for (const iso of Object.keys(weekNames)) weekSheets[iso] = wb.Sheets[weekNames[iso]];
  return { sheet: wb.Sheets[mainName], sheetName: mainName, weekSheets };
}
function buildDeptFromSheet(source, loaded, selectedDateISO, warnings) {
  if (source.id === "fab") return buildFabFromSheet(loaded.sheet, loaded.sheetName, selectedDateISO, warnings);
  if (source.id === "welding") return buildWeldingFromSheet(loaded.sheet, selectedDateISO, warnings);
  if (source.id === "tanks") return buildTanksFromSheet(loaded.sheet, selectedDateISO, warnings);
  if (source.id === "paint") return buildPaintFromSheet(loaded.sheet, paintWeekFromSheets(loaded.weekSheets, selectedDateISO), selectedDateISO, warnings);
  return null;
}

/**
 * Builds the dashboard from one workbook per department. Falls back to the older
 * layout — every department inside a single workbook, tabs prefixed with the
 * department name — for any file whose name matches no department.
 */
async function buildDashboardFromFiles(files, selectedDateISO) {
  await ensureXlsx();
  const warnings = [];
  const departments = [];
  const sourcesUsed = [];
  const parsed = {};
  let fabWorkers;
  const unmatched = [];

  for (const file of files) {
    const source = deptForFileName(file.fileName);
    if (!source) { unmatched.push(file); continue; }
    const labelled = Object.assign({ fileName: file.fileName }, source);
    // Unchanged workbook: reuse what was parsed last time instead of re-reading
    // megabytes on every 10-second check for a file nobody touched.
    if (file.cached) {
      departments.push(file.cached.dept);
      sourcesUsed.push({ id: source.id, label: source.label, fileName: file.fileName, sheetName: file.cached.sheetName, savedAt: isoOrNull(file.modifiedAt) });
      if (file.cached.workers) fabWorkers = file.cached.workers;
      parsed[file.fileName] = file.cached;
      for (const w of file.cached.warnings || []) warnings.push(w);
      continue;
    }
    try {
      const before = warnings.length;
      const loaded = readDeptWorkbook(labelled, file.buffer, selectedDateISO, warnings);
      if (!loaded) continue;
      const built = buildDeptFromSheet(labelled, loaded, selectedDateISO, warnings);
      const dept = built && built.dept ? built.dept : built;
      if (!dept) continue;
      if (built && built.workers) fabWorkers = built.workers;
      departments.push(dept);
      sourcesUsed.push({ id: source.id, label: source.label, fileName: file.fileName, sheetName: loaded.sheetName, savedAt: isoOrNull(file.modifiedAt) });
      parsed[file.fileName] = {
        signature: file.signature || null,
        date: selectedDateISO,
        dept,
        sheetName: loaded.sheetName,
        workers: built && built.workers ? built.workers : null,
        warnings: warnings.slice(before)
      };
    } catch (err) {
      console.error(source.label + " error:", err);
      warnings.push("Fatal error parsing " + source.label + " from " + file.fileName + ": " + err.message);
    }
  }

  for (const file of unmatched) {
    const legacy = await buildDashboardData(file.buffer, selectedDateISO);
    for (const dept of legacy.departments) {
      if (!departments.some((d) => d.id === dept.id)) {
        departments.push(dept);
        sourcesUsed.push({ id: dept.id, label: dept.name, fileName: file.fileName, sheetName: "(combined workbook)" });
      }
    }
    if (legacy.fabWorkers) fabWorkers = legacy.fabWorkers;
    for (const w of legacy.warnings) warnings.push(w);
  }

  // A department with no card would just leave a hole on the TVs; send a placeholder
  // that says what is missing so people on the floor know whom to tell.
  const missing = [];
  for (const source of DEPT_SOURCES) {
    if (!departments.some((d) => d.id === source.id)) {
      const mine = warnings.filter((w) => w.indexOf(source.label + ":") === 0);
      const specific = mine.find((w) => /no (tab named|block dated)/.test(w)) || mine[0];
      const hadFile = files.some((f) => { const d = deptForFileName(f.fileName); return d && d.id === source.id; });
      warnings.push(source.label + ": no data. Expected a file whose name contains \"" + source.fileMatch.source + "\" in the connected folder.");
      missing.push({ id: source.id, name: source.label, reason: missingReason(specific, hadFile) });
    }
  }
  if (departments.length === 0) {
    throw new Error("None of the " + files.length + " file(s) produced data for " + selectedDateISO + ".");
  }
  const order = DEPT_SOURCES.map((d) => d.id);
  departments.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { selectedDate: selectedDateISO, selectedWeekStart: weekMondayISO(selectedDateISO), departments, missing, warnings, fabWorkers, sources: sourcesUsed, parsed };
}
// ---- Board layout v2 (safety tile, loading bar, uniform cards) ----
// Default layout. ?classic=1 brings back the previous one; ?preview=1 also fills the
// loading strip with labelled sample numbers when there is no loading data.
var LAYOUT_V2 = !/[?&]classic=1(&|$)/.test(location.search);
var LAYOUT_PREVIEW = /[?&]preview=1(&|$)/.test(location.search);
if (LAYOUT_V2) document.documentElement.classList.add("v2");

// ---- TV Board Info.xlsx: safety days + daily toolbox topic ----
var BOARD_INFO_RE = /tv\s*board\s*info/i;
/**
 * "Toolbox Topics": column A a date, column B that day's topic.
 * "Days Without A Recordable": a cell like =TODAY()-DATE(2025,6,31). Excel only
 * recalculates TODAY() when someone opens and saves the file, so the start date is
 * read out of the formula and the TVs count the days themselves. A plain number
 * typed in instead is used as-is.
 */
function parseBoardInfo(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellFormula: true });
  const out = { topics: [], sinceISO: null, days: null };
  const topicSheetName = wb.SheetNames.find((n) => /topic/i.test(n)) || wb.SheetNames[0];
  const ts = topicSheetName && wb.Sheets[topicSheetName];
  if (ts && ts["!ref"]) {
    const range = XLSX.utils.decode_range(ts["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      const iso = cellDayISO(ts[XLSX.utils.encode_cell({ r, c: 0 })]);
      const topicCell = ts[XLSX.utils.encode_cell({ r, c: 1 })];
      const topic = topicCell && topicCell.v !== void 0 && topicCell.v !== null ? String(topicCell.w !== void 0 ? topicCell.w : topicCell.v).trim() : "";
      if (iso && topic) out.topics.push({ iso, topic });
    }
  }
  const daysSheetName = wb.SheetNames.find((n) => /days?\s*without|recordable|accident/i.test(n));
  const ds = daysSheetName && wb.Sheets[daysSheetName];
  if (ds && ds["!ref"]) {
    const range = XLSX.utils.decode_range(ds["!ref"]);
    const cells = [];
    for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ds[XLSX.utils.encode_cell({ r, c })];
      if (cell) cells.push(cell);
    }
    // 1) The =TODAY()-<start> formula: its start date keeps the count live every day.
    //    Start as DATE(y,m,d), DATEVALUE("m/d/y") or a cell holding the date.
    for (const cell of cells) {
      if (!cell.f || !/TODAY\(\)/i.test(cell.f)) continue;
      let iso = null;
      const dm = /DATE\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)/i.exec(cell.f);
      const dv = /DATEVALUE\(\s*"(\d{1,2})\/(\d{1,2})\/(\d{2,4})"\s*\)/i.exec(cell.f);
      const ref = /TODAY\(\)\s*-\s*\$?([A-Z]{1,3})\$?(\d+)/i.exec(cell.f);
      if (dm) iso = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]))).toISOString().slice(0, 10); // DATE(2025,6,31) = July 1, as in Excel
      else if (dv) iso = new Date(Date.UTC(Number(dv[3].length === 2 ? "20" + dv[3] : dv[3]), Number(dv[1]) - 1, Number(dv[2]))).toISOString().slice(0, 10);
      else if (ref) iso = cellDayISO(ds[(ref[1] + ref[2]).toUpperCase()]);
      if (iso) { out.sinceISO = iso; break; }
    }
    // 2) Otherwise a fixed count: a formula's result first, then a plain number that
    //    isn't a year typed as a title ("2026").
    if (!out.sinceISO) {
      const isCount = (c) => typeof c.v === "number" && Number.isFinite(c.v) && c.v >= 0;
      const pick = cells.find((c) => c.f && isCount(c)) || cells.find((c) => isCount(c) && !(Number.isInteger(c.v) && c.v >= 1900 && c.v <= 2100 && !c.f));
      if (pick) out.days = Math.floor(pick.v);
    }
  }
  return out;
}
/** What the TVs get: today's topic and either the start date or a fixed day count. */
function safetyFor(board, dateISO) {
  if (!board) return null;
  let hit = board.topics.find((t) => t.iso === dateISO);
  // A topic typed with the wrong year (e.g. 1/26/2025 in the 2026 list) still counts -
  // recognised by a neighbouring row that is in this year. A real entry from last year
  // in a multi-year list (neighbours also last year) is not brought back.
  if (!hit) {
    const year = dateISO.slice(0, 4);
    const i = board.topics.findIndex((t, k) => t.iso.slice(5) === dateISO.slice(5) && t.iso.slice(0, 4) !== year
      && [board.topics[k - 1], board.topics[k + 1]].some((n) => n && n.iso.slice(0, 4) === year));
    if (i !== -1) hit = board.topics[i];
  }
  if (!hit && !board.sinceISO && board.days === null) return null;
  return { topic: hit ? hit.topic : null, sinceISO: board.sinceISO, days: board.days, savedAt: isoOrNull(board.savedAt) };
}
// ---- Loading: "<letter> Load Sign Off <Month> <year>.xlsx", one tab per day ("9-28-26") ----
var LOADING_FILE_RE = /load\s*sign\s*off/i;
var MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** Which sign-off workbook covers a given day: the name carries the month and year. */
function loadingFileFor(cands, iso) {
  // "Oct", "Sept", "September" all count for the month.
  const month = MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
  const year = iso.slice(0, 4);
  const monthRe = new RegExp("(^|[^a-z])" + month.slice(0, 3) + "[a-z]*([^a-z]|$)", "i");
  return cands.find((c) => monthRe.test(c.name.split("/").pop()) && c.name.indexOf(year) !== -1) || null;
}
/** Short products written in COMMENTS, e.g. "SO1347500 EWBL66-2,GUT22-1." -> EWBL66 x2, GUT22 x1. */
function parseShortProducts(text) {
  const out = [];
  const clean = String(text || "").toUpperCase().replace(/SO\s*\d{5,}/g, " ");
  // The quantity is the LAST "-N" of each item, so a code with hyphens of its own
  // ("RRB-10-2") is RRB-10 x2, not RRB x10.
  for (const token of clean.replace(/\s*-\s*/g, "-").split(/[,;\s]+/)) {
    const m = /^([A-Z0-9-]*[A-Z][A-Z0-9-]*?)-(\d{1,4})\.?$/.exec(token);
    if (m) out.push([m[1], Number(m[2])]);
  }
  return out;
}
function parseLoadSignOff(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const days = [];
  const text = (c) => (c && c.v !== void 0 && c.v !== null ? String(c.w !== void 0 ? c.w : c.v).trim() : "");
  const num = (c) => { const n = parseFloat(text(c).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
  for (const name of wb.SheetNames) {
    const m = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(name.trim());
    if (!m) continue;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
    if (d.getUTCMonth() !== Number(m[1]) - 1) continue; // "9-31-26" and other impossible dates
    const iso = d.toISOString().slice(0, 10);
    const sh = wb.Sheets[name];
    if (!sh || !sh["!ref"]) continue;
    const range = XLSX.utils.decode_range(sh["!ref"]);
    const at = (r, c) => sh[XLSX.utils.encode_cell({ r, c })];
    // Summary block: a label, its value one to three rows below in the same column.
    const totals = {};
    let endRow = range.e.r;
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const t = text(at(r, c)).toLowerCase();
        if (!t) continue;
        if (t === "total tarter") endRow = Math.min(endRow, r - 1);
        const key = t === "total loads" ? "loads" : t === "total loaded" ? "pieces" : t === "total short" ? "shorts" : null;
        if (!key) continue;
        for (let k = 1; k <= 3; k++) { const v = num(at(r + k, c)); if (v !== null) { totals[key] = v; break; } }
      }
    }
    // Load rows: anchored on the "% Full" cell - pieces two columns left, shorts one
    // left, comments one right - because some tabs are shifted a column.
    let loads = 0, pieces = 0, shorts = 0;
    const products = [];
    for (let r = range.s.r; r <= endRow; r++) {
      for (let c = range.s.c + 2; c <= range.e.c; c++) {
        if (!/^\d{1,3}(\.\d+)?%$/.test(text(at(r, c)))) continue;
        const p = num(at(r, c - 2));
        if (!p) break;
        const sh2 = num(at(r, c - 1)) || 0;
        loads += 1; pieces += p; shorts += sh2;
        if (sh2 > 0) for (const item of parseShortProducts(text(at(r, c + 1)))) products.push(item);
        break;
      }
    }
    days.push({
      iso,
      loads: totals.loads !== undefined ? totals.loads : loads,
      pieces: totals.pieces !== undefined ? totals.pieces : pieces,
      shorts: totals.shorts !== undefined ? totals.shorts : shorts,
      products
    });
  }
  return days;
}
/** Monday through the selected day: trailers, pieces, shorts and the short products. */
function loadingFor(books, dateISO) {
  // A day present in two workbooks (end of one month's file, start of the next) counts once.
  const byDay = new Map();
  for (const b of books || []) if (b && Array.isArray(b.days)) for (const d of b.days) if (d && d.iso && !byDay.has(d.iso)) byDay.set(d.iso, d);
  const all = Array.from(byDay.values());
  if (!all.length) return null;
  const monday = weekMondayISO(dateISO);
  const friday = addDaysISO(monday, 4);
  const days = all.filter((d) => d.iso >= monday && d.iso <= dateISO && d.iso <= friday).sort((a, b) => (a.iso < b.iso ? -1 : 1));
  const sum = (k) => days.reduce((t, d) => t + (d[k] || 0), 0);
  const today = days.find((d) => d.iso === dateISO);
  const byProduct = new Map();
  for (const d of days) for (const [name, qty] of d.products || []) byProduct.set(name, (byProduct.get(name) || 0) + qty);
  const piecesWeek = sum("pieces"), shortsWeek = sum("shorts");
  return {
    weekStart: monday,
    trailersWeek: sum("loads"),
    trailersToday: today ? today.loads : 0,
    piecesWeek,
    shortsWeek,
    fulfillment: piecesWeek > 0 ? (piecesWeek - shortsWeek) / piecesWeek : null,
    shorts: Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24)
  };
}
function safetyDays(safety) {
  if (!safety) return null;
  if (safety.sinceISO) {
    const t = todayISO();
    const days = Math.round((Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.parse(safety.sinceISO + "T00:00:00Z")) / 864e5);
    return days >= 0 ? days : null;
  }
  return typeof safety.days === "number" ? safety.days : null;
}

function isoOrNull(ms) {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
/** Short, TV-sized reason for a department card that has no data. */
function missingReason(warning, hadFile) {
  const m = warning && /no tab named (\d{4})-(\d{2})-(\d{2})/.exec(warning);
  if (m) return "Tab " + Number(m[2]) + "." + Number(m[3]) + "." + m[1] + " missing in the Excel";
  const b = warning && /no block dated (\d{4})-(\d{2})-(\d{2})/.exec(warning);
  if (b) {
    const day = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3])).toLocaleDateString("en-US", { weekday: "short" });
    return "No " + day + " " + Number(b[2]) + "/" + Number(b[3]) + " block in the Excel";
  }
  if (!hadFile) return "Excel file not found";
  return "Check the Excel sheet";
}

async function buildDashboardData(arrayBuffer, selectedDateISO) {
  const warnings = [];
  await ensureXlsx();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const departments = [];
  let fabWorkers;
  try {
    const fabResult = buildFab(wb, selectedDateISO, warnings);
    if (fabResult) {
      departments.push(fabResult.dept);
      fabWorkers = fabResult.workers;
    }
  } catch (err) {
    console.error("FAB Error:", err);
    warnings.push("Fatal error parsing FAB: " + err.message);
  }
  try {
    const welding = buildWelding(wb, selectedDateISO, warnings);
    if (welding) departments.push(welding);
  } catch (err) {
    console.error("WELDING Error:", err);
    warnings.push("Fatal error parsing WELDING: " + err.message);
  }
  try {
    const paint = buildPaint(wb, selectedDateISO, warnings);
    if (paint) departments.push(paint);
  } catch (err) {
    console.error("PAINT Error:", err);
    warnings.push("Fatal error parsing PAINT: " + err.message);
  }
  try {
    const tanks = buildTanks(wb, selectedDateISO, warnings);
    if (tanks) departments.push(tanks);
  } catch (err) {
    console.error("TANKS Error:", err);
    warnings.push("Fatal error parsing TANKS: " + err.message);
  }
  if (departments.length === 0) throw new Error("No department sheets could be parsed from this workbook for the selected date.");
  return { selectedDate: selectedDateISO, selectedWeekStart: weekMondayISO(selectedDateISO), departments, warnings, fabWorkers };
}
