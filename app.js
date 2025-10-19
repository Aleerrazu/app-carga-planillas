const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

function $(id) { return document.getElementById(id); }

$("login-btn").addEventListener("click", () => {
  const email = $("email").value;
  const password = $("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .catch(e => alert(e.message));
});

auth.onAuthStateChanged(async user => {
  if (!user) {
    $("login-view").classList.remove("hidden");
    $("employee-view").classList.add("hidden");
    $("admin-view").classList.add("hidden");
    return;
  }

  $("login-view").classList.add("hidden");
  const role = await getRole(user.uid);

  if (role === 'admin') {
    // ✅ ADMIN VE AMBOS PANELES
    $("employee-view").classList.remove("hidden");
    $("admin-view").classList.remove("hidden");
    loadEmployees();
  } else {
    // EMPLEADO NORMAL
    $("employee-view").classList.remove("hidden");
    $("admin-view").classList.add("hidden");
  }
});

function getRole(uid) {
  return db.collection('roles').doc(uid).get().then(doc => {
    if (doc.exists) return doc.data().role;
    return 'employee';
  }).catch(() => 'employee');
}

function loadEmployees() {
  db.collection('roles').get().then(snapshot => {
    const container = $("employee-list");
    container.innerHTML = "<h3>Lista de empleados:</h3>";
    snapshot.forEach(doc => {
      const data = doc.data();
      container.innerHTML += `<div>UID: ${doc.id} — Rol: ${data.role}</div>`;
    });
  });
}
