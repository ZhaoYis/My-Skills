import fs from 'fs-extra';
import Handlebars from 'handlebars';

export async function renderTemplate(filePath: string, context: Record<string, unknown>): Promise<string> {
  const source = await fs.readFile(filePath, 'utf8');
  return Handlebars.compile(source)(context);
}

export function renderString(template: string, context: Record<string, unknown>): string {
  return Handlebars.compile(template)(context);
}
