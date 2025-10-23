(function(){
  try { document.getElementById('version-chip').textContent = window.__APP_VERSION || document.getElementById('version-chip').textContent; } catch(e){}

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

  // **********************************************
  // ** FUNCIONES DE ROL Y CONFIGURACIÓN **
  // **********************************************
  function getRole(uid){
    const storedRole = localStorage.getItem('userRole_' + uid);
    if (storedRole) {
        return Promise.resolve(storedRole);
    }
    
    return firebase.firestore().collection('employee_config').where('userId','==',uid).limit(1).get()
      .then(function(q){ 
          let role = 'employee';
          if(!q.empty) {
              var data = q.docs[0].data();
              if (data && data.role === 'admin') {
                  role = 'admin';
              }
          }
          localStorage.setItem('userRole_' + uid, role);
          return role; 
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

  function buildMonthSelectors(){
    var now=new Date(), y=now.getFullYear();
    var selM=$('sel-month'), selY=$('sel-year');
    if (!selM || !selY) return; 

    var months=['01','02','03','04','05','06','07','08','09','10','11','12'];
    var names=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    selM.innerHTML=''; selY.innerHTML='';
    for(var i=0;i<12;i++){ var opt=document.createElement('option'); opt.value=months[i]; opt.textContent=names[i].charAt(0).toUpperCase()+names[i].slice(1); selM.appendChild(opt); }
    for(var k=y-2;k<=y+2;k++){ var oy=document.createElement('option'); oy.value=String(k); oy.textContent=String(k); selY.appendChild(oy); }
    var ymNow = ym(now).split('-'); selM.value=ymNow[1]; selY.value=ymNow[0];
  }
  function currentYM(){ return ymFromParts($('sel-year').value, $('sel-month').value); }

  function habitualForDay(sbd, d){
    var o = (sbd && sbd[wkey(d)]) || {};
    if(o.off) return {text:null, variable:false, skip:true};
    if(o.variable) return {text:"", variable:true, skip:false};
    if(!o.start || !o.end) return {text:o.start+"-"+o.end, variable:false, skip:false};
    return {text:o.start+"-"+o.end, variable:false, skip:false};
  }
  function rowState(ds){ var r=$('row-'+ds); return r? JSON.parse(r.getAttribute('data-state')||'{}') : {}; }
  function setRowState(ds, st){ var r=$('row-'+ds); if(r) r.setAttribute('data-state', JSON.stringify(st)); }

  function buildRow(ds, dateObj, habitual, variable, locked, existing, isOffExtraOnly){
    var tr=document.createElement('tr'); tr.id='row-'+ds;

    var td1=document.createElement('td'); // DÍA
    var b=document.createElement('b'); b.textContent=wname(dateObj)+' '+ds.slice(8,10)+'/'+ds.slice(5,7); 
    td1.appendChild(b);

    var td2=document.createElement('td'); // HORARIO HABITUAL
    if(variable){ 
      var inp=document.createElement('input'); 
      inp.id='var-'+ds; 
      inp.placeholder='HH:MM-HH:MM'; 
      if(locked) inp.disabled=true; 
      td2.appendChild(inp); 
    } else { 
      td2.textContent = habitual || (isOffExtraOnly? '— (No habitual)':'—'); 
    }
    
    // TD3 se convierte en ACCIONES
    var td3_actions=document.createElement('td'); 
    td3_actions.className='icon-row';
    var ok=document.createElement('button'); ok.id='ok-'+ds; ok.className='icon good'; ok.textContent='✓'; if(locked||isOffExtraOnly) ok.disabled=true;
    var ab=document.createElement('button'); ab.id='ab-'+ds; ab.className='icon bad'; ab.textContent='✕'; if(locked||isOffExtraOnly) ab.disabled=true;
    var ex=document.createElement('button'); ex.id='exbtn-'+ds; ex.className='icon blue'; ex.textContent='＋'; if(locked) ex.disabled=true;
    td3_actions.appendChild(ok); td3_actions.appendChild(ab); td3_actions.appendChild(ex);

    if(isOffExtraOnly){
      var del=document.createElement('button'); del.className='trash'; del.title='Borrar este extra'; del.textContent='🗑';
      td3_actions.appendChild(del);
      del.addEventListener('click', function(){
        var u=firebase.auth().currentUser; if(!u) return;
        firebase.firestore().collection('timesheets').doc(u.uid+'_'+ds).delete().then(function(){ paintCurrentUser(); });
      });
    }
    
    // TD4 se convierte en COMENTARIO
    var td4_comment=document.createElement('td'); 
    var cm=document.createElement('input'); cm.id='cm-'+ds; 
    
    var commentText = existing && existing.comentarios === "undefined" ? "" : existing && existing.comentarios ? existing.comentarios : "";
    cm.placeholder = "Comentario...";
    if (commentText) {
        cm.value = commentText;
    }
    
    td4_comment.appendChild(cm);

    // TD5 se convierte en HS TRABAJADAS (Final)
    var td5_hrs=document.createElement('td'); 
    td5_hrs.id='hrs-'+ds; 
    td5_hrs.className='stack muted'; 
    td5_hrs.innerHTML='<span class="tag">—</span>';

    // SE AÑADEN EN EL NUEVO ORDEN: TD1, TD2, TD3(ACTIONS), TD4(COMMENT), TD5(HRS)
    tr.appendChild(td1); 
    tr.appendChild(td2); 
    tr.appendChild(td3_actions); 
    tr.appendChild(td4_comment); 
    tr.appendChild(td5_hrs);

    // Subfila para EXTRA, ajustando el orden de sus celdas para que coincida con la principal
    var sub=document.createElement('tr'); sub.id='sub-'+ds; sub.className='subrow hidden';
    sub.innerHTML= ''
      + '<td>Extra</td>' // DÍA
      + '<td><input id="ex-'+ds+'" placeholder="HH:MM-HH:MM"></td>' // HORARIO HABITUAL
      + '<td class="icon-row"><button class="btn small ghost" id="rmEx-'+ds+'">Quitar</button></td>' // ACCIONES (Botón Quitar)
      + '<td><input id="cmEx-'+ds+'" placeholder="Comentario (extra)..."></td>' // COMENTARIO (Extra)
      + '<td id="hrsEx-'+ds+'" class="muted">—</td>'; // HS TRABAJADAS (Extra)

    if(locked){ 
      var rm = sub.querySelector('#rmEx-'+ds); if(rm) rm.disabled=true; 
      var exInp = sub.querySelector('#ex-'+ds); if(exInp) exInp.disabled=true;
      var cmEx = sub.querySelector('#cmEx-'+ds); if(cmEx) cmEx.disabled=true;
    }

    var st={ok:false,ab:false,ex:false,extraHours:"",comment:(existing&&existing.comentarios)||"",cmExtra:""};
    
    if(existing){
      if(existing.tipoReporte==='HABITUAL') st.ok=true;
      if(existing.tipoReporte==='FALTA') st.ab=true;
      if(existing.tipoReporte==='EXTRA'){ st.ex=true; st.extraHours=existing.horarioReportado||""; st.cmExtra=existing.comentarios||""; }
      if(existing.tipoReporte==='MIXTO'){ 
          st.ok=true; 
          st.ex=true; 
          var parts=(existing.horarioReportado||"").split('+'); 
          st.extraHours=(parts[1]||"").trim();
      }
      st.comment = existing.comentarios||""; 
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
    
    if($('cm-'+ds)) $('cm-'+ds).value = st.comment || "";
    if($('cmEx-'+ds)) $('cmEx-'+ds).value = st.cmExtra;
    
    if(exInput && st.extraHours) exInput.value = st.extraHours;
    
    var trExtra=$('sub-'+ds); 
    if(trExtra) trExtra.classList.toggle('hidden', !st.ex);
    
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
      if(hrsEx) hrsMain.innerHTML='<span class="tag">—</span>';
    }
    if(!pusoAlgo){
      var dash=document.createElement('span'); dash.className='tag'; dash.textContent='—'; hrsMain.appendChild(dash);
    }
  }

  function persistState(user, ds, key, habitual, variable){
    var st=rowState(ds);
    
    st.comment = ($('cm-'+ds)&&$('cm-'+ds).value)||"";
    st.cmExtra = ($('cmEx-'+ds)&&$('cmEx-'+ds).value)||"";
    st.extraHours = ($('ex-'+ds)&&$('ex-'+ds).value)||""; 
    setRowState(ds, st); 

    var tipo=null, hr="", com=st.comment, cmEx=st.cmExtra;
    
    if (variable && st.ok) {
        var v = ($('var-'+ds)&&$('var-'+ds).value||'').trim();
        if (v) habitual = v;
    }
    
    if(st.ok && st.ex){ var h=habitual; hr=h+" + "+st.extraHours; tipo='MIXTO'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    else if(st.ok){ var h2=habitual; hr=h2; tipo='HABITUAL'; }
    else if(st.ab){ tipo='FALTA'; hr=""; }
    else if(st.ex){ hr=st.extraHours; tipo='EXTRA'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    
    var ref=firebase.firestore().collection('timesheets').doc(user.uid+'_'+ds);
    
    if(!tipo && !com){ return ref.delete().catch(function(){}).then(function(){ $('last-update').textContent=new Date().toLocaleString(); }); }
    
    return getConfig(user.uid).then(function(cfg){
      return ref.set({userId:user.uid,email:user.email,nombre:(cfg&&cfg.nombre)||'',fecha:ds,mesAnio:key,tipoReporte:tipo||'',horarioReportado:hr,comentarios:com,timestamp: firebase.firestore.FieldValue.serverTimestamp()},{merge:true})
        .then(function(){ $('last-update').textContent=new Date().toLocaleString(); });
    });
  }
  
  // **********************************************
  // ** FUNCIÓN DE CARGA DEL PANEL DE ADMINISTRACIÓN **
  // **********************************************
  let allEmployees = []; // Cache para todos los empleados

  function loadAdminData(user) {
      const db = firebase.firestore();
      const employeeListContainer = $('employee-list-container');
      const scheduleEmployeeList = $('schedule-employee-list');

      // Limpiar listas anteriores
      if (employeeListContainer) employeeListContainer.innerHTML = '';
      if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '';

      // 1. Cargar todos los empleados de la colección employee_config
      db.collection('employee_config').get()
          .then(snapshot => {
              allEmployees = [];
              const fragmentEmpList = document.createDocumentFragment();
              const fragmentScheduleList = document.createDocumentFragment();

              snapshot.forEach(doc => {
                  const data = doc.data();
                  if (data.userId && data.nombre) {
                      allEmployees.push(data);
                      
                      const emailParts = data.email.split('@');
                      const username = emailParts.length > 1 ? `@${emailParts[0]}` : data.email;
                      const isActive = true; // Asumir activo por simplicidad o basar en un campo real

                      // Función para crear el ítem de lista
                      const createListItem = (containerType) => {
                          const item = document.createElement('div');
                          item.className = 'admin-col-list-item';
                          item.setAttribute('data-user-id', data.userId);
                          
                          let content = `
                              ${data.nombre || 'Sin Nombre'} 
                              <span class="username">${username}</span>
                              <span class="chip" style="background: var(--good);">Activo</span>
                          `;
                          
                          // Para la lista de horarios, el nombre es suficiente
                          if (containerType === 'schedule') {
                              content = data.nombre || 'Sin Nombre';
                              item.className = 'admin-col-list-item'; // Clase base sin username/chip
                          }
                          
                          item.innerHTML = content;
                          
                          // Añadir evento de clic para seleccionar empleado
                          item.addEventListener('click', () => {
                              selectEmployee(data.userId);
                          });
                          return item;
                      };

                      if (employeeListContainer) {
                          fragmentEmpList.appendChild(createListItem('employee'));
                      }
                      if (scheduleEmployeeList) {
                          fragmentScheduleList.appendChild(createListItem('schedule'));
                      }
                  }
              });
              
              if (employeeListContainer) employeeListContainer.appendChild(fragmentEmpList);
              if (scheduleEmployeeList) scheduleEmployeeList.appendChild(fragmentScheduleList);
              
              // Inicializar la gestión de horarios después de cargar
              if (allEmployees.length > 0) {
                  selectEmployee(allEmployees[0].userId);
              } else {
                  $('schedule-config-form').innerHTML = '<p class="muted">No hay empleados registrados.</p>';
              }
          })
          .catch(error => {
              console.error("Error cargando lista de empleados:", error);
              if (employeeListContainer) employeeListContainer.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
              if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
          });
  }

  // **********************************************
  // ** LÓGICA DE SELECCIÓN DE EMPLEADO (Horarios) **
  // **********************************************
  function selectEmployee(userId) {
      const selectedEmployee = allEmployees.find(emp => emp.userId === userId);
      const listItems = document.querySelectorAll('#schedule-employee-list .admin-col-list-item');
      const formTitle = document.querySelector('#admin-section-horarios .card b');
      const formContainer = $('schedule-config-form');
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const scheduleByDay = (selectedEmployee && selectedEmployee.scheduleByDay) || {};

      // 1. Marcar el empleado seleccionado
      listItems.forEach(item => {
          if (item.getAttribute('data-user-id') === userId) {
              item.classList.add('selected');
          } else {
              item.classList.remove('selected');
          }
      });
      
      if (!selectedEmployee) {
          formTitle.textContent = 'Horario';
          formContainer.innerHTML = '<p class="muted">Selecciona un empleado.</p>';
          return;
      }
      
      // 2. Actualizar el título del formulario
      formTitle.textContent = `Horario de ${selectedEmployee.nombre || selectedEmployee.email}`;
      
      // 3. Renderizar el formulario de horarios
      let formHTML = '';
      
      days.forEach((day, index) => {
          const key = wkey(new Date(2000, 0, index)); // Obtener 'sun', 'mon', etc.
          const schedule = scheduleByDay[key] || {};
          const value = schedule.start && schedule.end ? `${schedule.start}-${schedule.end}` : '';
          
          formHTML += `
              <div class="schedule-day-input">
                  <label>${day}</label>
                  <input type="text" id="schedule-${key}" data-day-key="${key}" placeholder="Ej: 08:00-16:00 o vacío" value="${value}">
              </div>
          `;
      });
      
      formHTML += `<button class="btn" style="width: 100%; margin-top: 15px;" id="save-schedule-btn" data-user-id="${userId}">Guardar Horario</button>`;
      
      formContainer.innerHTML = formHTML;
      
      // 4. Adjuntar manejador de guardado (implementación pendiente en persistencia)
      $('save-schedule-btn').addEventListener('click', () => {
          // Lógica de guardado aquí (implementación pendiente)
          console.log(`Guardando horario para el usuario: ${userId}`);
      });
  }


  // **********************************************
  // ** FUNCIONES DE PLANILLA Y PERSISTENCIA (SIN CAMBIOS) **
  // **********************************************
  
  function persistState(user, ds, key, habitual, variable){
    var st=rowState(ds);
    
    st.comment = ($('cm-'+ds)&&$('cm-'+ds).value)||"";
    st.cmExtra = ($('cmEx-'+ds)&&$('cmEx-'+ds).value)||"";
    st.extraHours = ($('ex-'+ds)&&$('ex-'+ds).value)||""; 
    setRowState(ds, st); 

    var tipo=null, hr="", com=st.comment, cmEx=st.cmExtra;
    
    if (variable && st.ok) {
        var v = ($('var-'+ds)&&$('var-'+ds).value||'').trim();
        if (v) habitual = v;
    }
    
    if(st.ok && st.ex){ var h=habitual; hr=h+" + "+st.extraHours; tipo='MIXTO'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    else if(st.ok){ var h2=habitual; hr=h2; tipo='HABITUAL'; }
    else if(st.ab){ tipo='FALTA'; hr=""; }
    else if(st.ex){ hr=st.extraHours; tipo='EXTRA'; if(cmEx) com = com? (com+" | Extra: "+cmEx):("Extra: "+cmEx); }
    
    var ref=firebase.firestore().collection('timesheets').doc(user.uid+'_'+ds);
    
    if(!tipo && !com){ return ref.delete().catch(function(){}).then(function(){ $('last-update').textContent=new Date().toLocaleString(); }); }
    
    return getConfig(user.uid).then(function(cfg){
      return ref.set({userId:user.uid,email:user.email,nombre:(cfg&&cfg.nombre)||'',fecha:ds,mesAnio:key,tipoReporte:tipo||'',horarioReportado:hr,comentarios:com,timestamp: firebase.firestore.FieldValue.serverTimestamp()},{merge:true})
        .then(function(){ $('last-update').textContent=new Date().toLocaleString(); });
    });
  }
  
  function persistAllRows(user) {
    const key = currentYM();
    const rows = document.querySelectorAll('tbody#rows tr[id^="row-"]');
    const savePromises = [];
    
    const saveBtn = $('save-all');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    rows.forEach(tr => {
      if (tr.id.startsWith('row-')) {
        const ds = tr.id.replace('row-', '');
        
        const date = new Date(key.slice(0, 4), key.slice(5, 7) - 1, ds.slice(8, 10));
        const cfgPromise = getConfig(user.uid);
        
        const ok = $('ok-'+ds);
        const ab = $('ab-'+ds);
        const exb = $('exbtn-'+ds);
        
        if (ok || ab || exb) {
            const st = rowState(ds);
            st.ok = ok.classList.contains('active');
            st.ab = ab.classList.contains('active');
            st.ex = exb.classList.contains('active');
            setRowState(ds, st);
        }
        
        savePromises.push(cfgPromise.then(cfg => {
          const info = habitualForDay((cfg && cfg.scheduleByDay) || {}, date);
          
          return persistState(user, ds, key, info.text, info.variable);
        }));
      }
    });

    return Promise.all(savePromises)
      .then(() => {
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Cambios guardados correctamente.', true);
      })
      .catch(error => {
        console.error('Error al guardar todos los cambios:', error);
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Error al grabar cambios. Revisa la consola.', false);
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Grabar cambios';
        setTimeout(() => { 
            const msg = $('emp-msg'); 
            if (msg) msg.textContent = ''; 
        }, 3000);
      });
  }

  function paintTable(user, role){ 
    $('user-email').textContent = user.email;
    
    if (role === 'employee') {
        buildMonthSelectors();
        var key=currentYM();
        $('employee-view').classList.remove('hidden');
        $('admin-view').classList.add('hidden');
        
        return Promise.all([ getConfig(user.uid), getLock(user.uid, key), monthReports(user.uid, key) ]).then(function(arr){
            var cfg=arr[0], lock=arr[1], existing=arr[2];
            $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
            $('last-update').textContent = '—';
            
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
                    if(exb) exb.addEventListener('click', function(){ var st=rowState(ds); st.ex=!st.ex; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
                    
                    applyStateToUI(ds,info.text,info.variable);
                    
                    if(existing[ds]){
                        var cm=$('cm-'+ds); if(cm) cm.value=existing[ds].comentarios||"";
                        
                        if(info.variable){ 
                            var varInp=$('var-'+ds); 
                            var horarioReportado = existing[ds].horarioReportado;
                            if(horarioReportado){
                                var parts = horarioReportado.split('+');
                                varInp.value = (existing[ds].tipoReporte === 'MIXTO' ? (parts[0] || '').trim() : horarioReportado).trim();
                            }
                        }
                        
                        if(existing[ds].tipoReporte==='EXTRA' || existing[ds].tipoReporte==='MIXTO'){ 
                            var exI=$('ex-'+ds); 
                            var parts = existing[ds].horarioReportado.split('+');
                            var exHours = (existing[ds].tipoReporte === 'MIXTO' ? parts[1] : parts[0] || "").trim();
                            
                            if(exI) exI.value = exHours; 
                            var st=rowState(ds); st.ex=true; st.extraHours=exHours; setRowState(ds,st); 
                        }
                        
                        if(existing[ds].timestamp){ try{$('last-update').textContent=new Date(existing[ds].timestamp.toDate()).toLocaleString();}catch(e){} }
                        applyStateToUI(ds,info.text,info.variable);
                    }
                    
                    var cmInput=$('cm-'+ds); 
                    if(cmInput) cmInput.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); });
                    
                    var varInput = $('var-'+ds);
                    if (varInput) varInput.addEventListener('blur', function(){ 
                        applyStateToUI(ds, info.text, info.variable); 
                        persistState(user,ds,key,info.text,info.variable); 
                    });

                    var rmEx=$('rmEx-'+ds);
                    var exInput=$('ex-'+ds), cmx=$('cmEx-'+ds);
                    function autosaveExtra(){ 
                        var st=rowState(ds); 
                        var val=(exInput&&exInput.value||'').trim(); 
                        if(val){ 
                            st.ex=true; 
                            st.ab=false; 
                            st.extraHours=val; 
                            setRowState(ds,st); 
                            applyStateToUI(ds,info.text,info.variable); 
                            persistState(user,ds,key,info.text,info.variable); 
                        } 
                    }
                    if(exInput){ exInput.addEventListener('blur', autosaveExtra); exInput.addEventListener('change', autosaveExtra); }
                    if(cmx){ cmx.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); }); }
                    if(rmEx) rmEx.addEventListener('click', function(){ var st=rowState(ds); st.ex=false; st.extraHours=""; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
                })(ds,info);
            }
            $('submit-month').disabled = lock.locked;
            $('reset-month').disabled = lock.locked;
            
            $('save-all').addEventListener('click', function(){
                if(user) persistAllRows(user);
            });
        });
    } else if (role === 'admin') {
        // La vista ya está configurada en onAuthStateChanged
        $('employee-view').classList.add('hidden');
        $('admin-view').classList.remove('hidden');
        loadAdminData(user); // Carga los datos específicos del administrador
    }
  }
  
  // **********************************************
  // ** CARGA DE DATOS PARA EL PANEL DE ADMINISTRACIÓN **
  // **********************************************

  let allEmployees = []; // Cache para todos los empleados

  function loadEmployeesAndRenderLists() {
      const db = firebase.firestore();
      const employeeListContainer = $('employee-list-container');
      const scheduleEmployeeList = $('schedule-employee-list');
      const reviewEmployeeList = $('review-employee-list');

      // Limpiar listas anteriores
      if (employeeListContainer) employeeListContainer.innerHTML = '';
      if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '';
      if (reviewEmployeeList) reviewEmployeeList.innerHTML = '';

      // 1. Cargar todos los empleados de la colección employee_config
      db.collection('employee_config').get()
          .then(snapshot => {
              allEmployees = [];
              const fragmentEmpList = document.createDocumentFragment();
              const fragmentScheduleList = document.createDocumentFragment();
              const fragmentReviewList = document.createDocumentFragment();
              
              snapshot.forEach(doc => {
                  const data = doc.data();
                  if (data.userId && data.nombre) {
                      allEmployees.push(data);
                      
                      const emailParts = data.email.split('@');
                      const username = emailParts.length > 1 ? `@${emailParts[0]}` : data.email;
                      const isActive = true; // Asumir activo por simplicidad

                      // Crear item de lista para la pestaña Empleados
                      const itemEmp = document.createElement('div');
                      itemEmp.className = 'admin-col-list-item';
                      itemEmp.setAttribute('data-user-id', data.userId);
                      itemEmp.innerHTML = `${data.nombre || 'Sin Nombre'} <span class="username">${username}</span> <span class="chip" style="background: var(--good);">Activo</span>`;
                      fragmentEmpList.appendChild(itemEmp);
                      
                      // Crear item de lista para la pestaña Horarios
                      const itemSchedule = document.createElement('div');
                      itemSchedule.className = 'admin-col-list-item';
                      itemSchedule.setAttribute('data-user-id', data.userId);
                      itemSchedule.textContent = data.nombre || 'Sin Nombre';
                      itemSchedule.addEventListener('click', () => {
                           selectEmployeeSchedule(data.userId);
                      });
                      fragmentScheduleList.appendChild(itemSchedule);
                      
                      // Crear item de lista para la pestaña Revisión
                      // NOTA: El estado de 'Entregada' o 'Pendiente' requiere una consulta adicional a 'locks'
                      const itemReview = document.createElement('div');
                      itemReview.className = 'admin-col-list-item';
                      itemReview.textContent = data.nombre || 'Sin Nombre';
                      // Simulación del estado (necesitaría lógica de consulta real)
                      const statusChip = document.createElement('span');
                      statusChip.className = 'chip';
                      statusChip.textContent = 'Pendiente'; // Estado por defecto
                      statusChip.style.background = 'var(--bad)'; 
                      itemReview.appendChild(statusChip);
                      fragmentReviewList.appendChild(itemReview);
                  }
              });
              
              if (employeeListContainer) employeeListContainer.appendChild(fragmentEmpList);
              if (scheduleEmployeeList) scheduleEmployeeList.appendChild(fragmentScheduleList);
              if (reviewEmployeeList) reviewEmployeeList.appendChild(fragmentReviewList);
              
              // Inicializar la gestión de horarios después de cargar
              if (allEmployees.length > 0) {
                  selectEmployeeSchedule(allEmployees[0].userId);
              } else {
                  $('schedule-config-form').innerHTML = '<p class="muted">No hay empleados registrados.</p>';
              }
          })
          .catch(error => {
              console.error("Error cargando lista de empleados:", error);
              if (employeeListContainer) employeeListContainer.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
              if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
          });
  }
  
  function selectEmployeeSchedule(userId) {
      const selectedEmployee = allEmployees.find(emp => emp.userId === userId);
      const listItems = document.querySelectorAll('#schedule-employee-list .admin-col-list-item');
      const formTitle = document.querySelector('#admin-section-horarios .card b');
      const formContainer = $('schedule-config-form');
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const scheduleByDay = (selectedEmployee && selectedEmployee.scheduleByDay) || {};

      // 1. Marcar el empleado seleccionado
      listItems.forEach(item => {
          if (item.getAttribute('data-user-id') === userId) {
              item.classList.add('selected');
          } else {
              item.classList.remove('selected');
          }
      });
      
      if (!selectedEmployee) {
          formTitle.textContent = 'Horario';
          formContainer.innerHTML = '<p class="muted">Selecciona un empleado.</p>';
          return;
      }
      
      // 2. Actualizar el título del formulario
      formTitle.textContent = `Horario de ${selectedEmployee.nombre || selectedEmployee.email}`;
      
      // 3. Renderizar el formulario de horarios
      let formHTML = '';
      
      // Usamos los índices [0=Domingo, 1=Lunes, ..., 6=Sábado] y mapeamos a las claves 'sun', 'mon', etc.
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      
      days.forEach((day, index) => {
          const key = dayKeys[index];
          const schedule = scheduleByDay[key] || {};
          // Horario en formato HH:MM-HH:MM
          const value = schedule.start && schedule.end ? `${schedule.start}-${schedule.end}` : '';
          
          formHTML += `
              <div class="schedule-day-input">
                  <label>${day}</label>
                  <input type="text" id="schedule-${key}" data-day-key="${key}" placeholder="Ej: 08:00-16:00 o vacío" value="${value}">
              </div>
          `;
      });
      
      formHTML += `<button class="btn" style="width: 100%; margin-top: 15px;" id="save-schedule-btn" data-user-id="${userId}">Guardar Horario</button>`;
      
      formContainer.innerHTML = formHTML;
      
      // 4. Adjuntar manejador de guardado (implementación pendiente en persistencia)
      $('save-schedule-btn').addEventListener('click', () => {
          // Lógica de guardado aquí (implementación pendiente)
          console.log(`Guardando horario para el usuario: ${userId}`);
      });
  }


  function paintTable(user, role){ 
    $('user-email').textContent = user.email;
    
    if (role === 'employee') {
        buildMonthSelectors();
        var key=currentYM();
        $('employee-view').classList.remove('hidden');
        $('admin-view').classList.add('hidden');
        
        return Promise.all([ getConfig(user.uid), getLock(user.uid, key), monthReports(user.uid, key) ]).then(function(arr){
            var cfg=arr[0], lock=arr[1], existing=arr[2];
            $('lock-state').textContent = lock.locked? 'Bloqueado':'Editable';
            $('last-update').textContent = '—';
            
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
                    if(exb) exb.addEventListener('click', function(){ var st=rowState(ds); st.ex=!st.ex; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
                    
                    applyStateToUI(ds,info.text,info.variable);
                    
                    if(existing[ds]){
                        var cm=$('cm-'+ds); if(cm) cm.value=existing[ds].comentarios||"";
                        
                        if(info.variable){ 
                            var varInp=$('var-'+ds); 
                            var horarioReportado = existing[ds].horarioReportado;
                            if(horarioReportado){
                                var parts = horarioReportado.split('+');
                                varInp.value = (existing[ds].tipoReporte === 'MIXTO' ? (parts[0] || '').trim() : horarioReportado).trim();
                            }
                        }
                        
                        if(existing[ds].tipoReporte==='EXTRA' || existing[ds].tipoReporte==='MIXTO'){ 
                            var exI=$('ex-'+ds); 
                            var parts = existing[ds].horarioReportado.split('+');
                            var exHours = (existing[ds].tipoReporte === 'MIXTO' ? parts[1] : parts[0] || "").trim();
                            
                            if(exI) exI.value = exHours; 
                            var st=rowState(ds); st.ex=true; st.extraHours=exHours; setRowState(ds,st); 
                        }
                        
                        if(existing[ds].timestamp){ try{$('last-update').textContent=new Date(existing[ds].timestamp.toDate()).toLocaleString();}catch(e){} }
                        applyStateToUI(ds,info.text,info.variable);
                    }
                    
                    var cmInput=$('cm-'+ds); 
                    if(cmInput) cmInput.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); });
                    
                    var varInput = $('var-'+ds);
                    if (varInput) varInput.addEventListener('blur', function(){ 
                        applyStateToUI(ds, info.text, info.variable); 
                        persistState(user,ds,key,info.text,info.variable); 
                    });

                    var rmEx=$('rmEx-'+ds);
                    var exInput=$('ex-'+ds), cmx=$('cmEx-'+ds);
                    function autosaveExtra(){ 
                        var st=rowState(ds); 
                        var val=(exInput&&exInput.value||'').trim(); 
                        if(val){ 
                            st.ex=true; 
                            st.ab=false; 
                            st.extraHours=val; 
                            setRowState(ds,st); 
                            applyStateToUI(ds,info.text,info.variable); 
                            persistState(user,ds,key,info.text,info.variable); 
                        } 
                    }
                    if(exInput){ exInput.addEventListener('blur', autosaveExtra); exInput.addEventListener('change', autosaveExtra); }
                    if(cmx){ cmx.addEventListener('blur', function(){ persistState(user,ds,key,info.text,info.variable); }); }
                    if(rmEx) rmEx.addEventListener('click', function(){ var st=rowState(ds); st.ex=false; st.extraHours=""; setRowState(ds,st); applyStateToUI(ds,info.text,info.variable); persistState(user,ds,key,info.text,info.variable); });
                })(ds,info);
            }
            $('submit-month').disabled = lock.locked;
            $('reset-month').disabled = lock.locked;
            
            $('save-all').addEventListener('click', function(){
                if(user) persistAllRows(user);
            });
        });
    } else if (role === 'admin') {
        // Si es admin, carga la data del panel
        $('employee-view').classList.add('hidden');
        $('admin-view').classList.remove('hidden');
        loadEmployeesAndRenderLists(user);
    }
  }
  
  function addOrUpdateSingleRow(user, dateStr){
    var key=currentYM();
    return Promise.all([ getConfig(user.uid), getOneReport(user.uid, dateStr), getLock(user.uid, key) ]).then(function(arr){
      var cfg=arr[0], report=arr[1], lock=arr[2];
      var date=new Date(dateStr);
      var info=habitualForDay((cfg&&cfg.scheduleByDay)||{}, date);
      
      var existingTr=$('row-'+dateStr); 
      if(existingTr){ 
        if(existingTr.nextSibling && existingTr.nextSibling.id==='sub-'+dateStr) existingTr.nextSibling.remove(); 
        existingTr.remove(); 
      }
      
      var built=buildRow(dateStr, date, info.text, info.variable, lock.locked, report, info.skip && report && report.tipoReporte==='EXTRA');
      var rows=$('rows'); var days=rows.querySelectorAll('tr[id^="row-"]');
      var inserted=false;
      for(var i=0;i<days.length;i++){ var ds=days[i].id.replace('row-',''); if(ds>dateStr){ 
        rows.insertBefore(built[0], days[i]); 
        rows.insertBefore(built[1], days[i]); 
        inserted=true; break; 
      } }
      if(!inserted){ 
        rows.appendChild(built[0]); 
        rows.appendChild(built[1]); 
      }
      applyStateToUI(dateStr, info.text, info.variable);
    });
  }
  
  function persistAllRows(user) {
    const key = currentYM();
    const rows = document.querySelectorAll('tbody#rows tr[id^="row-"]');
    const savePromises = [];
    
    const saveBtn = $('save-all');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    rows.forEach(tr => {
      if (tr.id.startsWith('row-')) {
        const ds = tr.id.replace('row-', '');
        
        const date = new Date(key.slice(0, 4), key.slice(5, 7) - 1, ds.slice(8, 10));
        const cfgPromise = getConfig(user.uid);
        
        const ok = $('ok-'+ds);
        const ab = $('ab-'+ds);
        const exb = $('exbtn-'+ds);
        
        if (ok || ab || exb) {
            const st = rowState(ds);
            st.ok = ok.classList.contains('active');
            st.ab = ab.classList.contains('active');
            st.ex = exb.classList.contains('active');
            setRowState(ds, st);
        }
        
        savePromises.push(cfgPromise.then(cfg => {
          const info = habitualForDay((cfg && cfg.scheduleByDay) || {}, date);
          
          return persistState(user, ds, key, info.text, info.variable);
        }));
      }
    });

    return Promise.all(savePromises)
      .then(() => {
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Cambios guardados correctamente.', true);
      })
      .catch(error => {
        console.error('Error al guardar todos los cambios:', error);
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Error al grabar cambios. Revisa la consola.', false);
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Grabar cambios';
        setTimeout(() => { 
            const msg = $('emp-msg'); 
            if (msg) msg.textContent = ''; 
        }, 3000);
      });
  }

  function loadAdminData(user) {
      const db = firebase.firestore();
      const employeeListContainer = $('employee-list-container');
      const scheduleEmployeeList = $('schedule-employee-list');
      const reviewEmployeeList = $('review-employee-list');

      // Limpiar listas anteriores
      if (employeeListContainer) employeeListContainer.innerHTML = '';
      if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '';
      if (reviewEmployeeList) reviewEmployeeList.innerHTML = '';

      // 1. Cargar todos los empleados de la colección employee_config
      db.collection('employee_config').get()
          .then(snapshot => {
              allEmployees = [];
              const fragmentEmpList = document.createDocumentFragment();
              const fragmentScheduleList = document.createDocumentFragment();
              const fragmentReviewList = document.createDocumentFragment();
              
              snapshot.forEach(doc => {
                  const data = doc.data();
                  // Asumir que un empleado es válido si tiene userId y nombre
                  if (data.userId && data.nombre) {
                      allEmployees.push(data);
                      
                      const emailParts = data.email.split('@');
                      const username = emailParts.length > 1 ? `@${emailParts[0]}` : data.email;

                      // Crear item de lista para la pestaña Empleados
                      const itemEmp = document.createElement('div');
                      itemEmp.className = 'admin-col-list-item';
                      itemEmp.setAttribute('data-user-id', data.userId);
                      itemEmp.innerHTML = `${data.nombre || 'Sin Nombre'} <span class="username">${username}</span> <span class="chip" style="background: var(--good);">Activo</span>`;
                      fragmentEmpList.appendChild(itemEmp);
                      
                      // Crear item de lista para la pestaña Horarios
                      const itemSchedule = document.createElement('div');
                      itemSchedule.className = 'admin-col-list-item';
                      itemSchedule.setAttribute('data-user-id', data.userId);
                      itemSchedule.textContent = data.nombre || 'Sin Nombre';
                      itemSchedule.addEventListener('click', () => {
                           selectEmployeeSchedule(data.userId);
                      });
                      fragmentScheduleList.appendChild(itemSchedule);
                      
                      // Crear item de lista para la pestaña Revisión
                      const itemReview = document.createElement('div');
                      itemReview.className = 'admin-col-list-item';
                      itemReview.textContent = data.nombre || 'Sin Nombre';
                      const statusChip = document.createElement('span');
                      statusChip.className = 'chip';
                      statusChip.textContent = 'Pendiente'; 
                      statusChip.style.background = 'var(--bad)'; 
                      itemReview.appendChild(statusChip);
                      fragmentReviewList.appendChild(itemReview);
                  }
              });
              
              if (employeeListContainer) employeeListContainer.appendChild(fragmentEmpList);
              if (scheduleEmployeeList) scheduleEmployeeList.appendChild(fragmentScheduleList);
              if (reviewEmployeeList) reviewEmployeeList.appendChild(fragmentReviewList);
              
              // Inicializar la gestión de horarios después de cargar
              if (allEmployees.length > 0) {
                  selectEmployeeSchedule(allEmployees[0].userId);
              } else {
                  if ($('schedule-config-form')) $('schedule-config-form').innerHTML = '<p class="muted">No hay empleados registrados.</p>';
              }
          })
          .catch(error => {
              console.error("Error cargando lista de empleados:", error);
              if (employeeListContainer) employeeListContainer.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
              if (scheduleEmployeeList) scheduleEmployeeList.innerHTML = '<p class="muted">Error al cargar la lista.</p>';
          });
  }

  function selectEmployeeSchedule(userId) {
      const selectedEmployee = allEmployees.find(emp => emp.userId === userId);
      const listItems = document.querySelectorAll('#schedule-employee-list .admin-col-list-item');
      const formTitle = document.querySelector('#admin-section-horarios .card b');
      const formContainer = $('schedule-config-form');
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const scheduleByDay = (selectedEmployee && selectedEmployee.scheduleByDay) || {};

      // 1. Marcar el empleado seleccionado
      listItems.forEach(item => {
          if (item.getAttribute('data-user-id') === userId) {
              item.classList.add('selected');
          } else {
              item.classList.remove('selected');
          }
      });
      
      if (!selectedEmployee) {
          if (formTitle) formTitle.textContent = 'Horario';
          if (formContainer) formContainer.innerHTML = '<p class="muted">Selecciona un empleado.</p>';
          return;
      }
      
      // 2. Actualizar el título del formulario
      if (formTitle) formTitle.textContent = `Horario de ${selectedEmployee.nombre || selectedEmployee.email}`;
      
      // 3. Renderizar el formulario de horarios
      let formHTML = '';
      
      days.forEach((day, index) => {
          const key = dayKeys[index];
          const schedule = scheduleByDay[key] || {};
          const value = schedule.start && schedule.end ? `${schedule.start}-${schedule.end}` : '';
          
          formHTML += `
              <div class="schedule-day-input">
                  <label>${day}</label>
                  <input type="text" id="schedule-${key}" data-day-key="${key}" placeholder="Ej: 08:00-16:00 o vacío" value="${value}">
              </div>
          `;
      });
      
      formHTML += `<button class="btn" style="width: 100%; margin-top: 15px;" id="save-schedule-btn" data-user-id="${userId}">Guardar Horario</button>`;
      
      if (formContainer) formContainer.innerHTML = formHTML;
      
      // 4. Adjuntar manejador de guardado (implementación pendiente en persistencia)
      if ($('save-schedule-btn')) $('save-schedule-btn').addEventListener('click', () => {
          // Lógica de guardado del horario aquí (se conecta a Firebase)
          console.log(`Guardando horario para el usuario: ${userId}`);
      });
  }


  function paintCurrentUser(){ 
      var u=firebase.auth().currentUser; 
      if(!u) return;
      getRole(u.uid).then(function(role) {
          paintTable(u, role);
      });
  }
  
  // Omitiendo funciones de persistencia y manejo de planilla (buildRow, persistState, etc.)
  // para brevedad, asumiendo que ya tienes la versión más reciente y funcional de ellas.
  // El código completo incluye estas funciones.

  // ... (código de persistState, persistAllRows, paintTable, etc.) ...

  function paintTable(user, role){ 
    $('user-email').textContent = user.email;
    
    if (role === 'employee') {
        buildMonthSelectors();
        var key=currentYM();
        $('employee-view').classList.remove('hidden');
        $('admin-view').classList.add('hidden');
        
        // Carga de la planilla de empleado
        return Promise.all([ getConfig(user.uid), getLock(user.uid, key), monthReports(user.uid, key) ]).then(function(arr){
            // ... (Lógica de carga de planilla omitida) ...
            // Asumiendo que la lógica de la planilla está en la versión completa.
        });
    } else if (role === 'admin') {
        // Si es admin, solo se asegura de que la vista de empleado esté oculta y la de admin esté visible
        $('employee-view').classList.add('hidden');
        $('admin-view').classList.remove('hidden');
        loadEmployeesAndRenderLists(user); // Llama a la función para cargar datos del administrador
    }
  }
  
  // ... (El resto del código como en la versión anterior: persistAllRows, addOrUpdateSingleRow, resetMonth) ...
  
  // === INICIO DE LAS FUNCIONES DE MESA ===

  function addOrUpdateSingleRow(user, dateStr){
    var key=currentYM();
    return Promise.all([ getConfig(user.uid), getOneReport(user.uid, dateStr), getLock(user.uid, key) ]).then(function(arr){
      var cfg=arr[0], report=arr[1], lock=arr[2];
      var date=new Date(dateStr);
      var info=habitualForDay((cfg&&cfg.scheduleByDay)||{}, date);
      
      var existingTr=$('row-'+dateStr); 
      if(existingTr){ 
        if(existingTr.nextSibling && existingTr.nextSibling.id==='sub-'+dateStr) existingTr.nextSibling.remove(); 
        existingTr.remove(); 
      }
      
      var built=buildRow(dateStr, date, info.text, info.variable, lock.locked, report, info.skip && report && report.tipoReporte==='EXTRA');
      var rows=$('rows'); var days=rows.querySelectorAll('tr[id^="row-"]');
      var inserted=false;
      for(var i=0;i<days.length;i++){ var ds=days[i].id.replace('row-',''); if(ds>dateStr){ 
        rows.insertBefore(built[0], days[i]); 
        rows.insertBefore(built[1], days[i]); 
        inserted=true; break; 
      } }
      if(!inserted){ 
        rows.appendChild(built[0]); 
        rows.appendChild(built[1]); 
      }
      applyStateToUI(dateStr, info.text, info.variable);
    });
  }
  
  function persistAllRows(user) {
    const key = currentYM();
    const rows = document.querySelectorAll('tbody#rows tr[id^="row-"]');
    const savePromises = [];
    
    const saveBtn = $('save-all');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    rows.forEach(tr => {
      if (tr.id.startsWith('row-')) {
        const ds = tr.id.replace('row-', '');
        
        const date = new Date(key.slice(0, 4), key.slice(5, 7) - 1, ds.slice(8, 10));
        const cfgPromise = getConfig(user.uid);
        
        const ok = $('ok-'+ds);
        const ab = $('ab-'+ds);
        const exb = $('exbtn-'+ds);
        
        if (ok || ab || exb) {
            const st = rowState(ds);
            st.ok = ok.classList.contains('active');
            st.ab = ab.classList.contains('active');
            st.ex = exb.classList.contains('active');
            setRowState(ds, st);
        }
        
        savePromises.push(cfgPromise.then(cfg => {
          const info = habitualForDay((cfg && cfg.scheduleByDay) || {}, date);
          
          return persistState(user, ds, key, info.text, info.variable);
        }));
      }
    });

    return Promise.all(savePromises)
      .then(() => {
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Cambios guardados correctamente.', true);
      })
      .catch(error => {
        console.error('Error al guardar todos los cambios:', error);
        const msg = $('emp-msg');
        if (msg) setMsg(msg, 'Error al grabar cambios. Revisa la consola.', false);
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Grabar cambios';
        setTimeout(() => { 
            const msg = $('emp-msg'); 
            if (msg) msg.textContent = ''; 
        }, 3000);
      });
  }

  function resetMonth(user){
    var key=currentYM(); var db=firebase.firestore();
    return db.collection('timesheets').where('userId','==',user.uid).where('mesAnio','==',key).get()
      .then(function(snap){
        var batch=db.batch(); snap.forEach(function(d){ batch.delete(d.ref); });
        return batch.commit();
      })
      .then(function(){ return db.collection('locks').doc(user.uid+'_'+key).delete().catch(function(){}); })
      .then(function(){ $('last-update').textContent=new Date().toLocaleString(); paintCurrentUser(); });
  }

  $('submit-month').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    var key=currentYM();
    setLock(u.uid,key,true).then(function(){ return getLock(u.uid,key); }).then(function(lk){
      $('lock-state').textContent = lk.locked? 'Bloqueado':'Editable';
      $('last-update').textContent = lk.lastSubmitted? new Date(lk.lastSubmitted.toDate()).toLocaleString() : '—';
      $('submit-month').disabled = lk.locked; $('reset-month').disabled = lk.locked;
    });
  });
  $('reset-month').addEventListener('click', function(){
    var u=firebase.auth().currentUser; if(!u) return;
    if(!confirm('¿Resetear la planilla del mes actual? Esto borra los registros del mes.')) return;
    resetMonth(u);
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
  $('logout-btn').addEventListener('click', function(){ 
      firebase.auth().signOut(); 
      // Borrar LocalStorage al salir para forzar una nueva lectura de rol
      if (firebase.auth().currentUser) {
          localStorage.removeItem('userRole_' + firebase.auth().currentUser.uid);
      }
  });
  
  // Se eliminan los event listeners 'to-employee' y 'to-admin' ya que se eliminó el switch en HTML

  function onMonthChange(){ paintCurrentUser(); }
  $('sel-month').addEventListener('change', onMonthChange);
  $('sel-year').addEventListener('change', onMonthChange);

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      $('auth-card').classList.remove('hidden'); $('app-card').classList.add('hidden');
      $('user-email').textContent='—'; $('role-display').classList.add('hidden'); return;
    }
    $('auth-card').classList.add('hidden'); $('app-card').classList.remove('hidden');
    $('user-email').textContent=user.email;

    getRole(user.uid).then(function(role){
      $('role-chip').textContent=role.toUpperCase();
      $('role-display').classList.remove('hidden');

      if(role==='admin'){
        $('employee-view').classList.add('hidden'); 
        $('admin-view').classList.remove('hidden');
      }else{
        $('employee-view').classList.remove('hidden');
        $('admin-view').classList.add('hidden');
      }
      paintTable(user, role); 
    });
  });

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