// Pure validator for an AI-produced, single-contest JSON import.
// This module has no DOM or network dependencies and never saves/publishes.
export const CONTEST_IMPORT_SCHEMA_URL = '/schemas/contest-import.schema.json';
export const CONTEST_IMPORT_SCHEMA_VERSION = '1.0';

const RULES = Object.freeze({
  title: { max: 160, required: true },
  description: { max: 5000 },
  contestOrganizer: { max: 300 },
  contestEligibility: { max: 1500 },
  contestRegion: { max: 300 },
  contestOpenDate: { kind: 'date' },
  contestDeadline: { kind: 'date' },
  contestDeadlineTime: { kind: 'time' },
  contestDeadlineTimezone: { max: 100, kind: 'timezone' },
  contestAnnouncementDate: { kind: 'date' },
  contestUrl: { max: 2000, kind: 'url' },
  contestTermsUrl: { max: 2000, kind: 'url' },
  contestEntryFee: { max: 150 },
  contestPrize: { max: 500 },
  contestForm: { max: 300 },
  contestGenres: { max: 600 },
  contestLengthLimit: { max: 400 },
  contestPublicationPolicy: {
    values: ['', 'Unpublished only', 'Previously published accepted', 'See official rules']
  },
  contestAiPolicy: {
    values: ['', 'Prohibited', 'Restricted', 'Allowed', 'See official rules']
  },
  contestRestrictions: { max: 2000 },
  contestVerifiedAt: { kind: 'date' },
  contestLanguage: { max: 200 }
});

export const CONTEST_IMPORT_FIELDS = Object.freeze(Object.keys(RULES));

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureDate(value, label) {
  if (!value) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be an actual date in YYYY-MM-DD format.');
  }
}

function ensureUrl(value, label) {
  if (!value) return;
  let parsed;
  try { parsed = new URL(value); }
  catch { throw new Error(label + ' must be a complete HTTPS URL.'); }
  if (!/^https:\/\//i.test(value) || parsed.protocol !== 'https:' ||
      !parsed.hostname || parsed.username || parsed.password ||
      /[\s\x00-\x1f\x7f]/.test(value)) {
    throw new Error(label + ' must be a complete HTTPS URL without credentials or spaces.');
  }
}

function ensureString(value, label, max = 2000) {
  if (typeof value !== 'string') {
    throw new Error(label + ' must be a string; use an empty string for unknown details.');
  }
  if (value.length > max) {
    throw new Error(label + ' is longer than the form accepts (' + max + ' characters).');
  }
  return value.trim();
}

function ensureFieldsList(value, label) {
  if (!Array.isArray(value) || value.length > 25 ||
      value.some(item => !CONTEST_IMPORT_FIELDS.includes(item)) ||
      new Set(value).size !== value.length) {
    throw new Error(label + ' must be an array of distinct, supported field names.');
  }
  return value;
}

function checkResearch(value) {
  if (value === undefined) return { notes: '', sources: [], unverifiedFields: [], generatedAt: '' };
  if (!isObject(value)) throw new Error('research must be a JSON object.');
  const allowed = new Set(['notes', 'sources', 'unverifiedFields', 'generatedAt']);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error('Unknown research properties: ' + unknown.join(', '));
  const notes = ensureString(value.notes === undefined ? '' : value.notes, 'research.notes', 3000);
  const generatedAt = ensureString(value.generatedAt === undefined ? '' : value.generatedAt, 'research.generatedAt', 10);
  ensureDate(generatedAt, 'research.generatedAt');
  const unverifiedFields = value.unverifiedFields === undefined
    ? [] : ensureFieldsList(value.unverifiedFields, 'research.unverifiedFields');
  const sources = value.sources === undefined ? [] : value.sources;
  if (!Array.isArray(sources) || sources.length > 30) {
    throw new Error('research.sources must be an array with at most 30 sources.');
  }
  const verifiedSources = sources.map((entry, index) => {
    if (!isObject(entry)) throw new Error('research.sources[' + index + '] must be an object.');
    const sourceKeys = ['url', 'title', 'accessedAt', 'supportsFields'];
    const unknownKeys = Object.keys(entry).filter(key => !sourceKeys.includes(key));
    if (unknownKeys.length) throw new Error('Unknown source properties: ' + unknownKeys.join(', '));
    const url = ensureString(entry.url, 'research.sources[' + index + '].url', 2000);
    ensureUrl(url, 'research.sources[' + index + '].url');
    if (!url) throw new Error('Every research source needs an HTTPS URL.');
    const title = ensureString(entry.title === undefined ? '' : entry.title, 'Source title', 300);
    const accessedAt = ensureString(entry.accessedAt === undefined ? '' : entry.accessedAt, 'Source accessedAt', 10);
    ensureDate(accessedAt, 'Source accessedAt');
    const supportsFields = entry.supportsFields === undefined ? []
      : ensureFieldsList(entry.supportsFields, 'research.sources[' + index + '].supportsFields');
    return { url, title, accessedAt, supportsFields };
  });
  return { notes, sources: verifiedSources, unverifiedFields, generatedAt };
}

export function parseContestImportText(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch { throw new Error('The file is not valid JSON. Have the AI return one JSON object without Markdown fences.'); }
  if (!isObject(raw)) throw new Error('Import exactly one contest as a JSON object, not an array.');
  const allowed = new Set(['$schema', 'schemaVersion', 'type', 'status', 'research', ...CONTEST_IMPORT_FIELDS]);
  const unknown = Object.keys(raw).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw new Error('Unsupported field(s): ' + unknown.join(', ') +
      '. Ask the AI to use the exact names in the KCW schema.');
  }
  if (raw.$schema !== undefined &&
      raw.$schema !== 'https://content.kemptvillecreativewriters.com/schemas/contest-import.schema.json') {
    throw new Error('$schema must refer to the KCW contest import schema.');
  }
  if (raw.schemaVersion !== CONTEST_IMPORT_SCHEMA_VERSION) {
    throw new Error('This import requires schemaVersion "1.0".');
  }
  if (raw.type !== 'Contest' || raw.status !== 'Draft') {
    throw new Error('type must be "Contest" and status must be "Draft". Imports cannot publish automatically.');
  }

  const fields = {};
  for (const [key, rule] of Object.entries(RULES)) {
    const value = ensureString(raw[key] === undefined ? '' : raw[key], key, rule.max || 2000);
    if (rule.required && !value) throw new Error(key + ' is required for a contest import.');
    if (rule.kind === 'date') ensureDate(value, key);
    if (rule.kind === 'time' && value && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new Error(key + ' must use 24-hour HH:MM format.');
    }
    if (rule.kind === 'url') ensureUrl(value, key);
    if (rule.kind === 'timezone' && value) {
      try { new Intl.DateTimeFormat('en-CA', { timeZone: value }); }
      catch { throw new Error(key + ' must be a valid IANA timezone, such as America/Toronto or UTC.'); }
    }
    if (rule.values && !rule.values.includes(value)) {
      throw new Error(key + ' must be one of: ' + rule.values.filter(Boolean).join(', ') + ', or blank.');
    }
    fields[key] = value;
  }

  if (fields.contestOpenDate && fields.contestDeadline &&
      fields.contestDeadline < fields.contestOpenDate) {
    throw new Error('contestDeadline cannot be before contestOpenDate.');
  }
  const research = checkResearch(raw.research);
  const warnings = [];
  for (const key of ['description', 'contestEligibility', 'contestDeadline', 'contestUrl']) {
    if (!fields[key]) warnings.push(key + ' is blank; the contest cannot be published until it is completed.');
  }
  if (fields.contestDeadlineTime && !fields.contestDeadlineTimezone) {
    warnings.push('Deadline time has no specified timezone. Verify the official contest timezone.');
  }
  if (!research.sources.length) {
    warnings.push('No research sources were attached. Verify the details against the official contest rules.');
  }
  for (const key of research.unverifiedFields) {
    if (fields[key]) {
      warnings.push(key + ' is marked unverified but contains a value. Review this claim before publishing.');
    }
  }
  return { fields, research, warnings };
}
