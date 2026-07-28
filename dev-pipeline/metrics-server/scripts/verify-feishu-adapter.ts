import { createFeishuAdapter } from '../src/adapters/organization/feishu.js';
import { getEnv } from '../src/config/env.js';

const env = getEnv();
const adapter = createFeishuAdapter(env);
if (!adapter.configured) {
  console.log('SKIPPED: FEISHU_APP_ID and FEISHU_APP_SECRET are not configured');
  process.exit(0);
}

const organization = await adapter.pull();
console.log(
  JSON.stringify({
    status: 'verified',
    adapter: adapter.name,
    teams: organization.teams.length,
    developers: organization.developers.length,
  }),
);
