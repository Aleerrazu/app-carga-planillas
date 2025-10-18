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

// Switch Admin/Empleado (solo visual; la habilitación real depende del rol)
segEmp.onclick = ()=>{ segEmp.classList.add("active"); segAdm.classList.remove("active"); empView.classList.remove("hidden"); admView.classList.add("hidden"); };
segAdm.onclick = ()=>{ segAdm.classList.add("active"); segEmp.classList.remove("active"); empView.classList.add("hidden"); admView.classList.remove("hidden"); };

// ============ Roles ============
// 1) Lista rápida por email (editá esto si querés)
const ADMIN_EMAILS = []; // ej: ["ale@hua.com"]
// 2) O bien, un doc en Firestore: roles/{uid} { role: "admin" | "employee" }

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
  return q.docs[0].data();
}

async function loadLock(uid, ym){
  const doc = await db.collection("locks").doc(`${uid}_${ym}`).get();
  return doc.exists ? doc.data() : { locked:false, lastSubmitted:null };
}
async function setLock(uid, ym, locked){
  await db.collection("locks").doc(`${uid}_${ym}`).set({ locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null }, { merge:true });
}

function renderDays(habitual){
  tblBody.innerHTML = "";
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = new Date(y, m+1, 0).getDate();
  const today = todayStr();
  for(let d=1; d<=days; d++){
    const date = new Date(y,m,d);
    const ds = fmtDate(date);
    const dow = date.toLocaleDateString('es-AR',{weekday:'short'});
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><b>${String(d).padStart(2,'0')}</b> <span class="muted">(${dow})</span></td>
                    <td>${habitual||"—"}</td>
                    <td id="cell-${ds}"><span class="muted">—</span></td>`;
    tblBody.appendChild(tr);
  }
}

// persistencia de reporte por día
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
function buttonsForDate(ds, locked){
  if(locked) return `<span class="chip">Bloqueado</span>`;
  return `<button class="btn small good" onclick="markHabitual('${ds}')">Habitual</button>
          <button class="btn small bad" onclick="markAbsence('${ds}')">Falta</button>
          <button class="btn small" onclick="openDetail('${ds}')">Detalle</button>`;
}
async function paintMonth(uid, habitual, locked){
  const data = await fetchMonthReports(uid);
  Object.keys(data).forEach(ds=>{
    const cell = $("cell-"+ds);
    if(!cell) return;
    const it = data[ds];
    const color = it.tipoReporte==="HABITUAL" ? "#86efac" : (it.tipoReporte==="FALTA" ? "#fecaca" : "#bfdbfe");
    cell.innerHTML = `<span style="color:${color};font-weight:700">${it.tipoReporte}</span> <span class="muted">${it.horarioReportado||it.comentarios||""}</span>`;
  });
  // rellenar resto con acciones
  const y = new Date().getFullYear(), m = new Date().getMonth();
  const days = new Date(y, m+1, 0).getDate();
  for(let d=1; d<=days; d++){
    const ds = fmtDate(new Date(y,m,d));
    const cell = $("cell-"+ds);
    if(cell && cell.innerHTML.includes("—")) cell.innerHTML = buttonsForDate(ds, locked);
  }
}

// Acciones rápidas
window.markHabitual = async (ds)=>{
  const u = auth.currentUser; if(!u) return;
  const cfg = await loadEmployeeConfig(u.uid); if(!cfg) return;
  const ex = await db.collection("timesheets").where("userId","==",u.uid).where("fecha","==",ds).limit(1).get();
  if(!ex.empty){ setMsg($("emp-msg"), `Ya existe reporte para ${ds}`); return; }
  await db.collection("timesheets").add({
    userId:u.uid, email:u.email, nombre: cfg.nombre||"", mesAnio: ds.slice(0,7),
    fecha: ds, tipoReporte:"HABITUAL", horarioReportado: cfg.horarioHabitual||"", comentarios:"Horario habitual",
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
  if(!cfg){ $("emp-name").textContent="(sin configurar)"; $("emp-sched").textContent="—";
    setMsg($("emp-msg"), "Tu usuario no está configurado. Pídele al admin que complete employee_config.");
    renderDays(""); paintMonth(user.uid,"",false); return;
  }
  $("emp-name").textContent = cfg.nombre || user.email;
  $("emp-sched").textContent = cfg.horarioHabitual || "—";
  renderDays(cfg.horarioHabitual||"");

  const lk = await loadLock(user.uid, ym);
  setChip("lock-chip", lk.locked ? "Bloqueado" : "Editable");
  setChip("last-update-chip", lk.lastSubmitted ? new Date(lk.lastSubmitted.toDate()).toLocaleString() : "—");
  $("btn-submit-month").disabled = lk.locked;
  $("btn-extra-day").disabled    = lk.locked;

  await paintMonth(user.uid, cfg.horarioHabitual||"", lk.locked);
}

// ============ Admin ============
$("adm-upsert").onclick = async ()=>{
  const email = $("adm-email").value.trim();
  const name  = $("adm-name").value.trim();
  const sched = $("adm-sched").value.trim();
  if(!email || !sched){ setMsg($("adm-msg"), "Email y Horario son obligatorios"); return; }
  // buscar uid por email en config existente
  const q = await db.collection("employee_config").where("email","==",email).limit(1).get();
  if(q.empty){
    setMsg($("adm-msg"), "No existe config para ese email. Crea el usuario primero (registro) y luego completa su UID en employee_config.", false);
  }else{
    await q.docs[0].ref.set({ email, nombre: name || q.docs[0].data().nombre || "", horarioHabitual: sched }, { merge:true });
    setMsg($("adm-msg"), "Actualizado", true);
    listEmployees();
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

async function listEmployees(){
  $("adm-list").innerHTML = ""; $("adm-list-msg").textContent="Cargando...";
  const snap = await db.collection("employee_config").get();
  $("adm-list-msg").textContent="";
  if(snap.empty){ $("adm-list").innerHTML = `<tr><td colspan="5">Sin empleados</td></tr>`; return; }
  snap.forEach(d=>{
    const v = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${v.nombre||"—"}</td><td>${v.email||"—"}</td><td>${v.horarioHabitual||"—"}</td><td>${v.userId||d.id}</td>
                    <td><button class="btn small" onclick="inspectReports('${v.userId||d.id}','${v.nombre||""}')">Ver reportes</button></td>`;
    $("adm-list").appendChild(tr);
  });
}
window.inspectReports = async (uid, name)=>{
  const ym = monthKey();
  const start = ym+"-01", end = ym+"-31";
  const snap = await db.collection("timesheets").where("userId","==",uid).where("fecha",">=",start).where("fecha","<=",end).get();
  console.group(`Reportes de ${name||uid} (${ym})`);
  snap.forEach(d=>{
    const v = d.data(); console.log(`[${v.fecha}] ${v.tipoReporte} | ${v.horarioReportado||""} | ${v.comentarios||""}`);
  });
  console.groupEnd();
  setMsg($("adm-list-msg"), `Listados en consola ${name||uid}`, true);
};

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
