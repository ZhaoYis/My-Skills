export type SchedulerJob = 'collector' | 'retention';
export type SchedulerRunStatus = 'success' | 'error';
export type CollectionRunStatus = 'completed' | 'error' | 'cancelled' | 'timeout';

interface HistogramValue {
  count: number;
  sum: number;
  buckets: number[];
}

export interface SchedulerState {
  configured: boolean;
  running: boolean;
  lastRunAt?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastDurationSeconds?: number;
  runs: Record<SchedulerRunStatus, number>;
}

const durationBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

function escapeLabel(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function labels(values: Record<string, string>) {
  const entries = Object.entries(values);
  if (!entries.length) return '';
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`;
}

function metricHeader(name: string, help: string, type: 'counter' | 'gauge' | 'histogram') {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`];
}

function key(values: string[]) {
  return values.join('\0');
}

export class ObservabilityRegistry {
  private readonly apiRequests = new Map<string, number>();
  private readonly apiDurations = new Map<string, HistogramValue>();
  private readonly collectionRuns = new Map<string, number>();
  private readonly fingerprintRejections = new Map<string, number>();
  private readonly scheduler = new Map<SchedulerJob, SchedulerState>();

  observeApiRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    const status = String(statusCode);
    const metricKey = key([method, route, status]);
    this.apiRequests.set(metricKey, (this.apiRequests.get(metricKey) ?? 0) + 1);
    const histogram = this.apiDurations.get(metricKey) ?? {
      count: 0,
      sum: 0,
      buckets: durationBuckets.map(() => 0),
    };
    histogram.count += 1;
    histogram.sum += durationSeconds;
    for (let index = 0; index < durationBuckets.length; index += 1) {
      if (durationSeconds <= (durationBuckets[index] ?? 0)) {
        histogram.buckets[index] = (histogram.buckets[index] ?? 0) + 1;
      }
    }
    this.apiDurations.set(metricKey, histogram);
  }

  observeCollectionRun(status: CollectionRunStatus, errorCategory = 'none') {
    const metricKey = key([status, errorCategory]);
    this.collectionRuns.set(metricKey, (this.collectionRuns.get(metricKey) ?? 0) + 1);
  }

  observeFingerprintRejection(reasonCode: string) {
    this.fingerprintRejections.set(
      reasonCode,
      (this.fingerprintRejections.get(reasonCode) ?? 0) + 1,
    );
  }

  configureScheduler(job: SchedulerJob) {
    const current = this.scheduler.get(job) ?? this.emptySchedulerState();
    current.configured = true;
    this.scheduler.set(job, current);
  }

  startSchedulerRun(job: SchedulerJob, now = Date.now()) {
    const current = this.scheduler.get(job) ?? this.emptySchedulerState();
    current.configured = true;
    current.running = true;
    current.lastRunAt = now;
    this.scheduler.set(job, current);
  }

  finishSchedulerRun(
    job: SchedulerJob,
    status: SchedulerRunStatus,
    startedAt: number,
    now = Date.now(),
  ) {
    const current = this.scheduler.get(job) ?? this.emptySchedulerState();
    current.configured = true;
    current.running = false;
    current.lastDurationSeconds = Math.max(0, now - startedAt) / 1_000;
    current.runs[status] += 1;
    if (status === 'success') current.lastSuccessAt = now;
    else current.lastFailureAt = now;
    this.scheduler.set(job, current);
  }

  stopScheduler(job: SchedulerJob) {
    const current = this.scheduler.get(job);
    if (!current) return;
    current.configured = false;
    current.running = false;
  }

  getSchedulerState(job: SchedulerJob): SchedulerState {
    const current = this.scheduler.get(job) ?? this.emptySchedulerState();
    return { ...current, runs: { ...current.runs } };
  }

  reset() {
    this.apiRequests.clear();
    this.apiDurations.clear();
    this.collectionRuns.clear();
    this.fingerprintRejections.clear();
    this.scheduler.clear();
  }

  render() {
    const lines = [...metricHeader('opsx_api_requests_total', 'Total API requests.', 'counter')];
    for (const [metricKey, count] of [...this.apiRequests.entries()].sort()) {
      const [method = '', route = '', statusCode = ''] = metricKey.split('\0');
      lines.push(
        `opsx_api_requests_total${labels({ method, route, status_code: statusCode })} ${count}`,
      );
    }

    lines.push(
      ...metricHeader(
        'opsx_api_request_duration_seconds',
        'API request latency in seconds.',
        'histogram',
      ),
    );
    for (const [metricKey, histogram] of [...this.apiDurations.entries()].sort()) {
      const [method = '', route = '', statusCode = ''] = metricKey.split('\0');
      const baseLabels = { method, route, status_code: statusCode };
      durationBuckets.forEach((boundary, index) => {
        lines.push(
          `opsx_api_request_duration_seconds_bucket${labels({ ...baseLabels, le: String(boundary) })} ${histogram.buckets[index] ?? 0}`,
        );
      });
      lines.push(
        `opsx_api_request_duration_seconds_bucket${labels({ ...baseLabels, le: '+Inf' })} ${histogram.count}`,
        `opsx_api_request_duration_seconds_sum${labels(baseLabels)} ${histogram.sum}`,
        `opsx_api_request_duration_seconds_count${labels(baseLabels)} ${histogram.count}`,
      );
    }

    lines.push(
      ...metricHeader('opsx_collection_jobs_total', 'Collection job outcomes.', 'counter'),
    );
    let completed = 0;
    let failed = 0;
    for (const [metricKey, count] of [...this.collectionRuns.entries()].sort()) {
      const [status = '', errorCategory = ''] = metricKey.split('\0');
      lines.push(
        `opsx_collection_jobs_total${labels({ status, error_category: errorCategory })} ${count}`,
      );
      if (status === 'completed') completed += count;
      if (status === 'error' || status === 'timeout') failed += count;
    }
    const attempts = completed + failed;
    lines.push(
      ...metricHeader(
        'opsx_collection_success_ratio',
        'Collection success ratio for completed and failed jobs in this process.',
        'gauge',
      ),
      `opsx_collection_success_ratio ${attempts ? completed / attempts : 0}`,
      ...metricHeader(
        'opsx_fingerprint_rejections_total',
        'Rejected fingerprints by stable reason code.',
        'counter',
      ),
    );
    for (const [reasonCode, count] of [...this.fingerprintRejections.entries()].sort()) {
      lines.push(
        `opsx_fingerprint_rejections_total${labels({ reason_code: reasonCode })} ${count}`,
      );
    }

    lines.push(
      ...metricHeader('opsx_scheduler_configured', 'Whether a scheduler is configured.', 'gauge'),
      ...metricHeader('opsx_scheduler_running', 'Whether a scheduler job is running.', 'gauge'),
      ...metricHeader(
        'opsx_scheduler_last_run_timestamp_seconds',
        'Unix timestamp of the last scheduler run start.',
        'gauge',
      ),
      ...metricHeader(
        'opsx_scheduler_last_success_timestamp_seconds',
        'Unix timestamp of the last successful scheduler run.',
        'gauge',
      ),
      ...metricHeader(
        'opsx_scheduler_last_failure_timestamp_seconds',
        'Unix timestamp of the last failed scheduler run.',
        'gauge',
      ),
      ...metricHeader(
        'opsx_scheduler_last_duration_seconds',
        'Duration of the last scheduler run.',
        'gauge',
      ),
      ...metricHeader('opsx_scheduler_runs_total', 'Scheduler run outcomes.', 'counter'),
    );
    for (const job of ['collector', 'retention'] as const) {
      const state = this.scheduler.get(job) ?? this.emptySchedulerState();
      const jobLabels = labels({ job });
      lines.push(
        `opsx_scheduler_configured${jobLabels} ${state.configured ? 1 : 0}`,
        `opsx_scheduler_running${jobLabels} ${state.running ? 1 : 0}`,
        `opsx_scheduler_last_run_timestamp_seconds${jobLabels} ${(state.lastRunAt ?? 0) / 1_000}`,
        `opsx_scheduler_last_success_timestamp_seconds${jobLabels} ${(state.lastSuccessAt ?? 0) / 1_000}`,
        `opsx_scheduler_last_failure_timestamp_seconds${jobLabels} ${(state.lastFailureAt ?? 0) / 1_000}`,
        `opsx_scheduler_last_duration_seconds${jobLabels} ${state.lastDurationSeconds ?? 0}`,
        `opsx_scheduler_runs_total${labels({ job, status: 'success' })} ${state.runs.success}`,
        `opsx_scheduler_runs_total${labels({ job, status: 'error' })} ${state.runs.error}`,
      );
    }
    return `${lines.join('\n')}\n`;
  }

  private emptySchedulerState(): SchedulerState {
    return {
      configured: false,
      running: false,
      runs: { success: 0, error: 0 },
    };
  }
}

export const observability = new ObservabilityRegistry();
export const prometheusContentType = 'text/plain; version=0.0.4; charset=utf-8';
