(function(){
  // Firebase
  var firebaseConfig = {
    apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
    authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
    projectId: "controlhorarioapp-6a9c7",
    storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
    messagingSenderId: "447263250565",
    appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
  };
  if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  // Utils
  function $(id){ return document.getElementById(id); }
  function fmt(d){ return d.toISOString().split('T')[0]; }
  function ym(d){ return d.toISOString().slice(0,7); }
  function wkey(d){ return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; }
  function wname(d){ return d.toLocaleDateString('es-AR',{weekday:'long'}); }
  function parseHM(s){
    if(!s) return null;
    var m = s.match(/^\s*(\d{1,2})\s*:?(\d{2})?\s*-\s*(\d{1,2})\s*:?(\d{2})?\s*$/);
    if(!m) return null;
    var h1=+m[1], m1=+(m[2]||0), h2=+m[3], m2=+(m[4]||0);
    var start=h1*60+m1, end=h2*60+m2, diff=end>=start? end-start : (24*60-start+end);
    return {hours:(diff/60).toFixed(2), start:String(h1).padStart(2,'0')+':'+String(m1).padStart(2,'0'), end:String(h2).padStart(2,'0')+':'+String(m2).padStart(2,'0')};
  }
  function setMsg(el, t, ok){ if(!el) return; el.textContent=t; el.style.color = ok?'#86efac':'#fecaca'; }

  // Data helpers
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

  // Rendering
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

    var td1=document.createElement('td'); var b=document.createElement('b'); b.textContent=wname(dateObj)+' '+ds.slice(8,10)+'/'+ds.slice(5,7); td1.appendChild(b);
    var td2=document.createElement('td');
    if(variable){ var inp=document.createElement('input'); inp.id='var-'+ds; inp.placeholder='HH:MM-HH:MM'; if(locked) inp.disabled=true; td2.appendChild(inp); }
    else{ td2.textContent = habitual || (isOffExtraOnly? '— (No habitual)':'—'); }
    var td3=document.createElement('td'); td3.id='hrs-'+ds; td3.className='muted'; td3.textContent='—';

    var td4=document.createElement('td'); td4.className='icon-row';
    var ok=document.createElement('button'); ok.id='ok-'+ds; ok.className='icon good'; ok.textContent='✓'; if(locked||isOffExtraOnly) ok.disabled=true;
    var ab=document.createElement('button'); ab.id='ab-'+ds; ab.className='icon bad'; ab.textContent='✕'; if(locked||isOffExtraOnly) ab.disabled=true;
    var ex=document.createElement('button'); ex.id='exbtn-'+ds; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
    td4.appendChild(ok); td4.appendChild(ab); td4.appendChild(ex);
    if(isOffExtraOnly){ var del=document.createElement('button'); del.className='trash'; del.textContent='🗑'; td4.appendChild(del);
      del.addEventListener('click', function(){ var u=firebase.auth().currentUser; if(!u) return; firebase.firestore().collection('timesheets').doc(u.uid+'_'+ds).delete().then(paintCurrentUser); });
    }
    var td5=document.createElement('td'); var cm=document.createElement('input'); cm.id='cm-'+ds; cm.placeholder='Comentario...'; td5.appendChild(cm);

    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4); tr.appendChild(td5);

    var sub=document.createElement('tr'); sub.id='sub-'+ds; sub.className='subrow hidden';
    sub.innerHTML='<td>Extra</td><td><input id="ex-'+ds+'" placeholder="HH:MM-HH:MM"></td><td id="hrsEx-'+ds+'" class="muted">—</td><td class="icon-row"><button class="btn small" id="saveEx-'+ds+'">Guardar</button><button class="btn small ghost" id="rmEx-'+ds+'">Quitar</button></td><td><input id="cmEx-'+ds+'" placeholder="Comentario (extra)..."></td>';
    if(locked){ var s1=sub.querySelector('#saveEx-'+ds), s2=sub.querySelector('#rmEx-'+ds); if(s1) s1.disabled=true; if(s2) s2.disabled=true; }

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
    var ok=$('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds), exInput=$('ex-'+ds), hrsEx=$('hrsEx-'+ds);
    if(ok) ok.classList.toggle('active', !!st.ok);
    if(ab) ab.classList.toggle('active', !!st.ab);
    if(exb) exb.classList.toggle('active', !!st.ex);
    if(exInput && st.extraHours) exInput.value = st.extraHours;
    if($('cmEx-'+ds) && st.cmExtra) $('cmEx-'+ds).value = st.cmExtra;
    var total=0;
    if(st.ok){ var h=habitual; if(variable){ var v=($('var-'+ds)&&$('var-'+ds).value||'').trim(); if(v) h=v; } var p=parseHM(h); if(p) total+=+p.hours; }
    if(st.ab){ total=0; }
    if(st.ex){ var t=st.extraHours || (($('ex-'+ds)&&$('ex-'+ds).value)||'').trim(); var p2=parseHM(t); if(p2){ total+=+p2.hours; if(hrsEx) hrsEx.textContent=(+p2.hours).toFixed(2)+' h'; } } else { if(hrsEx) hrsEx.textContent='—'; }
    var hm=$('hrs-'+ds); if(hm) hm.textContent = total>0 ? total.toFixed(2)+' h' : (st.ab?'0 h':'—');
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
      return ref.set({userId:user.uid,email:user.email,nombre:(cfg&&cfg.nombre)||'',fecha:ds,mesAnio:key,tipoReporte:tipo||'',horarioReportado:hr,comentarios:com,timestamp:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})
        .then(function(){ $('last-update').textContent=new Date().toLocaleString(); });
    });
  }

  function paintTable(user){
    var key=$('emp-month').value || ym(new Date()); $('emp-month').value=key;
    return Promise.all([getConfig(user.uid),getLock(user.uid,key),monthReports(user.uid,key)]).then(function(arr){
      var cfg=arr[0], lock=arr[1], existing=arr[2];
      $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
      $('last-update').textContent='—'; $('user-email').textContent=user.email;

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
          if(existing[ds]){ var cm=$('cm-'+ds); if(cm) cm.value=existing[ds].comentarios||"";
            if(existing[ds].tipoReporte==='EXTRA'){ var exI=$('ex-'+ds); if(exI) exI.value=existing[ds].horarioReportado||""; var st=rowState(ds); st.ex=true; st.extraHours=existing[ds].horarioReportado||""; setRowState(ds,st); var sub=$('sub-'+ds); if(sub) sub.classList.remove('hidden'); }
            if(existing[ds].timestamp){ try{$('last-update').textContent=new Date(existing[ds].timestamp.toDate()).toLocaleString();}catch(e){} } }
          var cmInput=$('cm-'+ds); if(cmInput) cmInput.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); });
          var saveEx=$('saveEx-'+ds), rmEx=$('rmEx-'+ds);
          if(saveEx) saveEx.addEventListener('click', function(){ var st=rowState(ds); st.ex=true; st.ab=false; st.extraHours=(($('ex-'+ds)&&$('ex-'+ds).value)||'').trim(); setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
          if(rmEx) rmEx.addEventListener('click', function(){ var st=rowState(ds); st.ex=false; st.extraHours=""; setRowState(ds,st); var sub=$('sub-'+ds); if(sub) sub.classList.add('hidden'); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
        })(ds,info);
      }
      $('submit-month').disabled = lock.locked;
    });
  }
  function paintCurrentUser(){ var u=firebase.auth().currentUser; if(u) paintTable(u); }

  // Sección de extra en día no habitual (HH-HH)
  $('nh-save').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    var key=$('emp-month').value || ym(new Date());
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
    }).then(function(){ setMsg($('nh-msg'),'Extra guardada',true); $('last-update').textContent=new Date().toLocaleString(); return paintTable(u); });
  });

  // Enviar mes
  $('submit-month').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    var key=$('emp-month').value || ym(new Date());
    setLock(u.uid,key,true).then(function(){ return getLock(u.uid,key); }).then(function(lk){
      $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
      $('submit-month').disabled = lk.locked;
    });
  });
  $('emp-month').addEventListener('change', paintCurrentUser);

  // Auth / Role / Switch
  $('register-btn').addEventListener('click', function(){
    firebase.auth().createUserWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg($('auth-msg'),'Cuenta creada',true); })
      .catch(function(e){ setMsg($('auth-msg'), e.message); });
  });
  $('reset-btn').addEventListener('click', function(){
    firebase.auth().sendPasswordResetEmail($('email').value)
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

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      $('auth-card').classList.remove('hidden'); $('app-card').classList.add('hidden');
      $('user-email').textContent='—'; $('view-switch').classList.add('hidden'); return;
    }
    $('auth-card').classList.add('hidden'); $('app-card').classList.remove('hidden');
    $('user-email').textContent=user.email; $('emp-month').value=ym(new Date());
    getRole(user.uid).then(function(role){
      $('role-chip').textContent=role.toUpperCase(); $('view-switch').classList.remove('hidden');
      if(role==='admin'){ $('employee-view').classList.add('hidden'); $('admin-view').classList.remove('hidden'); $('to-admin').classList.remove('ghost'); $('to-employee').classList.add('ghost'); }
      else{ $('employee-view').classList.remove('hidden'); $('admin-view').classList.add('hidden'); $('to-employee').classList.remove('ghost'); $('to-admin').classList.add('ghost'); }
      paintTable(user);
    });
  });

  // Exponer doLogin también aquí por si el inline no carga
  window.doLogin = function(){
    var btn=$('login-btn'), msg=$('auth-msg');
    btn.disabled=true; btn.textContent='Ingresando...';
    firebase.auth().signInWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg(msg,'Ingreso correcto',true); })
      .catch(function(e){ setMsg(msg,e.message); })
      .finally(function(){ btn.disabled=false; btn.textContent='Entrar'; });
  };
})();