const firebaseConfig = {
  apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
  authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
  projectId: "controlhorarioapp-6a9c7",
  storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
  messagingSenderId: "447263250565",
  appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
};

// ---------------------------------------------

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Referencias a los elementos del DOM
const messageEl = document.getElementById('message');
const authView = document.getElementById('auth-view');
const privateView = document.getElementById('private-view');
const userEmailEl = document.getElementById('user-email');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// --- Funciones de Interfaz ---

function showMessage(msg, isError = true) {
    messageEl.textContent = msg;
    messageEl.style.color = isError ? 'red' : 'green';
}

function showLogin() {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    messageEl.textContent = ''; // Limpiar mensajes
}

function showRegister() {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    messageEl.textContent = ''; // Limpiar mensajes
}

// --- Funciones de Firebase (Lógica Principal) ---

// 1. Registro de Usuario
function registerUser() {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            showMessage("✅ ¡Registro exitoso! Iniciando sesión...", false);
            // La función onAuthStateChanged se encargará de mostrar la vista privada
        })
        .catch((error) => {
            // Muestra errores como "Contraseña débil" o "Email ya en uso"
            showMessage(`Error de Registro: ${error.message}`);
        });
}

// 2. Inicio de Sesión
function loginUser() {
    const email = document.getElementById('log-email').value;
    const password = document.getElementById('log-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            showMessage("✅ ¡Inicio de sesión exitoso!", false);
            // La función onAuthStateChanged se encargará de mostrar la vista privada
        })
        .catch((error) => {
            // Muestra errores como "Usuario no encontrado" o "Contraseña incorrecta"
            showMessage(`Error de Login: ${error.message}`);
        });
}

// 3. Cerrar Sesión
function logoutUser() {
    auth.signOut()
        .then(() => {
            showMessage("Sesión cerrada. Vuelve pronto.", false);
        })
        .catch((error) => {
            showMessage(`Error al cerrar sesión: ${error.message}`);
        });
}

// 4. Observador de Estado de Autenticación (Maneja las vistas)
auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario logueado: Muestra la vista privada
        authView.classList.add('hidden');
        privateView.classList.remove('hidden');
        userEmailEl.textContent = user.email;
        showMessage(''); // Limpia el mensaje
    } else {
        // Usuario no logueado: Muestra la vista de autenticación (Login/Registro)
        authView.classList.remove('hidden');
        privateView.classList.add('hidden');
        showRegister(); // Por defecto, muestra la vista de registro
    }
});