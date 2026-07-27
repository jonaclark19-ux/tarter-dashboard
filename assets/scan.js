/* ============================================================
   TARTER YARD MAP — barcode scanner
   ------------------------------------------------------------
   Uses the native BarcodeDetector API when the browser has it
   (Chrome / Edge / Android), and lazily falls back to ZXing from
   a CDN otherwise (iOS Safari, Firefox). Either way the caller
   just gets a raw code string back.

       Scanner.open({ onResult: code => …, onCancel: () => … })

   The camera requires a secure context (https:// or localhost),
   which the Netlify deployment provides.
   ============================================================ */
(function (global) {
  "use strict";

  const ZXING_CDN = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code"];

  let el = null;          // modal root
  let videoEl = null;
  let stream = null;      // when we own the camera
  let detector = null;    // BarcodeDetector instance
  let zxingReader = null; // ZXing fallback reader
  let rafId = 0;
  let running = false;
  let cbResult = null, cbCancel = null;
  let facing = "environment";
  let lastCode = null, lastCount = 0;
  let torchOn = false;

  const t = (k, v) => (global.I18N ? global.I18N.t(k, v) : k);

  function secureContextOk() {
    return global.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  function hasCameraApi() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /** True when *some* scanning path is possible on this device. */
  function isSupported() {
    return secureContextOk() && hasCameraApi();
  }

  /* -------------------------------------------------- modal DOM */

  function build() {
    if (el) return el;
    el = document.createElement("div");
    el.className = "scan-modal";
    el.innerHTML = `
      <div class="scan-box">
        <div class="scan-head">
          <span data-i18n="scan.title">Scan</span>
          <button class="scan-x" data-act="close" aria-label="Close">✕</button>
        </div>
        <div class="scan-view">
          <video id="scanVideo" playsinline muted autoplay></video>
          <div class="scan-reticle"><span></span></div>
          <div class="scan-status" id="scanStatus"></div>
        </div>
        <div class="scan-foot">
          <button class="scan-btn" data-act="flip" data-i18n="scan.switch">Flip camera</button>
          <button class="scan-btn" data-act="torch" data-i18n="scan.torch" hidden>Torch</button>
          <button class="scan-btn primary" data-act="manual" data-i18n="scan.manual">Type it manually</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    videoEl = el.querySelector("#scanVideo");

    el.addEventListener("click", (e) => {
      if (e.target === el) { close(); if (cbCancel) cbCancel(); return; }
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const a = act.dataset.act;
      if (a === "close") { close(); if (cbCancel) cbCancel(); }
      else if (a === "flip") flip();
      else if (a === "torch") toggleTorch();
      else if (a === "manual") { close(); if (cbCancel) cbCancel({ manual: true }); }
    });

    if (global.I18N) global.I18N.applyI18n(el);
    return el;
  }

  function status(msg, tone) {
    const s = el && el.querySelector("#scanStatus");
    if (!s) return;
    s.textContent = msg || "";
    s.className = "scan-status" + (tone ? " " + tone : "");
    s.style.display = msg ? "block" : "none";
  }

  /* -------------------------------------------------- camera */

  async function startStream() {
    stopStream();
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play().catch(() => {});
    // Expose the torch button only if the hardware reports support for it.
    const track = stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : {};
    const torchBtn = el.querySelector('[data-act="torch"]');
    if (torchBtn) torchBtn.hidden = !(caps && "torch" in caps);
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((tr) => { try { tr.stop(); } catch (e) {} });
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    torchOn = false;
  }

  async function toggleTorch() {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;
    torchOn = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: torchOn }] }); }
    catch (e) { torchOn = false; }
    const btn = el.querySelector('[data-act="torch"]');
    if (btn) btn.classList.toggle("on", torchOn);
  }

  async function flip() {
    facing = facing === "environment" ? "user" : "environment";
    if (zxingReader) { await startZxing(); }
    else { try { await startStream(); } catch (e) { status(t("scan.denied"), "bad"); } }
  }

  /* -------------------------------------------------- detection */

  /**
   * Require the same code on two consecutive reads before accepting it.
   * Cheap insurance against a single blurry misread becoming a report.
   */
  function accept(code) {
    const c = String(code || "").trim();
    if (!c) return;
    if (c === lastCode) {
      lastCount++;
    } else {
      lastCode = c; lastCount = 1;
    }
    if (lastCount < 2) { status(t("scan.searching")); return; }
    if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
    const handler = cbResult;
    close();
    if (handler) handler(c);
  }

  function detectLoop() {
    if (!running) return;
    if (videoEl.readyState >= 2) {
      detector.detect(videoEl)
        .then((codes) => {
          if (codes && codes.length) accept(codes[0].rawValue);
        })
        .catch(() => { /* transient decode errors are normal */ });
    }
    rafId = requestAnimationFrame(detectLoop);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("script_failed"));
      document.head.appendChild(s);
    });
  }

  async function startZxing() {
    if (!global.ZXing) {
      status(t("scan.starting"));
      await loadScript(ZXING_CDN);
    }
    if (!global.ZXing || !global.ZXing.BrowserMultiFormatReader) throw new Error("zxing_unavailable");
    if (zxingReader) { try { zxingReader.reset(); } catch (e) {} }
    zxingReader = new global.ZXing.BrowserMultiFormatReader();
    status("");
    // Letting ZXing own the camera keeps its internal canvas sizing correct.
    await zxingReader.decodeFromConstraints(
      { video: { facingMode: { ideal: facing } }, audio: false },
      videoEl,
      (result) => { if (result) accept(result.getText()); }
    );
  }

  /* -------------------------------------------------- open / close */

  async function open(opts) {
    opts = opts || {};
    cbResult = opts.onResult || null;
    cbCancel = opts.onCancel || null;
    lastCode = null; lastCount = 0;

    build();
    if (global.I18N) global.I18N.applyI18n(el);
    el.classList.add("show");
    status(t("scan.starting"));

    if (!secureContextOk()) { status(t("scan.insecure"), "bad"); return; }
    if (!hasCameraApi()) { status(t("scan.noCamera"), "bad"); return; }

    running = true;

    try {
      if ("BarcodeDetector" in global) {
        let supported = FORMATS;
        try {
          const avail = await global.BarcodeDetector.getSupportedFormats();
          supported = FORMATS.filter((f) => avail.includes(f));
        } catch (e) { /* use the full wish-list */ }
        if (supported.length) {
          detector = new global.BarcodeDetector({ formats: supported });
          await startStream();
          status("");
          detectLoop();
          return;
        }
      }
      await startZxing();
    } catch (err) {
      const name = err && err.name;
      if (name === "NotAllowedError" || name === "SecurityError") status(t("scan.denied"), "bad");
      else if (name === "NotFoundError" || name === "OverconstrainedError") status(t("scan.noCamera"), "bad");
      else status(t("scan.denied"), "bad");
      running = false;
    }
  }

  function close() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    detector = null;
    if (zxingReader) { try { zxingReader.reset(); } catch (e) {} zxingReader = null; }
    stopStream();
    if (el) el.classList.remove("show");
  }

  global.Scanner = { open, close, isSupported, secureContextOk, hasCameraApi };
})(window);
