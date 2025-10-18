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
  const d = await db.collection('locks').doc(uid+'_'+key).get();
  return d.exists ? d.data() : {locked:false,lastSubmitted:null};
}
async function setLock(uid, key, locked){
  await db.collection('locks').doc(uid+'_'+key).set({locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null},{merge:true});
}
async function monthReports(uid, key){
  const snap = await db.collection('timesheets').where('userId','==',uid).where('mesAnio','==',key).get();
  const map = {}; snap.forEach(x=> map[x.data().fecha]=x.data()); return map;
}

// ===== Login (global) =====
async function doLogin(){
  const btn = $('login-btn'); const msg = $('auth-msg');
  try{
    btn.disabled = true; btn.textContent = 'Ingresando...';
    const email = $('email').value; const pass = $('password').value;
    await auth.signInWithEmailAndPassword(email, pass);
    setMsg(msg, 'Ingreso correcto', true);
  }catch(e){
    console.error('Login error', e); setMsg($('auth-msg'), e.message || 'No se pudo ingresar');
  }finally{
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}
window.doLogin = doLogin;

// ===== Employee table =====
function habitualForDay(sbd, d){
  const obj = sbd[wkey(d)]||{};
  if(obj.off) return {text:null, variable:false, skip:true};
  if(obj.variable) return {text:'', variable:true, skip:false};
  if(!obj.start || !obj.end) return {text:'', variable:false, skip:false};
  return {text:obj.start+'-'+obj.end, variable:false, skip:false};
}
function rowState(ds){ const r = document.getElementById('row-'+ds); return r ? JSON.parse(r.dataset.state||'{}') : {}; }
function setRowState(ds, st){ const r = document.getElementById('row-'+ds); if(r) r.dataset.state = JSON.stringify(st); }

function buildRow(dateStr, dateObj, habitual, variable, locked, existing){
  const tr = document.createElement('tr'); tr.id = 'row-'+dateStr;
  const dayTd = document.createElement('td'); dayTd.innerHTML = '<b>'+wname(dateObj)+' '+dateStr.slice(8,10)+'/'+dateStr.slice(5,7)+'</b>';
  const habTd = document.createElement('td');
  if(variable){
    const inp = document.createElement('input'); inp.id='var-'+dateStr; inp.placeholder='HH:MM-HH:MM'; if(locked) inp.disabled=true; habTd.appendChild(inp);
  }else{
    habTd.textContent = habitual || '—';
  }
  const hrsTd = document.createElement('td'); hrsTd.id = 'hrs-'+dateStr; hrsTd.className='muted'; hrsTd.textContent='—';

  const actTd = document.createElement('td'); actTd.className='icon-row';
  const ok = document.createElement('button'); ok.id='ok-'+dateStr; ok.className='icon good'; ok.textContent='✓'; if(locked) ok.disabled=true;
  const ab = document.createElement('button'); ab.id='ab-'+dateStr; ab.className='icon bad'; ab.textContent='✕'; if(locked) ab.disabled=true;
  const ex = document.createElement('button'); ex.id='exbtn-'+dateStr; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
  actTd.appendChild(ok); actTd.appendChild(ab); actTd.appendChild(ex);

  const cmTd = document.createElement('td'); const cm = document.createElement('input'); cm.id='cm-'+dateStr; cm.placeholder='Comentario...'; cmTd.appendChild(cm);

  tr.appendChild(dayTd); tr.appendChild(habTd); tr.appendChild(hrsTd); tr.appendChild(actTd); tr.appendChild(cmTd);

  const sub = document.createElement('tr'); sub.id='sub-'+dateStr; sub.className='subrow hidden';
  const subTd1=document.createElement('td'); const subTd2=document.createElement('td'); subTd2.colSpan=3;
  const rowDiv=document.createElement('div'); rowDiv.className='row';
  const lbl=document.createElement('label'); lbl.textContent='Extra';
  const exIn=document.createElement('input'); exIn.id='ex-'+dateStr; exIn.placeholder='HH:MM-HH:MM';
  rowDiv.appendChild(lbl); rowDiv.appendChild(exIn); subTd2.appendChild(rowDiv);
  const subTd3=document.createElement('td'); const saveBtn=document.createElement('button'); saveBtn.className='btn small blue'; if(locked) saveBtn.disabled=true; saveBtn.textContent='Guardar';
  saveBtn.addEventListener('click', ()=>window.saveMixed(dateStr));
  subTd3.appendChild(saveBtn);
  sub.appendChild(subTd1); sub.appendChild(subTd2); sub.appendChild(subTd3);

  // state
  const st = { ok:false, ab:false, ex:false, extraHours:'', comment: existing && existing.comentarios || '' };
  if(existing){
    if(existing.tipoReporte==='HABITUAL'){ st.ok=true; }
    if(existing.tipoReporte==='FALTA'){ st.ab=true; }
    if(existing.tipoReporte==='EXTRA'){ st.ex=true; st.extraHours = existing.horarioReportado || ''; }
    if(existing.tipoReporte==='MIXTO'){ st.ok=true; st.ex=true; const parts=(existing.horarioReportado||'').split('+'); st.extraHours=(parts[1]||'').trim(); }
  }
  setRowState(dateStr, st);

  return [tr, sub];
}

function applyStateToUI(ds, habitual, variable){
  const st = rowState(ds);
  const ok = $('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds), exInput=$('ex-'+ds);
  ok.classList.toggle('active', !!st.ok);
  ab.classList.toggle('active', !!st.ab);
  exb.classList.toggle('active', !!st.ex);
  if(exInput && st.extraHours) exInput.value = st.extraHours;

  let total = 0;
  if(st.ok){
    let h = habitual;
    if(variable){ const v = ($('var-'+ds)?.value||'').trim(); if(v) h = v; }
    const p = parseHM(h); if(p) total += +p.hours;
  }
  if(st.ab){ total = 0; }
  if(st.ex){
    const t = st.extraHours || ($('ex-'+ds)?.value||'').trim();
    const p = parseHM(t); if(p) total += +p.hours;
  }
  $('hrs-'+ds').textContent = total>0 ? total.toFixed(2)+' h' : (st.ab ? '0 h' : '—');
}

async function persistState(user, ds, key, habitual, variable){
  const st = rowState(ds);
  let tipo = null, hr = '', com = ($('cm-'+ds)?.value||'').trim();
  if(st.ok && st.ex){
    let h=habitual; if(variable){ const v=($('var-'+ds)?.value||'').trim(); if(v) h=v; }
    hr = h + ' + ' + (st.extraHours || ($('ex-'+ds)?.value||'').trim()); tipo='MIXTO';
  }else if(st.ok){
    let h=habitual; if(variable){ const v=($('var-'+ds)?.value||'').trim(); if(v) h=v; } hr=h; tipo='HABITUAL';
  }else if(st.ab){
    tipo='FALTA'; hr='';
  }else if(st.ex){
    hr = st.extraHours || ($('ex-'+ds)?.value||'').trim(); tipo='EXTRA';
  }
  const ref = db.collection('timesheets').doc(user.uid+'_'+ds);
  if(!tipo && !com){ await ref.delete().catch(()=>{}); }
  else{
    const cfg = await getConfig(user.uid);
    await ref.set({
      userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
      fecha: ds, mesAnio: key, tipoReporte: tipo||'',
      horarioReportado: hr, comentarios: com,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  }
  $('last-update').textContent = new Date().toLocaleString();
}

async function paintTable(user){
  const key = $('emp-month').value || ym(new Date());
  $('emp-month').value = key;
  const cfg = await getConfig(user.uid);
  const lock = await getLock(user.uid, key);
  $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
  $('last-update').textContent = '—';
  $('user-email').textContent = user.email;

  const role = await getRole(user);
  $('role-chip').textContent = role.toUpperCase();
  if(role==='admin'){ $('view-switch').classList.remove('hidden'); }

  const sbd = cfg?.scheduleByDay || {};
  const rows = $('rows'); rows.innerHTML = '';
  const existing = await monthReports(user.uid, key);

  const parts = key.split('-'); const y = parseInt(parts[0]), m = parseInt(parts[1]);
  const count = new Date(y, m, 0).getDate();
  for(let d=1; d<=count; d++){
    const date = new Date(y, m-1, d);
    const ds = fmt(date);
    const info = habitualForDay(sbd, date);
    const hasExisting = !!existing[ds];
    if(info.skip && !hasExisting) continue;
    const built = buildRow(ds, date, info.text, info.variable, lock.locked, existing[ds]);
    const tr = built[0], sub = built[1];
    rows.appendChild(tr); rows.appendChild(sub);
    const ok = $('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds);
    ok.addEventListener('click', async ()=>{ const st=rowState(ds); st.ok=!st.ok; if(st.ok) st.ab=false; setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); await persistState(user, ds, key, info.text, info.variable); });
    ab.addEventListener('click', async ()=>{ const st=rowState(ds); st.ab=!st.ab; if(st.ab){ st.ok=false; st.ex=false; } setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); await persistState(user, ds, key, info.text, info.variable); });
    exb.addEventListener('click', ()=>{ $('sub-'+ds).classList.toggle('hidden'); });
    applyStateToUI(ds, info.text, info.variable);
    if(existing[ds]){
      $('cm-'+ds).value = existing[ds].comentarios||'';
      if(existing[ds].timestamp) $('last-update').textContent = new Date(existing[ds].timestamp.toDate()).toLocaleString();
    }
    $('cm-'+ds).addEventListener('blur', async ()=>{ await persistState(user, ds, key, info.text, info.variable); });
  }
  $('submit-month').disabled = lock.locked;
}

window.saveMixed = async function(ds){
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value || ym(new Date());
  const st = rowState(ds); st.ex = true; st.ok = true; st.ab = false; st.extraHours = ($('ex-'+ds)?.value||'').trim(); setRowState(ds,st);
  $('sub-'+ds).classList.add('hidden');
  const cfg = await getConfig(user.uid); const date = new Date(ds);
  const info = habitualForDay((cfg?.scheduleByDay)||{}, date);
  applyStateToUI(ds, info.text, info.variable);
  await persistState(user, ds, key, info.text, info.variable);
};

$('nh-save').addEventListener('click', async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value || ym(new Date());
  const date = $('nh-date').value; const h1 = $('nh-from').value; const h2 = $('nh-to').value; const notes = $('nh-notes').value.trim();
  if(!date || h1==='' || h2===''){ setMsg($('nh-msg'), 'Fecha y horas requeridas'); return; }
  const hrs = String(h1).padStart(2,'0')+':00-'+String(h2).padStart(2,'0')+':00';
  const cfg = await getConfig(user.uid);
  await db.collection('timesheets').doc(user.uid+'_'+date).set({
    userId:user.uid, email:user.email, nombre: cfg?.nombre||'',
    fecha: date, mesAnio: key, tipoReporte: 'EXTRA', horarioReportado: hrs, comentarios: notes||'Extra en día no habitual',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  setMsg($('nh-msg'), 'Extra guardada', true);
  $('last-update').textContent = new Date().toLocaleString();
  await paintTable(user);
});

$('submit-month').addEventListener('click', async ()=>{
  const user = auth.currentUser; if(!user) return;
  const key = $('emp-month').value || ym(new Date());
  await setLock(user.uid, key, true);
  const lk = await getLock(user.uid, key);
  $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
  $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
  $('submit-month').disabled = lk.locked;
});

$('emp-month').addEventListener('change', ()=>{ const u=auth.currentUser; if(u) paintTable(u); });

// Auth & toggles
$('register-btn').addEventListener('click', async ()=>{
  try{ await auth.createUserWithEmailAndPassword($('email').value, $('password').value); setMsg($('auth-msg'), 'Cuenta creada', true);}catch(e){ setMsg($('auth-msg'), e.message); }
});
$('reset-btn').addEventListener('click', async ()=>{
  try{ await auth.sendPasswordResetEmail($('email').value); setMsg($('auth-msg'), 'Email enviado', true);}catch(e){ setMsg($('auth-msg'), e.message); }
});
$('logout-btn').onclick = ()=>auth.signOut();

$('seg-employee')?.addEventListener('click', ()=>{
  $('seg-employee').classList.add('active'); $('seg-admin').classList.remove('active');
  $('employee-view').classList.remove('hidden'); $('admin-view').classList.add('hidden');
});
$('seg-admin')?.addEventListener('click', ()=>{
  $('seg-admin').classList.add('active'); $('seg-employee').classList.remove('active');
  $('employee-view').classList.add('hidden'); $('admin-view').classList.remove('hidden');
});

auth.onAuthStateChanged(async (user)=>{
  if(!user){
    $('auth-card').classList.remove('hidden');
    $('app-card').classList.add('hidden');
    $('user-email').textContent='—'; $('role-chip').textContent='—';
    $('view-switch').classList.add('hidden');
    return;
  }
  $('auth-card').classList.add('hidden');
  $('app-card').classList.remove('hidden');
  $('user-email').textContent = user.email;
  $('emp-month').value = ym(new Date());

  const role = await getRole(user);
  $('role-chip').textContent = role.toUpperCase();
  if(role==='admin'){ $('view-switch').classList.remove('hidden'); }

  await paintTable(user);
});
