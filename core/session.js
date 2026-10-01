import { ApiError } from './api.js';
const revoked = new Set(['INVALID_TOKEN', 'NOT_AUTHORIZED', 'SESSION_EXPIRED']);
const externalRevoked = new Set(['INVALID_TOKEN', 'SESSION_EXPIRED']);
export function createSession({ auth, transport, config, storage = sessionStorage, now = Date.now }) {
  const key = `${config.appId}:loginAt`;
  let identity = null;
  let generation = 0;
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => fn(identity));
  const invalidate = () => { generation++; identity = null; storage.removeItem(key); notify(); };
  const unsubscribe = auth.subscribe(user => { if (!user) invalidate(); });
  async function logout() { invalidate(); await auth.signOut(); }
  function requireUser() {
    const start = Number(storage.getItem(key));
    if (!identity || !auth.currentUser || !(start > 0) || now() < start || now() - start >= config.sessionMs) {
      throw new ApiError('SESSION_EXPIRED', 'Your session has ended. Please sign in again.');
    }
    return auth.currentUser;
  }
  function serviceEndpoint(serviceId) {
    const endpoint = config.serviceApiUrls?.[serviceId];
    if (!endpoint) throw new ApiError('INVALID_SERVICE', 'This service is not configured.');
    return endpoint;
  }
  async function authorize(user, attempt) {
    const response = await transport(user, 'authorize');
    if (attempt !== generation || auth.currentUser?.uid !== user.uid) throw new ApiError('SESSION_EXPIRED', 'Please sign in again.');
    if (response.identity?.uid !== user.uid || !Array.isArray(response.permissions) || response.permissions.some(p => typeof p !== 'string')) throw new ApiError('INVALID_RESPONSE', 'Authorization response is invalid.');
    identity = Object.freeze({ ...response.identity, permissions: Object.freeze([...response.permissions]) });
    notify();
    return identity;
  }
  return {
    get identity() { return identity; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async login(email, password) {
      identity = null; storage.removeItem(key);
      const attempt = ++generation;
      try {
        const user = await auth.signIn(email, password);
        const result = await authorize(user, attempt);
        storage.setItem(key, String(now()));
        return result;
      } catch (error) { await logout().catch(() => {}); throw error; }
    },
    async restore() {
      const start = Number(storage.getItem(key));
      if (!auth.currentUser || !(start > 0) || now() < start || now() - start >= config.sessionMs) { await logout(); return null; }
      try { return await authorize(auth.currentUser, ++generation); }
      catch (error) { await logout().catch(() => {}); throw error; }
    },
    async refresh() {
      const user = requireUser();
      return authorize(user, ++generation);
    },
    async api(action, data, signal) {
      try {
        const user = requireUser();
        const attempt = generation;
        const response = await transport(user, action, data, signal);
        const profile = response?.data ?? response;
        if (action === 'profile.update' && attempt === generation && identity?.uid === user.uid && typeof profile?.displayName === 'string') {
          identity = Object.freeze({ ...identity, displayName: profile.displayName });
          notify();
        }
        return response;
      }
      catch (error) { if (revoked.has(error.code)) await logout().catch(() => {}); throw error; }
    },
    async serviceApi(serviceId, action, data, signal) {
      try {
        const user = requireUser();
        return await transport(user, action, data, signal, serviceEndpoint(serviceId));
      } catch (error) {
        if (externalRevoked.has(error.code)) await logout().catch(() => {});
        throw error;
      }
    },
    check() { try { requireUser(); return true; } catch { void logout().catch(() => {}); return false; } },
    logout,
    dispose() { unsubscribe(); listeners.clear(); }
  };
}
