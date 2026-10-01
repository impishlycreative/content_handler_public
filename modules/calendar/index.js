function accountLabel(identity) {
  return identity?.displayName || identity?.email || identity?.uid || 'this account';
}

export default {
  id: 'calendar',
  title: 'Calendar Manager',
  permissions: [],

  async mount({ container, identity, serviceApi, ui, signal }) {
    const heading = ui.element('div');
    heading.append(
      ui.element('p', 'CALENDAR MANAGEMENT', 'eyebrow'),
      ui.element('h1', 'Calendar Manager'),
      ui.element(
        'p',
        'Shared-authentication test: use the current Content Handler Firebase session to authorize directly against the existing Calendar Manager Apps Script backend.',
        'help'
      )
    );

    const result = ui.element('div', '', 'empty');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');

    const retry = ui.element('button', 'Run authentication test', 'secondary');
    retry.type = 'button';

    const note = ui.element(
      'p',
      'No second password is requested. The Firebase ID token is not displayed or stored by this module; it is sent only in the POST body to Calendar Manager.',
      'help'
    );

    container.append(heading, result, retry, note);

    async function run() {
      if (signal.aborted || retry.disabled) return;
      retry.disabled = true;
      result.className = 'empty';
      result.textContent = 'Checking Calendar Manager with the current Content Handler session…';

      try {
        await serviceApi('calendar', 'authorize', {});
        if (signal.aborted) return;
        result.className = 'notice success';
        result.textContent =
          `PASS: Calendar Manager accepted the same Firebase identity Content Handler is using for ${accountLabel(identity)}. No second sign-in was used.`;
      } catch (error) {
        if (signal.aborted) return;
        result.className = 'notice error';
        result.textContent =
          `FAIL: Calendar Manager did not authorize the shared session. ${error?.code ? error.code + ': ' : ''}${error?.message || 'The request failed.'}`;
      } finally {
        retry.disabled = false;
      }
    }

    retry.addEventListener('click', run);
    await run();

    return () => {
      retry.removeEventListener('click', run);
      container.replaceChildren();
    };
  }
};
