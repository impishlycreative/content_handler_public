import * as ui from './ui.js';
import { mountProfile } from './profile.js';

export async function startShell({ config, registry, session }) {
  const $ = selector => document.querySelector(selector);
  const content = $('#content');
  let active = null;
  let routeVersion = 0;
  let loginBusy = false;

  function clearModule() {
    routeVersion++;
    active?.controller.abort();
    try { active?.cleanup?.(); } catch { /* A failed cleanup cannot retain a protected view. */ }
    active = null; content.replaceChildren();
  }

  function showLogin(message = '') {
    clearModule(); $('#workspace').hidden = true; $('#login').hidden = false;
    $('#password').value = ''; $('#loginError').textContent = message;
  }

  function accountLabel(identity) {
    return identity?.displayName || identity?.email || identity?.uid || '';
  }

  function accountInitial(identity) {
    return accountLabel(identity).trim().charAt(0).toUpperCase() || '?';
  }

  function renderAccount(identity) {
    $('#account').textContent = accountLabel(identity);
    $('#profileAvatar').textContent = accountInitial(identity);
    $('#profileAvatar').title = 'Open profile';
    $('#account').title = 'Open profile';
  }

  async function route() {
    if (!session.identity || !session.check()) return;
    clearModule(); ui.notice($('#status'), '');
    const version = routeVersion;
    const id = location.hash.slice(1) || 'home';
    const allowed = registry.allowed(session.identity);
    $('#navigation').querySelectorAll('a').forEach(a => a.setAttribute('aria-current', a.hash === `#${id}` ? 'page' : 'false'));

    if (id === 'home') {
      content.append(ui.element('p', 'WORKSPACE', 'eyebrow'), ui.element('h1', 'Ready for what comes next.'));
      content.append(ui.element('p', allowed.length ? 'Choose a module to get started.' : 'You are signed in. No modules are enabled for this account.', 'help'));
      content.append(ui.element('div', 'Your shared workspace is ready.', 'empty'));
      return;
    }

    if (id === 'profile') {
      const controller = new AbortController();
      const container = ui.element('section');
      content.append(container);
      active = { controller };
      container.setAttribute('aria-busy', 'true');

      try {
        const cleanup = await mountProfile({
          container,
          session,
          signal: controller.signal,
          ui: Object.freeze({
            element: ui.element,
            status: (message, kind) => {
              if (version === routeVersion) ui.notice($('#status'), message, kind);
            }
          })
        });

        if (cleanup !== undefined && typeof cleanup !== 'function') throw new Error('Invalid profile cleanup.');
        if (version !== routeVersion) { cleanup?.(); return; }
        active.cleanup = cleanup;
        ui.notice($('#status'), '');
        content.focus();
      } catch {
        if (version === routeVersion) {
          clearModule();
          ui.notice($('#status'), 'Your profile could not load. Choose Home or try again.', 'error');
        }
      } finally {
        container.removeAttribute('aria-busy');
      }
      return;
    }

    const module = allowed.find(m => m.id === id);
    if (!module) { ui.notice($('#status'), 'This module is unavailable or you do not have access.', 'error'); return; }
    const controller = new AbortController();
    const container = ui.element('section'); content.append(container);
    active = { controller }; container.setAttribute('aria-busy', 'true');
    ui.notice($('#status'), 'Loading module…');
    try {
      const cleanup = await module.mount(Object.freeze({
        container, identity: session.identity, signal: controller.signal,
        api: (action, data) => {
          if (controller.signal.aborted) throw new Error('This module is no longer active.');
          if (!action.startsWith(`${module.id}.`)) throw new Error('Module actions must use their own namespace.');
          return session.api(action, data, controller.signal);
        },
        ui: Object.freeze({ element: ui.element, confirm: ui.confirmAction, status: (message, kind) => { if (version === routeVersion) ui.notice($('#status'), message, kind); } })
      }));
      if (cleanup !== undefined && typeof cleanup !== 'function') throw new Error('Invalid module cleanup.');
      if (version !== routeVersion) { cleanup?.(); return; }
      active.cleanup = cleanup; ui.notice($('#status'), ''); content.focus();
    } catch {
      if (version === routeVersion) { clearModule(); ui.notice($('#status'), 'This module could not load. Choose Home or try again.', 'error'); }
    } finally { container.removeAttribute('aria-busy'); }
  }

  function showWorkspace() {
    $('#login').hidden = true;
    $('#workspace').hidden = false;
    renderAccount(session.identity);
    $('#navigation').replaceChildren();
    for (const item of [{ id: 'home', title: 'Home' }, ...registry.allowed(session.identity)]) {
      const link = ui.element('a', item.title); link.href = `#${item.id}`; $('#navigation').append(link);
    }
    void route();
  }

  document.title = config.title; $('#appTitle').textContent = config.title;
  $('#loginTitle').textContent = config.title; $('#subtitle').textContent = config.subtitle;

  session.subscribe(identity => {
    if (!identity) {
      showLogin();
      return;
    }
    renderAccount(identity);
  });

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault(); if (loginBusy) return;
    loginBusy = true; $('#loginButton').disabled = true; $('#loginError').textContent = '';
    try { await session.login($('#email').value.trim(), $('#password').value); $('#password').value = ''; showWorkspace(); }
    catch (error) {
      const code = typeof error?.code === 'string' ? error.code : '';
      const message = typeof error?.message === 'string' ? error.message : '';
      const safeBackendCodes = new Set([
        'INVALID_TOKEN',
        'NOT_AUTHORIZED',
        'SERVER_CONFIG_ERROR',
        'HTTP_ERROR',
        'INVALID_RESPONSE',
        'CANCELLED'
      ]);
      const detail = safeBackendCodes.has(code)
        ? [code, message].filter(Boolean).join(': ')
        : (code.startsWith('auth/') ? code : '');
      showLogin(detail
        ? 'Sign-in failed — ' + detail
        : 'Sign-in failed. Check your details and account access, then try again.');
    }
    finally { loginBusy = false; $('#loginButton').disabled = false; }
  });

  $('#logout').addEventListener('click', async () => { try { await session.logout(); } catch { showLogin('Signed out of this workspace. Reload if sign-in is unavailable.'); } });
  window.addEventListener('hashchange', () => void route());
  setInterval(() => { if (session.identity) session.check(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && session.identity) session.check(); });
  try { if (await session.restore()) showWorkspace(); else showLogin(); }
  catch { showLogin('Your session could not be restored. Please sign in again.'); }
  $('#boot').hidden = true;
}
