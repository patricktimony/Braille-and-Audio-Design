/* Treebook app: hash-based routes, rendered into <main>. */
(function () {
  'use strict';

  const S = Store.load();
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const main = $('#main');
  const US_UNITS = /^en-(US|LR|MM)$/i.test(navigator.language || 'en-US') || !navigator.language;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function tree(id) { return S.trees.find(t => t.id === id); }
  function isFollowing(id) { return S.follows.includes(id); }
  function followerCount(t) { return (t.baseFollowers || 0) + (isFollowing(t.id) ? 1 : 0); }
  function myName() { return (S.profile.name || '').trim() || 'You'; }
  function authorName(p) {
    if (!p.by) return null;
    return p.mine ? myName() : p.by;
  }

  function announce(msg) {
    const a = $('#announcer');
    a.textContent = '';
    setTimeout(() => { a.textContent = msg; }, 60);
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(announce._t);
    announce._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60); if (m < 60) return m === 1 ? '1 minute ago' : m + ' minutes ago';
    const h = Math.round(m / 60); if (h < 24) return h === 1 ? '1 hour ago' : h + ' hours ago';
    const d = Math.round(h / 24); if (d < 7) return d === 1 ? 'yesterday' : d + ' days ago';
    const w = Math.round(d / 7); if (d < 30) return w === 1 ? '1 week ago' : w + ' weeks ago';
    const mo = Math.round(d / 30); if (d < 365) return mo <= 1 ? '1 month ago' : mo + ' months ago';
    const y = Math.round(d / 365); return y === 1 ? '1 year ago' : y + ' years ago';
  }
  function timeTag(ts) {
    const d = new Date(ts);
    return `<time datetime="${d.toISOString()}" title="${esc(d.toLocaleString())}">${timeAgo(ts)}</time>`;
  }

  function distanceM(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function bearingWord(a, b) {
    const toR = Math.PI / 180;
    const y = Math.sin((b.lng - a.lng) * toR) * Math.cos(b.lat * toR);
    const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lng - a.lng) * toR);
    const deg = (Math.atan2(y, x) / toR + 360) % 360;
    return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(deg / 45) % 8];
  }
  function fmtDistance(m) {
    if (US_UNITS) {
      const ft = m * 3.28084;
      if (ft < 800) return Math.max(10, Math.round(ft / 10) * 10) + ' feet';
      const mi = m / 1609.34;
      return (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + (mi.toFixed(1) === '1.0' ? ' mile' : ' miles');
    }
    if (m < 1000) return Math.max(5, Math.round(m / 5) * 5) + ' metres';
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
  }
  function origin() { return S.here || SAMPLE_CENTER; }
  function whereFrom(t) {
    const o = origin();
    const m = distanceM(o, t);
    return m < 8 ? 'right here' : `${fmtDistance(m)} ${bearingWord(o, t)}`;
  }
  function originNote() {
    if (S.here) return `Distances are from your location, found ${timeAgo(S.here.t)}.`;
    return `Distances are from the center of the sample neighborhood in ${esc(SAMPLE_CENTER.label)}. Use your location for real distances.`;
  }

  function avatar(t, size) {
    const ref = t.photos[0] ? t.photos[0].ref : `art:${t.kind}:0:${t.id}`;
    return imgTag(ref, '', 'avatar' + (size ? ' avatar-' + size : ''));
  }
  function imgTag(ref, alt, cls) {
    const src = Store.photoURLSync(ref);
    return `<img class="${cls || ''}" ${src ? `src="${esc(src)}"` : `data-ref="${esc(ref)}"`} alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }
  async function hydrate(root) {
    for (const img of $$('img[data-ref]', root)) {
      const url = await Store.photoURL(img.dataset.ref);
      if (url) img.src = url; else img.alt = img.alt ? img.alt + ' (photo missing)' : '';
      img.removeAttribute('data-ref');
    }
  }

  function geolocate() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('This browser cannot share location.'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), t: Date.now() }),
        err => reject(new Error(err.code === 1
          ? 'Location permission is off. In Settings, go to Privacy and Security, Location Services, Safari Websites, and choose While Using the App.'
          : err.code === 3 ? 'Finding your location took too long. Try again outside or near a window.' : 'Your location could not be found. Try again.')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }

  /* ---------- photo picking (camera) ---------- */
  function resizeImage(file, maxSide) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read that photo.')), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
      img.src = url;
    });
  }

  let pickerCount = 0;
  function photoPicker(defaultAlt) {
    const n = ++pickerCount;
    return `<div class="picker" data-picker data-default-alt="${esc(defaultAlt || '')}">
      <div class="btn-row">
        <button type="button" class="btn" data-action="pick" data-which="camera"><span aria-hidden="true">📷</span> Take photo</button>
        <button type="button" class="btn" data-action="pick" data-which="library"><span aria-hidden="true">🖼️</span> Choose photo</button>
      </div>
      <input type="file" accept="image/*" capture="environment" class="file-input" data-which="camera" tabindex="-1" aria-hidden="true">
      <input type="file" accept="image/*" class="file-input" data-which="library" tabindex="-1" aria-hidden="true">
      <div class="preview" hidden>
        <img alt="" class="preview-img">
        <label for="alt-${n}">Describe the photo for people using VoiceOver</label>
        <input id="alt-${n}" name="alt" type="text" autocomplete="off">
        <button type="button" class="btn btn-quiet" data-action="remove-photo">Remove photo</button>
      </div>
    </div>`;
  }
  async function onPhotoChosen(input) {
    const picker = input.closest('[data-picker]');
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      announce('Preparing photo…');
      const blob = await resizeImage(file, 1600);
      picker._blob = blob;
      const prev = $('.preview', picker);
      const img = $('.preview-img', picker);
      if (img._url) URL.revokeObjectURL(img._url);
      img._url = URL.createObjectURL(blob);
      img.src = img._url;
      const alt = $('input[name=alt]', picker);
      if (!alt.value) alt.value = picker.dataset.defaultAlt || '';
      prev.hidden = false;
      announce('Photo added. You can describe it in the field below the photo.');
    } catch (e) { announce(e.message); }
  }
  function clearPicker(picker) {
    picker._blob = null;
    const prev = $('.preview', picker);
    prev.hidden = true;
    $('input[name=alt]', picker).value = '';
  }
  async function savePickerPhoto(picker, fallbackAlt) {
    if (!picker || !picker._blob) return null;
    const ref = await Store.putPhoto(picker._blob);
    const alt = ($('input[name=alt]', picker).value || '').trim() || fallbackAlt;
    return { ref, alt };
  }

  /* ---------- components ---------- */
  function followButton(t, extraCls) {
    const on = isFollowing(t.id);
    return `<button type="button" class="btn follow ${on ? 'on' : 'btn-primary'} ${extraCls || ''}" data-action="follow" data-id="${esc(t.id)}"
      aria-pressed="${on}" aria-label="Follow ${esc(t.name)}">${on ? '<span aria-hidden="true">✓</span> Following' : 'Follow'}</button>`;
  }

  function typeBadge(type) {
    const ty = OBSERVATION_TYPES[type] || OBSERVATION_TYPES.note;
    return `<span class="badge"><span aria-hidden="true">${ty.icon}</span> ${esc(ty.label)}</span>`;
  }

  function postCard(p) {
    const t = tree(p.treeId);
    if (!t) return '';
    const by = authorName(p);
    const liked = S.liked.includes(p.id);
    const likes = (p.likes || 0) + (liked ? 1 : 0);
    const hid = 'h-' + p.id;
    const heading = by ? `${esc(by)} on <a href="#/tree/${esc(t.id)}">${esc(t.name)}</a>` : `<a href="#/tree/${esc(t.id)}">${esc(t.name)}</a>`;
    return `<article class="card post" aria-labelledby="${hid}">
      <header class="post-head">
        <a href="#/tree/${esc(t.id)}" tabindex="-1" aria-hidden="true">${avatar(t)}</a>
        <div>
          <h3 id="${hid}" class="post-title">${heading}</h3>
          <p class="meta">${by ? 'Observation' : 'Status from the tree'} · ${timeTag(p.t)} · ${typeBadge(p.type)}</p>
        </div>
      </header>
      <p class="post-text">${esc(p.text)}</p>
      ${p.photo ? `<button type="button" class="photo-btn" data-action="view-photo" data-ref="${esc(p.photo.ref)}" data-alt="${esc(p.photo.alt)}" aria-label="Open photo: ${esc(p.photo.alt)}">${imgTag(p.photo.ref, p.photo.alt, 'post-photo')}</button>` : ''}
      <footer class="post-foot">
        <button type="button" class="btn btn-quiet like ${liked ? 'on' : ''}" data-action="like" data-id="${esc(p.id)}" aria-pressed="${liked}" aria-label="Like. ${likes} ${likes === 1 ? 'like' : 'likes'}">
          <span aria-hidden="true">${liked ? '💚' : '🤍'} Like${likes ? ' · ' + likes : ''}</span></button>
        ${p.mine ? `<button type="button" class="btn btn-quiet" data-action="delete-post" data-id="${esc(p.id)}">Delete</button>` : ''}
      </footer>
    </article>`;
  }

  function treeRow(t) {
    return `<li class="tree-row">
      <a href="#/tree/${esc(t.id)}" class="tree-link">
        ${avatar(t)}
        <span class="tree-row-text">
          <span class="tree-row-name">${esc(t.name)}</span>
          <span class="tree-row-sub">${esc(t.species)}, ${esc(whereFrom(t))}</span>
        </span>
      </a>
      ${followButton(t, 'btn-small')}
    </li>`;
  }

  function sortedByDistance(list) {
    const o = origin();
    return list.slice().sort((a, b) => distanceM(o, a) - distanceM(o, b));
  }

  /* ---------- pages ---------- */
  function pageFeed() {
    const following = S.follows.filter(id => tree(id));
    let posts = S.posts.slice().sort((a, b) => b.t - a.t);
    let heading, intro = '';
    if (following.length) {
      posts = posts.filter(p => following.includes(p.treeId));
      heading = 'From trees you follow';
    } else {
      heading = 'Recent from all trees';
      intro = `<div class="card welcome"><p>You are not following any trees yet. Visit <a href="#/nearby">Nearby</a> to find trees and follow them.</p></div>`;
    }
    const suggestions = sortedByDistance(S.trees.filter(t => !isFollowing(t.id))).slice(0, 3);
    return {
      title: 'Feed',
      html: `<h1 tabindex="-1">News feed</h1>
        <p class="lede">What the trees${following.length ? ' you follow' : ''} have been up to. You follow ${following.length} ${following.length === 1 ? 'tree' : 'trees'}.</p>
        ${intro}
        ${suggestions.length ? `<section class="card" aria-labelledby="sugg-h">
          <h2 id="sugg-h">Trees near you</h2>
          <ul class="tree-list">${suggestions.map(treeRow).join('')}</ul>
          <p><a href="#/nearby">See all nearby trees</a></p>
        </section>` : ''}
        <section aria-labelledby="feed-h">
          <h2 id="feed-h">${heading}</h2>
          ${posts.slice(0, 60).map(p => postCard(p)).join('') || '<p class="card">No posts yet. Visit a tree and post what you notice.</p>'}
        </section>`
    };
  }

  function pageNearby(params) {
    const q = (params.get('q') || '').trim().toLowerCase();
    const filter = params.get('show') || 'all';
    let list = sortedByDistance(S.trees);
    if (filter === 'following') list = list.filter(t => isFollowing(t.id));
    if (q) list = list.filter(t => (t.name + ' ' + t.species + ' ' + (t.scientific || '') + ' ' + (t.place || '')).toLowerCase().includes(q));
    return {
      title: 'Nearby trees',
      html: `<h1 tabindex="-1">Nearby trees</h1>
        <p class="lede" id="origin-note">${originNote()}</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-action="locate"><span aria-hidden="true">📍</span> Use my location</button>
          <a class="btn" href="#/map">Show on map</a>
        </div>
        <form class="card search" data-form="search" role="search">
          <label for="q">Search trees by name or species</label>
          <input id="q" name="q" type="search" value="${esc(params.get('q') || '')}" autocomplete="off" enterkeyhint="search">
          <fieldset class="segmented">
            <legend>Show</legend>
            <label><input type="radio" name="show" value="all" ${filter === 'all' ? 'checked' : ''}> All trees</label>
            <label><input type="radio" name="show" value="following" ${filter === 'following' ? 'checked' : ''}> Trees I follow</label>
          </fieldset>
        </form>
        <section aria-labelledby="list-h">
          <h2 id="list-h">${list.length} ${list.length === 1 ? 'tree' : 'trees'}, closest first</h2>
          ${list.length ? `<ul class="tree-list card">${list.map(treeRow).join('')}</ul>` : '<p class="card">No trees match.</p>'}
        </section>`
    };
  }

  let map = null;
  function pageMap(params) {
    const focus = params.get('tree');
    const list = sortedByDistance(S.trees);
    return {
      title: 'Map',
      html: `<h1 tabindex="-1">Tree map</h1>
        <p class="lede">Tap a tree pin to see its name. Every tree on the map is also in the list below the map.</p>
        <div class="btn-row">
          <button type="button" class="btn" data-action="focus" data-target="map-list-h">Skip map, go to list</button>
          <button type="button" class="btn btn-primary" data-action="locate"><span aria-hidden="true">📍</span> Center on me</button>
        </div>
        <div id="map" class="map" role="region" aria-label="Map of trees. Pins are buttons. The same trees are listed after the map."></div>
        <p class="map-fallback" hidden>The map could not load. Use the list below.</p>
        <section aria-labelledby="map-list-h">
          <h2 id="map-list-h" tabindex="-1">Trees on the map, closest first</h2>
          <p class="small">${originNote()}</p>
          <ul class="tree-list card">${list.map(treeRow).join('')}</ul>
        </section>`,
      after: () => initMap(focus)
    };
  }

  function initMap(focusId) {
    if (map) { map.remove(); map = null; }
    const el = $('#map');
    if (!el) return;
    if (!window.L) { el.hidden = true; $('.map-fallback').hidden = false; return; }
    map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    if (S.here) {
      L.circleMarker([S.here.lat, S.here.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(map);
    }
    if (focusId && tree(focusId)) {
      const t = tree(focusId);
      map.setView([t.lat, t.lng], 17);
    } else {
      const pts = S.trees.map(t => [t.lat, t.lng]);
      if (S.here) pts.push([S.here.lat, S.here.lng]);
      map.fitBounds(pts, { padding: [24, 24], maxZoom: 16 });
    }
    const markers = {};
    S.trees.forEach(t => {
      const following = isFollowing(t.id);
      const icon = L.divIcon({ className: 'tree-pin' + (following ? ' following' : ''), html: '<span aria-hidden="true">🌳</span>', iconSize: [40, 40], iconAnchor: [20, 36], popupAnchor: [0, -30] });
      const m = L.marker([t.lat, t.lng], { icon, keyboard: true, title: '' }).addTo(map);
      m.bindPopup(`<strong>${esc(t.name)}</strong><br>${esc(t.species)}<br>${esc(whereFrom(t))}<br><a href="#/tree/${esc(t.id)}">Open ${esc(t.name)}’s profile</a>`);
      const me = m.getElement();
      if (me) {
        me.setAttribute('role', 'button');
        me.setAttribute('aria-label', `${t.name}, ${t.species}${following ? ', following' : ''}`);
        me.removeAttribute('title');
      }
      markers[t.id] = m;
    });
    if (focusId && markers[focusId]) markers[focusId].openPopup();
    setTimeout(() => map && map.invalidateSize(), 200);
  }

  function pageTree(id) {
    const t = tree(id);
    if (!t) return { title: 'Tree not found', html: `<h1 tabindex="-1">Tree not found</h1><p class="card">This tree may have been removed. <a href="#/nearby">See nearby trees</a>.</p>` };
    const posts = S.posts.filter(p => p.treeId === id).sort((a, b) => b.t - a.t);
    const age = t.planted ? new Date().getFullYear() - t.planted : null;
    const cover = t.photos[t.photos.length > 1 ? 1 : 0];
    const photos = t.photos.slice().reverse();
    const typeOpts = Object.entries(OBSERVATION_TYPES).filter(([k]) => k !== 'status')
      .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
    const apple = `https://maps.apple.com/?ll=${t.lat},${t.lng}&q=${encodeURIComponent(t.name + ' (' + t.species + ')')}`;
    return {
      title: t.name,
      html: `<div class="profile-cover" aria-hidden="true">${cover ? imgTag(cover.ref, '', 'cover-img') : ''}</div>
        <section class="card profile-head" aria-labelledby="tree-name">
          ${avatar(t, 'lg')}
          <h1 id="tree-name" tabindex="-1">${esc(t.name)}</h1>
          <p class="species">${esc(t.species)}${t.scientific ? ` <i lang="la">${esc(t.scientific)}</i>` : ''}</p>
          <p class="meta">${followerCount(t)} followers · ${posts.length} posts · ${esc(whereFrom(t))}</p>
          <div class="btn-row center">
            ${followButton(t)}
            <button type="button" class="btn" data-action="focus" data-target="obs-text">Post observation</button>
          </div>
        </section>

        <section class="card" aria-labelledby="about-h">
          <h2 id="about-h">About ${esc(t.name)}</h2>
          ${t.about ? `<p>${esc(t.about)}</p>` : ''}
          <dl class="facts">
            ${t.planted ? `<div><dt>Planted</dt><dd>About ${t.planted}${age ? ` (${age} years old)` : ''}</dd></div>` : ''}
            ${t.heightFt ? `<div><dt>Height</dt><dd>${US_UNITS ? t.heightFt + ' feet' : Math.round(t.heightFt * 0.3048) + ' metres'}</dd></div>` : ''}
            ${t.girthIn ? `<div><dt>Trunk around</dt><dd>${US_UNITS ? t.girthIn + ' inches' : Math.round(t.girthIn * 2.54) + ' cm'}</dd></div>` : ''}
            ${t.place ? `<div><dt>Where</dt><dd>${esc(t.place)}</dd></div>` : ''}
            <div><dt>GPS</dt><dd>${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</dd></div>
            ${t.sample ? `<div><dt>Note</dt><dd>Fictional sample tree</dd></div>` : `<div><dt>Added by</dt><dd>${esc(t.by === 'me' ? myName() : (t.by || 'a neighbor'))}</dd></div>`}
          </dl>
          <div class="btn-row">
            <a class="btn" href="#/map?tree=${esc(t.id)}">Show on map</a>
            <a class="btn" href="${esc(apple)}" target="_blank" rel="noopener">Directions in Apple Maps</a>
          </div>
        </section>

        <section class="card" aria-labelledby="photos-h">
          <h2 id="photos-h">Photos (${photos.length})</h2>
          <ul class="photo-grid">
            ${photos.map(ph => `<li><button type="button" class="photo-btn" data-action="view-photo" data-ref="${esc(ph.ref)}" data-alt="${esc(ph.alt)}" aria-label="Open photo: ${esc(ph.alt)}">${imgTag(ph.ref, ph.alt, '')}</button></li>`).join('')}
          </ul>
          <form data-form="photo" data-id="${esc(t.id)}" class="subform">
            <h3>Add a photo of ${esc(t.name)}</h3>
            ${photoPicker(`Photo of ${t.name} the ${t.species}`)}
            <button type="submit" class="btn btn-primary">Save photo</button>
          </form>
        </section>

        <section class="card" aria-labelledby="post-h" id="post-form">
          <h2 id="post-h">Post an observation</h2>
          <form data-form="post" data-id="${esc(t.id)}">
            <label for="obs-type">What kind of observation?</label>
            <select id="obs-type" name="type">${typeOpts}</select>
            <label for="obs-text">What did you notice about ${esc(t.name)}?</label>
            <textarea id="obs-text" name="text" rows="3" required></textarea>
            ${photoPicker(`Photo of ${t.name} the ${t.species}`)}
            <button type="submit" class="btn btn-primary">Post</button>
          </form>
        </section>

        <section aria-labelledby="tl-h">
          <h2 id="tl-h">Timeline</h2>
          ${posts.map(p => postCard(p)).join('') || '<p class="card">No posts yet. Be the first!</p>'}
          <div class="card timeline-start"><p><span aria-hidden="true">🌱</span> ${esc(t.name)} joined Treebook ${timeTag(t.created)}.</p></div>
        </section>
        ${t.sample ? '' : `<div class="btn-row"><button type="button" class="btn btn-danger" data-action="delete-tree" data-id="${esc(t.id)}">Delete ${esc(t.name)}</button></div>`}`
    };
  }

  function pageAdd() {
    const kinds = Object.entries(TREE_KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    return {
      title: 'Add a tree',
      html: `<h1 tabindex="-1">Add a tree</h1>
        <p class="lede">Stand next to the tree, take its photo, and save its location.</p>
        <form data-form="add" class="card" novalidate>
          <label for="t-name">Tree’s name <span class="req">(required)</span></label>
          <input id="t-name" name="name" required autocomplete="off" placeholder="For example, Grandma Oak">
          <label for="t-kind">Type of tree</label>
          <select id="t-kind" name="kind">${kinds}</select>
          <label for="t-species">Species, if you know it</label>
          <input id="t-species" name="species" autocomplete="off" placeholder="For example, Red Maple">
          <label for="t-about">About this tree</label>
          <textarea id="t-about" name="about" rows="3" placeholder="Personality, history, what makes it special"></textarea>
          <label for="t-place">Where is it?</label>
          <input id="t-place" name="place" autocomplete="off" placeholder="For example, by the playground gate">

          <fieldset>
            <legend>GPS location <span class="req">(required)</span></legend>
            <button type="button" class="btn btn-primary" data-action="add-locate"><span aria-hidden="true">📍</span> Use my current location</button>
            <p class="small" id="loc-status" aria-live="polite">${S.here ? `Your last location is filled in. Tap the button to update it.` : 'Not set yet.'}</p>
            <div class="two-col">
              <div><label for="t-lat">Latitude</label><input id="t-lat" name="lat" inputmode="decimal" autocomplete="off" value="${S.here ? S.here.lat.toFixed(6) : ''}"></div>
              <div><label for="t-lng">Longitude</label><input id="t-lng" name="lng" inputmode="decimal" autocomplete="off" value="${S.here ? S.here.lng.toFixed(6) : ''}"></div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Photo</legend>
            ${photoPicker('Photo of the tree')}
          </fieldset>

          <details>
            <summary>More details (optional)</summary>
            <label for="t-planted">Year planted, roughly</label>
            <input id="t-planted" name="planted" inputmode="numeric" autocomplete="off">
            <label for="t-height">Height in ${US_UNITS ? 'feet' : 'metres'}</label>
            <input id="t-height" name="height" inputmode="decimal" autocomplete="off">
          </details>

          <p class="error" id="add-error" role="alert"></p>
          <button type="submit" class="btn btn-primary btn-block">Add tree to Treebook</button>
        </form>`
    };
  }

  function pageMe() {
    const following = S.follows.map(tree).filter(Boolean);
    const mine = S.posts.filter(p => p.mine).length;
    return {
      title: 'You',
      html: `<h1 tabindex="-1">You</h1>
        <form class="card" data-form="profile">
          <label for="my-name">Your name, shown on your observations</label>
          <input id="my-name" name="name" autocomplete="nickname" value="${esc(S.profile.name || '')}" placeholder="You">
          <button type="submit" class="btn btn-primary">Save name</button>
        </form>
        <section class="card" aria-labelledby="fol-h">
          <h2 id="fol-h">Trees you follow (${following.length})</h2>
          ${following.length ? `<ul class="tree-list">${sortedByDistance(following).map(treeRow).join('')}</ul>` : '<p>None yet. <a href="#/nearby">Find trees nearby</a>.</p>'}
          <p class="small">You have posted ${mine} ${mine === 1 ? 'observation' : 'observations'}.</p>
        </section>
        <section class="card" aria-labelledby="data-h">
          <h2 id="data-h">Your data</h2>
          <p>This prototype keeps everything on this iPhone only, in Safari. Nothing is uploaded. Clearing Safari website data will erase it, so make a backup if you care about your posts.</p>
          <div class="btn-col">
            <button type="button" class="btn" data-action="export">Save a backup file</button>
            <button type="button" class="btn" data-action="import">Restore from a backup file</button>
            <input type="file" accept="application/json,.json" class="file-input" id="import-file" tabindex="-1" aria-hidden="true">
            <button type="button" class="btn" data-action="move-samples">Move the sample trees near me</button>
            <button type="button" class="btn btn-danger" data-action="reset">Erase everything and start over</button>
          </div>
        </section>
        <section class="card" aria-labelledby="about-app-h">
          <h2 id="about-app-h">About Treebook</h2>
          <p>Treebook is a social network for individual trees. Follow trees, post what you notice, and watch their seasons change. The 20 sample trees are fictional.</p>
          <p>Tip: In Safari, tap the Share button, then Add to Home Screen, to open Treebook like an app.</p>
          <p class="small">Map data &copy; OpenStreetMap contributors. Map display by Leaflet.</p>
        </section>`
    };
  }

  /* ---------- router ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, query] = h.split('?');
    return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query || '') };
  }

  function render(opts) {
    const { parts, params } = parseHash();
    if (map && parts[0] !== 'map') { map.remove(); map = null; }
    let page, tab;
    switch (parts[0]) {
      case undefined: page = pageFeed(); tab = 'feed'; break;
      case 'nearby': page = pageNearby(params); tab = 'nearby'; break;
      case 'map': page = pageMap(params); tab = 'map'; break;
      case 'tree': page = pageTree(decodeURIComponent(parts[1] || '')); tab = ''; break;
      case 'add': page = pageAdd(); tab = 'add'; break;
      case 'me': page = pageMe(); tab = 'me'; break;
      default: page = { title: 'Not found', html: '<h1 tabindex="-1">Page not found</h1><p><a href="#/">Go to the feed</a></p>' };
    }
    const keepScroll = opts && opts.keepScroll;
    const y = window.scrollY;
    const active = keepScroll && document.activeElement && document.activeElement.id;
    main.innerHTML = page.html;
    document.title = page.title + ' · Treebook';
    $$('.tabbar a').forEach(a => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    hydrate(main);
    if (page.after) page.after();
    if (keepScroll) {
      window.scrollTo(0, y);
      if (active && document.getElementById(active)) document.getElementById(active).focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      const h1 = $('h1', main);
      if (h1 && !(opts && opts.initial)) h1.focus({ preventScroll: true });
    }
  }

  // Re-render without moving focus/scroll (after follow, like, etc.)
  function refresh(focusSelector) {
    render({ keepScroll: true });
    if (focusSelector) { const el = $(focusSelector, main); if (el) el.focus({ preventScroll: true }); }
  }

  /* ---------- actions ---------- */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action;
    const id = el.dataset.id;

    if (act === 'skip') { e.preventDefault(); main.focus(); return; }
    if (act === 'focus') {
      e.preventDefault();
      const target = document.getElementById(el.dataset.target);
      if (target) { target.scrollIntoView({ block: 'center' }); target.focus({ preventScroll: true }); }
      return;
    }
    if (act === 'follow') {
      const t = tree(id);
      if (isFollowing(id)) { S.follows = S.follows.filter(x => x !== id); announce(`You unfollowed ${t.name}.`); }
      else { S.follows.push(id); announce(`You are now following ${t.name}.`); }
      Store.save();
      refresh(`[data-action="follow"][data-id="${CSS.escape(id)}"]`);
      return;
    }
    if (act === 'like') {
      if (S.liked.includes(id)) { S.liked = S.liked.filter(x => x !== id); announce('Like removed.'); }
      else { S.liked.push(id); announce('Liked.'); }
      Store.save();
      refresh(`[data-action="like"][data-id="${CSS.escape(id)}"]`);
      return;
    }
    if (act === 'delete-post') {
      if (!confirm('Delete this post?')) return;
      S.posts = S.posts.filter(x => x.id !== id);
      Store.save();
      announce('Post deleted.');
      refresh('#tl-h');
      return;
    }
    if (act === 'delete-tree') {
      const t = tree(id);
      if (!confirm(`Delete ${t.name} and all of its posts? This cannot be undone.`)) return;
      t.photos.forEach(ph => ph.ref.startsWith('idb:') && Store.deletePhoto(ph.ref.slice(4)));
      S.posts.filter(p => p.treeId === id && p.photo && p.photo.ref.startsWith('idb:')).forEach(p => Store.deletePhoto(p.photo.ref.slice(4)));
      S.trees = S.trees.filter(x => x.id !== id);
      S.posts = S.posts.filter(p => p.treeId !== id);
      S.follows = S.follows.filter(x => x !== id);
      Store.save();
      announce(`${t.name} was deleted.`);
      location.hash = '#/nearby';
      return;
    }
    if (act === 'view-photo') {
      const dlg = $('#lightbox');
      $('#lightbox-img').src = await Store.photoURL(el.dataset.ref);
      $('#lightbox-img').alt = el.dataset.alt || '';
      $('#lightbox-caption').textContent = el.dataset.alt || '';
      dlg._opener = el;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      return;
    }
    if (act === 'pick') {
      const picker = el.closest('[data-picker]');
      $(`input.file-input[data-which="${el.dataset.which}"]`, picker).click();
      return;
    }
    if (act === 'remove-photo') {
      const picker = el.closest('[data-picker]');
      clearPicker(picker);
      $('[data-action="pick"]', picker).focus();
      announce('Photo removed.');
      return;
    }
    if (act === 'locate') {
      el.disabled = true;
      announce('Finding your location…');
      try {
        S.here = await geolocate();
        Store.save();
        render({ keepScroll: true });
        announce(`Location found, accurate to about ${fmtDistance(S.here.acc)}. Trees are now sorted from where you are.`);
      } catch (err) { announce(err.message); el.disabled = false; }
      return;
    }
    if (act === 'add-locate') {
      const status = $('#loc-status');
      el.disabled = true;
      status.textContent = 'Finding your location…';
      try {
        S.here = await geolocate();
        Store.save();
        $('#t-lat').value = S.here.lat.toFixed(6);
        $('#t-lng').value = S.here.lng.toFixed(6);
        status.textContent = `Location set, accurate to about ${fmtDistance(S.here.acc)}.`;
      } catch (err) { status.textContent = err.message; }
      el.disabled = false;
      return;
    }
    if (act === 'export') {
      announce('Preparing backup…');
      const json = await Store.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `treebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      announce('Backup ready. Choose where to save it.');
      return;
    }
    if (act === 'import') { $('#import-file').click(); return; }
    if (act === 'move-samples') {
      el.disabled = true;
      announce('Finding your location…');
      try {
        S.here = await geolocate();
        S.trees.forEach(t => {
          const src = SAMPLE_TREES.find(x => x.id === t.id);
          if (!t.sample || !src) return;
          const p = Store.metersToLatLng(S.here, src.at[0], src.at[1]);
          t.lat = p.lat; t.lng = p.lng;
        });
        Store.save();
        announce('The sample trees now surround your location.');
      } catch (err) { announce(err.message); }
      el.disabled = false;
      return;
    }
    if (act === 'reset') {
      if (!confirm('Erase all your trees, posts, photos and follows, and restore the sample trees?')) return;
      await Store.clearPhotos();
      Store.reset();
      Object.assign(S, Store.state);
      announce('Treebook was reset.');
      location.hash = '#/';
      render();
      return;
    }
  });

  $('#lightbox').addEventListener('close', (e) => {
    const opener = e.target._opener;
    if (opener && document.contains(opener)) opener.focus();
  });
  $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') e.target.close(); });

  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('[data-picker] input.file-input')) return onPhotoChosen(el);
    if (el.id === 'import-file') {
      const f = el.files[0]; el.value = '';
      if (!f) return;
      try {
        await Store.importAll(await f.text());
        Object.assign(S, Store.state);
        announce('Backup restored.');
        render({ keepScroll: true });
      } catch (err) { announce(err.message || 'That file could not be restored.'); }
      return;
    }
    if (el.form && el.form.dataset.form === 'search' && el.name === 'show') submitSearch(el.form, true);
  });

  function submitSearch(form, keepFocus) {
    const q = form.q.value.trim();
    const show = form.show.value;
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (show !== 'all') p.set('show', show);
    const hash = '#/nearby' + (p.toString() ? '?' + p : '');
    history.replaceState(null, '', hash);
    const focusName = keepFocus ? document.activeElement && document.activeElement.value : null;
    render({ keepScroll: true });
    if (focusName) { const r = $(`input[name=show][value="${focusName}"]`); if (r) r.focus(); }
    announce($('#list-h').textContent);
  }

  let searchTimer;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'q') {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const form = e.target.form, val = e.target.value, pos = e.target.selectionStart;
        submitSearch(form);
        const q = $('#q'); if (q) { q.focus(); q.value = val; try { q.setSelectionRange(pos, pos); } catch (x) {} }
      }, 450);
    }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const btn = $('button[type=submit]', form);

    if (kind === 'search') { submitSearch(form); return; }

    if (kind === 'profile') {
      S.profile.name = form.name.value.trim().slice(0, 40);
      Store.save();
      announce('Name saved.');
      return;
    }

    if (kind === 'post') {
      const t = tree(form.dataset.id);
      const text = form.text.value.trim();
      if (!text) { announce('Please write what you noticed first.'); form.text.focus(); return; }
      btn.disabled = true;
      const photo = await savePickerPhoto($('[data-picker]', form), `Photo of ${t.name} by ${myName()}`);
      const post = { id: Store.uid('p'), treeId: t.id, type: form.type.value, text: text.slice(0, 2000), by: myName(), mine: true, t: Date.now(), likes: 0 };
      if (photo) { post.photo = photo; t.photos.push({ ref: photo.ref, alt: photo.alt, by: myName(), t: post.t }); }
      S.posts.push(post);
      if (!isFollowing(t.id)) S.follows.push(t.id);
      Store.save();
      render({ keepScroll: true });
      const h = $('#h-' + CSS.escape(post.id));
      if (h) { h.setAttribute('tabindex', '-1'); h.scrollIntoView({ block: 'center' }); h.focus({ preventScroll: true }); }
      announce(`Posted to ${t.name}’s timeline.`);
      return;
    }

    if (kind === 'photo') {
      const t = tree(form.dataset.id);
      const picker = $('[data-picker]', form);
      if (!picker._blob) { announce('Take or choose a photo first.'); $('[data-action="pick"]', picker).focus(); return; }
      btn.disabled = true;
      const photo = await savePickerPhoto(picker, `Photo of ${t.name} by ${myName()}`);
      t.photos.push({ ref: photo.ref, alt: photo.alt, by: myName(), t: Date.now() });
      Store.save();
      render({ keepScroll: true });
      const h = $('#photos-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
      announce(`Photo saved to ${t.name}’s profile.`);
      return;
    }

    if (kind === 'add') {
      const err = $('#add-error');
      const name = form.name.value.trim();
      const lat = parseFloat(form.lat.value), lng = parseFloat(form.lng.value);
      let problem = '', focusEl = null;
      if (!name) { problem = 'Please give the tree a name.'; focusEl = form.name; }
      else if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || isNaN(lat) || isNaN(lng)) {
        problem = 'Please set the GPS location. Tap Use my current location.'; focusEl = $('[data-action="add-locate"]', form);
      }
      $$('[aria-invalid]', form).forEach(x => x.removeAttribute('aria-invalid'));
      if (problem) {
        err.textContent = problem;
        if (focusEl.tagName === 'INPUT') focusEl.setAttribute('aria-invalid', 'true');
        focusEl.focus();
        return;
      }
      err.textContent = '';
      btn.disabled = true;
      const kindVal = form.kind.value;
      const species = form.species.value.trim() || (kindVal !== 'other' ? TREE_KINDS[kindVal] : 'Unknown species');
      const id = Store.uid('t');
      const photo = await savePickerPhoto($('[data-picker]', form), `Photo of ${name} the ${species}`);
      const planted = parseInt(form.planted.value, 10);
      const height = parseFloat(form.height.value);
      const t = {
        id, name: name.slice(0, 60), species: species.slice(0, 80), scientific: '', kind: kindVal === 'other' ? 'other' : kindVal,
        lat: +lat.toFixed(6), lng: +lng.toFixed(6), place: form.place.value.trim().slice(0, 120), about: form.about.value.trim().slice(0, 1000),
        planted: planted > 1000 && planted <= new Date().getFullYear() ? planted : null,
        heightFt: height > 0 ? Math.round(US_UNITS ? height : height / 0.3048) : null,
        girthIn: null, sample: false, by: 'me', baseFollowers: 0, created: Date.now(),
        photos: photo ? [{ ref: photo.ref, alt: photo.alt, by: myName(), t: Date.now() }] : []
      };
      S.trees.push(t);
      S.follows.push(id);
      S.posts.push({ id: Store.uid('p'), treeId: id, type: 'note', text: `I added ${t.name} to Treebook.`, by: myName(), mine: true, t: Date.now(), likes: 0, photo: photo || undefined });
      Store.save();
      location.hash = '#/tree/' + id;
      announce(`${t.name} was added. You are following it.`);
      return;
    }
  });

  window.addEventListener('hashchange', () => render());
  render({ initial: true });

  // Offline support once published on https.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
