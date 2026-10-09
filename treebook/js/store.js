/* Local storage for the prototype.
   - App data (trees, posts, follows) is JSON in localStorage.
   - Photos taken with the camera are Blobs in IndexedDB (much more room).
   To move to a real server later, replace the functions in this file. */
(function () {
  const KEY = 'treebook.v1';
  const DAY = 86400000;

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function metersToLatLng(center, east, north) {
    const lat = center.lat + north / 111320;
    const lng = center.lng + east / (111320 * Math.cos(center.lat * Math.PI / 180));
    return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  }

  function seed() {
    const now = Date.now();
    const trees = [], posts = [];
    SAMPLE_TREES.forEach((t, i) => {
      const pos = metersToLatLng(SAMPLE_CENTER, t.at[0], t.at[1]);
      const tree = {
        id: t.id, name: t.name, species: t.species, scientific: t.scientific, kind: t.kind,
        lat: pos.lat, lng: pos.lng, planted: t.planted, heightFt: t.heightFt, girthIn: t.girthIn,
        place: t.place, about: t.about, sample: true, baseFollowers: 12 + ((i * 37) % 180),
        created: now - 400 * DAY, photos: [
          { ref: `art:${t.kind}:0:${t.id}`, alt: `Illustration of ${t.name} the ${t.species} on a sunny day.`, by: 'Treebook', t: now - 400 * DAY },
          { ref: `art:${t.kind}:2:${t.id}`, alt: `Illustration of ${t.name} the ${t.species} at dusk.`, by: 'Treebook', t: now - 200 * DAY }
        ]
      };
      trees.push(tree);
      t.posts.forEach((p, j) => {
        const post = {
          id: `${t.id}-p${j}`, treeId: t.id, type: p.type, text: p.text,
          by: p.by === 'tree' ? null : p.by, t: now - p.d * DAY - j * 3600000, likes: (i * 7 + j * 5) % 23
        };
        if (p.photo) {
          const alt = `Illustration of ${t.name} the ${t.species}${p.type === 'bloom' ? ' in bloom' : p.type === 'fall' ? ' in autumn color' : ' at golden hour'}.`;
          post.photo = { ref: `art:${t.kind}:1:${t.id}`, alt };
          tree.photos.push({ ref: post.photo.ref, alt, by: p.by, t: post.t });
        }
        posts.push(post);
      });
    });
    return {
      version: 1, trees, posts, follows: ['oakley', 'bettie', 'elmer'], liked: [],
      profile: { name: '' }, here: null, created: now
    };
  }

  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); if (state && state.version === 1) return state; }
    } catch (e) { /* private mode or corrupt data: fall through to fresh data */ }
    state = seed();
    save();
    return state;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { console.warn('Could not save', e); return false; }
  }
  function reset() { state = seed(); save(); return state; }

  /* ---------- IndexedDB photo store ---------- */
  let dbp = null;
  const memPhotos = new Map(); // fallback when IndexedDB is unavailable
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open('treebook', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('photos');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  async function putPhoto(blob, id) {
    id = id || uid('ph');
    const d = await db();
    if (!d) { memPhotos.set(id, blob); return 'idb:' + id; }
    await new Promise((res, rej) => {
      const tx = d.transaction('photos', 'readwrite');
      tx.objectStore('photos').put(blob, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return 'idb:' + id;
  }
  async function getPhoto(id) {
    if (memPhotos.has(id)) return memPhotos.get(id);
    const d = await db();
    if (!d) return null;
    return new Promise((res) => {
      const req = d.transaction('photos').objectStore('photos').get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  }
  async function deletePhoto(id) {
    memPhotos.delete(id);
    const d = await db();
    if (!d) return;
    d.transaction('photos', 'readwrite').objectStore('photos').delete(id);
  }
  async function clearPhotos() {
    memPhotos.clear();
    const d = await db();
    if (d) d.transaction('photos', 'readwrite').objectStore('photos').clear();
  }

  const urlCache = new Map();
  async function photoURL(ref) {
    if (!ref) return '';
    if (ref.startsWith('art:')) { const [, kind, v, s] = ref.split(':'); return treeArt(kind, +v, s); }
    if (ref.startsWith('idb:')) {
      const id = ref.slice(4);
      if (urlCache.has(id)) return urlCache.get(id);
      const blob = await getPhoto(id);
      if (!blob) return '';
      const url = URL.createObjectURL(blob);
      urlCache.set(id, url);
      return url;
    }
    return ref;
  }
  function photoURLSync(ref) {
    if (ref && ref.startsWith('art:')) { const [, kind, v, s] = ref.split(':'); return treeArt(kind, +v, s); }
    if (ref && ref.startsWith('idb:') && urlCache.has(ref.slice(4))) return urlCache.get(ref.slice(4));
    return '';
  }

  /* ---------- Backup ---------- */
  function blobToDataURL(blob) {
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  }
  async function exportAll() {
    const photos = {};
    const refs = new Set();
    state.trees.forEach(t => t.photos.forEach(p => refs.add(p.ref)));
    state.posts.forEach(p => p.photo && refs.add(p.photo.ref));
    for (const ref of refs) {
      if (!ref.startsWith('idb:')) continue;
      const blob = await getPhoto(ref.slice(4));
      if (blob) photos[ref.slice(4)] = await blobToDataURL(blob);
    }
    return JSON.stringify({ app: 'treebook', exported: new Date().toISOString(), state, photos });
  }
  async function importAll(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'treebook' || !data.state || data.state.version !== 1) throw new Error('This is not a Treebook backup file.');
    await clearPhotos();
    urlCache.clear();
    for (const [id, dataUrl] of Object.entries(data.photos || {})) {
      const blob = await (await fetch(dataUrl)).blob();
      await putPhoto(blob, id);
    }
    state = data.state;
    save();
  }

  window.Store = {
    load, save, reset, uid, metersToLatLng, get state() { return state; },
    putPhoto, deletePhoto, clearPhotos, photoURL, photoURLSync, exportAll, importAll, DAY
  };
})();
