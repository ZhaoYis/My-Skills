import type { PipelineReport } from '../harness/types.js';
import { JsonReporter } from './JsonReporter.js';
import { MarkdownReporter } from './MarkdownReporter.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(__dirname, '../../reports');

/**
 * Generate both JSON and Markdown reports from a PipelineReport.
 * Returns paths to the generated files.
 */
export class ReportGenerator {
  private jsonReporter: JsonReporter;
  private markdownReporter: MarkdownReporter;

  constructor(outputDir?: string) {
    const dir = outputDir || REPORTS_DIR;
    this.jsonReporter = new JsonReporter(dir);
    this.markdownReporter = new MarkdownReporter(dir);
  }

  async generate(report: PipelineReport): Promise<{ jsonPath: string; markdownPath: string }> {
    const jsonPath = await this.jsonReporter.generate(report);
    const markdownPath = await this.markdownReporter.generate(report);
    return { jsonPath, markdownPath };
  }
}
