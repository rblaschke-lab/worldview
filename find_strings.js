const fs = require("fs");
const lines = fs.readFileSync("c:\\Users\\GIGABYTE\\.gemini\\antigravity\\scratch\\worldview\\main.js", "utf-8").split("\n");
const targets = ["layer-status-badge", "toggle-sst", "toggle-temperature", "addLayer", "getYesterdaysDate", "webcam", "gibs", "NASA", "ISS", "internet", "outages", "cctv"];
targets.forEach(t => {
    let found = [];
    lines.forEach((l, i) => { if (l.toLowerCase().includes(t.toLowerCase())) found.push(i + 1); });
    console.log(t + ": " + found.slice(0, 15).join(", "));
});
