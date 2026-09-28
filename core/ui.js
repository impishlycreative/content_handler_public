export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function notice(host, message, kind = 'status') {
  host.textContent = message;
  host.className = kind === 'error' ? 'notice error-box' : 'notice';
  host.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  host.hidden = !message;
}
export async function confirmAction(message) {
  const dialog = element('dialog');
  const body = element('div', undefined, 'confirm');
  body.append(element('p', message));
  const cancel = element('button', 'Cancel', 'secondary');
  const confirm = element('button', 'Continue', 'primary');
  body.append(cancel, confirm); dialog.append(body); document.body.append(dialog);
  return new Promise(resolve => {
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.onclick = () => finish(false); confirm.onclick = () => finish(true);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    dialog.showModal(); cancel.focus();
  });
}
