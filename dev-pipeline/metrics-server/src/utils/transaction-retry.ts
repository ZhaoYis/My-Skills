const retryableCodes = new Set(['P2034']);

export function isRetryableTransactionError(error: unknown) {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && retryableCodes.has(String(error.code)),
  );
}

export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    baseDelayMs: number;
    onRetry?: (attempt: number, delayMs: number) => void;
    sleep?: (delayMs: number) => Promise<void>;
  },
) {
  const sleep =
    options.sleep ?? ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt >= options.maxAttempts) throw error;
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, delayMs);
      await sleep(delayMs);
    }
  }
}
