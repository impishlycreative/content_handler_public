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

  const frame = document.createElement('iframe');
  frame.title = 'Rendered newsletter email';
  frame.sandbox = 'allow-popups';
  frame.className = 'newsletter-preview-frame';

  dialog.append(bar, frame);
  document.body.append(dialog);

  return { dialog, frame };
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

  async mount({ container, ui, signal }) {
    ensureEditorStylesheet();
    const { grapesjs, grapesJSMJML } = await loadEditorDependencies();
    if (signal.aborted) throw new DOMException('Module closed.', 'AbortError');
    container.classList.add('newsletter-module');

    let editor = null;
    let disposed = false;
    const preview = createPreviewDialog();

    const toolbar = el('div', undefined, 'newsletter-toolbar');
    const heading = el('div');
    heading.append(
      el('p', 'NEWSLETTER PROTOTYPE', 'eyebrow'),
      el('h1', 'Newsletter designer'),
      el(
        'p',
        'Drag email-safe blocks into an approved layout. This proof-of-concept generates final HTML in the browser; saving and sending remain disconnected.',
        'help'
      )
    );

    const actions = el('div', undefined, 'newsletter-actions');
    const previewButton = button('Preview email', 'primary', () => {
      try {
        const mjml = editor.getHtml();
        const missing = validateRequiredLinks(mjml);
        if (missing.length) {
          ui.status('Preview blocked: the required unsubscribe, preferences, and privacy links must be present.', 'error');
          return;
        }

        const command = editor.Commands.get('mjml-code-to-html');
        const result = command.run(editor, { mjml });
        if (!result?.html) throw new Error('MJML did not return rendered HTML.');

        preview.frame.srcdoc = result.html;
        preview.dialog.showModal();
        ui.status('Rendered email HTML generated successfully.');
      } catch (error) {
        ui.status(error?.message || 'The email preview could not be generated.', 'error');
      }
    });

    actions.append(previewButton);
    toolbar.append(heading, actions);

    const templatePanel = el('section', undefined, 'newsletter-template-panel');
    templatePanel.append(
      el('strong', 'Approved layouts'),
      el('span', 'Choose a starting structure. The editor can then rearrange content within it.', 'help')
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
          editor.setComponents(templateMarkup(key));
          ui.status(`${label} template loaded.`);
        })
      );
    }
    templatePanel.append(templateButtons);

    const note = el(
      'div',
      'Prototype note: Current Schedule and Featured Item are real drag-and-drop blocks, but they contain sample data until the Calendar service boundary is connected. The final footer tokens are already enforced before preview.',
      'newsletter-prototype-note'
    );

    const editorHost = el('div', undefined, 'newsletter-editor-host');
    editorHost.id = `newsletter-editor-${crypto.randomUUID?.() || Date.now()}`;

    container.append(toolbar, templatePanel, note, editorHost);

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

    registerKcwBlocks(editor);
    editor.setComponents(templateMarkup('single'));

    signal.addEventListener('abort', () => {
      disposed = true;
      try { editor?.destroy(); } catch {}
      preview.dialog.remove();
    }, { once: true });

    editor.on('load', () => {
      if (!disposed) ui.status('Newsletter editor prototype loaded.');
    });

    return () => {
      disposed = true;
      try { editor?.destroy(); } catch {}
      preview.dialog.remove();
      container.classList.remove('newsletter-module');
    };
  }
};
