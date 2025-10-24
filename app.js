// app.js
(function () {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const show = (id) => { const n = $(id); if (n) n.classList.remove("hidden"); };
  const hide = (id) => { const n = $(id); if (n) n.classList.add("hidden"); };

  // Lista en memoria (disponible para otras funciones)
  var allEmployees = [];

  // ---------- Firebase Init ----------
  // Usa tu config actual. Si ya la tenés en index.html, podés omitir esto.
  // Asegurate de que el projectId coincida con el proyecto donde están los datos.
  const firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyA5qUzLq-2w1FJPvMv2gQXHh4gJrGzNwb4",
    authDomain: "control-horario-app.firebaseapp.com",
    projectId: "control-horario-app",
    storageBucket: "control-horario-app.appspot.com",
    messagingSenderId: "711458586381",
    appId: "1:711458586381:web:91f0cfbc5096500df34a4d",
  };
  try {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Error inicializando Firebase:", e);
  }

  // ---------- Auth UI ----------
  const googleLoginBtn = $("google-login");
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider).then((res) => {
        checkUserRole(res.user);
      }).catch(err => {
        console.error("Login error:", err);
        alert("No se pudo iniciar sesión.");
      });
    });
  }

  const logoutBtn = $("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut().finally(() => {
        hide("admin-panel");
        hide("employee-panel");
        show("login-screen");
      });
    });
  }

  // ---------- Reglas de visibilidad según rol ----------
  async function checkUserRole(user) {
    try {
      if (!user) {
        hide("admin-panel"); hide("employee-panel"); show("login-screen");
        return;
      }
      hide("login-screen");

      const db = firebase.firestore();

      // Intentamos encontrar su doc en employee_config por UID
      const myDoc = await db.collection("employee_config").doc(user.uid).get();
      const isAdmin = myDoc.exists && (myDoc.data().role === "admin");

      if (isAdmin) {
        show("admin-panel");
        // Chip ADMIN si existe
        const badge = $("role-badge");
        if (badge) badge.textContent = "ADMIN";
        // Carga la lista
        loadEmployeesAndRenderLists(user);
      } else {
        show("employee-panel");
        const badge = $("role-badge");
        if (badge) badge.textContent = "EMPLEADO";
        loadEmployeeSchedule(user);
      }
    } catch (e) {
      console.error("Error determinando rol:", e);
      alert("No se pudo verificar el rol del usuario.");
      show("login-screen");
    }
  }

  // ---------- Admin: cargar lista de empleados ----------
  function loadEmployeesAndRenderLists(user) {
    const db = firebase.firestore();

    const employeeListContainer = $("employee-list-container");
    const scheduleEmployeeList  = $("schedule-employee-list");
    const reviewEmployeeList    = $("review-employee-list");

    if (employeeListContainer) employeeListContainer.innerHTML = "";
    if (scheduleEmployeeList)  scheduleEmployeeList.innerHTML  = "";
    if (reviewEmployeeList)    reviewEmployeeList.innerHTML    = "";

    db.collection("employee_config").get()
      .then(snapshot => {
        allEmployees = [];

        if (snapshot.empty) {
          if (employeeListContainer)
            employeeListContainer.innerHTML = "<p class='muted'>No hay empleados visibles para este usuario.</p>";
          return;
        }

        const fragEmp     = document.createDocumentFragment();
        const fragSched   = document.createDocumentFragment();
        const fragReview  = document.createDocumentFragment();

        snapshot.forEach(doc => {
          const raw = doc.data() || {};
          // Fallbacks seguros
          const userId = raw.userId || doc.id;
          const email  = (typeof raw.email === "string") ? raw.email : "";
          const nombre = (raw.nombre && String(raw.nombre).trim()) || email || "Sin Nombre";
          const username = email ? `@${email.split("@")[0]}` : "";

          const emp = { ...raw, userId, email, nombre };
          allEmployees.push(emp);

          // Columna: Lista de Empleados
          const itemEmp = document.createElement("div");
          itemEmp.className = "admin-col-list-item";
          itemEmp.setAttribute("data-user-id", userId);
          itemEmp.innerHTML = `
            ${nombre} ${username ? `<span class="username">${username}</span>` : ""}
            <span class="chip" style="background: var(--good);">Activo</span>
          `;
          fragEmp.appendChild(itemEmp);

          // Columna: Seleccionar Empleado (Horarios)
          const itemSch = document.createElement("div");
          itemSch.className = "admin-col-list-item";
          itemSch.setAttribute("data-user-id", userId);
          itemSch.textContent = nombre;
          itemSch.addEventListener("click", () => selectEmployeeSchedule(userId));
          fragSched.appendChild(itemSch);

          // Columna: Revisión de Planillas (placeholder)
          const itemRev = document.createElement("div");
          itemRev.className = "admin-col-list-item";
          itemRev.textContent = nombre;
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = "Pendiente";
          chip.style.background = "var(--bad)";
          itemRev.appendChild(chip);
          fragReview.appendChild(itemRev);
        });

        if (employeeListContainer) employeeListContainer.appendChild(fragEmp);
        if (scheduleEmployeeList)  scheduleEmployeeList.appendChild(fragSched);
        if (reviewEmployeeList)    reviewEmployeeList.appendChild(fragReview);

        // Selecciona primero por defecto
        if (allEmployees.length && allEmployees[0].userId) {
          selectEmployeeSchedule(allEmployees[0].userId);
        }
      })
      .catch(err => {
        console.error("Error cargando empleados:", err);
        if (employeeListContainer)
          employeeListContainer.innerHTML = "<p class='muted'>Error al cargar la lista (ver consola).</p>";
      });
  }

  // ---------- Admin: seleccionar empleado para editar horarios ----------
  function selectEmployeeSchedule(userId) {
    const selected = allEmployees.find(e => e.userId === userId);
    const formTitle = $("selected-employee-name");
    if (formTitle) {
      formTitle.textContent = `Horario de ${selected ? (selected.nombre || selected.email || "Empleado") : "Empleado"}`;
    }

    const form = $("schedule-config-form");
    if (form) {
      form.innerHTML = `
        <p class="muted">Cargar o editar los horarios base de este empleado.</p>
        <button id="save-schedule" class="btn">Guardar cambios</button>
      `;
      const btn = $("save-schedule");
      if (btn) {
        btn.addEventListener("click", async () => {
          alert("Guardado (demo). Si querés, lo conectamos a Firestore en un paso más.");
        });
      }
    }
  }

  // ---------- Empleado: ver su propio horario ----------
  function loadEmployeeSchedule(user) {
    const db = firebase.firestore();
    const box = $("employee-schedule");

    db.collection("employee_config").doc(user.uid).get()
      .then(doc => {
        const data = doc.data() || {};
        if (box) {
          box.innerHTML = `
            <p>Hola ${user.displayName || "empleado"}, este es tu horario actual:</p>
            <pre>${JSON.stringify(data.horario || data.scheduleByDay || {}, null, 2)}</pre>
          `;
        }
      })
      .catch(err => {
        console.error("Error cargando horario del empleado:", err);
        if (box) box.innerHTML = "<p class='muted'>No se pudo cargar tu horario.</p>";
      });
  }

  // ---------- Observador de sesión ----------
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      checkUserRole(user);
    } else {
      hide("admin-panel");
      hide("employee-panel");
      show("login-screen");
    }
  });

  // ---------- Exportar funciones a global (para otros scripts como paintTable) ----------
  window.loadEmployeesAndRenderLists = loadEmployeesAndRenderLists;
  window.selectEmployeeSchedule     = selectEmployeeSchedule;
  window.checkUserRole              = checkUserRole;

})();
