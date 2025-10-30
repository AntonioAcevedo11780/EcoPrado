const StellarSdk = require('@stellar/stellar-sdk');
const fs = require('fs');
const path = require('path');

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

async function setupStellarAccounts() {
  console.log('🌱 Configurando cuentas Stellar para EcoPrado...\n');

  try {
    const issuerKeypair = StellarSdk.Keypair.random();
    console.log('1️⃣ Cuenta Emisora creada');
    console.log('   Public:', issuerKeypair.publicKey());
    
    const distributionKeypair = StellarSdk.Keypair.random();
    console.log('\n2️⃣ Cuenta Distribución creada');
    console.log('   Public:', distributionKeypair.publicKey());

    console.log('\n3️⃣ Fondeando cuentas...');
    await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
    console.log('   ✅ Emisora fondeada');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await fetch(`https://friendbot.stellar.org?addr=${distributionKeypair.publicKey()}`);
    console.log('   ✅ Distribución fondeada');

    console.log('\n4️⃣ Creando token PRADONSITOS...');
    const pradonsitosAsset = new StellarSdk.Asset('PRADONSITOS', issuerKeypair.publicKey());

    console.log('\n5️⃣ Configurando trustline...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const distributionAccount = await server.loadAccount(distributionKeypair.publicKey());
    
    const trustTransaction = new StellarSdk.TransactionBuilder(distributionAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.changeTrust({
        asset: pradonsitosAsset,
        limit: '1000000'
      }))
      .setTimeout(180)
      .build();
    
    trustTransaction.sign(distributionKeypair);
    await server.submitTransaction(trustTransaction);
    console.log('   ✅ Trustline configurada');

    console.log('\n6️⃣ Emitiendo tokens iniciales...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    
    const paymentTransaction = new StellarSdk.TransactionBuilder(issuerAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET
    })
      .addOperation(StellarSdk.Operation.payment({
        destination: distributionKeypair.publicKey(),
        asset: pradonsitosAsset,
        amount: '100000'
      }))
      .setTimeout(180)
      .build();
    
    paymentTransaction.sign(issuerKeypair);
    await server.submitTransaction(paymentTransaction);
    console.log('   ✅ 100,000 PRADONSITOS emitidos');

    const envPath = path.join(__dirname, '../.env');
    
    // Crear .env si no existe
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      // Crear archivo .env básico
      envContent = `# Configuración Stellar Testnet
HORIZON_URL=https://horizon-testnet.stellar.org
PORT=3001
`;
    }
    
    // Actualizar o agregar variables
    if (envContent.includes('ISSUER_PUBLIC_KEY=')) {
      envContent = envContent.replace(/ISSUER_PUBLIC_KEY=.*/g, `ISSUER_PUBLIC_KEY=${issuerKeypair.publicKey()}`);
    } else {
      envContent += `ISSUER_PUBLIC_KEY=${issuerKeypair.publicKey()}\n`;
    }
    
    if (envContent.includes('ISSUER_SECRET_KEY=')) {
      envContent = envContent.replace(/ISSUER_SECRET_KEY=.*/g, `ISSUER_SECRET_KEY=${issuerKeypair.secret()}`);
    } else {
      envContent += `ISSUER_SECRET_KEY=${issuerKeypair.secret()}\n`;
    }
    
    if (envContent.includes('DISTRIBUTION_PUBLIC_KEY=')) {
      envContent = envContent.replace(/DISTRIBUTION_PUBLIC_KEY=.*/g, `DISTRIBUTION_PUBLIC_KEY=${distributionKeypair.publicKey()}`);
    } else {
      envContent += `DISTRIBUTION_PUBLIC_KEY=${distributionKeypair.publicKey()}\n`;
    }
    
    if (envContent.includes('DISTRIBUTION_SECRET_KEY=')) {
      envContent = envContent.replace(/DISTRIBUTION_SECRET_KEY=.*/g, `DISTRIBUTION_SECRET_KEY=${distributionKeypair.secret()}`);
    } else {
      envContent += `DISTRIBUTION_SECRET_KEY=${distributionKeypair.secret()}\n`;
    }
    
    if (!envContent.includes('HORIZON_URL=')) {
      envContent += `HORIZON_URL=https://horizon-testnet.stellar.org\n`;
    }
    
    if (!envContent.includes('PORT=')) {
      envContent += `PORT=3001\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Configuración guardada en .env');

    console.log('\n✨ Setup completado exitosamente!');
    console.log('\n🚀 Ahora ejecuta: npm run dev');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupStellarAccounts();
