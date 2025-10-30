#!/bin/bash

# Script de configuración para EcoPrado con Stellar Soroban
echo "🌱 Configurando EcoPrado con Stellar Soroban..."

# Verificar que Rust esté instalado
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust no está instalado. Instalando..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source ~/.cargo/env
fi

# Verificar que Stellar CLI esté instalado
if ! command -v stellar &> /dev/null; then
    echo "❌ Stellar CLI no está instalado. Instalando..."
    cargo install --locked stellar-cli@23.1.4
fi

# Instalar target para Soroban
echo "🔧 Instalando target wasm32-unknown-unknown..."
rustup target add wasm32-unknown-unknown

# Configurar red de prueba
echo "🌐 Configurando red de prueba..."
stellar config --network testnet

# Crear cuenta de administrador
echo "👤 Creando cuenta de administrador..."
ADMIN_KEYPAIR=$(stellar keys generate --global)
ADMIN_PUBLIC=$(echo $ADMIN_KEYPAIR | cut -d' ' -f1)
ADMIN_SECRET=$(echo $ADMIN_KEYPAIR | cut -d' ' -f2)

echo "Admin Public Key: $ADMIN_PUBLIC"
echo "Admin Secret Key: $ADMIN_SECRET"

# Fondear cuenta
echo "💰 Fondeando cuenta de administrador..."
stellar account create --global $ADMIN_PUBLIC

# Compilar contratos
echo "🔨 Compilando contratos Soroban..."
cd backend/soroban
cargo build --target wasm32-unknown-unknown --release

# Desplegar contrato principal
echo "🚀 Desplegando contrato principal..."
CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/ecoprado_contracts.wasm \
    --source-key $ADMIN_SECRET \
    --network testnet)

echo "Contract ID: $CONTRACT_ID"

# Inicializar contrato
echo "⚙️ Inicializando contrato..."
stellar contract invoke \
    --id $CONTRACT_ID \
    --source-key $ADMIN_SECRET \
    --network testnet \
    -- \
    initialize \
    --admin $ADMIN_PUBLIC

# Desplegar token PRADONSITOS
echo "🪙 Desplegando token PRADONSITOS..."
TOKEN_CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/pradonsitos_token.wasm \
    --source-key $ADMIN_SECRET \
    --network testnet)

echo "Token Contract ID: $TOKEN_CONTRACT_ID"

# Inicializar token
echo "⚙️ Inicializando token..."
stellar contract invoke \
    --id $TOKEN_CONTRACT_ID \
    --source-key $ADMIN_SECRET \
    --network testnet \
    -- \
    initialize \
    --admin $ADMIN_PUBLIC \
    --name "PRADONSITOS" \
    --symbol "PRD" \
    --decimals 7

# Crear archivo de configuración
echo "📝 Creando archivo de configuración..."
cat > ../.env.soroban << EOF
# Configuración Stellar Soroban
STELLAR_NETWORK=testnet
ADMIN_PUBLIC_KEY=$ADMIN_PUBLIC
ADMIN_SECRET_KEY=$ADMIN_SECRET
CONTRACT_ID=$CONTRACT_ID
TOKEN_CONTRACT_ID=$TOKEN_CONTRACT_ID

# URLs de red
HORIZON_URL=https://horizon-testnet.stellar.org
RPC_URL=https://soroban-testnet.stellar.org
EOF

echo "✅ Configuración completada!"
echo ""
echo "📋 Información importante:"
echo "   Admin Public Key: $ADMIN_PUBLIC"
echo "   Admin Secret Key: $ADMIN_SECRET"
echo "   Contract ID: $CONTRACT_ID"
echo "   Token Contract ID: $TOKEN_CONTRACT_ID"
echo ""
echo "🔐 IMPORTANTE: Guarda las claves secretas en un lugar seguro!"
echo "🚀 Ahora puedes ejecutar: npm run dev"
