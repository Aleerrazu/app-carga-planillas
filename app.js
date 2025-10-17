const firebaseConfig = {
  apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
  authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
  projectId: "controlhorarioapp-6a9c7",
  storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
  messagingSenderId: "447263250565",
  appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
};

// ---------------------------------------------

// =======================================================
// === INICIALIZACIÓN Y REFERENCIAS ======================
// =======================================================

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Referencias del DOM
const messageEl = document.getElementById('message');
const authView = document.getElementById('auth-view');
const privateView = document.getElementById('private-view');
const employeeNameEl = document.getElementById('employee-name');
const horarioHabitualDisplayEl = document.getElementById('horario-habitual-display');
const extraHoursSectionEl = document.getElementById('extra-hours-section');
const horarioReportadoEl = document.getElementById('horario-reportado');
const adminViewEl = document.getElementById('admin-view');

// ID de usuario Administrador (DEBES REEMPLAZAR ESTO CON TU PROPIO UID)
const ADMIN_UID = "REEMPLAZA_ESTO_CON_TU_UID_DE_ADMIN"; 


// =======================================================
// === FUNCIONES DE INTERFAZ Y AUTENTICACIÓN (Inicio/Registro) ===
// =======================================================

function showMessage(msg, isError = true) {
    messageEl.textContent = msg;
    messageEl.style.color = isError ? 'red' : 'green';
}

function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    messageEl.textContent = '';
}

function showRegister() {
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
    messageEl.textContent = '';
}

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
// === FUNCIÓN DE CARGA DE DATOS DEL EMPLEADO ============
// =======================================================

function loadEmployeeConfig(user) {
    // 1. Cargar datos de configuración (Nombre y Horario Habitual)
    db.collection("employee_config").where("userId", "==", user.uid).get()
        .then(snapshot => {
            if (snapshot.empty) {
                employeeNameEl.textContent = 'Usuario sin configurar';
                horarioHabitualDisplayEl.textContent = 'Horario no asignado. Contacte a RRHH.';
                showMessage('⚠️ Tu usuario aún no está configurado por el administrador.', true);
                return;
            }
            const config = snapshot.docs[0].data();
            employeeNameEl.textContent = config.nombre;
            horarioHabitualDisplayEl.textContent = config.horarioHabitual;

            // 2. Mostrar la sección de administrador si el UID coincide
            if (user.uid === ADMIN_UID) {
                adminViewEl.classList.remove('hidden');
            } else {
                adminViewEl.classList.add('hidden');
            }
        })
        .catch(error => {
            console.error("Error al cargar config: ", error);
            showMessage('Error al cargar la configuración del empleado.', true);
        });
}


// =======================================================
// === LÓGICA DE INTERFAZ Y REPORTE ======================
// =======================================================

// Escucha los cambios en los radio buttons para mostrar/ocultar el campo de detalle
function handleReportTypeChange() {
    const selectedType = document.querySelector('input[name="report_type"]:checked').value;
    if (selectedType === 'EXTRA' || selectedType === 'FALTA') {
        extraHoursSectionEl.classList.remove('hidden');
        horarioReportadoEl.placeholder = (selectedType === 'EXTRA') 
            ? "Ej: 08:00 a 19:00 (o 3 horas extra)" 
            : "Ej: Ausencia médica, Salí a las 15:00, etc.";
    } else {
        extraHoursSectionEl.classList.add('hidden');
    }
}


function saveTimeSheet() {
    const reportDate = document.getElementById('report-date').value;
    const reportType = document.querySelector('input[name="report_type"]:checked').value;
    const comentarios = document.getElementById('comentarios').value;
    const horarioReportado = (reportType === 'EXTRA' || reportType === 'FALTA') 
                             ? horarioReportadoEl.value 
                             : '';
    const userUID = auth.currentUser.uid;
    
    // Generar la clave de mes y año para agrupar (Ej: 2025-10)
    const monthYear = reportDate.substring(0, 7); 
    
    if (!reportDate) {
        showMessage("Por favor, selecciona la fecha del reporte.", true);
        return;
    }
    if ((reportType === 'EXTRA' || reportType === 'FALTA') && !horarioReportado) {
        showMessage("Por favor, detalla las horas/motivo en la sección Detalle de Horas/Diferentes.", true);
        return;
    }

    const reportData = {
        userId: userUID,
        email: auth.currentUser.email,
        nombre: employeeNameEl.textContent, // Se toma el nombre cargado desde la config
        mesAnio: monthYear,
        fecha: reportDate,
        tipoReporte: reportType,
        horarioReportado: horarioReportado,
        comentarios: comentarios,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Comprobar si ya existe un reporte para esa fecha
    db.collection("timesheets")
        .where("userId", "==", userUID)
        .where("fecha", "==", reportDate)
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                showMessage(`Ya existe un reporte para el ${reportDate}. Borra el anterior si deseas cambiarlo.`, true);
                return;
            }
            
            // Si no existe, guardar el nuevo reporte
            db.collection("timesheets").add(reportData)
                .then(() => {
                    showMessage("✅ Reporte diario guardado con éxito.", false);
                    // Limpiar campos
                    document.getElementById('comentarios').value = '';
                    horarioReportadoEl.value = '';
                })
                .catch((error) => {
                    showMessage(`Error al guardar: ${error.message}`, true);
                });
        });
}

// =======================================================
// === FUNCIÓN DE ADMINISTRACIÓN: EXPORTAR A CSV (EXCEL) =
// =======================================================

function exportToCsv() {
    showMessage("Cargando todos los reportes, espera un momento...", false);
    
    db.collection("timesheets").get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                showMessage("No hay datos para exportar.", true);
                return;
            }
            
            let csvContent = "data:text/csv;charset=utf-8,";
            
            // 1. Encabezados (Headers)
            const headers = ['Nombre', 'Email', 'Fecha', 'Mes_Anio', 'Tipo_Reporte', 'Detalle_Horario', 'Comentarios', 'ID_Empleado'];
            csvContent += headers.join(";") + "\n"; // Usamos ; como separador para Excel
            
            // 2. Datos
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                // Extraer los campos en el orden de los headers, manejando valores nulos
                const row = [
                    data.nombre || '',
                    data.email || '',
                    data.fecha || '',
                    data.mesAnio || '',
                    data.tipoReporte || '',
                    (data.horarioReportado || '').replace(/[,;]/g, ' '), // Limpiar comas/puntos y comas
                    (data.comentarios || '').replace(/[,;]/g, ' '),
                    data.userId || ''
                ];
                
                csvContent += row.join(";") + "\n";
            });

            // 3. Crear y descargar el archivo CSV
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Reporte_Horas_Total_${new Date().toISOString().substring(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showMessage("✅ Exportación completa. Revisa tu carpeta de descargas.", false);
        })
        .catch(error => {
            showMessage(`Error al exportar: ${error.message}`, true);
            console.error("Error al exportar a CSV: ", error);
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
        
        // Cargar configuración del empleado al iniciar sesión
        loadEmployeeConfig(user); 
        
        // Ejecutar la lógica de interfaz inicial (muestra/oculta el campo de detalle)
        // Esto inicializa el listener para los radio buttons
        // handleReportTypeChange(); // No es necesario llamar aquí, se llama por el DOMContentLoaded implícito.

        showMessage('');
    } else {
        // Usuario no logueado: Muestra la vista de autenticación
        authView.classList.remove('hidden');
        privateView.classList.add('hidden');
        // Aseguramos que solo muestre login/registro
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    }
});
