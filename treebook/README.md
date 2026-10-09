# Treebook

A Facebook-style social network for individual trees, built for iPhone Safari.

- 20 fictional sample trees, each with a profile, photos, GPS location and timeline
- Follow trees, like posts, and post observations (with photos from the iPhone camera)
- Map (Leaflet + OpenStreetMap, no API key) and an accessible list of nearby trees sorted by distance
- Add new trees using your current GPS location and a photo
- Built for VoiceOver: headings, landmarks, labelled buttons, spoken status messages, alt text on every photo, focus moved to each new page's heading, Dynamic Type, dark mode, reduced motion
- Everything is saved on the device (localStorage + IndexedDB for photos). Backup and restore on the "You" tab.
- Works offline after the first visit and can be added to the Home Screen

## Files

Plain HTML, CSS and JavaScript. No build step, no server code, no API keys.

```
index.html            app shell
css/app.css           styles
js/data.js            the 20 sample trees
js/art.js             draws the sample tree illustrations
js/store.js           local saving (swap this for a real server later)
js/app.js             pages and behaviour
vendor/leaflet/       map library (BSD-2 licence)
sw.js                 offline support
```

## Publish

Any static host works. With GitHub Pages: repository **Settings → Pages →
Deploy from a branch**, pick the branch, folder `/ (root)`, Save. The site is then at
`https://<user>.github.io/<repo>/treebook/`.

Camera and GPS need `https://`, which GitHub Pages, Netlify and similar give you for free.

## Try it on a computer

```
npx http-server treebook -p 8080
```

then open http://localhost:8080.
