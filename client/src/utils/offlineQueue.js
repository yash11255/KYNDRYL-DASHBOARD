/* ─── IndexedDB-backed offline queue ─────────────────────────────────
   Stores photo blobs + session drafts when the device is offline.
   Auto-syncs when connectivity returns.
──────────────────────────────────────────────────────────────────── */
const DB_NAME = 'ai-pathshala-v1';
const STORE_PHOTOS   = 'queued-photos';
const STORE_DRAFTS   = 'session-drafts';

let _db = null;
const getDB = () => new Promise((resolve, reject) => {
  if (_db) return resolve(_db);
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_PHOTOS))
      db.createObjectStore(STORE_PHOTOS, { keyPath: 'queueId', autoIncrement: true });
    if (!db.objectStoreNames.contains(STORE_DRAFTS))
      db.createObjectStore(STORE_DRAFTS, { keyPath: 'sessionId' });
  };
  req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
  req.onerror    = ()  => reject(req.error);
});

/* Queue a photo blob for deferred upload */
export const queuePhoto = async ({ blob, sessionId, tag, latitude, longitude, locationName }) => {
  const db = await getDB();
  const localPreview = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_PHOTOS, 'readwrite');
    const req = tx.objectStore(STORE_PHOTOS).add({
      blob, sessionId, tag, latitude, longitude, locationName,
      localPreview, queuedAt: new Date().toISOString(), status: 'pending',
    });
    req.onsuccess = () => resolve({ queueId: req.result, localPreview });
    req.onerror   = () => reject(req.error);
  });
};

/* Get all queued photos (optionally for a specific session) */
export const getQueuedPhotos = async (sessionId) => {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx  = db.transaction(STORE_PHOTOS, 'readonly');
    const req = tx.objectStore(STORE_PHOTOS).getAll();
    req.onsuccess = () => resolve(
      sessionId ? req.result.filter(p => p.sessionId === sessionId) : req.result
    );
  });
};

export const countPending = async () => {
  const all = await getQueuedPhotos();
  return all.filter(p => p.status === 'pending').length;
};

export const removeQueuedPhoto = async (queueId) => {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    tx.objectStore(STORE_PHOTOS).delete(queueId);
    tx.oncomplete = resolve;
  });
};

/* Try to upload all queued photos; call uploadFn(blob, tag, lat, lon) → { url, filename } */
export const syncQueue = async (uploadFn) => {
  const db   = await getDB();
  const all  = await getQueuedPhotos();
  const pending = all.filter(p => p.status === 'pending');
  const results = [];

  for (const item of pending) {
    try {
      const result = await uploadFn(item);
      await removeQueuedPhoto(item.queueId);
      results.push({ ...result, sessionId: item.sessionId, tag: item.tag, queueId: item.queueId });
    } catch {
      // leave it in the queue
    }
  }
  return results;
};

/* ─── Session draft (offline form state) ──────────────────────────── */
export const saveDraft = async (sessionId, data) => {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).put({ sessionId, data, savedAt: new Date().toISOString() });
    tx.oncomplete = resolve;
  });
};

export const loadDraft = async (sessionId) => {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx  = db.transaction(STORE_DRAFTS, 'readonly');
    const req = tx.objectStore(STORE_DRAFTS).get(sessionId);
    req.onsuccess = () => resolve(req.result?.data || null);
  });
};

export const clearDraft = async (sessionId) => {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    tx.objectStore(STORE_DRAFTS).delete(sessionId);
    tx.oncomplete = resolve;
  });
};
