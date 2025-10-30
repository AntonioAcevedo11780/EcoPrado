// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch('http://localhost:3001/api/stats');
        const stats = await response.json();
        
        document.getElementById('stat-users').textContent = stats.totalUsers || 0;
        document.getElementById('stat-tokens').textContent = (stats.totalTokens || 0).toLocaleString();
        document.getElementById('stat-co2').textContent = `${stats.co2Avoided || 0} kg`;
        document.getElementById('stat-actions').textContent = stats.totalActions || 0;
    } catch (error) {
        console.log('Estadísticas no disponibles (backend no iniciado)');
    }
}

// Inicializar cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', loadStats);
