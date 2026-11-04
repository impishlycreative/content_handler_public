import { parseContestImportText, CONTEST_IMPORT_SCHEMA_URL } from './contest-import.js?v=20261104-1';
import { buildContestResearchPrompt } from './contest-prompt.js?v=20261104-1';

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
    <div class="calendar-contest-ai-tools">
      <div class="calendar-contest-ai-actions">
        <button id="contestCopyPrompt" type="button" class="secondary" disabled title="Copies the AI research instructions and the entire KCW JSON reference to the clipboard">Prompt</button>
        <button id="contestPasteClipboard" type="button" class="secondary" title="Reads a JSON result from the clipboard, validates it, then fills this unsaved contest form">Copy from clipboard</button>
      </div>
      <p class="help">For Prompt, enter the official contest URL below first, or paste the URL into the AI conversation after the copied prompt. The AI returns JSON, which you can copy and import here.</p>
      <p id="contestClipboardStatus" class="calendar-contest-clipboard-status" role="status" aria-live="polite" hidden></p>
    </div>
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
  const globalStatus = container.querySelector('#calendarStatus');
  const promptButton = fields.querySelector('#contestCopyPrompt');
  const clipboardButton = fields.querySelector('#contestPasteClipboard');
  const clipboardStatus = fields.querySelector('#contestClipboardStatus');
  const eventId = container.querySelector('#calendarEventId');
  const titleInput = container.querySelector('#calendarTitle');
  const descriptionInput = container.querySelector('#calendarDescription');
  let promptSchema = null;
  let schemaError = '';
  const schemaController = new AbortController();

  function showClipboardStatus(message, isError = false) {
    clipboardStatus.textContent = message;
    clipboardStatus.className = 'calendar-contest-clipboard-status' + (isError ? ' is-error' : '');
    clipboardStatus.hidden = false;
  }

  async function preloadPromptSchema() {
    try {
      const response = await fetch(CONTEST_IMPORT_SCHEMA_URL, {
        signal: schemaController.signal, credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Schema request returned HTTP ' + response.status + '.');
      const schema = await response.json();
      buildContestResearchPrompt(schema);
      if (schemaController.signal.aborted) return;
      promptSchema = schema;
      promptButton.disabled = false;
    } catch (error) {
      if (!schemaController.signal.aborted) {
        schemaError = 'The AI JSON reference could not be loaded. Refresh the page before using Prompt.';
        showClipboardStatus(schemaError, true);
      }
    }
  }

  async function copyResearchPrompt() {
    if (type.value !== 'Contest' || !dialog.open) return;
    if (!promptSchema) {
      showClipboardStatus('The JSON reference is not ready yet. Please retry when Prompt is enabled.', true);
      return;
    }
    try {
      const prompt = buildContestResearchPrompt(promptSchema, inputs.contestUrl.value.trim());
      if (!navigator.clipboard?.writeText) {
        throw new Error('This browser does not support clipboard writing in this context.');
      }
      await navigator.clipboard.writeText(prompt);
      showClipboardStatus('AI research prompt and complete JSON reference copied. Paste into your AI chat and provide the contest URL if it was not already included.');
    } catch (error) {
      showClipboardStatus('Unable to copy the prompt: ' + (error?.message || 'Clipboard access denied.') + ' Check browser clipboard permissions.', true);
    }
  }

  async function pasteContestFromClipboard() {
    if (type.value !== 'Contest' || !dialog.open) return;
    if (eventId.value) {
      showClipboardStatus('Clipboard import is for adding a new contest. Open + Add contest first to avoid overwriting an existing entry.', true);
      return;
    }

    let parsedImport;
    let preservedUrl = '';
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('This browser does not support reading the clipboard here.');
      }
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error('The clipboard is empty.');
      if (text.length > 131072) throw new Error('Clipboard JSON exceeds the 128 KB limit.');

      // Finish ALL parsing and validation before changing a single form input.
      parsedImport = parseContestImportText(text);
      if (!titleInput || !descriptionInput) throw new Error('The contest form is unavailable.');

      preservedUrl = parsedImport.fields.contestUrl ? '' : inputs.contestUrl.value.trim();
      if (preservedUrl) {
        let parsedUrl;
        try { parsedUrl = new URL(preservedUrl); }
        catch { throw new Error('The contest URL already entered is invalid; correct or clear it before importing.'); }
        if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname ||
            parsedUrl.username || parsedUrl.password) {
          throw new Error('The contest URL already entered must be a valid HTTPS address.');
        }
      }
    } catch (error) {
      // Read/parse/validation failure: return immediately; form inputs are untouched.
      showClipboardStatus('Clipboard import stopped: ' + (error?.message || 'Invalid JSON.') + ' No form fields were changed.', true);
      return;
    }

    const { fields: importedFields, research, warnings } = parsedImport;
    const values = {
      ...importedFields,
      contestUrl: importedFields.contestUrl || preservedUrl
    };
    populate(values);
    titleInput.value = values.title;
    descriptionInput.value = values.description;
    showImportReview(research, warnings);
    showClipboardStatus('JSON validated and all supported contest fields populated. Nothing has been saved or published. Review the data before saving.');
  }

  promptButton.addEventListener('click', copyResearchPrompt);
  clipboardButton.addEventListener('click', pasteContestFromClipboard);
  void preloadPromptSchema();

  const importReview = document.createElement('section');
  importReview.id = 'contestImportReview';
  importReview.className = 'calendar-contest-import-review';
  importReview.hidden = true;
  importReview.setAttribute('aria-live', 'polite');
  fields.append(importReview);

  function clearImportReview() {
    importReview.hidden = true;
    importReview.replaceChildren();
  }
  function reviewText(parent, tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    parent.append(node);
    return node;
  }
  function showImportReview(research, warnings) {
    importReview.replaceChildren();
    importReview.hidden = false;
    reviewText(importReview, 'h3', 'Imported research — review before saving');
    reviewText(importReview, 'p', 'This JSON was used to fill a new, unsaved draft. Check dates, restrictions, and links against official sources before publishing.');
    if (research.generatedAt) reviewText(importReview, 'p', 'Research date: ' + research.generatedAt);
    if (warnings.length) {
      reviewText(importReview, 'strong', 'Items to check');
      const list = document.createElement('ul');
      warnings.forEach(warning => reviewText(list, 'li', warning));
      importReview.append(list);
    }
    if (research.notes) {
      reviewText(importReview, 'strong', 'Research notes');
      reviewText(importReview, 'p', research.notes);
    }
    if (research.sources.length) {
      reviewText(importReview, 'strong', 'Research sources (not automatically saved)');
      const list = document.createElement('ul');
      for (const source of research.sources) {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title || source.url;
        li.append(link);
        const details = [
          source.accessedAt ? 'checked ' + source.accessedAt : '',
          source.supportsFields.length ? 'supports: ' + source.supportsFields.join(', ') : ''
        ].filter(Boolean);
        if (details.length) li.append(document.createTextNode(' (' + details.join('; ') + ')'));
        list.append(li);
      }
      importReview.append(list);
    }
    if (research.unverifiedFields.length) {
      reviewText(importReview, 'p', 'Unverified fields: ' + research.unverifiedFields.join(', '));
    }
  }
  function showImportMessage(message, isError = false) {
    if (!globalStatus) return;
    globalStatus.textContent = message;
    globalStatus.className = isError ? 'calendar-notice calendar-error' : 'calendar-notice calendar-success';
    globalStatus.hidden = false;
  }

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
    clearImportReview();
    clipboardStatus.hidden = true;
    clipboardStatus.textContent = '';
    if (schemaError) showClipboardStatus(schemaError, true);
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

  const schemaLink = document.createElement('a');
  schemaLink.href = CONTEST_IMPORT_SCHEMA_URL;
  schemaLink.download = 'contest-import.schema.json';
  schemaLink.className = 'secondary calendar-contest-schema-link';
  schemaLink.textContent = 'AI import schema';
  schemaLink.title = 'Download the JSON Schema to give an AI when researching a writing contest.';
  toolbar?.insertBefore(schemaLink, addContest);

  const importButton = document.createElement('button');
  importButton.id = 'calendarImportContest';
  importButton.type = 'button';
  importButton.className = 'secondary';
  importButton.textContent = 'Import contest JSON';
  importButton.title = 'Fill a new, unsaved contest draft from a JSON file produced using the KCW schema.';
  toolbar?.insertBefore(importButton, addContest);

  const fileInput = document.createElement('input');
  fileInput.id = 'calendarContestJsonFile';
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.hidden = true;
  container.append(fileInput);

  const clickAdd = () => {
    addEvent.click();
    type.value = 'Contest';
    type.dispatchEvent(new Event('change'));
    populate(null);
  };
  addContest.addEventListener('click', clickAdd);

  const openJsonPicker = () => fileInput.click();
  const importJsonFile = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 131072) {
        throw new Error('The contest JSON file must be 128 KB or smaller.');
      }
      const text = await file.text();
      const { fields: importedFields, research, warnings } = parseContestImportText(text);

      // Open the canonical editor as a NEW draft. Let the existing dialog
      // observer finish clearing its form before applying imported values.
      addEvent.click();
      await Promise.resolve();
      type.value = 'Contest';
      type.dispatchEvent(new Event('change'));
      populate(importedFields);
      container.querySelector('#calendarTitle').value = importedFields.title;
      container.querySelector('#calendarDescription').value = importedFields.description;
      showImportReview(research, warnings);
      showImportMessage('Contest JSON loaded into a new, unsaved draft. Review the form and select Save as Draft or Publish when ready.');
    } catch (error) {
      showImportMessage('Contest import failed: ' + (error?.message || 'Invalid file.'), true);
    } finally {
      fileInput.value = '';
    }
  };
  importButton.addEventListener('click', openJsonPicker);
  fileInput.addEventListener('change', importJsonFile);

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
      importButton.removeEventListener('click', openJsonPicker);
      fileInput.removeEventListener('change', importJsonFile);
      promptButton.removeEventListener('click', copyResearchPrompt);
      clipboardButton.removeEventListener('click', pasteContestFromClipboard);
      schemaController.abort();
      addContest.remove();
      importButton.remove();
      schemaLink.remove();
      fileInput.remove();
      location.required = oldRequired;
      nativeLabels.forEach((el, i) => { if (el) el.hidden = previousHidden[i]; });
      fields.remove();
    }
  };
}
