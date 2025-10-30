/**
 * Script para verificar y diagnosticar el token PRADONSITOS en Stellar Testnet
 */
const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

async function verifyAssetConfiguration() {
  console.log('Verificando configuración del token PRADONSITOS...\n');

  // 1. Verificar variables de entorno
  console.log('1. Verificando variables de entorno...');
  const issuerKey = process.env.ISSUER_PUBLIC_KEY;
  const issuerSecret = process.env.ISSUER_SECRET_KEY;
  const distributionKey = process.env.DISTRIBUTION_PUBLIC_KEY;
  const distributionSecret = process.env.DISTRIBUTION_SECRET_KEY;

  if (!issuerKey) {
    console.error('   ISSUER_PUBLIC_KEY no está configurado en .env');
    console.error('   Ejecuta: node backend/stellar/setup.js para crear cuentas');
    return false;
  }
  console.log(`   ISSUER_PUBLIC_KEY: ${issuerKey}`);

  if (!distributionSecret) {
    console.error('   DISTRIBUTION_SECRET_KEY no está configurado');
    return false;
  }
  console.log(`   DISTRIBUTION_SECRET_KEY configurado\n`);

  // 2. Verificar que la cuenta issuer existe
  console.log('2. Verificando cuenta emisora...');
  try {
    const issuerAccount = await server.loadAccount(issuerKey);
    console.log(`   Cuenta emisora existe`);
    console.log(`   Balance XLM: ${issuerAccount.balances.find(b => b.asset_type === 'native')?.balance || '0'} XLM`);
    console.log(`   Secuencia: ${issuerAccount.sequenceNumber()}\n`);

    // Verificar si la cuenta puede emitir el asset
    const balances = issuerAccount.balances.filter(b => b.asset_type !== 'native');
    console.log(`   Assets en cuenta emisora: ${balances.length}`);
    balances.forEach(b => {
      console.log(`      - ${b.asset_code} (Issuer: ${b.asset_issuer?.substring(0, 10)}...)`);
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`   La cuenta emisora ${issuerKey.substring(0, 10)}... NO existe en Stellar Testnet`);
      console.error('   Debe ser creada y fondeada primero\n');
      return false;
    }
    throw error;
  }

  // 3. Verificar que la cuenta de distribución existe
  console.log('3. Verificando cuenta de distribución...');
  const distributionKeypair = StellarSdk.Keypair.fromSecret(distributionSecret);
  const distributionPublicKey = distributionKeypair.publicKey();
  
  try {
    const distributionAccount = await server.loadAccount(distributionPublicKey);
    console.log(`   Cuenta de distribución existe: ${distributionPublicKey}`);
    console.log(`   Balance XLM: ${distributionAccount.balances.find(b => b.asset_type === 'native')?.balance || '0'} XLM\n`);

    // Verificar si tiene PRADONSITOS
    const pradonsitosBalance = distributionAccount.balances.find(
      b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === issuerKey
    );

    if (pradonsitosBalance) {
      console.log(`   Trustline para PRADONSITOS encontrada`);
      console.log(`   Balance: ${pradonsitosBalance.balance} PRADONSITOS`);
      console.log(`   Límite: ${pradonsitosBalance.limit || 'Sin límite'}\n`);
      
      if (parseFloat(pradonsitosBalance.balance) < 1000) {
        console.warn(`   ADVERTENCIA: Balance bajo (${pradonsitosBalance.balance} PRADONSITOS)`);
        console.warn(`   Puede que necesites emitir más tokens\n`);
      }
    } else {
      console.error(`   NO tiene trustline para PRADONSITOS`);
      console.error(`   La cuenta de distribución necesita crear trustline primero\n`);
      return false;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`   La cuenta de distribución ${distributionPublicKey.substring(0, 10)}... NO existe`);
      console.error('   Debe ser creada y fondeada primero\n');
      return false;
    }
    throw error;
  }

  // 4. Verificar que el asset existe consultando el issuer
  console.log('4. Verificando que el asset PRADONSITOS puede ser consultado...');
  try {
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', issuerKey);
    
    // Intentar buscar el asset en Horizon
    const assetInfo = await server.assets()
      .forAssetCode('PRADONSITOS')
      .forAssetIssuer(issuerKey)
      .call();
    
    console.log(`   Asset PRADONSITOS encontrado`);
    console.log(`   Cuentas que lo tienen: ${assetInfo.records[0]?.accounts?.authorized || 0}`);
    console.log(`   Total emitido: ${assetInfo.records[0]?.amount || 'N/A'}\n`);
  } catch (error) {
    console.warn(`   No se pudo consultar información completa del asset (puede ser normal si es nuevo)`);
    console.warn(`   El asset se crea automáticamente cuando se emite el primer pago\n`);
  }

  console.log('Verificación completada!\n');
  return true;
}

async function checkDistributionBalance() {
  if (!process.env.DISTRIBUTION_SECRET_KEY || !process.env.ISSUER_PUBLIC_KEY) {
    console.error('Faltan variables de entorno');
    return null;
  }

  try {
    const distributionKeypair = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTION_SECRET_KEY);
    const account = await server.loadAccount(distributionKeypair.publicKey());
    
    const pradonsitosBalance = account.balances.find(
      b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === process.env.ISSUER_PUBLIC_KEY
    );

    return pradonsitosBalance ? parseFloat(pradonsitosBalance.balance) : 0;
  } catch (error) {
    console.error('Error verificando balance:', error.message);
    return null;
  }
}

async function fixMissingTrustline() {
  console.log('Intentando crear trustline para cuenta de distribución...\n');

  if (!process.env.DISTRIBUTION_SECRET_KEY || !process.env.ISSUER_PUBLIC_KEY) {
    console.error('Faltan variables de entorno');
    return { success: false, error: 'Variables de entorno faltantes' };
  }

  try {
    const distributionKeypair = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTION_SECRET_KEY);
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', process.env.ISSUER_PUBLIC_KEY);

    const account = await server.loadAccount(distributionKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: pradonsitosAsset,
        limit: '1000000' // Límite de 1 millón
      }))
      .setTimeout(180)
      .build();

    transaction.sign(distributionKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('Trustline creada exitosamente!');
    console.log(`   TX Hash: ${result.hash}\n`);

    return { success: true, txHash: result.hash };
  } catch (error) {
    console.error('Error creando trustline:', error.message);
    if (error.response && error.response.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

async function issueInitialTokens(amount = '100000') {
  console.log(`Emitiendo ${amount} PRADONSITOS a cuenta de distribución...\n`);

  if (!process.env.ISSUER_SECRET_KEY || !process.env.DISTRIBUTION_SECRET_KEY || !process.env.ISSUER_PUBLIC_KEY) {
    console.error('Faltan variables de entorno');
    return { success: false, error: 'Variables de entorno faltantes' };
  }

  try {
    const issuerKeypair = StellarSdk.Keypair.fromSecret(process.env.ISSUER_SECRET_KEY);
    const distributionKeypair = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTION_SECRET_KEY);
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', process.env.ISSUER_PUBLIC_KEY);

    // Verificar que la cuenta de distribución tiene trustline
    const distributionAccount = await server.loadAccount(distributionKeypair.publicKey());
    const hasTrustline = distributionAccount.balances.some(
      b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === process.env.ISSUER_PUBLIC_KEY
    );

    if (!hasTrustline) {
      console.error('La cuenta de distribución NO tiene trustline. Créala primero.');
      return { success: false, error: 'Falta trustline en cuenta de distribución' };
    }

    // Cargar cuenta emisora
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    // Crear transacción de pago
    const transaction = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: distributionKeypair.publicKey(),
        asset: pradonsitosAsset,
        amount: amount
      }))
      .addMemo(StellarSdk.Memo.text('Initial token issuance'))
      .setTimeout(180)
      .build();

    transaction.sign(issuerKeypair);
    const result = await server.submitTransaction(transaction);

    console.log('Tokens emitidos exitosamente!');
    console.log(`   TX Hash: ${result.hash}\n`);

    return { success: true, txHash: result.hash, amount };
  } catch (error) {
    console.error('Error emitiendo tokens:', error.message);
    if (error.response && error.response.data) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'verify') {
    verifyAssetConfiguration().catch(console.error);
  } else if (command === 'trustline') {
    fixMissingTrustline().catch(console.error);
  } else if (command === 'issue') {
    const amount = process.argv[3] || '100000';
    issueInitialTokens(amount).catch(console.error);
  } else if (command === 'balance') {
    checkDistributionBalance().then(balance => {
      console.log(`Balance de distribución: ${balance || 0} PRADONSITOS`);
    }).catch(console.error);
  } else {
    console.log('Uso: node verify-asset.js [verify|trustline|issue|balance]');
    console.log('');
    console.log('  verify    - Verifica la configuración del asset');
    console.log('  trustline - Crea trustline si falta');
    console.log('  issue     - Emite tokens iniciales');
    console.log('  balance   - Muestra balance de la cuenta de distribución');
  }
}

module.exports = {
  verifyAssetConfiguration,
  checkDistributionBalance,
  fixMissingTrustline,
  issueInitialTokens
};

