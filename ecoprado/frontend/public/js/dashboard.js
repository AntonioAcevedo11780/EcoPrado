// Configuración
const API_URL = 'http://localhost:3001/api';
let currentUser = null;
let progressChart = null;

// ============================================
// CUENTA HARDCODEADA PARA PROTOTIPO
// ============================================
const PROTO_ACCOUNT_PUBLIC_KEY = 'GCWZXXS5F67WRCPYX26VIZVHY5BEN7POE5JDEWGL2SVZF4DNVLQFAELZ';
const PROTO_ACCOUNT_SECRET_KEY = null; // No necesitamos secret key en el frontend

// Función para registrar usuario
async function registerUser(publicKey, secretKey) {
    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Usuario Demo',
                email: `prototipo@ecoprado.com`,
                role: 'ciudadano',
                publicKey,
                secretKey
            })
        });
        
        if (response.ok) {
            console.log(' Usuario registrado exitosamente');
            return true;
        } else {
            console.error(' Error registrando usuario:', await response.text());
            return false;
        }
    } catch (error) {
        console.error(' Error registrando usuario:', error);
        return false;
    }
}

// Inicializar usuario - Modo prototipo con cuenta fija
async function initializeUser() {
    try {
        console.log('Inicializando usuario...');
        
        // Usar siempre la cuenta hardcodeada para el prototipo
        const publicKey = PROTO_ACCOUNT_PUBLIC_KEY;
        const secretKey = PROTO_ACCOUNT_SECRET_KEY;
        
        // Guardar en localStorage
                    localStorage.setItem('ecoprado_publicKey', publicKey);
        localStorage.setItem('ecoprado_wallet_provider', 'prototipo');
        if (secretKey) {
                    localStorage.setItem('ecoprado_secretKey', secretKey);
            } else {
            localStorage.removeItem('ecoprado_secretKey');
        }
        
        console.log('Usando cuenta:', publicKey.substring(0, 20) + '...');
        
        // Intentar cargar datos del usuario
        const response = await fetch(`${API_URL}/users/${publicKey}`);
        if (response.ok) {
            currentUser = await response.json();
            updateUI();
            loadTransactions();
            console.log('Usuario cargado:', currentUser);
        } else if (response.status === 404) {
            // Usuario no encontrado, registrarlo automáticamente
            console.log('Usuario no encontrado, registrando...');
            const registered = await registerUser(publicKey, secretKey);
            if (registered) {
            // Intentar cargar de nuevo
            const retryResponse = await fetch(`${API_URL}/users/${publicKey}`);
            if (retryResponse.ok) {
                currentUser = await retryResponse.json();
                updateUI();
                loadTransactions();
                    console.log('Usuario registrado y cargado');
            }
            }
        } else {
            console.error('Error cargando usuario:', response.status);
        }
    } catch (error) {
        console.error('Error inicializando usuario:', error);
        if (document.getElementById('balance-status')) {
        document.getElementById('balance-status').textContent = 'Error de conexión';
        }
    }
}

// Actualizar UI
function updateUI() {
    if (currentUser) {
        document.getElementById('username').textContent = currentUser.name || 'Usuario';
        document.getElementById('user-role').textContent = '#' + (currentUser.role || 'ciudadano');
        document.getElementById('user-balance').textContent = (currentUser.balance || 0).toFixed(2);
        document.getElementById('co2-saved').textContent = (currentUser.co2Saved || 0).toFixed(1);
        document.getElementById('total-actions').textContent = currentUser.totalActions || 0;
        document.getElementById('balance-status').textContent = 'Actualizado';
        
        // Actualizar gráfico
        updateProgressChart();

        // Estadísticas/perfil simples
        const avg = Math.round(((currentUser.balance || 0) / 30) * 10) / 10;
        const top = 'Reciclaje';
        const totalCO2 = (currentUser.co2Saved || 0).toFixed(1);
        const idData = (localStorage.getItem('ecoprado_verification_data'));
        document.getElementById('avg-daily') && (document.getElementById('avg-daily').textContent = avg);
        document.getElementById('top-action') && (document.getElementById('top-action').textContent = top);
        document.getElementById('total-co2') && (document.getElementById('total-co2').textContent = totalCO2);
        const verif = localStorage.getItem('ecoprado_verification_status') || 'unverified';
        document.getElementById('profile-name') && (document.getElementById('profile-name').textContent = currentUser.name || 'Usuario');
        document.getElementById('profile-role') && (document.getElementById('profile-role').textContent = currentUser.role || 'ciudadano');
        if (idData) {
            const d = JSON.parse(idData);
            document.getElementById('profile-id') && (document.getElementById('profile-id').textContent = d.idNumber || '—');
        }
        document.getElementById('profile-verif') && (document.getElementById('profile-verif').textContent = verif === 'verified' ? 'Verificado' : 'Sin verificar');
    }
}

// Crear gráfico de progreso
function createProgressChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    
    // Datos de ejemplo para la última semana
    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date.toLocaleDateString('es-MX', { weekday: 'short' }));
    }
    
    progressChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'PRADONSITOS Ganados',
                data: [12, 8, 15, 22, 18, 25, 30],
                backgroundColor: '#4ADE80',
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'PRADONSITOS'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Actualizar gráfico con datos reales
function updateProgressChart() {
    if (!progressChart) {
        createProgressChart();
        return;
    }
    
    // Simular datos actualizados basados en el usuario actual
    const baseTokens = currentUser.balance || 0;
    const baseCO2 = currentUser.co2Saved || 0;
    
    // Generar datos de la última semana basados en el progreso actual
    const weeklyData = [];
    const weeklyCO2 = [];
    
    for (let i = 6; i >= 0; i--) {
        const dayTokens = Math.max(0, baseTokens - (Math.random() * 20));
        const dayCO2 = Math.max(0, baseCO2 - (Math.random() * 2));
        weeklyData.push(Math.round(dayTokens));
        weeklyCO2.push(Math.round(dayCO2 * 10) / 10);
    }
    
    progressChart.data.datasets[0].data = weeklyData;
    progressChart.update();
}

// Cargar transacciones
async function loadTransactions() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/actions/${currentUser.publicKey}`);
        const actions = await response.json();
        
        const container = document.getElementById('transactions-list');
        
        if (actions.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-4">No hay transacciones aún</p>';
            return;
        }
        
        container.innerHTML = actions.map(action => `
            <div class="transaction-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <div class="icon-box" style="background-color: rgba(74, 222, 128, 0.1); color: #22C55E;">
                            <i class="bi bi-arrow-down"></i>
                        </div>
                        <div>
                            <div class="fw-medium">${getActionName(action.actionType)}</div>
                            <div class="text-secondary small">${new Date(action.createdAt).toLocaleDateString('es-MX')}</div>
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="fw-bold" style="color: #22C55E;">+${action.rewardAmount} PRD</div>
                        <small class="text-muted">${action.status === 'completed' ? 'Completado' : 'Pendiente'}</small>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando transacciones:', error);
    }
}

function getActionName(type) {
    const names = {
        'reciclaje': 'Reciclaje',
        'transporte_verde': 'Transporte Verde',
        'ahorro_agua': 'Ahorro de Agua',
        'agricultura_sostenible': 'Agricultura Sostenible',
        'educacion_ambiental': 'Educación Ambiental'
    };
    return names[type] || type;
}

// Reportar acción
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        Swal.fire({
            icon: 'warning',
            title: 'Espera un momento',
            text: 'Por favor espera a que se cargue tu cuenta',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    const btn = document.getElementById('submitAction');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';
    
    const actionType = document.getElementById('actionType').value;
    const description = document.getElementById('actionDescription').value;
    
    try {
        // Crear un timeout para el fetch (30 segundos)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
        
        console.log('Enviando acción al servidor...', {
            userPublicKey: currentUser.publicKey,
            actionType,
            description
        });
        
        const response = await fetch(`${API_URL}/actions/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userPublicKey: currentUser.publicKey,
                actionType,
                description,
                evidence: 'demo_evidence'
            }),
            signal: controller.signal // Para poder cancelar el request
        });
        
        clearTimeout(timeoutId);
        
        // Verificar si la respuesta es OK
        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = 'No se pudo registrar la acción';
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error || errorJson.message || errorMsg;
            } catch (e) {
                errorMsg = errorText || `Error ${response.status}: ${response.statusText}`;
            }
            
            throw new Error(errorMsg);
        }
        
        const result = await response.json();
        console.log('✅ Respuesta del servidor:', result);
        
        if (result.success) {
            // Mostrar mensaje de éxito con información del balance
            const balanceMsg = result.balance !== undefined 
                ? `<p class="mt-2"><strong>Balance actual: ${result.balance.toFixed(2)} PRADONSITOS</strong></p>`
                : '';
            
            // Determinar si fue en Stellar o simulado
            const isStellarSuccess = result.txHash && !result.stellarError;
            let stellarInfo = '';
            
            if (isStellarSuccess) {
                stellarInfo = `<p class="small text-success mt-2">Token enviado a Stellar Testnet<br>TX: <code>${result.action.txHash.substring(0, 30)}...</code></p>`;
            } else if (result.stellarError) {
                // Mostrar error más detallado con soluciones
                let errorDetails = '';
                let solutionHint = '';
                
                if (result.needsTrustline) {
                    solutionHint = `<br><strong class="text-primary">💡 Solución:</strong> Crea la trustline desde Freighter:<br>
                        <code class="small">Asset: PRADONSITOS<br>Issuer: ${result.issuerKey?.substring(0, 20)}...</code>`;
                } else if (result.errorCode === 'ACCOUNT_NOT_FOUND') {
                    solutionHint = `<br><strong class="text-primary">💡 Solución:</strong> La cuenta debe existir y tener XLM en Stellar Testnet`;
                } else if (result.operationCode) {
                    const opCode = Array.isArray(result.operationCode) ? result.operationCode[0] : result.operationCode;
                    if (opCode && (opCode.includes('NO_TRUST') || opCode.includes('no_trust'))) {
                        solutionHint = `<br><strong class="text-primary">💡 Solución:</strong> La cuenta necesita crear trustline para PRADONSITOS primero`;
                    }
                }
                
                if (result.resultCodes) {
                    errorDetails = `<br><small class="text-muted">Códigos Stellar: ${JSON.stringify(result.resultCodes).substring(0, 150)}</small>`;
                }
                
                stellarInfo = `<div class="small text-warning mt-2">
                    ⚠️ Token registrado localmente<br>
                    <strong>Error Stellar:</strong> ${result.stellarError.substring(0, 100)}
                    ${solutionHint}
                    ${errorDetails}
                </div>`;
            } else {
                stellarInfo = '<p class="small text-info mt-2">Token registrado en modo prototipo</p>';
            }
            
            Swal.fire({
                icon: isStellarSuccess ? 'success' : 'info',
                title: '¡Felicidades!',
                html: `
                    <div class="text-center">
                        <p class="fs-4">Has ganado <strong class="text-success">${result.action.rewardAmount} PRADONSITOS</strong></p>
                        ${balanceMsg}
                        ${stellarInfo}
                    </div>
                `,
                confirmButtonText: '¡Genial!',
                timer: isStellarSuccess ? 3000 : 5000,
                timerProgressBar: true
            });
            
            bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
            document.getElementById('reportForm').reset();
            
            // Recargar datos inmediatamente (no hay que esperar Stellar)
            setTimeout(() => {
        console.log('Recargando datos del usuario...');
                initializeUser();
            }, 500);
        } else {
            // El servidor respondió pero con success: false
            const errorMsg = result.error || result.message || 'No se pudo registrar la acción';
            
            Swal.fire({
                icon: 'warning',
                title: 'Acción registrada pero recompensa pendiente',
                html: `
                    <p>${errorMsg}</p>
                    <p class="small text-muted mt-2">
                        ${result.action ? `Acción #${result.action.id} creada` : ''}<br>
                        Posibles causas:<br>
                        • Tu wallet no tiene trustline para PRADONSITOS<br>
                        • El servidor no puede enviar tokens (falta configuración)<br>
                        • Problemas de red con Stellar
                    </p>
                `,
                confirmButtonText: 'Entendido'
            });
        }
    } catch (error) {
        console.error('Error reportando acción:', error);
        
        let errorTitle = 'Error de conexión';
        let errorMessage = error.message || 'Ocurrió un error desconocido';
        
        // Detectar tipos específicos de error
        if (error.name === 'AbortError') {
            errorTitle = 'Timeout - Tiempo de espera agotado';
            errorMessage = 'El servidor tardó demasiado en responder. Posibles causas:\n' +
                          '• El servidor no está corriendo\n' +
                          '• Problemas de red con Stellar\n' +
                          '• La transacción está tardando mucho';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorTitle = 'Error de red';
            errorMessage = 'No se pudo conectar con el servidor.\n' +
                          'Verifica que el backend esté corriendo en http://localhost:3001';
        } else if (error.message.includes('trustline') || error.message.includes('trust')) {
            errorTitle = 'Falta Trustline';
            errorMessage = 'Tu wallet necesita una trustline para PRADONSITOS.\n' +
                          'Usa el botón "Habilitar PRADONSITOS" primero.';
        }
        
        Swal.fire({
            icon: 'error',
            title: errorTitle,
            html: `
                <p>${errorMessage}</p>
                <p class="small text-muted mt-2">
                    <strong>Tips:</strong><br>
                    • Verifica la consola (F12) para más detalles<br>
                    • Verifica que el backend esté corriendo
                </p>
            `,
            confirmButtonText: 'Entendido',
            width: '500px'
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Enviar y Recibir Recompensa';
    }
});

// Ver claves de wallet
document.getElementById('view-key').addEventListener('click', (e) => {
    e.preventDefault();
    const publicKey = PROTO_ACCOUNT_PUBLIC_KEY || localStorage.getItem('ecoprado_publicKey');
    const provider = localStorage.getItem('ecoprado_wallet_provider') || 'prototipo';
    
    Swal.fire({
        icon: 'info',
        title: 'Wallet',
        html: `
            <div class="text-start">
                <p><strong>Clave Pública:</strong></p>
                <code class="d-block p-2 bg-light rounded">${publicKey}</code>
            </div>
        `,
        confirmButtonText: 'Entendido',
        width: '600px'
    });
});

// Funcionalidad de la calculadora de CO2
let currentCalculatorType = 'ciudadano';

// Sistema de verificación
let userVerificationStatus = 'unverified'; // unverified, pending, verified

// Cambiar tipo de calculadora
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('#calculator-tabs .list-group-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover active de todos los tabs
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Ocultar todos los formularios
            document.querySelectorAll('.calculator-form').forEach(form => {
                form.style.display = 'none';
            });
            
            // Mostrar el formulario correspondiente
            const type = this.getAttribute('data-type');
            document.getElementById(`${type}-form`).style.display = 'block';
            currentCalculatorType = type;
            
            // Ocultar resultado anterior
            document.getElementById('co2-result').style.display = 'none';
        });
    });
    
    // Calcular CO2 (modal dedicado)
    document.getElementById('calculateCO2').addEventListener('click', calculateCO2);
});

// Calcular huella de carbono
function calculateCO2() {
    let totalCO2 = 0;
    let recommendations = [];
    
    switch(currentCalculatorType) {
        case 'ciudadano':
            totalCO2 = calculateCiudadanoCO2();
            recommendations = getCiudadanoRecommendations();
            break;
        case 'agricultor':
            totalCO2 = calculateAgricultorCO2();
            recommendations = getAgricultorRecommendations();
            break;
        case 'negocio':
            totalCO2 = calculateNegocioCO2();
            recommendations = getNegocioRecommendations();
            break;
    }
    
    // Mostrar resultado
    document.getElementById('co2-total').textContent = totalCO2.toFixed(1);
    document.getElementById('co2-equivalent').textContent = Math.ceil(totalCO2 / 22); // 1 árbol absorbe ~22kg CO2/año
    
    // Mostrar recomendaciones
    const recommendationsList = document.getElementById('recommendations');
    recommendationsList.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    
    document.getElementById('co2-result').style.display = 'block';
}

// Cálculos específicos por tipo
function calculateCiudadanoCO2() {
    const electricidad = parseFloat(document.getElementById('electricidad').value) || 0;
    const gas = parseFloat(document.getElementById('gas').value) || 0;
    const agua = parseFloat(document.getElementById('agua').value) || 0;
    const kilometros = parseFloat(document.getElementById('kilometros').value) || 0;
    
    // Factores de emisión (kg CO2 por unidad)
    const co2Electricidad = electricidad * 0.4; // México promedio
    const co2Gas = gas * 2.0;
    const co2Agua = agua * 0.3;
    const co2Transporte = kilometros * 0.12; // Gasolina promedio
    
    return co2Electricidad + co2Gas + co2Agua + co2Transporte;
}

function calculateAgricultorCO2() {
    const hectareas = parseFloat(document.getElementById('hectareas').value) || 0;
    const fertilizantes = parseFloat(document.getElementById('fertilizantes').value) || 0;
    const pesticidas = parseFloat(document.getElementById('pesticidas').value) || 0;
    const maquinaria = parseFloat(document.getElementById('maquinaria').value) || 0;
    
    // Factores de emisión agrícola
    const co2Hectareas = hectareas * 2.5; // Emisiones por hectárea
    const co2Fertilizantes = fertilizantes * 4.5; // N2O de fertilizantes
    const co2Pesticidas = pesticidas * 3.2;
    const co2Maquinaria = maquinaria * 2.8; // Diesel por hora
    
    return co2Hectareas + co2Fertilizantes + co2Pesticidas + co2Maquinaria;
}

function calculateNegocioCO2() {
    const electricidad = parseFloat(document.getElementById('electricidad-negocio').value) || 0;
    const empleados = parseFloat(document.getElementById('empleados').value) || 0;
    const transporte = parseFloat(document.getElementById('transporte-negocio').value) || 0;
    
    // Factores de emisión comercial
    const co2Electricidad = electricidad * 0.4;
    const co2Empleados = empleados * 15; // Emisiones por empleado/mes
    const co2Transporte = transporte * 0.12;
    
    return co2Electricidad + co2Empleados + co2Transporte;
}

// Recomendaciones por tipo
function getCiudadanoRecommendations() {
    return [
        "Instala paneles solares para reducir el consumo de electricidad",
        "Usa bicicleta o transporte público en lugar del auto",
        "Instala dispositivos ahorradores de agua",
        "Cambia a electrodomésticos de bajo consumo energético"
    ];
}

function getAgricultorRecommendations() {
    return [
        "Implementa agricultura orgánica sin fertilizantes químicos",
        "Usa técnicas de rotación de cultivos",
        "Implementa sistemas de riego por goteo",
        "Planta árboles en los bordes de tu parcela"
    ];
}

function getNegocioRecommendations() {
    return [
        "Implementa iluminación LED y sistemas de eficiencia energética",
        "Optimiza las rutas de transporte de mercancías",
        "Implementa programas de reciclaje en el negocio",
        "Considera energía renovable para tu negocio"
    ];
}

// Funcionalidad del sistema de verificación
document.addEventListener('DOMContentLoaded', function() {
    // Cambiar campos según tipo de usuario
    document.getElementById('userType').addEventListener('change', function() {
        const userType = this.value;
        const agricultorFields = document.getElementById('agricultor-fields');
        const negocioFields = document.getElementById('negocio-fields');
        
        // Ocultar todos los campos específicos
        agricultorFields.style.display = 'none';
        negocioFields.style.display = 'none';
        
        // Mostrar campos según el tipo
        if (userType === 'agricultor') {
            agricultorFields.style.display = 'block';
        } else if (userType === 'negocio') {
            negocioFields.style.display = 'block';
        }
    });
    
    // Cambiar etiqueta según tipo de ID
    document.getElementById('idType').addEventListener('change', function() {
        const idType = this.value;
        const label = document.getElementById('idLabel');
        const input = document.getElementById('idNumber');
        
        if (idType === 'curp') {
            label.textContent = 'CURP';
            input.placeholder = 'Ejemplo: ABCD123456HDFXXX01';
        } else if (idType === 'rfc') {
            label.textContent = 'RFC';
            input.placeholder = 'Ejemplo: ABCD123456XXX';
        }
    });
    
    // Enviar formulario de verificación
    document.getElementById('verificationForm').addEventListener('submit', submitVerification);
    
    // Cargar estado de verificación
    loadVerificationStatus();
});

// Cargar estado de verificación del usuario
function loadVerificationStatus() {
    const status = localStorage.getItem('ecoprado_verification_status') || 'unverified';
    userVerificationStatus = status;
    updateVerificationUI();
}

// Actualizar UI de verificación
function updateVerificationUI() {
    const badge = document.getElementById('verification-badge');
    
    switch(userVerificationStatus) {
        case 'verified':
            badge.className = 'badge bg-success';
            badge.innerHTML = '<i class="bi bi-shield-check me-1"></i>Verificado';
            break;
        case 'pending':
            badge.className = 'badge bg-warning';
            badge.innerHTML = '<i class="bi bi-clock me-1"></i>En revisión';
            break;
        default:
            badge.className = 'badge bg-warning';
            badge.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Sin verificar';
    }
}

// Enviar verificación
async function submitVerification(e) {
    e.preventDefault();
    
    const btn = document.getElementById('submitVerification');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';
    
    const formData = {
        idType: document.getElementById('idType').value,
        userType: document.getElementById('userType').value,
        idNumber: document.getElementById('idNumber').value,
        fullName: document.getElementById('fullName').value,
        municipio: document.getElementById('municipio').value,
        publicKey: localStorage.getItem('ecoprado_publicKey')
    };
    
    // Agregar campos específicos según el tipo
    if (formData.userType === 'agricultor') {
        formData.padronProductores = document.getElementById('padronProductores').value;
        formData.hectareas = document.getElementById('hectareasVerificacion').value;
    } else if (formData.userType === 'negocio') {
        formData.nombreNegocio = document.getElementById('nombreNegocio').value;
        formData.licenciaMunicipal = document.getElementById('licenciaMunicipal').value;
    }
    
    try {
        // Simular verificación con API gubernamental
        const isValid = await simulateGovernmentVerification(formData);
        
        if (isValid) {
            // Guardar estado de verificación
            localStorage.setItem('ecoprado_verification_status', 'verified');
            localStorage.setItem('ecoprado_verification_data', JSON.stringify(formData));
            
            userVerificationStatus = 'verified';
            updateVerificationUI();
            
            Swal.fire({
                icon: 'success',
                title: '¡Verificación Exitosa!',
                html: `
                    <div class="text-start">
                        <p><strong>✅ Tu identidad ha sido verificada</strong></p>
                        <p>Ahora puedes:</p>
                        <ul>
                            <li>Recibir recompensas especiales</li>
                            <li>Participar en programas municipales</li>
                            <li>Acceder a descuentos exclusivos</li>
                            <li>Obtener mayor confianza en la comunidad</li>
                        </ul>
                    </div>
                `,
                confirmButtonText: '¡Excelente!'
            });
            
            bootstrap.Modal.getInstance(document.getElementById('verificationModal')).hide();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Verificación Fallida',
                text: 'No se pudo verificar tu información. Por favor revisa los datos e intenta de nuevo.',
                confirmButtonText: 'Intentar de nuevo'
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'No se pudo conectar con el sistema de verificación. Intenta más tarde.',
            confirmButtonText: 'Entendido'
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-shield-check me-2"></i>Enviar para Verificación';
    }
}

// Simular verificación gubernamental
async function simulateGovernmentVerification(formData) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Validaciones básicas
    if (!formData.idNumber || !formData.fullName || !formData.municipio) {
        return false;
    }
    
    // Validar formato CURP
    if (formData.idType === 'curp') {
        const curpRegex = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;
        if (!curpRegex.test(formData.idNumber.toUpperCase())) {
            return false;
        }
    }
    
    // Validar formato RFC
    if (formData.idType === 'rfc') {
        const rfcRegex = /^[A-Z]{4}[0-9]{6}[A-Z0-9]{3}$/;
        if (!rfcRegex.test(formData.idNumber.toUpperCase())) {
            return false;
        }
    }
    
    // Simular verificación exitosa (90% de probabilidad)
    return Math.random() > 0.1;
}

// Inicializar al cargar
window.addEventListener('DOMContentLoaded', initializeUser);

// Obtener issuer desde backend
async function fetchIssuer() {
    try {
        const res = await fetch(`${API_URL}/issuer`);
        const data = await res.json();
        
        if (data.issuer) {
            localStorage.setItem('ecoprado_issuer', data.issuer);
            return data.issuer;
        }
    } catch (e) {
        console.warn('No se pudo obtener issuer del backend');
    }
    
    // Usar guardado
    let issuer = localStorage.getItem('ecoprado_issuer');
    return issuer;
}

// Calculadora: enviar y premiar basado en consumo
async function submitCalculatorAndReward() {
    try {
        if (!currentUser?.publicKey) return;
        const km = parseFloat(document.getElementById('calc_km')?.value || '0');
        const kwh = parseFloat(document.getElementById('calc_kwh')?.value || '0');
        const waste = parseFloat(document.getElementById('calc_waste')?.value || '0');
        const note = document.getElementById('calc_note')?.value || '';
        const resp = await fetch(`${API_URL}/calc/submit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userPublicKey: currentUser.publicKey, transport_km: km, energy_kwh: kwh, waste_kg: waste, note })
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) { console.error('calc submit error', data); return; }
        if (typeof data.balance === 'number') {
            const el = document.getElementById('user-balance');
            if (el) el.textContent = data.balance.toFixed(2);
        }
        initializeUser();
    } catch (e) { console.error('submitCalculatorAndReward', e); }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('calcSubmitBtn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); submitCalculatorAndReward(); });
});
