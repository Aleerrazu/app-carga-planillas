// ======= Firebase config (igual que el tuyo) =======
const firebaseConfig = {
  apiKey: "AIzaSyBSPrLiI-qTIEmAfQ5UCtWllHKaTX-VH5Q",
  authDomain: "controlhorarioapp-6a9c7.firebaseapp.com",
  projectId: "controlhorarioapp-6a9c7",
  storageBucket: "controlhorarioapp-6a9c7.firebasestorage.app",
  messagingSenderId: "447263250565",
  appId: "1:447263250565:web:6704994cbfbfe7c98b31ec"
};

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
const adminViewEl = document.getElementById('admin-view');
const timesheetBodyEl = document.getElementById('timesheet-body');
const extraDayFormEl = document.getElementById('extra-day-form');
const employeeListBodyEl = document.getElementById('employee-list-body');
const employeeManagementViewEl = document.getElementById('employee-management-view');
const adminActionMessageEl = document.getElementById('admin-action-message');

// Estado global
let employeeConfig = null;
const currentMonth = new Date().toISOString().substring(0, 7); // Ej: 2025-10
document.getElementById('current-month-display').textContent = currentMonth;

// ⚠️ COMPLETAR CON TU UID REAL DE ADMIN (después de loguearte, mirá la consola)
const ADMIN_UID = "REEMPLAZA_ESTO_CON_TU_UID_DE_ADMIN";

// =======================================================
// === UI helpers / Auth (Login/Registro) ================
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
    .then(() => showMessage("✅ Registro exitoso.", false))
    .catch((error) => showMessage(`Error de Registro: ${error.message}`));
}
function loginUser() {
  const email = document.getElementById('log-email').value;
  const password = document.getElementById('log-password').value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => showMessage("✅ Inicio de sesión exitoso.", false))
    .catch((error) => showMessage(`Error de Login: ${error.message}`));
}
function logoutUser() {
  auth.signOut()
    .then(() => showMessage("Sesión cerrada. Vuelve pronto.", false))
    .catch((error) => showMessage(`Error al cerrar sesión: ${error.message}`));
}

// =======================================================
// === ADMIN (gestión) ===================================
// =======================================================
function showEmployeeManagement() {
  employeeManagementViewEl.classList.toggle('hidden');
  if (!employeeManagementViewEl.classList.contains('hidden')) {
    loadEmployeeList();
  }
}
function loadEmployeeList() {
  document.getElementById('loading-employees-msg').textContent = 'Cargando listado...';
  employeeListBodyEl.innerHTML = '';
  db.collection("employee_config").get().then(snapshot => {
    document.getElementById('loading-employees-msg').classList.add('hidden');
    if (snapshot.empty) {
      employeeListBodyEl.innerHTML = '<tr><td colspan="4">No hay empleados configurados.</td></tr>';
      return;
    }
    snapshot.forEach(doc => {
      const data = doc.data();
      const row = employeeListBodyEl.insertRow();
      row.innerHTML = `
        <td>${data.nombre}</td>
        <td>${data.email}</td>
        <td>${data.horarioHabitual}</td>
        <td>
          <button class="action-button btn-plus" onclick="viewEmployeeReport('${data.userId}', '${data.nombre}')" style="background-color:#6f42c1;">🔎</button>
        </td>
      `;
    });
  });
}
async function adminCreateOrUpdateEmployee() {
  const email = document.getElementById('admin-employee-email').value;
  const name = document.getElementById('admin-employee-name').value;
  const schedule = document.getElementById('admin-employee-schedule').value;
  if (!email || !schedule) {
    adminActionMessageEl.style.color = 'red';
    adminActionMessageEl.textContent = 'El Email y Horario son obligatorios.';
    return;
  }
  try {
    const snapshot = await db.collection("employee_config").where("email", "==", email).get();
    if (snapshot.empty) {
      if (!name) {
        adminActionMessageEl.style.color = 'red';
        adminActionMessageEl.textContent = 'Nombre es obligatorio para crear un nuevo registro.';
        return;
      }
      adminActionMessageEl.style.color = 'orange';
      adminActionMessageEl.textContent = 'AVISO: Primero el empleado debe registrarse. Crea el registro en config manualmente usando su UID.';
    } else {
      const docRef = snapshot.docs[0].ref;
      await docRef.update({
        nombre: name || snapshot.docs[0].data().nombre,
        horarioHabitual: schedule
      });
      adminActionMessageEl.style.color = 'green';
      adminActionMessageEl.textContent = `Configuración de ${name || snapshot.docs[0].data().nombre} actualizada.`;
      loadEmployeeList();
    }
  } catch (error) {
    console.error(error);
    adminActionMessageEl.style.color = 'red';
    adminActionMessageEl.textContent = 'Error: No se pudo actualizar. Revisa la consola.';
  }
}
async function adminResetPassword() {
  const email = document.getElementById('admin-employee-email').value;
  if (!email) {
    adminActionMessageEl.style.color = 'red';
    adminActionMessageEl.textContent = 'Introduce un email para blanquear la contraseña.';
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    adminActionMessageEl.style.color = 'green';
    adminActionMessageEl.textContent = `✅ Email de blanqueo enviado a ${email}.`;
  } catch (error) {
    adminActionMessageEl.style.color = 'red';
    adminActionMessageEl.textContent = `Error al blanquear: ${error.message}. Asegúrate de que el email esté registrado.`;
  }
}
function exportToCsv() {
  showMessage("Cargando todos los reportes, espera un momento...", false);
  db.collection("timesheets").get()
    .then((querySnapshot) => {
      if (querySnapshot.empty) {
        showMessage("No hay datos para exportar.", true);
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,";
      const headers = ['Nombre', 'Email', 'Fecha', 'Mes_Anio', 'Tipo_Reporte', 'Detalle_Horario', 'Comentarios', 'ID_Empleado'];
      csvContent += headers.join(";") + "\n";
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = [
          data.nombre || '',
          data.email || '',
          data.fecha || '',
          data.mesAnio || '',
          data.tipoReporte || '',
          (data.horarioReportado || '').replace(/[,;]/g, ' '),
          (data.comentarios || '').replace(/[,;]/g, ' '),
          data.userId || ''
        ];
        csvContent += row.join(";") + "\n";
      });
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
function viewEmployeeReport(userId, employeeName) {
  if (confirm(`¿Estás seguro que quieres ver los reportes de ${employeeName}? Se listarán en la consola del navegador.`)) {
    db.collection("timesheets").where("userId", "==", userId).get().then(snapshot => {
      console.log(`--- REPORTES MENSUALES DE ${employeeName.toUpperCase()} ---`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`[${data.fecha}] Tipo: ${data.tipoReporte}, Detalle: ${data.horarioReportado}, Comentarios: ${data.comentarios}`);
      });
      console.log('--- FIN DEL REPORTE ---');
      adminActionMessageEl.style.color = 'green';
      adminActionMessageEl.textContent = `Reportes de ${employeeName} listados en la consola.`;
    }).catch(e => console.error("Error al ver reportes:", e));
  }
}

// =======================================================
// === EMPLEADO (reporte mensual) ========================
// =======================================================
function showExtraDayForm() {
  extraDayFormEl.classList.toggle('hidden');
  document.getElementById('extra-report-date').value = '';
  document.getElementById('extra-horario-reportado').value = '';
  document.getElementById('extra-comentarios').value = '';
}
async function loadMonthlyReport(userId, habitualSchedule) {
  timesheetBodyEl.innerHTML = '';
  document.getElementById('loading-report-msg').classList.remove('hidden');
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().substring(0, 10);
  const startOfMonth = new Date(year, month, 1).toISOString().substring(0, 10);
  const endOfMonth = new Date(year, month + 1, 0).toISOString().substring(0, 10);
  const reportData = {};
  const snapshot = await db.collection("timesheets")
    .where("userId", "==", userId)
    .where("fecha", ">=", startOfMonth)
    .where("fecha", "<=", endOfMonth)
    .get();
  snapshot.forEach(doc => {
    const data = doc.data();
    reportData[data.fecha] = data;
  });
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toISOString().substring(0, 10);
    const dayOfWeek = date.toLocaleDateString('es-ES', { weekday: 'short' });
    const isPast = dateString < today;
    const hasReport = reportData[dateString];
    const row = timesheetBodyEl.insertRow();
    row.innerHTML = `
      <td style="font-weight: bold; background-color: ${isPast ? '#f8f9fa' : 'white'};">${dateString.substring(8)} (${dayOfWeek})</td>
      <td>${habitualSchedule}</td>
      <td id="actions-${dateString}" style="text-align: center;">
        ${generateActionButtons(dateString, isPast, hasReport)}
      </td>
    `;
    if (hasReport) {
      row.cells[2].innerHTML = `
        <div style="font-size: 0.8em; font-weight: bold; color: ${hasReport.tipoReporte === 'HABITUAL' ? 'green' : (hasReport.tipoReporte === 'FALTA' ? 'red' : 'blue')};">
          ${hasReport.tipoReporte}
        </div>
        <span style="font-size: 0.7em;">${hasReport.horarioReportado || hasReport.comentarios || ''}</span>
      `;
    }
  }
  document.getElementById('loading-report-msg').classList.add('hidden');
}
function generateActionButtons(dateString, isPast, hasReport) {
  if (isPast && !hasReport) return '<span style="color:red; font-size:0.8em;">Pendiente</span>';
  if (hasReport) return '';
  return `
    <button class="action-button btn-check" title="Horario Habitual" onclick="saveQuickReport('${dateString}', 'HABITUAL')">✅</button>
    <button class="action-button btn-cross" title="Ausencia / Falta" onclick="showDetailedInput('${dateString}', 'FALTA')">❌</button>
    <button class="action-button btn-plus" title="Horas Extra/Diferentes" onclick="showDetailedInput('${dateString}', 'EXTRA')">➕</button>
  `;
}
function showDetailedInput(dateString, type) {
  const actionsCell = document.getElementById(`actions-${dateString}`);
  const currentRow = actionsCell.parentNode;
  const existing = document.getElementById(`extra-row-${dateString}`);
  if (existing) existing.remove();
  const newRow = timesheetBodyEl.insertRow(currentRow.rowIndex + 1);
  newRow.id = `extra-row-${dateString}`;
  newRow.classList.add('extra-input-row');
  const cell = newRow.insertCell(0);
  cell.colSpan = 3;
  const placeholderText = (type === 'EXTRA')
    ? "Horario trabajado o cantidad de horas (Ej: 9:00 a 19:00)"
    : "Motivo de la ausencia (médico, personal, etc.)";
  cell.innerHTML = `
    <div style="padding: 5px;">
      <input type="text" id="horario-reportado-temp-${dateString}" placeholder="${placeholderText}">
      <textarea id="comentarios-temp-${dateString}" placeholder="Comentarios"></textarea>
      <button onclick="saveDetailedReport('${dateString}', '${type}')" style="background-color: ${type === 'EXTRA' ? '#007bff' : '#dc3545'}; margin: 5px 0;">Guardar Reporte</button>
      <button onclick="loadMonthlyReport(auth.currentUser.uid, employeeConfig.horarioHabitual)" style="background-color: #6c757d; margin: 5px 0;">Cancelar</button>
    </div>
  `;
  actionsCell.innerHTML = '<span style="font-size: 0.8em; color: gray;">Detalle Abierto</span>';
}
function createReportObject(date, type, horarioReportado = '', comentarios = '') {
  const user = auth.currentUser;
  return {
    userId: user.uid,
    email: user.email,
    nombre: employeeNameEl.textContent,
    mesAnio: date.substring(0, 7),
    fecha: date,
    tipoReporte: type,
    horarioReportado: horarioReportado,
    comentarios: comentarios,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };
}
function saveQuickReport(dateString, type) {
  db.collection("timesheets")
    .where("userId", "==", auth.currentUser.uid)
    .where("fecha", "==", dateString)
    .get().then(snapshot => {
      if (!snapshot.empty) {
        showMessage(`Ya existe un reporte para el ${dateString}.`, true);
        return;
      }
      const reportData = createReportObject(dateString, type, employeeConfig.horarioHabitual, 'Horario habitual reportado.');
      db.collection("timesheets").add(reportData)
        .then(() => {
          showMessage(`✅ Reporte Rápido guardado para ${dateString}.`, false);
          loadMonthlyReport(auth.currentUser.uid, employeeConfig.horarioHabitual);
        })
        .catch((error) => showMessage(`Error al guardar: ${error.message}`, true));
    });
}
function saveDetailedReport(dateString, type) {
  const horarioReportado = document.getElementById(`horario-reportado-temp-${dateString}`).value;
  const comentarios = document.getElementById(`comentarios-temp-${dateString}`).value;
  if (!horarioReportado && type !== 'FALTA') {
    showMessage('Debes especificar el horario trabajado o las horas extra.', true);
    return;
  }
  db.collection("timesheets")
    .where("userId", "==", auth.currentUser.uid)
    .where("fecha", "==", dateString)
    .get().then(snapshot => {
      if (!snapshot.empty) {
        showMessage(`Ya existe un reporte para el ${dateString}.`, true);
        return;
      }
      const reportData = createReportObject(dateString, type, horarioReportado, comentarios);
      db.collection("timesheets").add(reportData)
        .then(() => {
          showMessage(`✅ Reporte Detallado guardado para ${dateString}.`, false);
          loadMonthlyReport(auth.currentUser.uid, employeeConfig.horarioHabitual);
        })
        .catch((error) => showMessage(`Error al guardar: ${error.message}`, true));
    });
}
function saveExtraDayTimeSheet() {
  const date = document.getElementById('extra-report-date').value;
  const horarioReportado = document.getElementById('extra-horario-reportado').value;
  const comentarios = document.getElementById('extra-comentarios').value;
  if (!date || !horarioReportado) {
    showMessage("Debes especificar la fecha y el horario trabajado para el día extra.", true);
    return;
  }
  db.collection("timesheets")
    .where("userId", "==", auth.currentUser.uid)
    .where("fecha", "==", date)
    .get().then(snapshot => {
      if (!snapshot.empty) {
        showMessage(`Ya existe un reporte para el ${date}. Si quieres editarlo, usa la tabla.`, true);
        return;
      }
      const reportData = createReportObject(date, 'DIA_EXTRA', horarioReportado, comentarios);
      db.collection("timesheets").add(reportData)
        .then(() => {
          showMessage(`✅ Día Extra reportado para ${date}.`, false);
          showExtraDayForm();
          loadMonthlyReport(auth.currentUser.uid, employeeConfig.horarioHabitual);
        })
        .catch((error) => showMessage(`Error al guardar día extra: ${error.message}`, true));
    });
}

// =======================================================
// === OBSERVADOR DE ESTADO (maneja vistas) ==============
// =======================================================
auth.onAuthStateChanged((user) => {
  if (user) {
    // Ayuda para obtener tu UID de admin
    console.log("--- CONFIGURACIÓN DE USUARIO ---");
    console.log("Tu UID actual (user.uid) es:", user.uid);
    console.log("El ADMIN_UID configurado es:", ADMIN_UID);
    console.log("--------------------------------");

    // Mostrar vista privada por defecto y el mail
    document.getElementById('user-email-display').textContent = user.email;
    authView.classList.add('hidden');
    privateView.classList.remove('hidden');

    // Si es admin: mostrar panel admin y salir
    if (user.uid === ADMIN_UID) {
      employeeNameEl.textContent = 'ADMINISTRADOR';
      horarioHabitualDisplayEl.textContent = 'Gestión de Empleados';
      adminViewEl.classList.remove('hidden');
      document.getElementById('employee-dashboard').classList.add('hidden');
      loadEmployeeList();
      showMessage('');
      return;
    }

    // Si es empleado: ocultar admin y cargar su config + calendario
    adminViewEl.classList.add('hidden');
    document.getElementById('employee-dashboard').classList.remove('hidden');

    db.collection("employee_config").where("userId", "==", user.uid).get()
      .then(snapshot => {
        if (snapshot.empty) {
          employeeNameEl.textContent = 'Usuario sin configurar';
          horarioHabitualDisplayEl.textContent = 'Horario no asignado. Contacte a RRHH.';
          showMessage('⚠️ Tu usuario aún no está configurado por el administrador.', true);
          return;
        }
        employeeConfig = snapshot.docs[0].data();
        employeeNameEl.textContent = employeeConfig.nombre;
        horarioHabitualDisplayEl.textContent = employeeConfig.horarioHabitual;
        loadMonthlyReport(user.uid, employeeConfig.horarioHabitual);
        showMessage('');
      })
      .catch(error => {
        console.error("Error al cargar config: ", error);
        showMessage('Error al cargar la configuración del empleado.', true);
      });
  } else {
    authView.classList.remove('hidden');
    privateView.classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  }
});
