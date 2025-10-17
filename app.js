const firebaseConfig = {
  apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
  authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
  projectId: "controlhorarioapp-6a9c7",
  storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
  messagingSenderId: "447263250565",
  appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
};

// ---------------------------------------------

// Inicializa Firebase y Servicios
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Inicialización de Firestore

// Referencias a elementos del DOM
const messageEl = document.getElementById('message');
const authView = document.getElementById('auth-view');
const privateView = document.getElementById('private-view');
const userEmailEl = document.getElementById('user-email');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const planillasTbody = document.getElementById('planillas-tbody'); // Cuerpo de la tabla
const totalValueEl = document.getElementById('total-value');     // Valor total
const noDataMsg = document.getElementById('no-data-msg');         // Mensaje sin datos


// =======================================================
// === FUNCIONES DE INTERFAZ Y UTILIDADES ================
// =======================================================

function showMessage(msg, isError = true) {
    messageEl.textContent = msg;
    messageEl.style.color = isError ? 'red' : 'green';
}

function showLogin() {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    messageEl.textContent = '';
}

function showRegister() {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    messageEl.textContent = '';
}


// =======================================================
// === LÓGICA DE AUTENTICACIÓN (LOGIN/LOGOUT) ============
// =======================================================

function registerUser() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            showMessage("✅ Registro exitoso.", false);
        })
        .catch((error) => {
            showMessage(`Error de Registro: ${error.message}`);
        });
}

function loginUser() {
    const email = document.getElementById('log-email').value;
    const password = document.getElementById('log-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            showMessage("✅ Inicio de sesión exitoso.", false);
        })
        .catch((error) => {
            showMessage(`Error de Login: ${error.message}`);
        });
}

function logoutUser() {
    auth.signOut()
        .then(() => {
            showMessage("Sesión cerrada. Vuelve pronto.", false);
        })
        .catch((error) => {
            showMessage(`Error al cerrar sesión: ${error.message}`);
        });
}


// =======================================================
// === LÓGICA DE FIRESTORE (GUARDAR Y LEER DATOS) ========
// =======================================================

function savePlanilla() {
    const title = document.getElementById('planilla-title').value;
    const value = parseFloat(document.getElementById('planilla-value').value);
    const date = document.getElementById('planilla-date').value;
    const userUID = auth.currentUser.uid; 

    if (!title || isNaN(value) || !date) {
        showMessage("Por favor, completa todos los campos con valores válidos.", true);
        return;
    }

    const planillaData = {
        title: title,
        value: value,
        date: date,
        userId: userUID, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("planillas").add(planillaData)
        .then(() => {
            showMessage("✅ Planilla guardada con éxito.", false);
            // Limpiar formulario
            document.getElementById('planilla-title').value = '';
            document.getElementById('planilla-value').value = '';
            document.getElementById('planilla-date').value = '';
            
            // Recargar la lista de datos
            loadPlanillas(userUID); 
        })
        .catch((error) => {
            showMessage(`Error al guardar: ${error.message}`, true);
        });
}

// FUNCIÓN CLAVE: Leer los datos del usuario actual desde Firestore
function loadPlanillas(userId) {
    // 1. Ocultar la tabla y mostrar mensaje de carga
    planillasTbody.innerHTML = '';
    noDataMsg.textContent = 'Cargando datos...';
    noDataMsg.classList.remove('hidden');

    let total = 0;
    
    // 2. Consulta a Firestore: trae todos los documentos donde userId coincida
    db.collection("planillas")
      .where("userId", "==", userId)
      .orderBy("date", "desc") // Ordena por fecha más reciente primero
      .get()
      .then((querySnapshot) => {
          
          if (querySnapshot.empty) {
              noDataMsg.textContent = 'No hay planillas cargadas.';
              totalValueEl.textContent = '0';
              return;
          }

          noDataMsg.classList.add('hidden');
          
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              total += data.value;
              
              // 3. Crea la fila de la tabla (Mobile-First)
              const row = planillasTbody.insertRow();
              
              const titleCell = row.insertCell(0);
              titleCell.textContent = data.title;
              
              const valueCell = row.insertCell(1);
              // Formatea el valor como moneda
              valueCell.textContent = `$${data.value.toLocaleString('es-AR')}`; 
              
              const dateCell = row.insertCell(2);
              dateCell.textContent = data.date; // La fecha ya viene formateada por el input
          });
          
          // 4. Actualiza el total acumulado
          totalValueEl.textContent = `$${total.toLocaleString('es-AR')}`;
      })
      .catch((error) => {
          console.error("Error al cargar planillas: ", error);
          noDataMsg.textContent = 'Error al cargar los datos.';
      });
}


// =======================================================
// === OBSERVADOR DE ESTADO (Maneja las Vistas) ==========
// =======================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario logueado: Muestra la vista privada
        authView.classList.add('hidden');
        privateView.classList.remove('hidden');
        userEmailEl.textContent = user.email;
        loadPlanillas(user.uid); // <-- CARGA LOS DATOS AL INICIAR SESIÓN
        showMessage('');
    } else {
        // Usuario no logueado: Muestra la vista de autenticación
        authView.classList.remove('hidden');
        privateView.classList.add('hidden');
        showRegister();
    }
});