// UMaT Timetable Maker (Essikado and Tarkwa) by Callistus Aidoo. The timetable parser lives in parser.js.
const AUTHOR = "Callistus Aidoo";
// Campuses come from timetables/campuses.json (edit that file to add one). This list is the fallback.
let CAMPUSES = [
  { id: "essikado", name: "Essikado" },
  { id: "tarkwa", name: "Tarkwa" }
];
const NAMES = { GM: "Geomatic", GL: "Geological" };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const fmtDate = iso => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };
const isAdmin = new URLSearchParams(location.search).has("admin") || location.hash === "#admin";
const radio = name => (document.querySelector(`input[name="${name}"]:checked`) || {}).value || "";
const setRadio = (name, v) => { const el = document.querySelector(`input[name="${name}"][value="${v}"]`); if (el) el.checked = true; };

let OFFICIAL = null, active = null, isLocal = false, current = [], campus = CAMPUSES[0];
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

// Appearance: light (default), dark or auto (follows the phone).
const ICONS = {
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>'
};
const THEME_NAMES = { light: "Light", dark: "Dark", auto: "Auto" };
function applyTheme(t) {
  if (!ICONS[t]) t = "light";
  document.documentElement.setAttribute("data-theme", t);
  store.set("theme", t); setRadio("theme", t);
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = $("themeColor"); if (meta) meta.content = dark ? "#000000" : "#f2f2f7";
  $("themeBtn").innerHTML = ICONS[t];
  $("themeBtn").setAttribute("aria-label", `Appearance: ${THEME_NAMES[t]}. Tap to change.`);
  placeThumbs();
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme(store.get("theme") || "light"));

// Segmented controls: slide the thumb under the checked option.
function placeThumbs() {
  document.querySelectorAll(".seg").forEach(seg => {
    const labels = [...seg.querySelectorAll("label")], thumb = seg.querySelector(".thumb");
    const i = labels.findIndex(l => document.getElementById(l.htmlFor).checked);
    const w = (seg.clientWidth - 4) / labels.length;
    thumb.style.width = w + "px";
    thumb.style.transform = `translateX(${Math.max(i, 0) * w}px)`;
  });
}
addEventListener("resize", placeThumbs);
document.addEventListener("change", e => { if (e.target.matches(".seg input")) placeThumbs(); });

// Frosted header shows its title and hairline once the large title scrolls away.
const topBar = $("top");
const onScroll = () => topBar.style.setProperty("--edge", scrollY > 44 ? 1 : 0);
addEventListener("scroll", onScroll, { passive: true });

function buildCampusSeg() {
  const seg = $("campusSeg");
  seg.innerHTML = '<span class="thumb"></span>' + CAMPUSES.map(c =>
    `<input type="radio" name="campus" id="cp-${c.id}" value="${c.id}"><label for="cp-${c.id}">${esc(c.name)}</label>`).join("");
}

function showComingSoon() {
  $("srcName").innerHTML = `${esc(campus.name)} timetable<span class="badge local">Coming soon</span>`;
  $("srcSub").textContent = "It hasn't been published yet. Check back soon, or upload the Excel file yourself below.";
  $("backOfficial").hidden = true;
  $("progs").innerHTML = ""; $("codes").innerHTML = "";
  current = []; $("sub").textContent = ""; ["pdf", "sharePdf", "addCal", "shareCal"].forEach(id => $(id).disabled = true);
  $("out").innerHTML = `<div class="sec"><div class="group"><div class="soon"><b>${esc(campus.name)} timetable coming soon</b><span>The ${esc(campus.name)} campus timetable will appear here as soon as it's published.</span></div></div></div>`;
}

function showSource() {
  const m = active.meta;
  $("srcName").innerHTML = esc(m.title || "Teaching timetable") + (isLocal ? '<span class="badge local">This device</span>' : (m.draft || /draft/i.test(m.title || "")) ? '<span class="badge draft">Draft</span>' : '<span class="badge ok">Official</span>');
  $("srcSub").textContent = isLocal
    ? `${m.file}, ${active.rows.length} classes on ${active.days.length} days`
    : `${campus.name} campus, released ${fmtDate(m.released)}`;
  $("backOfficial").hidden = !isLocal;
  const progs = [...new Set(active.rows.flatMap(r => r[8].map(c => c.slice(0, 2))))].sort();
  $("progs").innerHTML = progs.map(p => `<option value="${p}">`).join("");
  $("codes").innerHTML = progs.map(p => `<button type="button" class="chip" data-p="${p}">${p}</button>`).join("");
}

// Group choices come from the timetable: every group letter used by this programme and level.
function groupsFor(prog, level) {
  const g = new Set();
  if (active) for (const r of active.rows) for (const c of r[8]) if (c.slice(0, 2) === prog && c[2] === level && c.length > 5) g.add(c[5]);
  return [...g].sort();
}
let grpKey = "", savedGrp = "";
function buildGroupSeg(prog, level) {
  const groups = groupsFor(prog, level), key = groups.join("");
  const keep = radio("grp") || savedGrp; savedGrp = "";
  if (key !== grpKey || !$("grpSeg").querySelector("input")) {
    grpKey = key;
    const opts = [{ v: "", t: groups.length === 2 ? "Both" : "All" }, ...groups.map(x => ({ v: x, t: x }))];
    $("grpSeg").innerHTML = '<span class="thumb"></span>' + opts.map(o =>
      `<input type="radio" name="grp" id="g-${o.v || "all"}" value="${o.v}"><label for="g-${o.v || "all"}">${o.t}</label>`).join("");
    setRadio("grp", groups.includes(keep) ? keep : "");
    if (!radio("grp")) setRadio("grp", "");
  }
  $("grpRow").hidden = groups.length === 0;
  if (!groups.length) setRadio("grp", "");
}

function select(prog, level, grp) {
  const res = [];
  for (const r of active.rows) {
    const hits = r[8].filter(c => c.slice(0, 2) === prog && c[2] === level);
    if (!hits.length) continue;
    if (grp && hits.every(c => c.length > 5 && !c.slice(5).startsWith(grp))) continue;
    const course = hits.map(c => c.slice(0, 2) + " " + c.slice(2, 5) + (c.length > 5 ? " " + c.slice(5) : "")).join(" / ");
    res.push({ day: r[0], room: r[1], s: r[2], e: r[3], t1: r[4], t2: r[5], course, lect: r[7] });
  }
  res.sort((a, b) => a.day - b.day || a.s - b.s);
  for (const a of res) a.clash = res.some(b => b !== a && b.day === a.day && b.s <= a.e && a.s <= b.e);
  return res;
}
const shortT = t => t.replace(/ (am|pm)$/, "");
const timeRange = c => c.t1.slice(-2) === c.t2.slice(-2) ? `${shortT(c.t1)} to ${c.t2}` : `${c.t1} to ${c.t2}`;
const heading = (prog, lvl, grp) => `${prog || "??"}${NAMES[prog] ? " (" + NAMES[prog] + ")" : ""}, Level ${lvl}${grp ? ", Group " + grp : ""}`;

function render() {
  placeThumbs();
  if (!active) return;
  const prog = $("prog").value.trim().toUpperCase(), level = radio("level");
  buildGroupSeg(prog, level); placeThumbs();
  const grp = radio("grp");
  document.querySelectorAll("#codes .chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === prog)));
  const lvl = level + "00";
  $("title").textContent = heading(prog, lvl, grp);
  store.set("tt", { prog, level, grp });
  if (!/^[A-Z]{2}$/.test(prog)) {
    current = []; $("sub").textContent = ""; ["pdf", "sharePdf", "addCal", "shareCal"].forEach(id => $(id).disabled = true);
    $("out").innerHTML = '<div class="sec"><div class="group"><div class="empty">Type a two-letter programme code, such as DS, GM or GL.</div></div></div>'; return;
  }
  current = select(prog, level, grp);
  const nCourses = new Set(current.map(c => c.course)).size, clashes = current.filter(c => c.clash).length;
  $("sub").textContent = current.length ? `${current.length} classes, ${nCourses} courses${clashes ? `, ${clashes} overlapping` : ""}` : "";
  ["pdf", "sharePdf", "addCal", "shareCal"].forEach(id => $(id).disabled = !current.length);
  if (!current.length) { $("out").innerHTML = `<div class="sec"><div class="group"><div class="empty">No ${esc(prog)} ${lvl} level classes in this timetable. Check the code and level.</div></div></div>`; return; }
  $("out").innerHTML = active.days.map((d, i) => {
    const list = current.filter(c => c.day === i);
    return `<section class="sec"><h3 class="sec-h">${esc(d)}</h3><div class="group">${list.length ? list.map(c => `
      <div class="row"><div class="cls">
        <div class="t">${shortT(c.t1)}<small>${shortT(c.t2)} ${c.t2.slice(-2)}</small></div>
        <div class="row-main">
          <div class="course">${esc(c.course)}</div>
          <div class="det"><span>${esc(c.room)}</span><span>${esc(c.lect)}</span>${c.room === "Online" ? '<span class="tag on">Online</span>' : ""}${c.clash ? '<span class="tag clash">Overlaps</span>' : ""}</div>
        </div>
      </div></div>`).join("") : '<div class="row"><span class="free">No classes</span></div>'}</div></section>`;
  }).join("");
}

function makePdf() {
  const msg = $("msg");
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const prog = $("prog").value.trim().toUpperCase(), lvl = radio("level") + "00", grp = radio("grp"), m = active.meta;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(`University of Mines and Technology, ${campus.name} Campus`, 40, 48);
    doc.setFontSize(10.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text(`${m.title || "Teaching timetable"}. ${isLocal ? "From uploaded file " + m.file : "Released " + fmtDate(m.released)}`, 40, 66, { maxWidth: 515 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0);
    doc.text(heading(prog, lvl, grp), 40, 90);
    const body = [];
    active.days.forEach((d, i) => {
      const list = current.filter(c => c.day === i);
      if (!list.length) { body.push([{ content: d, styles: { fontStyle: "bold" } }, "", "No classes", "", ""]); return; }
      list.forEach((c, j) => {
        const row = [timeRange(c), c.course + (c.clash ? " (overlaps)" : ""), c.room, c.lect];
        if (j === 0) row.unshift({ content: d, rowSpan: list.length, styles: { fontStyle: "bold", valign: "middle" } });
        body.push(row);
      });
    });
    doc.autoTable({
      startY: 106, head: [["Day", "Time", "Course", "Venue", "Lecturer"]], body, theme: "grid",
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 5, lineColor: [210, 210, 215], textColor: [20, 20, 20] },
      headStyles: { fillColor: [0, 122, 255], textColor: 255 },
      columnStyles: { 0: { cellWidth: 68 }, 1: { cellWidth: 100 }, 2: { cellWidth: 105 } },
      didDrawPage: () => {
        const h = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
        doc.text(`Generated by ${AUTHOR}'s Timetable Maker. Check times against the official timetable.`, 40, h - 24);
      }
    });
    return { blob: doc.output("blob"), name: `${prog}${lvl}${grp ? "_" + grp : ""}_Timetable.pdf` };
  } catch (e) { msg.textContent = "Couldn't make the PDF. Reload the page and try again."; return null; }
}

function saveFile(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Share through the phone's share sheet (WhatsApp, Telegram, email, Files). Falls back to a download.
async function shareFile(file, text) {
  const f = new File([file.blob], file.name, { type: file.blob.type });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: file.name, text }); return "shared"; }
    catch (e) { return e && e.name === "AbortError" ? "cancelled" : "failed"; }
  }
  saveFile(file.blob, file.name); return "downloaded";
}

// ---- Calendar (.ics) with reminders ----
const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const pad = n => String(n).padStart(2, "0");
function to24(t) { // "6:30 pm" -> [18, 30]
  const m = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i); if (!m) return null;
  let h = +m[1] % 12; if (m[3].toLowerCase() === "pm") h += 12;
  return [h, +m[2]];
}
const icsDate = (d, h, mi) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(mi)}00`;
const icsText = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) { // keep lines under 75 characters, as calendar apps expect
  const out = []; while (line.length > 74) { out.push(line.slice(0, 74)); line = " " + line.slice(74); }
  out.push(line); return out.join("\r\n");
}
function makeIcs(classes, untilISO, remindMin) {
  const now = new Date(), stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const until = untilISO.replace(/-/g, "") + "T235959";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Callistus Aidoo//UMaT Timetable Maker//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsText($("title").textContent), "X-WR-TIMEZONE:Africa/Accra",
    "BEGIN:VTIMEZONE", "TZID:Africa/Accra", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0000", "TZOFFSETTO:+0000", "TZNAME:GMT", "END:STANDARD", "END:VTIMEZONE"];
  classes.forEach((c, i) => {
    const wd = DAY_INDEX[String(active.days[c.day]).toLowerCase()];
    const a = to24(c.t1), b = to24(c.t2);
    if (wd == null || !a || !b) return;
    const first = new Date(start); first.setDate(first.getDate() + ((wd - first.getDay() + 7) % 7));
    L.push("BEGIN:VEVENT",
      `UID:${icsDate(first, a[0], a[1])}-${i}-${c.course.replace(/\W/g, "")}@umat-timetable`,
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=Africa/Accra:" + icsDate(first, a[0], a[1]),
      "DTEND;TZID=Africa/Accra:" + icsDate(first, b[0], b[1]),
      "RRULE:FREQ=WEEKLY;UNTIL=" + until,
      "SUMMARY:" + icsText(c.course),
      "LOCATION:" + icsText(c.room),
      "DESCRIPTION:" + icsText(`Lecturer: ${c.lect}. From ${AUTHOR}'s Timetable Maker.`));
    if (remindMin > 0) L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(`${c.course} in ${c.room}`), `TRIGGER:-PT${remindMin}M`, "END:VALARM");
    L.push("END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
function buildCalendar() {
  const until = $("until").value, mins = +radio("remind");
  if (!until) { $("calMsg").textContent = "Pick the date classes end first."; return null; }
  if (new Date(until + "T23:59:59") < new Date()) { $("calMsg").textContent = "The end date has already passed. Pick a later date."; return null; }
  store.set("cal", { until, mins });
  const prog = $("prog").value.trim().toUpperCase(), lvl = radio("level") + "00", grp = radio("grp");
  return { blob: new Blob([makeIcs(current, until, mins)], { type: "text/calendar" }), name: `${prog}${lvl}${grp ? "_" + grp : ""}_Classes.ics` };
}

// Uploading a timetable (Excel)
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function onFile(file) {
  const sm = $("srcMsg"); sm.textContent = `Reading ${file.name}`;
  try {
    await loadSheetJS();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheets = wb.SheetNames.map(n => {
      const ws = wb.Sheets[n];
      return { name: n, rows: ws["!ref"] ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true }) : [], merges: ws["!merges"] || [] };
    });
    const parsed = parseWorkbookSheets(sheets);
    if (!parsed.rows.length) { sm.textContent = `No classes found in ${file.name}. Use the timetable Excel file with one sheet per day and a row of time slots such as 6.30-7.30.`; return; }
    let title = "";
    for (const sh of sheets) { for (const row of sh.rows.slice(0, 8)) { const t = row.find(v => /semester/i.test(String(v))); if (t) { title = String(t).replace(/\s+/g, " ").trim(); break; } } if (title) break; }
    title = title ? title.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s*Time\s*Table\s*$/i, "") : "Teaching timetable";
    active = { meta: { title, file: file.name, released: new Date().toISOString().slice(0, 10) }, days: parsed.days, rows: parsed.rows };
    isLocal = true; store.set("upload:" + campus.id, active);
    sm.textContent = `Loaded ${parsed.rows.length} classes from ${parsed.days.join(", ")}.`;
    $("relTitle").value = active.meta.title; $("relDate").value = active.meta.released;
    showSource(); render();
  } catch (e) { sm.textContent = `Couldn't read ${file.name}. Make sure it's an Excel file (.xlsx or .xls).`; }
  finally { $("file").value = ""; }
}

// Administrator: publish a timetable for everyone (writes timetables/<campus>.json to your GitHub repository)
function adminPayload() {
  if (!isLocal) { $("adminMsg").textContent = "Upload the new Excel file above first."; return null; }
  if (!$("relDate").value) { $("adminMsg").textContent = "Pick the release date first."; return null; }
  return { meta: { ...active.meta, released: $("relDate").value, title: $("relTitle").value.trim() || active.meta.title, campus: campus.id }, days: active.days, rows: active.rows };
}
function toBase64(str) {
  const bytes = new TextEncoder().encode(str); let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
let confirmArmed = false;
$("publishBtn").addEventListener("click", async () => {
  const msg = $("adminMsg"), data = adminPayload(); if (!data) return;
  const repo = $("ghRepo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, ""), token = $("ghToken").value.trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) { msg.textContent = "Fill in Publishing settings below first (repository and token)."; return; }
  store.set("gh", { repo, token });
  if (!confirmArmed) { confirmArmed = true; $("publishBtn").textContent = `Tap again to publish to ${campus.name}`; msg.textContent = `This replaces the ${campus.name} timetable for everyone.`; setTimeout(() => { confirmArmed = false; $("publishBtn").textContent = "Publish for everyone"; }, 6000); return; }
  confirmArmed = false; $("publishBtn").textContent = "Publishing"; $("publishBtn").disabled = true;
  const url = `https://api.github.com/repos/${repo}/contents/timetables/${campus.id}.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  try {
    let sha;
    const cur = await fetch(url, { headers, cache: "no-store" });
    if (cur.ok) sha = (await cur.json()).sha;
    else if (cur.status === 401) throw new Error("The token was refused. Check it's copied correctly and hasn't expired.");
    else if (cur.status !== 404) throw new Error(`GitHub said ${cur.status}. Check the repository name.`);
    const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify({
      message: `Publish ${campus.name} timetable released ${data.meta.released}`, content: toBase64(JSON.stringify(data)), ...(sha ? { sha } : {}) }) });
    if (!res.ok) {
      if (res.status === 403 || res.status === 404) throw new Error("The token can't write to that repository. Give it Contents: Read and write access to this repository.");
      if (res.status === 409) throw new Error("Someone published at the same moment. Tap Publish again.");
      throw new Error(`Publishing failed (GitHub said ${res.status}).`);
    }
    msg.textContent = `Published. Everyone sees the new ${campus.name} timetable within a few minutes.`;
  } catch (e) { msg.textContent = e.message || "Couldn't reach GitHub. Check your internet and try again."; }
  finally { $("publishBtn").disabled = false; $("publishBtn").textContent = "Publish for everyone"; }
});
$("exportBtn").addEventListener("click", () => {
  const data = adminPayload(); if (!data) return;
  saveFile(new Blob([JSON.stringify(data)], { type: "application/json" }), `${campus.id}.json`);
  $("adminMsg").textContent = `${campus.id}.json downloaded. Put it in the timetables folder of your site to publish it by hand.`;
});

$("file").addEventListener("change", e => { const f = e.target.files[0]; if (f) onFile(f); });
$("backOfficial").addEventListener("click", () => {
  store.set("upload:" + campus.id, null); $("srcMsg").textContent = "An uploaded file only changes what you see on this device.";
  isLocal = false; active = OFFICIAL;
  if (OFFICIAL) { showSource(); render(); } else showComingSoon();
});
$("f").addEventListener("input", render);
$("f").addEventListener("change", render);
$("f").addEventListener("submit", e => e.preventDefault());
$("codes").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { $("prog").value = b.dataset.p; render(); } });
$("pdf").addEventListener("click", () => { const f = makePdf(); if (f) { saveFile(f.blob, f.name); $("msg").textContent = "PDF downloaded."; tick(); } });
$("sharePdf").addEventListener("click", async () => {
  const f = makePdf(); if (!f) return;
  const r = await shareFile(f, `My class timetable (${$("title").textContent})`);
  $("msg").textContent = r === "shared" ? "" : r === "downloaded" ? "Sharing isn't supported here, so the PDF was downloaded instead." : r === "failed" ? "Couldn't share the PDF. Try Download PDF." : "";
});
$("addCal").addEventListener("click", () => {
  const f = buildCalendar(); if (!f) return;
  saveFile(f.blob, f.name);
  const mins = +radio("remind");
  $("calMsg").textContent = `Calendar file ready. Open it and tap Add All to save ${current.length} weekly classes${mins ? ` with a reminder ${mins >= 60 ? "1 hour" : mins + " minutes"} before each` : ""}.`;
});
$("shareCal").addEventListener("click", async () => {
  const f = buildCalendar(); if (!f) return;
  const r = await shareFile(f, "My class timetable for my calendar");
  if (r === "downloaded") $("calMsg").textContent = "Sharing isn't supported here, so the calendar file was downloaded instead.";
});

const updOnline = () => { $("offline").hidden = navigator.onLine; };
addEventListener("online", updOnline); addEventListener("offline", updOnline); updOnline();

async function loadCampus(c, remember = true) {
  campus = c; if (remember) store.set("campus", c.id); $("adminCampus").textContent = c.name;
  $("eyebrow").textContent = `UMaT ${c.name}`; grpKey = "";
  OFFICIAL = null; active = null; isLocal = false;
  $("srcName").textContent = "Loading"; $("srcSub").textContent = "";
  let offlineMissing = false;
  try {
    const r = await fetch(`timetables/${c.id}.json`, { cache: "no-cache" });
    if (r.ok) OFFICIAL = await r.json();
  } catch (e) { offlineMissing = true; }
  if (campus !== c) return; // switched again while loading
  const up = store.get("upload:" + c.id) || (c.id === "essikado" ? store.get("upload") : null);
  if (up && up.rows) { active = up; isLocal = true; } else active = OFFICIAL;
  if (isAdmin && isLocal) { $("relTitle").value = active.meta.title; $("relDate").value = active.meta.released; }
  if (active) { showSource(); render(); return; }
  if (offlineMissing) {
    $("srcName").textContent = "Timetable not available offline";
    $("srcSub").textContent = `Open the ${c.name} timetable once while online so it's saved for offline use.`;
    current = []; ["pdf", "sharePdf", "addCal", "shareCal"].forEach(id => $(id).disabled = true); $("out").innerHTML = "";
  } else showComingSoon();
}
document.addEventListener("change", e => {
  if (e.target.name === "campus") { const c = CAMPUSES.find(x => x.id === e.target.value); if (c) { $("srcMsg").textContent = "An uploaded file only changes what you see on this device."; loadCampus(c); } }
  if (e.target.name === "theme") applyTheme(e.target.value);
});
function showPicker() {
  const p = $("picker");
  $("pickerBtns").innerHTML = CAMPUSES.map(c => `<button type="button" class="picker-btn" data-c="${c.id}">${esc(c.name)} campus</button>`).join("");
  p.hidden = false; $("notice").hidden = true;
  setTimeout(() => p.querySelector(".picker-btn").focus(), 50);
  $("pickerBtns").onclick = e => {
    const b = e.target.closest(".picker-btn"); if (!b) return;
    const c = CAMPUSES.find(x => x.id === b.dataset.c);
    setRadio("campus", c.id); placeThumbs(); loadCampus(c);
    p.classList.add("out"); setTimeout(() => { p.hidden = true; p.classList.remove("out"); if (!store.get("noticeSeen")) $("notice").hidden = false; }, 380);
  };
}

$("themeBtn").addEventListener("click", () => {
  const order = ["light", "dark", "auto"], cur = store.get("theme") || "light";
  applyTheme(order[(order.indexOf(cur) + 1) % 3]);
});

(async function start() {
  const s = store.get("tt"); if (s) { $("prog").value = s.prog || "DS"; setRadio("level", s.level || "3"); savedGrp = s.grp || ""; }
  const cal = store.get("cal");
  if (cal) { $("until").value = cal.until; setRadio("remind", String(cal.mins)); }
  else { const d = new Date(); d.setDate(d.getDate() + 7 * 13); $("until").value = d.toISOString().slice(0, 10); }
  if (!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.pdf", { type: "application/pdf" })] }))) { $("sharePdf").hidden = true; $("shareCal").hidden = true; }
  try {
    const r = await fetch("timetables/campuses.json", { cache: "no-cache" });
    if (r.ok) { const list = await r.json(); if (Array.isArray(list) && list.length && list.every(c => c.id && c.name)) CAMPUSES = list; }
  } catch (e) {}
  buildCampusSeg();
  const savedCampus = CAMPUSES.find(c => c.id === store.get("campus")) || CAMPUSES[0];
  setRadio("campus", savedCampus.id);
  const firstOpen = !store.get("campus");
  if (firstOpen) showPicker();
  applyTheme(store.get("theme") || "light");
  onScroll();
  $("admin").hidden = !isAdmin;
  if (isAdmin) { const gh = store.get("gh"); if (gh) { $("ghRepo").value = gh.repo; $("ghToken").value = gh.token; } }
  await loadCampus(savedCampus, !firstOpen);
})();

// First-visit privacy notice (information only; nothing optional is stored, so there is nothing to opt into)
if (!store.get("noticeSeen")) {
  const n = $("notice"); n.hidden = !$("picker").hidden;
  $("noticeOk").addEventListener("click", () => {
    store.set("noticeSeen", true); n.classList.add("out");
    setTimeout(() => { n.hidden = true; }, 420);
  });
}

// ---- Feel ----
// iOS Safari only shows :active press states when the page listens for touches.
document.addEventListener("touchstart", () => {}, { passive: true });
// A light tick on Android when a choice commits (iPhones ignore this; the visual press is the feedback there).
const tick = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
document.addEventListener("change", e => { if (e.target.matches(".seg input")) tick(); });

// Swipe the privacy notice down to dismiss it: tracks the finger 1:1, resists upward pulls,
// and uses release velocity to decide (a flick dismisses even if the drag was short).
(function dragToDismiss() {
  const sheet = document.querySelector(".notice-in"); if (!sheet) return;
  const rubber = (x, d = 120, k = 0.55) => (x * d * k) / (d + k * Math.abs(x));
  const project = (v, rate = 0.998) => (v / 1000) * rate / (1 - rate);
  let startY = 0, y = 0, hist = [], active = false;
  sheet.addEventListener("pointerdown", e => {
    if (e.target.closest("button, a")) return;
    active = true; startY = e.clientY; y = 0; hist = [{ y: 0, t: e.timeStamp }];
    sheet.setPointerCapture(e.pointerId); sheet.classList.add("dragging");
  });
  sheet.addEventListener("pointermove", e => {
    if (!active) return;
    const dy = e.clientY - startY;
    y = dy < 0 ? rubber(dy) : dy;
    sheet.style.transform = `translateY(${y}px)`;
    hist.push({ y: dy, t: e.timeStamp }); if (hist.length > 5) hist.shift();
  });
  const end = () => {
    if (!active) return; active = false; sheet.classList.remove("dragging");
    const a = hist[0], b = hist[hist.length - 1];
    const v = b && a && b.t > a.t ? (b.y - a.y) / (b.t - a.t) * 1000 : 0; // px per second
    sheet.style.transform = "";
    if (y + project(v) > sheet.offsetHeight * 0.5) { store.set("noticeSeen", true); $("notice").classList.add("out"); setTimeout(() => { $("notice").hidden = true; }, 420); }
  };
  sheet.addEventListener("pointerup", end); sheet.addEventListener("pointercancel", end);
})();

// Offline support and install
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
let deferredInstall = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredInstall = e;
  $("installHint").innerHTML = '<button type="button" class="link" id="installBtn" style="margin-top:10px;font-size:15px">Install the app</button>';
  $("installBtn").addEventListener("click", async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installHint").textContent = ""; });
});
