import { createImageEditor, safeImageUrl } from './image-editor.js';

function descriptionText(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  template.content
    .querySelectorAll('script, style, iframe, object')
    .forEach(node => node.remove());
  template.content
    .querySelectorAll('br')
    .forEach(node => node.replaceWith('\n'));
  template.content
    .querySelectorAll('p, div, li')
    .forEach(node => node.append('\n'));
  return template.content.textContent.trim();
}

function toLocal(value) {
  if (!value) return '';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const pad = number => String(number).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date to be confirmed';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function previewDate(value, options, fallback) {
  const date = value ? new Date(value) : null;

  if (!date || !Number.isFinite(date.getTime())) return fallback;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    ...options
  }).format(date);
}

function makeButton(text, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

function previewNode(event) {
  const article = document.createElement('article');
  article.className = 'calendar-site-preview';

  const date = document.createElement('div');
  date.className = 'calendar-preview-date';

  const month = document.createElement('span');
  month.textContent = previewDate(event.start, { month: 'short' }, 'TBD');

  const day = document.createElement('strong');
  day.textContent = previewDate(event.start, { day: '2-digit' }, '—');

  const year = document.createElement('small');
  year.textContent = previewDate(event.start, { year: 'numeric' }, '');

  date.append(month, day, year);

  const body = document.createElement('div');
  body.className = 'calendar-preview-body';

  const type = document.createElement('span');
  type.className = 'calendar-preview-type';
  type.textContent =
    (event.featured ? 'Featured Event · ' : '') +
    (event.type || 'Meeting');

  const title = document.createElement('h3');
  title.textContent = event.title || 'Untitled event';

  body.append(type, title);

  const imageUrl = safeImageUrl(event.image);
  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'calendar-preview-image';
    image.src = imageUrl;
    image.alt = event.imageAlt || '';
    body.append(image);
  }

  const description = document.createElement('p');
  description.className = 'calendar-preview-description';
  description.textContent =
    descriptionText(event.description)
      .replace(/\[KCW_METADATA\][\s\S]*?(?:\[\/KCW_METADATA\]|$)/gi, '')
      .trim() || 'Description to come.';
  body.append(description);

  const details = document.createElement('div');
  details.className = 'calendar-preview-details';

  const when = document.createElement('div');
  const whenLabel = document.createElement('strong');
  whenLabel.textContent = 'When';

  const dayOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  };
  const timeOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  const startDay = previewDate(event.start, dayOptions, 'Date to be confirmed');
  const endDay = previewDate(event.end, dayOptions, '');

  when.append(whenLabel);
  when.append(
    document.createTextNode(
      startDay +
        (endDay && endDay !== startDay ? ` – ${endDay}` : '') +
        '\n' +
        previewDate(event.start, timeOptions, 'Time to be confirmed') +
        (event.end
          ? ` – ${previewDate(event.end, timeOptions, 'End time to be confirmed')}`
          : '')
    )
  );

  const where = document.createElement('div');
  const whereLabel = document.createElement('strong');
  whereLabel.textContent = 'Where';
  where.append(
    whereLabel,
    document.createTextNode(event.location || 'Location to be confirmed')
  );

  details.append(when, where);
  body.append(details);
  article.append(date, body);

  return article;
}

export default {
  id: 'calendar',
  title: 'Calendar Manager',
  permissions: [],
  anyPermissions: ['calendar.read', 'content.admin'],

  async mount({ container, identity, serviceApi, ui, signal }) {
    container.classList.add('calendar-module');

    container.innerHTML = `
      <div class="calendar-toolbar">
        <div>
          <p class="eyebrow">CALENDAR MANAGEMENT</p>
          <h1>Calendar entries</h1>
          <p class="help">Create, edit, preview, publish, and remove events from the managed Google Calendar.</p>
        </div>
        <button id="calendarAddButton" type="button" class="primary">+ Add event</button>
      </div>

      <div id="calendarStatus" class="calendar-notice" role="status" hidden></div>
      <section id="calendarEvents" class="calendar-event-list" aria-live="polite"></section>

      <dialog id="calendarEventDialog" class="calendar-dialog">
        <form id="calendarEventForm">
          <div class="calendar-dialog-head">
            <div>
              <strong id="calendarEditorStatus" class="calendar-editor-status">Draft</strong>
              <h2 id="calendarDialogTitle">Add event</h2>
            </div>
            <button type="button" id="calendarCloseDialog" class="calendar-icon-button" aria-label="Close">×</button>
          </div>

          <p id="calendarEditorError" class="calendar-notice calendar-error" role="alert" hidden></p>
          <input type="hidden" id="calendarEventId">

          <label>
            Type
            <select id="calendarType" required>
              <option value="Meeting">Meeting</option>
              <option value="Contest">Contest</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label>
            Title
            <input id="calendarTitle" maxlength="160" required>
          </label>

          <div class="calendar-grid2">
            <label>
              Start
              <input id="calendarStart" type="datetime-local" required>
            </label>
            <label>
              End
              <input id="calendarEnd" type="datetime-local" required>
            </label>
          </div>

          <label>
            Location
            <select id="calendarLocation" required>
              <option value="" disabled>Select a location</option>
              <option value="Tallman room">Tallman room</option>
              <option value="Virtual">Virtual</option>
            </select>
          </label>

          <label class="calendar-checkbox-label">
            <input id="calendarFeatured" type="checkbox">
            Featured
          </label>

          <label>
            Hover text
            <input id="calendarHoverText" maxlength="500">
          </label>

          <label>
            Description
            <textarea id="calendarDescription" rows="6" maxlength="5000"></textarea>
          </label>

          <fieldset class="calendar-image-editor">
            <legend>Event image</legend>
            <input id="calendarImageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>
            <button id="calendarChooseImage" type="button" class="secondary">Choose image</button>
            <p id="calendarImageSelection" class="help" role="status">No image selected.</p>
            <p id="calendarImageNotice" class="help" role="status"></p>
            <img id="calendarImageThumbnail" class="calendar-image-thumbnail" alt="" hidden>
            <label>
              Automatic filename
              <input id="calendarImageFilename" maxlength="105" readonly disabled>
            </label>
            <label>
              Image description
              <input id="calendarImageAlt" maxlength="500" placeholder="Describe the image for people who cannot see it">
            </label>
            <button type="button" id="calendarDiscardImage" class="secondary" hidden>Discard pending image</button>
          </fieldset>

          <div class="calendar-dialog-actions">
            <button type="button" id="calendarCancelButton" class="secondary">Cancel</button>
            <button type="submit" id="calendarSaveDraft" value="Draft" class="secondary">Save as Draft</button>
            <button type="button" id="calendarPreviewEditor" class="secondary">Preview</button>
            <button type="submit" id="calendarPublishEvent" value="Published" class="primary">Publish</button>
          </div>
        </form>
      </dialog>

      <dialog id="calendarPreviewDialog" class="calendar-dialog calendar-preview-dialog" aria-labelledby="calendarPreviewTitle">
        <div class="calendar-confirm">
          <div class="calendar-dialog-head">
            <h2 id="calendarPreviewTitle">Event preview</h2>
            <button type="button" id="calendarClosePreview" class="calendar-icon-button" aria-label="Close preview">×</button>
          </div>
          <p class="help">Preview only — nothing is saved or published.</p>
          <div id="calendarPreviewContent"></div>
        </div>
      </dialog>
    `;

    const q = selector => container.querySelector(selector);
    const eventsEl = q('#calendarEvents');
    const statusEl = q('#calendarStatus');
    const dialog = q('#calendarEventDialog');
    const form = q('#calendarEventForm');
    const previewDialog = q('#calendarPreviewDialog');

    let events = [];
    let editorStatus = 'Draft';
    let saving = false;
    let disposed = false;

    const call = (action, data = {}) =>
      serviceApi('calendar', action, data);

    const imageEditor = createImageEditor({
      root: container,
      userId: identity.uid,
      api: call
    });

    const showStatus = (message, kind = '') => {
      if (disposed) return;
      statusEl.textContent = message;
      statusEl.className = `calendar-notice ${kind}`.trim();
      statusEl.hidden = false;
    };

    const clearStatus = () => {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.className = 'calendar-notice';
    };

    const errorMessage = error => {
      const messages = {
        NOT_AUTHORIZED:
          'Your account is not authorized to change calendar events.',
        SERVER_CONFIG_ERROR:
          'The calendar service is not configured correctly.',
        NOT_FOUND:
          'This event no longer exists. Reload the calendar.',
        INTERNAL_ERROR:
          'The calendar service could not complete the request.',
        INVALID_TOKEN:
          'Your session is no longer valid. Sign in again.',
        SESSION_EXPIRED:
          'Your session has expired. Sign in again.'
      };

      const code = error?.code || '';
      const message =
        messages[code] ||
        (code.startsWith('IMAGE_') || code === 'INVALID_REQUEST'
          ? error?.message
          : 'The request could not be completed. Check your connection and try again.');

      return code ? `${message} (${code})` : message;
    };

    function openPreview(event) {
      q('#calendarPreviewContent').replaceChildren(previewNode(event));
      previewDialog.showModal();
    }

    function renderEvents() {
      eventsEl.replaceChildren();

      if (!events.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No upcoming events.';
        eventsEl.append(empty);
        return;
      }

      for (const event of events) {
        const card = document.createElement('article');
        card.className = 'calendar-event-card';

        const copy = document.createElement('div');

        const badges = document.createElement('div');
        badges.className = 'calendar-badges';

        const status = document.createElement('strong');
        status.className = 'calendar-event-status';
        status.textContent =
          event.status === 'Published' ? 'Published' : 'Draft';
        badges.append(status);

        if (event.featured === true) {
          const featured = document.createElement('span');
          featured.className = 'calendar-featured-badge';
          featured.textContent = '★ Featured';
          badges.append(featured);
        }

        const date = document.createElement('div');
        date.className = 'calendar-event-date';
        date.textContent = formatDate(event.start);

        const title = document.createElement('h2');
        title.textContent = event.title || 'Untitled event';

        copy.append(badges, date, title);

        if (event.location) {
          const location = document.createElement('p');
          location.className = 'calendar-location';
          location.textContent = event.location;
          copy.append(location);
        }

        if (event.description) {
          const description = document.createElement('p');
          description.className = 'calendar-event-description';
          description.textContent = descriptionText(event.description);
          copy.append(description);
        }

        const actions = document.createElement('div');
        actions.className = 'calendar-event-actions';

        actions.append(
          makeButton('Preview', 'secondary', () => openPreview(event)),
          makeButton('Edit', 'secondary', () => openEditor(event)),
          makeButton('Delete', 'danger-outline', async () => {
            const confirmed = await ui.confirm(
              `Delete “${event.title || 'this event'}”? This cannot be undone.`
            );
            if (!confirmed) return;

            try {
              await call('deleteEvent', { id: event.id });
              showStatus('Event deleted.', 'calendar-success');
              await loadEvents();
            } catch (error) {
              showStatus(errorMessage(error), 'calendar-error');
            }
          })
        );

        card.append(copy, actions);
        eventsEl.append(card);
      }
    }

    async function loadEvents() {
      eventsEl.replaceChildren();
      const loading = document.createElement('div');
      loading.className = 'empty';
      loading.textContent = 'Loading events…';
      eventsEl.append(loading);

      try {
        const result = await call('listEvents', { status: 'All' });
        if (disposed || signal.aborted) return;

        events = Array.isArray(result?.events) ? result.events : [];
        renderEvents();
      } catch (error) {
        if (!disposed && !signal.aborted) {
          eventsEl.replaceChildren();
          showStatus(errorMessage(error), 'calendar-error');
        }
      }
    }

    function openEditor(event = null) {
      clearStatus();

      editorStatus =
        event?.status === 'Published' ? 'Published' : 'Draft';

      q('#calendarEditorError').hidden = true;
      q('#calendarEditorError').textContent = '';
      q('#calendarEditorStatus').textContent = editorStatus;
      q('#calendarPublishEvent').textContent =
        editorStatus === 'Published' ? 'Save Changes' : 'Publish';
      q('#calendarDialogTitle').textContent =
        event ? 'Edit event' : 'Add event';

      q('#calendarEventId').value = event?.id || '';
      q('#calendarTitle').value = event?.title || '';
      q('#calendarType').value = event?.type || 'Meeting';
      q('#calendarFeatured').checked = event?.featured === true;
      q('#calendarHoverText').value = event?.hoverText || '';
      q('#calendarStart').value = toLocal(event?.start);
      q('#calendarEnd').value = toLocal(event?.end);
      q('#calendarLocation').value = event?.location || '';
      q('#calendarDescription').value = event?.description || '';

      imageEditor.open(event);
      dialog.showModal();
    }

    q('#calendarAddButton').addEventListener('click', () => openEditor());
    q('#calendarCloseDialog').addEventListener('click', () => dialog.close());
    q('#calendarCancelButton').addEventListener('click', () => dialog.close());
    q('#calendarClosePreview').addEventListener('click', () => previewDialog.close());

    q('#calendarPreviewEditor').addEventListener('click', () => {
      openPreview({
        title: q('#calendarTitle').value.trim(),
        type: q('#calendarType').value,
        start: q('#calendarStart').value,
        end: q('#calendarEnd').value,
        location: q('#calendarLocation').value,
        description: q('#calendarDescription').value,
        hoverText: q('#calendarHoverText').value,
        featured: q('#calendarFeatured').checked,
        ...imageEditor.preview()
      });
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (saving) return;

      const id = q('#calendarEventId').value;
      const status =
        event.submitter?.value === 'Published'
          ? 'Published'
          : 'Draft';

      const errorEl = q('#calendarEditorError');
      errorEl.hidden = true;
      errorEl.textContent = '';

      const start = new Date(q('#calendarStart').value);
      const end = new Date(q('#calendarEnd').value);

      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start
      ) {
        errorEl.textContent =
          'Choose a valid end time after the start time.';
        errorEl.hidden = false;
        return;
      }

      if (
        id &&
        editorStatus === 'Published' &&
        status === 'Draft'
      ) {
        const confirmed = await ui.confirm(
          'Save as draft and remove this event from the public calendar? It will not appear publicly until published again.'
        );
        if (!confirmed) return;
      }

      const payload = {
        id,
        status,
        title: q('#calendarTitle').value.trim(),
        type: q('#calendarType').value,
        featured: q('#calendarFeatured').checked,
        hoverText: q('#calendarHoverText').value.trim() || null,
        start: start.toISOString(),
        end: end.toISOString(),
        location: q('#calendarLocation').value.trim(),
        description: q('#calendarDescription').value.trim()
      };

      saving = true;

      const controls = Array.from(
        form.querySelectorAll('button, input, textarea, select')
      );
      const disabledStates = controls.map(control => control.disabled);
      controls.forEach(control => {
        control.disabled = true;
      });

      try {
        Object.assign(payload, await imageEditor.forSave());
        await call(id ? 'updateEvent' : 'createEvent', payload);

        const clearedImage = imageEditor.saved();

        dialog.close();
        showStatus(
          (status === 'Draft'
            ? 'Event saved as draft.'
            : 'Event published.') +
            (clearedImage
              ? ''
              : ' The local image copy could not be cleared from browser storage.'),
          'calendar-success'
        );

        await loadEvents();
      } catch (error) {
        errorEl.textContent =
          error?.code || /^HTTP_|SESSION_EXPIRED/.test(error?.message || '')
            ? errorMessage(error)
            : error?.message || 'The event could not be saved.';
        errorEl.hidden = false;
      } finally {
        saving = false;
        controls.forEach((control, index) => {
          control.disabled = disabledStates[index];
        });
      }
    });

    dialog.addEventListener('cancel', event => {
      if (saving) event.preventDefault();
    });

    await loadEvents();

    return () => {
      disposed = true;
      if (dialog.open) dialog.close();
      if (previewDialog.open) previewDialog.close();
      container.classList.remove('calendar-module');
      container.replaceChildren();
    };
  }
};
