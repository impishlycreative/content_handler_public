const CONTENT_TYPES = Object.freeze([
  { key: 'article', label: 'Article' },
  { key: 'story', label: 'Story' },
  { key: 'link', label: 'Link' }
]);

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

function unwrap(result) {
  return result?.data ?? result;
}

function accessLabel(value) {
  if (value === 'WRITE') return 'Edit';
  if (value === 'READ') return 'View';
  return 'None';
}

export default {
  id: 'users',
  title: 'Users',
  permissions: [],
  anyPermissions: ['users.admin', 'content.admin'],

  async mount({ container, api, ui, signal }) {
    container.classList.add('users-module');

    let disposed = false;
    let users = [];
    let busy = false;

    const call = async (action, data = {}) => {
      const response = await api(`users.${action}`, data);
      if (disposed || signal.aborted) {
        throw new DOMException('Module closed.', 'AbortError');
      }
      return unwrap(response);
    };

    const showNotice = (message, kind = '') => {
      const notice = container.querySelector('#usersNotice');
      if (!notice || disposed) return;
      notice.textContent = message;
      notice.className = `users-notice ${kind}`.trim();
      notice.hidden = !message;
    };

    const safeAction = handler => async event => {
      event?.preventDefault?.();
      if (busy || disposed || signal.aborted) return;
      busy = true;
      try {
        await handler(event);
      } catch (error) {
        showNotice(
          error?.message || 'The request could not be completed.',
          'users-error'
        );
      } finally {
        busy = false;
      }
    };

    container.innerHTML = `
      <div class="users-toolbar">
        <div>
          <p class="eyebrow">USER MANAGEMENT</p>
          <h1>Users</h1>
          <p class="help">Add Content Handler users and control which content types they can view or edit.</p>
        </div>
        <button id="usersAddButton" type="button" class="primary">+ Add user</button>
      </div>

      <div id="usersNotice" class="users-notice" role="status" hidden></div>
      <section id="usersList" class="users-list" aria-live="polite"></section>

      <dialog id="usersDialog" class="users-dialog" aria-labelledby="usersDialogTitle">
        <form id="usersForm">
          <div class="users-dialog-head">
            <div>
              <p class="eyebrow">NEW ACCOUNT</p>
              <h2 id="usersDialogTitle">Add user</h2>
            </div>
            <button id="usersCloseDialog" type="button" class="users-icon-button" aria-label="Close">×</button>
          </div>

          <p id="usersFormError" class="users-form-error" role="alert" hidden></p>

          <label>
            Display name
            <input id="usersDisplayName" maxlength="80" autocomplete="off" required>
          </label>

          <label>
            Email
            <input id="usersEmail" type="email" maxlength="254" autocomplete="off" required>
          </label>

          <label>
            Role
            <select id="usersRole">
              <option value="USER">User</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </label>

          <fieldset class="users-access">
            <legend>Content access</legend>
            <p class="help">View allows reading that type. Edit includes View and allows creating and changing that type.</p>
            <div class="users-access-grid" id="usersAccessGrid"></div>
          </fieldset>

          <div id="usersAdminNote" class="users-admin-note" hidden>
            Administrators receive full Content, Calendar Manager, publishing, and user-management access.
          </div>

          <div class="users-dialog-actions">
            <button id="usersCancelButton" type="button" class="secondary">Cancel</button>
            <button id="usersSubmitButton" type="submit" class="primary">Add user &amp; send invitation</button>
          </div>
        </form>
      </dialog>
    `;

    const q = selector => container.querySelector(selector);
    const listEl = q('#usersList');
    const dialog = q('#usersDialog');
    const form = q('#usersForm');
    const roleSelect = q('#usersRole');
    const accessGrid = q('#usersAccessGrid');
    const formError = q('#usersFormError');

    const accessSelects = {};

    for (const type of CONTENT_TYPES) {
      const label = el('label', undefined, 'users-access-row');
      label.append(el('span', type.label, 'users-access-label'));

      const select = document.createElement('select');
      select.setAttribute('aria-label', `${type.label} access`);

      for (const [value, labelText] of [
        ['NONE', 'None'],
        ['READ', 'View'],
        ['WRITE', 'Edit']
      ]) {
        const option = el('option', labelText);
        option.value = value;
        select.append(option);
      }

      select.value = 'WRITE';
      accessSelects[type.key] = select;
      label.append(select);
      accessGrid.append(label);
    }

    function applyRoleState() {
      const isAdmin = roleSelect.value === 'ADMINISTRATOR';
      q('#usersAdminNote').hidden = !isAdmin;

      for (const type of CONTENT_TYPES) {
        const select = accessSelects[type.key];
        if (isAdmin) select.value = 'WRITE';
        select.disabled = isAdmin;
      }
    }

    roleSelect.addEventListener('change', applyRoleState);

    function resetForm() {
      form.reset();
      roleSelect.value = 'USER';
      for (const type of CONTENT_TYPES) {
        accessSelects[type.key].value = 'WRITE';
        accessSelects[type.key].disabled = false;
      }
      formError.hidden = true;
      formError.textContent = '';
      applyRoleState();
    }

    function openDialog() {
      resetForm();
      dialog.showModal();
      q('#usersDisplayName').focus();
    }

    function summaryAccess(user) {
      return CONTENT_TYPES
        .filter(type => user.contentAccess?.[type.key] !== 'NONE')
        .map(type => `${type.label}: ${accessLabel(user.contentAccess?.[type.key])}`)
        .join(' · ') || 'No Content access';
    }

    function renderUsers() {
      listEl.replaceChildren();

      if (!users.length) {
        listEl.append(
          el('div', 'No authorized users were found.', 'empty')
        );
        return;
      }

      for (const user of users) {
        const row = el('article', undefined, 'users-row');

        const identity = el('div', undefined, 'users-identity');
        identity.append(
          el('strong', user.displayName || user.email || user.uid),
          el('span', user.email || 'Email unavailable', 'users-email')
        );

        const role = el(
          'span',
          user.role === 'ADMINISTRATOR' ? 'Administrator' : 'User',
          `users-role users-role-${String(user.role || '').toLowerCase()}`
        );

        const access = el('div', summaryAccess(user), 'users-access-summary');

        const status = el(
          'span',
          user.accountStatus === 'DISABLED'
            ? 'Disabled'
            : user.accountStatus === 'FIREBASE_ACCOUNT_MISSING'
              ? 'Firebase account missing'
              : user.accountStatus === 'FIREBASE_STATUS_UNAVAILABLE'
                ? 'Firebase status unavailable'
                : 'Active',
          `users-status users-status-${String(user.accountStatus || '').toLowerCase()}`
        );

        const actions = el('div', undefined, 'users-row-actions');

        const resend = makeButton(
          'Resend invitation',
          'secondary',
          safeAction(async () => {
            resend.disabled = true;
            try {
              const result = await call('resendInvitation', { uid: user.uid });
              showNotice(
                result.status === 'INVITATION_SENT'
                  ? `Invitation sent to ${user.email}.`
                  : `The invitation to ${user.email} could not be sent.`,
                result.status === 'INVITATION_SENT' ? 'users-success' : 'users-error'
              );
            } finally {
              resend.disabled = false;
            }
          })
        );

        resend.disabled =
          !user.email ||
          user.accountStatus === 'FIREBASE_ACCOUNT_MISSING' ||
          user.accountStatus === 'FIREBASE_STATUS_UNAVAILABLE';

        actions.append(resend);
        row.append(identity, role, access, status, actions);
        listEl.append(row);
      }
    }

    async function loadUsers() {
      listEl.replaceChildren(
        el('div', 'Loading users…', 'empty')
      );

      try {
        const result = await call('list');
        users = Array.isArray(result?.users) ? result.users : [];
        renderUsers();

        if (result?.firebaseStatusAvailable === false) {
          const code =
            result?.firebaseAdminError?.code || 'FIREBASE_ERROR';
          const message =
            result?.firebaseAdminError?.message ||
            'Firebase account status is unavailable.';

          showNotice(
            `Users loaded from Content Handler authorization, but Firebase administration is unavailable: ${message} (${code})`,
            'users-warning'
          );
        }
      } catch (error) {
        users = [];
        renderUsers();
        showNotice(
          `Users could not be loaded: ${error?.message || 'Unknown error'}${error?.code ? ` (${error.code})` : ''}`,
          'users-error'
        );
      }
    }

    q('#usersAddButton').addEventListener('click', openDialog);
    q('#usersCloseDialog').addEventListener('click', () => dialog.close());
    q('#usersCancelButton').addEventListener('click', () => dialog.close());

    form.addEventListener('submit', safeAction(async () => {
      formError.hidden = true;
      formError.textContent = '';

      const payload = {
        displayName: q('#usersDisplayName').value,
        email: q('#usersEmail').value,
        role: roleSelect.value,
        contentAccess: Object.fromEntries(
          CONTENT_TYPES.map(type => [
            type.key,
            accessSelects[type.key].value
          ])
        )
      };

      try {
        const result = await call('create', payload);
        dialog.close();

        const messages = {
          INVITATION_SENT:
            `${result.user.displayName} was added and an invitation was sent to ${result.user.email}.`,
          INVITATION_FAILED:
            `${result.user.displayName} was added, but the invitation could not be sent. Use Resend invitation to try again.`,
          PROFILE_FAILED:
            `${result.user.displayName} was added and invited, but profile initialization needs attention.`,
          PROFILE_AND_INVITATION_FAILED:
            `${result.user.displayName} was added, but profile initialization and invitation delivery need attention.`
        };

        const ok = result.status === 'INVITATION_SENT';
        showNotice(
          messages[result.status] || 'The user was added.',
          ok ? 'users-success' : 'users-warning'
        );

        await loadUsers();
      } catch (error) {
        formError.textContent =
          error?.message || 'The user could not be added.';
        formError.hidden = false;
      }
    }));

    signal.addEventListener('abort', () => {
      disposed = true;
      if (dialog.open) dialog.close();
      container.replaceChildren();
    }, { once: true });

    await loadUsers();

    return () => {
      disposed = true;
      if (dialog.open) dialog.close();
      container.replaceChildren();
    };
  }
};
