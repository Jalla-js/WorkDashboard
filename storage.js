/* ============================================================
   Storage — IndexedDB wrapper for all app data
   ============================================================ */

const DB_NAME = 'WorkCompanion';
const DB_VERSION = 1;

const STORES = {
  metrics:   { keyPath: 'id', autoIncrement: true },
  waveplans: { keyPath: 'id', autoIncrement: true },
  invoices:  { keyPath: 'id', autoIncrement: true },
  documents: { keyPath: 'id', autoIncrement: true },
  settings:  { keyPath: 'key' }
};

class AppStorage {
  constructor() {
    this.db = null;
    this._ready = this._init();
  }

  _init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const [name, opts] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, opts);
            // Add indexes where useful
            if (name === 'metrics')   store.createIndex('week',   'week',   { unique: false });
            if (name === 'waveplans') store.createIndex('date',   'date',   { unique: false });
            if (name === 'invoices')  store.createIndex('payDate','payDate',{ unique: false });
            if (name === 'documents') store.createIndex('type',   'type',   { unique: false });
          }
        }
      };

      req.onsuccess  = (e) => { this.db = e.target.result; resolve(this.db); };
      req.onerror    = (e) => reject(e.target.error);
    });
  }

  async ready() { return this._ready; }

  async add(store, data) {
    await this.ready();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).add({ ...data, createdAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async put(store, data) {
    await this.ready();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put({ ...data, updatedAt: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async getAll(store, indexName, query) {
    await this.ready();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(store, 'readonly');
      const os  = tx.objectStore(store);
      const req = indexName ? os.index(indexName).getAll(query) : os.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async get(store, key) {
    await this.ready();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async delete(store, key) {
    await this.ready();
    return new Promise((resolve, reject) => {
      const tx  = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getSetting(key, defaultVal = null) {
    const rec = await this.get('settings', key);
    return rec ? rec.value : defaultVal;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }

  // Helper: get sorted + filtered metrics
  async getMetrics({ limit = 50 } = {}) {
    const all = await this.getAll('metrics');
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  async getWaveplans({ limit = 20 } = {}) {
    const all = await this.getAll('waveplans');
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  async getInvoices({ limit = 50 } = {}) {
    const all = await this.getAll('invoices');
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
}

// Singleton
const storage = new AppStorage();
window.storage = storage;

// Settings with defaults
const DEFAULT_SETTINGS = {
  taxRate:    0.20,
  userName:   'Me',
  driverName: '',
  driverId:   ''
};

async function getSettings() {
  const s = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    s[k] = await storage.getSetting(k, v);
  }
  return s;
}
window.getSettings = getSettings;