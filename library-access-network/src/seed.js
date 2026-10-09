'use strict';
// DEMONSTRATION DATA. Every library, person, and conversation here is fictional.
// The libraries are placed in Washington DC, Arlington VA, and Prince George's
// County MD to show a regional network; they are not real branches and do not
// represent any real library system.

const { hashPassword } = require('./auth');

const DEMO_PASSWORD = 'demo-library';

function daysAgo(n, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const defaultPrefs = {
  screenReader: 'jaws', textSize: '100', contrast: 'default', inputMethod: 'keyboard',
  learningStyle: 'step-by-step', morphicFeatures: [],
};

function buildSeed() {
  const libraries = [
    {
      id: 'lib-dc', name: 'Downtown Demo Library', place: 'Washington, DC', region: 'District of Columbia',
      about: 'Fictional demonstration library. Has a quiet assistive technology room with two JAWS computers, a braille embosser, and a magnifier.',
      hours: 'Monday to Thursday 9 am to 8 pm. Friday and Saturday 10 am to 5 pm. Sunday 1 pm to 5 pm.',
      resources: [
        { name: 'Assistive technology room', detail: 'Two Windows computers with JAWS and Morphic, ask at the second-floor desk.' },
        { name: 'Braille embosser', detail: 'Staff can emboss up to 20 pages per visit.' },
        { name: 'Drop-in tech help', detail: 'Tuesdays 2 pm to 4 pm, no appointment needed.' },
      ],
    },
    {
      id: 'lib-arl', name: 'Central Demo Library', place: 'Arlington, VA', region: 'Arlington County, Virginia',
      about: 'Fictional demonstration library. Hosts a monthly blind peer-learning circle led by patrons.',
      hours: 'Monday to Saturday 10 am to 6 pm. Closed Sunday.',
      resources: [
        { name: 'Peer-learning circle', detail: 'Second Saturday of each month, 11 am to 1 pm. Patrons teach patrons.' },
        { name: 'Braille and audio design classes', detail: '11 am to 1 pm on scheduled dates. Ask staff for the calendar.' },
        { name: 'Accessible workstation', detail: 'One computer with JAWS, Morphic, and a refreshable braille display.' },
      ],
    },
    {
      id: 'lib-pgc', name: 'Demo Branch Library', place: 'Prince George\'s County, MD', region: 'Prince George\'s County, Maryland',
      about: 'Fictional demonstration library. Smaller branch that relies on the network for specialist help.',
      hours: 'Monday to Friday 10 am to 7 pm. Saturday 10 am to 4 pm.',
      resources: [
        { name: 'Accessible workstation', detail: 'One computer with JAWS and Morphic near the front desk.' },
        { name: 'Phone training appointments', detail: 'Book a trainer from anywhere in the network for a phone session.' },
      ],
    },
  ];

  const pw = hashPassword(DEMO_PASSWORD);
  const user = (u) => ({ prefs: { ...defaultPrefs }, ...u, passwordHash: pw, demo: true });
  const users = [
    user({ id: 'usr-maya', username: 'maya', displayName: 'Maya R.', role: 'patron', libraryId: 'lib-dc',
      bio: 'New to JAWS after losing my sight last year. Want to get back to email and job applications.', skills: [] }),
    user({ id: 'usr-harold', username: 'harold', displayName: 'Harold B.', role: 'patron', libraryId: 'lib-dc',
      bio: 'Retired bus driver. First time using a computer with speech.', skills: [],
      prefs: { ...defaultPrefs, learningStyle: 'one-on-one', textSize: '150' } }),
    user({ id: 'usr-jordan', username: 'jordan', displayName: 'Jordan T.', role: 'patron', libraryId: 'lib-pgc',
      bio: 'Braille reader. Use JAWS with a 40-cell braille display at work.', skills: ['braille displays', 'Microsoft Word'],
      prefs: { ...defaultPrefs, inputMethod: 'keyboard-braille', learningStyle: 'hands-on' } }),
    user({ id: 'usr-devon', username: 'devon', displayName: 'Devon P.', role: 'patron', libraryId: 'lib-arl',
      bio: 'Blind since birth, JAWS user for 15 years. I lead the Arlington peer-learning circle.', skills: ['JAWS web browsing', 'Excel', 'Zoom'] }),
    user({ id: 'usr-andre', username: 'andre', displayName: 'Andre W.', role: 'trainer', libraryId: 'lib-arl',
      bio: 'Blind assistive technology trainer. Teaches JAWS, Gmail, and job-search skills across the network.', skills: ['JAWS', 'Gmail', 'Microsoft Office', 'job search'], networkTrainer: true }),
    user({ id: 'usr-lin', username: 'lin', displayName: 'Lin C.', role: 'trainer', libraryId: 'lib-dc',
      bio: 'Assistive technology specialist. Sets up JAWS, ZoomText, and Morphic on library computers.', skills: ['JAWS setup', 'Morphic', 'magnification'], networkTrainer: false,
      prefs: { ...defaultPrefs, screenReader: 'none', inputMethod: 'mouse-keyboard' } }),
    user({ id: 'usr-rosa', username: 'rosa', displayName: 'Rosa M.', role: 'librarian', libraryId: 'lib-dc',
      bio: 'Accessibility services librarian.', skills: ['library services', 'NLS talking books'],
      prefs: { ...defaultPrefs, screenReader: 'none', inputMethod: 'mouse-keyboard' } }),
    user({ id: 'usr-sam', username: 'sam', displayName: 'Sam K.', role: 'librarian', libraryId: 'lib-pgc',
      bio: 'Branch manager and public computer coordinator.', skills: ['public computers'],
      prefs: { ...defaultPrefs, screenReader: 'none', inputMethod: 'mouse-keyboard' } }),
  ];

  const posts = [
    { id: 'pos-pdf', type: 'question', title: 'How do I read a PDF from the county website with JAWS?',
      body: 'I downloaded a bus schedule PDF but JAWS only says "blank" or nothing at all. What should I do?',
      authorId: 'usr-jordan', libraryId: 'lib-pgc', scope: 'network', tags: ['pdf', 'jaws', 'documents'],
      status: 'solved', solvedAnswerId: 'ans-pdf', kbEntryId: 'kb-pdf', createdAt: daysAgo(20) },
    { id: 'pos-links', type: 'tip', title: 'Tip: jump through the links list by typing the first letter',
      body: 'Press Insert+F7 to open the links list, then type the first letter of the link you want. JAWS jumps to links starting with that letter. Much faster than tabbing through a whole page.',
      authorId: 'usr-devon', libraryId: 'lib-arl', scope: 'network', tags: ['web', 'links', 'jaws'],
      status: 'shared', kbEntryId: 'kb-links', createdAt: daysAgo(15) },
    { id: 'pos-zoom', type: 'question', title: 'How do I mute myself in a Zoom meeting with JAWS?',
      body: 'I joined my support group on Zoom from the library computer and could not find the mute button.',
      authorId: 'usr-harold', libraryId: 'lib-dc', scope: 'network', tags: ['zoom', 'meetings'],
      status: 'solved', solvedAnswerId: 'ans-zoom', kbEntryId: 'kb-zoom', createdAt: daysAgo(12) },
    { id: 'pos-catalog', type: 'question', title: 'Library catalog: how do I skip straight to the search results?',
      body: 'After I search the catalog I have to listen to the whole menu again before the results.',
      authorId: 'usr-harold', libraryId: 'lib-dc', scope: 'library', tags: ['catalog', 'web', 'headings'],
      status: 'open', createdAt: daysAgo(2) },
    { id: 'pos-print', type: 'question', title: 'How do I print a Word document at the branch?',
      body: 'I wrote a cover letter in Word on the branch computer. How do I print it and know it worked?',
      authorId: 'usr-jordan', libraryId: 'lib-pgc', scope: 'library', tags: ['printing', 'microsoft word'],
      status: 'open', createdAt: daysAgo(3) },
    { id: 'pos-morphic', type: 'question', title: 'My Morphic text size goes back to normal after I log off',
      body: 'I make the text bigger with the MorphicBar but next visit it is small again.',
      authorId: 'usr-devon', libraryId: 'lib-arl', scope: 'library', tags: ['morphic', 'text size', 'low vision'],
      status: 'open', createdAt: daysAgo(4) },
    { id: 'pos-forms', type: 'question', title: 'Job application website: JAWS will not let me type in the boxes',
      body: 'I press letters and JAWS jumps around the page instead of typing my name.',
      authorId: 'usr-maya', libraryId: 'lib-dc', scope: 'library', tags: ['forms', 'job search', 'jaws'],
      status: 'open', createdAt: daysAgo(1) },
  ];

  const answers = [
    { id: 'ans-pdf', postId: 'pos-pdf', authorId: 'usr-andre', shareConsent: true, createdAt: daysAgo(19),
      body: 'Open the PDF in Adobe Acrobat Reader, then press Insert+Down Arrow to read.\n\nIf JAWS still says blank, the PDF is probably a scanned picture with no real text. JAWS has a built-in OCR feature (search JAWS Help for "Convenient OCR"), or ask library staff to help you request an accessible copy from the county.' },
    { id: 'ans-zoom', postId: 'pos-zoom', authorId: 'usr-devon', shareConsent: true, createdAt: daysAgo(12, 15),
      body: 'In Zoom on Windows, press Alt+A to mute or unmute yourself. Alt+V turns your video on or off. JAWS announces the change.' },
    { id: 'ans-print', postId: 'pos-print', authorId: 'usr-sam', shareConsent: false, createdAt: daysAgo(2),
      body: 'Press Ctrl+P in Word, then Enter to print. Our branch printer then asks you to release the job at the front desk, so come tell us your name and we will release it.' },
    { id: 'ans-morphic', postId: 'pos-morphic', authorId: 'usr-lin', shareConsent: true, createdAt: daysAgo(3),
      body: 'Many library computers reset every change when you sign out, for privacy. That includes text size. A Morphic account can save your settings so you can apply them again on any computer with Morphic. Ask staff whether your library\'s computers support that.' },
  ];

  const kb = [
    { id: 'kb-pdf', title: 'Reading a PDF with JAWS', tags: ['pdf', 'jaws', 'documents'],
      summary: 'Open the PDF in Adobe Acrobat Reader and use Say All. If JAWS reads nothing, the PDF is probably a scanned image.',
      steps: '1. Save the PDF and open it in Adobe Acrobat Reader.\n2. Press Insert+Down Arrow to read it.\n3. If JAWS says blank, the PDF is a scanned picture. Try JAWS Convenient OCR (see JAWS Help), or ask staff to request an accessible copy.',
      sourcePostId: 'pos-pdf', libraryId: 'lib-pgc', helpful: 6, createdAt: daysAgo(18),
      contributors: [{ userId: 'usr-jordan', role: 'asked the question' }, { userId: 'usr-andre', role: 'answered' }] },
    { id: 'kb-links', title: 'Find a link fast with the links list', tags: ['web', 'links', 'jaws'],
      summary: 'Open the JAWS links list and type the first letter of the link you want.',
      steps: '1. Press Insert+F7 to open the links list.\n2. Type the first letter of the link. Press it again to move to the next match.\n3. Press Enter to follow the link.',
      sourcePostId: 'pos-links', libraryId: 'lib-arl', helpful: 11, createdAt: daysAgo(14),
      contributors: [{ userId: 'usr-devon', role: 'shared the tip' }] },
    { id: 'kb-zoom', title: 'Mute and unmute in Zoom with JAWS', tags: ['zoom', 'meetings'],
      summary: 'In Zoom for Windows, Alt+A mutes and unmutes your microphone. Alt+V turns video on and off.',
      steps: '- Alt+A: mute or unmute.\n- Alt+V: start or stop video.\n- JAWS announces each change.',
      sourcePostId: 'pos-zoom', libraryId: 'lib-dc', helpful: 4, createdAt: daysAgo(11),
      contributors: [{ userId: 'usr-harold', role: 'asked the question' }, { userId: 'usr-devon', role: 'answered' }] },
  ];

  const requests = [
    { id: 'req-harold', patronId: 'usr-harold', libraryId: 'lib-dc', topic: 'Getting started with a computer that talks',
      details: 'I have never used a computer. I would like someone patient to show me the basics.', format: 'in-person',
      availability: 'Weekday mornings', status: 'new', trainerId: null, createdAt: daysAgo(1) },
    { id: 'req-jordan', patronId: 'usr-jordan', libraryId: 'lib-pgc', topic: 'Connect my braille display to the branch computer',
      details: 'I can bring my own 40-cell display.', format: 'in-person', availability: 'Saturdays',
      status: 'new', trainerId: null, createdAt: daysAgo(3) },
    { id: 'req-devon', patronId: 'usr-devon', libraryId: 'lib-arl', topic: 'Advanced Excel with JAWS for the peer circle',
      details: 'I want to learn this so I can teach it at the peer circle.', format: 'phone', availability: 'Evenings',
      status: 'scheduled', trainerId: 'usr-andre', staffNote: 'Phone session booked for next Thursday at 6 pm.', createdAt: daysAgo(6) },
  ];

  return { meta: { seededAt: new Date().toISOString(), demo: true }, libraries, users, posts, answers, kb, requests };
}

module.exports = { buildSeed, DEMO_PASSWORD, defaultPrefs };
