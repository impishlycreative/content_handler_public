// Copyable research instructions based on the canonical JSON import schema.
// The schema itself is included in the clipboard text so the AI needs no URL access.
export function buildContestResearchPrompt(schema, contestUrl = '') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) ||
      schema.type !== 'object' ||
      schema.properties?.schemaVersion?.const !== '1.0' ||
      !schema.properties?.contestEligibility ||
      !schema.properties?.contestDeadline ||
      !schema.properties?.contestUrl) {
    throw new Error('The KCW contest JSON schema is missing or unsupported.');
  }

  const url = String(contestUrl || '').trim();
  const target = url
    ? 'Official contest URL to research: ' + url
    : 'The contest URL will be supplied in my next message. Wait until I post it before researching.';

  return [
    'KCW WRITING CONTEST RESEARCH AND JSON IMPORT',
    '',
    target,
    '',
    'Research this writing contest thoroughly using the supplied URL, its official organizer website, its official terms and conditions, and authoritative pages linked from them.',
    'If you cannot access the website or verify a fact, do not invent it. Identify unresolved items in the research notes.',
    '',
    'Produce EXACTLY ONE JSON object that conforms to the COMPLETE JSON Schema below.',
    '- Populate every available contest field you can verify. Include all fields defined by the schema whenever practical; use an empty string for missing or unverified optional information.',
    '- Use the exact field names, string limits, date/time formats, and dropdown enum values defined by the schema.',
    '- Set schemaVersion to "1.0", type to "Contest", and status to "Draft". Do not publish or claim to have saved anything.',
    '- Title must be the official contest name. Description must be an accurate concise summary, not a copy of lengthy rules.',
    '- Determine eligibility, geographic scope, opening date, FINAL submission deadline and its year, time and time zone when stated, expected results date, organizer, entry fee/currency, prizes, writing form, genre, word/line/page limits, permitted languages, publication status restrictions, AI policy, and unusual conditions such as simultaneous entries, formatting and licensing/copyright.',
    '- Distinguish submission deadlines from early-bird, registration, finalist and award announcement dates. Do not infer a deadline timezone from your own location.',
    '- Only use https:// links to the official contest page and the full official rules. Never invent a URL.',
    '- Record supporting source links in research.sources. For each source, list the fields it directly supports in supportsFields. Record uncertain or conflicting claims in research.notes and list unverified field names in research.unverifiedFields.',
    '- Set contestVerifiedAt only when the information was actually checked against an official source. If you lack browsing access, leave it blank and explain in research.notes.',
    '- Output strict JSON only: NO Markdown code fences, headings, comments or text before or after the JSON. This JSON will be read directly from my clipboard and must parse successfully.',
    '',
    'THE FULL KCW JSON SCHEMA (version 1.0) FOLLOWS. Adhere to its exact types, maximum lengths, enum values, and field names:',
    '',
    JSON.stringify(schema, null, 2)
  ].join('\n');
}
