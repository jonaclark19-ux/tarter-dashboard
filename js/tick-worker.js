// Background clock for the dashboard (started by startBackgroundTicker in sync.js).
// Browsers slow a hidden tab's own timers to once a minute or less - a minimized
// source PC, a tab behind another, a locked screen - but not a worker's, so this
// keeps the Excel checks and the publish to the TVs on time.
setInterval(() => postMessage(0), 5e3);
