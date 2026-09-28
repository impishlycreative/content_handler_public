export function validateConfig(config) {
  if (!/^[a-z][a-z0-9-]*$/.test(config.appId || '')) throw new Error('Set a unique application ID in site/config.js.');
  if (!config.firebase || ['apiKey', 'authDomain', 'projectId', 'appId'].some(k => !config.firebase[k])) {
    throw new Error('Set your Firebase configuration in site/config.js.');
  }
  const endpoint = new URL(config.apiUrl);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname) || endpoint.search || endpoint.hash) {
    throw new Error('Set a deployed Apps Script HTTPS endpoint in site/config.js.');
  }
  if (!Number.isFinite(config.sessionMs) || config.sessionMs < 1000 || config.sessionMs > 3600000) throw new Error('Session duration must be between one second and one hour.');
  if (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs < 1000 || config.requestTimeoutMs > 60000) throw new Error('Request timeout must be between one and sixty seconds.');
  return config;
}
