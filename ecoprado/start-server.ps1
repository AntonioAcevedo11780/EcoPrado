# Script para iniciar el servidor EcoPrado
Write-Host "🌱 Iniciando servidor EcoPrado..." -ForegroundColor Green

# Cambiar al directorio backend
Set-Location "C:\laragon\www\ecoprado\backend"

# Verificar que Node.js esté instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js no está instalado" -ForegroundColor Red
    exit 1
}

# Verificar que las dependencias estén instaladas
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
} else {
    Write-Host "📦 Instalando dependencias..." -ForegroundColor Yellow
    npm install
}

# Iniciar el servidor simplificado
Write-Host "🚀 Iniciando servidor en puerto 3001..." -ForegroundColor Blue
node server-simple.js
