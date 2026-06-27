import type { PipelineReport } from '../harness/types.js';
import { PipelineReportSchema } from './ReportSchema.js';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Generate a JSON report and write it to the reports directory.
 */
export class JsonReporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generate(report: PipelineReport): Promise<string> {
    // Validate report against schema
    const parsed = PipelineReportSchema.parse(report);

    // Create timestamp-based directory
    const timestamp = formatTimestamp(new Date(report.meta.timestamp));
    const scenarioSlug = slugify(report.meta.scenarioName);
    const reportDir = path.join(this.outputDir, `${timestamp}-${scenarioSlug}`);
    await fs.ensureDir(reportDir);

    // Write JSON report
    const jsonPath = path.join(reportDir, 'report.json');
    await fs.writeJson(jsonPath, parsed, { spaces: 2 });

    // Update latest symlink
    const latestDir = path.join(this.outputDir, 'latest');
    try { await fs.remove(latestDir); } catch { /* ignore */ }
    try {
      await fs.symlink(path.relative(path.dirname(latestDir), reportDir), latestDir, 'dir');
    } catch {
      // Fallback: copy to latest if symlink not supported
      await fs.copy(reportDir, latestDir, { overwrite: true });
    }

    return jsonPath;
  }
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\..+/, '');
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
