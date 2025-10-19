(function(){
  var firebaseConfig = {
    apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
    authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
    projectId: "controlhorarioapp-6a9c7",
    storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
    messagingSenderId: "447263250565",
    appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  function $(id){ return document.getElementById(id); }
  function fmt(d){ return d.toISOString().split('T')[0]; }
  function ym(d){ return d.toISOString().slice(0,7); }
  function ymFrom(y,m){ return y+'-'+String(m).padStart(2,'0'); }
  function wkey(d){ return ['sun','mon','tue','wed','thu','fri','sat'][d.getDay()]; }
  function wname(d){ return d.toLocaleDateString('es-AR',{weekday:'long'}); }
  function parseHM(s){
    if(!s) return null;
    var m = s.match(/^\s*(\d{1,2})\s*:?(\d{2})?\s*-\s*(\d{1,2})\s*:?(\d{2})?\s*$/);
    if(!m) return null;
    var h1=+m[1], m1=+(m[2]||0), h2=+m[3], m2=+(m[4]||0);
    var start=h1*60+m1, end=h2*60+m2, diff=end>=start? end-start : (24*60-start+end);
    return {hours:(diff/60).toFixed(2), start:(h1+'').padStart(2,'0')+':'+(m1+'').padStart(2,'0'), end:(h2+'').padStart(2,'0')+':'+(m2+'').padStart(2,'0')};
  }
  function chipHours(h){ var s=document.createElement('span'); s.className='tag'; s.textContent=h; return s; }

  function getConfig(uid){
    return firebase.firestore().collection('employee_config').where('userId','==',uid).limit(1).get()
      .then(q => q.empty ? null : Object.assign({id:q.docs[0].id}, q.docs[0].data()));
  }
  function getLock(uid, key){
    return firebase.firestore().collection('locks').doc(uid+'_'+key).get()
      .then(d => d.exists ? d.data() : {locked:false,lastSubmitted:null});
  }
  function setLock(uid,key,locked){
    return firebase.firestore().collection('locks').doc(uid+'_'+key)
      .set({locked, lastSubmitted: locked? firebase.firestore.FieldValue.serverTimestamp(): null},{merge:true});
  }
  function monthReports(uid,key){
    return firebase.firestore().collection('timesheets')
      .where('userId','==',uid).where('mesAnio','==',key).get()
      .then(s=>{const m={}; s.forEach(x=>m[x.data().fecha]=x.data()); return m;});
  }
  function getOne(uid,ds){ return firebase.firestore().collection('timesheets').doc(uid+'_'+ds).get().then(d=>d.exists?d.data():null); }

  function buildMonthSelectors(){
    var now=new Date(), y=now.getFullYear();
    var mSel=$('sel-month'), ySel=$('sel-year');
    var mNames=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    mSel.innerHTML=''; ySel.innerHTML='';
    for (var i=0;i<12;i++){ var o=document.createElement('option'); o.value=String(i+1).padStart(2,'0'); o.textContent=mNames[i][0].toUpperCase()+mNames[i].slice(1); mSel.appendChild(o); }
    for (var k=y-2;k<=y+2;k++){ var oy=document.createElement('option'); oy.value=String(k); oy.textContent=String(k); ySel.appendChild(oy); }
    var ymNow=ym(now).split('-'); mSel.value=ymNow[1]; ySel.value=ymNow[0];
  }
  function currentYM(){ return ymFrom($('sel-year').value, $('sel-month').value); }

  function habitualForDay(sbd, d){
    var o=(sbd&&sbd[wkey(d)])||{};
    if(o.off) return {text:null, variable:false, skip:true};
    if(o.variable) return {text:"", variable:true, skip:false};
    if(!o.start || !o.end) return {text:"", variable:false, skip:false};
    return {text:o.start+"-"+o.end, variable:false, skip:false};
  }

  function rowState(ds){ var r=$('row-'+ds); return r? JSON.parse(r.getAttribute('data-state')||'{}') : {}; }
  function setRowState(ds, st){ var r=$('row-'+ds); if(r) r.setAttribute('data-state', JSON.stringify(st)); }

  function buildRow(ds, dateObj, habitual, variable, locked, existing, isOffExtraOnly){
    var tr=document.createElement('tr'); tr.id='row-'+ds;

    var td1=document.createElement('td'); td1.innerHTML='<b>'+wname(dateObj)+' '+ds.slice(8,10)+'/'+ds.slice(5,7)+'</b>';

    var td2=document.createElement('td');
    if (variable){
      var inp=document.createElement('input'); inp.id='var-'+ds; inp.placeholder='HH:MM-HH:MM'; if(locked) inp.disabled=true; td2.appendChild(inp);
    }else{
      td2.textContent = habitual || (isOffExtraOnly? '— (No habitual)':'—');
    }

    var td3=document.createElement('td'); td3.id='hrs-'+ds; td3.className='stack muted'; td3.appendChild(chipHours('—'));

    var td4=document.createElement('td'); td4.className='icon-row';
    var ok=document.createElement('button'); ok.id='ok-'+ds; ok.className='icon good'; ok.textContent='✓'; if(locked||isOffExtraOnly) ok.disabled=true;
    var ab=document.createElement('button'); ab.id='ab-'+ds; ab.className='icon bad'; ab.textContent='✕'; if(locked||isOffExtraOnly) ab.disabled=true;
    var ex=document.createElement('button'); ex.id='exbtn-'+ds; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
    td4.append(ok,ab,ex);

    if(isOffExtraOnly){
      var del=document.createElement('button'); del.className='icon'; del.textContent='🗑'; td4.appendChild(del);
      del.addEventListener('click', ()=>{ var u=firebase.auth().currentUser; if(!u) return;
        firebase.firestore().collection('timesheets').doc(u.uid+'_'+ds).delete().then(paintCurrentUser); });
    }

    tr.append(td1,td2,td3,td4);

    // Subfila Extra (4 columnas)
    var sub=document.createElement('tr'); sub.id='sub-'+ds; sub.className='subrow hidden';
    sub.innerHTML = '<td>Extra</td>'
      + '<td><input id="ex-'+ds+'" placeholder="HH:MM-HH:MM"></td>'
      + '<td id="hrsEx-'+ds" class="muted">—</td>'
      + '<td class="icon-row"><button class="btn small ghost" id="rmEx-'+ds+'">Quitar</button></td>';
    if(locked){ sub.querySelector('#rmEx-'+ds).disabled=true; sub.querySelector('#ex-'+ds).disabled=true; }

    var st={ok:false,ab:false,ex:false,extraHours:"",comment:(existing&&existing.comentarios)||""};
    if(existing){
      if(existing.tipoReporte==='HABITUAL') st.ok=true;
      if(existing.tipoReporte==='FALTA') st.ab=true;
      if(existing.tipoReporte==='EXTRA'){ st.ex=true; st.extraHours=existing.horarioReportado||""; sub.classList.remove('hidden'); }
      if(existing.tipoReporte==='MIXTO'){ st.ok=true; st.ex=true; var parts=(existing.horarioReportado||"").split('+'); st.extraHours=(parts[1]||"").trim(); sub.classList.remove('hidden'); }
    }
    setRowState(ds,st);
    return [tr,sub];
  }

  function applyStateToUI(ds, habitual, variable){
    var st=rowState(ds);
    ['ok-','ab-','exbtn-'].forEach(p=>{ var b=$(p+ds); if(!b) return; b.classList.toggle('active', !!st[p==='ok-'?'ok':p==='ab-'?'ab':'ex']); });
    var hrsMain=$('hrs-'+ds); if(!hrsMain) return; hrsMain.innerHTML='';

    if(st.ab){ hrsMain.appendChild(chipHours('0 h')); var hex=$('hrsEx-'+ds); if(hex) hex.textContent='—'; return; }

    var added=false;
    if(st.ok){
      var base=habitual; if(variable){ var v=($('var-'+ds)?.value||'').trim(); if(v) base=v; }
      var p=parseHM(base); hrsMain.appendChild(chipHours(p? (p.hours+' h'):'—')); added=true;
    }
    if(st.ex){
      var t=st.extraHours || (($('ex-'+ds)?.value)||'').trim(); var p2=parseHM(t);
      hrsMain.appendChild(chipHours(p2? (p2.hours+' h'):'—')); added=true;
      var hex=$('hrsEx-'+ds); if(hex) hex.textContent=p2? (p2.hours+' h'):'—';
    }else{ var hex2=$('hrsEx-'+ds); if(hex2) hex2.textContent='—'; }

    if(!added) hrsMain.appendChild(chipHours('—'));
  }

  // Persistencia robusta: guarda ✓/✕/＋ aun sin horas
  function persistState(user, ds, key, habitual, variable){
    const st = rowState(ds);

    let tipo = null;
    let hr   = "";
    const com = st.comment || "";

    if (st.ok && st.ex){
      let base = habitual;
      if (variable){
        const v = (document.getElementById('var-'+ds)?.value || '').trim();
        if (v) base = v;
      }
      const extra = st.extraHours || (document.getElementById('ex-'+ds)?.value || '').trim();
      hr = (base || "") + " + " + extra;
      tipo = "MIXTO";
    } else if (st.ok){
      tipo = "HABITUAL";
      if (variable){
        const v = (document.getElementById('var-'+ds)?.value || '').trim();
        hr = v || habitual || "";
      } else {
        hr = habitual || "";
      }
    } else if (st.ab){
      tipo = "FALTA";
      hr = "";
    } else if (st.ex){
      tipo = "EXTRA";
      hr = st.extraHours || (document.getElementById('ex-'+ds)?.value || '').trim();
    }

    const ref = firebase.firestore().collection('timesheets').doc(user.uid+'_'+ds);

    if (!tipo){
      return ref.delete().catch(()=>{});
    }

    return getConfig(user.uid).then(cfg =>
      ref.set({
        userId: user.uid,
        email: user.email,
        nombre: (cfg && cfg.nombre) || '',
        fecha: ds,
        mesAnio: key,
        tipoReporte: tipo,
        horarioReportado: hr,
        comentarios: com,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
    );
  }

  function persistAllRows(user){
    const key = currentYM();
    document.querySelectorAll('tr[id^="row-"]').forEach(tr=>{
      const ds = tr.id.replace('row-','');
      const variable = !!document.getElementById('var-'+ds);
      let habitual = tr.children[1]?.textContent?.trim() || "";
      if (variable){
        const v = (document.getElementById('var-'+ds)?.value || '').trim();
        if (v) habitual = v;
      }
      persistState(user, ds, key, habitual, variable);
    });
  }

  function paintTable(user){
    var key=currentYM();
    Promise.all([ getConfig(user.uid), getLock(user.uid,key), monthReports(user.uid,key) ]).then(([cfg,lock,existing])=>{
      document.getElementById('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
      document.getElementById('user-email').textContent = user.email;
      document.getElementById('rows').innerHTML='';

      var sbd=(cfg&&cfg.scheduleByDay)||{};
      var parts=key.split('-'), y=+parts[0], m=+parts[1], last=new Date(y,m,0).getDate();
      for(var d=1; d<=last; d++){
        var date=new Date(y,m-1,d), ds=fmt(date);
        var info=habitualForDay(sbd,date), hasExisting=!!existing[ds];
        var isOffExtraOnly = info.skip && hasExisting && existing[ds].tipoReporte==='EXTRA';
        if(info.skip && !hasExisting) continue;

        var pair = buildRow(ds,date,info.text,info.variable,lock.locked,existing[ds],isOffExtraOnly);
        document.getElementById('rows').append(pair[0], pair[1]);

        (function(ds,info){
          var ok=document.getElementById('ok-'+ds), ab=document.getElementById('ab-'+ds), ex=document.getElementById('exbtn-'+ds);
          if (ok) ok.addEventListener('click', ()=>{
            const st=rowState(ds);
            st.ok=!st.ok; if(st.ok) st.ab=false;
            setRowState(ds,st); applyStateToUI(ds,info.text,info.variable);
            persistState(user,ds,key,info.text,info.variable);
          });
          if (ab) ab.addEventListener('click', ()=>{
            const st=rowState(ds);
            st.ab=!st.ab; if(st.ab){ st.ok=false; st.ex=false; }
            setRowState(ds,st); applyStateToUI(ds,info.text,info.variable);
            persistState(user,ds,key,info.text,info.variable);
          });
          if (ex) ex.addEventListener('click', ()=>{
            document.getElementById('sub-'+ds).classList.toggle('hidden');
            const st=rowState(ds);
            st.ex=!document.getElementById('sub-'+ds).classList.contains('hidden');
            setRowState(ds,st); applyStateToUI(ds,info.text,info.variable);
            persistState(user,ds,key,info.text,info.variable);
          });

          var exI=document.getElementById('ex-'+ds), rm=document.getElementById('rmEx-'+ds);
          function autosaveExtra(){
            const st=rowState(ds);
            const val=(exI&&exI.value||'').trim();
            if(val){
              st.ex=true; st.ok=true; st.ab=false; st.extraHours=val;
              setRowState(ds,st); applyStateToUI(ds,info.text,info.variable);
              persistState(user,ds,key,info.text,info.variable);
            }
          }
          if(exI){ exI.addEventListener('blur',autosaveExtra); exI.addEventListener('change',autosaveExtra); }
          if(rm){ rm.addEventListener('click', ()=>{
            const st=rowState(ds); st.ex=false; st.extraHours="";
            setRowState(ds,st); document.getElementById('sub-'+ds).classList.add('hidden'); applyStateToUI(ds,info.text,info.variable);
            persistState(user,ds,key,info.text,info.variable);
          }); }

          applyStateToUI(ds,info.text,info.variable);
        })(ds,info);
      }

      document.getElementById('submit-month').disabled = lock.locked;
      document.getElementById('reset-month').disabled = lock.locked;
    });
  }

  function addOrUpdateSingleRow(user, dateStr){
    var key=currentYM();
    Promise.all([ getConfig(user.uid), getOne(user.uid, dateStr), getLock(user.uid, key) ]).then(([cfg, report, lock])=>{
      var date=new Date(dateStr), info=habitualForDay((cfg&&cfg.scheduleByDay)||{}, date);
      var row=document.getElementById('row-'+dateStr); if(row){ if(row.nextSibling && row.nextSibling.id==='sub-'+dateStr) row.nextSibling.remove(); row.remove(); }
      var pair=buildRow(dateStr,date,info.text,info.variable,lock.locked,report, info.skip && report && report.tipoReporte==='EXTRA');
      var rows=document.getElementById('rows'), items=rows.querySelectorAll('tr[id^="row-"]'); var done=false;
      for(var i=0;i<items.length;i++){ var ds=items[i].id.replace('row-',''); if(ds>dateStr){ rows.insertBefore(pair[0], items[i]); rows.insertBefore(pair[1], items[i]); done=true; break; } }
      if(!done){ rows.append(pair[0],pair[1]); }
      applyStateToUI(dateStr, info.text, info.variable);
    });
  }

  function resetMonth(user){
    var key=currentYM(), db=firebase.firestore();
    db.collection('timesheets').where('userId','==',user.uid).where('mesAnio','==',key).get()
      .then(s=>{ var b=db.batch(); s.forEach(d=>b.delete(d.ref)); return b.commit(); })
      .then(()=> db.collection('locks').doc(user.uid+'_'+key).delete().catch(()=>{}))
      .then(()=> paintTable(user));
  }

  // Botones globales (una sola vez)
  (function attachGlobalHandlers(){
    const btnSave = document.getElementById('save-all');
    if (btnSave && !btnSave.dataset.bound) {
      btnSave.addEventListener('click', function(){
        const u = firebase.auth().currentUser;
        if (u) persistAllRows(u);
      });
      btnSave.dataset.bound = "1";
    }
  })();

  document.getElementById('submit-month').addEventListener('click', ()=>{
    var u=firebase.auth().currentUser; if(!u) return; var key=currentYM();
    setLock(u.uid,key,true).then(()=>getLock(u.uid,key)).then(lk=>{
      document.getElementById('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
      document.getElementById('submit-month').disabled = lk.locked; document.getElementById('reset-month').disabled = lk.locked;
    });
  });
  document.getElementById('reset-month').addEventListener('click', ()=>{
    var u=firebase.auth().currentUser; if(!u) return;
    if(!confirm('¿Resetear la planilla del mes actual? Esto borra los registros del mes.')) return;
    resetMonth(u);
  });
  document.getElementById('nh-save').addEventListener('click', ()=>{
    var u=firebase.auth().currentUser; if(!u) return; var key=currentYM();
    var date=document.getElementById('nh-date').value, range=(document.getElementById('nh-range').value||'').trim(), notes=document.getElementById('nh-notes').value.trim();
    var p=parseHM(range); if(!date || !p) return;
    var hrs=p.start+'-'+p.end;
    getConfig(u.uid).then(cfg =>
      firebase.firestore().collection('timesheets').doc(u.uid+'_'+date).set({
        userId:u.uid,email:u.email,nombre:(cfg&&cfg.nombre)||'',
        fecha:date,mesAnio:key,tipoReporte:'EXTRA',horarioReportado:hrs,comentarios:notes||'Extra en día no habitual',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true})
    ).then(()=> addOrUpdateSingleRow(u,date));
  });

  document.getElementById('sel-month').addEventListener('change', ()=>paintCurrentUser());
  document.getElementById('sel-year').addEventListener('change', ()=>paintCurrentUser());
  document.getElementById('logout-btn').addEventListener('click', ()=>firebase.auth().signOut());

  firebase.auth().onAuthStateChanged(user=>{
    if(!user){ document.getElementById('auth-card').classList.remove('hidden'); document.getElementById('app-card').classList.add('hidden'); return; }
    document.getElementById('auth-card').classList.add('hidden'); document.getElementById('app-card').classList.remove('hidden');
    document.getElementById('user-email').textContent=user.email;
    buildMonthSelectors(); paintTable(user);
  });

  window.doLogin = async function(){
    const btn=document.getElementById('login-btn'), msg=document.getElementById('auth-msg');
    const email=(document.getElementById('email')?.value||'').trim(), pass=(document.getElementById('password')?.value||'');
    try{
      btn.disabled=true; btn.textContent='Ingresando...';
      if(firebase.auth().setPersistence) await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      await firebase.auth().signInWithEmailAndPassword(email,pass);
      msg.textContent='Ingreso correcto'; msg.style.color='#86efac';
    }catch(e){ msg.textContent=e?.message || 'No se pudo ingresar'; msg.style.color='#fecaca'; }
    finally{ btn.disabled=false; btn.textContent='Entrar'; }
  };

  function paintCurrentUser(){ var u=firebase.auth().currentUser; if(u) paintTable(u); }
})();