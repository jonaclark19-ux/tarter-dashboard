// Daily Production Board data, built on the source PC next to the TV dashboard data.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).
//
// The board shows the PREVIOUS workday (what the 8:30 AM meeting reviews). It combines:
//   - the department workbooks, parsed again for that day (attainment, UPLH, headcount),
//   - the Load Sign Off (loads, pieces, shorts),
//   - "Daily Board Input.xlsx": one sheet laid out like the board where supervisors type
//     what no other file has (OT, 5S, quality, issues...). Every input cell has a defined
//     name (OT_FAB, QUALITY_WELD, TOPSIX_PART_1...), so it is read by name, not position.

var BOARD_INPUT_RE = /daily\s*board\s*input/i;
var BOARD_AREAS = ["FAB", "WELD", "PAINT", "MAINT", "TANKS", "LOAD", "INV", "ASSY"];
// Board area -> TV dashboard department id.
var BOARD_DEPT_IDS = { FAB: "fab", WELD: "welding", PAINT: "paint", TANKS: "tanks" };

/** The workday before the plant's today: Monday (and the weekend) look back to Friday. */
function previousWorkdayISO(todayIso) {
  const back = { 0: 2, 1: 3, 6: 1 }[isoToUTCDate(todayIso).getUTCDay()] || 1;
  return addDaysISO(todayIso, -back);
}

/** { NAME: value } for every defined name in the input workbook. Dates come back as ISO days. */
function parseBoardInput(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const names = (wb.Workbook && wb.Workbook.Names) || [];
  const values = {};
  for (const n of names) {
    if (!n || !n.Name || !n.Ref || n.Sheet !== undefined && n.Sheet !== null) continue;
    const m = /^'?(.+?)'?!\$?([A-Z]{1,3})\$?(\d+)$/.exec(String(n.Ref));
    if (!m) continue;
    const sheet = wb.Sheets[m[1]];
    const cell = sheet && sheet[m[2] + m[3]];
    if (!cell || cell.v === undefined || cell.v === null || cell.t === "e") continue;
    let v;
    if (cell.v instanceof Date) v = cellDayISO(cell);
    else if (typeof cell.v === "number") v = Number.isFinite(cell.v) ? cell.v : null;
    else v = String(cell.v).trim().slice(0, 120);
    if (v !== null && v !== "") values[String(n.Name).toUpperCase()] = v;
  }
  return values;
}

function statNumber(dept, labels) {
  const s = (dept.stats || []).find((x) => labels.indexOf(String(x.label).toUpperCase()) !== -1);
  if (!s) return null;
  const n = typeof s.value === "number" ? s.value : parseFloat(String(s.value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** What the board needs from one TV-dashboard department card. */
function boardDeptFrom(dept) {
  const actual = statNumber(dept, ["ACTUAL", "PAINTED", "PRODUCTION"]);
  const forecast = statNumber(dept, ["FORECAST", "SCHEDULED"]);
  const uplh = statNumber(dept, ["UPLH"]);
  const goal = statNumber(dept, ["UPLH GOAL", "GOAL"]);
  const h = dept.headline || {};
  return {
    attainment: typeof dept.attainment === "number" ? dept.attainment : null,
    efficiency: uplh !== null && goal ? Math.round(uplh / goal * 100) : null,
    actual,
    forecast,
    present: typeof h.active === "number" ? h.active : null,
    expected: typeof h.total === "number" ? h.total : null,
    down: h.down === true
  };
}

/**
 * The board for reportIso. deptResult is buildDashboardFromFiles() for that day (or null),
 * loadingBooks the parsed Load Sign Off workbooks, input the parsed Daily Board Input.
 */
function buildBoard(reportIso, deptResult, loadingBooks, input, inputMeta) {
  const areas = {};
  let sumActual = 0, sumForecast = 0;
  for (const key of Object.keys(BOARD_DEPT_IDS)) {
    const id = BOARD_DEPT_IDS[key];
    const dept = deptResult && (deptResult.departments || []).find((d) => d.id === id);
    if (dept) {
      areas[key] = boardDeptFrom(dept);
      if (!areas[key].down && areas[key].forecast > 0) {
        sumForecast += areas[key].forecast;
        sumActual += areas[key].actual || 0;
      }
    } else {
      const miss = deptResult && (deptResult.missing || []).find((d) => d.id === id);
      areas[key] = { missing: miss ? miss.reason : "No data for this day" };
    }
  }

  // Loading: that day's sign-off tab, and the week's short products through that day.
  let loading = null;
  const byDay = new Map();
  for (const b of loadingBooks || []) for (const d of (b && b.days) || []) if (d && d.iso && !byDay.has(d.iso)) byDay.set(d.iso, d);
  const day = byDay.get(reportIso);
  const week = loadingFor(loadingBooks, reportIso);
  if (day || week) {
    loading = {
      loads: day ? day.loads : null,
      pieces: day ? day.pieces : null,
      shorts: day ? day.shorts : null,
      inFull: day && day.pieces > 0 ? Math.round((day.pieces - (day.shorts || 0)) / day.pieces * 100) : null,
      pcsPerLoad: day && day.loads > 0 ? Math.round(day.pieces / day.loads) : null,
      topShorts: week ? week.shorts.slice(0, 6) : [],
      weekStart: week ? week.weekStart : weekMondayISO(reportIso)
    };
  }

  return {
    reportDate: reportIso,
    areas,
    adherence: sumForecast > 0 ? Math.round(sumActual / sumForecast * 100) : null,
    loading,
    input: input || null,
    inputFile: inputMeta && inputMeta.fileName ? inputMeta.fileName : null,
    inputSavedAt: inputMeta && typeof inputMeta.savedAt === "number" ? new Date(inputMeta.savedAt).toISOString() : null,
    warnings: deptResult && deptResult.warnings ? deptResult.warnings.slice(0, 20) : []
  };
}
