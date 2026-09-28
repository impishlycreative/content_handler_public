export default {
  id: 'example', title: 'Example', permissions: [],
  mount({ container, ui, identity, signal }) {
    container.append(ui.element('h1', 'Your first module'));
    container.append(ui.element('p', `Welcome, ${identity.email || identity.uid}. This module has no backend dependencies.`));
    const button = ui.element('button', 'Try a status message', 'primary');
    button.addEventListener('click', () => ui.status('Your module is ready.'), { signal });
    container.append(button);
    return () => { container.replaceChildren(); };
  }
};
