import fs from 'fs-extra';
import Handlebars from 'handlebars';
import type { DocLanguage, FeatureId } from '../adapters/types.js';

let helpersRegistered = false;

function ensureHandlebarsHelpers(): void {
  if (helpersRegistered) {
    return;
  }

  Handlebars.registerHelper(
    'hasFeature',
    function hasFeature(this: { features?: FeatureId[] }, feature: FeatureId) {
      return this.features?.includes(feature) ?? false;
    },
  );

  Handlebars.registerHelper(
    'isLanguage',
    function isLanguage(this: { language?: DocLanguage }, language: DocLanguage) {
      return this.language === language;
    },
  );

  Handlebars.registerHelper('isTool', function isTool(this: { toolId?: string }, toolId: string) {
    return this.toolId === toolId;
  });

  helpersRegistered = true;
}

export async function renderTemplate(
  filePath: string,
  context: Record<string, unknown>,
): Promise<string> {
  ensureHandlebarsHelpers();
  const source = await fs.readFile(filePath, 'utf8');
  return Handlebars.compile(source)(context);
}

export function renderString(template: string, context: Record<string, unknown>): string {
  ensureHandlebarsHelpers();
  return Handlebars.compile(template)(context);
}
