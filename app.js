// ===== Firebase =====
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

// ===== Helpers =====
const $ = (id)=>document.getElementById(id);
const fmt = (d)=>d.toISOString().split('T')[0];
const ym = (d)=>d.toISOString().slice(0,7);
const wkey = (d)=>['sun','mon','tue','wed','thu','fri','sat'][d.getDay()];
const wname = (d)=>d.toLocaleDateString('es-AR',{weekday:'long'});
function parseHM(s){
  if(!s) return null;
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(?:-|a|A)\s*(\d{1,2}):?(\d{2})?/);
  if(!m) return null;
  const h1=+m[1], m1=+(m[2]||0), h2=+m[3], m2=+(m[4]||0);
  const start=h1*60+m1, end=h2*60+m2;
  const diff = end>=start? end-start : (24*60-start+end);
  return {hours:(diff/60).toFixed(2)};
}
function setMsg(el, msg, good=false){ if(!el) return; el.textContent=msg; el.style.color = good?'#86efac':'#fecaca'; }

async function getConfig(uid){
  const q = await db.collection('employee_config').where('userId','==',uid).limit(1).get();
  if(q.empty) return null;
  return { id:q.docs[0].id, ...q.docs[0].data() };
}
async function getLock(uid, key){
  const d = await db.collection('locks').doc(`${uid}_${key}`).get();
  return d.exists ? d.data() : {locked:false,lastSubmitted:null};
}
async function setLock(uid, key, locked){
  await db.collection('locks').doc(`${uid}_${key}`).set({locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null},{merge:true});
}
async function monthReports(uid, key){
  const snap = await db.collection('timesheets').where('userId','==',uid).where('mesAnio','==',key).get();
  const map = {}; snap.forEach(x=> map[x.data().fecha]=x.data()); return map;
}

// ===== UI Rendering =====
function habitualForDay(sbd, d){
  const obj = sbd[wkey(d)]||{};
  if(obj.off) return {text:null, variable:false, skip:true};
  if(obj.variable) return {text:"", variable:true, skip:false};
  if(!obj.start || !obj.end) return {text:"", variable:false, skip:false};
  return {text:`${obj.start}-${obj.end}`, variable:false, skip:false};
}
function buildRow(dateStr, dow, habitual, variable, locked, existing){
  // returns TR element (+ optional subrow placeholder)
  const tr = document.createElement('tr');
  tr.id = `row-${dateStr}`;
  const dayCell = `<td><b>${dow} ${dateStr.slice(8,10)}/${dateStr.slice(5,7)}</b></td>`;
  const habitualCell = `<td>${variable ? `<input id="var-${dateStr}" placeholder="HH:MM-HH:MM" ${locked?'disabled':''}>` : (habitual||'—')}</td>`;
  const hoursCell = `<td id="hrs-${dateStr}" class="muted">—</td>`;
  const act =
    existing ? `<td><span class="tag">${existing.tipoReporte}</span></td>` :
    `<td class="icon-row">
        <button class="icon good" ${locked?'disabled':''} title="Habitual" onclick="markHabitual('${dateStr}')">✓</button>
        <button class="icon bad" ${locked?'disabled':''} title="Ausencia" onclick="markAbsence('${dateStr}')">✕</button>
        <button class="icon blue" ${locked?'disabled':''} title="Extra" onclick="toggleExtra('${dateStr}')">＋</button>
     </td>`;
  tr.innerHTML = dayCell + habitualCell + hoursCell + act;
  const sub = document.createElement('tr');
  sub.id = `sub-${dateStr}`;
  sub.className = 'subrow hidden';
  sub.innerHTML = `<td></td><td colspan="2"><div class="row"><label>Extra</label><input id="ex-${dateStr}" placeholder="HH:MM-HH:MM" ${locked?'disabled':''}></div></td>
                   <td><button class="btn small blue" ${locked?'disabled':''} onclick="saveMixed('${dateStr}')">Guardar</button></td>`;
  return [tr, sub];
}

async function paintTable(user){
  const key = $('emp-month').value || ym(new Date());
  $('emp-month').value = key;
  const cfg = await getConfig(user.uid);
  const lock = await getLock(user.uid, key);
  $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
  $('last-update').textContent = lock.lastSubmitted? new Date(lock.lastSubmitted.toDate()).toLocaleString() : '—';
  $('user-email').textContent = user.email;

  const name = cfg?.nombre || user.email;
  $('role-chip').textContent = `Empleado · ${name}`;

  const sbd = cfg?.scheduleByDay || {};
  const rows = $('rows'); rows.innerHTML = "";

  // existing month data
  const existing = await monthReports(user.uid, key);

  const [y, m] = key.split('-').map(Number);
  const count = new Date(y, m, 0).getDate(); // y, month index 1-based? JS months 0-11 so using (y, m, 0) gives last day prev month -> needs m as next month index; here m is 1..12; fine.
  for(let d=1; d<=count; d++){
    const date = new Date(y, m-1, d);
    const ds = fmt(date);
    const info = habitualForDay(sbd, date);
    if(info.skip) continue; // no trabaja → ocultar
    const [tr, sub] = buildRow(ds, wname(date).charAt(0).toUpperCase()+wname(date).slice(1), info.text, info.variable, lock.locked, existing[ds]);
    rows.appendChild(tr); rows.appendChild(sub);

    // fill hours if exists
    const rec = existing[ds];
    if(rec){
      const hrs = parseHM(rec.horarioReportado||"");
      $('hrs-'+ds).textContent = hrs? `${hrs.hours} h` : (rec.tipoReporte==='FALTA' ? '0 h' : '—');
    }
  }

  // disable submit if locked
  $('submit-month').disabled = lock.locked;
}

// ===== Actions =====
window.toggleExtra = (ds)=>{
  const el = $('sub-'+ds);
  if(!el) return;
  el.classList.toggle('hidden');
};

window.markHabitual = async (ds)=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value;
  const cfg = await getConfig(user.uid);
  const date = new Date(ds);
  const info = habitualForDay(cfg?.scheduleByDay||{}, date);
  let habitual = info.text;
  if(info.variable){
    const v = $('var-'+ds).value.trim();
    if(!v){ setMsg($('emp-msg'), 'Ingresá horario habitual para ese día', false); return; }
    habitual = v;
  }
  // single record
  await db.collection('timesheets').doc(`${user.uid}_${ds}`).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: ds, mesAnio: key, tipoReporte: 'HABITUAL', horarioReportado: habitual, comentarios: 'Horario habitual',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  const hrs = parseHM(habitual); $('hrs-'+ds).textContent = hrs? `${hrs.hours} h` : '—';
  // replace action cell by tag
  const cell = $('row-'+ds).children[3]; if(cell) cell.innerHTML = `<span class="tag">HABITUAL</span>`;
  setMsg($('emp-msg'), `Guardado ${ds}`, true);
};

window.markAbsence = async (ds)=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value;
  const cfg = await getConfig(user.uid);
  await db.collection('timesheets').doc(`${user.uid}_${ds}`).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: ds, mesAnio: key, tipoReporte: 'FALTA', horarioReportado: '', comentarios: 'Ausencia',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  $('hrs-'+ds).textContent = '0 h';
  const cell = $('row-'+ds).children[3]; if(cell) cell.innerHTML = `<span class="tag">FALTA</span>`;
  setMsg($('emp-msg'), `Falta marcada ${ds}`, true);
};

window.saveMixed = async (ds)=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value;
  const cfg = await getConfig(user.uid);
  const date = new Date(ds);
  const info = habitualForDay(cfg?.scheduleByDay||{}, date);
  let habitual = info.text;
  if(info.variable){
    const v = $('var-'+ds).value.trim();
    if(!v){ setMsg($('emp-msg'), 'Ingresá horario habitual para ese día', false); return; }
    habitual = v;
  }
  const extra = $('ex-'+ds).value.trim();
  if(!extra){ setMsg($('emp-msg'), 'Ingresá horario de extra', false); return; }
  await db.collection('timesheets').doc(`${user.uid}_${ds}`).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: ds, mesAnio: key, tipoReporte: 'MIXTO', horarioReportado: `${habitual} + ${extra}`, comentarios: 'Habitual + Extra',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  const h1 = parseHM(habitual)?.hours || 0;
  const h2 = parseHM(extra)?.hours || 0;
  $('hrs-'+ds).textContent = `${(+h1 + +h2).toFixed(2)} h`;
  $('sub-'+ds).classList.add('hidden');
  const cell = $('row-'+ds).children[3]; if(cell) cell.innerHTML = `<span class="tag">MIXTO</span>`;
  setMsg($('emp-msg'), `Guardado habitual + extra ${ds}`, true);
};

$('nh-save').onclick = async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value || ym(new Date());
  const date = $('nh-date').value; const hrs = $('nh-hours').value.trim(); const notes = $('nh-notes').value.trim();
  if(!date || !hrs){ setMsg($('nh-msg'), 'Fecha y horario requeridos'); return; }
  const cfg = await getConfig(user.uid);
  await db.collection('timesheets').doc(`${user.uid}_${date}`).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: date, mesAnio: key, tipoReporte: 'EXTRA', horarioReportado: hrs, comentarios: notes||'Extra en día no habitual',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  setMsg($('nh-msg'), 'Extra guardada', true);
  // si la fecha está en la tabla, actualizamos horas
  const h = parseHM(hrs)?.hours||0;
  const el = $('hrs-'+date); if(el){ const prev = parseFloat((el.textContent||'0').replace(' h',''))||0; el.textContent = `${(prev + +h).toFixed(2)} h`; }
};

$('submit-month').onclick = async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value || ym(new Date());
  await setLock(user.uid, key, true);
  const lk = await getLock(user.uid, key);
  $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
  $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
  $('submit-month').disabled = lk.locked;
};

$('emp-month').onchange = ()=>{ const u=auth.currentUser; if(u) paintTable(u); };

// ===== Auth =====
$('login-btn').onclick = async ()=>{
  try{ await auth.signInWithEmailAndPassword($('email').value, $('password').value); $('auth-msg').textContent=''; }catch(e){ setMsg($('auth-msg'), e.message); }
};
$('register-btn').onclick = async ()=>{
  try{ await auth.createUserWithEmailAndPassword($('email').value, $('password').value); setMsg($('auth-msg'), 'Cuenta creada', true);}catch(e){ setMsg($('auth-msg'), e.message); }
};
$('reset-btn').onclick = async ()=>{
  try{ await auth.sendPasswordResetEmail($('email').value); setMsg($('auth-msg'), 'Email enviado', true);}catch(e){ setMsg($('auth-msg'), e.message); }
};
$('logout-btn').onclick = ()=>auth.signOut();

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    $('auth-card').classList.remove('hidden');
    $('app-card').classList.add('hidden');
    $('user-email').textContent='—'; $('role-chip').textContent='—';
    return;
  }
  $('auth-card').classList.add('hidden');
  $('app-card').classList.remove('hidden');
  $('user-email').textContent = user.email;
  $('role-chip').textContent = 'Empleado';
  $('emp-month').value = ym(new Date());
  await paintTable(user);
});
