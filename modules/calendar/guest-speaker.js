import calendar from './browser.js?v=20261007-2';

const GUEST_SPEAKER_TYPE = 'Guest Speaker';

function eventMapFrom(result) {
  return new Map(
    (Array.isArray(result?.events) ? result.events : [])
      .filter(event => event?.id)
      .map(event => [String(event.id), event])
  );
}

function addGuestSpeakerEditor(container) {
  const type = container.querySelector('#calendarType');
  const form = container.querySelector('#calendarEventForm');
  const eventId = container.querySelector('#calendarEventId');
  const dialog = container.querySelector('#calendarEventDialog');

  if (!type || !form || !eventId || !dialog) {
    throw new Error('Calendar guest-speaker editor could not find the event form.');
  }

  if (!Array.from(type.options).some(option => option.value === GUEST_SPEAKER_TYPE)) {
    type.add(new Option(GUEST_SPEAKER_TYPE, GUEST_SPEAKER_TYPE), 1);
  }

  const fields = document.createElement('fieldset');
  fields.id = 'calendarSpeakerFields';
  fields.className = 'calendar-image-editor';
  fields.hidden = true;
  fields.innerHTML = `
    <legend>Guest speaker</legend>
    <label>
      Speaker
      <input id="calendarSpeaker" maxlength="300" autocomplete="name">
    </label>
    <label>
      Speaker role
      <input id="calendarSpeakerRole" maxlength="300" placeholder="Author, editor, publisher, etc.">
    </label>
    <label>
      Speaker URL
      <input id="calendarSpeakerUrl" type="url" maxlength="2000" inputmode="url" placeholder="https://example.com">
    </label>
    <p class="help">These details are stored with the event and can be used by the public site for guest-speaker listings.</p>
  `;

  type.closest('label')?.insertAdjacentElement('afterend', fields);

  const speaker = fields.querySelector('#calendarSpeaker');
  const speakerRole = fields.querySelector('#calendarSpeakerRole');
  const speakerUrl = fields.querySelector('#calendarSpeakerUrl');

  function syncVisibility() {
    const isGuestSpeaker = type.value === GUEST_SPEAKER_TYPE;
    fields.hidden = !isGuestSpeaker;
    speaker.required = isGuestSpeaker;
  }

  function clear() {
    speaker.value = '';
    speakerRole.value = '';
    speakerUrl.value = '';
  }

  function populate(event) {
    speaker.value = event?.speaker || '';
    speakerRole.value = event?.speakerRole || '';
    speakerUrl.value = event?.speakerUrl || '';
    syncVisibility();
  }

  function payload() {
    const isGuestSpeaker = type.value === GUEST_SPEAKER_TYPE;
    return {
      speaker: isGuestSpeaker ? speaker.value.trim() || null : null,
      speakerRole: isGuestSpeaker ? speakerRole.value.trim() || null : null,
      speakerUrl: isGuestSpeaker ? speakerUrl.value.trim() || null : null
    };
  }

  type.addEventListener('change', syncVisibility);
  syncVisibility();

  return {
    dialog,
    eventId,
    populate,
    clear,
    payload,
    destroy() {
      type.removeEventListener('change', syncVisibility);
      fields.remove();
      Array.from(type.options)
        .find(option => option.value === GUEST_SPEAKER_TYPE)
        ?.remove();
    }
  };
}

function addShareRebuildButton(context) {
  const toolbar = context.container.querySelector('.calendar-toolbar');
  const status = context.container.querySelector('#calendarStatus');

  if (!toolbar || !status) {
    throw new Error('Calendar share rebuild control could not find the calendar toolbar.');
  }

  const button = document.createElement('button');
  button.id = 'calendarRebuildShares';
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = 'Rebuild share pages';
  button.title = 'Rebuild Open Graph share pages for all upcoming public Google Calendar events.';

  const addButton = toolbar.querySelector('#calendarAddButton');
  if (addButton) toolbar.insertBefore(button, addButton);
  else toolbar.append(button);

  const showStatus = (message, kind = '') => {
    status.textContent = message;
    status.className = `calendar-notice ${kind}`.trim();
    status.hidden = false;
  };

  const onClick = async () => {
    if (button.disabled) return;

    const confirmed = await context.ui.confirm(
      'Rebuild share pages for all upcoming public calendar events? Existing pages will only be updated when their generated content has changed.'
    );
    if (!confirmed) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Rebuilding…';
    showStatus('Rebuilding event share pages…');

    try {
      const result = await context.serviceApi('calendar', 'rebuildEventShares', {});
      const rebuild = result?.rebuild || {};
      const total = Number(rebuild.total || 0);
      const created = Number(rebuild.created || 0);
      const updated = Number(rebuild.updated || 0);
      const unchanged = Number(rebuild.unchanged || 0);
      const failed = Number(rebuild.failed || 0);

      showStatus(
        `Share-page rebuild complete: ${total} checked, ${created} created, ${updated} updated, ${unchanged} unchanged${failed ? `, ${failed} failed` : ''}.`,
        failed ? 'calendar-error' : 'calendar-success'
      );
    } catch (error) {
      const message = error?.message || 'The share pages could not be rebuilt.';
      showStatus(message, 'calendar-error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  button.addEventListener('click', onClick);

  return () => {
    button.removeEventListener('click', onClick);
    button.remove();
  };
}

export default {
  ...calendar,

  async mount(context) {
    let editor = null;
    let knownEvents = new Map();

    const serviceApi = async (moduleId, action, data = {}) => {
      let requestData = data;

      if (
        moduleId === 'calendar' &&
        (action === 'createEvent' || action === 'updateEvent') &&
        editor
      ) {
        requestData = {
          ...data,
          ...editor.payload()
        };
      }

      const result = await context.serviceApi(moduleId, action, requestData);

      if (moduleId === 'calendar' && action === 'listEvents') {
        knownEvents = eventMapFrom(result);
      }

      return result;
    };

    const cleanup = await calendar.mount({ ...context, serviceApi });

    if (context.signal.aborted) {
      cleanup?.();
      return () => {};
    }

    editor = addGuestSpeakerEditor(context.container);
    const removeShareRebuildButton = addShareRebuildButton({
      ...context,
      serviceApi
    });

    const syncFromDialog = () => {
      if (!editor.dialog.open) return;
      const id = editor.eventId.value;
      if (!id) {
        editor.clear();
        editor.populate(null);
        return;
      }
      editor.populate(knownEvents.get(String(id)) || null);
    };

    const dialogObserver = new MutationObserver(syncFromDialog);
    dialogObserver.observe(editor.dialog, {
      attributes: true,
      attributeFilter: ['open']
    });

    if (editor.dialog.open) syncFromDialog();

    return () => {
      dialogObserver.disconnect();
      removeShareRebuildButton?.();
      editor?.destroy();
      cleanup?.();
    };
  }
};
