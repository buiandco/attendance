const $=s=>document.querySelector(s);
const state={guests:[],table:"ALL",query:"",undo:null,lastSync:0};
const tableOrder=["ALL","Main",...Array.from({length:23},(_,i)=>String(i+1))];
// Coordinates match wedding-map.png (1254 × 1254) — updated reception layout.
const MAP_SIZE=1254;
const tablePositions={
  "Main":[627,150],
  "9":[230,350],
  "5":[393,350],
  "17":[884,350],
  "21":[1054,350],
  "10":[230,509],
  "6":[393,509],
  "1":[551,550],
  "13":[735,550],
  "18":[884,509],
  "22":[1054,509],
  "11":[230,669],
  "7":[393,669],
  "2":[551,688],
  "14":[735,688],
  "19":[884,669],
  "23":[1054,669],
  "12":[230,820],
  "8":[393,820],
  "3":[551,835],
  "15":[735,820],
  "20":[930,820],
  "4":[551,974],
  "16":[735,974]
};
const syncState={busy:false,activeWrites:0,revision:0,pending:new Map(),lastFullSync:0};
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"")}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2500)}
function summary(){const n=state.guests.filter(g=>g.attended).length,t=state.guests.length,p=t?Math.round(n/t*100):0;$("#arrived").textContent=n;$("#total").textContent=t;$("#remaining").textContent=t-n;$("#percent").textContent=p+"%";$("#bar").style.width=p+"%"}
function tableGuests(t){return state.guests.filter(g=>t==="ALL"||g.table===t)}
function renderTables(){const root=$("#tables");root.innerHTML="";tableOrder.forEach(t=>{const gs=tableGuests(t),n=gs.filter(g=>g.attended).length,b=document.createElement("button");b.type="button";b.className="table-btn"+(state.table===t?" active":"")+(gs.length&&n===gs.length?" complete":"");b.innerHTML=`<div class="tn">${t==="ALL"?"ALL":t==="Main"?"MAIN":"TABLE "+t}</div><div class="tc">${n} / ${gs.length}</div>`;b.addEventListener("click",()=>{state.table=t;state.query="";$("#search").value="";render()});root.appendChild(b)})}
function visibleGuests(){
  let gs=tableGuests(state.table);
  const q=norm(state.query);
  if(q){
    const direct=state.guests.filter(g=>norm(g.name).includes(q)||norm(g.group).includes(q));
    const matchedGroups=new Set(direct.filter(g=>g.group).map(g=>g.group));
    const ids=new Set(direct.map(g=>g.id));
    state.guests.forEach(g=>{if(g.group&&matchedGroups.has(g.group))ids.add(g.id)});
    gs=state.guests.filter(g=>ids.has(g.id));
  }
  return gs
}
function groupMembers(g){return g.group?state.guests.filter(x=>x.group===g.group):[g]}
function groupCardHtml(g){
  if(!g.group)return "";
  const members=groupMembers(g),allIn=members.every(x=>x.attended),someIn=members.some(x=>x.attended),gift=members.some(x=>x.gift);
  return `<div class="group-card">
    <div class="group-head"><div><div class="group-kicker">Family / linked group</div><div class="group-name">${esc(g.group)}</div></div><div class="group-count">${members.length} guest${members.length===1?"":"s"}</div></div>
    <div class="group-members">${members.map(m=>`<div class="group-member ${m.attended?"done":""}"><span>${m.attended?"✓ ":""}${esc(m.name)}</span><span>${m.table==="Main"?"Main Table":"Table "+esc(m.table)}</span></div>`).join("")}</div>
    <div class="group-actions-bar">
      <button class="group-btn primary" data-group-att="${esc(g.group)}">${allIn?"✓ Group attended":someIn?"✓ Check in remaining group":"✓ Check in whole group"}</button>
      <button class="group-btn ${gift?"gifted":""}" data-group-gift="${esc(g.group)}">${gift?"🎁 Gift received":"🎁 Group gift"}</button>
    </div>
  </div>`;
}
function renderGuests(){
  const root=$("#guestList"),list=visibleGuests();root.innerHTML="";
  if(!list.length){root.innerHTML='<div class="empty">No guests found.</div>';return}
  // Show family/group controls in both search results and table attendance.
  const grouped=new Map();
  list.forEach(g=>{if(g.group&&!grouped.has(g.group))grouped.set(g.group,g)});
  grouped.forEach(g=>{
    const members=groupMembers(g);
    if(members.length<2)return;
    const wrap=document.createElement("div");wrap.innerHTML=groupCardHtml(g);root.appendChild(wrap);
  });
  bindGroupButtons(root);
  list.forEach(g=>{
    const b=document.createElement("div");b.className="guest "+(g.attended?"attended":"");b.setAttribute("role","button");b.tabIndex=0;
    b.innerHTML=`<span class="check">${g.attended?"✓":""}</span><span class="gcopy"><span class="gname">${esc(g.name)}</span><span class="gmeta">${g.table==="Main"?"Main Table":"Table "+esc(g.table)}${g.group?" · "+esc(g.group):""}${g.attended&&g.time?" · "+esc(g.time):""}</span></span><span class="guest-actions">${g.attended?'<span class="status">Attended</span>':""}<button type="button" class="gift-btn${g.gift?" has-gift":""}">${g.gift?"🎁 Gift ✓":"🎁 Gift"}</button></span>`;
    const giftBtn=b.querySelector(".gift-btn");giftBtn.addEventListener("click",e=>{e.stopPropagation();setGift(g,!g.gift)});
    b.addEventListener("click",e=>{if(!e.target.closest(".gift-btn"))toggleGuest(g)});b.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&!e.target.closest(".gift-btn")){e.preventDefault();toggleGuest(g)}});root.appendChild(b)
  });
}
function bindGroupButtons(root){
  root.querySelectorAll("[data-group-att]").forEach(btn=>btn.addEventListener("click",()=>setGroupAttendance(btn.dataset.groupAtt)));
  root.querySelectorAll("[data-group-gift]").forEach(btn=>btn.addEventListener("click",()=>setGroupGift(btn.dataset.groupGift)));
}
function renderTableMap(){
  const box=$("#tableMap"),win=$("#mapWindow"),stage=$("#mapStage"),pin=$("#mapPin");
  let mapTable=state.table;
  if(state.query){
    const vg=visibleGuests(),tables=[...new Set(vg.map(g=>g.table).filter(Boolean))];
    if(tables.length===1) mapTable=tables[0]; else {box.hidden=true;return}
  }
  if(mapTable==="ALL"){box.hidden=true;return}
  const pos=tablePositions[mapTable];
  if(!pos){box.hidden=true;return}
  box.hidden=false;
  $("#tableMapTitle").textContent=mapTable==="Main"?"Main Table location":"Table "+mapTable+" location";
  pin.textContent="";
  pin.className="map-pin"+(mapTable==="Main"?" main":"");
  pin.style.left=pos[0]+"px"; pin.style.top=pos[1]+"px";
  requestAnimationFrame(()=>{
    const w=win.clientWidth,h=win.clientHeight;
    // Show surrounding context, not just the table itself.
    const scale=Math.min(w/760,h/760);
    let tx=w/2-pos[0]*scale, ty=h/2-pos[1]*scale;
    const minX=w-MAP_SIZE*scale,minY=h-MAP_SIZE*scale;
    tx=Math.min(0,Math.max(minX,tx)); ty=Math.min(0,Math.max(minY,ty));
    stage.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
  });
}
function render(){summary();renderTables();renderGuests();renderTableMap()}
function serverGuest(r){
  return {
    id:String(r.id||""),
    first:String(r.first||""),
    last:String(r.last||""),
    name:(String(r.first||"")+" "+String(r.last||"")).trim(),
    table:String(r.table||""),
    group:String(r.group||"").trim(),
    attended:!!r.attended,
    gift:!!r.gift,
    time:String(r.time||""),
    by:String(r.by||"")
  };
}
function applyServer(rows, revision){
  if(!Array.isArray(rows))return;
  const pendingOld=new Map(state.guests.filter(g=>syncState.pending.has(g.id)).map(g=>[g.id,g]));
  state.guests=rows.map(serverGuest).map(g=>{
    const old=pendingOld.get(g.id);
    if(!old)return g;
    return {...g,attended:old.attended,gift:old.gift,time:old.time,by:old.by};
  });
  if(Number.isFinite(Number(revision)))syncState.revision=Number(revision);
  state.lastSync=Date.now();syncState.lastFullSync=Date.now();
  setSyncVisual("live");render();
}
function apiUrl(){
  const u=String(window.ATTENDANCE_CONFIG?.API_URL||window.ATTENDANCE_CONFIG?.webAppUrl||"").trim();
  if(!u)throw new Error("Apps Script URL is missing from config.js");
  return u;
}
async function api(action,payload={},timeout){
  const attempt=async()=>{
    const body=new URLSearchParams();
    body.set("action",action);
    body.set("payload",JSON.stringify(payload));
    body.set("key",window.ATTENDANCE_CONFIG?.KEY||window.ATTENDANCE_CONFIG?.sharedKey||"");

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Math.max(6000,Number(timeout)||Number(window.ATTENDANCE_CONFIG?.REQUEST_TIMEOUT_MS)||15000));
    let res;
    try{
      res=await fetch(apiUrl(),{method:"POST",body,signal:controller.signal,redirect:"follow",cache:"no-store"});
    }catch(err){
      if(err&&err.name==="AbortError")throw new Error("Google Sheets is taking longer than expected.");
      throw new Error("Could not reach Google Sheets.");
    }finally{clearTimeout(timer)}

    const text=await res.text(),trimmed=text.trim();
    if(!res.ok)throw new Error(`Google returned HTTP ${res.status}.`);
    if(!trimmed||trimmed.startsWith("<")||/<!doctype|<html/i.test(trimmed.slice(0,200))){
      throw new Error("Google returned a web page instead of attendance data. Redeploy Apps Script as a Web App with access set to Anyone.");
    }
    let out;
    try{out=JSON.parse(trimmed)}catch{throw new Error("Google returned an unreadable response.");}
    if(!out.ok)throw new Error(out.error||"Request failed");
    return out;
  };

  // Same rule as the working wedding runsheet:
  // reads may retry once; writes are NEVER automatically retried.
  try{return await attempt()}
  catch(err){
    if(action==="getData"||action==="getRevision"){
      await new Promise(r=>setTimeout(r,650));
      return await attempt();
    }
    throw err;
  }
}
async function sync(force=false){
  if(syncState.activeWrites>0||syncState.busy)return;
  if(document.visibilityState!=="visible"&&!force)return;
  syncState.busy=true;
  setSyncVisual("syncing");
  try{
    const out=await api("getData");
    const d=out.data||{};
    applyServer(d.guests,d.revision);
    setSyncVisual("live");
  }catch(e){
    setSyncVisual("delayed");
  }finally{
    syncState.busy=false;
  }
}
let revisionPollBusy=false;
async function pollRevision(){
  if(revisionPollBusy||syncState.activeWrites>0||syncState.busy||document.visibilityState!=="visible")return;
  revisionPollBusy=true;
  try{
    const d=await api("getRevision",{},8000),remote=Number(d.revision||0);
    if(remote!==Number(syncState.revision||0))await sync();
  }catch(e){
    // Full refresh remains the fallback, exactly like the runsheet pattern.
  }finally{revisionPollBusy=false}
}
function setSyncVisual(status){
  const dot=$("#dot"),text=$("#connectionText"),btn=$("#sync");
  btn.classList.toggle("spinning",status==="syncing"||status==="saving");
  dot.classList.remove("live","syncing","delayed");
  if(status==="live"){dot.classList.add("live");text.textContent="Live · synced with Google Sheet";}
  else if(status==="saving"){dot.classList.add("syncing");text.textContent="Saving to Google Sheet…";}
  else if(status==="syncing"){dot.classList.add("syncing");text.textContent="Syncing with Google Sheet…";}
  else {dot.classList.add("delayed");text.textContent="Sync delayed — showing last saved copy";}
}
function beginWrite(ids){syncState.activeWrites++;ids.forEach(id=>syncState.pending.set(id,true));setSyncVisual("saving")}
function endWrite(ids){ids.forEach(id=>syncState.pending.delete(id));syncState.activeWrites=Math.max(0,syncState.activeWrites-1);if(syncState.activeWrites===0)setTimeout(pollRevision,250)}
function applyReturnedGuests(rows,revision){
  if(Array.isArray(rows)){
    const byId=new Map(state.guests.map(g=>[g.id,g]));
    rows.map(serverGuest).forEach(r=>{
      const g=byId.get(r.id);
      if(g)Object.assign(g,r);
      else state.guests.push(r);
    });
  }
  if(Number.isFinite(Number(revision)))syncState.revision=Number(revision);
  state.lastSync=Date.now();setSyncVisual("live");render();
}
async function setAttendance(g,value){
  if(syncState.pending.has(g.id))return;
  const old={attended:g.attended,gift:g.gift,time:g.time,by:g.by};
  g.attended=value;if(!value)g.gift=false;
  g.time=value?(g.time||new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})):"";
  g.by=value?(window.ATTENDANCE_CONFIG?.deviceName||"Check-in"):"";render();beginWrite([g.id]);
  try{
    const d=await api("setAttendance",{id:g.id,attended:value,by:window.ATTENDANCE_CONFIG?.deviceName||"Check-in"});
    applyReturnedGuests(d.guests,d.revision);toast(value?g.name+" checked in":"Attendance undone");
  }catch(e){Object.assign(g,old);render();toast("Could not confirm save — please tap again");}
  finally{endWrite([g.id])}
}
async function setGift(g,value){
  if(syncState.pending.has(g.id))return;
  const old={attended:g.attended,gift:g.gift,time:g.time,by:g.by};
  g.gift=value;if(value){g.attended=true;g.time=g.time||new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});g.by=g.by||window.ATTENDANCE_CONFIG?.deviceName||"Check-in"}render();beginWrite([g.id]);
  try{
    const d=await api("setGift",{id:g.id,gift:value,by:window.ATTENDANCE_CONFIG?.deviceName||"Check-in"});
    applyReturnedGuests(d.guests,d.revision);toast(value?g.name+" — gift received & attended":g.name+" — gift removed");
  }catch(e){Object.assign(g,old);render();toast("Could not confirm gift save — please tap again");}
  finally{endWrite([g.id])}
}
async function setGroupAttendance(group){
  const members=state.guests.filter(g=>g.group&&g.group===group);if(!members.length){toast("No linked group found");return}
  const ids=members.map(g=>g.id);if(ids.some(id=>syncState.pending.has(id)))return;
  const value=!members.every(g=>g.attended),old=members.map(g=>({id:g.id,attended:g.attended,gift:g.gift,time:g.time,by:g.by}));
  members.forEach(g=>{g.attended=value;if(!value){g.gift=false;g.time="";g.by=""}});render();beginWrite(ids);
  try{const d=await api("setGroupAttendance",{group,attended:value,by:window.ATTENDANCE_CONFIG?.deviceName||"Check-in"});applyReturnedGuests(d.guests,d.revision);toast(value?group+" — whole group checked in":group+" — group attendance removed")}
  catch(e){old.forEach(o=>Object.assign(state.guests.find(g=>g.id===o.id),o));render();toast("Could not confirm group save — please try again")}
  finally{endWrite(ids)}
}
async function setGroupGift(group){
  const members=state.guests.filter(g=>g.group&&g.group===group);if(!members.length){toast("No linked group found");return}
  const ids=members.map(g=>g.id);if(ids.some(id=>syncState.pending.has(id)))return;
  const value=!members.some(g=>g.gift),old=members.map(g=>({id:g.id,attended:g.attended,gift:g.gift,time:g.time,by:g.by}));
  members.forEach(g=>{g.gift=value;if(value)g.attended=true});render();beginWrite(ids);
  try{const d=await api("setGroupGift",{group,gift:value,by:window.ATTENDANCE_CONFIG?.deviceName||"Check-in"});applyReturnedGuests(d.guests,d.revision);toast(value?group+" — gift received & group checked in":group+" — group gift removed")}
  catch(e){old.forEach(o=>Object.assign(state.guests.find(g=>g.id===o.id),o));render();toast("Could not confirm group gift — please try again")}
  finally{endWrite(ids)}
}
function toggleGuest(g){if(!g.attended){setAttendance(g,true);return}state.undo=g;$("#modalText").textContent=`${g.name} is already marked attended${g.time?" at "+g.time:""}. Only undo this if it was checked by mistake.`;$("#modalBack").classList.add("show")}
$("#cancelUndo").addEventListener("click",()=>{$("#modalBack").classList.remove("show");state.undo=null});
$("#confirmUndo").addEventListener("click",()=>{const g=state.undo;$("#modalBack").classList.remove("show");state.undo=null;if(g)setAttendance(g,false)});
$("#modalBack").addEventListener("click",e=>{if(e.target===$("#modalBack")){$("#modalBack").classList.remove("show");state.undo=null}});
$("#search").addEventListener("input",e=>{state.query=e.target.value;renderGuests();renderTableMap()});
$("#sync").addEventListener("click",sync);
render();sync(true);setInterval(pollRevision,3000);setInterval(()=>{if(document.visibilityState==="visible"&&syncState.activeWrites===0)sync()},30000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pollRevision()});