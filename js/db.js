// Tiny IndexedDB wrapper — all user data stays in this browser.
const DB_NAME = 'trail-companion';
const STORES = ['finds', 'walks', 'kv'];
let dbp;

function open() {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'kv' ? undefined : { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const db = {
  all: (store) => tx(store, 'readonly', s => s.getAll()),
  put: (store, value) => tx(store, 'readwrite', s => s.put(value)),
  del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
  get: (key) => tx('kv', 'readonly', s => s.get(key)),
  set: (key, value) => tx('kv', 'readwrite', s => s.put(value, key)),
  async clear() { for (const s of STORES) await tx(s, 'readwrite', st => st.clear()); },
};
