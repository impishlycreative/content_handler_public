const GRAPES_MODULE = 'https://cdn.jsdelivr.net/npm/grapesjs@0.23.6/+esm';
const MJML_PLUGIN_MODULE = 'https://cdn.jsdelivr.net/npm/grapesjs-mjml@1.0.8/+esm';
let dependencyPromise = null;

function loadEditorDependencies() {
  if (!dependencyPromise) {
    dependencyPromise = Promise.all([
      import(GRAPES_MODULE),
      import(MJML_PLUGIN_MODULE)
    ]).then(([grapes, plugin]) => ({
      grapesjs: grapes.default,
      grapesJSMJML: plugin.default
    }));
  }
  return dependencyPromise;
}

const GRAPES_CSS = 'https://cdn.jsdelivr.net/npm/grapesjs@0.23.6/dist/css/grapes.min.css';

const THEME = Object.freeze({
  primary: '#24694e',
  primaryDark: '#18533e',
  ink: '#142f25',
  muted: '#68746f',
  paper: '#fffefa',
  cream: '#f7f5ef',
  line: '#dfe3dd'
});

const REQUIRED_TOKENS = Object.freeze([
  '{{unsubscribe_url}}',
  '{{preferences_url}}',
  '{{privacy_url}}'
]);

function ensureEditorStylesheet() {
  if (document.querySelector('link[data-newsletter-grapes]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GRAPES_CSS;
  link.dataset.newsletterGrapes = 'true';
  document.head.append(link);
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className, onClick) {
  const node = el('button', text, className);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function unwrap(result) {
  return result?.data ?? result;
}

function formatDate(value) {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString()
    : 'Not saved yet';
}

function textInput(label, maxLength, placeholder = '') {
  const wrapper = el('label', undefined, 'newsletter-field');
  const caption = el('span', label, 'newsletter-field-label');
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = maxLength;
  input.placeholder = placeholder;
  wrapper.append(caption, input);
  return { wrapper, input };
}

function headerMarkup() {
  return `
    <mj-section background-color="${THEME.primaryDark}" padding="22px 24px">
      <mj-column>
        <mj-text color="#ffffff" font-size="22px" font-weight="700" padding="0">
          Kemptville Creative Writers
        </mj-text>
        <mj-text color="#dceae3" font-size="13px" padding="6px 0 0">
          Write, learn, and grow together.
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

function footerMarkup() {
  return `
    <mj-section background-color="#eef3f0" padding="20px 24px">
      <mj-column>
        <mj-text color="${THEME.muted}" font-size="12px" line-height="1.6" padding="0">
          You are receiving this newsletter because you confirmed your subscription
          and chose to receive weekly newsletters.
        </mj-text>
        <mj-text color="${THEME.muted}" font-size="12px" line-height="1.8" padding="10px 0 0">
          <a href="{{preferences_url}}" style="color:${THEME.primary};">Preferences</a>
          &nbsp;·&nbsp;
          <a href="{{privacy_url}}" style="color:${THEME.primary};">Privacy</a>
          &nbsp;·&nbsp;
          <a href="{{unsubscribe_url}}" style="color:${THEME.primary};">Unsubscribe</a>
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

function scheduleMarkup() {
  return `
    <mj-section background-color="#ffffff" padding="14px 24px">
      <mj-column>
        <mj-text color="${THEME.primaryDark}" font-size="18px" font-weight="700" padding="0 0 8px">
          Upcoming schedule
        </mj-text>
        <mj-text color="${THEME.ink}" font-size="14px" line-height="1.65" padding="0">
          <strong>Tuesday — Writing meeting</strong><br>
          Current calendar details will be inserted here when the Calendar service
          connection is enabled.
        </mj-text>
      </mj-column>
    </mj-section>
  `;
}

function featuredMarkup() {
  return `
    <mj-section background-color="#ffffff" padding="14px 24px">
      <mj-column>
        <mj-text color="${THEME.primary}" font-size="12px" font-weight="700" text-transform="uppercase" padding="0 0 5px">
          Featured
        </mj-text>
        <mj-text color="${THEME.ink}" font-size="20px" font-weight="700" padding="0 0 8px">
          Featured event title
        </mj-text>
        <mj-text color="${THEME.ink}" font-size="14px" line-height="1.65" padding="0 0 12px">
          The current featured event description and links will be populated from
          Calendar data in the service-integration phase.
        </mj-text>
        <mj-button background-color="${THEME.primary}" color="#ffffff" href="https://kemptvillecreativewriters.com/" border-radius="8px">
          Learn more
        </mj-button>
      </mj-column>
    </mj-section>
  `;
}

function templateMarkup(layout = 'single') {
  const body = {
    single: `
      <mj-section background-color="#ffffff" padding="24px">
        <mj-column>
          <mj-text color="${THEME.ink}" font-size="26px" font-weight="700" padding="0 0 12px">
            Weekly newsletter
          </mj-text>
          <mj-text color="${THEME.ink}" font-size="15px" line-height="1.7" padding="0">
            Start writing here, or drag approved blocks into the newsletter.
          </mj-text>
        </mj-column>
      </mj-section>
    `,
    two: `
      <mj-section background-color="#ffffff" padding="24px">
        <mj-column width="65%">
          <mj-text color="${THEME.ink}" font-size="24px" font-weight="700" padding="0 0 10px">
            Main story
          </mj-text>
          <mj-text color="${THEME.ink}" font-size="14px" line-height="1.7" padding="0">
            Use this wider column for the main newsletter content.
          </mj-text>
        </mj-column>
        <mj-column width="35%">
          <mj-text color="${THEME.primaryDark}" font-size="17px" font-weight="700" padding="0 0 10px">
            Sidebar
          </mj-text>
          <mj-text color="${THEME.ink}" font-size="13px" line-height="1.6" padding="0">
            Add reminders, links, or short updates here.
          </mj-text>
        </mj-column>
      </mj-section>
    `,
    three: `
      <mj-section background-color="#ffffff" padding="24px">
        <mj-column>
          <mj-text color="${THEME.primaryDark}" font-size="17px" font-weight="700">News</mj-text>
          <mj-text color="${THEME.ink}" font-size="13px" line-height="1.6">First column content.</mj-text>
        </mj-column>
        <mj-column>
          <mj-text color="${THEME.primaryDark}" font-size="17px" font-weight="700">Events</mj-text>
          <mj-text color="${THEME.ink}" font-size="13px" line-height="1.6">Second column content.</mj-text>
        </mj-column>
        <mj-column>
          <mj-text color="${THEME.primaryDark}" font-size="17px" font-weight="700">Links</mj-text>
          <mj-text color="${THEME.ink}" font-size="13px" line-height="1.6">Third column content.</mj-text>
        </mj-column>
      </mj-section>
    `
  }[layout] || '';

  return `
    <mjml>
      <mj-head>
        <mj-title>KCW Newsletter</mj-title>
        <mj-preview>Weekly news from Kemptville Creative Writers</mj-preview>
        <mj-attributes>
          <mj-all font-family="Arial, Helvetica, sans-serif" />
          <mj-body background-color="${THEME.cream}" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="${THEME.cream}">
        ${headerMarkup()}
        ${body}
        ${footerMarkup()}
      </mj-body>
    </mjml>
  `;
}

function validateRequiredLinks(mjml) {
  return REQUIRED_TOKENS.filter(token => !mjml.includes(token));
}

// grapesjs-mjml 1.0.8 renders mj-body with an editor-only
// "min-height: 100vh". That makes the Body drop target appear as a
// large blank box above its first newsletter section. Patch only the
// GrapesJS view; the saved MJML and rendered email remain unchanged.
function patchMjBodyEditorHeight(editor) {
  const type = editor?.Components?.getType?.('mj-body');
  const prototype = type?.view?.prototype;

  if (!prototype || prototype.__kcwNaturalBodyHeight) return;

  const originalRenderStyle = prototype.renderStyle;

  prototype.renderStyle = function(...args) {
    const result = originalRenderStyle?.apply(this, args);

    if (this.el?.style) {
      this.el.style.setProperty('min-height', '80px', 'important');
      this.el.style.setProperty('height', 'auto', 'important');
    }

    return result;
  };

  prototype.__kcwNaturalBodyHeight = true;
}

function registerKcwBlocks(editor) {
  const blocks = editor.BlockManager;
  const category = 'KCW dynamic content';

  blocks.add('kcw-schedule', {
    label: 'Current schedule',
    category,
    content: scheduleMarkup(),
    attributes: { title: 'Insert the current schedule block' }
  });

  blocks.add('kcw-featured', {
    label: 'Featured item',
    category,
    content: featuredMarkup(),
    attributes: { title: 'Insert the featured event block' }
  });

  blocks.add('kcw-header', {
    label: 'KCW header',
    category: 'KCW structure',
    content: headerMarkup()
  });

  blocks.add('kcw-footer', {
    label: 'Required footer',
    category: 'KCW structure',
    content: footerMarkup()
  });
}

function createPreviewDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'newsletter-preview-dialog';

  const bar = el('div', undefined, 'newsletter-preview-bar');
  bar.append(
    el('strong', 'Rendered email preview'),
    button('Close', 'secondary', () => dialog.close())
  );

  let frame = document.createElement('iframe');
  frame.title = 'Rendered newsletter email';
  frame.sandbox = 'allow-popups';
  frame.className = 'newsletter-preview-frame';

  dialog.append(bar, frame);
  document.body.append(dialog);

  function show(html) {
    const nextFrame = document.createElement('iframe');
    nextFrame.title = 'Rendered newsletter email';
    nextFrame.sandbox = 'allow-popups';
    nextFrame.className = 'newsletter-preview-frame';
    nextFrame.srcdoc = html;

    frame.replaceWith(nextFrame);
    frame = nextFrame;

    if (!dialog.open) dialog.showModal();
  }

  return { dialog, show };
}

export default {
  id: 'newsletter',
  title: 'Newsletter',
  permissions: [],
  anyPermissions: [
    'newsletter.read',
    'newsletter.write',
    'newsletter.admin',
    'content.write',
    'content.admin',
    'content.article.write',
    'content.story.write',
    'content.link.write'
  ],

  async mount({ container, api, ui, signal }) {
    ensureEditorStylesheet();
    const { grapesjs, grapesJSMJML } = await loadEditorDependencies();
    if (signal.aborted) throw new DOMException('Module closed.', 'AbortError');

    container.classList.add('newsletter-module');

    let editor = null;
    let disposed = false;
    let currentId = '';
    let currentLayout = 'single';
    let drafts = [];
    let dirty = false;
    const preview = createPreviewDialog();

    const call = async (action, data = {}) => {
      const response = await api(`newsletter.${action}`, data);
      if (disposed || signal.aborted) {
        throw new DOMException('Module closed.', 'AbortError');
      }
      return unwrap(response);
    };

    const toolbar = el('div', undefined, 'newsletter-toolbar');
    const heading = el('div');
    heading.append(
      el('p', 'NEWSLETTER', 'eyebrow'),
      el('h1', 'Newsletter designer'),
      el(
        'p',
        'Create and save editable newsletter drafts. Test and production sending remain disabled in this build.',
        'help'
      )
    );

    const actions = el('div', undefined, 'newsletter-actions');
    const newButton = button('New draft', 'secondary', () => newDraft());
    const saveButton = button('Save draft', 'primary', () => saveDraft());
    const previewButton = button('Preview email', 'secondary', () => previewEmail());
    actions.append(newButton, saveButton, previewButton);
    toolbar.append(heading, actions);

    const details = el('section', undefined, 'newsletter-details');
    const titleField = textInput('Internal title', 160, 'October weekly newsletter');
    const subjectField = textInput('Email subject', 200, 'This week at Kemptville Creative Writers');
    const previewField = textInput('Preview text', 300, 'A short inbox preview shown by many mail clients');
    const saveState = el('span', 'Not saved yet', 'newsletter-save-state');
    details.append(
      titleField.wrapper,
      subjectField.wrapper,
      previewField.wrapper,
      saveState
    );

    const draftsPanel = el('section', undefined, 'newsletter-drafts-panel');
    const draftsHead = el('div', undefined, 'newsletter-drafts-head');
    draftsHead.append(
      el('strong', 'Saved drafts'),
      button('Refresh', 'secondary newsletter-small-button', () => loadDrafts())
    );
    const draftsList = el('div', undefined, 'newsletter-drafts-list');
    draftsPanel.append(draftsHead, draftsList);

    const templatePanel = el('section', undefined, 'newsletter-template-panel');
    templatePanel.append(
      el('strong', 'Approved layouts'),
      el('span', 'Choose a starting structure. Loading a layout replaces the current canvas.', 'help')
    );

    const templateButtons = el('div', undefined, 'newsletter-template-buttons');
    for (const [key, label] of [
      ['single', 'Single column'],
      ['two', 'Two columns'],
      ['three', 'Three columns']
    ]) {
      templateButtons.append(
        button(label, 'secondary', () => {
          if (!editor) return;
          currentLayout = key;
          editor.setComponents(templateMarkup(key));
          markDirty();
          ui.status(`${label} template loaded.`);
        })
      );
    }
    templatePanel.append(templateButtons);

    const note = el(
      'div',
      'Current Schedule and Featured Item are drag-and-drop blocks with sample data for now. Saved drafts are stored in Firestore. Sending remains disconnected.',
      'newsletter-prototype-note'
    );

    const workspace = el('div', undefined, 'newsletter-persistence-layout');
    const side = el('aside', undefined, 'newsletter-persistence-side');
    const main = el('div', undefined, 'newsletter-persistence-main');
    side.append(draftsPanel, details, templatePanel, note);

    const editorHost = el('div', undefined, 'newsletter-editor-host');
    editorHost.id = `newsletter-editor-${crypto.randomUUID?.() || Date.now()}`;
    main.append(editorHost);
    workspace.append(side, main);
    container.append(toolbar, workspace);

    editor = grapesjs.init({
      container: editorHost,
      height: '720px',
      width: 'auto',
      fromElement: false,
      telemetry: false,
      noticeOnUnload: false,
      storageManager: false,
      plugins: [grapesJSMJML],
      pluginsOpts: {
        [grapesJSMJML]: {
          useCustomTheme: true,
          resetDevices: true,
          resetStyleManager: true
        }
      }
    });

    patchMjBodyEditorHeight(editor);
    registerKcwBlocks(editor);

    function markDirty() {
      dirty = true;
      saveState.textContent = currentId ? 'Unsaved changes' : 'New unsaved draft';
      saveState.classList.add('is-dirty');
    }

    function markSaved(updatedAt) {
      dirty = false;
      saveState.textContent = `Saved ${formatDate(updatedAt)}`;
      saveState.classList.remove('is-dirty');
    }

    function clearFields() {
      titleField.input.value = '';
      subjectField.input.value = '';
      previewField.input.value = '';
    }

    function newDraft() {
      currentId = '';
      currentLayout = 'single';
      clearFields();
      editor.setComponents(templateMarkup('single'));
      markDirty();
      titleField.input.focus();
      ui.status('New newsletter draft started.');
    }

    function renderDrafts() {
      draftsList.replaceChildren();

      if (!drafts.length) {
        draftsList.append(el('p', 'No saved newsletter drafts yet.', 'help'));
        return;
      }

      for (const draft of drafts) {
        const row = button('', 'newsletter-draft-row', () => openDraft(draft.id));
        const copy = el('span', undefined, 'newsletter-draft-copy');
        copy.append(
          el('strong', draft.title || 'Untitled newsletter'),
          el('small', draft.subject || 'No email subject yet'),
          el('small', `Updated ${formatDate(draft.updatedAt)}`)
        );
        const status = el('span', draft.status || 'DRAFT', 'newsletter-draft-status');
        row.append(copy, status);
        if (draft.id === currentId) row.classList.add('is-current');
        draftsList.append(row);
      }
    }

    async function loadDrafts() {
      try {
        drafts = await call('list', { scope: 'mine' });
        if (!Array.isArray(drafts)) drafts = [];
        renderDrafts();
      } catch (error) {
        drafts = [];
        renderDrafts();
        ui.status(
          error?.message || 'Saved newsletter drafts could not be loaded.',
          'error'
        );
      }
    }

    async function openDraft(id) {
      if (!id) return;

      try {
        const record = await call('get', { id });
        currentId = record.id;
        currentLayout = record.layout || 'custom';
        titleField.input.value = record.title || '';
        subjectField.input.value = record.subject || '';
        previewField.input.value = record.previewText || '';

        editor.setComponents(record.mjml || templateMarkup('single'));

        markSaved(record.updatedAt);
        renderDrafts();
        ui.status(`Opened ${record.title || 'newsletter draft'}.`);
      } catch (error) {
        ui.status(
          error?.message || 'The newsletter draft could not be opened.',
          'error'
        );
      }
    }

    async function saveDraft() {
      if (!editor || saveButton.disabled) return;

      const title = titleField.input.value.trim();
      if (!title) {
        ui.status('Enter an internal title before saving the newsletter.', 'error');
        titleField.input.focus();
        return;
      }

      saveButton.disabled = true;

      try {
        const mjml = editor.getHtml();
        const result = await call('save', {
          id: currentId || undefined,
          title,
          subject: subjectField.input.value.trim(),
          previewText: previewField.input.value.trim(),
          layout: currentLayout || 'custom',
          status: 'DRAFT',
          mjml
        });

        const record = result.newsletter || result;
        currentId = record.id;
        currentLayout = record.layout || currentLayout;
        markSaved(record.updatedAt);

        await loadDrafts();
        renderDrafts();
        ui.status('Newsletter draft saved to Firestore.');
      } catch (error) {
        ui.status(
          error?.message || 'The newsletter draft could not be saved.',
          'error'
        );
      } finally {
        saveButton.disabled = false;
      }
    }

    function previewEmail() {
      try {
        const mjml = editor.runCommand('mjml-code');

        if (!mjml) {
          throw new Error('MJML source could not be generated from the current layout.');
        }

        const missing = validateRequiredLinks(mjml);

        if (missing.length) {
          ui.status(
            'Preview blocked: the required unsubscribe, preferences, and privacy links must be present.',
            'error'
          );
          return;
        }

        const result = editor.runCommand('mjml-code-to-html', { mjml });

        if (!result?.html) {
          throw new Error('MJML did not return rendered HTML.');
        }

        preview.show(result.html);
        ui.status('Rendered email HTML generated successfully.');
      } catch (error) {
        ui.status(
          error?.message || 'The email preview could not be generated.',
          'error'
        );
      }
    }

    for (const input of [
      titleField.input,
      subjectField.input,
      previewField.input
    ]) {
      input.addEventListener('input', markDirty);
    }

    editor.on('component:update', markDirty);
    editor.on('component:add', markDirty);
    editor.on('component:remove', markDirty);

    editor.setComponents(templateMarkup('single'));
    dirty = false;
    saveState.textContent = 'Not saved yet';

    signal.addEventListener('abort', () => {
      disposed = true;
      try { editor?.destroy(); } catch {}
      preview.dialog.remove();
    }, { once: true });

    editor.on('load', () => {
      if (!disposed) ui.status('Newsletter editor loaded. Draft saving is enabled.');
    });

    await loadDrafts();

    return () => {
      disposed = true;
      try { editor?.destroy(); } catch {}
      preview.dialog.remove();
      container.classList.remove('newsletter-module');
    };
  }
};
