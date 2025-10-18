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
function setChip(id, val){ const el=$(id); if(el) el.textContent = val; }
function pad2(n){ return String(n).padStart(2,'0'); }
function parseHM(s){
  if(!s) return null;
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(?:-|a|A)\s*(\d{1,2}):?(\d{2})?/);
  if(!m) return null;
  const h1 = parseInt(m[1],10), m1 = parseInt(m[2]||"0",10);
  const h2 = parseInt(m[3],10), m2 = parseInt(m[4]||"0",10);
  const start = h1*60+m1, end = h2*60+m2;
  const diff = (end>=start? end-start : (24*60 - start + end));
  return { start, end, hours: (diff/60).toFixed(2) };
}
function weekdayKey(date){ return ['sun','mon','tue','wed','thu','fri','sat'][date.getDay()]; }
function weekdayNameEsLong(date){ return date.toLocaleDateString('es-AR', { weekday:'long' }); }

// ============ Elementos ============
const authCard = $("auth-card");
const appCard  = $("app-card");
const segEmp   = $("seg-employee");
const segAdm   = $("seg-admin");
const empView  = $("employee-view");
const admView  = $("admin-view");

// Admin tabs
const tabEmp = $("tab-admin-employees");
const tabSch = $("tab-admin-schedules");
const tabMon = $("tab-admin-month");
const adminEmployees = $("admin-employees");
const adminSchedules = $("admin-schedules");
const adminMonth     = $("admin-month");
if(tabEmp&&tabSch&&tabMon){
  tabEmp.onclick = async ()=>{
    tabEmp.classList.add("active"); tabSch.classList.remove("active"); tabMon.classList.remove("active");
    adminEmployees.classList.remove("hidden"); adminSchedules.classList.add("hidden"); adminMonth.classList.add("hidden");
    await loadAdminEmployees(); // refresca al entrar
  };
  tabSch.onclick = async ()=>{
    tabSch.classList.add("active"); tabEmp.classList.remove("active"); tabMon.classList.remove("active");
    adminEmployees.classList.add("hidden"); adminSchedules.classList.remove("hidden"); adminMonth.classList.add("hidden");
    await loadSchedulesPane(); // refresca al entrar
  };
  tabMon.onclick = async ()=>{
    tabMon.classList.add("active"); tabEmp.classList.remove("active"); tabSch.classList.remove("active");
    adminEmployees.classList.add("hidden"); adminSchedules.classList.add("hidden"); adminMonth.classList.remove("hidden");
    await listEmployeesMonth(); // refresca al entrar
  };
}

// login/register widgets
const tabLogin=$("tab-login"), tabRegister=$("tab-register");
if(tabLogin&&tabRegister){
  tabLogin.onclick = ()=>{ tabLogin.classList.add('active'); tabRegister.classList.remove('active'); };
  tabRegister.onclick = ()=>{ tabRegister.classList.add('active'); tabLogin.classList.remove('active'); };
}
const loginBtn=$("login-btn"), registerBtn=$("register-btn"), resetBtn=$("reset-btn");
if(loginBtn) loginBtn.onclick = async ()=>{
  try{ await auth.signInWithEmailAndPassword($("email").value, $("password").value);
    setMsg($("auth-msg"), "Ingreso correcto", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
if(registerBtn) registerBtn.onclick = async ()=>{
  try{ await auth.createUserWithEmailAndPassword($("email").value, $("password").value);
    setMsg($("auth-msg"), "Cuenta creada. Ya podés ingresar.", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
if(resetBtn) resetBtn.onclick = async ()=>{
  try{ await auth.sendPasswordResetEmail($("email").value);
    setMsg($("auth-msg"), "Te enviamos un mail para blanquear.", true);
  }catch(e){ setMsg($("auth-msg"), e.message); }
};
const logoutBtn=$("logout-btn"); if(logoutBtn) logoutBtn.onclick = ()=>auth.signOut();

// Switch Admin/Empleado (visual)
if(segEmp&&segAdm){
  segEmp.onclick = ()=>{ segEmp.classList.add("active"); segAdm.classList.remove("active"); empView.classList.remove("hidden"); admView.classList.add("hidden"); };
  segAdm.onclick = async ()=>{ segAdm.classList.add("active"); segEmp.classList.remove("active"); empView.classList.add("hidden"); admView.classList.remove("hidden"); await loadAdminEmployees(); await loadSchedulesPane(); await listEmployeesMonth(); };
}

// ============ Roles ============
const ADMIN_EMAILS = []; // ej: ["tu@empresa.com"]
async function resolveRole(user){
  if(ADMIN_EMAILS.includes(user.email)) return "admin";
  try{
    const r = await db.collection("roles").doc(user.uid).get();
    if(r.exists && r.data().role === "admin") return "admin";
  }catch(_){}
  return "employee";
}

// ================= Admin: Empleados =====================
async function fetchAllEmployees(){
  const snap = await db.collection("employee_config").get();
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}
function renderEmployeeList(containerId, list, handler){
  const el = $(containerId); if(!el) return; el.innerHTML = "";
  list.forEach(v=>{
    const wrap = document.createElement("div");
    wrap.className = "item";
    wrap.innerHTML = `<div><b>${v.nombre||"—"}</b><div class="muted tiny">${v.email||"—"} · <span class="chip">${v.userId||v.id}</span></div></div>
                      <div class="row"><button class="btn small gray">Editar</button></div>`;
    wrap.querySelector("button").onclick = ()=> handler(v);
    el.appendChild(wrap);
  });
}
async function loadAdminEmployees(){
  const msg = $("adm-users-msg"); if(msg) msg.textContent="Cargando...";
  const list = await fetchAllEmployees();
  if(msg) msg.textContent="";
  renderEmployeeList("adm-users-list", list, (v)=>{
    $("adm-name").value = v.nombre||""; $("adm-email").value = v.email||""; $("adm-username").value = v.username||""; $("adm-uid").value = v.userId||v.id;
  });
}
const saveEmpBtn=$("adm-save-employee");
if(saveEmpBtn) saveEmpBtn.onclick = async ()=>{
  const uid  = $("adm-uid").value.trim();
  const email= $("adm-email").value.trim();
  const name = $("adm-name").value.trim();
  const username = $("adm-username").value.trim();
  const msg = $("adm-msg");

  if(!uid && !email){ setMsg(msg, "UID o Email requerido"); return; }
  try{
    if(uid){
      const q = await db.collection("employee_config").where("userId","==",uid).limit(1).get();
      if(q.empty){ await db.collection("employee_config").add({ userId:uid, email, nombre:name, username }); }
      else { await q.docs[0].ref.set({ userId:uid, email, nombre:name, username }, { merge:true }); }
    }else{
      const q = await db.collection("employee_config").where("email","==",email).limit(1).get();
      if(q.empty){ setMsg(msg, "Si no hay UID, primero creá el usuario y completá su UID.", false); return; }
      else { await q.docs[0].ref.set({ email, nombre:name, username }, { merge:true }); }
    }
    setMsg(msg, "Empleado guardado", true);
    // 🔁 Refrescar ambas listas para ver el cambio en todas las pestañas
    await loadAdminEmployees();
    await loadSchedulesPane();
  }catch(e){ setMsg(msg, e.message); }
};
const resetEmpBtn=$("adm-reset");
if(resetEmpBtn) resetEmpBtn.onclick = async ()=>{
  try{ await auth.sendPasswordResetEmail($("adm-email").value.trim()); setMsg($("adm-msg"), "Email de blanqueo enviado", true); }
  catch(e){ setMsg($("adm-msg"), e.message); }
};

// ================= Admin: Horarios ======================
function readDayInputs(prefix){
  return {
    start: ($(`${prefix}-start`).value||"").trim(),
    end:   ($(`${prefix}-end`).value||"").trim(),
    off:   $(`${prefix}-off`).checked,
    variable: $(`${prefix}-var`).checked
  };
}
function fillDayInputs(prefix, obj){
  $(`${prefix}-start`).value = obj?.start||"";
  $(`${prefix}-end`).value   = obj?.end||"";
  $(`${prefix}-off`).checked = !!obj?.off;
  $(`${prefix}-var`).checked = !!obj?.variable;
}
let currentSchedUID = null;
async function loadSchedulesPane(){
  const msg = $("sched-users-msg"); if(msg) msg.textContent="Cargando...";
  const list = await fetchAllEmployees();
  if(msg) msg.textContent="";
  renderEmployeeList("sched-users", list, (v)=>selectEmployeeForSchedule(v));
}
const refreshSchedBtn = $("sched-refresh"); if(refreshSchedBtn) refreshSchedBtn.onclick = ()=> loadSchedulesPane();
async function loadEmployeeConfigByUID(uid){
  const q = await db.collection("employee_config").where("userId","==",uid).limit(1).get();
  if(q.empty) return null;
  return { id:q.docs[0].id, ...q.docs[0].data() };
}
async function selectEmployeeForSchedule(v){
  currentSchedUID = v.userId||v.id;
  $("sched-emp-name").textContent = v.nombre||v.email||currentSchedUID;
  const cfg = await loadEmployeeConfigByUID(currentSchedUID);
  const sbd = cfg?.scheduleByDay||{};
  fillDayInputs("mon", sbd.mon); fillDayInputs("tue", sbd.tue); fillDayInputs("wed", sbd.wed);
  fillDayInputs("thu", sbd.thu); fillDayInputs("fri", sbd.fri); fillDayInputs("sat", sbd.sat); fillDayInputs("sun", sbd.sun);
  $("adm-sched").value = cfg?.horarioHabitual||"";
}
const saveSchedBtn=$("save-schedule");
if(saveSchedBtn) saveSchedBtn.onclick = async ()=>{
  const msg = $("sched-msg");
  if(!currentSchedUID){ setMsg(msg, "Elegí un empleado"); return; }
  const scheduleByDay = {
    mon: readDayInputs("mon"), tue: readDayInputs("tue"), wed: readDayInputs("wed"),
    thu: readDayInputs("thu"), fri: readDayInputs("fri"), sat: readDayInputs("sat"), sun: readDayInputs("sun")
  };
  try{
    const q = await db.collection("employee_config").where("userId","==",currentSchedUID).limit(1).get();
    if(q.empty){ setMsg(msg, "Empleado sin config base (usa pestaña Empleados)", false); return; }
    await q.docs[0].ref.set({ scheduleByDay, horarioHabitual: $("adm-sched").value.trim() }, { merge:true });
    setMsg(msg, "Horario guardado", true);
  }catch(e){ setMsg(msg, e.message); }
};

// ================= Admin: Estado mensual ================
async function loadLock(uid, ym){
  const doc = await db.collection("locks").doc(`${uid}_${ym}`).get();
  return doc.exists ? doc.data() : { locked:false, lastSubmitted:null };
}
async function setLock(uid, ym, locked){
  await db.collection("locks").doc(`${uid}_${ym}`).set({ locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null }, { merge:true });
}
async function employeeMonthStatus(uid, ym){
  const lk = await loadLock(uid, ym);
  return lk.locked ? `Bloqueado ${lk.lastSubmitted? "("+ new Date(lk.lastSubmitted.toDate()).toLocaleDateString()+")":""}` : "Editable";
}
async function listEmployeesMonth(){
  const ym = ($("adm-month").value || monthKey()); $("adm-month").value = ym;
  const tbody = $("adm-list"), msg = $("adm-list-msg");
  tbody.innerHTML = ""; if(msg) msg.textContent="Cargando...";
  const snap = await db.collection("employee_config").get();
  if(msg) msg.textContent="";
  if(snap.empty){ tbody.innerHTML = `<tr><td colspan="5">Sin empleados</td></tr>`; return; }
  for (const d of snap.docs){
    const v = d.data(); const uid = v.userId||d.id;
    const status = await employeeMonthStatus(uid, ym);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${v.nombre||"—"}</td><td>${v.email||"—"}</td><td>${uid}</td>
                    <td>${status}</td>
                    <td class="row">
                      <button class="btn small" onclick="inspectReports('${uid}','${v.nombre||""}','${ym}')">Ver</button>
                      <button class="btn small good" onclick="quickLock('${uid}','${ym}',true)">Bloquear</button>
                      <button class="btn small bad"  onclick="quickLock('${uid}','${ym}',false)">Permitir cambios</button>
                    </td>`;
    tbody.appendChild(tr);
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
  const msg = $("adm-list-msg"); if(msg) setMsg(msg, `Listados en consola ${name||uid}`, true);
};
window.quickLock = async (uid, ym, locked)=>{ await setLock(uid, ym, locked); await listEmployeesMonth(); };

const admRefresh=$("adm-refresh"); if(admRefresh) admRefresh.onclick = ()=> listEmployeesMonth();
const exportBtn=$("export-csv"); if(exportBtn) exportBtn.onclick = async ()=>{
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

// ================== Auth State ==========================
auth.onAuthStateChanged(async (user)=>{
  setChip("env-chip", "Conectado");
  if(!user){
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
    setChip("user-email","—");
    setChip("role-chip","—");
    return;
  }
  setChip("user-email", user.email);
  authCard.classList.add("hidden");
  appCard.classList.remove("hidden");

  const role = await resolveRole(user);
  setChip("role-chip", role.toUpperCase());
  setChip("month-chip", monthKey());

  if(segEmp&&segAdm){
    if(role === "admin"){
      segAdm.classList.add("active"); segEmp.classList.remove("active");
      empView.classList.add("hidden"); admView.classList.remove("hidden");
      await loadAdminEmployees();
      await loadSchedulesPane();
      await listEmployeesMonth();
    }else{
      segEmp.classList.add("active"); segAdm.classList.remove("active");
      empView.classList.remove("hidden"); admView.classList.add("hidden");
    }
  }
});