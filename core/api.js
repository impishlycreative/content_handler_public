export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function createTransport(config, fetcher = fetch) {
  return async (user, action, data = {}, signal) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, config.requestTimeoutMs);
    try {
      const token = await user.getIdToken();
      const response = await fetcher(config.apiUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, data }), signal: controller.signal,
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new ApiError('HTTP_ERROR', 'The service is unavailable. Please try again.');
      let result;
      try { result = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', 'The service returned an unreadable response.'); }
      if (!result || typeof result.ok !== 'boolean') throw new ApiError('INVALID_RESPONSE', 'The service returned an invalid response.');
      if (!result.ok) throw new ApiError(result.code || 'REQUEST_FAILED', result.message || 'The request failed.');
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw new ApiError('CANCELLED', 'The request was cancelled or timed out. Please try again.');
      throw error;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
  };
}
