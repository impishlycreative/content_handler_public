import { renderMarkdown } from './markdown.js';

const TYPES = Object.freeze(['ARTICLE', 'STORY', 'LINK']);
const TYPE_PERMISSIONS = Object.freeze({
  ARTICLE: Object.freeze({ read: 'content.article.read', write: 'content.article.write' }),
  STORY: Object.freeze({ read: 'content.story.read', write: 'content.story.write' }),
  LINK: Object.freeze({ read: 'content.link.read', write: 'content.link.write' })
});
const CONTENT_READ_PERMISSIONS = Object.freeze([
  'content.read',
  ...TYPES.map(type => TYPE_PERMISSIONS[type].read)
]);

const CARD_MOTIFS = Object.freeze({
  ARTICLE: new URL('./assets/article-motif.svg', import.meta.url).href,
  STORY: new URL('./assets/story-motif.svg', import.meta.url).href,
  LINK: new URL('./assets/link-motif.svg', import.meta.url).href
});

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function makeButton(text, className, onClick) {
  const button = el('button', text, className);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

function field(labelText, control, key) {
  const wrapper = el('label', undefined, 'cms-field');
  wrapper.dataset.field = key;
  control.setAttribute('aria-label', labelText);

  const label = el('span', labelText, 'cms-label');
  const error = el('span', '', 'cms-field-error');
  error.setAttribute('aria-live', 'polite');

  wrapper.append(label, control, error);
  return wrapper;
}

function fmtDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString();
}

function unwrap(result) {
  return result?.data ?? result;
}

function motifFor(type) {
  return CARD_MOTIFS[String(type || '').toUpperCase()] || CARD_MOTIFS.ARTICLE;
}

function cardImage(item) {
  const image = document.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  image.className = 'cms-card-image';

  const useMotif = () => {
    image.onerror = null;
    image.src = motifFor(item.type);
    image.alt = '';
    image.className = 'cms-card-image cms-card-motif';
  };

  if (item.heroImage) {
    image.src = item.heroImage;
    image.alt = item.heroImageAltText || '';
    image.classList.add('cms-card-hero');
    image.onerror = useMotif;
  } else {
    useMotif();
  }

  return image;
}

function contentVisual(record, className) {
  const image = document.createElement('img');
  image.decoding = 'async';
  image.className = className;

  const useMotif = () => {
    image.onerror = null;
    image.src = motifFor(record.type);
    image.alt = '';
    image.classList.add('is-motif');
  };

  if (record.heroImage) {
    image.src = record.heroImage;
    image.alt = record.heroImageAltText || '';
    image.onerror = useMotif;
  } else {
    useMotif();
  }

  return image;
}

export default {
  id: 'content',
  title: 'Content',
  permissions: [],
  anyPermissions: CONTENT_READ_PERMISSIONS,

  async mount({ container, api, ui, signal, identity }) {
    container.classList.add('cms');

    let config;
    let tags = [];
    let items = [];
    let current = null;
    let view = 'cards';
    let mode = 'list';
    let scope = 'mine';
    let disposed = false;
    let viewVersion = 0;
    let dismissMenu = null;
    const filters = { mine: {}, all: {}, trash: {} };

    const hasPermission = permission =>
      identity.permissions.includes('*') ||
      identity.permissions.includes(permission);
    const canReadType = type =>
      hasPermission('content.read') ||
      hasPermission(TYPE_PERMISSIONS[type]?.read);
    const canWriteType = type =>
      canReadType(type) &&
      (
        hasPermission('content.write') ||
        hasPermission(TYPE_PERMISSIONS[type]?.write)
      );
    const readableTypes = TYPES.filter(canReadType);
    const writableTypes = TYPES.filter(canWriteType);
    const canWriteAny = writableTypes.length > 0;

    async function call(action, data = {}) {
      const response = await api(`content.${action}`, data);

      if (disposed || signal.aborted) {
        throw new DOMException('Module closed.', 'AbortError');
      }

      return unwrap(response);
    }

    function button(text, className, onClick) {
      const node = makeButton(text, className, async () => {
        if (disposed || signal.aborted || node.disabled) return;

        node.disabled = true;

        try {
          await onClick();
        } catch (error) {
          showError(error);
        } finally {
          node.disabled = false;
        }
      });

      return node;
    }

    function clear() {
      if (dismissMenu) document.removeEventListener('pointerdown', dismissMenu);
      dismissMenu = null;
      viewVersion += 1;
      container.replaceChildren();
    }

    function dispose() {
      disposed = true;
      config = null;
      tags = [];
      items = [];
      current = null;
      clear();
    }

    signal.addEventListener('abort', dispose, { once: true });

    function acceptResult(result) {
      const { content, summary } = result;

      items = items.filter(item => item.id !== summary.id);

      if (
        canReadType(summary.type) &&
        !summary.deleted &&
        (scope === 'all' || summary.ownerUserId === identity.uid)
      ) {
        items.push(summary);
        items.sort((a, b) =>
          String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
        );
      }

      return content;
    }

    async function changeContent(action, id) {
      const version = viewVersion;
      const result = await call(action, { id });
      const record = acceptResult(result);

      if (version === viewVersion) {
        renderDetails(record);
      }
    }

    function header(title, subtitle, actions = []) {
      const toolbar = el('div', undefined, 'cms-toolbar');

      const copy = el('div', undefined, 'cms-toolbar-copy');
      copy.append(
        el('p', 'CONTENT MANAGEMENT', 'eyebrow'),
        el('h1', title)
      );

      if (subtitle) {
        copy.append(el('p', subtitle, 'help'));
      }

      const buttons = el('div', undefined, 'cms-actions');
      actions.forEach(action => buttons.append(action));

      toolbar.append(copy, buttons);
      container.append(toolbar);
    }

    function tagLabel(tagId) {
      return tags.find(tag => tag.id === tagId)?.label || tagId;
    }

    function typePill(type) {
      const value = String(type || 'ARTICLE').toUpperCase();
      return el(
        'span',
        value,
        `cms-pill cms-pill-type cms-pill-${value.toLowerCase()}`
      );
    }

    function statusPill(status) {
      const value = String(status || 'DRAFT').toUpperCase();
      return el(
        'span',
        value,
        `cms-pill cms-pill-status cms-pill-${value.toLowerCase()}`
      );
    }

    function pageBar(label, backAction, actions = [], backLabel = '← Back to Content') {
      const wrapper = el('div', undefined, 'cms-pagebar');

      const crumbs = el('nav', undefined, 'cms-breadcrumbs');
      crumbs.setAttribute('aria-label', 'Breadcrumb');
      crumbs.append(
        el('span', 'Home'),
        el('span', '›', 'cms-breadcrumb-separator'),
        el('span', 'Content'),
        el('span', '›', 'cms-breadcrumb-separator'),
        el('strong', label)
      );

      const row = el('div', undefined, 'cms-pagebar-row');
      row.append(
        button(backLabel, 'secondary cms-back-button', backAction)
      );

      const actionHost = el('div', undefined, 'cms-page-actions');
      actions.forEach(action => actionHost.append(action));
      row.append(actionHost);

      wrapper.append(crumbs, row);
      container.append(wrapper);
    }

    function sidebarPanel(title) {
      const panel = el('section', undefined, 'cms-side-panel');
      panel.append(el('h2', title));
      return panel;
    }

    function detailRow(label, value, valueClass = '') {
      const row = el('div', undefined, 'cms-detail-row');
      row.append(
        el('span', label, 'cms-detail-label'),
        el('span', value, valueClass || 'cms-detail-value')
      );
      return row;
    }

    function relatedItems(record) {
      const recordTags = new Set(record.tags || []);

      return items
        .filter(item => item.id !== record.id)
        .map(item => {
          const sharedTags = (item.tags || [])
            .filter(tag => recordTags.has(tag))
            .length;
          const sameType = item.type === record.type ? 1 : 0;
          return { item, score: sharedTags * 3 + sameType };
        })
        .filter(entry => entry.score > 0)
        .sort((a, b) =>
          b.score - a.score ||
          String(b.item.updatedAt || '')
            .localeCompare(String(a.item.updatedAt || ''))
        )
        .slice(0, 3)
        .map(entry => entry.item);
    }

    function showError(error) {
      if (disposed || signal.aborted) return;

      const details = error?.details || {};
      const summary = container.querySelector('.cms-validation-summary');
      const message = error?.message || 'The request could not be completed.';

      if (summary) {
        summary.textContent = message;
        summary.hidden = false;
      } else {
        ui.status(message, 'error');
      }

      for (const [key, detail] of Object.entries(details)) {
        const selector =
          `[data-field="${CSS.escape(key)}"] .cms-field-error`;
        const host = container.querySelector(selector);

        if (host) host.textContent = detail;
      }
    }

    function resetErrors() {
      container
        .querySelectorAll('.cms-field-error')
        .forEach(node => {
          node.textContent = '';
        });

      const summary = container.querySelector('.cms-validation-summary');

      if (summary) {
        summary.hidden = true;
        summary.textContent = '';
      }
    }

    async function loadData() {
      const data = await call('bootstrap', { scope });
      ({ config, tags, items } = data);
    }

    function card(item) {
      const cardButton = button('', 'cms-card', () => showDetails(item.id));

      const media = el('span', undefined, 'cms-card-media');
      media.append(cardImage(item));

      const body = el('span', undefined, 'cms-card-body');

      const badges = el('span', undefined, 'cms-card-top');
      badges.append(
        el('span', item.status, 'cms-badge'),
        el('span', item.type, 'cms-badge cms-badge-muted')
      );

      if (item.sensitive) {
        badges.append(
          el('span', 'Sensitive', 'cms-badge cms-badge-warn')
        );
      }

      const title = el(
        'span',
        item.title || 'Untitled',
        'cms-card-title'
      );

      body.append(badges, title);

      if (item.tags?.length) {
        body.append(
          el('span', item.tags.join(' · '), 'cms-tags')
        );
      }

      body.append(
        el(
          'span',
          `Updated ${fmtDate(item.updatedAt)}`,
          'cms-card-updated'
        )
      );

      cardButton.append(media, body);
      return cardButton;
    }

    function listRow(item) {
      const row = button('', 'cms-list-row', () => showDetails(item.id));

      row.append(
        el('strong', item.title || 'Untitled'),
        el('span', item.type),
        el('span', item.sensitive ? `${item.status} / Sensitive material` : item.status),
        el('span', fmtDate(item.updatedAt))
      );

      return row;
    }

    async function showList() {
      mode = 'list';
      current = null;
      clear();

      const actions = [];

      if (canWriteAny) {
        actions.push(
          newContentMenu()
        );
      }

      if (config.isAdmin) {
        actions.push(
          button(
            scope === 'mine' ? 'All Content' : 'My Content',
            'secondary',
            async () => {
              await refreshAndList(
                scope === 'mine' ? 'all' : 'mine'
              );
            }
          )
        );

        actions.push(
          button('Manage Tags', 'secondary', showTags)
        );

        if (config.seedImportEnabled) {
          actions.push(
            button('Import Test Data', 'secondary', showImport)
          );
        }
      }

      actions.push(
        button('Get latest content', 'secondary', async () => {
          await loadData();
          showList();
        })
      );

      actions.push(
        button('Trash', 'secondary', showTrash)
      );

      header(
        scope === 'all' ? 'All Content' : 'My Content',
        scope === 'all'
          ? 'Active content across all users.'
          : 'Your active Articles, Stories, and Links.',
        actions
      );

      const switcher = el(
        'div',
        undefined,
        'cms-view-toggle'
      );

      switcher.append(
        button(
          'Cards',
          view === 'cards' ? 'primary' : 'secondary',
          () => {
            view = 'cards';
            showList();
          }
        ),
        button(
          'List',
          view === 'list' ? 'primary' : 'secondary',
          () => {
            view = 'list';
            showList();
          }
        )
      );

      container.append(el('p', 'Get latest content reloads the list and tags, including changes made elsewhere.', 'help'));
      container.append(switcher);

      const visibleItems = filterItems(items, scope, showList);
      if (!visibleItems.length) {
        container.append(
          el(
            'div',
            items.length
              ? 'No items match your filters. Clear filters to show all items in this view.'
              : canWriteAny
                ? 'No content yet. Create your first item.'
                : 'No content is available for your permissions.',
            'empty'
          )
        );
        return;
      }

      const host = el(
        'div',
        undefined,
        view === 'cards' ? 'cms-grid' : 'cms-list'
      );

      visibleItems.forEach(item => {
        host.append(
          view === 'cards' ? card(item) : listRow(item)
        );
      });

      container.append(host);
    }

    function newContentMenu() {
      const host = el('details', undefined, 'cms-new-menu');
      host.append(el('summary', 'New content', 'primary'));
      const choices = el('div', undefined, 'cms-new-choices');
      for (const type of writableTypes) {
        choices.append(button(type[0] + type.slice(1).toLowerCase(), 'secondary', () =>
          showEditor({ type, visibility: config.defaults.visibility, tags: [], sensitive: false })));
      }
      host.append(choices);
      dismissMenu = event => { if (!host.contains(event.target)) host.open = false; };
      document.addEventListener('pointerdown', dismissMenu);
      host.addEventListener('keydown', event => {
        if (event.key === 'Escape') { host.open = false; host.querySelector('summary').focus(); }
      });
      host.addEventListener('focusout', event => { if (!host.contains(event.relatedTarget)) host.open = false; });
      return host;
    }

    function filterItems(source, key, redraw) {
      const active = filters[key];
      const controls = el('div', undefined, 'cms-filters');
      const options = [
        ['type', 'Content type', readableTypes],
        ['status', 'Publication status', ['DRAFT', 'PUBLISHED']],
        ['tag', 'Tag', [...new Set(source.flatMap(item => item.tags || []))]]
      ];
      for (const [name, label, values] of options) {
        const select = document.createElement('select');
        select.append(el('option', 'All'));
        select.firstChild.value = '';
        for (const value of [...new Set([...values, active[name]].filter(Boolean))]) {
          const option = el('option', name === 'tag' ? tagLabel(value) : value);
          option.value = value;
          select.append(option);
        }
        select.value = active[name] || '';
        select.addEventListener('change', () => { active[name] = select.value; redraw(); });
        controls.append(field(label, select, `filter-${name}`));
      }
      const count = Object.values(active).filter(Boolean).length;
      controls.append(el('span', count ? `${count} active filters` : 'No active filters', 'help'));
      controls.append(button('Clear filters', 'secondary', () => { filters[key] = {}; redraw(); }));
      container.append(controls);
      return source.filter(item => (!active.type || item.type === active.type) &&
        (!active.status || item.status === active.status) &&
        (!active.tag || (item.tags || []).includes(active.tag)));
    }

    function ownerLabel(record) {
      return record.ownerDisplayName || record.ownerEmail ||
        (record.ownerUserId === identity.uid || !record.id ? identity.displayName || identity.email : '') || 'Name unavailable';
    }

    function sensitiveNotice() {
      return el('p', 'Sensitive material - reader discretion advised.', 'cms-sensitive-notice');
    }

    async function showDetails(id) {
      const version = ++viewVersion;
      const record = await call('get', { id });

      if (version !== viewVersion) return;

      renderDetails(record);
    }

    function renderDetails(record) {
      const id = record.id;

      current = record;
      mode = 'details';
      clear();

      const actions = [];
      const canWriteRecord = canWriteType(record.type);

      if (canWriteRecord) {
        actions.push(
          button('Edit', 'secondary', () => showEditor(record))
        );
      }

      actions.push(
        button('View', 'secondary', () => showPreview(record))
      );

      if (
        canWriteRecord &&
        (record.status === 'PUBLISHED' ||
          record.hasPublishedVersion)
      ) {
        actions.push(
          button(
            'Unpublish',
            'secondary',
            () => changeContent('returnToDraft', id)
          )
        );
      }

      if (
        record.status !== 'PUBLISHED' &&
        canWriteRecord &&
        config.canPublish
      ) {
        actions.push(
          button(
            'Publish',
            'primary',
            () => changeContent('publish', id)
          )
        );
      }

      if (canWriteRecord) {
        actions.push(
          button(
            'Delete',
            'danger',
            async () => {
              const confirmed = await ui.confirm(
                `Delete "${record.title || 'Untitled'}"? It will move to your Trash.`
              );

              if (!confirmed) return;

              await call('delete', { id });
              items = items.filter(item => item.id !== id);
              showList();
            }
          )
        );
      }

      pageBar(
        record.title || 'Untitled',
        showList,
        actions
      );

      if (record.hasPublishedVersion) {
        container.append(
          el(
            'div',
            'Draft changes await publication. The approved version is still live.',
            'cms-publish-note'
          )
        );
      }

      const cover = el('div', undefined, 'cms-detail-cover');
      cover.append(
        contentVisual(record, 'cms-detail-cover-image')
      );
      container.append(cover);

      const layout = el('div', undefined, 'cms-detail-layout');
      const main = el('article', undefined, 'cms-detail-main');
      const aside = el('aside', undefined, 'cms-detail-sidebar');

      const badgeRow = el('div', undefined, 'cms-detail-badges');
      badgeRow.append(
        typePill(record.type),
        statusPill(record.status)
      );

      if (record.sensitive) main.append(sensitiveNotice());
      main.append(
        badgeRow,
        el('h1', record.title || 'Untitled', 'cms-detail-title')
      );

      if (record.shortDescription) {
        main.append(
          el(
            'p',
            record.shortDescription,
            'cms-detail-lead'
          )
        );
      }

      const body = el('div', undefined, 'cms-detail-body');

      if (
        record.type === 'LINK' &&
        record.externalUrl
      ) {
        const link = el(
          'a',
          record.externalUrl,
          'cms-external-link'
        );
        link.href = record.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        body.append(link);
      }

      const rendered = renderMarkdown(record.bodyMarkdown || '');

      if (record.bodyMarkdown) {
        body.append(rendered);
      } else {
        body.append(
          el(
            'p',
            'No content has been added yet.',
            'cms-empty-body'
          )
        );
      }

      main.append(body);

      const details = sidebarPanel('Content Details');
      details.append(
        detailRow('Author', ownerLabel(record)),
        detailRow('Type', record.type),
        detailRow('Status', record.status),
        detailRow('Visibility', record.visibility),
        detailRow(
          'Sensitive',
          record.sensitive ? 'Yes' : 'No'
        ),
        detailRow('Created', fmtDate(record.createdAt)),
        detailRow('Updated', fmtDate(record.updatedAt))
      );
      aside.append(details);

      const tagPanel = sidebarPanel('Tags');
      const tagHost = el('div', undefined, 'cms-tag-chips');

      if (record.tags?.length) {
        record.tags.forEach(tagId => {
          tagHost.append(
            el(
              'span',
              tagLabel(tagId),
              'cms-tag-chip'
            )
          );
        });
      } else {
        tagHost.append(
          el('span', 'No tags', 'cms-side-muted')
        );
      }

      tagPanel.append(tagHost);
      aside.append(tagPanel);

      const related = relatedItems(record);

      if (related.length) {
        const relatedPanel = sidebarPanel('Related Content');
        const relatedHost = el(
          'div',
          undefined,
          'cms-related-list'
        );

        related.forEach(item => {
          const relatedButton = button(
            '',
            'cms-related-item',
            () => showDetails(item.id)
          );

          const thumb = el(
            'span',
            undefined,
            'cms-related-thumb'
          );
          thumb.append(
            contentVisual(
              item,
              'cms-related-thumb-image'
            )
          );

          const copy = el(
            'span',
            undefined,
            'cms-related-copy'
          );
          copy.append(
            el(
              'strong',
              item.title || 'Untitled'
            ),
            typePill(item.type)
          );

          relatedButton.append(thumb, copy);
          relatedHost.append(relatedButton);
        });

        relatedPanel.append(relatedHost);
        aside.append(relatedPanel);
      }

      layout.append(main, aside);
      container.append(layout);

      const validation = el(
        'div',
        '',
        'cms-validation-summary notice error-box'
      );
      validation.hidden = true;
      container.append(validation);
    }

    function showPreview(record) {
      clear();

      header(
        'Preview',
        record.title || 'Untitled',
        [
          button(
            'Back',
            'secondary',
            () => renderDetails(record)
          )
        ]
      );

      const article = el(
        'article',
        undefined,
        'cms-preview'
      );

      if (record.heroImage) {
        const hero = document.createElement('img');
        hero.src = record.heroImage;
        hero.alt = record.heroImageAltText || '';
        hero.className = 'cms-preview-hero';
        article.append(hero);
      }

      if (record.sensitive) article.append(sensitiveNotice());
      article.append(
        el('h1', record.title || 'Untitled')
      );

      if (record.shortDescription) {
        article.append(
          el(
            'p',
            record.shortDescription,
            'cms-lead'
          )
        );
      }

      if (
        record.type === 'LINK' &&
        record.externalUrl
      ) {
        const link = el(
          'a',
          record.externalUrl,
          'cms-external-link'
        );
        link.href = record.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        article.append(link);
      }

      article.append(
        renderMarkdown(record.bodyMarkdown || '')
      );

      container.append(article);
    }

    function input(type = 'text') {
      const node = document.createElement('input');
      node.type = type;
      return node;
    }

    function textarea(rows = 8) {
      const node = document.createElement('textarea');
      node.rows = rows;
      return node;
    }

    function showEditor(record) {
      if (!canWriteType(record.type)) {
        ui.status('You do not have permission to edit this content type.', 'error');
        showList();
        return;
      }

      current = record;
      mode = 'edit';
      clear();

      const isExisting = Boolean(record.id);
      const currentStatus = record.status || 'DRAFT';

      const title = input();
      title.value = record.title || '';
      title.maxLength =
        config.limits.titleCharacters;

      const short = textarea(3);
      short.value = record.shortDescription || '';
      short.maxLength =
        config.limits.shortDescriptionCharacters;

      const visibility =
        document.createElement('select');

      ['PUBLIC', 'AUTHENTICATED'].forEach(value => {
        const option = el('option', value);
        option.value = value;
        visibility.append(option);
      });

      visibility.value =
        record.visibility ||
        config.defaults.visibility;

      const sensitive = input('checkbox');
      sensitive.checked =
        record.sensitive === true;

      const hero = input();
      hero.value = record.heroImage || '';
      hero.placeholder = '/images/example.jpg';

      const alt = input();
      alt.value =
        record.heroImageAltText || '';
      alt.maxLength =
        config.limits.shortDescriptionCharacters;

      const tagSection = el(
        'fieldset',
        undefined,
        'cms-tags-field cms-tags-field-sidebar'
      );
      tagSection.append(el('legend', 'Tags'));

      tags.forEach(tag => {
        const label = el(
          'label',
          undefined,
          'cms-check'
        );
        const box = input('checkbox');

        box.value = tag.id;
        box.checked =
          (record.tags || []).includes(tag.id);

        label.append(
          box,
          el('span', tag.label)
        );
        tagSection.append(label);
      });

      let url = null;

      if (record.type === 'LINK') {
        url = input('url');
        url.value = record.externalUrl || '';
        url.maxLength =
          config.limits.urlCharacters;
      }

      const body = textarea(
        record.type === 'LINK' ? 10 : 26
      );
      body.value = record.bodyMarkdown || '';

      const bodyLimit =
        record.type === 'STORY'
          ? config.limits.storyBodyCharacters
          : record.type === 'LINK'
            ? config.limits.linkDescriptionCharacters
            : null;

      if (bodyLimit) {
        body.maxLength = bodyLimit;
      }

      const bodyLabel =
        record.type === 'LINK'
          ? 'Longer Description / Context'
          : record.type === 'ARTICLE' ? 'Article Text' : 'Story Text';

      const bodyField = field(
        bodyLabel,
        body,
        'bodyMarkdown'
      );

      const count = el(
        'span',
        '',
        'cms-counter'
      );
      bodyField.append(count);

      const updateCount = () => {
        const length = Array.from(body.value).length;
        count.textContent =
          `${length}${bodyLimit ? ` / ${bodyLimit}` : ''} characters`;
      };

      body.addEventListener(
        'input',
        updateCount
      );
      updateCount();

      const saveRecord = async () => {
        resetErrors();

        const payload = {
          type: record.type,
          title: title.value,
          shortDescription: short.value,
          visibility: visibility.value,
          sensitive: sensitive.checked,
          heroImage: hero.value,
          heroImageAltText: alt.value,
          bodyMarkdown: body.value,
          externalUrl: url ? url.value : '',
          tags: [
            ...tagSection.querySelectorAll(
              'input:checked'
            )
          ].map(node => node.value)
        };

        const saved = await call(
          'save',
          {
            id: record.id || '',
            content: payload
          }
        );

        const savedRecord = acceptResult(saved);
        renderDetails(savedRecord);
        return savedRecord;
      };

      const save = button(
        currentStatus === 'PUBLISHED'
          ? 'Save Changes'
          : 'Save Draft',
        'primary',
        saveRecord
      );

      const actions = [save];

      if (
        isExisting &&
        currentStatus === 'DRAFT' &&
        config.canPublish
      ) {
        actions.push(
          button(
            'Publish',
            'primary',
            async () => {
              resetErrors();
              await changeContent(
                'publish',
                record.id
              );
            }
          )
        );
      }

      pageBar(
        isExisting
          ? `Edit ${record.title || 'Content'}`
          : `Create ${record.type}`,
        async () => {
          if (await ui.confirm('Cancel editing? Any unsaved changes will be lost.')) showList();
        },
        actions,
        'Cancel'
      );

      const validation = el(
        'div',
        '',
        'cms-validation-summary notice error-box'
      );
      validation.hidden = true;
      container.append(validation);

      const cover = el(
        'div',
        undefined,
        'cms-detail-cover cms-editor-cover'
      );
      const coverImage = contentVisual(
        {
          type: record.type,
          heroImage: hero.value,
          heroImageAltText: alt.value
        },
        'cms-detail-cover-image'
      );
      cover.append(coverImage);
      container.append(cover);

      const refreshCover = () => {
        cover.replaceChildren(
          contentVisual(
            {
              type: record.type,
              heroImage: hero.value.trim(),
              heroImageAltText: alt.value
            },
            'cms-detail-cover-image'
          )
        );
      };

      hero.addEventListener('change', refreshCover);
      hero.addEventListener('blur', refreshCover);
      alt.addEventListener('change', refreshCover);

      const form = el(
        'form',
        undefined,
        'cms-editor-form'
      );

      const layout = el(
        'div',
        undefined,
        'cms-detail-layout cms-editor-layout'
      );

      const main = el(
        'section',
        undefined,
        'cms-detail-main cms-editor-main'
      );

      const badgeRow = el(
        'div',
        undefined,
        'cms-detail-badges'
      );
      badgeRow.append(
        typePill(record.type),
        statusPill(currentStatus)
      );

      const titleField = field(
        'Title',
        title,
        'title'
      );
      titleField.classList.add(
        'cms-title-field'
      );

      const shortField = field(
        'Short Description',
        short,
        'shortDescription'
      );

      main.append(
        badgeRow,
        titleField,
        shortField
      );

      if (url) {
        main.append(
          field(
            'External URL',
            url,
            'externalUrl'
          )
        );
      }

      main.append(bodyField);

      const aside = el(
        'aside',
        undefined,
        'cms-detail-sidebar cms-editor-sidebar'
      );

      const details = sidebarPanel('Content Details');
      details.append(
        detailRow('Author', ownerLabel(record)),
        detailRow('Type', record.type),
        detailRow('Status', currentStatus)
      );

      const sensitiveField = field(
        'Sensitive Material',
        sensitive,
        'sensitive'
      );
      sensitiveField.classList.add(
        'cms-inline-check-field'
      );
      const warning = sensitiveNotice();
      warning.setAttribute('aria-live', 'polite');
      const updateSensitive = () => {
        warning.hidden = !sensitive.checked;
        sensitiveField.classList.toggle('is-sensitive', sensitive.checked);
      };
      sensitive.addEventListener('change', updateSensitive);
      updateSensitive();
      details.append(sensitiveField, warning);

      if (record.createdAt) {
        details.append(
          detailRow(
            'Created',
            fmtDate(record.createdAt)
          )
        );
      }

      if (record.updatedAt) {
        details.append(
          detailRow(
            'Updated',
            fmtDate(record.updatedAt)
          )
        );
      }

      aside.append(details);

      const coverPanel = sidebarPanel('Cover');
      coverPanel.append(
        field(
          'Hero Image path',
          hero,
          'heroImage'
        ),
        field(
          'Hero Image Alt Text',
          alt,
          'heroImageAltText'
        ),
        el(
          'p',
          'If no hero image is supplied, the content type motif is used automatically.',
          'cms-side-help'
        )
      );
      aside.append(coverPanel);

      const tagsPanel = sidebarPanel('Tags');
      tagsPanel.append(tagSection);
      aside.append(tagsPanel);

      layout.append(main, aside);
      form.append(layout);

      form.addEventListener(
        'submit',
        event => {
          event.preventDefault();
          save.click();
        }
      );

      container.append(form);
    }

    async function showTrash(cachedTrash) {
      clear();

      header(
        'Trash',
        config.isAdmin
          ? 'Deleted content across all users.'
          : 'Your deleted content, including items deleted by an administrator.',
        [button('Back', 'secondary', showList)]
      );

      const version = viewVersion;
      const trash = Array.isArray(cachedTrash) ? cachedTrash : await call('trash');

      if (version !== viewVersion) return;

      const visibleTrash = filterItems(trash, 'trash', () => showTrash(trash));
      if (!visibleTrash.length) {
        container.append(
          el('div', trash.length ? 'No items match your filters. Clear filters to show all items in this view.' : 'Trash is empty.', 'empty')
        );
        return;
      }

      const host = el(
        'div',
        undefined,
        'cms-list'
      );

      visibleTrash.forEach(item => {
        const row = el(
          'div',
          undefined,
          'cms-trash-row'
        );

        row.append(
          el(
            'div',
            item.title || 'Untitled'
          ),
          el('span', item.type),
          el(
            'span',
            `Deleted ${fmtDate(item.deletedAt)}`
          )
        );

        if (canWriteType(item.type)) {
          row.append(
            button(
              'Restore',
              'secondary',
              async () => {
                acceptResult(
                  await call(
                    'restore',
                    { id: item.id }
                  )
                );
                showList();
              }
            )
          );
        }

        host.append(row);
      });

      container.append(host);
    }

    async function showTags() {
      clear();

      header(
        'Manage Tags',
        'Tags are centrally administered.',
        [button('Back', 'secondary', showList)]
      );

      const form = el(
        'form',
        undefined,
        'cms-tag-manager'
      );

      const name = input();
      name.maxLength = 40;
      name.placeholder = 'New tag';

      const add = button(
        'Add Tag',
        'primary',
        async () => {
          if (!name.value.trim()) return;

          try {
            const tag = await call(
              'saveTag',
              { label: name.value }
            );

            tags = tags.filter(
              item => item.id !== tag.id
            );
            tags.push(tag);
            tags.sort((a, b) =>
              a.label.localeCompare(b.label)
            );

            showTags();
          } catch (error) {
            showError(error);
          }
        }
      );

      form.append(
        field('Tag name', name, 'label'),
        add
      );

      form.addEventListener(
        'submit',
        event => event.preventDefault()
      );

      container.append(form);

      const host = el(
        'div',
        undefined,
        'cms-list'
      );

      tags.forEach(tag => {
        const row = el(
          'div',
          undefined,
          'cms-trash-row'
        );

        row.append(
          el('strong', tag.label),
          el('span', tag.id),
          button(
            'Delete',
            'danger-outline',
            async () => {
              try {
                await call(
                  'deleteTag',
                  { id: tag.id }
                );

                tags = tags.filter(
                  item => item.id !== tag.id
                );

                showTags();
              } catch (error) {
                showError(error);
              }
            }
          )
        );

        host.append(row);
      });

      container.append(host);
    }

    function importChunks(kind, values, format) {
      const chunks = [];
      let current = [];

      const bytes = items =>
        new TextEncoder().encode(
          JSON.stringify({
            format,
            kind,
            items
          })
        ).length;

      for (const value of values) {
        const candidate = current.concat([value]);

        if (
          current.length &&
          (candidate.length > 10 || bytes(candidate) > 150000)
        ) {
          chunks.push(current);
          current = [value];
        } else {
          current = candidate;
        }

        if (bytes(current) > 150000) {
          throw new Error(
            'One imported item is too large for the Content Handler.'
          );
        }
      }

      if (current.length) chunks.push(current);
      return chunks;
    }

    async function showImport() {
      clear();

      header(
        'Import Test Data',
        'Import KCW seed authors, tags, drafts, and published content.',
        [button('Back', 'secondary', showList)]
      );

      const file = input('file');
      file.accept = 'application/json,.json';

      const summary = el(
        'div',
        'Choose a kcw-content-seed-v2 JSON file.',
        'cms-side-panel'
      );

      const progress = el(
        'div',
        '',
        'cms-validation-summary notice'
      );
      progress.hidden = true;

      let parsed = null;

      const validateFile = value => {
        if (
          !value ||
          value.format !== 'kcw-content-seed-v2' ||
          !Array.isArray(value.authors) ||
          !Array.isArray(value.tags) ||
          !Array.isArray(value.content)
        ) {
          throw new Error(
            'This is not a supported KCW content seed file.'
          );
        }

        return value;
      };

      const describe = value => {
        const published = value.content.filter(
          item =>
            String(item.status || '').toUpperCase() === 'PUBLISHED'
        ).length;

        const publicPublished = value.content.filter(
          item =>
            String(item.status || '').toUpperCase() === 'PUBLISHED' &&
            String(item.visibility || '').toUpperCase() === 'PUBLIC'
        ).length;

        summary.replaceChildren(
          el('h2', 'Import Preview'),
          detailRow('Authors', String(value.authors.length)),
          detailRow('Tags', String(value.tags.length)),
          detailRow('Content', String(value.content.length)),
          detailRow('Published', String(published)),
          detailRow('Public projections', String(publicPublished)),
          detailRow(
            'Drafts',
            String(value.content.length - published)
          )
        );
      };

      file.addEventListener('change', async () => {
        parsed = null;
        progress.hidden = true;

        const selected = file.files && file.files[0];

        if (!selected) {
          summary.textContent =
            'Choose a kcw-content-seed-v2 JSON file.';
          return;
        }

        try {
          const raw = await selected.text();
          parsed = validateFile(JSON.parse(raw));
          describe(parsed);
        } catch (error) {
          summary.textContent =
            error?.message || 'The import file could not be read.';
        }
      });

      const runImport = button(
        'Import',
        'primary',
        async () => {
          if (!parsed) {
            throw new Error(
              'Choose and validate an import file first.'
            );
          }

          if (
            !(await ui.confirm(
              'Import this seed data? Existing seed IDs will be overwritten.'
            ))
          ) {
            return;
          }

          const work = [
            ['authors', parsed.authors],
            ['tags', parsed.tags],
            ['content', parsed.content]
          ];

          const batches = work.flatMap(([kind, values]) =>
            importChunks(kind, values, parsed.format)
              .map(items => ({ kind, items }))
          );

          let completed = 0;
          let imported = 0;
          let projected = 0;

          progress.hidden = false;

          for (const batch of batches) {
            progress.textContent =
              `Importing batch ${completed + 1} of ${batches.length}…`;

            const result = await call(
              'importBatch',
              {
                format: parsed.format,
                kind: batch.kind,
                items: batch.items
              }
            );

            completed += 1;
            imported += Number(result.imported || 0);
            projected += Number(result.publishedPublic || 0);
          }

          progress.textContent =
            `Import complete: ${imported} records processed; ${projected} public content projections created.`;

          await loadData();
        }
      );

      const panel = el(
        'section',
        undefined,
        'cms-editor-form'
      );

      panel.append(
        field('KCW seed JSON', file, 'importFile'),
        summary,
        progress,
        runImport
      );

      container.append(panel);
    }

    async function refreshAndList(
      nextScope = scope
    ) {
      const nextItems = await call(
        'list',
        { scope: nextScope }
      );

      scope = nextScope;
      items = nextItems;
      showList();
    }

    try {
      await loadData();
      await showList();
    } catch (error) {
      if (!disposed && !signal.aborted) {
        clear();
        header(
          'Content',
          'The module could not load.'
        );
        showError(error);
      }
    }

    return () => {
      signal.removeEventListener(
        'abort',
        dispose
      );
      dispose();
    };
  }
};
