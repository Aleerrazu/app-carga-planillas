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
const hoursFromInts = (a,b)=>{
  const start = (parseInt(a,10)||0)*60, end=(parseInt(b,10)||0)*60;
  const diff = end>=start? end-start : (24*60-start+end);
  return (diff/60).toFixed(2);
};
function setMsg(el, msg, good=false){ if(!el) return; el.textContent=msg; el.style.color = good?'#86efac':'#fecaca'; }

async function getRole(user){
  try{ const r=await db.collection('roles').doc(user.uid).get(); if(r.exists && r.data().role==='admin') return 'admin'; }catch(e){}
  return 'employee';
}
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
function rowState(ds){ const r = document.getElementById('row-'+ds); return r ? JSON.parse(r.dataset.state||'{}') : {}; }
function setRowState(ds, st){ const r = document.getElementById('row-'+ds); if(r) r.dataset.state = JSON.stringify(st); }

function buildRow(dateStr, dateObj, habitual, variable, locked, existing){
  const tr = document.createElement('tr');
  tr.id = `row-${dateStr}`;
  const dow = wname(dateObj); const dayCell = `<td><b>${dow} ${dateStr.slice(8,10)}/${dateStr.slice(5,7)}</b></td>`;
  const habitualCell = `<td>${variable ? `<input id="var-${dateStr}" placeholder="HH:MM-HH:MM" ${locked?'disabled':''}>` : (habitual||'—')}</td>`;
  const hoursCell = `<td id="hrs-${dateStr}" class="muted">—</td>`;
  const act = `<td class="icon-row">
        <button id="ok-${dateStr}" class="icon good" title="Habitual" ${locked?'disabled':''}>✓</button>
        <button id="ab-${dateStr}" class="icon bad" title="Ausencia" ${locked?'disabled':''}>✕</button>
        <button id="exbtn-${dateStr}" class="icon blue" title="Extra" ${locked?'disabled':''}>＋</button>
      </td>`;
  const commentCell = `<td><input id="cm-${dateStr}" placeholder="Comentario..."></td>`;
  tr.innerHTML = dayCell + habitualCell + hoursCell + act + commentCell;

  const sub = document.createElement('tr');
  sub.id = `sub-${dateStr}`;
  sub.className = 'subrow hidden';
  sub.innerHTML = `<td></td><td colspan="3">
      <div class="row">
        <label>Extra</label>
        <input id="ex-${dateStr}" placeholder="HH:MM-HH:MM">
      </div>
    </td><td><button class="btn small blue" ${locked?'disabled':''} onclick="saveMixed('${dateStr}')">Guardar</button></td>`;

  const st = { ok:false, ab:false, ex:false, extraHours:"", comment: existing?.comentarios||"" };
  if(existing){
    if(existing.tipoReporte==='HABITUAL'){ st.ok = true; }
    if(existing.tipoReporte==='FALTA'){ st.ab = true; }
    if(existing.tipoReporte==='EXTRA'){ st.ex = true; st.extraHours = existing.horarioReportado||""; }
    if(existing.tipoReporte==='MIXTO'){ st.ok = true; st.ex = true; st.extraHours = (existing.horarioReportado||"").split('+')[1]?.trim()||""; }
  }
  setRowState(dateStr, st);

  return [tr, sub];
}

function applyStateToUI(ds, habitual, variable){
  const st = rowState(ds);
  const ok = document.getElementById('ok-'+ds), ab=document.getElementById('ab-'+ds), exb=document.getElementById('exbtn-'+ds), exInput=document.getElementById('ex-'+ds);
  ok.classList.toggle('active', !!st.ok);
  ab.classList.toggle('active', !!st.ab);
  exb.classList.toggle('active', !!st.ex);
  if(exInput && st.extraHours) exInput.value = st.extraHours;

  let total = 0;
  if(st.ok){
    let h = habitual;
    if(variable){ const v = (document.getElementById('var-'+ds)?.value||"").trim(); if(v) h = v; }
    const p = parseHM(h); if(p) total += +p.hours;
  }
  if(st.ab){ total = 0; }
  if(st.ex){
    const t = st.extraHours || (document.getElementById('ex-'+ds)?.value||"").trim();
    const p = parseHM(t); if(p) total += +p.hours;
  }
  document.getElementById('hrs-'+ds').textContent = total>0 ? `${total.toFixed(2)} h` : (st.ab ? '0 h' : '—');
}

async function persistState(user, ds, key, habitual, variable){
  const st = rowState(ds);
  let tipo = null, hr = "", com = (document.getElementById('cm-'+ds)?.value||"").trim();
  if(st.ok && st.ex){ tipo='MIXTO'; let h=habitual; if(variable){ const v=(document.getElementById('var-'+ds)?.value||"").trim(); if(v) h=v; } hr = `${h} + ${st.extraHours || (document.getElementById('ex-'+ds)?.value||"").trim()}`; }
  else if(st.ok){ tipo='HABITUAL'; let h=habitual; if(variable){ const v=(document.getElementById('var-'+ds)?.value||"").trim(); if(v) h=v; } hr = h; }
  else if(st.ab){ tipo='FALTA'; hr=""; }
  else if(st.ex){ tipo='EXTRA'; hr = st.extraHours || (document.getElementById('ex-'+ds)?.value||"").trim(); }
  const ref = db.collection('timesheets').doc(`${user.uid}_${ds}`);
  if(!tipo && !com){ await ref.delete().catch(()=>{}); } else {
    const cfg = await getConfig(user.uid);
    await ref.set({
      userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
      fecha: ds, mesAnio: key, tipoReporte: tipo||"",
      horarioReportado: hr, comentarios: com,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }
  document.getElementById('last-update').textContent = new Date().toLocaleString();
}

async function paintTable(user){
  const key = document.getElementById('emp-month').value || ym(new Date());
  document.getElementById('emp-month').value = key;
  const cfg = await getConfig(user.uid);
  const lock = await getLock(user.uid, key);
  document.getElementById('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
  document.getElementById('last-update').textContent = '—';
  document.getElementById('user-email').textContent = user.email;

  const role = await getRole(user);
  document.getElementById('role-chip').textContent = role.toUpperCase();
  if(role==='admin'){ document.getElementById('view-switch').classList.remove('hidden'); }

  const sbd = cfg?.scheduleByDay || {};
  const rows = document.getElementById('rows'); rows.innerHTML = "";
  const existing = await monthReports(user.uid, key);

  const [y, m] = key.split('-').map(Number);
  const count = new Date(y, m, 0).getDate();
  for(let d=1; d<=count; d++){
    const date = new Date(y, m-1, d);
    const ds = fmt(date);
    const info = habitualForDay(sbd, date);
    const hasExisting = !!existing[ds];
    if(info.skip && !hasExisting) continue;
    const [tr, sub] = buildRow(ds, date, info.text, info.variable, lock.locked, existing[ds]);
    rows.appendChild(tr); rows.appendChild(sub);
    const ok = document.getElementById('ok-'+ds), ab=document.getElementById('ab-'+ds), exb=document.getElementById('exbtn-'+ds);
    ok.onclick = async ()=>{ const st=rowState(ds); st.ok=!st.ok; if(st.ok) st.ab=false; setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); await persistState(user, ds, key, info.text, info.variable); };
    ab.onclick = async ()=>{ const st=rowState(ds); st.ab=!st.ab; if(st.ab){ st.ok=false; st.ex=false; } setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); await persistState(user, ds, key, info.text, info.variable); };
    exb.onclick = ()=>{ document.getElementById('sub-'+ds).classList.toggle('hidden'); };
    applyStateToUI(ds, info.text, info.variable);
    if(existing[ds]){
      document.getElementById('cm-'+ds).value = existing[ds].comentarios||"";
      if(existing[ds].timestamp) document.getElementById('last-update').textContent = new Date(existing[ds].timestamp.toDate()).toLocaleString();
    }
    document.getElementById('cm-'+ds).addEventListener('blur', async ()=>{
      await persistState(user, ds, key, info.text, info.variable);
    });
  }
  document.getElementById('submit-month').disabled = lock.locked;
}

window.saveMixed = async (ds)=>{
  const user = auth.currentUser; if(!user) return;
  const key = document.getElementById('emp-month').value || ym(new Date());
  const st = rowState(ds); st.ex = true; st.ok = true; st.ab = false; st.extraHours = (document.getElementById('ex-'+ds)?.value||"").trim(); setRowState(ds,st);
  document.getElementById('sub-'+ds).classList.add('hidden');
  const cfg = await getConfig(user.uid); const date = new Date(ds);
  const info = habitualForDay((cfg?.scheduleByDay)||{}, date);
  applyStateToUI(ds, info.text, info.variable);
  await persistState(user, ds, key, info.text, info.variable);
};

document.getElementById('nh-save').onclick = async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = document.getElementById('emp-month').value || ym(new Date());
  const date = document.getElementById('nh-date').value; const h1 = document.getElementById('nh-from').value; const h2 = document.getElementById('nh-to').value; const notes = document.getElementById('nh-notes').value.trim();
  if(!date || h1==="" || h2===""){ setMsg(document.getElementById('nh-msg'), 'Fecha y horas requeridas'); return; }
  const hrs = `${String(h1).padStart(2,'0')}:00-${String(h2).padStart(2,'0')}:00`;
  const cfg = await getConfig(user.uid);
  await db.collection('timesheets').doc(`${user.uid}_${date}`).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: date, mesAnio: key, tipoReporte: 'EXTRA', horarioReportado: hrs, comentarios: notes||'Extra en día no habitual',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  setMsg(document.getElementById('nh-msg'), 'Extra guardada', true);
  document.getElementById('last-update').textContent = new Date().toLocaleString();
  await paintTable(user);
};

document.getElementById('submit-month').onclick = async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = document.getElementById('emp-month').value || ym(new Date());
  await setLock(user.uid, key, true);
  const lk = await getLock(user.uid, key);
  document.getElementById('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
  document.getElementById('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
  document.getElementById('submit-month').disabled = lk.locked;
};

document.getElementById('emp-month').onchange = ()=>{ const u=auth.currentUser; if(u) paintTable(u); };

// Auth & toggles
document.getElementById('login-btn')?.addEventListener('click', async ()=>{
  try{ await auth.signInWithEmailAndPassword(document.getElementById('email').value, document.getElementById('password').value); document.getElementById('auth-msg').textContent=''; }catch(e){ setMsg(document.getElementById('auth-msg'), e.message); }
});
document.getElementById('register-btn')?.addEventListener('click', async ()=>{
  try{ await auth.createUserWithEmailAndPassword(document.getElementById('email').value, document.getElementById('password').value); setMsg(document.getElementById('auth-msg'), 'Cuenta creada', true);}catch(e){ setMsg(document.getElementById('auth-msg'), e.message); }
});
document.getElementById('reset-btn')?.addEventListener('click', async ()=>{
  try{ await auth.sendPasswordResetEmail(document.getElementById('email').value); setMsg(document.getElementById('auth-msg'), 'Email enviado', true);}catch(e){ setMsg(document.getElementById('auth-msg'), e.message); }
});
document.getElementById('logout-btn').onclick = ()=>auth.signOut();

document.getElementById('seg-employee')?.addEventListener('click', ()=>{
  document.getElementById('seg-employee').classList.add('active'); document.getElementById('seg-admin').classList.remove('active');
  document.getElementById('employee-view').classList.remove('hidden'); document.getElementById('admin-view').classList.add('hidden');
});
document.getElementById('seg-admin')?.addEventListener('click', ()=>{
  document.getElementById('seg-admin').classList.add('active'); document.getElementById('seg-employee').classList.remove('active');
  document.getElementById('employee-view').classList.add('hidden'); document.getElementById('admin-view').classList.remove('hidden');
});

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    document.getElementById('auth-card').classList.remove('hidden');
    document.getElementById('app-card').classList.add('hidden');
    document.getElementById('user-email').textContent='—'; document.getElementById('role-chip').textContent='—';
    document.getElementById('view-switch').classList.add('hidden');
    return;
  }
  document.getElementById('auth-card').classList.add('hidden');
  document.getElementById('app-card').classList.remove('hidden');
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('emp-month').value = ym(new Date());

  const role = await getRole(user);
  document.getElementById('role-chip').textContent = role.toUpperCase();
  if(role==='admin'){ document.getElementById('view-switch').classList.remove('hidden'); }

  await paintTable(user);
});
