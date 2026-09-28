/** @typedef {{id:string,title:string,permissions:string[],mount:(context:object)=>Function|Promise<Function>}} AppModule */
export function createRegistry(modules) {
  const seen = new Set();
  const registered = modules.map(module => {
    if (!module || !/^[a-z][a-z0-9-]*$/.test(module.id) || seen.has(module.id) || module.id === 'home') throw new Error('Module IDs must be unique, lowercase names; home is reserved.');
    if (typeof module.title !== 'string' || !module.title.trim() || typeof module.mount !== 'function' || !Array.isArray(module.permissions) || module.permissions.some(p => typeof p !== 'string' || !p)) throw new Error(`Invalid module contract: ${module.id}`);
    seen.add(module.id);
    return Object.freeze({ ...module, permissions: Object.freeze([...module.permissions]) });
  });
  return Object.freeze({
    all: Object.freeze(registered),
    allowed(identity) { return registered.filter(m => identity && m.permissions.every(p => identity.permissions.includes(p))); }
  });
}
