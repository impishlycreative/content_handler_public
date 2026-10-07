import calendar from './index.js?v=20261001-3';

const TZ = 'America/Toronto';
const STYLE_ID = 'calendar-browser-styles';
const MUTATIONS = new Set(['createEvent', 'updateEvent', 'deleteEvent']);
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('./browser.css?v=20261006-2', import.meta.url).href;
  document.head.append(link);
}

function parts(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Object.fromEntries(
    dayFormatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
}

function eventKey(value) {
  const p = parts(value);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}

function civilFromKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  return match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : null;
}

const today = () => civilFromKey(eventKey(new Date()));
const key = date => date.toISOString().slice(0, 10);

function addDays(date, amount) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
}

function weekStart(date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function formatCivil(date, options) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...options }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'TBD';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function periodLabel(view, anchor) {
  if (view === 'day') {
    return formatCivil(anchor, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }
  if (view === 'week') {
    const start = weekStart(anchor);
    const end = addDays(start, 6);
    return `${formatCivil(start, { month: 'short', day: 'numeric' })} – ${formatCivil(end, {
      month: 'short', day: 'numeric', year: 'numeric'
    })}`;
  }
  return formatCivil(anchor, { month: 'long', year: 'numeric' });
}

function groupEvents(events) {
  const grouped = new Map();
  [...events]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .forEach(event => {
      const day = eventKey(event.start);
      if (!day) return;
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day).push(event);
    });
  return grouped;
}

function eventNode(event, onEdit) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'calendar-browser-event';
  item.title = `Edit ${event.title || 'untitled event'}`;
  item.setAttribute('aria-label', `Edit ${event.title || 'untitled event'}`);
  item.addEventListener('click', () => onEdit(event));

  const time = document.createElement('span');
  time.className = 'calendar-browser-event-time';
  time.textContent = formatTime(event.start);

  const title = document.createElement('span');
  title.className = 'calendar-browser-event-title';
  title.textContent = `${event.featured === true ? '★ ' : ''}${event.title || 'Untitled event'}`;

  item.append(time, title);
  if (event.status && event.status !== 'Published') {
    const status = document.createElement('small');
    status.textContent = event.status;
    item.append(status);
  }
  return item;
}

function createBrowser({ container, serviceApi, signal }) {
  ensureStyles();
  const eventList = container.querySelector('#calendarEvents');
  if (!eventList) return null;

  const section = document.createElement('section');
  section.className = 'calendar-browser';
  section.innerHTML = `
    <div class="calendar-browser-controls">
      <div class="calendar-view-switcher" role="group" aria-label="Calendar view">
        <button type="button" class="secondary" data-view="day">Day</button>
        <button type="button" class="secondary" data-view="week">Week</button>
        <button type="button" class="secondary" data-view="month">Month</button>
      </div>
      <div class="calendar-browser-navigation" role="group" aria-label="Calendar navigation">
        <button type="button" class="secondary" data-nav="previous">‹ Previous</button>
        <button type="button" class="secondary" data-nav="today">Today</button>
        <button type="button" class="secondary" data-nav="next">Next ›</button>
      </div>
    </div>
    <div class="calendar-browser-heading">
      <h2 id="calendarBrowserTitle"></h2>
      <span id="calendarBrowserCount" class="calendar-browser-count"></span>
    </div>
    <div id="calendarBrowserGrid" class="calendar-browser-grid" aria-live="polite"></div>
    <p class="calendar-browser-window-note help">Click an event to edit it. Calendar browsing uses the service's configured archive and upcoming-event window.</p>
  `;

  const manageHeading = document.createElement('h2');
  manageHeading.className = 'calendar-manage-heading';
  manageHeading.textContent = 'Manage events';
  eventList.before(section, manageHeading);

  const grid = section.querySelector('#calendarBrowserGrid');
  const heading = section.querySelector('#calendarBrowserTitle');
  const count = section.querySelector('#calendarBrowserCount');
  const viewButtons = [...section.querySelectorAll('[data-view]')];

  let view = 'month';
  let anchor = today();
  let events = [];
  let disposed = false;
  let requestId = 0;
  const eventCards = new Map();

  function bindManageCards() {
    if (disposed || !events.length) return;
    const cards = [...eventList.querySelectorAll('.calendar-event-card')];
    if (cards.length !== events.length) return;

    eventCards.clear();
    events.forEach((event, index) => {
      const card = cards[index];
      if (!card || !event?.id) return;
      card.dataset.calendarEventId = event.id;
      card.hidden = event.state === 'Archived';
      eventCards.set(event.id, card);
    });
  }

  function openEditor(event) {
    bindManageCards();
    const card = eventCards.get(event.id);
    const editButton = card
      ? [...card.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit')
      : null;

    if (editButton) {
      editButton.click();
      return;
    }

    const status = container.querySelector('#calendarStatus');
    if (status) {
      status.textContent = 'The event editor could not be opened. Reload Calendar Manager and try again.';
      status.className = 'calendar-notice calendar-error';
      status.hidden = false;
    }
  }

  const manageObserver = new MutationObserver(() => {
    queueMicrotask(bindManageCards);
  });
  manageObserver.observe(eventList, { childList: true });

  function dayCell(date, grouped, outsideMonth = false) {
    const day = key(date);
    const cell = document.createElement('div');
    cell.className = 'calendar-browser-day';
    if (outsideMonth) cell.classList.add('calendar-browser-day--outside');
    if (day === key(today())) cell.classList.add('calendar-browser-day--today');

    const dateButton = document.createElement('button');
    dateButton.type = 'button';
    dateButton.className = 'calendar-browser-date-button';
    dateButton.textContent = formatCivil(date, { day: 'numeric' });
    dateButton.title = formatCivil(date, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    dateButton.addEventListener('click', () => {
      anchor = date;
      view = 'day';
      render();
    });

    const items = document.createElement('div');
    items.className = 'calendar-browser-day-events';
    (grouped.get(day) || []).forEach(event => items.append(eventNode(event, openEditor)));
    cell.append(dateButton, items);
    return cell;
  }

  function render() {
    if (disposed) return;
    heading.textContent = periodLabel(view, anchor);
    viewButtons.forEach(button => {
      const active = button.dataset.view === view;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('calendar-view-active', active);
    });

    const grouped = groupEvents(events);
    const fragment = document.createDocumentFragment();
    let visible = 0;

    if (view === 'day') {
      grid.className = 'calendar-browser-grid calendar-browser-grid--day';
      const items = grouped.get(key(anchor)) || [];
      visible = items.length;
      const wrap = document.createElement('div');
      wrap.className = 'calendar-browser-day-view';
      if (items.length) items.forEach(event => wrap.append(eventNode(event, openEditor)));
      else {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No events on this day.';
        wrap.append(empty);
      }
      fragment.append(wrap);
    } else if (view === 'week') {
      grid.className = 'calendar-browser-grid calendar-browser-grid--week';
      const start = weekStart(anchor);
      for (let index = 0; index < 7; index += 1) {
        const date = addDays(start, index);
        visible += (grouped.get(key(date)) || []).length;
        const cell = dayCell(date, grouped);
        const label = document.createElement('div');
        label.className = 'calendar-browser-weekday';
        label.textContent = formatCivil(date, { weekday: 'short', month: 'short', day: 'numeric' });
        cell.prepend(label);
        fragment.append(cell);
      }
    } else {
      grid.className = 'calendar-browser-grid calendar-browser-grid--month';
      const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      const gridStart = addDays(monthStart, -((monthStart.getUTCDay() + 6) % 7));
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(name => {
        const label = document.createElement('div');
        label.className = 'calendar-browser-weekday calendar-browser-weekday--month';
        label.textContent = name;
        fragment.append(label);
      });
      for (let index = 0; index < 42; index += 1) {
        const date = addDays(gridStart, index);
        const inMonth = date.getUTCMonth() === anchor.getUTCMonth();
        if (inMonth) visible += (grouped.get(key(date)) || []).length;
        fragment.append(dayCell(date, grouped, !inMonth));
      }
    }

    grid.replaceChildren(fragment);
    count.textContent = `${visible} event${visible === 1 ? '' : 's'}`;
  }

  async function refresh() {
    const currentRequest = ++requestId;
    grid.className = 'calendar-browser-grid';
    grid.innerHTML = '<div class="empty">Loading calendar…</div>';
    count.textContent = '';
    try {
      const result = await serviceApi('calendar', 'listEvents', {
        state: 'All',
        status: 'All'
      });
      if (disposed || signal.aborted || currentRequest !== requestId) return;
      events = Array.isArray(result?.events) ? result.events : [];
      render();
      bindManageCards();
    } catch {
      if (disposed || signal.aborted || currentRequest !== requestId) return;
      grid.innerHTML = '<div class="calendar-notice calendar-error">The calendar browser could not load events.</div>';
    }
  }

  viewButtons.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    render();
  }));

  section.querySelector('[data-nav="previous"]').addEventListener('click', () => {
    anchor = view === 'day' ? addDays(anchor, -1) : view === 'week' ? addDays(anchor, -7) : addMonths(anchor, -1);
    render();
  });
  section.querySelector('[data-nav="today"]').addEventListener('click', () => {
    anchor = today();
    render();
  });
  section.querySelector('[data-nav="next"]').addEventListener('click', () => {
    anchor = view === 'day' ? addDays(anchor, 1) : view === 'week' ? addDays(anchor, 7) : addMonths(anchor, 1);
    render();
  });

  return {
    refresh,
    destroy() {
      disposed = true;
      requestId += 1;
      manageObserver.disconnect();
      manageHeading.remove();
      section.remove();
    }
  };
}

export default {
  ...calendar,
  async mount(context) {
    let browser = null;
    const wrappedServiceApi = async (...args) => {
      const callArgs = [...args];
      if (
        callArgs[0] === 'calendar' &&
        callArgs[1] === 'listEvents' &&
        callArgs[2]?.status === 'All' &&
        callArgs[2]?.state === undefined
      ) {
        callArgs[2] = { ...callArgs[2], state: 'All' };
      }

      const result = await context.serviceApi(...callArgs);
      if (callArgs[0] === 'calendar' && MUTATIONS.has(callArgs[1])) {
        queueMicrotask(() => browser?.refresh());
      }
      return result;
    };

    const cleanup = await calendar.mount({ ...context, serviceApi: wrappedServiceApi });
    if (context.signal.aborted) {
      cleanup?.();
      return () => {};
    }

    browser = createBrowser({
      container: context.container,
      serviceApi: context.serviceApi,
      signal: context.signal
    });
    await browser?.refresh();

    return () => {
      browser?.destroy();
      cleanup?.();
    };
  }
};
