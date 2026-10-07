// Timing table page (/tiempos). Separate file so the Content-Security-Policy can forbid inline scripts.
  function fmtS(v) { return v === null || v === undefined ? "–" : v + " s"; }
  function cls(v, good, ok) { return v === null || v === undefined ? "mute" : v <= good ? "ok" : v <= ok ? "warn" : "bad"; }
  function hhmmss(iso) { return iso ? new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "–"; }
  function el(tag, text, className) { const e = document.createElement(tag); e.textContent = text; if (className) e.className = className; return e; }

  async function load() {
    const err = document.getElementById("err");
    let data;
    try {
      const r = await fetch("/api/timing?limit=30", { cache: "no-store" });
      data = await r.json();
      if (!r.ok) throw new Error(data.message || ("HTTP " + r.status));
      err.textContent = "";
    } catch (e) { err.textContent = "No se pudo leer: " + e.message; return; }

    document.getElementById("m1").textContent = fmtS(data.medians.excelToDashboard);
    document.getElementById("m2").textContent = fmtS(data.medians.dashboardToScreens);
    document.getElementById("m3").textContent = fmtS(data.medians.total);
    document.getElementById("sub").textContent = data.changes.length
      ? data.changes.length + " cambios registrados · actualizado " + hhmmss(data.serverTime)
      : "Todavía no hay cambios registrados. Cambia un número en el Excel y espera ~1 minuto.";

    const head = document.getElementById("head");
    head.replaceChildren();
    ["Excel guardado", "Archivo", "Dashboard lo tomó", "Excel → dashboard"].concat(data.screens.map((s) => "TV " + s), ["Total"])
      .forEach((h) => head.appendChild(el("th", h)));

    const rows = document.getElementById("rows");
    rows.replaceChildren();
    data.changes.forEach((c) => {
      const tr = document.createElement("tr");
      tr.appendChild(el("td", hhmmss(c.filesSavedAt)));
      tr.appendChild(el("td", (c.file || "–").replace(/\.xlsx?$/i, "")));
      tr.appendChild(el("td", hhmmss(c.changedAt)));
      tr.appendChild(el("td", fmtS(c.excelToDashboard), cls(c.excelToDashboard, 30, 60)));
      data.screens.forEach((name) => {
        const s = c.screens.find((x) => x.screen === name);
        tr.appendChild(el("td", s ? fmtS(s.seconds) : "–", s ? cls(s.seconds, 15, 30) : "mute"));
      });
      tr.appendChild(el("td", fmtS(c.total), cls(c.total, 45, 90)));
      rows.appendChild(tr);
    });
  }
  load();
  // Once a minute, and only while the tab is on screen: each load is 2 database reads.
  setInterval(() => { if (document.visibilityState === "visible") load(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
