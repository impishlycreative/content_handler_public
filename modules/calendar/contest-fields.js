// Structured writing-contest fields for the existing Calendar Manager editor.
// Entries remain ordinary Google Calendar events with KCW_METADATA.type = "Contest".
const FIELD_KEYS = [
  'contestOrganizer', 'contestEligibility', 'contestRegion', 'contestOpenDate',
  'contestDeadline', 'contestDeadlineTime', 'contestDeadlineTimezone',
  'contestAnnouncementDate', 'contestUrl', 'contestTermsUrl', 'contestEntryFee',
  'contestPrize', 'contestForm', 'contestGenres', 'contestLengthLimit',
  'contestPublicationPolicy', 'contestAiPolicy', 'contestRestrictions',
  'contestVerifiedAt', 'contestLanguage'
];

export function addContestEditor(container) {
  const type = container.querySelector('#calendarType');
  const form = container.querySelector('#calendarEventForm');
  const dialog = container.querySelector('#calendarEventDialog');
  const start = container.querySelector('#calendarStart');
  const end = container.querySelector('#calendarEnd');
  const location = container.querySelector('#calendarLocation');
  const featured = container.querySelector('#calendarFeatured');
  const hover = container.querySelector('#calendarHoverText');
  if (![type, form, dialog, start, end, location, featured, hover].every(Boolean)) {
    throw new Error('Contest editor requires the complete Calendar Manager form.');
  }

  const fields = document.createElement('fieldset');
  fields.id = 'calendarContestFields';
  fields.className = 'calendar-contest-fields';
  fields.hidden = true;
  fields.innerHTML = `
    <legend>Contest details</legend>
    <p class="help">Required for publication: contest name (Title above), eligibility, closing date, description, and official link. Other details may be left blank.</p>
    <h3>Basic information</h3>
    <div class="calendar-grid2">
      <label>Organizer <input id="contestOrganizer" maxlength="300"></label>
      <label>Geographic scope <input id="contestRegion" maxlength="300" placeholder="Canada, worldwide, Ontario…"></label>
    </div>
    <label>Who can enter / eligibility <textarea id="contestEligibility" maxlength="1500" rows="3" placeholder="Residency, age, experience, citizenship…"></textarea></label>
    <label>Official contest website <input id="contestUrl" type="url" maxlength="2000" placeholder="https://"></label>
    <label>Full terms and conditions <input id="contestTermsUrl" type="url" maxlength="2000" placeholder="https://"></label>

    <h3>Dates and prizes</h3>
    <div class="calendar-grid2">
      <label>Submissions open (if known) <input id="contestOpenDate" type="date"></label>
      <label>Submission deadline <input id="contestDeadline" type="date"></label>
      <label>Deadline time (if stated) <input id="contestDeadlineTime" type="time"></label>
      <label>Deadline time zone <input id="contestDeadlineTimezone" maxlength="100" placeholder="America/Toronto, UTC…"></label>
      <label>Winners/results expected <input id="contestAnnouncementDate" type="date"></label>
      <label>Entry fee <input id="contestEntryFee" maxlength="150" placeholder="Free, $20 CAD, not stated…"></label>
    </div>
    <label>Prizes <textarea id="contestPrize" rows="2" maxlength="500"></textarea></label>

    <h3>Writing requirements</h3>
    <div class="calendar-grid2">
      <label>Writing form(s)
        <input id="contestForm" list="contestFormCategories" maxlength="300" placeholder="Short Stories, Flash Fiction…">
        <datalist id="contestFormCategories">
          <option value="Poetry">
          <option value="Flash Fiction">
          <option value="Short Stories">
          <option value="Novels & Novellas">
          <option value="Creative Nonfiction">
          <option value="Essays & Articles">
          <option value="Scriptwriting & Drama">
          <option value="Translation">
          <option value="Experimental Writing">
          <option value="Open / Multiple Categories">
        </datalist>
      </label>
      <label>Genres (comma-separated) <input id="contestGenres" maxlength="600" placeholder="Fantasy, Horror, Science Fiction"></label>
      <label>Length limit <input id="contestLengthLimit" maxlength="400" placeholder="Up to 3,000 words, 40 lines…"></label>
      <label>Language(s) <input id="contestLanguage" maxlength="200" placeholder="English, French…"></label>
      <label>Previously published work
        <select id="contestPublicationPolicy">
          <option value="">Not stated</option>
          <option value="Unpublished only">Unpublished only</option>
          <option value="Previously published accepted">Previously published accepted</option>
          <option value="See official rules">See official rules</option>
        </select>
      </label>
      <label>AI assistance policy
        <select id="contestAiPolicy">
          <option value="">Not stated</option>
          <option value="Prohibited">Prohibited</option>
          <option value="Restricted">Restricted</option>
          <option value="Allowed">Allowed</option>
          <option value="See official rules">See official rules</option>
        </select>
      </label>
    </div>
    <label>Other restrictions (formatting, simultaneous submissions, rights, etc.)
      <textarea id="contestRestrictions" maxlength="2000" rows="3"></textarea>
    </label>

    <h3>Listing maintenance</h3>
    <div class="calendar-grid2">
      <label>Last verified against official source <input id="contestVerifiedAt" type="date"></label>
      <div class="calendar-contest-verified"><button id="contestVerifyToday" class="secondary" type="button">Mark verified today</button></div>
    </div>
    <p class="help">KCW summarizes listings for convenience. Entrants should always read the organizer's complete rules, including copyright or publication-rights terms.</p>
  `;
  type.closest('label')?.insertAdjacentElement('afterend', fields);

  const inputs = Object.fromEntries(FIELD_KEYS.map(key => {
    const element = fields.querySelector('#' + key);
    if (!element) throw new Error('Missing contest field ' + key);
    return [key, element];
  }));
  const oldRequired = location.required;
  const nativeLabels = [start, end, location, featured, hover].map(input => input.closest('label'));
  const previousHidden = nativeLabels.map(el => el?.hidden || false);
  const title = container.querySelector('#calendarDialogTitle');

  function syncVisibility() {
    const isContest = type.value === 'Contest';
    fields.hidden = !isContest;
    nativeLabels.forEach(el => { if (el) el.hidden = isContest; });
    location.required = isContest ? false : oldRequired;
    if (isContest) {
      location.value = '';
      featured.checked = false;
    } else if (!location.value) {
      location.value = 'Tallman room';
    }
    if (isContest && dialog.open && title) {
      title.textContent = container.querySelector('#calendarEventId')?.value ? 'Edit contest' : 'Add contest';
    }
  }

  function populate(event) {
    for (const key of FIELD_KEYS) inputs[key].value = event?.[key] || '';
    syncVisibility();
  }

  function payload() {
    const active = type.value === 'Contest';
    return Object.fromEntries(FIELD_KEYS.map(key => [key, active ? inputs[key].value.trim() : '']));
  }

  function validateBeforeSubmit(event) {
    if (type.value !== 'Contest') return;
    const publishing = event.submitter?.value === 'Published';
    const eligibility = inputs.contestEligibility.value.trim();
    const deadline = inputs.contestDeadline.value;
    const officialLink = inputs.contestUrl.value.trim();
    const description = container.querySelector('#calendarDescription')?.value.trim();
    const name = container.querySelector('#calendarTitle')?.value.trim();
    const opening = inputs.contestOpenDate.value;
    let message = '';
    if (opening && deadline && deadline < opening) {
      message = 'The submission deadline cannot precede the opening date.';
    } else if (publishing && (!name || !eligibility || !deadline || !description || !officialLink)) {
      message = 'Publishing requires a name, eligibility, deadline, description, and official contest link.';
    }
    if (!message) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const error = container.querySelector('#calendarEditorError');
    error.textContent = message;
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest' });
  }

  function markVerified() {
    const now = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = key => now.find(part => part.type === key)?.value || '';
    inputs.contestVerifiedAt.value = `${get('year')}-${get('month')}-${get('day')}`;
  }

  const addEvent = container.querySelector('#calendarAddButton');
  const addContest = document.createElement('button');
  addContest.id = 'calendarAddContest';
  addContest.type = 'button';
  addContest.className = 'secondary';
  addContest.textContent = '+ Add contest';
  const toolbar = container.querySelector('.calendar-toolbar');
  toolbar?.insertBefore(addContest, addEvent);

  const clickAdd = () => {
    addEvent.click();
    type.value = 'Contest';
    type.dispatchEvent(new Event('change'));
    populate(null);
  };
  addContest.addEventListener('click', clickAdd);
  const verifyButton = fields.querySelector('#contestVerifyToday');
  verifyButton.addEventListener('click', markVerified);
  type.addEventListener('change', syncVisibility);
  form.addEventListener('submit', validateBeforeSubmit, true);
  syncVisibility();

  return {
    populate,
    payload,
    destroy() {
      form.removeEventListener('submit', validateBeforeSubmit, true);
      type.removeEventListener('change', syncVisibility);
      verifyButton.removeEventListener('click', markVerified);
      addContest.removeEventListener('click', clickAdd);
      addContest.remove();
      location.required = oldRequired;
      nativeLabels.forEach((el, i) => { if (el) el.hidden = previousHidden[i]; });
      fields.remove();
    }
  };
}
