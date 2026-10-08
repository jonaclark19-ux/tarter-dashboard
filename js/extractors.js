// One reader per department workbook: FAB, WELDING, PAINT, TANKS.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

function detectFabWorkers(sheet) {
  if (typeof XLSX === "undefined") return null;
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const safeRaw = (r, c) => {
    if (r < range.s.r || r > range.e.r || c < range.s.c || c > range.e.c) return "";
    return getRawText(getCell(sheet, XLSX.utils.encode_cell({ r, c })));
  };
  for (let r = range.s.r; r <= Math.min(range.s.r + 10, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = safeRaw(r, c).toLowerCase().trim();
      if (header.includes("employe") || header.includes("worker") || header.includes("personnel")) {
        for (let rr = r + 1; rr <= range.e.r; rr++) {
          const cellVal = safeRaw(rr, c).trim();
          if (cellVal) {
            const mRatio = cellVal.match(/(\d+)\s*\/\s*(\d+)/);
            if (mRatio) return { active: parseInt(mRatio[1], 10), total: EXPECTED_HEADCOUNT.fab };
            const mNum = cellVal.match(/(\d+)/);
            if (mNum) return { active: parseInt(mNum[1], 10), total: EXPECTED_HEADCOUNT.fab };
          }
        }
      }
    }
  }
  return null;
}
// New format = dated day-blocks headed "UPLH Goal ...", found anywhere on the sheet, so a
// title row added above them doesn't silently switch to the old single-block reader.
function isNewBlockFormat(sheet) {
  const a1 = getRawText(getCell(sheet, "A1")).toLowerCase();
  return a1.includes("uplh goal") || findDateBlocks(sheet, /uplh\s*goal/i).length > 0;
}
function buildNewBlockFormat(sheet, selectedDateISO, warnings, opts) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  let weekday = Math.min(4, weekdayIndex(selectedDateISO));
  // Locate the day by the date printed in the block instead of counting columns:
  // FAB's blocks sit 5 columns apart, WELDING's first one is 6 wide.
  const dateBlocks = findDateBlocks(sheet, /uplh\s*goal/i);
  let block = blockForDate(dateBlocks, selectedDateISO);
  if (!block && dateBlocks.length) {
    // Showing yesterday's block as today would be wrong on the TV with no hint, so the
    // card reports the missing day instead.
    warnings.push(opts.name + ": no block dated " + selectedDateISO + " on this sheet.");
    return null;
  }
  if (!block) {
    // Guessing fixed columns could put another day's numbers on today's card with
    // nothing on the TV to say so, so the card is NO DATA with the reason instead.
    warnings.push(opts.name + ": no block dated " + selectedDateISO + " on this sheet (no dated day-blocks found - check the dates under UPLH Goal).");
    return null;
  }
  const blockStart = block.col;
  const labelRow = String(block.labelRow);
  const valueRow = String(block.valueRow);
  expectHeaderNear(sheet, blockStart + labelRow, ["uplh goal"], warnings, opts.name + " UPLH goal header");
  expectHeaderNear(sheet, colOffset(blockStart, 1) + labelRow, ["operator", "welder", "employe", "present"], warnings, opts.name + " headcount header");
  const present = cellHeadcount(getCell(sheet, colOffset(blockStart, 1) + valueRow), warnings, opts.name + " headcount");
  const attainmentRaw = cellNumber(getCell(sheet, colOffset(blockStart, 2) + valueRow), warnings, opts.name + " scheduled adherence");
  const uplh = cellNumber(getCell(sheet, colOffset(blockStart, 3) + valueRow), warnings, opts.name + " UPLH");
  const headerText = cellText(getCell(sheet, blockStart + labelRow)) || "";
  const uplhGoal = parseUplhGoalText(headerText);
  if (uplhGoal === null) warnings.push(opts.name + ': could not read the UPLH goal from "' + headerText + '".');
  const totals = readBlockTotals(sheet, block, range, opts, warnings);
  let forecast = totals.forecast, actual = totals.actual;
  const materialShortageParts = totals.shortages;
  const notes = [];
  if (opts.id === "fab") {
    const issueLines = (totals.issues || []).map((issue) => issue.message + (issue.parts.length ? " — " + issue.parts.join(" · ") : ""));
    const shortageOnly = materialShortageParts.filter((part) => !(totals.issues || []).some((issue) => issue.parts.indexOf(part) !== -1));
    if (shortageOnly.length) issueLines.push("MATERIAL — " + shortageOnly.join(" · "));
    if (issueLines.length) notes.push({ type: "warning", label: "DOWNTIME / ISSUES", content: issueLines.join(" | "), customColor: "#D97706" });
  } else if (opts.id === "welding" && materialShortageParts.length) {
    notes.push({ type: "warning", label: "MATERIAL / ISSUES", content: materialShortageParts.join(" · "), customColor: "#D97706" });
  }
  const expected = opts.expected;
  let attainmentPct;
  if (forecast !== null && forecast > 0 && actual !== null) {
    attainmentPct = Math.round(actual / forecast * 100);
  } else {
    attainmentPct = Math.round((attainmentRaw || 0) * 100);
    warnings.push(opts.name + ": DAILY actual/forecast row not found - attainment falls back to the sheet's scheduled adherence cell.");
  }
  const stats = [
    { label: "ACTUAL", value: actual !== null ? actual : "N/A", tone: "default" },
    { label: "FORECAST", value: forecast !== null ? forecast : "N/A", tone: "default" },
    { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
    { label: "UPLH GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" }
  ];
  // Operational downtime/material issues stay in the bottom notes area.
  // Week bar: add up Monday through the selected day from the blocks themselves,
  // since these sheets carry no weekly DAILY row.
  let weekAttainment = null;
  if (dateBlocks.length) {
    let weekForecast = 0, weekActual = 0;
    for (const dayBlock of blocksThroughDate(dateBlocks, selectedDateISO)) {
      const dayTotals = dayBlock.col === block.col ? { forecast, actual } : readBlockTotals(sheet, dayBlock, range, opts, null);
      if (dayTotals.forecast !== null && dayTotals.forecast > 0) {
        weekForecast += dayTotals.forecast;
        weekActual += dayTotals.actual !== null ? dayTotals.actual : 0;
      }
    }
    if (weekForecast > 0) weekAttainment = Math.round(weekActual / weekForecast * 100);
  } else {
    // Only reachable for FAB: every other department returns above when no dated
    // block was found, so these fixed columns are always FAB's own.
    weekAttainment = weekAttainmentFromBlocks(sheet, FAB_BLOCK_STARTS, weekday, range);
  }
  const dept = {
    id: opts.id,
    name: opts.name,
    status: statusFromAttainment(attainmentPct),
    meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
    attainment: attainmentPct,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment,
    headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
    stats,
    notes: notes.length ? notes : void 0
  };
  return { dept, workers: { active: present, total: expected, down: present === 0 } };
}
function buildFabLegacy(sheet, sheetName, selectedDateISO, warnings) {
  const weekStart = weekMondayISO(selectedDateISO);
  const weekEnd = addDaysISO(weekStart, 6);
  if (typeof XLSX === "undefined") return null;
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const workers = detectFabWorkers(sheet) || void 0;
  if (!workers) {
    warnings.push('FAB: no "Employees/Workers/Personnel" header found in the first 10 rows - headcount defaulted to 0/' + EXPECTED_HEADCOUNT.fab + ".");
  }
  let jobsDone = 0, totalActive = 0, workingJobs = 0, doneQty = 0, totalQty = 0;
  const seen = /* @__PURE__ */ new Set();
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const statusText = cellText(getCell(sheet, "A" + rowNum));
    const statusNorm = statusText ? statusText.trim().toUpperCase() : "";
    const completionISO = cellDateISO(getCell(sheet, "C" + rowNum));
    const partText = cellText(getCell(sheet, "B" + rowNum)) || "";
    const qty = cellNumber(getCell(sheet, "D" + rowNum), warnings, "FAB " + sheetName + " row " + rowNum + " QTY");
    if (partText.toUpperCase().includes("TOTAL") || statusNorm.includes("TOTAL")) continue;
    if (completionISO && completionISO >= weekStart && completionISO <= weekEnd) {
      const sig = partText + "|" + completionISO + "|" + statusNorm + "|" + (qty === null ? "" : qty);
      if (!seen.has(sig)) {
        seen.add(sig);
        totalActive += 1;
        if (qty !== null) {
          totalQty += qty;
          if (statusNorm === "DONE") doneQty += qty;
        }
        if (statusNorm === "DONE") jobsDone += 1;
        else if (statusNorm === "WORKING") workingJobs += 1;
      }
    }
    const tankPart = cellText(getCell(sheet, "I" + rowNum));
    const tankQty = cellNumber(getCell(sheet, "J" + rowNum), [], "");
    const tankDateISO = cellDateISO(getCell(sheet, "K" + rowNum));
    const tankStatusText = cellText(getCell(sheet, "L" + rowNum));
    const tankStatusNorm = tankStatusText ? tankStatusText.trim().toUpperCase() : "";
    if (tankDateISO && tankDateISO >= weekStart && tankDateISO <= weekEnd) {
      if (tankPart && (tankPart.toUpperCase().includes("TOTAL") || tankStatusNorm.includes("TOTAL"))) continue;
      const sigTank = "TANK|" + (tankPart || "") + "|" + tankDateISO + "|" + tankStatusNorm + "|" + (tankQty === null ? "" : tankQty);
      if (!seen.has(sigTank)) {
        seen.add(sigTank);
        if (tankQty !== null) {
          totalQty += tankQty;
          if (tankStatusNorm === "DONE") doneQty += tankQty;
        }
      }
    }
  }
  const attainment = totalQty > 0 ? Math.round(doneQty / totalQty * 100) : 0;
  const stats = [
    { label: "DONE QTY", value: doneQty, tone: "green" },
    { label: "TOTAL QTY", value: totalQty, tone: "default" },
    { label: "DONE JOBS", value: jobsDone + "/" + totalActive, tone: "default" },
    { label: "WORKING", value: workingJobs, tone: "yellow" }
  ];
  const headline = workers ? { icon: "\u{1F464}", active: workers.active, total: workers.total, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: workers.down === true || (workers.down === void 0 && workers.active === 0) } : { icon: "\u{1F464}", active: 0, total: EXPECTED_HEADCOUNT.fab, label: "PRESENT / EXPECTED (N/A)", countsAsPersonnel: true };
  const dept = {
    id: "fab",
    name: "FAB",
    status: statusFromAttainment(attainment),
    meta: "JOBS + TANK BASES",
    attainment,
    attainmentLabel: "WEEK ATTAINMENT",
    headline,
    stats,
    legacyFab: true
  };
  return { dept, workers: workers || void 0 };
}
function buildFab(wb, selectedDateISO, warnings) {
  const sheetName = selectWeeklySheet(wb, "fab", selectedDateISO, warnings, "FAB");
  if (!sheetName) return null;
  return buildFabFromSheet(wb.Sheets[sheetName], sheetName, selectedDateISO, warnings);
}
function buildFabFromSheet(sheet, sheetName, selectedDateISO, warnings) {
  if (!sheet || typeof XLSX === "undefined") return null;
  if (isNewBlockFormat(sheet)) {
    return buildNewBlockFormat(sheet, selectedDateISO, warnings, { id: "fab", name: "FAB", expected: EXPECTED_HEADCOUNT.fab });
  }
  return buildFabLegacy(sheet, sheetName, selectedDateISO, warnings);
}

// src/js/extractors/welding.js
function buildWelding(wb, selectedDateISO, warnings) {
  const sheetName = selectWeeklySheet(wb, "weld", selectedDateISO, warnings, "WELDING");
  if (!sheetName) return null;
  return buildWeldingFromSheet(wb.Sheets[sheetName], selectedDateISO, warnings);
}
function buildWeldingFromSheet(sheet, selectedDateISO, warnings) {
  if (!sheet || typeof XLSX === "undefined") return null;
  if (isNewBlockFormat(sheet)) {
    const result = buildNewBlockFormat(sheet, selectedDateISO, warnings, { id: "welding", name: "WELDING", expected: EXPECTED_HEADCOUNT.welding });
    return result ? result.dept : null;
  }
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  let weekday = weekdayIndex(selectedDateISO);
  if (weekday > 4) {
    warnings.push("WELDING: selected date falls on a weekend - showing Monday's block instead.");
    weekday = 0;
  }
  const blockStart = WELD_BLOCK_STARTS[weekday];
  expectHeaderNear(sheet, colOffset(blockStart, 1) + "1", ["welder", "employe", "present"], warnings, "WELDING headcount header");
  const present = cellHeadcount(getCell(sheet, colOffset(blockStart, 1) + "2"), warnings, "WELDING welders");
  const attainmentRaw = cellNumber(getCell(sheet, colOffset(blockStart, 2) + "2"), warnings, "WELDING attainment");
  const uplh = cellNumber(getCell(sheet, colOffset(blockStart, 3) + "2"), warnings, "WELDING UPLH");
  const headerText = cellText(getCell(sheet, colOffset(blockStart, 3) + "1")) || "";
  const uplhGoal = parseUplhGoalText(headerText);
  let forecast = null, actual = null;
  const materialShortageParts = [];
  for (let r = range.s.r + 3; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const labelA = cellText(getCell(sheet, "A" + rowNum));
    if (labelA && labelA.trim().toUpperCase() === "DAILY") {
      forecast = cellNumber(getCell(sheet, colOffset(blockStart, 1) + rowNum));
      actual = cellNumber(getCell(sheet, colOffset(blockStart, 2) + rowNum));
    }
    const partName = cellText(getCell(sheet, colOffset(blockStart, 0) + rowNum));
    const actualText = cellText(getCell(sheet, colOffset(blockStart, 2) + rowNum)) || "";
    const forecastText = cellText(getCell(sheet, colOffset(blockStart, 1) + rowNum)) || "";
    const statusText = cellText(getCell(sheet, colOffset(blockStart, 3) + rowNum)) || "";
    const textToSearch = (actualText + " " + forecastText + " " + statusText).toLowerCase();
    if (partName && textToSearch.includes("material") && !partName.toUpperCase().startsWith("SCRAP")) {
      const p = partName.trim();
      if (!materialShortageParts.includes(p)) materialShortageParts.push(p);
    }
  }
  const expected = EXPECTED_HEADCOUNT.welding;
  let attainmentPct;
  if (forecast !== null && forecast > 0 && actual !== null) {
    attainmentPct = Math.round(actual / forecast * 100);
  } else {
    attainmentPct = Math.round((attainmentRaw || 0) * 100);
    warnings.push("WELDING: DAILY actual/forecast row not found - attainment falls back to the sheet's UPLH-based attainment cell.");
  }
  const stats = [
    { label: "ACTUAL", value: actual !== null ? actual : "N/A", tone: "default" },
    { label: "FORECAST", value: forecast !== null ? forecast : "N/A", tone: "default" },
    { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
    { label: "UPLH GOAL", value: uplhGoal, tone: "default" }
  ];
  const notes = materialShortageParts.length > 0
    ? [{ type: "warning", label: "MATERIAL / ISSUES", content: materialShortageParts.join(" · "), customColor: "#D97706" }]
    : [];
  const weekAttainment = weekAttainmentFromBlocks(sheet, WELD_BLOCK_STARTS, weekday, range);
  return {
    id: "welding",
    name: "WELDING",
    status: statusFromAttainment(attainmentPct),
    meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
    attainment: attainmentPct,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment,
    headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
    stats,
    notes: notes.length ? notes : void 0
  };
}

// src/js/extractors/paint.js
function paintDayTotals(sheet) {
  if (!sheet || typeof XLSX === "undefined") return null;
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  let totalsRow = null;
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const cellE = getCell(sheet, "E" + rowNum);
    if (cellE && cellE.v !== void 0 && cellE.v !== null && cellE.v !== "") totalsRow = rowNum;
  }
  if (!totalsRow) return null;
  const scheduled = cellNumber(getCell(sheet, "B" + totalsRow), [], "");
  const produced = cellNumber(getCell(sheet, "Q" + totalsRow), [], "");
  return { scheduled, produced };
}
/** Week bar for paint when each day is its own tab in the paint workbook. */
function paintWeekFromSheets(sheetsByISO, selectedDateISO) {
  const monday = weekMondayISO(selectedDateISO);
  let sumSched = 0, sumProd = 0, days = 0;
  for (let d = 0; d <= weekdayIndex(selectedDateISO) && d < 5; d++) {
    const dayISO = addDaysISO(monday, d);
    if (compareISO(dayISO, selectedDateISO) > 0) break;
    const totals = paintDayTotals(sheetsByISO[dayISO]);
    if (totals && totals.scheduled !== null && totals.scheduled > 0) {
      sumSched += totals.scheduled;
      sumProd += totals.produced !== null ? totals.produced : 0;
      days++;
    }
  }
  if (days === 0 || sumSched <= 0) return null;
  return Math.round(sumProd / sumSched * 100);
}
function paintWeekAttainment(wb, selectedDateISO) {
  const monday = weekMondayISO(selectedDateISO);
  const sheets = findSheetsForDept(wb, "paint");
  let sumSched = 0, sumProd = 0, days = 0;
  for (let d = 0; d <= weekdayIndex(selectedDateISO) && d < 5; d++) {
    const dayISO = addDaysISO(monday, d);
    if (compareISO(dayISO, selectedDateISO) > 0) break;
    const match = sheets.find((s) => s.dateISO === dayISO);
    if (!match) continue;
    const totals = paintDayTotals(wb.Sheets[match.name]);
    if (totals && totals.scheduled !== null && totals.scheduled > 0) {
      sumSched += totals.scheduled;
      sumProd += totals.produced !== null ? totals.produced : 0;
      days++;
    }
  }
  if (days === 0 || sumSched <= 0) return null;
  return Math.round(sumProd / sumSched * 100);
}
function buildPaint(wb, selectedDateISO, warnings) {
  const sheetName = selectPaintSheet(wb, selectedDateISO, warnings);
  if (!sheetName) return null;
  return buildPaintFromSheet(wb.Sheets[sheetName], paintWeekAttainment(wb, selectedDateISO), selectedDateISO, warnings);
}
// The color in the booth is the one where painted pieces (column Q) were entered
// last: when numbers start going into another color, the line has changed color.
// The source remembers each color's painted total between reads of the sheet, so a
// color whose total went up becomes the current one wherever it sits on the sheet.
// With nothing to compare yet (first read after a reload) it takes the lowest color
// on the sheet that has painted pieces, then the top color if none has started.
var paintColorMemory = { date: null, done: {}, current: null };
function pickPaintColor(dateISO, sections) {
  const mem = paintColorMemory;
  if (mem.date !== dateISO) { mem.date = dateISO; mem.done = {}; mem.current = null; }
  const top = sections[0].name;
  // A color listed twice on the sheet counts as one, placed at its lowest listing.
  const merged = [];
  for (const s of sections) {
    const i = merged.findIndex((m) => m.name === s.name);
    const prev = i === -1 ? 0 : merged.splice(i, 1)[0].done;
    merged.push({ name: s.name, done: prev + s.done });
  }
  sections = merged;
  const firstRead = Object.keys(mem.done).length === 0;
  const grew = firstRead ? [] : sections.filter((s) => s.done > (mem.done[s.name] || 0));
  const started = sections.filter((s) => s.done > 0);
  let current;
  if (grew.length) current = grew[grew.length - 1].name;
  else if (mem.current && sections.some((s) => s.name === mem.current && s.done > 0)) current = mem.current;
  else if (started.length) current = started[started.length - 1].name;
  else current = top;
  mem.done = {};
  for (const s of sections) mem.done[s.name] = s.done;
  mem.current = current;
  return current;
}
function buildPaintFromSheet(sheet, weekAttainmentPct, selectedDateISO, warnings) {
  if (!sheet || typeof XLSX === "undefined") return null;
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  // The header values are found by their labels on the top rows, so an inserted column
  // doesn't shift them; G1/I1/K1/O1 are the fallback when a label isn't there.
  const headerAddr = (re, fallback, what) => {
    const addr = findLabeledValue(sheet, re, 1, 3, "Z");
    if (!addr) warnings.push("PAINT: " + what + " label not found - using " + fallback + ".");
    return addr || fallback;
  };
  const presentAddr = headerAddr(/employe|present|worker/i, "G1", "EMPLOYEES");
  const goalAddr = headerAddr(/uplh\s*goal|goal\s*uplh/i, "I1", "UPLH GOAL");
  const uplhAddr = headerAddr(/^(?:daily\s*)?uplh\b(?!.*goal)/i, "K1", "UPLH");
  const pctAddr = findLabeledValue(sheet, /(?:%|pct|percent)\s*(?:to\s*)?goal/i, 1, 3, "Z") || "O1";
  const present = cellHeadcount(getCell(sheet, presentAddr), warnings, "PAINT employees");
  const uplhGoal = cellNumber(getCell(sheet, goalAddr), warnings, "PAINT UPLH goal");
  const uplh = cellNumber(getCell(sheet, uplhAddr), warnings, "PAINT daily UPLH");
  const pctToGoal = cellNumber(getCell(sheet, pctAddr), warnings, "PAINT pct to goal");
  let totalsRow = null;
  let scheduled = null, actual = null, productionPct = null;
  // The totals row is the one labelled TOTAL in column A; "the last row with anything in
  // column E" is only the fallback, since a note typed below the totals would win it.
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    if (/^total\b/i.test((cellText(getCell(sheet, "A" + rowNum)) || "").trim()) && (cellNumber(getCell(sheet, "B" + rowNum), null, "") !== null || cellNumber(getCell(sheet, "Q" + rowNum), null, "") !== null)) totalsRow = rowNum;
  }
  if (!totalsRow) for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const cellE = getCell(sheet, "E" + rowNum);
    if (cellE && cellE.v !== void 0 && cellE.v !== null && cellE.v !== "") {
      totalsRow = rowNum;
    }
  }
  if (totalsRow) {
    scheduled = cellNumber(getCell(sheet, "B" + totalsRow), warnings, "PAINT scheduled total");
    actual = cellNumber(getCell(sheet, "Q" + totalsRow), warnings, "PAINT produced total");
    productionPct = cellNumber(getCell(sheet, "R" + totalsRow), warnings, "PAINT production pct");
  } else {
    warnings.push("PAINT: could not find a totals row (column E never populated) - scheduled/produced totals unavailable.");
  }
  // DAILY ATT. = painted / scheduled, like every other card.
  let attainmentPct = 0;
  if (scheduled > 0 && actual !== null) attainmentPct = Math.round(actual / scheduled * 100);
  else if (productionPct !== null) attainmentPct = Math.round(productionPct * 100);
  else if (pctToGoal !== null) {
    attainmentPct = Math.round(pctToGoal * 100);
    warnings.push("PAINT: no painted/scheduled totals - DAILY ATT. uses the sheet's % to goal.");
  }
  const NON_COLOR_LABELS = /* @__PURE__ */ new Set(["DOWNTIME", "DOWNTIME:", "SCRAP", "SCRAP:", "REASON", "REASON:", "TOTAL", "TOTAL:"]);
  const sectionScanLimit = totalsRow || range.e.r + 1;
  const sectionStarts = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    if (rowNum >= sectionScanLimit) break;
    const aText = cellText(getCell(sheet, "A" + rowNum));
    const bCell = getCell(sheet, "B" + rowNum);
    const bEmpty = !bCell || bCell.v === void 0 || bCell.v === null;
    if (aText && /[A-Z]/.test(aText) && aText.trim() === aText.trim().toUpperCase() && bEmpty && !NON_COLOR_LABELS.has(aText.trim())) {
      const colorName = aText.trim();
      if (PAINT_COLOR_MAP[colorName] || colorName === "GALV.") {
        sectionStarts.push({ row: rowNum, name: colorName });
      }
    }
  }
  let currentColorName = null;
  if (sectionStarts.length > 0) {
    const sectionTotals = sectionStarts.map((section, i) => {
      const start = section.row;
      const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1].row : totalsRow || range.e.r + 1;
      let sectionTotal = 0, sectionSched = 0, sectionDone = 0, hasSched = false;
      for (let rr = start; rr < end; rr++) {
        const qVal = cellNumber(getCell(sheet, "Q" + rr), [], "");
        const fVal = cellNumber(getCell(sheet, "F" + rr), [], "");
        const bVal = cellNumber(getCell(sheet, "B" + rr), [], "");
        if (qVal !== null) sectionTotal += qVal;
        else if (fVal !== null) sectionTotal += fVal;
        if (qVal !== null && qVal > 0) sectionDone += qVal;
        if (bVal !== null && bVal > 0) { hasSched = true; sectionSched += bVal; }
      }
      return { name: section.name, total: sectionTotal, scheduled: sectionSched, done: sectionDone, hasSched };
    });
    currentColorName = pickPaintColor(selectedDateISO, sectionTotals);
  }
  let downtimeMins = 0;
  const downtimeMessages = [];
  let inDowntime = false;
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const rowNum = r + 1;
    const cellA = cellText(getCell(sheet, "A" + rowNum)) || "";
    const aNorm = cellA.trim().toUpperCase();
    if (aNorm.includes("DOWNTIME")) {
      inDowntime = true;
      continue;
    }
    if (inDowntime) {
      if (aNorm === "SCRAP" || aNorm.startsWith("TOTAL") || aNorm === "SCRAP:") {
        inDowntime = false;
        continue;
      }
      if (aNorm === "" || aNorm === "REASON" || aNorm === "REASON:") continue;
      const fullText = (cellA + " " + (cellText(getCell(sheet, "B" + rowNum)) || "") + " " + (cellText(getCell(sheet, "C" + rowNum)) || "") + " " + (cellText(getCell(sheet, "Q" + rowNum)) || "")).trim();
      // Every range on the row counts: "6:45–7:00", "9:10 - 9:40 and 1:00-1:20", "9:10am to 9:40am".
      const ranges = Array.from(fullText.matchAll(/(\d{1,2}):(\d{2})\s*(am|pm)?\s*(?:-|\u2013|\u2014|to)\s*(\d{1,2}):(\d{2})\s*(am|pm)?/gi));
      if (ranges.length) {
        const toMin = (h, m, ap) => { h = parseInt(h, 10) % 12; if (ap && /pm/i.test(ap)) h += 12; else if (!ap && h < SHIFT_START_HOUR) h += 12; return h * 60 + parseInt(m, 10); };
        for (const t of ranges) {
          let diff = toMin(t[4], t[5], t[6] || t[3]) - toMin(t[1], t[2], t[3]);
          if (diff < 0) diff += 12 * 60;
          if (diff < 12 * 60) downtimeMins += diff;
        }
        downtimeMessages.push(fullText);
      } else if (fullText.length > 3) {
        downtimeMessages.push(fullText);
      }
    }
  }
  const expected = EXPECTED_HEADCOUNT.paint;
  const currentColor = currentColorName ? PAINT_COLOR_MAP[currentColorName] || { name: currentColorName, hex: "#888888", gradient: "linear-gradient(90deg, #013449, #888888)" } : void 0;
  const stats = [
    { label: "PAINTED", value: actual !== null ? actual : "N/A", tone: "default" },
    { label: "SCHEDULED", value: scheduled !== null ? scheduled : "N/A", tone: "default" },
    { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
    { label: "GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" }
  ];
  const notes = [];
  if (downtimeMessages.length > 0) {
    stats.push({ label: "DOWNTIME", value: downtimeMins > 0 ? downtimeMins + " MINS" : "ACTIVE", tone: downtimeMins > 0 ? "yellow" : "default" });
    notes.push({ type: "warning", label: "DOWNTIME LOG", content: downtimeMessages.join(" \xB7 "), customColor: "#D97706" });
  }
  const weekAttainment = weekAttainmentPct;
  return {
    id: "paint",
    name: "PAINT",
    status: statusFromAttainment(attainmentPct),
    meta: "CURRENT DAY ONLY",
    attainment: attainmentPct,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment,
    headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
    stats,
    notes: notes.length ? notes : void 0,
    currentColor
  };
}

// src/js/extractors/tanks.js
function buildTanks(wb, selectedDateISO, warnings) {
  const sheetName = selectWeeklySheet(wb, "tank", selectedDateISO, warnings, "TANKS");
  if (!sheetName) return null;
  return buildTanksFromSheet(wb.Sheets[sheetName], selectedDateISO, warnings);
}
function buildTanksFromSheet(sheet, selectedDateISO, warnings) {
  if (!sheet || typeof XLSX === "undefined") return null;
  // Tanks stacks two rows of day-blocks (Mon-Wed on row 1, Thu-Fri on row 15), so the
  // day is found by its date under the "DATE" label rather than by a fixed map.
  const tankBlocks = findDateBlocks(sheet, /^date:?$/i);
  let tankBlock = blockForDate(tankBlocks, selectedDateISO);
  if (!tankBlock && tankBlocks.length) {
    // Same rule as FAB/WELDING: never show another day's block as today.
    warnings.push("TANKS: no block dated " + selectedDateISO + " on this sheet.");
    return null;
  }
  if (!tankBlock) {
    // Same rule as FAB/WELDING: no guessed columns.
    warnings.push("TANKS: no block dated " + selectedDateISO + " on this sheet (no dated day-blocks found - check the dates under DATE).");
    return null;
  }
  const headerRow = tankBlock.labelRow, colStart = tankBlock.col;
  const valueRow = headerRow + 1;
  // The SCHEDULED PROD. / TOTAL PROD. rows are found by their labels, so an added part
  // row moves them down instead of reading the wrong cells. Fixed offsets are the fallback.
  let scheduledProdRow = headerRow + 10;
  let totalProdRow = headerRow + 11;
  let foundSched = false, foundTotal = false;
  for (let r = headerRow + 3; r <= headerRow + 25; r++) {
    for (let off = 0; off <= 5; off++) {
      const t = getRawText(getCell(sheet, colOffset(colStart, off) + r)).trim();
      if (!foundSched && /^scheduled\s*prod/i.test(t)) { scheduledProdRow = r; foundSched = true; }
      else if (!foundTotal && /^total\s*prod/i.test(t)) { totalProdRow = r; foundTotal = true; }
    }
  }
  if (!foundSched || !foundTotal) warnings.push("TANKS: SCHEDULED PROD. / TOTAL PROD. labels not found - using the default rows.");
  // Header columns by label (EMPLOYEES / ATTAINMENT / UPLH / UPLH GOAL), value on the row
  // below; the usual positions 1-4 are the fallback.
  const headerCol = (re, fallback, what) => {
    for (let off = 0; off <= 7; off++) {
      if (re.test(getRawText(getCell(sheet, colOffset(colStart, off) + headerRow)).trim())) return off;
    }
    warnings.push("TANKS: " + what + " header not found - using the default column.");
    return fallback;
  };
  const presentCol = headerCol(/employe|present|worker/i, 1, "EMPLOYEES");
  const attCol = headerCol(/attain|%\s*(?:to\s*)?(?:goal|sched)/i, 2, "ATTAINMENT");
  const uplhCol = headerCol(/^(?:daily\s*)?uplh\b(?!.*goal)/i, 3, "UPLH");
  const goalCol = headerCol(/uplh\s*goal|goal\s*uplh/i, 4, "UPLH GOAL");
  const present = cellHeadcount(getCell(sheet, colOffset(colStart, presentCol) + valueRow), warnings, "TANKS employee count");
  const attainmentRaw = cellNumber(getCell(sheet, colOffset(colStart, attCol) + valueRow), warnings, "TANKS attainment");
  const uplh = cellNumber(getCell(sheet, colOffset(colStart, uplhCol) + valueRow), warnings, "TANKS UPLH");
  const uplhGoal = cellNumber(getCell(sheet, colOffset(colStart, goalCol) + valueRow), warnings, "TANKS UPLH goal");
  let scheduled = cellNumber(getCell(sheet, colOffset(colStart, 5) + scheduledProdRow), warnings, "TANKS scheduled prod");
  let production = cellNumber(getCell(sheet, colOffset(colStart, 5) + totalProdRow), warnings, "TANKS total prod");
  let calcTankSched = 0;
  let calcTankProd = 0;
  let currentPart = "UNKNOWN";
  for (let r = headerRow + 3; r < Math.min(scheduledProdRow, totalProdRow); r++) {
    const partName = cellText(getCell(sheet, colOffset(colStart, 0) + r));
    if (!partName || partName.trim().toUpperCase().startsWith("SCRAP") || partName.trim().toUpperCase().includes("TOTAL")) continue;
    const sVal = cellNumber(getCell(sheet, colOffset(colStart, 1) + r), [], "");
    const pVal = cellNumber(getCell(sheet, colOffset(colStart, 5) + r), [], "");
    if (sVal) calcTankSched += sVal;
    if (pVal) calcTankProd += pVal;
    if (partName.trim() && currentPart === "UNKNOWN") {
      const s = sVal || 0;
      const p = pVal || 0;
      if (s > 0 && p < s) {
        currentPart = partName.trim();
      }
    }
  }
  if (scheduled === null || scheduled === 0) scheduled = calcTankSched;
  if (production === null || production === 0) production = calcTankProd;
  const weekScheduled = cellNumber(getCell(sheet, "Q15"), warnings, "TANKS week scheduled");
  const weekProduced = cellNumber(getCell(sheet, "Q17"), warnings, "TANKS week produced");
  let weekPct = null;
  if (weekScheduled && weekProduced !== null) {
    weekPct = Math.round(weekProduced / weekScheduled * 100);
  }
  const expected = EXPECTED_HEADCOUNT.tanks;
  // DAILY ATT. means the same on every card: production / scheduled. The sheet's own
  // cell is only the fallback when the totals are missing.
  const attainmentPct = scheduled > 0 && production !== null ? Math.round(production / scheduled * 100) : Math.round((attainmentRaw || 0) * 100);
  if (currentPart === "UNKNOWN" && (scheduled > 0 && production >= scheduled || attainmentPct >= 100)) {
    currentPart = "\u2713 COMPLETE";
  }
  const notes = [];
  const tankIssueTexts = [];
  const tankRange = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
  const notesFrom = Math.min(scheduledProdRow, totalProdRow);
  for (let r = notesFrom; r <= Math.min(notesFrom + 3, tankRange.e.r + 1); r++) {
    for (let offset = 0; offset <= 5; offset++) {
      const raw = getRawText(getCell(sheet, colOffset(colStart, offset) + r)).trim();
      if (!raw || /^(?:DOWNTIME|REASON|SCHEDULED PROD\.?|TOTAL PROD\.?):?$/i.test(raw)) continue;
      if (!/[A-Za-z0-9]/.test(raw)) continue;
      if (/^-?\d+(?:\.\d+)?%?$/.test(raw) || ERROR_STRINGS.has(raw.toUpperCase()) || /^#[A-Z\/0!?_]+[!?]?$/.test(raw)) continue;
      if (tankIssueTexts.indexOf(raw) === -1) tankIssueTexts.push(raw);
    }
  }
  if (tankIssueTexts.length) notes.push({ type: "warning", label: "DOWNTIME / REASON", content: tankIssueTexts.join(" · "), customColor: "#D97706" });
  const stats = [
    { label: "PRODUCTION", value: production !== null ? production : "N/A", tone: "default" },
    { label: "SCHEDULED", value: scheduled !== null ? scheduled : "N/A", tone: "default" },
    { label: "UPLH", value: uplh !== null ? uplh : "N/A", tone: "default" },
    { label: "GOAL", value: uplhGoal !== null ? uplhGoal : "N/A", tone: "default" },
    { label: "WORKING ON", value: currentPart, tone: "green" }
  ];
  return {
    id: "tanks",
    name: "TANKS",
    status: statusFromAttainment(attainmentPct),
    meta: "DAILY GRID + LAYERS A B C",
    attainment: attainmentPct,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment: weekPct !== null ? weekPct : void 0,
    headline: { icon: "\u{1F464}", active: present, total: expected, label: "PRESENT / EXPECTED", countsAsPersonnel: true, down: present === 0 },
    stats,
    notes: notes.length ? notes : void 0
  };
}
