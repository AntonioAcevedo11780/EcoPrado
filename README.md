# EcoPrado

Proyecto web orientado a la sostenibilidad que integra un frontend estático, un backend en Node.js y componentes para interactuar con la red Stellar, incluyendo contratos inteligentes en Soroban (Rust). El objetivo es ofrecer un conjunto de páginas y utilidades para visualizar información, gestionar interacciones con tokens y recompensas, y facilitar la experimentación con funcionalidades Web3 sobre Stellar.

## Características principales
- Frontend ligero con páginas temáticas (`dashboard`, `marketplace`, `gran-prado`) y componentes reutilizables.
- Backend en Node.js con utilidades y endpoints (expandibles) para soporte de datos y lógica de negocio.
- Integración con Stellar y Soroban para verificación de activos, recompensas y contrato inteligente en Rust.
- Estructura modular y separada por responsabilidades.

## Arquitectura
- `frontend/`: Sitio web estático con HTML, CSS y JavaScript, servido por un pequeño servidor Node para desarrollo.
- `backend/`: Servidor Node.js con utilidades y scripts para integraciones (Stellar, Soroban) y espacio para API/middleware/modelos.
- `backend/soroban/`: Código y herramientas para contratos inteligentes en Soroban (Rust) y cliente de interacción.
- `backend/stellar/`: Scripts para verificación de activos y recompensas en la red Stellar.

## Tecnologías
- Node.js (backend y servidores de desarrollo)
- HTML, CSS, JavaScript (frontend)
- Stellar y Soroban (Blockchain/Smart Contracts)
- Rust (contrato inteligente en `backend/soroban/src`)

## Requisitos previos
- Node.js 18+ y npm
- Rust (para trabajar con Soroban y compilar el contrato)
- Herramientas de Soroban según la documentación oficial si se requiere desplegar/interactuar on-chain
- Windows PowerShell (el repositorio incluye `start-server.ps1`)

## Instalación
Ejecutar la instalación de dependencias en `frontend` y `backend`:

```bash
cd backend
npm install
cd ../frontend
npm install
```

## Configuración
- Variables de entorno para Soroban/Stellar pueden gestionarse en `backend/soroban/env.js` y scripts asociados. Ajuste claves, redes y endpoints según el entorno objetivo (testnet/mainnet).
- Configure cualquier secreto o credencial de manera segura (por ejemplo, a través de variables de entorno del sistema o archivos `.env` ignorados por control de versiones).

## Ejecución
Opciones comunes:

1) Ejecutar servidores de frontend y backend por separado:
```bash
# Terminal 1
cd backend
npm start

# Terminal 2
cd frontend
npm start
```

2) Utilizar el script de PowerShell en la raíz si está preparado para orquestar servicios:
```powershell
./start-server.ps1
```

Revise la salida de consola para los puertos en uso. Por defecto, el frontend sirve contenido estático y el backend expone endpoints y scripts utilitarios.

## Estructura del proyecto (resumen)
```
backend/
  api/
  data/
  middleware/
  models/
  server.js
  server-simple.js
  stellar/
    rewards.js
    setup.js
    verify-asset.js
  soroban/
    Cargo.toml
    client.js
    env.js
    setup.sh
    src/
      lib.rs
      pradonsitos_token.rs
  utils/

frontend/
  index.html
  pages/
    dashboard.html
    marketplace.html
    gran-prado.html
  components/
    sidebar.html
  public/
    css/
    js/
    images/
  server.js

start-server.ps1
```

## Scripts útiles
- `frontend/server.js`: servidor de desarrollo para recursos estáticos.
- `backend/server.js` y `backend/server-simple.js`: variantes de servidor para el backend.
- `backend/stellar/*`: scripts para configurar/verificar activos y recompensas en Stellar.
- `backend/soroban/*`: cliente y utilidades para interacción con Soroban; código del contrato en Rust bajo `src/`.
