const ACCESS_GROUPS = Object.freeze([
  {
    id: 'CONTENT_VIEWERS',
    label: 'Content Viewers',
    description: 'Review Articles, Stories and Links.'
  },
  {
    id: 'CONTENT_EDITORS',
    label: 'Content Editors',
    description: 'Create, edit and publish Articles, Stories and Links.',
    includes: 'CONTENT_VIEWERS'
  },
  {
    id: 'CALENDAR_VIEWERS',
    label: 'Calendar Viewers',
    description: 'View Calendar Manager entries.'
  },
  {
    id: 'CALENDAR_EDITORS',
    label: 'Calendar Editors',
    description: 'Create and edit Calendar Manager entries.',
    includes: 'CALENDAR_VIEWERS'
  },
  {
    id: 'NEWSLETTER_VIEWERS',
    label: 'Newsletter Viewers',
    description: 'View existing and past newsletters.'
  },
  {
    id: 'NEWSLETTER_EDITORS',
    label: 'Newsletter Editors',
    description: 'Create and edit newsletter drafts.',
    includes: 'NEWSLETTER_VIEWERS'
  },
  {
    id: 'ADMINISTRATORS',
    label: 'Administrators',
    description: 'Full Content Handler administration and access.'
  }
]);

const GROUP_LABELS = Object.freeze(
  Object.fromEntries(
    ACCESS_GROUPS.map(group => [
      group.id,
      group.label
    ])
  )
);

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

export default {
  id: 'users',
  title: 'Users',
  permissions: [],
  anyPermissions: ['users.admin', 'content.admin'],

  async mount({ container, api, ui, signal, identity: currentIdentity }) {
    container.classList.add('users-module');

    let disposed = false;
    let users = [];
    let busy = false;
    let dialogMode = 'create';
    let editingUser = null;

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
          <p class="help">Add users and manage their Content, Calendar and Newsletter access groups.</p>
        </div>
        <button id="usersAddButton" type="button" class="primary">+ Add user</button>
      </div>

      <div id="usersNotice" class="users-notice" role="status" hidden></div>
      <section id="usersList" class="users-list" aria-live="polite"></section>

      <dialog id="usersDialog" class="users-dialog" aria-labelledby="usersDialogTitle">
        <form id="usersForm">
          <div class="users-dialog-head">
            <div>
              <p id="usersDialogEyebrow" class="eyebrow">NEW ACCOUNT</p>
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

          <fieldset class="users-access">
            <legend>Access groups</legend>
            <p class="help">Editor groups include their matching Viewer access. Administrators receive all access.</p>
            <div id="usersGroupGrid" class="users-group-grid"></div>

            <label id="usersNewsletterSendRow" class="users-group-row users-group-option">
              <input id="usersNewsletterSend" type="checkbox">
              <span class="users-group-copy">
                <strong>Newsletter Send</strong>
                <small>Allow production newsletter sending when the send workflow is enabled. Requires Newsletter Editors.</small>
              </span>
            </label>
          </fieldset>

          <div id="usersLegacyNote" class="users-admin-note" hidden>
            This account has legacy per-type Content permissions that do not map exactly to the new groups. Saving will replace those managed Content permissions with the groups selected here.
          </div>

          <div id="usersAdminNote" class="users-admin-note" hidden>
            Administrators receive full Content, Calendar, Newsletter, publishing and user-management access. Other group selections are not required.
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
    const groupGrid = q('#usersGroupGrid');
    const formError = q('#usersFormError');
    const sendCheckbox = q('#usersNewsletterSend');
    const groupCheckboxes = {};

    for (const group of ACCESS_GROUPS) {
      const label = el('label', undefined, 'users-group-row');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = group.id;
      checkbox.setAttribute('data-group', group.id);
      checkbox.setAttribute('aria-label', group.label);

      const copy = el('span', undefined, 'users-group-copy');
      copy.append(
        el('strong', group.label),
        el('small', group.description)
      );

      label.append(checkbox, copy);
      groupGrid.append(label);
      groupCheckboxes[group.id] = checkbox;
    }

    function setGroupChecked(id, checked) {
      if (groupCheckboxes[id]) {
        groupCheckboxes[id].checked = Boolean(checked);
      }
    }

    function syncGroupState() {
      const admin =
        groupCheckboxes.ADMINISTRATORS.checked;

      const pairs = [
        ['CONTENT_EDITORS', 'CONTENT_VIEWERS'],
        ['CALENDAR_EDITORS', 'CALENDAR_VIEWERS'],
        ['NEWSLETTER_EDITORS', 'NEWSLETTER_VIEWERS']
      ];

      for (const checkbox of Object.values(groupCheckboxes)) {
        checkbox.disabled = admin && checkbox !== groupCheckboxes.ADMINISTRATORS;
      }

      for (const [editorId, viewerId] of pairs) {
        const editor = groupCheckboxes[editorId];
        const viewer = groupCheckboxes[viewerId];

        if (!admin && editor.checked) {
          viewer.checked = true;
          viewer.disabled = true;
        } else if (!admin) {
          viewer.disabled = false;
        }
      }

      if (admin) {
        sendCheckbox.checked = true;
        sendCheckbox.disabled = true;
      } else {
        const newsletterEditor =
          groupCheckboxes.NEWSLETTER_EDITORS.checked;

        if (!newsletterEditor) {
          sendCheckbox.checked = false;
        }

        sendCheckbox.disabled =
          !newsletterEditor;
      }

      q('#usersAdminNote').hidden = !admin;
    }

    for (const checkbox of Object.values(groupCheckboxes)) {
      checkbox.addEventListener('change', syncGroupState);
    }

    function clearGroups() {
      for (const checkbox of Object.values(groupCheckboxes)) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      sendCheckbox.checked = false;
      sendCheckbox.disabled = true;
    }

    function selectedGroups() {
      if (groupCheckboxes.ADMINISTRATORS.checked) {
        return ['ADMINISTRATORS'];
      }

      const groups = [];

      for (const group of ACCESS_GROUPS) {
        if (
          group.id === 'ADMINISTRATORS' ||
          !groupCheckboxes[group.id].checked
        ) {
          continue;
        }

        if (
          group.includes &&
          groupCheckboxes[group.id].checked
        ) {
          // Editor groups are stored without a redundant Viewer group.
          groups.push(group.id);
          continue;
        }

        const editorForViewer =
          ACCESS_GROUPS.find(
            candidate =>
              candidate.includes === group.id
          );

        if (
          editorForViewer &&
          groupCheckboxes[editorForViewer.id].checked
        ) {
          continue;
        }

        groups.push(group.id);
      }

      return groups;
    }

    function resetForm() {
      form.reset();
      clearGroups();
      editingUser = null;
      dialogMode = 'create';
      q('#usersDisplayName').disabled = false;
      q('#usersEmail').disabled = false;
      q('#usersDisplayName').required = true;
      q('#usersEmail').required = true;
      q('#usersDialogEyebrow').textContent = 'NEW ACCOUNT';
      q('#usersDialogTitle').textContent = 'Add user';
      q('#usersSubmitButton').textContent = 'Add user & send invitation';
      q('#usersLegacyNote').hidden = true;
      q('#usersAdminNote').hidden = true;
      formError.hidden = true;
      formError.textContent = '';
      syncGroupState();
    }

    function openCreateDialog() {
      resetForm();
      dialog.showModal();
      q('#usersDisplayName').focus();
    }

    function openEditDialog(user) {
      resetForm();
      dialogMode = 'edit';
      editingUser = user;

      q('#usersDialogEyebrow').textContent = 'ACCESS';
      q('#usersDialogTitle').textContent = 'Edit access';
      q('#usersSubmitButton').textContent = 'Save access';

      q('#usersDisplayName').value =
        user.displayName || '';
      q('#usersEmail').value =
        user.email || '';
      q('#usersDisplayName').disabled = true;
      q('#usersEmail').disabled = true;
      q('#usersDisplayName').required = false;
      q('#usersEmail').required = false;

      const groups =
        Array.isArray(user.groups)
          ? user.groups
          : [];

      for (const id of groups) {
        setGroupChecked(id, true);
      }

      sendCheckbox.checked =
        user.newsletterSend === true;

      q('#usersLegacyNote').hidden =
        user.legacyCustomAccess !== true;

      syncGroupState();
      dialog.showModal();
      groupGrid.querySelector('input:not(:disabled)')?.focus();
    }

    function summaryAccess(user) {
      const groups =
        Array.isArray(user.groups)
          ? user.groups
          : [];

      const labels =
        groups
          .map(id => GROUP_LABELS[id])
          .filter(Boolean);

      if (
        user.newsletterSend === true &&
        !groups.includes('ADMINISTRATORS')
      ) {
        labels.push('Newsletter Send');
      }

      if (user.legacyCustomAccess === true) {
        labels.push('Legacy custom Content access');
      }

      return labels.join(' · ') || 'No access groups';
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
          user.role === 'ADMINISTRATOR' ? 'Administrators' : 'User',
          `users-role users-role-${String(user.role || '').toLowerCase()}`
        );

        const access = el(
          'div',
          summaryAccess(user),
          'users-access-summary'
        );

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

        const editAccess = makeButton(
          'Edit access',
          'secondary',
          () => openEditDialog(user)
        );

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
                  : `The invitation to ${user.email} could not be sent${result.invitationCode ? ` (${result.invitationCode})` : ''}.`,
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

        actions.append(editAccess);

        if (
          user.accountStatus ===
            'FIREBASE_ACCOUNT_MISSING' &&
          user.email
        ) {
          const recreate = makeButton(
            'Recreate account',
            'secondary',
            safeAction(async () => {
              recreate.disabled = true;
              try {
                const result = await call(
                  'recreateAccount',
                  { uid: user.uid }
                );

                const invitationFailed =
                  result.status ===
                  'ACCOUNT_RECREATED_INVITATION_FAILED';

                showNotice(
                  invitationFailed
                    ? `Firebase account recreated for ${user.email}, but the invitation could not be sent${result.invitationCode ? ` (${result.invitationCode})` : ''}.`
                    : `Firebase account recreated for ${user.email} using the existing UID, and an invitation was sent.`,
                  invitationFailed
                    ? 'users-warning'
                    : 'users-success'
                );

                await loadUsers();
              } finally {
                recreate.disabled = false;
              }
            })
          );

          actions.append(recreate);
        } else {
          actions.append(resend);
        }

        const canRemove =
          user.bootstrapAdministrator !== true &&
          user.uid !== currentIdentity?.uid;

        if (canRemove) {
          const remove = makeButton(
            'Remove user',
            'secondary users-danger-button',
            safeAction(async () => {
              const label =
                user.displayName ||
                user.email ||
                user.uid;

              const confirmed =
                window.confirm(
                  `Remove ${label} from Content Handler? Their Firebase account, profile and authored content will be retained.`
                );

              if (!confirmed) return;

              remove.disabled = true;
              try {
                const result = await call(
                  'remove',
                  { uid: user.uid }
                );

                if (
                  result.status ===
                  'USER_REMOVED'
                ) {
                  showNotice(
                    `${label} was removed from Content Handler. Their Firebase account, profile and authored content were retained.`,
                    'users-success'
                  );
                }

                await loadUsers();
              } finally {
                remove.disabled = false;
              }
            })
          );

          actions.append(remove);
        }

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
          const providerMessage =
            result?.firebaseAdminError?.providerMessage || '';

          showNotice(
            `Users loaded from Content Handler authorization, but Firebase administration is unavailable: ${message} (${code})` +
              (providerMessage
                ? ` Firebase says: ${providerMessage}`
                : ''),
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

    q('#usersAddButton').addEventListener('click', openCreateDialog);
    q('#usersCloseDialog').addEventListener('click', () => dialog.close());
    q('#usersCancelButton').addEventListener('click', () => dialog.close());

    form.addEventListener('submit', safeAction(async () => {
      formError.hidden = true;
      formError.textContent = '';

      const groups = selectedGroups();
      const newsletterSend =
        groups.includes('ADMINISTRATORS') ||
        sendCheckbox.checked;

      try {
        if (dialogMode === 'edit') {
          const result = await call('updateAccess', {
            uid: editingUser.uid,
            groups,
            newsletterSend
          });

          dialog.close();
          showNotice(
            result.status === 'ACCESS_UPDATED'
              ? `Access updated for ${editingUser.displayName || editingUser.email || editingUser.uid}.`
              : 'Access was updated.',
            'users-success'
          );
        } else {
          const result = await call('create', {
            displayName: q('#usersDisplayName').value,
            email: q('#usersEmail').value,
            groups,
            newsletterSend
          });

          dialog.close();

          const messages = {
            INVITATION_SENT:
              `${result.user.displayName} was added and an invitation was sent to ${result.user.email}.`,
            INVITATION_FAILED:
              `${result.user.displayName} was added, but the invitation could not be sent${result.invitationCode ? ` (${result.invitationCode})` : ''}. Use Resend invitation to try again.`,
            PROFILE_FAILED:
              `${result.user.displayName} was added and invited, but profile initialization needs attention.`,
            PROFILE_AND_INVITATION_FAILED:
              `${result.user.displayName} was added, but profile initialization and invitation delivery need attention.`
          };

          const ok =
            result.status === 'INVITATION_SENT';

          showNotice(
            messages[result.status] || 'The user was added.',
            ok ? 'users-success' : 'users-warning'
          );
        }

        await loadUsers();
      } catch (error) {
        formError.textContent =
          error?.message ||
          (
            dialogMode === 'edit'
              ? 'Access could not be updated.'
              : 'The user could not be added.'
          );
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
