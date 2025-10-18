// Build: empleado completo + versioned load (no template strings)
// Firebase init
(function(){
  var firebaseConfig = {
    apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
    authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
    projectId: "controlhorarioapp-6a9c7",
    storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
    messagingSenderId: "447263250565",
    appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
  };
  if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

  function $(id){ return document.getElementById(id); }
  function fmt(d){ return d.toISOString().split('T')[0]; }
  function ym(d){ return d.toISOString().slice(0,7); }
  function wkey(d){ return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; }
  function wname(d){ return d.toLocaleDateString('es-AR',{weekday:'long'}); }
  function parseHM(s){
    if(!s) return null;
    var m = s.match(/(\d{1,2}):?(\d{2})?\s*(?:-|a|A)\s*(\d{1,2}):?(\d{2})?/);
    if(!m) return null;
    var h1=+m[1], m1=+(m[2]||0), h2=+m[3], m2=+(m[4]||0);
    var start=h1*60+m1, end=h2*60+m2;
    var diff = end>=start? end-start : (24*60-start+end);
    return {hours:(diff/60).toFixed(2)};
  }
  function setMsg(el, txt, ok){ if(!el) return; el.textContent = txt; el.style.color = ok ? '#86efac' : '#fecaca'; }

  function getRole(user){
    return firebase.firestore().collection('roles').doc(user.uid).get().then(function(r){
      if(r.exists && r.data() && r.data().role==='admin') return 'admin'; return 'employee';
    }).catch(function(){ return 'employee'; });
  }
  function getConfig(uid){
    return firebase.firestore().collection('employee_config').where('userId','==',uid).limit(1).get()
      .then(function(q){ if(q.empty) return null; var d=q.docs[0]; var obj=d.data(); obj.id=d.id; return obj; });
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
      .then(function(snap){ var map={}; snap.forEach(function(x){ map[x.data().fecha]=x.data(); }); return map; });
  }

  function habitualForDay(sbd, d){
    var obj = (sbd && sbd[wkey(d)]) || {};
    if(obj.off) return {text:null, variable:false, skip:true};
    if(obj.variable) return {text:"", variable:true, skip:false};
    if(!obj.start || !obj.end) return {text:"", variable:false, skip:false};
    return {text:obj.start+"-"+obj.end, variable:false, skip:false};
  }

  function rowState(ds){
    var r = document.getElementById('row-'+ds); return r ? JSON.parse(r.getAttribute('data-state')||'{}') : {};
  }
  function setRowState(ds, st){
    var r = document.getElementById('row-'+ds); if(r) r.setAttribute('data-state', JSON.stringify(st));
  }

  function buildRow(dateStr, dateObj, habitual, variable, locked, existing){
    var tr = document.createElement('tr'); tr.id='row-'+dateStr;

    var tdDay = document.createElement('td');
    var b = document.createElement('b');
    b.textContent = wname(dateObj)+' '+dateStr.slice(8,10)+'/'+dateStr.slice(5,7);
    tdDay.appendChild(b);

    var tdHab = document.createElement('td');
    if(variable){
      var inp = document.createElement('input'); inp.id='var-'+dateStr; inp.placeholder='HH:MM-HH:MM'; if(locked) inp.disabled=true; tdHab.appendChild(inp);
    }else{
      tdHab.textContent = habitual || '—';
    }

    var tdHrs = document.createElement('td'); tdHrs.id='hrs-'+dateStr; tdHrs.className='muted'; tdHrs.textContent='—';

    var tdAct = document.createElement('td'); tdAct.className='icon-row';
    var ok = document.createElement('button'); ok.id='ok-'+dateStr; ok.className='icon good'; ok.textContent='✓'; if(locked) ok.disabled=true;
    var ab = document.createElement('button'); ab.id='ab-'+dateStr; ab.className='icon bad'; ab.textContent='✕'; if(locked) ab.disabled=true;
    var ex = document.createElement('button'); ex.id='exbtn-'+dateStr; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
    tdAct.appendChild(ok); tdAct.appendChild(ab); tdAct.appendChild(ex);

    var tdCm = document.createElement('td'); var cm = document.createElement('input'); cm.id='cm-'+dateStr; cm.placeholder='Comentario...'; tdCm.appendChild(cm);

    tr.appendChild(tdDay); tr.appendChild(tdHab); tr.appendChild(tdHrs); tr.appendChild(tdAct); tr.appendChild(tdCm);

    var sub = document.createElement('tr'); sub.id='sub-'+dateStr; sub.className='subrow hidden';
    var s1=document.createElement('td'); var s2=document.createElement('td'); s2.colSpan=3;
    var rowDiv=document.createElement('div'); rowDiv.className='row';
    var lbl=document.createElement('label'); lbl.textContent='Extra';
    var exIn=document.createElement('input'); exIn.id='ex-'+dateStr; exIn.placeholder='HH:MM-HH:MM';
    rowDiv.appendChild(lbl); rowDiv.appendChild(exIn); s2.appendChild(rowDiv);
    var s3=document.createElement('td'); var save=document.createElement('button'); save.className='btn small'; save.textContent='Guardar'; if(locked) save.disabled=true;
    save.addEventListener('click', function(){ window.saveMixed(dateStr); }); s3.appendChild(save);
    sub.appendChild(s1); sub.appendChild(s2); sub.appendChild(s3);

    var st = { ok:false, ab:false, ex:false, extraHours:"", comment: (existing && existing.comentarios) || "" };
    if(existing){
      if(existing.tipoReporte==='HABITUAL') st.ok = true;
      if(existing.tipoReporte==='FALTA') st.ab = true;
      if(existing.tipoReporte==='EXTRA'){ st.ex = true; st.extraHours = existing.horarioReportado || ""; }
      if(existing.tipoReporte==='MIXTO'){ st.ok=true; st.ex=true; var parts=(existing.horarioReportado||"").split('+'); st.extraHours=(parts[1]||"").trim(); }
    }
    setRowState(dateStr, st);

    return [tr, sub];
  }

  function applyStateToUI(ds, habitual, variable){
    var st = rowState(ds);
    var ok = $('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds), exInput=$('ex-'+ds);
    if(ok) ok.classList.toggle('active', !!st.ok);
    if(ab) ab.classList.toggle('active', !!st.ab);
    if(exb) exb.classList.toggle('active', !!st.ex);
    if(exInput && st.extraHours) exInput.value = st.extraHours;

    var total = 0;
    if(st.ok){
      var h = habitual;
      if(variable){ var v = ($('var-'+ds) && $('var-'+ds).value || '').trim(); if(v) h = v; }
      var p = parseHM(h); if(p) total += +p.hours;
    }
    if(st.ab){ total = 0; }
    if(st.ex){
      var t = st.extraHours || ( $('ex-'+ds) && $('ex-'+ds).value || '' ).trim();
      var p2 = parseHM(t); if(p2) total += +p2.hours;
    }
    $('hrs-'+ds).textContent = total>0 ? total.toFixed(2)+' h' : (st.ab ? '0 h' : '—');
  }

  function persistState(user, ds, key, habitual, variable){
    var st = rowState(ds);
    var tipo = null, hr = "", com = (($('cm-'+ds) && $('cm-'+ds).value) || "").trim();
    if(st.ok && st.ex){
      var h=habitual; if(variable){ var v=($('var-'+ds) && $('var-'+ds).value || '').trim(); if(v) h=v; }
      hr = h + " + " + (st.extraHours || ( $('ex-'+ds) && $('ex-'+ds).value || "" ).trim()); tipo='MIXTO';
    }else if(st.ok){
      var h2=habitual; if(variable){ var v2=($('var-'+ds) && $('var-'+ds).value || '').trim(); if(v2) h2=v2; } hr=h2; tipo='HABITUAL';
    }else if(st.ab){
      tipo='FALTA'; hr="";
    }else if(st.ex){
      hr = st.extraHours || ( $('ex-'+ds) && $('ex-'+ds).value || "" ).trim(); tipo='EXTRA';
    }
    var ref = firebase.firestore().collection('timesheets').doc(user.uid+'_'+ds);
    if(!tipo && !com){ return ref.delete().catch(function(){}).then(function(){ $('last-update').textContent = new Date().toLocaleString(); }); }
    return getConfig(user.uid).then(function(cfg){
      return ref.set({
        userId:user.uid, email:user.email, nombre: (cfg && cfg.nombre) || '',
        fecha: ds, mesAnio: key, tipoReporte: tipo || '',
        horarioReportado: hr, comentarios: com,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true}).then(function(){ $('last-update').textContent = new Date().toLocaleString(); });
    });
  }

  function paintTable(user){
    var key = $('emp-month').value || ym(new Date());
    $('emp-month').value = key;
    return Promise.all([ getConfig(user.uid), getLock(user.uid, key), monthReports(user.uid, key) ]).then(function(arr){
      var cfg = arr[0], lock = arr[1], existing = arr[2];
      $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = '—';
      $('user-email').textContent = user.email;

      var sbd = (cfg && cfg.scheduleByDay) || {};
      var rows = $('rows'); rows.innerHTML = '';

      var parts = key.split('-'); var y = parseInt(parts[0],10), m = parseInt(parts[1],10);
      var count = new Date(y, m, 0).getDate();
      for(var d=1; d<=count; d++){
        var date = new Date(y, m-1, d);
        var ds = fmt(date);
        var info = habitualForDay(sbd, date);
        var hasExisting = !!existing[ds];
        if(info.skip && !hasExisting) continue;
        var built = buildRow(ds, date, info.text, info.variable, lock.locked, existing[ds]);
        var tr = built[0], sub = built[1];
        rows.appendChild(tr); rows.appendChild(sub);
        (function(ds, info){
          var ok=$('ok-'+ds), ab=$('ab-'+ds), exb=$('exbtn-'+ds);
          if(ok) ok.addEventListener('click', function(){ var st=rowState(ds); st.ok=!st.ok; if(st.ok) st.ab=false; setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); persistState(user, ds, key, info.text, info.variable); });
          if(ab) ab.addEventListener('click', function(){ var st=rowState(ds); st.ab=!st.ab; if(st.ab){ st.ok=false; st.ex=false; } setRowState(ds,st); applyStateToUI(ds, info.text, info.variable); persistState(user, ds, key, info.text, info.variable); });
          if(exb) exb.addEventListener('click', function(){ var row = $('sub-'+ds); if(row) row.classList.toggle('hidden'); });
          applyStateToUI(ds, info.text, info.variable);
          if(existing[ds]){
            var cm = $('cm-'+ds); if(cm) cm.value = existing[ds].comentarios || "";
            if(existing[ds].timestamp){ try { $('last-update').textContent = new Date(existing[ds].timestamp.toDate()).toLocaleString(); } catch(e){} }
          }
          var cmInput = $('cm-'+ds);
          if(cmInput) cmInput.addEventListener('blur', function(){ persistState(user, ds, key, info.text, info.variable); });
        })(ds, info);
      }
      $('submit-month').disabled = lock.locked;
    });
  }

  window.saveMixed = function(ds){
    var user = firebase.auth().currentUser; if(!user) return;
    var key = $('emp-month').value || ym(new Date());
    var st = rowState(ds); st.ex = true; st.ok = true; st.ab = false; st.extraHours = ($('ex-'+ds) && $('ex-'+ds).value || '').trim(); setRowState(ds,st);
    var sub = $('sub-'+ds); if(sub) sub.classList.add('hidden');
    getConfig(user.uid).then(function(cfg){
      var date = new Date(ds);
      var info = habitualForDay( (cfg && cfg.scheduleByDay) || {}, date);
      applyStateToUI(ds, info.text, info.variable);
      return persistState(user, ds, key, info.text, info.variable);
    });
  };

  // Extra no habitual
  $('nh-save').addEventListener('click', function(){
    var user = firebase.auth().currentUser; if(!user) return;
    var key = $('emp-month').value || ym(new Date());
    var date = $('nh-date').value, h1 = $('nh-from').value, h2 = $('nh-to').value, notes = $('nh-notes').value.trim();
    if(!date || h1==='' || h2===''){ return setMsg($('nh-msg'), 'Fecha y horas requeridas'); }
    var hrs = ((''+h1).length===1?'0'+h1:h1)+':00-'+(((''+h2).length===1?'0'+h2:h2))+':00';
    getConfig(user.uid).then(function(cfg){
      return firebase.firestore().collection('timesheets').doc(user.uid+'_'+date).set({
        userId:user.uid, email:user.email, nombre:(cfg && cfg.nombre) || '',
        fecha: date, mesAnio: key, tipoReporte: 'EXTRA', horarioReportado: hrs, comentarios: notes || 'Extra en día no habitual',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, {merge:true});
    }).then(function(){
      setMsg($('nh-msg'), 'Extra guardada', true);
      $('last-update').textContent = new Date().toLocaleString();
      return paintTable(user);
    });
  });

  $('submit-month').addEventListener('click', function(){
    var user = firebase.auth().currentUser; if(!user) return;
    var key = $('emp-month').value || ym(new Date());
    setLock(user.uid, key, true).then(function(){ return getLock(user.uid, key); }).then(function(lk){
      $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
      $('submit-month').disabled = lk.locked;
    });
  });

  $('emp-month').addEventListener('change', function(){ var u=firebase.auth().currentUser; if(u) paintTable(u); });

  // Auth and view
  $('register-btn').addEventListener('click', function(){
    firebase.auth().createUserWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg($('auth-msg'), 'Cuenta creada', true); })
      .catch(function(e){ setMsg($('auth-msg'), e.message); });
  });
  $('reset-btn').addEventListener('click', function(){
    firebase.auth().sendPasswordResetEmail($('email').value)
      .then(function(){ setMsg($('auth-msg'), 'Email enviado', true); })
      .catch(function(e){ setMsg($('auth-msg'), e.message); });
  });
  $('logout-btn').addEventListener('click', function(){ firebase.auth().signOut(); });

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      $('auth-card').classList.remove('hidden');
      $('app-card').classList.add('hidden');
      $('user-email').textContent='—';
      return;
    }
    $('auth-card').classList.add('hidden');
    $('app-card').classList.remove('hidden');
    $('user-email').textContent = user.email;
    $('emp-month').value = ym(new Date());
    paintTable(user);
  });

  // Expose doLogin in case inline fallback didn't load
  window.doLogin = function(){
    var btn=$('login-btn'); var msg=$('auth-msg');
    btn.disabled=true; btn.textContent='Ingresando...';
    firebase.auth().signInWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg(msg,'Ingreso correcto',true); })
      .catch(function(e){ setMsg(msg, e.message); })
      .finally(function(){ btn.disabled=false; btn.textContent='Entrar'; });
  };
})();