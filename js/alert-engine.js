// AlertEngine: one status per department (pace, goal met, crew shortage).
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

var AlertEngine = class {
  constructor(dept, elapsedMinutes, totalShiftMinutes = 630) {
    this.dept = dept;
    this.elapsed = elapsedMinutes;
    this.elapsedHours = Math.max(0, this.elapsed / 60);
    this.remaining = Math.max(0, totalShiftMinutes - this.elapsed);
    this.hoursRemaining = this.remaining / 60;
    this.uplhCurrent = this._findStat(["UPLH"]);
    this.uplhGoal = this._findStat(["UPLH GOAL", "GOAL"]);
    this.uplhPace = uplhPaceNow(dept, this.uplhCurrent, this.uplhGoal);
    this.produced = this._findStat(["ACTUAL", "PAINTED", "PRODUCTION", "DONE QTY"]);
    this.scheduled = this._findStat(["FORECAST", "SCHEDULED", "TOTAL QTY"]);
    this.personnelActive = dept.headline && dept.headline.countsAsPersonnel ? dept.headline.active : null;
    this.personnelExpected = dept.headline && dept.headline.countsAsPersonnel ? dept.headline.total : null;
  }
  _findStat(labels) {
    if (!this.dept || !this.dept.stats) return null;
    for (const label of labels) {
      const stat = this.dept.stats.find((s) => s.label === label);
      if (stat !== void 0 && stat.value !== "N/A") {
        const val = parseFloat(stat.value);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  }
  /**
   * One status per department, driven by the TO UPLH GOAL pace: green from PACE_GREEN,
   * amber from PACE_AMBER, red below. A crew shortage can raise it. The badge, the top
   * border, the card colors and the plant alerts all read this one answer.
   */
  diagnose() {
    const ok = { level: 1, tone: "green", color: "bg-slate-50 border-green-500 text-slate-500", animate: "", icon: "\u2713", title: "ON PACE", message: "ON PACE" };
    if (this.dept.placeholder || isDeptDown(this.dept)) return Object.assign({}, ok, { tone: "neutral", title: "", message: "" });
    const shift = shiftProjectionContext(selectedDateISO());
    // Live = the shift has started and isn't over (before 5:00 people are still arriving).
    const live = !shift.isHistorical && !shift.complete && shift.elapsedMinutes > 0;
    const pace = this.uplhPace;
    let st;
    if (this.uplhCurrent === null || this.uplhGoal === null || !(this.uplhGoal > 0)) {
      st = { level: 2, tone: "amber", color: "bg-amber-400 border-amber-400 text-amber-900", animate: "", icon: "?", title: "CHECK SHEET", message: "UPLH MISSING" };
    } else if (!pace || pace.pct === null) {
      st = Object.assign({}, ok, { tone: "neutral", title: "BUILDING", message: "BUILDING", level: 1 });
    } else if (this.scheduled > 0 && this.produced !== null && this.produced >= this.scheduled) {
      st = { level: 1, tone: "green", color: "bg-green-600 border-green-600 text-white", animate: "", icon: "\u2713", title: "GOAL MET", message: "GOAL MET", showBadge: true };
    } else if (pace.pct >= PACE_GREEN) {
      st = ok;
    } else if (pace.pct >= PACE_AMBER) {
      st = { level: 2, tone: "amber", color: "bg-amber-400 border-amber-400 text-amber-900", animate: "", icon: "\u25BC", title: "BEHIND PACE", message: "BEHIND PACE" };
    } else {
      // Red border and UPLH block only: no badge or pulse on the card for a slow pace.
      st = { level: 4, tone: "red", color: "bg-red-600 border-red-600 text-white", animate: "", icon: "\u2716", title: "CRITICAL", message: "CRITICAL PACE", noBadge: true };
    }
    const paceTone = st.tone;
    // Missing people only matter on a live shift, and only until 10:00 AM; a weekend or
    // past day never alerts.
    if (live && plantNow().getHours() < PERSONNEL_SHORTAGE_HIDE_AFTER_HOUR && this.personnelActive !== null && this.personnelExpected > 0 && this.personnelActive < this.personnelExpected) {
      const missing = this.personnelExpected - this.personnelActive;
      const level = missing / this.personnelExpected >= 0.25 ? 4 : 3;
      if (level >= st.level) {
        st = { level, tone: level === 4 ? "red" : "orange", color: level === 4 ? "bg-red-600 border-red-600 text-white" : "bg-orange-500 border-orange-500 text-white", animate: level === 4 ? "animate-pulse-border" : "", icon: "\u26A0", title: "SHORTAGE", message: `${missing} MISSING`, missing };
      }
    }
    // The hero (UPLH) block is colored by the pace alone, even when a shortage owns the badge.
    st.paceTone = paceTone;
    return st;
  }
};
