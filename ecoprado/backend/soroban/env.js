const fs = require('fs');
const path = require('path');

function loadSorobanEnv() {
  const envPath = path.join(__dirname, '.env.soroban');
  const result = {
    STELLAR_NETWORK: process.env.STELLAR_NETWORK,
    RPC_URL: process.env.RPC_URL,
    HORIZON_URL: process.env.HORIZON_URL,
    ADMIN_PUBLIC_KEY: process.env.ADMIN_PUBLIC_KEY,
    ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY,
    CONTRACT_ID: process.env.CONTRACT_ID,
    TOKEN_CONTRACT_ID: process.env.TOKEN_CONTRACT_ID,
  };

  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) {
        const key = m[1];
        const val = m[2];
        if (!result[key]) result[key] = val;
      }
    }
  }

  return result;
}

module.exports = { loadSorobanEnv };


