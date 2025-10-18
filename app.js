// ===================== Firebase =====================
const firebaseConfig = {
  apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
  authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
  projectId: "controlhorarioapp-6a9c7",
  storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
  messagingSenderId: "447263250565",
  appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ============ Utilidades UI ============
const $ = (id)=>document.getElementById(id);
function setMsg(el, text, good=false){ el.textContent=text; el.style.color = good?'#86efac':'#fecaca';}
function fmtDate(d){ return d.toISOString().split('T')[0]; }
function monthKey(date=new Date()){ return date.toISOString().slice(0,7); } // YYYY-MM
function todayStr(){ return fmtDate(new Date()); }
function setChip(id, val){ $(id).textContent = val; }
function pad2(n){ return String(n).padStart(2,'0'); }
function parseHM(s){
  if(!s) return null;
  // Accept "09:00-18:00" or "09:00 a 18:00" or "9:00-18"
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(?:-|a|A)\s*(\d{1,2}):?(\d{2})?/);
  if(!m) return null;
  const h1 = parseInt(m[1],10), m1 = parseInt(m[2]||"0",10);
  const h2 = parseInt(m[3],10), m2 = parseInt(m[4]||"0",10);
  const start = h1*60+m1, end = h2*60+m2;
  const diff = (end>=start? end-start : (24*60 - start + end));
  return { start, end, hours: (diff/60).toFixed(2) };
}
function weekdayKey(date){
  // return mon,tue,wed,thu,fri,sat,sun
  const idx = date.getDay(); // 0=Sun
  return ['sun','mon','tue','wed','thu','fri','sat'][idx];
}
function weekdayNameEsLong(date){
  return date.toLocaleDateString('es-AR', { weekday:'long' });
}

// ============ Elementos ============
const authCard = $("auth-card");
const appCard  = $("app-card");
const segEmp   = $("seg-employee");
const segAdm   = $("seg-admin");
const empView  = $("employee-view");
const admView  = $("admin-view");
const tblBody  = $("tbl-body");

// login widgets
$("tab-login").onclick = ()=>{ $("tab-login").classList.add('active'); $("tab-register").classList.remove('active'); }
$("tab-register").onclick = ()=>{ $("tab-register").classList.add('active'); $("tab-login").classList.remove('active'); }

$("login-btn").onclick = async ()=>{
  try{ await auth.signInWithEmailAndPassword($("email").value, $("password").value);
    setMsg($("auth-msg"), "Ingreso correcto", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
$("register-btn").onclick = async ()=>{
  try{ await auth.createUserWithEmailAndPassword($("email").value, $("password").value);
    setMsg($("auth-msg"), "Cuenta creada. Ya podés ingresar.", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
$("reset-btn").onclick = async ()=>{
  try{ await auth.sendPasswordResetEmail($("email").value);
    setMsg($("auth-msg"), "Te enviamos un mail para blanquear.", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
$("logout-btn").onclick = ()=>auth.signOut();

// Switch Admin/Empleado (visual; la habilitación real depende del rol)
segEmp.onclick = ()=>{ segEmp.classList.add("active"); segAdm.classList.remove("active"); empView.classList.remove("hidden"); admView.classList.add("hidden"); };
segAdm.onclick = ()=>{ segAdm.classList.add("active"); segEmp.classList.remove("active"); empView.classList.add("hidden"); admView.classList.remove("hidden"); };

// ============ Roles ============
const ADMIN_EMAILS = []; // ej: ["ale@hua.com"]
async function resolveRole(user){
  if(ADMIN_EMAILS.includes(user.email)) return "admin";
  try{
    const r = await db.collection("roles").doc(user.uid).get();
    if(r.exists && r.data().role === "admin") return "admin";
  }catch(_){}
  return "employee";
}

// ============ Empleado ============
async function loadEmployeeConfig(uid){
  const q = await db.collection("employee_config").where("userId","==",uid).limit(1).get();
  if(q.empty) return null;
  return { id: q.docs[0].id, ...q.docs[0].data() };
}

async function loadLock(uid, ym){
  const doc = await db.collection("locks").doc(`${uid}_${ym}`).get();
  return doc.exists ? doc.data() : { locked:false, lastSubmitted:null };
}
async function setLock(uid, ym, locked){
  await db.collection("locks").doc(`${uid}_${ym}`).set({ locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null }, { merge:true });
}

// Devuelve descripción de horario para un día en base a scheduleByDay
function habitualForDay(scheduleByDay, date){
  if(!scheduleByDay) return "";
  const k = weekdayKey(date);
  const day = scheduleByDay[k];
  if(!day) return "";
  if(day.off) return "No trabaja";
  if(day.variable) return "";
  const s = day.start||"", e = day.end||"";
  return (s && e) ? `${s}-${e}` : "";
}

function renderDays(scheduleByDay){
  tblBody.innerHTML = "";
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = new Date(y, m+1, 0).getDate();
  for(let d=1; d<=days; d++){
    const date = new Date(y,m,d);
    const ds = fmtDate(date);
    const dowName = weekdayNameEsLong(date); // nombre completo
    const habitual = habitualForDay(scheduleByDay, date);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><b>${pad2(d)}</b> <span class="muted">(${dowName})</span></td>
                    <td>${habitual||"—"}</td>
                    <td id="hours-${ds}" class="muted">—</td>
                    <td id="cell-${ds}"><span class="muted">—</span></td>`;
    tblBody.appendChild(tr);
  }
}

// Trae reportes del mes
async function fetchMonthReports(uid){
  const ym = monthKey();
  const start = ym+"-01";
  const end = ym+"-31";
  const snap = await db.collection("timesheets")
    .where("userId","==",uid).where("fecha",">=",start).where("fecha","<=",end).get();
  const map = {};
  snap.forEach(d=> map[d.data().fecha] = d.data());
  return map;
}
function buttonsForDate(ds, habitual, locked){
  if(locked) return `<span class="chip">Bloqueado</span>`;
  const haveHabitual = !!habitual;
  return `
    ${haveHabitual ? `<button class="btn small good" onclick="markHabitual('${ds}')">Habitual</button>` : ``}
    <button class="btn small bad" onclick="markAbsence('${ds}')">Falta</button>
    <button class="btn small" onclick="openDetail('${ds}')">Detalle</button>`;
}
async function paintMonth(uid, scheduleByDay, locked){
  const ym = monthKey();
  const data = await fetchMonthReports(uid);
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const days = new Date(y, m+1, 0).getDate();
  for(let d=1; d<=days; d++){
    const date = new Date(y,m,d);
    const ds = fmtDate(date);
    const habitual = habitualForDay(scheduleByDay, date);
    const cell = $("cell-"+ds);
    const hoursCell = $("hours-"+ds);
    if(!cell || !hoursCell) continue;
    const it = data[ds];
    if(it){
      const color = it.tipoReporte==="HABITUAL" ? "#86efac" : (it.tipoReporte==="FALTA" ? "#fecaca" : "#bfdbfe");
      cell.innerHTML = `<span style="color:${color};font-weight:700">${it.tipoReporte}</span> <span class="muted">${it.horarioReportado||it.comentarios||""}</span>`;
      const parsed = parseHM(it.horarioReportado || (it.tipoReporte==="HABITUAL"? habitual:""));
      hoursCell.textContent = parsed ? `${parsed.hours} h` : "—";
    }else{
      cell.innerHTML = buttonsForDate(ds, habitual, locked);
      hoursCell.textContent = "—";
    }
  }
}

// Acciones rápidas
window.markHabitual = async (ds)=>{
  const u = auth.currentUser; if(!u) return;
  const cfg = await loadEmployeeConfig(u.uid); if(!cfg) return;
  const ex = await db.collection("timesheets").where("userId","==",u.uid).where("fecha","==",ds).limit(1).get();
  if(!ex.empty){ setMsg($("emp-msg"), `Ya existe reporte para ${ds}`); return; }
  // obtener habitual específico del día
  const habitual = habitualForDay(cfg.scheduleByDay||{}, new Date(ds));
  await db.collection("timesheets").add({
    userId:u.uid, email:u.email, nombre: cfg.nombre||"", mesAnio: ds.slice(0,7),
    fecha: ds, tipoReporte:"HABITUAL", horarioReportado: habitual, comentarios:"Horario habitual",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  await bootEmployeeView(u); setMsg($("emp-msg"), `Guardado ${ds}`, true);
};
window.markAbsence = async (ds)=>{
  const u = auth.currentUser; if(!u) return;
  const ex = await db.collection("timesheets").where("userId","==",u.uid).where("fecha","==",ds).limit(1).get();
  if(!ex.empty){ setMsg($("emp-msg"), `Ya existe reporte para ${ds}`); return; }
  await db.collection("timesheets").add({
    userId:u.uid, email:u.email, nombre:"", mesAnio: ds.slice(0,7),
    fecha: ds, tipoReporte:"FALTA", horarioReportado:"", comentarios:"Ausencia",
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  await bootEmployeeView(u); setMsg($("emp-msg"), `Guardado como FALTA ${ds}`, true);
};
window.openDetail = (ds)=>{
  $("extra-form").classList.remove("hidden");
  $("extra-date").value = ds;
};
$("btn-extra-day").onclick = ()=>{ $("extra-form").classList.remove("hidden"); $("extra-date").value=""; };
$("close-extra").onclick  = ()=>{ $("extra-form").classList.add("hidden"); };
$("save-extra").onclick   = async ()=>{
  const u = auth.currentUser; if(!u) return;
  const date = $("extra-date").value, hours = $("extra-hours").value, notes = $("extra-notes").value;
  if(!date || !hours){ setMsg($("extra-msg"), "Fecha y horario son obligatorios"); return; }
  const ex = await db.collection("timesheets").where("userId","==",u.uid).where("fecha","==",date).limit(1).get();
  if(!ex.empty){ setMsg($("extra-msg"), "Ya existe un reporte ese día"); return; }
  await db.collection("timesheets").add({
    userId:u.uid, email:u.email, nombre:"", mesAnio: date.slice(0,7),
    fecha: date, tipoReporte:"EXTRA", horarioReportado: hours, comentarios: notes,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  setMsg($("extra-msg"), "Guardado", true);
  await bootEmployeeView(u);
  $("extra-form").classList.add("hidden");
  $("extra-hours").value=""; $("extra-notes").value="";
};

$("btn-submit-month").onclick = async ()=>{
  const u = auth.currentUser; if(!u) return;
  const ym = monthKey();
  await setLock(u.uid, ym, true);
  await bootEmployeeView(u);
  setMsg($("emp-msg"), "Planilla enviada y BLOQUEADA", true);
};

async function bootEmployeeView(user){
  const ym = monthKey();
  setChip("month-chip", ym);
  const cfg = await loadEmployeeConfig(user.uid);
  if(!cfg){ $("emp-name").textContent="(sin configurar)";
    setMsg($("emp-msg"), "Tu usuario no está configurado. Pídele al admin que complete employee_config.");
    renderDays({}); await paintMonth(user.uid, {}, false); return;
  }
  $("emp-name").textContent = cfg.nombre || user.email;
  const lk = await loadLock(user.uid, ym);
  setChip("lock-chip", lk.locked ? "Bloqueado" : "Editable");
  setChip("last-update-chip", lk.lastSubmitted ? new Date(lk.lastSubmitted.toDate()).toLocaleString() : "—");
  $("btn-submit-month").disabled = lk.locked;
  $("btn-extra-day").disabled    = lk.locked;

  renderDays(cfg.scheduleByDay||{});
  await paintMonth(user.uid, cfg.scheduleByDay||{}, lk.locked);
}

// ============ Admin ============
function readDayInputs(prefix){
  return {
    start: ($(`${prefix}-start`).value||"").trim(),
    end:   ($(`${prefix}-end`).value||"").trim(),
    off:   $(`${prefix}-off`).checked,
    variable: $(`${prefix}-var`).checked
  };
}
$("adm-upsert").onclick = async ()=>{
  const uid  = $("adm-uid").value.trim();
  const email= $("adm-email").value.trim();
  const name = $("adm-name").value.trim();
  const sched= $("adm-sched").value.trim();

  if(!uid && !email){ setMsg($("adm-msg"), "UID o Email requerido"); return; }

  const scheduleByDay = {
    mon: readDayInputs("mon"),
    tue: readDayInputs("tue"),
    wed: readDayInputs("wed"),
    thu: readDayInputs("thu"),
    fri: readDayInputs("fri"),
    sat: readDayInputs("sat"),
    sun: readDayInputs("sun"),
  };

  try{
    let docRef = null;
    if(uid){
      // buscar por userId
      const q = await db.collection("employee_config").where("userId","==",uid).limit(1).get();
      if(q.empty){
        docRef = await db.collection("employee_config").add({ userId: uid, email, nombre: name, horarioHabitual: sched, scheduleByDay });
      }else{
        await q.docs[0].ref.set({ userId: uid, email, nombre: name, horarioHabitual: sched, scheduleByDay }, { merge:true });
        docRef = q.docs[0].ref;
      }
    }else{
      // fallback por email
      const q = await db.collection("employee_config").where("email","==",email).limit(1).get();
      if(q.empty){
        setMsg($("adm-msg"), "No hay UID ni config previa por email. Ingresá UID.", false);
        return;
      }else{
        await q.docs[0].ref.set({ email, nombre: name, horarioHabitual: sched, scheduleByDay }, { merge:true });
        docRef = q.docs[0].ref;
      }
    }
    setMsg($("adm-msg"), "Guardado", true);
    await listEmployees();
  }catch(e){
    setMsg($("adm-msg"), e.message);
  }
};

$("adm-reset").onclick = async ()=>{
  try{ await auth.sendPasswordResetEmail($("adm-email").value.trim()); setMsg($("adm-msg"), "Email de blanqueo enviado", true); }
  catch(e){ setMsg($("adm-msg"), e.message); }
};

$("adm-lock").onclick = async ()=>{
  if(!$("adm-lock-uid").value || !$("adm-lock-month").value){ setMsg($("lock-msg"), "UID y mes requeridos"); return; }
  await setLock($("adm-lock-uid").value, $("adm-lock-month").value, true);
  setMsg($("lock-msg"), "Bloqueado", true);
};
$("adm-unlock").onclick = async ()=>{
  if(!$("adm-lock-uid").value || !$("adm-lock-month").value){ setMsg($("lock-msg"), "UID y mes requeridos"); return; }
  await setLock($("adm-lock-uid").value, $("adm-lock-month").value, false);
  setMsg($("lock-msg"), "Desbloqueado", true);
};

$("adm-refresh").onclick = ()=> listEmployees();
$("export-csv").onclick = async ()=>{
  const snap = await db.collection("timesheets").get();
  if(snap.empty){ setMsg($("adm-list-msg"), "Sin datos"); return; }
  let csv = "Nombre;Email;Fecha;Mes_Anio;Tipo;Detalle;Comentarios;UID\n";
  snap.forEach(d=>{
    const v = d.data();
    const row = [v.nombre||"",v.email||"",v.fecha||"",v.mesAnio||"",v.tipoReporte||"", (v.horarioReportado||"").replace(/[;,\n]/g," "), (v.comentarios||"").replace(/[;,\n]/g," "), v.userId||""].join(";");
    csv += row+"\n";
  });
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
  a.download = `reportes_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

async function employeeMonthStatus(uid, ym){
  const lk = await loadLock(uid, ym);
  return lk.locked ? `Bloqueado ${lk.lastSubmitted? "("+ new Date(lk.lastSubmitted.toDate()).toLocaleDateString()+")":""}` : "Editable";
}
async function listEmployees(){
  const ym = ($("adm-month").value || monthKey());
  $("adm-month").value = ym;
  $("adm-list").innerHTML = ""; $("adm-list-msg").textContent="Cargando...";
  const snap = await db.collection("employee_config").get();
  $("adm-list-msg").textContent="";
  if(snap.empty){ $("adm-list").innerHTML = `<tr><td colspan="6">Sin empleados</td></tr>`; return; }
  for (const d of snap.docs){
    const v = d.data();
    const status = await employeeMonthStatus(v.userId||d.id, ym);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${v.nombre||"—"}</td><td>${v.email||"—"}</td><td>${v.horarioHabitual||"—"}</td><td>${v.userId||d.id}</td>
                    <td>${status}</td>
                    <td><button class="btn small" onclick="inspectReports('${v.userId||d.id}','${v.nombre||""}','${ym}')">Ver reportes</button></td>`;
    $("adm-list").appendChild(tr);
  }
}

window.inspectReports = async (uid, name, ym)=>{
  ym = ym || monthKey();
  const start = ym+"-01", end = ym+"-31";
  const snap = await db.collection("timesheets").where("userId","==",uid).where("fecha",">=",start).where("fecha","<=",end).get();
  console.group(`Reportes de ${name||uid} (${ym})`);
  snap.forEach(d=>{
    const v = d.data(); console.log(`[${v.fecha}] ${v.tipoReporte} | ${v.horarioReportado||""} | ${v.comentarios||""}`);
  });
  console.groupEnd();
  setMsg($("adm-list-msg"), `Listados en consola ${name||uid}`, true);
};

// ============ Auth State ============
auth.onAuthStateChanged(async (user)=>{
  $("env-chip").textContent = "Conectado";
  if(!user){
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    $("user-email").textContent="—";
    $("role-chip").textContent="—";
    return;
  }
  $("user-email").textContent = user.email;
  authCard.classList.add("hidden");
  appCard.classList.remove("hidden");

  const role = await resolveRole(user);
  $("role-chip").textContent = role.toUpperCase();

  if(role === "admin"){
    segAdm.classList.add("active"); segEmp.classList.remove("active");
    empView.classList.add("hidden"); admView.classList.remove("hidden");
    await listEmployees();
  }else{
    segEmp.classList.add("active"); segAdm.classList.remove("active");
    empView.classList.remove("hidden"); admView.classList.add("hidden");
    await bootEmployeeView(user);
  }
});
