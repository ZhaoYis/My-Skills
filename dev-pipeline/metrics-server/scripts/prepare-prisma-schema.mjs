import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const templatePath = `${root}/prisma/schema.template.prisma`;
const outputPath = `${root}/prisma/schema.prisma`;
const provider = process.env.DB_PROVIDER || 'postgresql';

if (!['postgresql', 'mysql'].includes(provider)) {
  throw new Error(`Unsupported DB_PROVIDER: ${provider}`);
}

const template = await readFile(templatePath, 'utf8');
await writeFile(outputPath, template.replace('__DB_PROVIDER__', provider));
process.stdout.write(`Prepared Prisma schema for ${provider}\n`);
