(function(){
  // ===== Versión embebida (para ver rápido en el chip) =====
  try { if (document.getElementById('version-chip')) { document.getElementById('version-chip').textContent = window.__APP_VERSION || 'v-dev'; } } catch(e){}

  // ================= Firebase =================
  var firebaseConfig = {
    apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
    authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
    projectId: "controlhorarioapp-6a9c7",
    storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
    messagingSenderId: "447263250565",
    appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  // ================= Utils =================
  function $(id){ return document.getElementById(id); }
  function fmt(d){ return d.toISOString().split('T')[0]; }
  function ym(d){ return d.toISOString().slice(0,7); }
  function ymFromParts(y,m){ return y+'-'+String(m).padStart(2,'0'); }
  function wkey(d){ return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; }
  function wname(d){ return d.toLocaleDateString('es-AR',{weekday:'long'}); }
  function parseHM(s){
    if(!s) return null;
    var m = s.match(/^\s*(\d{1,2})\s*:?(\d{2})?\s*-\s*(\d{1,2})\s*:?(\d{2})?\s*$/);
    if(!m) return null;
    var h1=+m[1], m1=+(m[2]||0), h2=+m[3], m2=+(m[4]||0);
    var start=h1*60+m1, end=h2*60+m2;
    var diff = end>=start? end-start : (24*60-start+end);
    return {hours:(diff/60).toFixed(2), start:String(h1).padStart(2,'0')+':'+String(m1).padStart(2,'0'), end:String(h2).padStart(2,'0')+':'+String(m2).padStart(2,'0')};
  }
  function setMsg(el, txt, ok){ if(!el) return; el.textContent=txt; el.style.color = ok ? '#86efac' : '#fecaca'; }

  // ================= Data helpers =================
  function getRole(uid){
    return firebase.firestore().collection('roles').doc(uid).get().then(function(r){
      return (r.exists && r.data() && r.data().role==='admin') ? 'admin' : 'employee';
    }).catch(function(){ return 'employee'; });
  }
  function getConfig(uid){
    return firebase.firestore().collection('employee_config').where('userId','==',uid).limit(1).get()
      .then(function(q){ if(q.empty) return null; var d=q.docs[0]; var o=d.data(); o.id=d.id; return o; });
  }
  function getLock(uid, key){
    return firebase.firestore().collection('locks').doc(uid+'_'+key).get()
      .then(function(d){ return d.exists ? d.data() : {locked:false,lastSubmitted:null}; });
  }
  function setLock(uid, key, locked){
    return firebase.firestore().collection('locks').doc(uid+'_'+key).set(
      {locked:locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null},
      {merge:true}
    );
  }
  function monthReports(uid, key){
    return firebase.firestore().collection('timesheets')
      .where('userId','==',uid).where('mesAnio','==',key).get()
      .then(function(s){ var map={}; s.forEach(function(x){ map[x.data().fecha]=x.data(); }); return map; });
  }
  function getOneReport(uid, dateStr){
    return firebase.firestore().collection('timesheets').doc(uid+'_'+dateStr).get()
      .then(function(d){ return d.exists ? d.data() : null; });
  }

  // ================= Mes (selects) =================
  function buildMonthSelectors(){
    var now=new Date(), y=now.getFullYear();
    var selM=$('sel-month'), selY=$('sel-year');
    var months=['01','02','03','04','05','06','07','08','09','10','11','12'];
    var names=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    selM.innerHTML=''; selY.innerHTML='';
    for(var i=0;i<12;i++){ var opt=document.createElement('option'); opt.value=months[i]; opt.textContent=names[i].charAt(0).toUpperCase()+names[i].slice(1); selM.appendChild(opt); }
    for(var k=y-2;k<=y+2;k++){ var oy=document.createElement('option'); oy.value=String(k); oy.textContent=String(k); selY.appendChild(oy); }
    var ymNow = ym(now).split('-'); selM.value=ymNow[1]; selY.value=ymNow[0];
  }
  function currentYM(){ return ymFromParts($('sel-year').value, $('sel-month').value); }

  // ================= Filas/estado =================
  function habitualForDay(sbd, d){
    var o = (sbd && sbd[wkey(d)]) || {};
    if(o.off) return {text:null, variable:false, skip:true};
    if(o.variable) return {text:"", variable:true, skip:false};
    if(!o.start || !o.end) return {text:"", variable:false, skip:false};
    return {text:o.start+"-"+o.end, variable:false, skip:false};
  }
  function rowState(ds){ var r=$('row-'+ds); return r? JSON.parse(r.getAttribute('data-state')||'{}') : {}; }
  function setRowState(ds, st){ var r=$('row-'+ds); if(r) r.setAttribute('data-state', JSON.stringify(st)); }

  
  function buildRow(ds, dateObj, habitual, variable, locked, existing, isOffExtraOnly){
    var tr=document.createElement('tr'); tr.id='row-'+ds;

    // Columna 1: Día
    var td1=document.createElement('td'); 
    var b=document.createElement('b'); b.textContent=wname(dateObj)+' '+ds.slice(8,10)+'/'+ds.slice(5,7); 
    td1.appendChild(b);

    // Columna 2: Horario habitual (texto o input si variable)
    var td2=document.createElement('td');
    if(variable){ 
      var inp=document.createElement('input'); 
      inp.id='var-'+ds; 
      inp.placeholder='HH:MM-HH:MM'; 
      if(locked) inp.disabled=true; 
      td2.appendChild(inp); 
    } else { 
      td2.textContent = habitual || (isOffExtraOnly? '— (No habitual)':'—'); 
    }

    // Columna 3: HS TRABAJADAS (solo chips, nunca inputs)
    var td3=document.createElement('td'); 
    td3.id='hrs-'+ds; 
    td3.className='stack muted'; 
    td3.innerHTML='<span class="tag">—</span>';

    // Columna 4: ACCIONES (✓ ✕ ＋ siempre acá)
    var td4=document.createElement('td'); 
    td4.className='icon-row';
    var ok=document.createElement('button'); ok.id='ok-'+ds; ok.className='icon good'; ok.textContent='✓'; if(locked||isOffExtraOnly) ok.disabled=true;
    var ab=document.createElement('button'); ab.id='ab-'+ds; ab.className='icon bad'; ab.textContent='✕'; if(locked||isOffExtraOnly) ab.disabled=true;
    var ex=document.createElement('button'); ex.id='exbtn-'+ds; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
    td4.appendChild(ok); td4.appendChild(ab); td4.appendChild(ex);

    if(isOffExtraOnly){
      var del=document.createElement('button'); del.className='trash'; del.title='Borrar este extra'; del.textContent='🗑';
      td4.appendChild(del);
      del.addEventListener('click', function(){
        var u=firebase.auth().currentUser; if(!u) return;
        firebase.firestore().collection('timesheets').doc(u.uid+'_'+ds).delete().then(function(){ paintCurrentUser(); });
      });
    }

    // Columna 5: Comentario
    var td5=document.createElement('td'); 
    var cm=document.createElement('input'); cm.id='cm-'+ds; cm.placeholder='Comentario...'; 
    td5.appendChild(cm);

    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);

    // Subfila "Extra" (5 columnas) sin botón Guardar (auto-guardado)
    var sub=document.createElement('tr'); sub.id='sub-'+ds; sub.className='subrow hidden';
    sub.innerHTML= ''
      + '<td>Extra</td>'
      + '<td><input id="ex-'+ds+'" placeholder="HH:MM-HH:MM"></td>'
      + '<td id="hrsEx-'+ds+'" class="muted">—</td>'
      + '<td class="icon-row"><button class="btn small ghost" id="rmEx-'+ds+'">Quitar</button></td>'
      + '<td><input id="cmEx-'+ds+'" placeholder="Comentario (extra)..."></td>';

    if(locked){ 
      var rm = sub.querySelector('#rmEx-'+ds); 
      if(rm) rm.disabled=true; 
      var exInp = sub.querySelector('#ex-'+ds); if(exInp) exInp.disabled=true;
      var cmEx = sub.querySelector('#cmEx-'+ds); if(cmEx) cmEx.disabled=true;
    }

    var st={ok:false,ab:false,ex:false,extraHours:"",comment:(existing&&existing.comentarios)||"",cmExtra:""};
    if(existing){
      if(existing.tipoReporte==='HABITUAL') st.ok=true;
      if(existing.tipoReporte==='FALTA') st.ab=true;
      if(existing.tipoReporte==='EXTRA'){ st.ex=true; st.extraHours=existing.horarioReportado||""; st.cmExtra=existing.comentarios||""; }
      if(existing.tipoReporte==='MIXTO'){ st.ok=true; st.ex=true; var parts=(existing.horarioReportado||"").split('+'); st.extraHours=(parts[1]||"").trim(); }
    }
    setRowState(ds, st);
    return [tr, sub];
  }


  function applyStateToUI(ds, habitual, variable){
    var st=rowState(ds);
    var ok=$('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds), exInput=$('ex-'+ds);
    var hrsEx = document.getElementById('hrsEx-'+ds) || null;

    if(ok) ok.classList.toggle('active', !!st.ok);
    if(ab) ab.classList.toggle('active', !!st.ab);
    if(exb) exb.classList.toggle('active', !!st.ex);
    if(exInput && st.extraHours) exInput.value = st.extraHours;
    if($('cmEx-'+ds) && st.cmExtra) $('cmEx-'+ds).value = st.cmExtra;

    // HS TRABAJADAS: SOLO horas (líneas separadas si hay habitual y extra)
    var hrsMain=$('hrs-'+ds); if(!hrsMain) return;
    hrsMain.innerHTML='';
    if(st.ab){
      var chip0=document.createElement('span'); chip0.className='tag'; chip0.textContent='0 h'; hrsMain.appendChild(chip0);
      if(hrsEx) hrsEx.textContent='—';
      return;
    }
    var pusoAlgo=false;
    if(st.ok){
      var h=habitual;
      if(variable){ var v=($('var-'+ds)&&$('var-'+ds).value||'').trim(); if(v) h=v; }
      var p=parseHM(h);
      var chip=document.createElement('span'); chip.className='tag'; chip.textContent = p? (p.hours+' h'):'—';
      hrsMain.appendChild(chip);
      pusoAlgo=true;
    }
    if(st.ex){
      var t=st.extraHours || (($('ex-'+ds)&&$('ex-'+ds).value)||'').trim();
      var p2=parseHM(t);
      var chip2=document.createElement('span'); chip2.className='tag'; chip2.textContent = p2? (p2.hours+' h'):'—';
      hrsMain.appendChild(chip2);
      if(hrsEx) hrsEx.textContent = p2? (p2.hours+' h') : '—';
      pusoAlgo=true;
    }else{
      if(hrsEx) hrsEx.textContent='—';
    }
    if(!pusoAlgo){
      var dash=document.createElement('span'); dash.className='tag'; dash.textContent='—'; hrsMain.appendChild(dash);
    }
  }

  function persistState(user, ds, key, habitual, variable){
    var st=rowState(ds);
    var tipo=null, hr="", com=(($('cm-'+ds)&&$('cm-'+ds).value)||"").trim();
    var cmEx=(($('cmEx-'+ds)&&$('cmEx-'+ds).value)||"").trim();
    if(st.ok && st.ex){ var h=habitual; if(variable){ var v=($('var-'+ds)&&$('var-'+ds).value||'').trim(); if(v) h=v; } hr=h+" + "+(st.extraHours || (($('ex-'+ds)&&$('ex-'+ds).value)||"").trim()); tipo='MIXTO'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    else if(st.ok){ var h2=habitual; if(variable){ var v2=($('var-'+ds)&&$('var-'+ds).value||'').trim(); if(v2) h2=v2; } hr=h2; tipo='HABITUAL'; }
    else if(st.ab){ tipo='FALTA'; hr=""; }
    else if(st.ex){ hr=st.extraHours || (($('ex-'+ds)&&$('ex-'+ds).value)||"").trim(); tipo='EXTRA'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    var ref=firebase.firestore().collection('timesheets').doc(user.uid+'_'+ds);
    if(!tipo && !com){ return ref.delete().catch(function(){}).then(function(){ $('last-update').textContent=new Date().toLocaleString(); }); }
    return getConfig(user.uid).then(function(cfg){
      return ref.set({userId:user.uid,email:user.email,nombre:(cfg&&cfg.nombre)||'',fecha:ds,mesAnio:key,tipoReporte:tipo||'',horarioReportado:hr,comentarios:com,timestamp: firebase.firestore.FieldValue.serverTimestamp()},{merge:true})
        .then(function(){ $('last-update').textContent=new Date().toLocaleString(); });
    });
  }

  function paintTable(user){
    var key=currentYM();
    return Promise.all([ getConfig(user.uid), getLock(user.uid, key), monthReports(user.uid, key) ]).then(function(arr){
      var cfg=arr[0], lock=arr[1], existing=arr[2];
      $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = '—';
      $('user-email').textContent = user.email;

      var sbd=(cfg&&cfg.scheduleByDay)||{}; var rows=$('rows'); rows.innerHTML='';
      var parts=key.split('-'); var y=parseInt(parts[0],10), m=parseInt(parts[1],10); var count=new Date(y,m,0).getDate();
      for(var d=1; d<=count; d++){
        var date=new Date(y,m-1,d); var ds=fmt(date);
        var info=habitualForDay(sbd,date); var hasExisting=!!existing[ds];
        var isOffExtraOnly = info.skip && hasExisting && existing[ds].tipoReporte==='EXTRA';
        if(info.skip && !hasExisting) continue;
        var built=buildRow(ds,date,info.text,info.variable,lock.locked,existing[ds],isOffExtraOnly);
        var tr=built[0], sub=built[1]; rows.appendChild(tr); rows.appendChild(sub);
        (function(ds,info){
          var ok=$('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds);
          if(ok) ok.addEventListener('click', function(){ var st=rowState(ds); st.ok=!st.ok; if(st.ok) st.ab=false; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
          if(ab) ab.addEventListener('click', function(){ var st=rowState(ds); st.ab=!st.ab; if(st.ab){ st.ok=false; st.ex=false; } setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
          if(exb) exb.addEventListener('click', function(){ var row=$('sub-'+ds); if(row) row.classList.toggle('hidden'); var st=rowState(ds); st.ex=!row.classList.contains('hidden'); setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); });
          applyStateToUI(ds,info.text,info.variable);
          if(existing[ds]){
            var cm=$('cm-'+ds); if(cm) cm.value=existing[ds].comentarios||"";
            if(existing[ds].tipoReporte==='EXTRA'){ var exI=$('ex-'+ds); if(exI) exI.value=existing[ds].horarioReportado||""; var st=rowState(ds); st.ex=true; st.extraHours=existing[ds].horarioReportado||""; setRowState(ds,st); var sub=$('sub-'+ds); if(sub) sub.classList.remove('hidden'); }
            if(existing[ds].tipoReporte==='MIXTO'){ var parts=(existing[ds].horarioReportado||"").split('+'); var exP=(parts[1]||"").trim(); var exI2=$('ex-'+ds); if(exI2) exI2.value=exP; var st2=rowState(ds); st2.ok=true; st2.ex=true; st2.extraHours=exP; setRowState(ds,st2); var sub2=$('sub-'+ds); if(sub2) sub2.classList.remove('hidden'); }
            if(existing[ds].timestamp){ try{$('last-update').textContent=new Date(existing[ds].timestamp.toDate()).toLocaleString();}catch(e){} }
          }
          var cmInput=$('cm-'+ds); if(cmInput) cmInput.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); });
          var rmEx=$('rmEx-'+ds);
          // Auto-guardar extras al completar horas o comentario
          var exInput=$('ex-'+ds), cmx=$('cmEx-'+ds);
          function autosaveExtra(){ var st=rowState(ds); var val=(exInput&&exInput.value||'').trim(); if(val){ st.ex=true; st.ok=true; st.ab=false; st.extraHours=val; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); } }
          if(exInput){ exInput.addEventListener('blur', autosaveExtra); exInput.addEventListener('change', autosaveExtra); }
          if(cmx){ cmx.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); }); }
          if(rmEx) rmEx.addEventListener('click', function(){ var st=rowState(ds); st.ex=false; st.extraHours=""; setRowState(ds,st); var sub=$('sub-'+ds); if(sub) sub.classList.add('hidden'); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
        })(ds,info);
      }
      $('submit-month').disabled = lock.locked;
    });
  }

  function addOrUpdateSingleRow(user, dateStr){
    var key=currentYM();
    return Promise.all([ getConfig(user.uid), getOneReport(user.uid, dateStr), getLock(user.uid, key) ]).then(function(arr){
      var cfg=arr[0], report=arr[1], lock=arr[2];
      var date=new Date(dateStr);
      var info=habitualForDay((cfg&&cfg.scheduleByDay)||{}, date);
      var existingTr=$('row-'+dateStr); if(existingTr){ if(existingTr.nextSibling && existingTr.nextSibling.id==='sub-'+dateStr) existingTr.nextSibling.remove(); existingTr.remove(); }
      var built=buildRow(dateStr, date, info.text, info.variable, lock.locked, report, info.skip && report && report.tipoReporte==='EXTRA');
      var rows=$('rows'); var days=rows.querySelectorAll('tr[id^="row-"]');
      var inserted=false;
      for(var i=0;i<days.length;i++){ var ds=days[i].id.replace('row-',''); if(ds>dateStr){ rows.insertBefore(built[0], days[i]); rows.insertBefore(built[1], days[i]); inserted=true; break; } }
      if(!inserted){ rows.appendChild(built[0]); rows.appendChild(built[1]); }
      applyStateToUI(dateStr, info.text, info.variable);
    });
  }

  function paintCurrentUser(){ var u=firebase.auth().currentUser; if(u) paintTable(u); }

  // ===== No habitual: insertar/actualizar sin recargar todo =====
  document.addEventListener('click', function(e){
    if(e.target && e.target.id==='nh-save'){ /* placeholder */ }
  });

  $('nh-save').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    var key=currentYM();
    var date=$('nh-date').value, range=($('nh-range').value||'').trim(), notes=$('nh-notes').value.trim();
    var p=parseHM(range);
    if(!date || !p){ return setMsg($('nh-msg'),'Completá fecha y horario (HH-HH)'); }
    var hrs=p.start+'-'+p.end;
    getConfig(u.uid).then(function(cfg){
      return firebase.firestore().collection('timesheets').doc(u.uid+'_'+date).set({
        userId:u.uid,email:u.email,nombre:(cfg&&cfg.nombre)||'',
        fecha:date,mesAnio:key,tipoReporte:'EXTRA',horarioReportado:hrs,comentarios:notes||'Extra en día no habitual',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
    }).then(function(){ setMsg($('nh-msg'),'Extra guardada',true); $('last-update').textContent=new Date().toLocaleString(); return addOrUpdateSingleRow(u, date); });
  });

  // ===== Enviar planilla (lock) =====
  $('submit-month').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    var key=currentYM();
    setLock(u.uid,key,true).then(function(){ return getLock(u.uid,key); }).then(function(lk){
      $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
      $('submit-month').disabled = lk.locked;
    });
  });

  // ===== Auth / Role / Switch =====
  $('register-btn').addEventListener('click', function(){
    firebase.auth().createUserWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg($('auth-msg'),'Cuenta creada',true); })
      .catch(function(e){ setMsg($('auth-msg'), e.message); });
  });
  $('reset-btn').addEventListener('click', function(){
    var em = ($('email') && $('email').value) || '';
    if(!em){ return setMsg($('auth-msg'),'Ingresá tu email'); }
    firebase.auth().sendPasswordResetEmail(em)
      .then(function(){ setMsg($('auth-msg'),'Email enviado',true); })
      .catch(function(e){ setMsg($('auth-msg'), e.message); });
  });
  $('logout-btn').addEventListener('click', function(){ firebase.auth().signOut(); });

  $('to-employee').addEventListener('click', function(){
    $('employee-view').classList.remove('hidden'); $('admin-view').classList.add('hidden');
    $('to-employee').classList.remove('ghost'); $('to-admin').classList.add('ghost');
  });
  $('to-admin').addEventListener('click', function(){
    $('employee-view').classList.add('hidden'); $('admin-view').classList.remove('hidden');
    $('to-admin').classList.remove('ghost'); $('to-employee').classList.add('ghost');
  });

  function onMonthChange(){ paintCurrentUser(); }
  $('sel-month').addEventListener('change', onMonthChange);
  $('sel-year').addEventListener('change', onMonthChange);

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      $('auth-card').classList.remove('hidden'); $('app-card').classList.add('hidden');
      $('user-email').textContent='—'; $('view-switch').classList.add('hidden'); return;
    }
    $('auth-card').classList.add('hidden'); $('app-card').classList.remove('hidden');
    $('user-email').textContent=user.email;

    buildMonthSelectors();

    getRole(user.uid).then(function(role){
      $('role-chip').textContent=role.toUpperCase();
      if(role==='admin'){
        $('view-switch').classList.remove('hidden');
        $('employee-view').classList.add('hidden'); $('admin-view').classList.remove('hidden');
        $('to-admin').classList.remove('ghost'); $('to-employee').classList.add('ghost');
      }else{
        $('view-switch').classList.add('hidden'); // empleado NO ve admin
        $('employee-view').classList.remove('hidden'); $('admin-view').classList.add('hidden');
      }
      paintTable(user);
    });
  });

  // ===== Login robusto =====
  window.doLogin = function() {
    const btn = document.getElementById('login-btn');
    const msg = document.getElementById('auth-msg');
    const email = (document.getElementById('email')?.value || '').trim();
    const pass  = (document.getElementById('password')?.value || '');

    if (btn.dataset.loading === '1') return;

    btn.dataset.loading = '1';
    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    (async () => {
      try {
        if (!firebase?.auth) throw new Error('Firebase no está listo');
        if (firebase.auth().setPersistence) {
          await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        }
        await firebase.auth().signInWithEmailAndPassword(email, pass);
        msg.textContent = 'Ingreso correcto';
        msg.style.color = '#86efac';
      } catch (e) {
        console.error(e);
        msg.textContent = e?.message || 'No se pudo ingresar';
        msg.style.color = '#fecaca';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
        btn.dataset.loading = '0';
      }
    })();
  };
})();