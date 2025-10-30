const StellarSdk = require('@stellar/stellar-sdk');
const { loadSorobanEnv } = require('./env');

function getSorobanConfig() {
  const cfg = loadSorobanEnv();
  const rpcUrl = cfg.RPC_URL || 'https://soroban-testnet.stellar.org';
  const networkPassphrase = StellarSdk.Networks.TESTNET;
  return {
    rpcUrl,
    networkPassphrase,
    contractId: cfg.CONTRACT_ID,
    adminPublic: cfg.ADMIN_PUBLIC_KEY,
    adminSecret: cfg.ADMIN_SECRET_KEY,
  };
}

async function invokeReportAction(userPublicKey, actionType, description, evidence) {
  const cfg = getSorobanConfig();

  if (!cfg.contractId || !cfg.adminSecret) {
    return { success: false, error: 'Soroban no configurado (falta CONTRACT_ID o ADMIN_SECRET_KEY)' };
  }

  const rpc = new StellarSdk.Rpc.Server(cfg.rpcUrl, { allowHttp: false });
  const adminKp = StellarSdk.Keypair.fromSecret(cfg.adminSecret);
  const contract = new StellarSdk.Contract(cfg.contractId);

  try {
    // Construir invocación del contrato: report_action(user, type, desc, evidence)
    const sourceAccount = await rpc.getAccount(adminKp.publicKey());

    let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100000',
      networkPassphrase: cfg.networkPassphrase,
    })
      .addOperation(contract.call('report_action', ...(function () {
        const scv = StellarSdk.scVal;
        return [
          scv.address(StellarSdk.Address.fromString(userPublicKey).toScAddress()),
          scv.symbol(actionType),
          scv.string(description || ''),
          scv.string(evidence || ''),
        ];
      })()))
      .setTimeout(120)
      .build();

    // Simular
    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      return { success: false, error: 'Simulación Soroban falló', details: sim };
    }

    // Preparar transacción con datos de simulación
    const prepared = StellarSdk.rpc.Api.prepareTransaction(tx, sim);

    // Firmar
    prepared.sign(adminKp);

    // Enviar
    const send = await rpc.sendTransaction(prepared);
    if (send.errorResult) {
      return { success: false, error: 'Envío Soroban falló', details: send };
    }

    return { success: true, txHash: send.hash };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { getSorobanConfig, invokeReportAction };


