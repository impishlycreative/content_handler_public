function textNode(text) { return document.createTextNode(text); }
function safeHref(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch { return null; }
}
function appendInline(host, source) {
  const text = String(source || '');
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    host.append(textNode(text.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = token.slice(2, -2);
      host.append(strong);
    } else if (token.startsWith('*')) {
      const em = document.createElement('em');
      em.textContent = token.slice(1, -1);
      host.append(em);
    } else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = parts && safeHref(parts[2]);
      if (href) {
        const a = document.createElement('a');
        a.textContent = parts[1];
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        host.append(a);
      } else {
        host.append(textNode(token));
      }
    }
    cursor = match.index + token.length;
  }
  host.append(textNode(text.slice(cursor)));
}
export function renderMarkdown(markdown) {
  const fragment = document.createDocumentFragment();
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let list = null;
  const flushList = () => { if (list) { fragment.append(list); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); continue; }
    if (/^<\s*\/?\s*[A-Za-z]/.test(line.trim())) {
      flushList();
      const p = document.createElement('p');
      p.textContent = line;
      fragment.append(p);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushList();
      const h = document.createElement('h' + heading[1].length);
      appendInline(h, heading[2]);
      fragment.append(h);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushList(); fragment.append(document.createElement('hr')); continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      if (!list) list = document.createElement('ul');
      const li = document.createElement('li');
      appendInline(li, item[1]);
      list.append(li);
      continue;
    }
    flushList();
    if (line.startsWith('> ')) {
      const q = document.createElement('blockquote');
      appendInline(q, line.slice(2));
      fragment.append(q);
    } else {
      const p = document.createElement('p');
      appendInline(p, line);
      fragment.append(p);
    }
  }
  flushList();
  return fragment;
}
