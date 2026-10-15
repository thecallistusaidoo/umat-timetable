// Reads UMaT teaching timetables (Essikado and Tarkwa layouts). By Callistus Aidoo.
// A course is stored as programme + number + group, e.g. "DS367", "MC151B", "GL273A", "MN173B1".
const TIME_RE=/^(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})$/;
// Programme(s), optional year+group before the number (Tarkwa: "GL 2A 273"), number, optional group after (Essikado: "MC 151 B")
function codeRe(trailing){ return new RegExp("([A-Z]{2}(?:\\s*[,/&]\\s*[A-Z]{2})*)\\s*(?:(\\d)([A-Z]\\d?)\\s+)?(\\d{3})(?:\\s+(["+trailing+"])(?=[\\s/,]|$))?","g"); }
const ROOM_NAMES={"M. AUDITORIUM":"Main Auditorium","COMPUTER LAB":"Computer Lab","FIELD WORK":"Field Work","ONLINE":"Online","VLE":"Online"};
const WEEKDAYS=["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
function titleCase(s){s=String(s).trim().toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1);}
function readCodes(text, trailing){
  const ms=[...text.matchAll(codeRe(trailing))];
  const codes=[];
  for(const m of ms){
    const grp=m[3]||m[5]||"";
    for(const p of m[1].split(/\s*[,/&]\s*/)) codes.push(p+m[4]+grp);
  }
  return {ms, codes};
}
function parseCell(raw){
  raw=String(raw||"").trim(); if(!raw) return null;
  const nl=raw.indexOf("\n");
  if(nl>0){ // Tarkwa style: courses on the first line, lecturer below
    const first=raw.slice(0,nl).replace(/\s+/g," ").trim();
    const {codes}=readCodes(first,"A-Z");
    if(codes.length) return {label:first, lect:raw.slice(nl+1).replace(/\s+/g," ").trim(), codes};
  }
  const text=raw.replace(/\s+/g," ");
  const {ms,codes}=readCodes(text,"AB"); // only A/B after the number, so a lecturer's initial isn't read as a group
  if(!codes.length) return null;
  const last=ms[ms.length-1], end=last.index+last[0].length;
  return {label:text.slice(0,end).trim(), lect:text.slice(end).replace(/^[\s\/]+/,"").trim(), codes};
}
// rows: array of arrays of cell text; merges: [{s:{r,c},e:{r,c}}]
function parseSheet(name, rows, merges){
  let hr=-1;
  for(let r=0;r<Math.min(rows.length,30);r++){
    const n=(rows[r]||[]).filter(v=>TIME_RE.test(String(v).trim())).length;
    if(n>=4){hr=r;break;}
  }
  if(hr<0) return null;
  // slot per column, with am/pm worked out left to right
  const slot={}; let pm=false, prevH=0;
  (rows[hr]||[]).forEach((v,c)=>{
    const m=String(v).trim().match(TIME_RE); if(!m) return;
    let h1=+m[1], h2=+m[3];
    const p1 = pm || h1===12 || (prevH && h1<prevH); if(p1) pm=true;
    const p2 = pm || h2===12 || h2<h1;
    slot[c]={t1:`${h1}:${m[2]} ${p1?"pm":"am"}`, t2:`${h2}:${m[4]} ${p2?"pm":"am"}`};
    prevH=h1;
  });
  for(const m of merges){ if(m.s.r<=hr&&m.e.r>=hr&&slot[m.s.c]) for(let c=m.s.c+1;c<=m.e.c;c++) slot[c]=slot[m.s.c]; }
  const isBreak=v=>/^\s*b\s*r\s*e\s*a\s*k\s*$/i.test(String(v));
  const breakCols=new Set();
  for(let r=hr+1;r<rows.length;r++) (rows[r]||[]).forEach((v,c)=>{ if(isBreak(v)) breakCols.add(c); });
  const mergeAt={}; for(const m of merges) mergeAt[m.s.r+","+m.s.c]=m;
  const bodyMerges=merges.some(m=>m.s.r>hr && m.e.c>m.s.c);
  const cols=Object.keys(slot).map(Number).sort((a,b)=>a-b);
  const firstSlot=cols[0];
  const out=[];
  for(let r=hr+1;r<rows.length;r++){
    const row=rows[r]||[];
    let room=String(row[0]||"").replace(/\s+/g," ").trim(); if(!room) continue;
    if(/^(colou?r\s*)?key$|legend|^notes?$/i.test(room)) continue; // explanation rows at the bottom of the sheet
    room=room.replace(/\s*\(\d+\)\s*$/,"").trim(); room=ROOM_NAMES[room.toUpperCase()]||room;
    for(const c of cols){
      if(breakCols.has(c)||c<firstSlot) continue;
      const cell=parseCell(row[c]); if(!cell) continue;
      let e=c;
      const m=mergeAt[r+","+c];
      if(m) e=m.e.c;
      else if(!bodyMerges){ // file has no merged cells: a course followed by an empty slot is a two-hour class
        const i=cols.indexOf(c), n=cols[i+1];
        if(n===c+1 && !breakCols.has(n) && !String(row[n]||"").trim()) e=n;
      }
      const lastC=cols.filter(x=>x<=e && !breakCols.has(x)).pop();
      out.push({room, s:c, e:lastC, t1:slot[c].t1, t2:slot[lastC].t2, label:cell.label, lect:cell.lect, codes:cell.codes});
    }
  }
  return {day:titleCase(name), entries:out};
}
function parseWorkbookSheets(sheets){ // [{name, rows, merges}]
  // Use only the day sheets when the file has them (skips helper sheets like "Personal timetable").
  const daySheets=sheets.filter(s=>WEEKDAYS.includes(String(s.name).trim().toUpperCase()));
  const use=daySheets.length?daySheets:sheets;
  const days=[], rows=[];
  for(const sh of use){
    const p=parseSheet(sh.name, sh.rows, sh.merges||[]);
    if(!p||!p.entries.length) continue;
    const d=days.length; days.push(p.day);
    for(const x of p.entries) rows.push([d,x.room,x.s,x.e,x.t1,x.t2,x.label,x.lect,x.codes]);
  }
  return {days, rows};
}
