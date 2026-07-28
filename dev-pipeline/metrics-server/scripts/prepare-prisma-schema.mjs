import { preparePrisma } from './prisma-config.mjs';

const config = await preparePrisma();
process.stdout.write(`Prepared Prisma schema and migrations for ${config.provider}\n`);
