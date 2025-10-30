const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
require('dotenv').config();

const { rewardUser, getUserBalance, setupUserTrustline } = require('./stellar/rewards');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Base de datos en memoria
const users = [];
const actions = [];
// Balance simulado para modo prototipo (en lugar de leer de Stellar)
const simulatedBalances = new Map(); // Map<publicKey, balance>
const purchases = [];
const marketplace = [
  { id: 1, name: 'Café Orgánico Local', price: 50, category: 'alimentos', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' },
  { id: 2, name: 'Taller de Compostaje', price: 75, category: 'educacion', image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400' },
  { id: 3, name: 'Productos Agrícolas Sostenibles', price: 100, category: 'alimentos', image: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400' },
  { id: 4, name: 'Tour Ecológico Xochitepec', price: 150, category: 'turismo', image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=400' },
  { id: 5, name: 'Planta Nativa para tu Jardín', price: 30, category: 'jardineria', image: 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=400' },
  { id: 6, name: 'Descuento Transporte Público', price: 20, category: 'transporte', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400' }
];

// Routes
app.get('/api/health', async (req, res) => {
  const hasDistribution = !!process.env.DISTRIBUTION_SECRET_KEY;
  const hasIssuer = !!process.env.ISSUER_PUBLIC_KEY;
  
  let assetStatus = 'unknown';
  let distributionBalance = null;
  let sorobanConfigured = false;
  let contractId = null;
  try {
    const { getSorobanConfig } = require('./soroban/client');
    const cfg = getSorobanConfig();
    sorobanConfigured = !!(cfg.contractId && cfg.adminSecret && cfg.rpcUrl);
    contractId = cfg.contractId || null;
  } catch (_) {}
  
  if (hasDistribution && hasIssuer) {
    try {
      const { checkDistributionBalance } = require('./stellar/verify-asset');
      distributionBalance = await checkDistributionBalance();
      if (distributionBalance !== null) {
        assetStatus = distributionBalance > 0 ? 'ok' : 'no_balance';
      }
    } catch (error) {
      assetStatus = 'error';
      console.error('Error verificando asset:', error.message);
    }
  }
  
  res.json({
    status: 'ok',
    message: 'EcoPrado API funcionando',
    configured: hasDistribution && hasIssuer,
    distributionKey: hasDistribution ? `Configurado` : 'Falta DISTRIBUTION_SECRET_KEY',
    issuerKey: hasIssuer ? `${process.env.ISSUER_PUBLIC_KEY.substring(0, 10)}...` : 'Falta ISSUER_PUBLIC_KEY',
    assetStatus: assetStatus,
    distributionBalance: distributionBalance,
    sorobanConfigured,
    contractId,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/issuer', (req, res) => {
  res.json({ issuer: process.env.ISSUER_PUBLIC_KEY || null });
});

// Endpoint de diagnóstico de Stellar
app.get('/api/stellar/status', (req, res) => {
  const hasDistribution = !!process.env.DISTRIBUTION_SECRET_KEY;
  const hasIssuer = !!process.env.ISSUER_PUBLIC_KEY;
  const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
  
  res.json({
    configured: hasDistribution && hasIssuer,
    distributionKey: hasDistribution ? 'Configurado' : 'Falta DISTRIBUTION_SECRET_KEY',
    issuerKey: hasIssuer ? `${process.env.ISSUER_PUBLIC_KEY.substring(0, 10)}...` : 'Falta ISSUER_PUBLIC_KEY',
    horizonUrl: horizonUrl,
    network: 'TESTNET'
  });
});

app.post('/api/users/register', async (req, res) => {
  const { name, email, role, publicKey, secretKey } = req.body;
  
  // Verificar si el usuario ya existe
  const existingUser = users.find(u => u.publicKey === publicKey);
  if (existingUser) {
    return res.json({ success: true, user: existingUser, message: 'Usuario ya existente' });
  }
  
  // Configurar trustline automáticamente si tenemos secretKey del usuario
  if (secretKey) {
    console.log(`Intentando crear trustline para ${publicKey.substring(0, 10)}...`);
    try {
      const trustlineResult = await setupUserTrustline(publicKey, secretKey);
      if (trustlineResult.success) {
        console.log(`Trustline creada exitosamente - la cuenta puede recibir PRADONSITOS`);
      } else {
        console.log(`No se pudo crear trustline: ${trustlineResult.error}`);
        console.log(`Posibles causas:`);
        console.log(`   - La cuenta no tiene XLM suficiente para fees (necesita ~0.00001 XLM)`);
        console.log(`   - La cuenta no existe en Stellar Testnet`);
        console.log(`   - Problemas de red`);
        console.log(`El usuario puede crear la trustline manualmente desde Freighter`);
      }
    } catch (error) {
      console.log(`Error creando trustline: ${error.message}`);
    }
  } else {
    console.log(`Sin secretKey del usuario. Trustline debe crearse manualmente.`);
    console.log(`Instrucciones:`);
    console.log(`   1. Abre Freighter`);
    console.log(`   2. Ve a Assets → Add Asset`);
    console.log(`   3. Asset: PRADONSITOS`);
    console.log(`   4. Issuer: ${process.env.ISSUER_PUBLIC_KEY || 'No configurado'}`);
  }
  
  const user = {
    id: users.length + 1,
    name: name || 'Usuario Demo',
    email: email || `user${Date.now()}@ecoprado.com`,
    role: role || 'ciudadano',
    publicKey,
    createdAt: new Date()
  };
  
  users.push(user);
  
  // Inicializar balance simulado en 0
  simulatedBalances.set(publicKey, 0);
  
  console.log(`Usuario registrado: ${publicKey.substring(0, 10)}... (Balance inicial: 0)`);
  res.json({ success: true, user });
});

app.get('/api/users/:publicKey', async (req, res) => {
  const user = users.find(u => u.publicKey === req.params.publicKey);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  // Usar balance simulado como base
  let balance = simulatedBalances.get(user.publicKey) || 0;
  
  // Intentar obtener balance real de Stellar para sincronizar
  try {
    const stellarBalance = await getUserBalance(user.publicKey);
    if (stellarBalance > 0) {
      // Si Stellar tiene balance, usar ese (más confiable)
      balance = stellarBalance;
      simulatedBalances.set(user.publicKey, stellarBalance);
      console.log(`Balance desde Stellar: ${balance} PRADONSITOS`);
    } else {
      console.log(`Usando balance simulado: ${balance} PRADONSITOS`);
    }
  } catch (error) {
    // Si falla Stellar, usar balance simulado
    console.log(`Usando balance simulado (${balance}) - Stellar no disponible`);
  }
  
  const userActions = actions.filter(a => a.userPublicKey === user.publicKey);
  const co2Saved = userActions.length * 2.5;
  
  res.json({ ...user, balance, totalActions: userActions.length, co2Saved });
});

app.post('/api/actions/report', async (req, res) => {
  const { userPublicKey, actionType, description, evidence } = req.body;
  
  const rewards = {
    'reciclaje': 10,
    'transporte_verde': 15,
    'ahorro_agua': 20,
    'agricultura_sostenible': 50,
    'educacion_ambiental': 25
  };
  
  const rewardAmount = rewards[actionType] || 10;
  
  const action = {
    id: actions.length + 1,
    userPublicKey,
    actionType,
    description,
    evidence,
    rewardAmount,
    status: 'completed', // Siempre completado en modo prototipo
    createdAt: new Date()
  };
  
  actions.push(action);
  
  // Actualizar balance simulado (backup en memoria)
  const currentBalance = simulatedBalances.get(userPublicKey) || 0;
  const newBalance = currentBalance + rewardAmount;
  simulatedBalances.set(userPublicKey, newBalance);
  
  console.log(`Acción reportada: ${userPublicKey.substring(0, 10)}... ganó ${rewardAmount} PRADONSITOS`);
  
  // Invocar contrato Soroban para registrar la acción (on-chain)
  let contractResult = null;
  try {
    const { invokeReportAction } = require('./soroban/client');
    contractResult = await invokeReportAction(userPublicKey, actionType, description, evidence);
    if (contractResult && contractResult.success) {
      action.contractTxHash = contractResult.txHash;
      console.log(`Acción registrada en Soroban. TX: ${contractResult.txHash}`);
    } else if (contractResult && !contractResult.success) {
      console.log(`Fallo al invocar contrato Soroban: ${contractResult.error || 'desconocido'}`);
    }
  } catch (e) {
    console.log(`Error invocando contrato Soroban: ${e.message}`);
  }

  // Intentar enviar tokens REALES a Stellar Testnet
  let stellarResult = null;
  try {
    stellarResult = await rewardUser(userPublicKey, rewardAmount, actionType);
    
    if (stellarResult.success) {
      action.txHash = stellarResult.hash;
      console.log(`Token enviado a Stellar Testnet! Hash: ${stellarResult.hash}`);
      // Actualizar balance simulado con el real de Stellar si está disponible
      try {
        const stellarBalance = await getUserBalance(userPublicKey);
        if (stellarBalance > 0) {
          simulatedBalances.set(userPublicKey, stellarBalance);
        }
      } catch (e) {
        // Si no se puede obtener balance de Stellar, usar el simulado
        console.log(`Usando balance simulado (${newBalance})`);
      }
    } else {
      // Manejar errores específicos de configuración
      if (stellarResult.errorCode === 'DISTRIBUTION_NO_TRUSTLINE') {
        console.error(`ERROR DE CONFIGURACION: La cuenta de distribución necesita trustline`);
        console.error(`Ejecuta: node backend/stellar/verify-asset.js trustline`);
      } else if (stellarResult.errorCode === 'INSUFFICIENT_BALANCE') {
        console.error(`ERROR DE CONFIGURACION: Faltan PRADONSITOS en cuenta de distribución`);
        console.error(`Balance actual: ${stellarResult.currentBalance}, Necesita: ${stellarResult.required}`);
        console.error(`Ejecuta: node backend/stellar/verify-asset.js issue`);
      }
      console.log(`Stellar falló: ${stellarResult.error}`);
      // Mantener balance simulado pero informar del error
    }
  } catch (error) {
    console.error(`Error crítico en Stellar: ${error.message}`);
    stellarResult = { success: false, error: error.message };
  }
  
  // Retornar respuesta
  if (stellarResult && stellarResult.success) {
    // Éxito en Stellar
    res.json({ 
      success: true, 
      action,
      message: `¡Ganaste ${rewardAmount} PRADONSITOS! Token enviado a Stellar Testnet.`,
      balance: simulatedBalances.get(userPublicKey) || newBalance,
      txHash: stellarResult.hash,
      contractTxHash: action.contractTxHash || null
    });
  } else {
    // Stellar falló pero acción registrada localmente
    const errorMsg = stellarResult?.error || 'Error desconocido en Stellar';
    const resultCodes = stellarResult?.resultCodes || null;
    const operationCode = stellarResult?.operationCode || null;
    const errorCode = stellarResult?.errorCode || null;
    const needsTrustline = stellarResult?.needsTrustline || false;
    const issuerKey = stellarResult?.issuerKey || process.env.ISSUER_PUBLIC_KEY || null;
    
    // Log detallado del error
    console.log(`Stellar falló - Códigos: ${JSON.stringify(resultCodes)}`);
    console.log(`   Error Code: ${errorCode}`);
    console.log(`   Needs Trustline: ${needsTrustline}`);
    
    res.json({ 
      success: true, // Siempre éxito localmente
      action,
      message: `¡Ganaste ${rewardAmount} PRADONSITOS! (Registrado localmente)`,
      balance: newBalance,
      stellarError: errorMsg,
      resultCodes: resultCodes,
      operationCode: operationCode,
      errorCode: errorCode,
      needsTrustline: needsTrustline,
      issuerKey: issuerKey,
      mode: 'simulated',
      help: resultCodes ? 'Ver resultCodes para detalles del error de Stellar' : null,
      contractTxHash: action.contractTxHash || null
    });
  }
});

app.get('/api/actions/:publicKey', (req, res) => {
  const userActions = actions.filter(a => a.userPublicKey === req.params.publicKey);
  res.json(userActions);
});

app.get('/api/marketplace', (req, res) => {
  res.json(marketplace);
});

// Listar compras del usuario
app.get('/api/purchases/:publicKey', (req, res) => {
  const list = purchases.filter(p => p.userPublicKey === req.params.publicKey);
  res.json(list);
});

// Comprar item del marketplace (descuenta balance simulado y ancla recibo)
app.post('/api/marketplace/purchase', async (req, res) => {
  try {
    const { userPublicKey, itemId } = req.body || {};
    if (!userPublicKey || !itemId) return res.status(400).json({ error: 'Faltan parámetros' });
    const item = marketplace.find(m => m.id === Number(itemId));
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });

    const current = simulatedBalances.get(userPublicKey) || 0;
    if (current < item.price) {
      return res.status(400).json({ error: 'Balance insuficiente', balance: current, price: item.price });
    }

    const order = {
      id: purchases.length + 1,
      userPublicKey,
      itemId: item.id,
      name: item.name,
      price: item.price,
      createdAt: new Date()
    };
    purchases.push(order);
    simulatedBalances.set(userPublicKey, current - item.price);

    // Anclar hash del recibo en ledger
    const receiptHash = crypto.createHash('sha256').update(JSON.stringify(order)).digest('hex');
    const anchor = await anchorActionHashOnLedger(`ECO-ORDER-${order.id}`, receiptHash);

    res.json({ success: true, order: { ...order, anchorTxHash: anchor.success ? anchor.txHash : null }, balance: simulatedBalances.get(userPublicKey) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Airdrop de prueba: envía una pequeña cantidad de PRADONSITOS
app.post('/api/airdrop', async (req, res) => {
  try {
    const { publicKey, amount } = req.body || {};
    if (!publicKey) {
      return res.status(400).json({ error: 'Falta publicKey' });
    }

    const sendAmount = Math.max(1, parseInt(amount || '1', 10));

    const result = await rewardUser(publicKey, sendAmount, 'airdrop');
    if (result && result.success) {
      return res.json({ success: true, txHash: result.hash, amount: sendAmount });
    }

    return res.json({
      success: false,
      error: result?.error || 'Fallo airdrop',
      details: result || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  const totalUsers = users.length;
  const totalActions = actions.length;
  const totalTokens = actions.reduce((sum, a) => sum + (a.rewardAmount || 0), 0);
  const co2Avoided = totalActions * 2.5;
  
  res.json({
    totalUsers,
    totalActions,
    totalTokens,
    co2Avoided: Math.round(co2Avoided * 10) / 10
  });
});

// Estimador simple de CO2 y tokens
app.post('/api/calc/estimate', (req, res) => {
  const { transport_km = 0, energy_kwh = 0, waste_kg = 0 } = req.body || {};
  const km = Number(transport_km) || 0;
  const kwh = Number(energy_kwh) || 0;
  const kgw = Number(waste_kg) || 0;
  // Factores muy simples (ejemplo):
  const co2 = km * 0.21 + kwh * 0.4 + kgw * 1.8; // kg CO2
  // Reglas de tokens: 1 PRADONSITOS por cada 2 kg CO2 evitados (redondeo)
  const tokens = Math.max(1, Math.round(co2 / 2));
  res.json({ co2SavedKg: Math.round(co2 * 100) / 100, suggestedTokens: tokens });
});

// Helper: anclar hash en Stellar usando manageData desde la cuenta de distribución
async function anchorActionHashOnLedger(label, hashHex) {
  try {
    const StellarSdk = require('@stellar/stellar-sdk');
    const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);
    if (!process.env.DISTRIBUTION_SECRET_KEY) {
      return { success: false, error: 'Falta DISTRIBUTION_SECRET_KEY' };
    }
    const distKp = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTION_SECRET_KEY);
    const account = await server.loadAccount(distKp.publicKey());
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.manageData({
        name: (label || 'ECO-ACT').slice(0, 64),
        value: Buffer.from(hashHex, 'hex')
      }))
      .setTimeout(180)
      .build();
    tx.sign(distKp);
    const result = await server.submitTransaction(tx);
    return { success: true, txHash: result.hash };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Submit desde calculadora: crea acción, recompensa y ancla hash
app.post('/api/calc/submit', async (req, res) => {
  try {
    const { userPublicKey, transport_km = 0, energy_kwh = 0, waste_kg = 0, note } = req.body || {};
    if (!userPublicKey) return res.status(400).json({ error: 'Falta userPublicKey' });

    // Estimar CO2/tokens
    const km = Number(transport_km) || 0;
    const kwh = Number(energy_kwh) || 0;
    const kgw = Number(waste_kg) || 0;
    const co2 = km * 0.21 + kwh * 0.4 + kgw * 1.8;
    const rewardAmount = Math.max(1, Math.round(co2 / 2));

    const action = {
      id: actions.length + 1,
      userPublicKey,
      actionType: 'calculadora_co2',
      description: `CO2 estimado: ${Math.round(co2 * 100) / 100} kg` + (note ? ` | ${note}` : ''),
      evidence: JSON.stringify({ transport_km: km, energy_kwh: kwh, waste_kg: kgw }),
      rewardAmount,
      co2SavedKg: Math.round(co2 * 100) / 100,
      status: 'completed',
      createdAt: new Date()
    };
    actions.push(action);

    // Balance simulado
    const current = simulatedBalances.get(userPublicKey) || 0;
    const newBalance = current + rewardAmount;
    simulatedBalances.set(userPublicKey, newBalance);

    // Invocar Soroban (si configurado)
    let contractTxHash = null;
    try {
      const { invokeReportAction } = require('./soroban/client');
      const contractRes = await invokeReportAction(userPublicKey, 'calculadora_co2', action.description, 'calc');
      if (contractRes && contractRes.success) contractTxHash = contractRes.txHash;
    } catch (_) {}

    // Recompensa real en Stellar (si posible)
    let txHash = null;
    try {
      const stellarRes = await rewardUser(userPublicKey, rewardAmount, 'calc');
      if (stellarRes && stellarRes.success) txHash = stellarRes.hash;
    } catch (_) {}

    // Anclar hash inmutable en ledger
    const hashHex = crypto.createHash('sha256').update(JSON.stringify(action)).digest('hex');
    const anchor = await anchorActionHashOnLedger(`ECO-ACT-${action.id}`, hashHex);

    res.json({
      success: true,
      action: { ...action, txHash, contractTxHash, anchorTxHash: anchor.success ? anchor.txHash : null },
      balance: newBalance
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
app.listen(PORT, () => {
  console.log(`EcoPrado API corriendo en http://localhost:${PORT}`);
});
