// Build: minimal login hotfix + version tag
(function(){
  // Firebase init
  var firebaseConfig = {
    apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
    authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
    projectId: "controlhorarioapp-6a9c7",
    storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
    messagingSenderId: "447263250565",
    appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
  };
  if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }

  var $ = function(id){ return document.getElementById(id); };
  function setMsg(el, txt, ok){ if(!el) return; el.textContent = txt; el.style.color = ok ? '#86efac' : '#fecaca'; }

  // Hook auth state
  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      $('auth-card').classList.remove('hidden');
      $('app-card').classList.add('hidden');
      $('user-email').textContent = '—';
      return;
    }
    $('auth-card').classList.add('hidden');
    $('app-card').classList.remove('hidden');
    $('user-email').textContent = user.email;
  });

  // Buttons
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

  // Expose login (redundant con inline fallback)
  window.doLogin = function(){
    var btn=$('login-btn'); var msg=$('auth-msg');
    btn.disabled=true; btn.textContent='Ingresando...';
    firebase.auth().signInWithEmailAndPassword($('email').value, $('password').value)
      .then(function(){ setMsg(msg,'Ingreso correcto',true); })
      .catch(function(e){ setMsg(msg, e.message); })
      .finally(function(){ btn.disabled=false; btn.textContent='Entrar'; });
  };
})();