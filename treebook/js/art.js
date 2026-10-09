/* Draws illustrated "photos" of the sample trees as SVG, so the prototype
   ships with pictures without needing any image files or services. */
(function () {
  const KINDS = {
    oak:       { shape: 'round',   leaf: ['#3d7d33', '#2c6125'], alt: ['#a8642a', '#7d4520'] },
    maple:     { shape: 'round',   leaf: ['#4b8f3a', '#356d29'], alt: ['#e8681f', '#c0391b'] },
    sycamore:  { shape: 'round',   leaf: ['#5a9440', '#3f7430'], alt: ['#c99a3a', '#9b7228'], trunk: '#d8d2c0', patches: true },
    elm:       { shape: 'vase',    leaf: ['#4f8d3c', '#38702c'], alt: ['#d6b13a', '#b08e27'] },
    beech:     { shape: 'round',   leaf: ['#5b9a45', '#417833'], alt: ['#c78a3c', '#9c6527'], trunk: '#9a9a96' },
    hickory:   { shape: 'round',   leaf: ['#4a8a38', '#346a29'], alt: ['#d9b234', '#a88722'], shaggy: true },
    sweetgum:  { shape: 'round',   leaf: ['#3f8a3c', '#2c6a2c'], alt: ['#a3264a', '#6d1e4e'] },
    tulip:     { shape: 'tall',    leaf: ['#4f9443', '#367333'], alt: ['#f29d38', '#7fb542'] },
    persimmon: { shape: 'round',   leaf: ['#478a3a', '#326a2a'], alt: ['#4a7d33', '#2f5f24'], fruit: '#f08a24' },
    ginkgo:    { shape: 'tall',    leaf: ['#6aa84f', '#4e8a3a'], alt: ['#f2c230', '#d9a514'] },
    magnolia:  { shape: 'round',   leaf: ['#2f6b35', '#1f4f27'], alt: ['#2f6b35', '#1f4f27'], fruit: '#d8323a' },
    birch:     { shape: 'round',   leaf: ['#6aa84f', '#4f8a3c'], alt: ['#e6c34a', '#c9a432'], trunk: '#f1efe8', birch: true },
    willow:    { shape: 'weeping', leaf: ['#8cb84a', '#6c9a35'], alt: ['#c9c24a', '#a5a034'] },
    cherry:    { shape: 'round',   leaf: ['#4f8d3c', '#38702c'], alt: ['#f7b6cf', '#ea8db3'], blossom: '#fff0f6' },
    redbud:    { shape: 'round',   leaf: ['#5a9a45', '#3f7a33'], alt: ['#c94f9b', '#a83a82'], blossom: '#f2a6d4' },
    dogwood:   { shape: 'round',   leaf: ['#4f8d3c', '#38702c'], alt: ['#a9302f', '#7f2424'], fruit: '#e0242b' },
    pine:      { shape: 'cone',    leaf: ['#2f6a3b', '#1f4f2b'], alt: ['#2f6a3b', '#1f4f2b'] },
    cedar:     { shape: 'cone',    leaf: ['#3a6e3e', '#28512d'], alt: ['#3a6e3e', '#28512d'], fruit: '#7d9cc7', trunk: '#7a4a33' },
    holly:     { shape: 'cone',    leaf: ['#1f5a32', '#154426'], alt: ['#1f5a32', '#154426'], fruit: '#d4202a' },
    cypress:   { shape: 'cone',    leaf: ['#6d9a46', '#527a33'], alt: ['#c0632f', '#954a22'], trunk: '#8a5a3c' },
    other:     { shape: 'round',   leaf: ['#4a8a3c', '#336a2b'], alt: ['#c98a34', '#9c6527'] }
  };

  const SKIES = [
    ['#9fd3ff', '#e8f5ff', '#7fb85a'],  // clear day
    ['#ffcf9a', '#fff1df', '#9ab35a'],  // golden hour
    ['#6b7fbf', '#f2b8a2', '#5f8a4a']   // dusk
  ];

  function rng(seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function blobs(r, cx, cy, rx, ry, n, colors, minR, maxR) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      const rad = minR + r() * (maxR - minR);
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${colors[i % colors.length]}"/>`;
    }
    return s;
  }

  function treeSVG(kind, variant, seed) {
    const k = KINDS[kind] || KINDS.other;
    const v = Math.abs(variant | 0) % 3;
    const r = rng(kind + ':' + v + ':' + (seed || ''));
    const sky = SKIES[v];
    const leaf = v === 1 ? k.alt : k.leaf;
    const trunk = k.trunk || '#6b4a2f';
    const dark = 'rgba(0,0,0,.18)';
    let canopy = '', trunkSvg = '', extra = '';

    // Hills and ground
    let ground = `<path d="M0 230 Q100 ${205 + r() * 15} 200 222 T400 ${212 + r() * 15} V300 H0Z" fill="${sky[2]}"/>` +
      `<path d="M0 250 Q120 238 220 248 T400 244 V300 H0Z" fill="${sky[2]}" opacity=".7"/>` +
      `<ellipse cx="200" cy="252" rx="110" ry="10" fill="${dark}"/>`;

    // Trunk
    const tw = kind === 'birch' ? 10 : (k.shape === 'tall' ? 16 : 22);
    trunkSvg = `<path d="M${200 - tw} 252 Q${200 - tw * 0.4} 200 ${200 - tw * 0.45} 140 L${200 + tw * 0.45} 140 Q${200 + tw * 0.4} 200 ${200 + tw} 252Z" fill="${trunk}"/>`;
    if (k.birch) {
      trunkSvg = '';
      [-34, 0, 30].forEach((dx, i) => {
        const x = 200 + dx;
        trunkSvg += `<path d="M${x - 6} 252 L${x - 4 + dx * 0.3} 120 L${x + 4 + dx * 0.3} 120 L${x + 6} 252Z" fill="${trunk}" stroke="#bdb8aa" stroke-width="1"/>`;
        for (let j = 0; j < 6; j++) trunkSvg += `<rect x="${x - 5 + dx * 0.15}" y="${140 + j * 18 + r() * 8}" width="${5 + r() * 5}" height="2.5" fill="#333" opacity=".7"/>`;
      });
    }
    if (k.patches) for (let j = 0; j < 7; j++) trunkSvg += `<ellipse cx="${190 + r() * 20}" cy="${150 + r() * 95}" rx="${3 + r() * 5}" ry="${4 + r() * 6}" fill="#8f8a74" opacity=".6"/>`;
    if (k.shaggy) for (let j = 0; j < 9; j++) trunkSvg += `<rect x="${186 + r() * 26}" y="${150 + r() * 90}" width="2" height="${14 + r() * 14}" fill="#3a2a1c" opacity=".55"/>`;

    if (k.shape === 'round') {
      canopy = blobs(r, 200, 110, 105, 62, 26, [leaf[1], leaf[0]], 26, 44) + blobs(r, 195, 95, 80, 45, 14, [leaf[0]], 18, 30);
    } else if (k.shape === 'vase') {
      trunkSvg += `<path d="M195 160 L150 90 M205 160 L250 90 M200 150 L200 80" stroke="${trunk}" stroke-width="8" fill="none"/>`;
      canopy = blobs(r, 200, 80, 125, 50, 30, [leaf[1], leaf[0]], 22, 40);
    } else if (k.shape === 'tall') {
      canopy = blobs(r, 200, 105, 60, 85, 26, [leaf[1], leaf[0]], 20, 34);
    } else if (k.shape === 'weeping') {
      canopy = blobs(r, 200, 100, 95, 48, 18, [leaf[1], leaf[0]], 24, 38);
      for (let j = 0; j < 46; j++) {
        const x = 100 + j * 4.4 + r() * 4, y0 = 95 + r() * 30, len = 80 + r() * 70 - Math.abs(x - 200) * 0.3;
        canopy += `<path d="M${x.toFixed(1)} ${y0.toFixed(1)} q${(r() * 8 - 4).toFixed(1)} ${(len / 2).toFixed(1)} ${(r() * 6 - 3).toFixed(1)} ${len.toFixed(1)}" stroke="${leaf[j % 2]}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      }
    } else if (k.shape === 'cone') {
      const layers = kind === 'cypress' ? 5 : 6;
      for (let j = 0; j < layers; j++) {
        const y = 230 - j * 30, w = 95 - j * 14;
        canopy += `<path d="M${200 - w} ${y} L200 ${y - 70} L${200 + w} ${y}Z" fill="${leaf[j % 2]}"/>`;
      }
      trunkSvg = `<rect x="192" y="220" width="16" height="32" fill="${trunk}"/>`;
    }

    if (v === 1 && k.blossom) extra += blobs(r, 200, 105, 105, 60, 70, [k.blossom, '#ffffff', leaf[0]], 3, 6);
    if (k.fruit && v !== 2) extra += blobs(r, 200, 115, 90, 50, 22, [k.fruit], 3, 5);
    if (v === 1 && !k.blossom && kind !== 'pine' && kind !== 'holly' && kind !== 'magnolia') {
      for (let j = 0; j < 18; j++) extra += `<circle cx="${(90 + r() * 220).toFixed(1)}" cy="${(240 + r() * 50).toFixed(1)}" r="3" fill="${leaf[j % 2]}"/>`;
    }

    const sun = v === 0 ? `<circle cx="${60 + r() * 40}" cy="55" r="22" fill="#fff6c9"/>`
      : v === 1 ? `<circle cx="${320 + r() * 40}" cy="80" r="28" fill="#ffe08a" opacity=".9"/>`
      : `<circle cx="330" cy="50" r="14" fill="#fdf3d7"/>`;
    const clouds = v === 0 ? `<g fill="#fff" opacity=".85"><ellipse cx="${250 + r() * 60}" cy="45" rx="40" ry="12"/><ellipse cx="${280 + r() * 60}" cy="38" rx="25" ry="10"/></g>` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">` +
      `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>` +
      `<rect width="400" height="300" fill="url(#s)"/>${sun}${clouds}${ground}${trunkSvg}${canopy}${extra}</svg>`;
  }

  const cache = new Map();
  window.treeArt = function (kind, variant, seed) {
    const key = kind + ':' + variant + ':' + (seed || '');
    if (!cache.has(key)) cache.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(treeSVG(kind, variant, seed)));
    return cache.get(key);
  };
})();
