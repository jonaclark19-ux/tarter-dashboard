// Starts the page. Loaded last: the other files only define things.
// Part of the dashboard app; index.html loads js/*.js in order as plain scripts
// that share one global scope (no bundler).

setInterval(updateClock, 1e3);
updateClock();
setInterval(render, 6e4);
var todayInit = plantNow();
document.getElementById("date-input").value = `${todayInit.getFullYear()}-${String(todayInit.getMonth() + 1).padStart(2, "0")}-${String(todayInit.getDate()).padStart(2, "0")}`;
render();
bootstrapAutoSync(TV_SNAPSHOT);
var tvRequested = queryParam("tv");
if (TV_SNAPSHOT || tvRequested === "1" || tvRequested === "true") enterTvMode(TV_SNAPSHOT);
