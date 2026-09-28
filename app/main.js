import config from '../config.js';
import modules from './modules.js';
import { validateConfig } from '../core/config.js';
import { createFirebaseAdapter } from '../core/firebase.js';
import { createTransport } from '../core/api.js';
import { createSession } from '../core/session.js';
import { createRegistry } from '../core/modules.js';
import { startShell } from '../core/shell.js';
import { notice } from '../core/ui.js';
try {
  validateConfig(config);
  const registry = createRegistry(modules);
  const auth = await createFirebaseAdapter(config);
  const session = createSession({ auth, transport: createTransport(config), config });
  await startShell({ config, registry, session });
} catch {
  document.querySelector('#boot').hidden = true;
  notice(document.querySelector('#startupError'), 'Setup is required, or the sign-in service could not load. Check site/config.js and your connection, then reload.', 'error');
}
