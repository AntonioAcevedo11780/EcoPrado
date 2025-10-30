const StellarSdk = require('@stellar/stellar-sdk');
require('dotenv').config();

// Usar testnet por defecto si no está configurado
const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

console.log(`Usando Horizon: ${HORIZON_URL}`);

async function rewardUser(userPublicKey, amount, memo = '') {
  try {
    // Validar que las variables de entorno estén configuradas
    if (!process.env.DISTRIBUTION_SECRET_KEY || !process.env.ISSUER_PUBLIC_KEY) {
      console.error('Variables de entorno faltantes para Stellar:');
      console.error(`   DISTRIBUTION_SECRET_KEY: ${process.env.DISTRIBUTION_SECRET_KEY ? 'OK' : 'FALTA'}`);
      console.error(`   ISSUER_PUBLIC_KEY: ${process.env.ISSUER_PUBLIC_KEY ? 'OK' : 'FALTA'}`);
      return {
        success: false,
        error: 'Configuración de Stellar incompleta. Verifica .env (DISTRIBUTION_SECRET_KEY, ISSUER_PUBLIC_KEY)'
      };
    }

    const distributionKeypair = StellarSdk.Keypair.fromSecret(process.env.DISTRIBUTION_SECRET_KEY);
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', process.env.ISSUER_PUBLIC_KEY);

    console.log(`Enviando ${amount} PRADONSITOS a ${userPublicKey.substring(0, 10)}...`);

    // Cargar cuenta de distribución y verificar que tiene PRADONSITOS
    let distributionAccount;
    try {
      distributionAccount = await server.loadAccount(distributionKeypair.publicKey());
      console.log(`Cuenta distribución cargada (sequence: ${distributionAccount.sequenceNumber()})`);
      
      // VERIFICAR QUE LA CUENTA DE DISTRIBUCIÓN TIENE PRADONSITOS
      const distributionPradonsitosBalance = distributionAccount.balances.find(
        b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === process.env.ISSUER_PUBLIC_KEY
      );
      
      if (!distributionPradonsitosBalance) {
        console.error(`PROBLEMA CRITICO: La cuenta de distribución NO tiene trustline para PRADONSITOS`);
        console.error(`Ejecuta: node backend/stellar/verify-asset.js trustline`);
        return {
          success: false,
          error: 'La cuenta de distribución NO tiene trustline para PRADONSITOS. Debe configurarse primero.',
          errorCode: 'DISTRIBUTION_NO_TRUSTLINE',
          needsSetup: true
        };
      }
      
      const currentBalance = parseFloat(distributionPradonsitosBalance.balance);
      console.log(`Balance PRADONSITOS en distribución: ${currentBalance}`);
      
      if (currentBalance < amount) {
        console.error(`INSUFICIENTE: La cuenta de distribución solo tiene ${currentBalance} PRADONSITOS`);
        console.error(`Necesitas emitir más tokens. Ejecuta: node backend/stellar/verify-asset.js issue`);
        return {
          success: false,
          error: `La cuenta de distribución no tiene suficientes PRADONSITOS (tiene ${currentBalance}, necesita ${amount})`,
          errorCode: 'INSUFFICIENT_BALANCE',
          currentBalance,
          required: amount
        };
      }
      
      console.log(`Balance suficiente para enviar ${amount} PRADONSITOS`);
    } catch (error) {
      console.error(`No se pudo cargar cuenta distribución: ${error.message}`);
      return {
        success: false,
        error: `Cuenta de distribución no encontrada o sin fondos: ${error.message}`
      };
    }

    // Verificar que la cuenta destino tenga trustline ANTES de intentar enviar
    let hasTrustline = false;
    let accountExists = false;
    
    try {
      const userAccount = await server.loadAccount(userPublicKey);
      accountExists = true;
      
      hasTrustline = userAccount.balances.some(
        b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === process.env.ISSUER_PUBLIC_KEY
      );
      
      if (!hasTrustline) {
        console.log(`La cuenta destino NO tiene trustline para PRADONSITOS`);
        console.log(`Esta es la causa más común de fallo. La transacción fallará con código 'op_no_trust'`);
        console.log(`Solución: Crear trustline desde Freighter o usando la secret key del usuario`);
        
        // Intentar crear trustline usando la cuenta de distribución como patrocinador (si es posible)
        // NOTA: Esto requiere que la cuenta destino tenga XLM para fees, o usar sponsored reserves
        // Por ahora, solo informamos el problema
      } else {
        console.log(`Trustline encontrada en cuenta destino - listo para enviar tokens`);
      }
    } catch (error) {
      // Si no se puede cargar la cuenta, probablemente no existe o no tiene fondos
      console.error(`Error verificando cuenta destino: ${error.message}`);
      
      // Si es error 404 (cuenta no existe), dar mensaje más claro
      if (error.response && error.response.status === 404) {
        return {
          success: false,
          error: `La cuenta ${userPublicKey.substring(0, 10)}... no existe en Stellar Testnet. Debe ser creada y fondeada primero (mínimo 1 XLM).`,
          errorCode: 'ACCOUNT_NOT_FOUND'
        };
      }
      
      // Para otros errores, intentar la transacción igual (puede que la cuenta exista pero haya error de red)
      console.log(`Continuando a pesar del error de verificación...`);
      accountExists = false; // Asumimos que no existe para ser seguros
    }
    
    // Si no tiene trustline, dar mensaje claro ANTES de que falle
    if (accountExists && !hasTrustline) {
      return {
        success: false,
        error: `La cuenta destino necesita trustline para PRADONSITOS antes de recibir tokens. Créala desde Freighter o usa la secret key.`,
        errorCode: 'NO_TRUSTLINE',
        needsTrustline: true,
        issuerKey: process.env.ISSUER_PUBLIC_KEY
      };
    }

    // Crear transacción
    const transaction = new StellarSdk.TransactionBuilder(distributionAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: userPublicKey,
        asset: pradonsitosAsset,
        amount: amount.toString()
      }))
      .addMemo(StellarSdk.Memo.text(memo.substring(0, 28)))
      .setTimeout(180)
      .build();

    transaction.sign(distributionKeypair);
    
    console.log(`Enviando transacción a Stellar Testnet...`);
    const result = await server.submitTransaction(transaction);

    console.log(`Transacción exitosa! Hash: ${result.hash}`);
    return {
      success: true,
      hash: result.hash,
      amount,
      recipient: userPublicKey
    };

  } catch (error) {
    console.error('Error detallado enviando recompensa:');
    console.error('Error completo:', JSON.stringify(error.response?.data || error.message, null, 2));
    
    // Extraer mensaje de error más descriptivo desde result_codes
    let errorMessage = error.message;
    let resultCodes = null;
    let operationResultCode = null;
    let transactionResultCode = null;
    
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      
      // Extraer result_codes que son lo más importante (según docs de Stellar)
      if (errorData.extras && errorData.extras.result_codes) {
        resultCodes = errorData.extras.result_codes;
        operationResultCode = resultCodes.operations || null;
        transactionResultCode = resultCodes.transaction || null;
        
        console.error('Result Codes:', JSON.stringify(resultCodes, null, 2));
        
        // Mensajes específicos según el código de error (basado en docs Stellar)
        if (Array.isArray(operationResultCode) && operationResultCode.length > 0) {
          const opError = operationResultCode[0];
          
          if (opError === 'op_no_trust' || opError === 'NO_TRUST') {
            errorMessage = 'La cuenta destino NO tiene trustline para PRADONSITOS. Debe crearla primero en Stellar.';
          } else if (opError === 'op_line_full' || opError === 'LINE_FULL') {
            errorMessage = 'El límite de la trustline está lleno. Aumenta el límite.';
          } else if (opError === 'op_underfunded' || opError === 'UNDERFUNDED') {
            errorMessage = 'La cuenta de distribución no tiene suficientes PRADONSITOS para enviar.';
          } else if (opError === 'op_no_destination' || opError === 'NO_DESTINATION') {
            errorMessage = 'La cuenta destino no existe o no está activa en Stellar Testnet.';
          } else if (opError === 'op_low_reserve' || opError === 'LOW_RESERVE') {
            errorMessage = 'La cuenta no tiene suficientes XLM para mantener el balance mínimo.';
          } else if (opError === 'op_already_exists' || opError === 'ALREADY_EXISTS') {
            errorMessage = 'La operación ya existe (posible duplicado).';
          } else {
            errorMessage = `Error en operación Stellar: ${opError}`;
          }
        } else if (typeof operationResultCode === 'string') {
          // Si es string directo
          if (operationResultCode.includes('NO_TRUST') || operationResultCode.includes('no_trust')) {
            errorMessage = 'La cuenta destino NO tiene trustline para PRADONSITOS. Debe crearla primero.';
          } else {
            errorMessage = `Error en operación: ${operationResultCode}`;
          }
        }
        
        if (transactionResultCode) {
          if (transactionResultCode === 'tx_bad_auth' || transactionResultCode === 'BAD_AUTH') {
            errorMessage = 'Error de autenticación en la transacción (bad auth).';
          } else if (transactionResultCode === 'tx_insufficient_fee' || transactionResultCode === 'INSUFFICIENT_FEE') {
            errorMessage = 'Fee insuficiente para la transacción.';
          } else if (!operationResultCode) {
            errorMessage = `Error en transacción: ${transactionResultCode}`;
          }
        }
        
        if (errorData.detail && errorMessage === error.message) {
          errorMessage = errorData.detail;
        }
      } else if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    }
    
    console.error(`Error final: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      resultCodes: resultCodes,
      operationCode: operationResultCode,
      transactionCode: transactionResultCode,
      details: error.response?.data || error.message
    };
  }
}

async function getUserBalance(userPublicKey) {
  try {
    if (!process.env.ISSUER_PUBLIC_KEY) {
      console.log('ISSUER_PUBLIC_KEY no configurado, no se puede obtener balance de Stellar');
      return 0;
    }
    
    const account = await server.loadAccount(userPublicKey);
    const pradonsitosBalance = account.balances.find(
      b => b.asset_code === 'PRADONSITOS' && b.asset_issuer === process.env.ISSUER_PUBLIC_KEY
    );

    const balance = pradonsitosBalance ? parseFloat(pradonsitosBalance.balance) : 0;
    if (balance > 0) {
      console.log(`Balance Stellar encontrado: ${balance} PRADONSITOS`);
    }
    return balance;

  } catch (error) {
    // Si la cuenta no existe o tiene error, retornar 0
    console.log(`No se pudo obtener balance de Stellar: ${error.message}`);
    return 0;
  }
}

async function setupUserTrustline(userPublicKey, userSecretKey) {
  try {
    const userKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', process.env.ISSUER_PUBLIC_KEY);
    
    const userAccount = await server.loadAccount(userPublicKey);
    
    const transaction = new StellarSdk.TransactionBuilder(userAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: pradonsitosAsset,
        limit: '10000'
      }))
      .setTimeout(180)
      .build();
    
    transaction.sign(userKeypair);
    await server.submitTransaction(transaction);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  rewardUser,
  getUserBalance,
  setupUserTrustline
};
