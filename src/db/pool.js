const { Pool } = require('pg');

function createPool(env) {
  const config = {
    connectionString: env.databaseUrl,
  };

  if (env.useSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
}

module.exports = { createPool };
