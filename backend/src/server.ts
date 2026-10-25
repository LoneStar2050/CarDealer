import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';

/** Entry point: prepares the database schema, then starts the HTTP server. */
const pool = createPool(config.databaseUrl);
await migrate(pool);

createApp({ pool, jwt: config.jwt }).listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
