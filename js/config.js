// Settings, plant clock, department sources and the sample data.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

// &schedule=off (testing / troubleshooting): fast checks around the clock, no weekend screen.
var SCHEDULE_OFF = /[?&]schedule=off(&|$)/.test(location.search);
var SHIFT_START_HOUR = 5;
var SHIFT_END_HOUR = 15;
var SHIFT_END_MINUTE = 30;
// Shift times are plant wall-clock times. Every screen uses the plant's time zone -
// the source PC's own, carried in the feed - instead of whatever zone its device
// happens to be set to, so a TV box set up with the wrong zone still shows the right
// SHIFT TIME LEFT, projection and clock. &tz=Area/City in the link overrides it.
var plantTimeZone = null;
var plantTzFormatter = null;
var plantTzFromUrl = false;
function setPlantTimeZone(tz) {
  if (!tz || tz === plantTimeZone) return;
  try {
    plantTzFormatter = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    plantTimeZone = tz;
  } catch (err) {
    // Unknown zone name: keep using the device's own clock.
  }
}
/** Now, as a Date whose local fields (getHours() etc.) read the plant's wall clock. */
function plantNow() {
  const real = new Date();
  if (!plantTzFormatter) return real;
  const p = {};
  for (const part of plantTzFormatter.formatToParts(real)) p[part.type] = part.value;
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second), real.getMilliseconds());
}
function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (err) { return null; }
}
(function () {
  const m = /[?&]tz=([^&]+)/.exec(location.search);
  if (m) { setPlantTimeZone(decodeURIComponent(m[1])); plantTzFromUrl = plantTimeZone !== null; }
})();
var EXPECTED_HEADCOUNT = { welding: 16, paint: 10, tanks: 7, fab: 4 };
var WELD_BLOCK_STARTS = ["A", "E", "I", "M", "Q"];
var FAB_BLOCK_STARTS = ["A", "F", "K", "P", "U"];
// "UPLH Goal - 4.38", "UPLH Goal: 4.38 pcs", "UPLH GOAL .45", "UPLH Goal 4,38".
var UPLH_GOAL_TEXT_RE = /uplh\s*goal\D*?(\d*[.,]?\d+)/i;
function parseUplhGoalText(text) {
  const m = UPLH_GOAL_TEXT_RE.exec(String(text || "")) || /(\d*[.,]?\d+)\s*$/.exec(String(text || "").trim());
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
var PAINT_COLOR_MAP = {
  BLACK: { name: "BLACK", hex: "#1A1A1A", gradient: "linear-gradient(90deg, #013449, #1A1A1A)" },
  GREEN: { name: "GREEN", hex: "#16A34A", gradient: "linear-gradient(90deg, #013449, #16A34A)" },
  BROWN: { name: "BROWN", hex: "#7C4A2D", gradient: "linear-gradient(90deg, #013449, #7C4A2D)" },
  RED: { name: "RED", hex: "#D32026", gradient: "linear-gradient(90deg, #013449, #D32026)" },
  BLUE: { name: "BLUE", hex: "#1D4ED8", gradient: "linear-gradient(90deg, #013449, #1D4ED8)" },
  WHITE: { name: "WHITE", hex: "#E5E5E5", gradient: "linear-gradient(90deg, #013449, #E5E5E5)" },
  GRAY: { name: "GRAY", hex: "#6B7280", gradient: "linear-gradient(90deg, #013449, #6B7280)" },
  GREY: { name: "GREY", hex: "#6B7280", gradient: "linear-gradient(90deg, #013449, #6B7280)" },
  YELLOW: { name: "YELLOW", hex: "#EAB308", gradient: "linear-gradient(90deg, #013449, #EAB308)" },
  ORANGE: { name: "ORANGE", hex: "#F97316", gradient: "linear-gradient(90deg, #013449, #F97316)" },
  TAN: { name: "TAN", hex: "#C1B087", gradient: "linear-gradient(90deg, #013449, #C1B087)" },
  BEIGE: { name: "BEIGE", hex: "#C1B087", gradient: "linear-gradient(90deg, #013449, #C1B087)" },
  GALV: { name: "GALV", hex: "#B0B7BD", gradient: "linear-gradient(90deg, #013449, #B0B7BD)" },
  "GALV.": { name: "GALV", hex: "#B0B7BD", gradient: "linear-gradient(90deg, #013449, #B0B7BD)" }
};
var ERROR_STRINGS = /* @__PURE__ */ new Set(["#DIV/0!", "#NAME?", "#REF!", "#VALUE!", "#N/A", "#NULL!", "#NUM!", "#SPILL!", "#CALC!", "#GETTING_DATA", "#FIELD!", "#BLOCKED!", "#CONNECT!", "#BUSY!", "#UNKNOWN!"]);
var SHEET_DATE_RE = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/;
var CELL_DATE_RE = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/;
// One workbook per department, named for the department; the tabs inside are named
// only with a date. Paint keeps one tab per day, the rest one tab per week (Monday).
var DEPT_SOURCES = [
  { id: "fab", label: "FAB", fileMatch: /fab/i, cadence: "week" },
  { id: "welding", label: "WELDING", fileMatch: /weld/i, cadence: "week" },
  { id: "paint", label: "PAINT", fileMatch: /paint/i, cadence: "day" },
  { id: "tanks", label: "TANKS", fileMatch: /tank/i, cadence: "week" }
];
var sampleDepartmentData = [
  {
    id: "fab",
    name: "FAB",
    status: "on_target",
    meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
    attainment: 84,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment: 79,
    headline: { icon: "\u{1F464}", active: 4, total: 4, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
    stats: [
      { label: "ACTUAL", value: "3502", tone: "default" },
      { label: "FORECAST", value: "4172", tone: "default" },
      { label: "UPLH", value: "38.2", tone: "default" },
      { label: "UPLH GOAL", value: "45.3", tone: "default" }
    ]
  },
  {
    id: "welding",
    name: "WELDING",
    status: "on_target",
    meta: "MON\u2013FRI \xB7 CURRENT DAY ONLY",
    attainment: 84,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment: 88,
    headline: { icon: "\u{1F464}", active: 16, total: 16, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
    stats: [
      { label: "ACTUAL", value: "185", tone: "default" },
      { label: "FORECAST", value: "220", tone: "default" },
      { label: "UPLH", value: "3.8", tone: "default" },
      { label: "UPLH GOAL", value: "4.0", tone: "default" }
    ],
    notes: [{ type: "warning", label: "MATERIAL / ISSUES", content: "EHSPBR4W · 6GG16W", customColor: "#D97706" }]
  },
  {
    id: "paint",
    name: "PAINT",
    status: "at_risk",
    meta: "CURRENT DAY ONLY",
    attainment: 74,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment: 81,
    headline: { icon: "\u{1F464}", active: 8, total: 10, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
    stats: [
      { label: "PAINTED", value: "620", tone: "default" },
      { label: "SCHEDULED", value: "840", tone: "default" },
      { label: "UPLH", value: "77", tone: "default" },
      { label: "GOAL", value: "84", tone: "default" },
      { label: "DOWNTIME", value: "30 MINS", tone: "yellow" }
    ],
    notes: [{ type: "warning", label: "DOWNTIME LOG", content: "Change color 5:25am-5:55am \xB7 paintbooth motor 6:10am", customColor: "#D97706" }],
    currentColor: { name: "GREEN", hex: "#16A34A", gradient: "linear-gradient(90deg, #013449, #16A34A)" }
  },
  {
    id: "tanks",
    name: "TANKS",
    status: "at_risk",
    meta: "DAILY GRID + LAYERS A B C",
    attainment: 69,
    attainmentLabel: "DAILY ATTAINMENT",
    weekAttainment: 72,
    headline: { icon: "\u{1F464}", active: 4, total: 7, label: "PRESENT / EXPECTED", countsAsPersonnel: true },
    stats: [
      { label: "PRODUCTION", value: "38", tone: "default" },
      { label: "SCHEDULED", value: "55", tone: "default" },
      { label: "UPLH", value: "3.2", tone: "default" },
      { label: "GOAL", value: "3.5", tone: "default" },
      { label: "WORKING ON", value: "SWT313", tone: "green" }
    ]
  }
];
var overallAttainmentMock = { actual: 1719, target: 2274, percent: 76 };
// Demo numbers follow the clock, so the sample board (source PC before it loads data,
// ?preview=1) shows believable paces at any hour instead of 190% at 8 AM.
var SAMPLE_PACE = { fab: 0.95, welding: 0.86, paint: 0.7, tanks: 1.04 };
function sampleDepartmentsNow() {
  const frac = Math.max(0.05, shiftProjectionContext(todayISO()).fraction);
  return sampleDepartmentData.map((d) => {
    const c = JSON.parse(JSON.stringify(d));
    const goal = c.stats.find((x) => x.label === "UPLH GOAL" || x.label === "GOAL");
    const uplh = c.stats.find((x) => x.label === "UPLH");
    if (goal && uplh) uplh.value = String(Math.round(Number(goal.value) * (SAMPLE_PACE[c.id] || 1) * frac * 10) / 10);
    return c;
  });
}
