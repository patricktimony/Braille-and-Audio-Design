// Plain-English explanations of common files and folders.

const BY_NAME = {
  'readme.md': ['Welcome note', 'The welcome note for this project. It usually explains what the project is and how to use it.'],
  'readme.txt': ['Welcome note', 'The welcome note for this project.'],
  readme: ['Welcome note', 'The welcome note for this project.'],
  'index.html': ['Web page', 'The main page of the website. This is usually the first page people see.'],
  'index.htm': ['Web page', 'The main page of the website. This is usually the first page people see.'],
  '404.html': ['Web page', 'The page people see when a link is broken ("page not found").'],
  'package.json': ['Settings', 'A list of the tools this project uses, and the commands for running it.'],
  'package-lock.json': ['Automatic record', 'An automatic record of the exact tools used. You normally never need to change it.'],
  'yarn.lock': ['Automatic record', 'An automatic record of the exact tools used. You normally never need to change it.'],
  'pnpm-lock.yaml': ['Automatic record', 'An automatic record of the exact tools used. You normally never need to change it.'],
  '.gitignore': ['Settings', 'A list of files that should not be stored in the project, such as temporary files and private settings.'],
  license: ['Document', 'The rules for how other people may use this project.'],
  'license.md': ['Document', 'The rules for how other people may use this project.'],
  'license.txt': ['Document', 'The rules for how other people may use this project.'],
  'claude.md': ['Notes for AI', 'Notes for Claude Code (an AI helper) about how to work on this project.'],
  'agents.md': ['Notes for AI', 'Notes for AI helpers about how to work on this project.'],
  '.env': ['Private settings', 'A private settings file. It may contain passwords or keys and should never be shared or published.'],
  '.env.example': ['Settings example', 'An example showing which private settings the app needs, without the real passwords.'],
  'requirements.txt': ['Settings', 'A list of Python tools this project needs.'],
  'manifest.json': ['Settings', 'Information that lets the website be installed like an app on phones.'],
  'manifest.webmanifest': ['Settings', 'Information that lets the website be installed like an app on phones.'],
  'favicon.ico': ['Picture', 'The small picture shown in the browser tab.'],
  'favicon.svg': ['Picture', 'The small picture shown in the browser tab.'],
  'robots.txt': ['Settings', 'Tells search engines like Google which pages they may look at.'],
  'sitemap.xml': ['Settings', 'A list of the website\'s pages, for search engines.'],
  dockerfile: ['Settings', 'Instructions for packaging the app so it can run on a server.'],
  'tsconfig.json': ['Settings', 'Settings for TypeScript, a kind of JavaScript.'],
  'vite.config.js': ['Settings', 'Settings for Vite, the tool that prepares this app to be shown.'],
  'vite.config.ts': ['Settings', 'Settings for Vite, the tool that prepares this app to be shown.'],
  'next.config.js': ['Settings', 'Settings for Next.js, the tool this app is built with.'],
  'netlify.toml': ['Settings', 'Settings for Netlify, a website hosting company.'],
  'vercel.json': ['Settings', 'Settings for Vercel, a website hosting company.'],
  '.nojekyll': ['Settings', 'Tells GitHub Pages to show the website files exactly as they are.'],
  cname: ['Settings', 'The custom web address (domain name) for this project\'s website.'],
  'changelog.md': ['Document', 'A list of what has changed in each version of the project.'],
  'contributing.md': ['Document', 'Advice for people who want to help with this project.'],
  'server.js': ['Program file', 'Instructions for the part of the app that runs on a server.'],
  'app.py': ['Program file', 'The main instructions of a Python app.'],
};

const FOLDERS = {
  src: 'The main working files (the "source") of the app.',
  public: 'Files given to visitors exactly as they are, such as pictures and icons.',
  static: 'Files given to visitors exactly as they are, such as pictures and icons.',
  assets: 'Pictures, sounds and other supporting files.',
  docs: 'Documents about the project, or the pages of its website.',
  node_modules: 'Tools downloaded automatically. You never need to change these.',
  test: 'Checks that make sure the app works correctly.',
  tests: 'Checks that make sure the app works correctly.',
  __tests__: 'Checks that make sure the app works correctly.',
  components: 'Reusable pieces of the app\'s screens.',
  pages: 'The separate pages or screens of the app.',
  images: 'Pictures.',
  img: 'Pictures.',
  css: 'Files that control how the pages look.',
  styles: 'Files that control how the pages look.',
  js: 'JavaScript instruction files.',
  scripts: 'Small programs that help with the project.',
  dist: 'The finished, prepared version of the app. It is made automatically.',
  build: 'The finished, prepared version of the app. It is made automatically.',
  out: 'The finished, prepared version of the app. It is made automatically.',
  '.github': 'Settings for GitHub, such as automatic tasks.',
  workflows: 'Automatic tasks that GitHub runs, such as publishing the website.',
  '.claude': 'Settings for Claude Code, the AI helper.',
  '.vscode': 'Settings for the Visual Studio Code editor.',
  server: 'The part of the app that runs on a server.',
  api: 'The part of the app that answers requests from other programs.',
  lib: 'Shared pieces of code used by the rest of the app.',
  utils: 'Small helper pieces of code.',
  fonts: 'Lettering styles (fonts).',
  sounds: 'Sound files.',
  audio: 'Sound files.',
};

const BY_EXT = {
  html: ['Web page', 'A web page.'], htm: ['Web page', 'A web page.'],
  css: ['Style file', 'Controls how the web pages look: colours, sizes and layout.'],
  js: ['Program file', 'Instructions, written in JavaScript, that make the pages do things.'],
  mjs: ['Program file', 'Instructions, written in JavaScript, that make the pages do things.'],
  cjs: ['Program file', 'Instructions written in JavaScript.'],
  jsx: ['Program file', 'Part of the app\'s screens, written in JavaScript for a tool called React.'],
  ts: ['Program file', 'Instructions written in TypeScript, a kind of JavaScript.'],
  tsx: ['Program file', 'Part of the app\'s screens, written in TypeScript for a tool called React.'],
  vue: ['Program file', 'Part of the app\'s screens, made with a tool called Vue.'],
  svelte: ['Program file', 'Part of the app\'s screens, made with a tool called Svelte.'],
  py: ['Program file', 'Instructions written in the Python programming language.'],
  rb: ['Program file', 'Instructions written in the Ruby programming language.'],
  php: ['Program file', 'Instructions written in PHP, which runs on a server.'],
  java: ['Program file', 'Instructions written in the Java programming language.'],
  swift: ['Program file', 'Instructions written in Swift, used for Apple apps.'],
  kt: ['Program file', 'Instructions written in Kotlin, used for Android apps.'],
  go: ['Program file', 'Instructions written in the Go programming language.'],
  rs: ['Program file', 'Instructions written in the Rust programming language.'],
  c: ['Program file', 'Instructions written in the C programming language.'],
  cpp: ['Program file', 'Instructions written in the C++ programming language.'],
  cs: ['Program file', 'Instructions written in the C# programming language.'],
  sh: ['Program file', 'A list of commands for a computer to run.'],
  json: ['Data', 'Information or settings, stored in a format that computers read easily.'],
  yml: ['Settings', 'Settings, written in a simple format.'], yaml: ['Settings', 'Settings, written in a simple format.'],
  toml: ['Settings', 'Settings, written in a simple format.'],
  xml: ['Data', 'Information stored in a format that computers read easily.'],
  csv: ['Data', 'A table of information, like a simple spreadsheet.'],
  md: ['Document', 'A document written in plain text with simple formatting.'],
  markdown: ['Document', 'A document written in plain text with simple formatting.'],
  txt: ['Document', 'A plain text document.'],
  pdf: ['Document', 'A PDF document.'],
  doc: ['Document', 'A Word document.'], docx: ['Document', 'A Word document.'],
  png: ['Picture', 'A picture.'], jpg: ['Picture', 'A photo or picture.'], jpeg: ['Picture', 'A photo or picture.'],
  gif: ['Picture', 'A picture, which may move.'], webp: ['Picture', 'A picture.'], avif: ['Picture', 'A picture.'],
  bmp: ['Picture', 'A picture.'], ico: ['Picture', 'A small icon picture.'],
  svg: ['Picture', 'A drawing that can be resized without becoming blurry.'],
  mp3: ['Sound', 'A sound or music file.'], wav: ['Sound', 'A sound file.'], ogg: ['Sound', 'A sound file.'], m4a: ['Sound', 'A sound file.'],
  mp4: ['Video', 'A video.'], webm: ['Video', 'A video.'], mov: ['Video', 'A video.'],
  woff: ['Font', 'A lettering style (font).'], woff2: ['Font', 'A lettering style (font).'], ttf: ['Font', 'A lettering style (font).'], otf: ['Font', 'A lettering style (font).'],
  zip: ['Bundle', 'A compressed bundle of files.'],
  lock: ['Automatic record', 'An automatic record of the exact tools used. You normally never need to change it.'],
};

const ICONS = {
  Folder: '📁', 'Web page': '🌐', Picture: '🖼️', Document: '📄', 'Welcome note': '👋', 'Program file': '⚙️',
  Settings: '🔧', Data: '📊', Sound: '🔊', Video: '🎬', Font: '🔤', Bundle: '🗜️', 'Private settings': '🔒',
  'Automatic record': '🧾', 'Notes for AI': '🤖', 'Style file': '🎨', File: '📄', 'Settings example': '🔧',
};

// Returns { kind, desc, icon } for a file or folder.
export function explain(name, type) {
  const lower = name.toLowerCase();
  if (type === 'folder') {
    return { kind: 'Folder', desc: FOLDERS[lower] || 'A folder that holds more files.', icon: ICONS.Folder };
  }
  let found = BY_NAME[lower];
  if (!found && /^\.env\./.test(lower)) found = /example|sample|template/.test(lower) ? BY_NAME['.env.example'] : BY_NAME['.env'];
  if (!found) {
    const ext = (lower.match(/\.([^.]+)$/) || [])[1];
    found = BY_EXT[ext];
  }
  const [kind, desc] = found || ['File', 'A file.'];
  return { kind, desc, icon: ICONS[kind] || ICONS.File };
}
