function unwrap(result) {
  return result?.data ?? result;
}

function field(labelText, control) {
  const label = document.createElement('label');
  label.className = 'profile-field';

  const title = document.createElement('span');
  title.className = 'profile-label';
  title.textContent = labelText;

  label.append(title, control);
  return label;
}

export async function mountProfile({
  container,
  session,
  ui,
  signal
}) {
  container.classList.add('profile-page');

  const response = await session.api(
    'profile.get',
    {},
    signal
  );

  if (signal.aborted) return;

  const profile = unwrap(response) || {};

  const heading = ui.element(
    'div',
    undefined,
    'profile-heading'
  );

  heading.append(
    ui.element(
      'p',
      'ACCOUNT',
      'eyebrow'
    ),
    ui.element(
      'h1',
      'My Profile'
    ),
    ui.element(
      'p',
      'Choose how your name appears in the workspace and on content you own.',
      'help'
    )
  );

  const card = ui.element(
    'section',
    undefined,
    'profile-card'
  );

  const form = document.createElement('form');
  form.className = 'profile-form';

  const displayName =
    document.createElement('input');

  displayName.type = 'text';
  displayName.maxLength = 80;
  displayName.autocomplete = 'name';
  displayName.required = true;
  displayName.value =
    profile.displayName ||
    session.identity?.displayName ||
    '';

  const email = ui.element(
    'div',
    session.identity?.email ||
      'No email available',
    'profile-readonly'
  );

  const note = ui.element(
    'p',
    'Your email remains your sign-in account. A saved name can be renamed, but cannot currently be removed: profiles require a non-empty name once saved. After saving your first name, returning to email-only display is not supported.',
    'profile-note'
  );

  const actions = ui.element(
    'div',
    undefined,
    'profile-actions'
  );

  const save = ui.element(
    'button',
    'Save Changes',
    'primary'
  );

  save.type = 'submit';
  actions.append(save);

  form.append(
    field(
      'Display name',
      displayName
    ),
    field(
      'Sign-in email',
      email
    ),
    note,
    actions
  );

  card.append(form);

  container.append(
    heading,
    card
  );

  form.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (
        save.disabled ||
        signal.aborted
      ) {
        return;
      }

      save.disabled = true;
      ui.status('');

      try {
        const updated = unwrap(
          await session.api(
            'profile.update',
            {
              displayName:
                displayName.value
            },
            signal
          )
        );

        if (signal.aborted) return;

        displayName.value =
          updated?.displayName ||
          '';

        ui.status(
          'Profile saved.'
        );
      } catch (error) {
        if (!signal.aborted) {
          ui.status(
            error?.message ||
              'The profile could not be saved.',
            'error'
          );
        }
      } finally {
        save.disabled = false;
      }
    }
  );

  displayName.focus();

  return () => {
    container.classList.remove(
      'profile-page'
    );
  };
}
