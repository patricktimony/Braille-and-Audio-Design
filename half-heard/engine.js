/*
 * Half-Heard Genius Engine — the built-in creative engine.
 *
 * Works entirely offline with no API key. It finds things a phrase could be
 * misheard as, then dreams up an invention, observation, joke, or art concept
 * for each one.
 *
 * Public API (also usable from Node for tests):
 *   HalfHeard.generate(phrase, options) -> { heard, interpretations: [...] }
 *     options.count         how many to return (default 5)
 *     options.seed          number; change it to get different variations
 *     options.exclude       array of interpretation keys already shown
 *     options.alternatives  other transcripts the speech recogniser offered
 *
 * Each interpretation looks like:
 *   { key, text, method, methodLabel, explanation, kind, kindLabel, idea }
 *
 * A language-model provider can replace or enrich this later: it only needs to
 * return the same shape. See app.js (providers) and server/server.mjs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HalfHeard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Data: famous mishearings (mondegreens, eggcorns, word-boundary classics).
  // Each entry works in both directions. An optional idea is hand-written.
  // ---------------------------------------------------------------------------
  var FAMOUS = [
    ['i scream', 'ice cream', 'Invention: a freezer that only opens when you shout. Dessert becomes a form of primal therapy.'],
    ['recognize speech', 'wreck a nice beach', 'Observation: a machine built to understand us heard a small act of vandalism instead. Perhaps it was telling us what it really thinks of sand.'],
    ['the human condition', 'the humid condition', 'Observation: the human condition is mostly humid. We are 60 percent water, worried about the weather inside ourselves.'],
    ['human condition', 'humid condition', 'Invention: a dehumidifier for existential dread. Empty the tank weekly; it fills with sighs.'],
    ['kiss the sky', 'kiss this guy', 'Joke: Jimi Hendrix fans have spent fifty years kissing a random guy. He has never complained.'],
    ["there's a bad moon on the rise", "there's a bathroom on the right", 'Invention: a song that doubles as building signage. Every chorus is a helpful direction.'],
    ['bad moon on the rise', 'bathroom on the right', 'Art concept: a moonlit painting with a small arrow in the corner, pointing politely to the restroom.'],
    ['tiny dancer', 'tony danza', 'Art concept: a ballet in which every dancer is gradually replaced by a 1980s sitcom actor, and the audience only notices at the curtain call.'],
    ['the cross i\'d bear', 'the cross-eyed bear', 'Invention: corrective spectacles for bears. Fitting appointments are short and very brave.'],
    ['for all intents and purposes', 'for all intensive purposes', 'Invention: a hospital ward dedicated to purposes in critical condition. Visiting hours are whenever you remember why you came into the room.'],
    ['dog eat dog world', 'doggy dog world', 'Observation: a doggy dog world sounds much kinder than a dog eat dog one. Mishearing can be a moral upgrade.'],
    ['euthanasia', 'youth in asia', 'Observation: one sound, two worlds. Language keeps the end of life and the start of it closer together than we like to admit.'],
    ['lactose intolerant', 'lack toes intolerant', 'Joke: I am lack-toes intolerant. I simply cannot stand people without feet.'],
    ['scapegoat', 'escape goat', 'Invention: the Escape Goat, a getaway vehicle for animals wrongly blamed for things. It has excellent grip on cliffs.'],
    ['nip it in the bud', 'nip it in the butt', 'Joke: Advice is most effective when it is mildly painful and slightly ridiculous.'],
    ['taken for granted', 'taken for granite', 'Art concept: a statue of someone you love, carved in granite, titled “Taken for Granite”. Touching it is encouraged.'],
    ['moot point', 'mute point', 'Invention: a remote control for arguments. Press Mute Point and the debate continues, silently, in gestures.'],
    ['self-esteem', 'self of steam', 'Observation: a self of steam rises when warmed and vanishes when ignored. That is not a flaw; it is a weather report.'],
    ['self esteem', 'self of steam', 'Invention: a kettle that whistles compliments when it reaches full self of steam.'],
    ['olive juice', 'i love you', 'Observation: say “olive juice” silently and it looks exactly like “I love you”. Affection hides in the pantry.'],
    ['i love you', 'isle of view', 'Art concept: an island built only of windows, called the Isle of View. You can see everyone you love from every shore.'],
    ['fork handles', 'four candles', 'Joke: A hardware shop sells four candles and fork handles at the same price, which is either a coincidence or a lifestyle.'],
    ['four candles', 'fork handles', 'Invention: a fork with a candle in its handle, for eating spaghetti romantically during power cuts.'],
    ['some others', 'some mothers', 'Observation: “some others” are always somebody\'s “some mothers”. Strangers are just relatives you haven\'t been introduced to.'],
    ['a nice man', 'an ice man', 'Invention: an ice sculpture of a nice man that melts a little whenever someone is kind to it.'],
    ['grade a', 'gray day', 'Observation: a gray day can still be grade A. Not all excellence is sunny.'],
    ['the stuff he knows', 'the stuffy nose', 'Joke: He knows a lot, but it all comes out congested.'],
    ['alzheimer\'s', 'old timer\'s', 'Observation: we name hard things softly when we can. Mishearing is sometimes how love edits a diagnosis.'],
    ['carpal tunnel', 'car pool tunnel', 'Invention: a tunnel only for car pools, so narrow that strangers must share wrists, I mean, rides.'],
    ['deep-seated', 'deep-seeded', 'Art concept: a garden planted at the bottom of a well. Whatever grows there is deep-seeded and very determined.'],
    ['whet your appetite', 'wet your appetite', 'Invention: a mister that sprays your appetite with tiny clouds of soup smell before dinner.'],
    ['pass muster', 'pass mustard', 'Joke: The inspection went well. Everyone passed the mustard.'],
    ['hunger pangs', 'hunger pains', 'Observation: hunger always arrives as both pain and pang: one hurts, the other rings like a bell calling you home.'],
    ['nowhere', 'now here', 'Observation: “nowhere” and “now here” use exactly the same letters. The only difference is where you leave a little space.'],
    ['together', 'to get her', 'Observation: “together” hides “to get her” — and both hide “to-get-there”. Every partnership is a journey with a destination nobody fully agreed on.'],
    ['send reinforcements', 'send three and fourpence', 'Joke: The army asked for reinforcements. By the time the message reached headquarters it was three and fourpence for a dance.'],
    ['we\'re going to advance', 'we\'re going to a dance', 'Art concept: a battlefield where both armies, mishearing their orders, put on their best shoes.'],
    ['laid him on the green', 'lady mondegreen', 'Observation: Lady Mondegreen never existed, yet she gave her name to every beautiful mistake. A mishearing can be more immortal than a person.'],
    ['the girl with kaleidoscope eyes', 'the girl with colitis goes by', 'Art concept: a psychedelic painting with a small, sympathetic hospital in the corner.'],
    ['recognise speech', 'wreck a nice beach', 'Invention: a sandcastle that understands every word you say and refuses to be destroyed by anyone who mumbles.'],
    ['a lot', 'allot', 'Observation: when you give a lot, you allot. Generosity is just accounting with a warm heart.'],
    ['a part', 'apart', 'Observation: to be a part of something and to be apart from it are separated by one breath of space.'],
    ['a head', 'ahead', 'Invention: a hat that walks a few steps ahead of you, scouting for awkward conversations.'],
    ['an aim', 'a name', 'Observation: a name is just an aim that people repeat until it sticks.'],
    ['a name', 'an aim', 'Observation: every name is secretly an aim. Your parents were pointing you somewhere.'],
    ['a notion', 'an ocean', 'Observation: a notion is an ocean seen from very far away. Get closer and you can drown in it.'],
    ['an ocean', 'a notion', 'Art concept: a vast blue room in which the only sound is someone softly saying “perhaps”.'],
    ['ice cream', 'i scream', 'Invention: an ice-cream van whose chime is a recording of joyful screaming. Children love it; parents need a moment.'],
    ['wreck a nice beach', 'recognize speech', 'Invention: a speech-recognising beach that rearranges its sand into whatever you said.'],
    ['night rate', 'nitrate', 'Invention: discounted fertiliser available only after midnight, for gardeners who dream big.'],
    ['nitrate', 'night rate', 'Joke: Chemistry teachers charge extra after dark: the nitrate.'],
    ['that\'s tough', 'that stuff', 'Joke: “That\'s tough,” said the sympathetic friend. “That stuff,” said the hoarder, pointing at the garage.'],
    ['mistake', 'missed ache', 'Observation: every mistake is a missed ache — a little pain that arrived instead of the one we expected.'],
    ['carpet', 'car pet', 'Invention: the Car Pet, a fluffy companion that lives under the passenger seat and purrs at red lights.'],
    ['notable', 'not able', 'Observation: “notable” and “not able” sound alike, and history is full of people who were both.'],
    ['friendship', 'friend ship', 'Invention: the Friend Ship, a cruise liner where the only activity is staying in touch.'],
    ['island', 'i land', 'Observation: an island is just a place that says “I land” and means it.'],
    ['insight', 'in sight', 'Observation: insight is what happens when something finally comes in sight.'],
    ['denial', 'the nile', 'Joke: Denial isn\'t just a river in Egypt. It is also a mishearing nobody will admit to.'],
    ['abundance', 'a bun dance', 'Art concept: a festival where bakers dance with their bread. Abundance, choreographed.'],
    ['adore', 'a door', 'Observation: to adore someone is to become a door they can always walk through.'],
    ['deliver', 'the liver', 'Joke: The surgeon promised to deliver. Everyone was nervous about which organ.'],
    ['pumpkin', 'pump kin', 'Invention: a pump for inflating distant relatives in time for holiday dinners.'],
    ['season', 'sees on', 'Observation: a season is the year noticing itself — it sees on, and on, and on.'],
    ['butterfly', 'butter fly', 'Invention: a breakfast drone that butters your toast mid-flight.'],
    ['heartbeat', 'heart beet', 'Invention: a vegetable that thumps gently in your hand to tell you it is ripe.'],
    ['impatient', 'in patient', 'Observation: an impatient person is just someone trapped in a patient, waiting to be discharged.'],
    ['arrested', 'a rested', 'Joke: He was a rested man. The police called it something else.'],
    ['assault', 'a salt', 'Joke: The chef was charged with a salt. The soup pressed charges.'],
    ['understand', 'under stand', 'Observation: to understand is to stand under something — to hold it up from below.'],
    ['wholesome', 'hole some', 'Art concept: a cheese so wholesome it is mostly holes, exhibited as sculpture.'],
    ['mankind', 'man kind', 'Observation: we named ourselves mankind as a reminder, not a description.'],
    ['sherlock', 'shirt lock', 'Invention: the Shirt Lock — a detective-grade padlock for your favourite shirt.'],
    ['tomorrow', 'to borrow', 'Observation: tomorrow is always to borrow. Nobody owns it; we only take it out on loan.'],
    ['forever', 'four ever', 'Joke: She promised to love him forever. He was disappointed to learn it was only four.'],
    ['weekend', 'weak end', 'Observation: the weekend is the weak end of the week, which is exactly why it lets us rest.'],
    ['history', 'his story', 'Observation: history has always been his story. The question is whose story is still waiting to be misheard.'],
    ['believe', 'be leaf', 'Art concept: a tree whose leaves each carry one thing someone believes. In autumn, beliefs fall gently.'],
    ['nothing', 'nut thing', 'Invention: the Nut Thing, a container that holds exactly nothing — and one almond for emergencies.'],
    ['breakfast', 'brake fast', 'Invention: an alarm clock that slams the brakes on your morning before you rush into it.'],
    ['meeting', 'meat thing', 'Joke: I said we\'re having a meeting. Half the office brought sausages.']
  ];

  // Familiar expressions with a literal reading.
  var IDIOMS = [
    ['break a leg', 'a request to snap a limb', 'Invention: theatre seats that gently cast your leg in plaster as you wish the actors luck.'],
    ['raining cats and dogs', 'pets falling from the sky', 'Invention: the cat-and-dog umbrella, padded on top, with a small welcome mat for landings.'],
    ['piece of cake', 'a slice of actual cake', 'Observation: if every easy task came with a slice of cake, we would choose harder lives just to get more of them.'],
    ['spill the beans', 'beans scattered across the floor', 'Art concept: a gallery floor covered in beans, each one labelled with a secret visitors have whispered.'],
    ['time flies', 'clocks with wings', 'Invention: a wall clock with wings that drifts toward whatever you are enjoying most.'],
    ['break the ice', 'smashing a frozen lake', 'Invention: a conversation-starter hammer for parties, made of soft ice, for shattering awkward silences.'],
    ['hit the sack', 'punching a bag of potatoes', 'Joke: I told my bed I was going to hit the sack. It hasn\'t trusted me since.'],
    ['under the weather', 'standing beneath a personal raincloud', 'Art concept: a small cloud that follows a person through a city, raining only on them, until someone shares an umbrella.'],
    ['cost an arm and a leg', 'paying with body parts', 'Joke: The shop said it would cost an arm and a leg. I asked if they took fingers for the tip.'],
    ['let the cat out of the bag', 'releasing a surprised cat', 'Invention: a gift bag with a built-in cat flap, for secrets that need to escape gracefully.'],
    ['once in a blue moon', 'when the moon turns blue', 'Art concept: a lunar calendar where each blue moon is a day set aside for something you keep postponing.'],
    ['bite the bullet', 'chewing ammunition', 'Invention: chocolate bullets for difficult days. Bite them bravely; they taste of courage and cocoa.'],
    ['on cloud nine', 'standing on the ninth cloud in a numbered sky', 'Invention: a numbered sky map so you always know which cloud you are on, and how far you have floated.'],
    ['head in the clouds', 'a person taller than weather', 'Art concept: a statue so tall its head disappears into fog, so nobody ever knows its expression.'],
    ['hold your horses', 'gripping several horses at once', 'Joke: She told me to hold my horses. I only have two hands and four horses.'],
    ['the ball is in your court', 'a ball sitting in your personal courtroom', 'Art concept: a tennis ball on trial, defending itself before a judge who keeps hitting it back.'],
    ['cold feet', 'toes that are chilly', 'Invention: wedding shoes with built-in heaters, to prevent last-minute hesitation.'],
    ['a penny for your thoughts', 'buying ideas for one cent', 'Invention: a vending machine that pays you a penny for every thought you speak into it, then sells them back as poems.'],
    ['beat around the bush', 'striking the area surrounding a shrub', 'Joke: Gardeners never beat around the bush. They go straight for it with shears.'],
    ['burn the midnight oil', 'lighting an oil lamp at twelve exactly', 'Art concept: an exhibition of lamps that each light themselves at midnight for one person who couldn\'t sleep.'],
    ['call it a day', 'naming the day', 'Observation: when we call it a day, we are naming time. Maybe the day was waiting all along to be called something.'],
    ['cut corners', 'snipping the corners off things', 'Invention: round paper, for people who cut corners and want to admit it.'],
    ['miss the boat', 'feeling nostalgic for a boat', 'Observation: to miss the boat is to long for it. Every missed chance is also a small love affair.'],
    ['pull your leg', 'tugging on a leg', 'Joke: He said he was only pulling my leg. That explains why I\'m now taller on one side.'],
    ['speak of the devil', 'discussing the devil', 'Joke: Every time we speak of the devil, he arrives. We have started speaking of the plumber instead.'],
    ['the last straw', 'the final drinking straw in the box', 'Invention: a smart straw box that politely warns you when you reach the last straw.'],
    ['go the extra mile', 'walking one additional mile', 'Invention: a treadmill that adds a surprise mile whenever you say “I\'m done”.'],
    ['sleep on it', 'lying down on a decision', 'Invention: a pillow with a notebook inside, for decisions that need to be slept on, literally.'],
    ['in hot water', 'sitting in a bath', 'Observation: being in hot water is sometimes just a bath you didn\'t plan. Relax your shoulders and look for the soap.'],
    ['food for thought', 'meals for your mind', 'Invention: a cookbook for ideas. Every recipe ends with “serve with a question”.'],
    ['heart of gold', 'a golden heart', 'Art concept: a heart cast in gold and left unlocked in a public square, to see what people do.'],
    ['change your mind', 'swapping one brain for another', 'Invention: a changing room for minds. Try on a new opinion; keep the receipt.'],
    ['make up your mind', 'applying cosmetics to your brain', 'Invention: mascara for thoughts, to make your best ideas look a little more dramatic.'],
    ['lose your mind', 'misplacing a brain', 'Invention: a lost-and-found office for minds, open Mondays, staffed by people who found theirs.'],
    ['catch a cold', 'chasing a chilly thing with a net', 'Art concept: a butterfly net in a frosty museum, labelled “For catching colds before they catch you”.'],
    ['kill time', 'a crime against the clock', 'Observation: we kill time and then wonder why it never comes back to visit.'],
    ['save time', 'putting time in the bank', 'Invention: a piggy bank for minutes. Shake it on a slow afternoon and spend what you saved.'],
    ['fall in love', 'tripping into love', 'Invention: a padded floor in public parks, for people who are about to fall in love.'],
    ['give me a hand', 'handing over a spare hand', 'Joke: I asked for a hand. They gave me a round of applause.'],
    ['keep an eye on', 'placing an eye on something to guard it', 'Art concept: a thousand painted eyes placed on things that matter, quietly keeping watch.'],
    ['lend me your ears', 'borrowing someone\'s ears', 'Invention: an ear-lending library. Borrow a pair of patient ears for up to two hours.'],
    ['take a seat', 'carrying a chair away', 'Joke: She told me to take a seat. I did. I\'m now being sued by the café.'],
    ['running late', 'jogging, but behind schedule', 'Invention: shoes that run late so you don\'t have to.'],
    ['the coast is clear', 'a transparent coastline', 'Art concept: a beach made of glass, where you can see every footprint ever made beneath the sand.'],
    ['shoot for the stars', 'firing at constellations', 'Invention: a gentle slingshot that launches wishes into the sky.'],
    ['my phone is dead', 'a phone that has passed away', 'Art concept: a tiny funeral for a phone, with a eulogy read from its last unread messages.'],
    ['i\'m starving', 'literal starvation, over a sandwich', 'Joke: “I\'m starving,” I said. My grandmother has been feeding me since 1997 because of it.'],
    ['good morning', 'a morning of good moral character', 'Observation: we wish people a good morning as though mornings could be persuaded to behave.'],
    ['how are you', 'asking a person what manner of creature they are', 'Observation: “How are you?” is the most profound question we ask without waiting for the answer.'],
    ['thank you', 'thanking a person named You', 'Joke: Every time I say “thank you”, somewhere a person called You feels very appreciated.'],
    ['what\'s up', 'enquiring about the sky', 'Joke: “What\'s up?” “The sky, mostly. Some birds. A plane.”'],
    ['see you later', 'a promise to look at someone in the future', 'Invention: a telescope that only points at people you said “see you later” to.'],
    ['i\'m lost', 'a person who is a lost item', 'Art concept: a lost-property office where the items are people, each with a tag reading where they were last happy.'],
    ['i\'m fine', 'a person who is a fine, as in a penalty', 'Joke: “I\'m fine.” “Great — that\'ll be forty dollars.”'],
    ['hello', 'a greeting that begins “hell” and ends “oh”', 'Observation: “hello” starts with a little hell and ends with a little wonder. Most first meetings do.'],
    ['no pain no gain', 'a strict no-pain, no-gain store policy', 'Invention: a gym sign that says “No Pain, No Gain, No Parking”.'],
    ['in a nutshell', 'living inside a nut', 'Invention: tiny living quarters inside a walnut, for summarisers who want to stay concise.'],
    ['over the moon', 'jumping over the moon', 'Invention: a trampoline rated for lunar clearance.'],
    ['out of the blue', 'emerging from the colour blue', 'Art concept: a blue canvas from which small surprising objects slowly emerge, one per week.']
  ];

  // Homophones: sound identical, spelled and meant differently.
  var HOMOPHONE_GROUPS = [
    'ate eight', 'bare bear', 'be bee', 'beach beech', 'beat beet', 'berry bury', 'billed build', 'blew blue', 'board bored',
    'brake break', 'bread bred', 'buy by bye', 'cell sell', 'cent scent sent', 'cereal serial', 'cheap cheep', 'chilly chili',
    'chord cord', 'cite sight site', 'coarse course', 'creak creek', 'dear deer', 'dew due', 'die dye', 'doe dough',
    'fair fare', 'feat feet', 'find fined', 'flea flee', 'flew flu', 'flour flower', 'for four fore', 'genes jeans',
    'grate great', 'groan grown', 'guessed guest', 'hair hare', 'hall haul', 'heal heel', 'hear here', 'heard herd',
    'higher hire', 'hole whole', 'hour our', 'idle idol', 'in inn', 'knead need', 'knew new', 'knight night', 'knit nit',
    'knot not', 'know no', 'knows nose', 'lead led', 'loan lone', 'made maid', 'mail male', 'main mane', 'meat meet',
    'medal meddle', 'mind mined', 'missed mist', 'moose mousse', 'morning mourning', 'muscle mussel', 'none nun',
    'oar or ore', 'one won', 'pail pale', 'pain pane', 'pair pear', 'passed past', 'pause paws', 'peace piece',
    'peak peek', 'plain plane', 'pole poll', 'pray prey', 'principal principle', 'rain reign rein', 'raise rays',
    'read reed', 'real reel', 'right rite write', 'ring wring', 'road rode', 'role roll', 'root route', 'rose rows',
    'sail sale', 'scene seen', 'sea see', 'seam seem', 'sew so sow', 'shoe shoo', 'sole soul', 'some sum', 'son sun',
    'stair stare', 'stake steak', 'stationary stationery', 'steal steel', 'suite sweet', 'tail tale', 'tea tee',
    'their there', 'threw through', 'throne thrown', 'tide tied', 'to too two', 'toe tow', 'vain vein', 'wait weight',
    'waist waste', 'wave waive', 'way weigh', 'weak week', 'wear where', 'weather whether', 'which witch', 'whine wine',
    'wood would', 'yoke yolk', 'you ewe', 'i eye aye', 'hi high', 'aisle isle', 'allowed aloud', 'altar alter',
    'bored board', 'cheetah cheater', 'colonel kernel', 'council counsel', 'dual duel', 'gorilla guerrilla',
    'hymn him', 'jam jamb', 'lessen lesson', 'links lynx', 'naval navel', 'pedal peddle', 'plum plumb', 'presence presents',
    'profit prophet', 'sighs size', 'tax tacks', 'thyme time', 'whirled world', 'wholly holy', 'ad add', 'cue queue',
    'ewe you', 'ball bawl', 'bean been', 'cache cash', 'carrot karat', 'ceiling sealing', 'choose chews', 'clause claws',
    'days daze', 'gnu knew new', 'hoarse horse', 'mussed must', 'nay neigh', 'packed pact', 'patience patients',
    'rapped wrapped', 'rest wrest', 'sun son', 'tense tents', 'whose who\'s', 'wail whale', 'wade weighed',
    'its it\'s', 'your you\'re', 'cents sense'
  ];

  // Hand-picked near-misses: similar but not identical sounds.
  var NEAR = {
    love: ['glove', 'dove', 'loaf'], heart: ['art', 'hurt', 'tart'], mind: ['mine', 'wind', 'mint'], time: ['dime', 'lime', 'thyme'],
    world: ['word', 'whirled', 'curled'], life: ['knife', 'wife', 'lift'], dream: ['cream', 'steam', 'stream'],
    brain: ['rain', 'train', 'drain'], money: ['honey', 'monkey', 'bunny'], work: ['walk', 'cork', 'quirk'],
    home: ['comb', 'gnome', 'foam'], light: ['kite', 'bite', 'lite'], computer: ['commuter', 'compute her', 'come pewter'],
    phone: ['foam', 'bone', 'fun'], coffee: ['toffee', 'cough fee', 'coffin'], happy: ['hoppy', 'snappy', 'hippie'],
    war: ['wore', 'roar', 'jar'], truth: ['tooth', 'booth', 'truce'], god: ['cod', 'nod', 'goad'],
    friend: ['fried', 'fiend', 'frond'], house: ['mouse', 'grouse', 'blouse'], car: ['jar', 'star', 'cart'],
    dog: ['fog', 'log', 'jog'], cat: ['hat', 'bat', 'cap'], book: ['hook', 'cook', 'brook'], school: ['stool', 'pool', 'skull'],
    teacher: ['preacher', 'feature', 'cheetah'], doctor: ['docker', 'dock tour', 'doc tour'], water: ['daughter', 'otter', 'waiter'],
    moon: ['spoon', 'noon', 'tune'], star: ['jar', 'scar', 'tsar'], sky: ['spy', 'guy', 'ski'], tree: ['three', 'free', 'tea'],
    snow: ['crow', 'snore', 'show'], fire: ['tire', 'choir', 'friar'], window: ['widow', 'minnow', 'wind owe'],
    door: ['drawer', 'roar', 'dough'], table: ['fable', 'cable', 'stable'], chair: ['cheer', 'hair', 'share'],
    bed: ['bread', 'head', 'bad'], food: ['feud', 'mood', 'flood'], cheese: ['chess', 'keys', 'cheeks'],
    hello: ['yellow', 'jello', 'hollow'], tomorrow: ['to borrow', 'sorrow', 'tomato'], today: ['to day', 'toupee', 'two day'],
    please: ['peas', 'fleas', 'pleats'], thank: ['tank', 'think', 'thong'], question: ['quest shun', 'suggestion', 'quench'],
    answer: ['and sir', 'cancer', 'dancer'], problem: ['pro bloom', 'probe lamb', 'pebble'], meaning: ['leaning', 'gleaning', 'meandering'],
    listen: ['glisten', 'lessen', 'lissom'], speak: ['peak', 'beak', 'sneak'], talk: ['chalk', 'torque', 'stalk'],
    word: ['bird', 'herd', 'nerd'], sound: ['hound', 'round', 'mound'], voice: ['choice', 'moist', 'vice'],
    human: ['humid', 'humane', 'hue man'], machine: ['marine', 'ma sheen', 'magazine'], robot: ['rabbit', 'row bought', 'rowboat'],
    story: ['storey', 'glory', 'stormy'], dinner: ['thinner', 'winner', 'diner'], lunch: ['launch', 'hunch', 'munch'],
    garden: ['pardon', 'guardian', 'garter'], plant: ['planet', 'pant', 'slant'], cloud: ['clown', 'crowd', 'clout'],
    ocean: ['motion', 'lotion', 'potion'], mountain: ['fountain', 'mount ten', 'mounting'], river: ['liver', 'shiver', 'giver'],
    city: ['pity', 'kitty', 'gritty'], travel: ['gravel', 'unravel', 'trouble'], boss: ['moss', 'sauce', 'floss'],
    job: ['jog', 'blob', 'jab'], minute: ['my newt', 'minuet', 'minnow'], second: ['sec and', 'secant', 'beckoned'],
    year: ['ear', 'beer', 'yarn'], birthday: ['earth day', 'bath day', 'third day'], party: ['hearty', 'parity', 'parting'],
    game: ['gain', 'frame', 'gem'], play: ['clay', 'pray', 'plea'], team: ['steam', 'theme', 'tame'], win: ['wind', 'wing', 'twin'],
    lose: ['loose', 'shoes', 'blues'], learn: ['fern', 'yearn', 'lantern'], think: ['sink', 'zinc', 'ink'],
    hope: ['soap', 'rope', 'hop'], fear: ['beer', 'pier', 'fur'], sad: ['sod', 'salad', 'shed'], angry: ['hungry', 'anchory', 'angle'],
    hungry: ['angry', 'hung tree', 'hunky'], tired: ['tide', 'tiled', 'tyred'], cook: ['crook', 'hook', 'kook'],
    eat: ['heat', 'wheat', 'eel'], drink: ['shrink', 'drank', 'brink'], music: ['muse sick', 'mosaic', 'magic'],
    idea: ['ida', 'eye deer', 'odea'], future: ['few chair', 'feature', 'fuse jar'], peace: ['geese', 'fleece', 'pizza'],
    soul: ['bowl', 'mole', 'stole'], art: ['cart', 'tart', 'earth'], family: ['fame alley', 'famine', 'flannelly'],
    walk: ['wok', 'woke', 'chalk'], flower: ['power', 'shower', 'tower'], beautiful: ['bootiful', 'beauty full', 'dutiful'],
    wonderful: ['wander full', 'thunderful', 'wondrous'], amazing: ['a maze in', 'grazing', 'amusing'],
    interesting: ['in arresting', 'interest ink', 'entering'], important: ['impotent', 'in portent', 'imported'],
    weather: ['feather', 'leather', 'whether'], morning: ['warning', 'mourning', 'moaning'], night: ['knight', 'kite', 'nut'],
    condition: ['conniption', 'confection', 'ignition'], recognize: ['wreck a nice', 'reckon eyes', 'record eyes'],
    speech: ['beach', 'peach', 'speck'], memory: ['emery', 'melody', 'member'], science: ['silence', 'sigh ants', 'sciences'],
    nature: ['natter', 'nation', 'neighbour'], universe: ['unit verse', 'you nerve us', 'universal'],
    freedom: ['free dumb', 'free dome', 'three doom'], democracy: ['demo crazy', 'demon crazy', 'demolishing'],
    internet: ['inner net', 'in a net', 'intern net'], email: ['he-mail', 'e-meal', 'easel'], meeting: ['meat thing', 'eating', 'heating'],
    office: ['offish', 'awful fizz', 'orifice'], baby: ['maybe', 'gravy', 'bay bee'], mother: ['smother', 'other', 'mutter'],
    father: ['farther', 'feather', 'lather'], brother: ['bother', 'brothel', 'bubble'], sister: ['blister', 'mister', 'sitter'],
    kitchen: ['chicken', 'kitten', 'kitsch in'], bathroom: ['bad moon', 'bath room', 'ballroom'], money2: [],
    smile: ['mile', 'smell', 'style'], laugh: ['calf', 'half', 'giraffe'], cry: ['fry', 'crow', 'pry'],
    happiness: ['happy nest', 'hoppiness', 'hap in ess'], sorry: ['sari', 'lorry', 'starry'], okay: ['oh kay', 'croquet', 'bouquet'],
    yes: ['yeast', 'chess', 'mess'], maybe: ['baby', 'may bee', 'gravy'], never: ['clever', 'lever', 'nephew'],
    always: ['all ways', 'hallways', 'alleys'], sometimes: ['some thymes', 'some dimes', 'summertimes'],
    everything: ['every thing', 'everyday thing', 'ever thin'], something: ['some thing', 'sum thing', 'sun thing'],
    nobody: ['no body', 'knobby', 'snowbody'], somebody: ['some body', 'sun body', 'slumber'],
    guitar: ['git tar', 'guitarist', 'catarrh'], piano: ['piano', 'pee and oh', 'pie in o'], banana: ['bandana', 'bahama', 'ban nana'],
    potato: ['pot tattoo', 'tomato', 'potter'], tomato: ['tornado', 'tom ate oh', 'potato'], chocolate: ['chalk a late', 'chock a lot', 'choke a lot'],
    pizza: ['pisa', 'peter', 'piece of'], sandwich: ['sand witch', 'sandy which', 'sand wish'], rainbow: ['rain beau', 'reign bow', 'rain boat'],
    dragon: ['wagon', 'drag on', 'flagon'], monster: ['lobster', 'munster', 'mobster'], king: ['kin', 'kink', 'wing'], queen: ['clean', 'cream', 'green'],
    cake: ['lake', 'snake', 'rake'], bike: ['pike', 'hike', 'like'], train: ['rain', 'brain', 'strain'], boat: ['goat', 'coat', 'vote'],
    plane: ['plan', 'plain', 'planet'], ship: ['sheep', 'chip', 'shop'], fish: ['wish', 'dish', 'fizz'], bird: ['word', 'bud', 'beard'],
    horse: ['hoarse', 'course', 'remorse'], keys: ['cheese', 'knees', 'peas'], nice: ['mice', 'rice', 'ice'],
    need: ['knead', 'seed', 'weed'], genius: ['genie us', 'venus', 'gene yes'], where: ['wear', 'hair', 'air'],
    help: ['kelp', 'yelp', 'whelp'], call: ['crawl', 'cool', 'coal'], go: ['glow', 'goat', 'gecko'], stop: ['shop', 'mop', 'stomp'], cow: ['now', 'cowl', 'cower'], pig: ['wig', 'big', 'fig'], duck: ['luck', 'truck', 'deck']
  };
  delete NEAR.money2;

  // Words with two unrelated meanings (combining unrelated meanings).
  var DOUBLE = {
    bank: ['a place that keeps money', 'the side of a river'], bark: ['the sound a dog makes', 'the skin of a tree'],
    bat: ['a flying mammal', 'a stick for hitting balls'], bear: ['a large furry animal', 'to carry or tolerate'],
    bow: ['a ribbon knot', 'bending at the waist'], current: ['happening now', 'a flow of water or electricity'],
    date: ['a day on the calendar', 'a sweet fruit'], fair: ['just and even-handed', 'a carnival'], fan: ['an admirer', 'a cooling device'],
    file: ['a document', 'a tool for smoothing nails'], fine: ['all right', 'a penalty payment'], fire: ['flames', 'dismissal from a job'],
    foot: ['the end of a leg', 'twelve inches'], interest: ['curiosity', 'money a loan earns'], jam: ['fruit preserve', 'a traffic tangle'],
    key: ['a thing that opens locks', 'a musical scale'], light: ['brightness', 'not heavy'], match: ['a small fire stick', 'a sports game'],
    mean: ['unkind', 'average'], mine: ['belonging to me', 'a hole for digging coal'], note: ['a short message', 'a musical sound'],
    novel: ['a long book', 'new and original'], palm: ['the inside of a hand', 'a tropical tree'], park: ['a green public space', 'to leave a car'],
    pitch: ['a musical tone', 'a sales speech'], plant: ['a growing green thing', 'a factory'], play: ['to have fun', 'a theatre show'],
    point: ['a sharp tip', 'the main idea'], pupil: ['a student', 'the black centre of an eye'], ring: ['jewellery for a finger', 'the sound of a bell'],
    rock: ['a stone', 'a style of music'], rose: ['a flower', 'went up'], row: ['a line of things', 'a noisy argument'],
    ruler: ['a measuring stick', 'a monarch'], saw: ['a cutting tool', 'having seen'], scale: ['a weighing machine', 'a fish skin plate'],
    seal: ['a sea mammal', 'a stamp of approval'], sentence: ['a line of words', 'a prison term'], sink: ['a wash basin', 'to go under'],
    spring: ['a season', 'a coiled bouncy wire'], star: ['a sun in space', 'a famous person'], state: ['a condition', 'a region of a country'],
    stick: ['a twig', 'to adhere'], table: ['furniture', 'a grid of data'], tie: ['a neck garment', 'an equal score'],
    train: ['a railway vehicle', 'to practise'], trip: ['a journey', 'to stumble'], watch: ['a wrist clock', 'to look at'],
    wave: ['ocean water rising', 'a hand greeting'], well: ['in good health', 'a deep water hole'], yard: ['a garden', 'three feet'],
    cell: ['a prison room', 'a unit of life'], cloud: ['weather vapour', 'online storage'], mouse: ['a small rodent', 'a computer pointer'],
    crane: ['a tall bird', 'a construction machine'], organ: ['a body part', 'a musical instrument'], spirit: ['a ghost', 'a strong drink'],
    bug: ['an insect', 'a software error'], chip: ['a fried potato', 'a computer processor'], crown: ['a royal hat', 'the top of a tooth'],
    draft: ['a rough version', 'a cold breeze'], letter: ['an alphabet symbol', 'a posted message'], record: ['a vinyl disc', 'the best ever result'],
    tire: ['to grow weary', 'a car wheel'], nail: ['a fingertip covering', 'a metal spike'], pen: ['a writing tool', 'an animal enclosure'],
    pound: ['a unit of weight', 'to hit repeatedly'], punch: ['a hit with a fist', 'a fruity party drink'], race: ['a competition', 'a group of people'],
    season: ['a time of year', 'to add salt and pepper'], space: ['the cosmos', 'an empty gap'], stamp: ['postage', 'to stomp'],
    strike: ['a hit', 'a work stoppage'], suit: ['formal clothes', 'a lawsuit'], swallow: ['to gulp', 'a small bird'],
    tear: ['a drop from an eye', 'to rip'], temple: ['a place of worship', 'the side of the head'], tip: ['a pointy end', 'extra money for service'],
    trunk: ['an elephant nose', 'the boot of a car'], change: ['to become different', 'coins in your pocket'], charge: ['to rush forward', 'to refill a battery'],
    check: ['to verify', 'a restaurant bill'], club: ['a social group', 'a heavy stick'], court: ['a tennis area', 'a law room'],
    fly: ['to soar', 'a buzzing insect'], glasses: ['spectacles', 'drinking cups'], iron: ['a metal', 'a clothes presser'],
    kind: ['caring', 'a type of something'], leaves: ['parts of a tree', 'goes away'], left: ['opposite of right', 'departed'],
    lie: ['an untruth', 'to recline'], line: ['a straight mark', 'a queue'], march: ['a month', 'to walk in step'],
    present: ['a gift', 'right now'], press: ['to push', 'newspapers'], patient: ['calm while waiting', 'a person in hospital'],
    power: ['strength', 'electricity'], ground: ['the earth', 'crushed fine'], second: ['after the first', 'a tiny bit of time'],
    minute: ['sixty seconds', 'tiny'], wind: ['moving air', 'to turn a key'], last: ['final', 'to endure'], right: ['correct', 'opposite of left'],
    sole: ['the bottom of a shoe', 'only'], hand: ['the end of an arm', 'a round of applause'], face: ['the front of a head', 'to confront'],
    head: ['the top of a body', 'a leader'], heart: ['an organ that pumps blood', 'the centre of something'], mind: ['the thinking self', 'to object'],
    time: ['the passing of hours', 'a musical rhythm'], word: ['a unit of language', 'a promise'], speech: ['spoken words', 'a formal address'],
    condition: ['a state of being', 'a requirement in a contract'], human: ['a person', 'kind and forgiving'], beach: ['sandy shore', 'to run aground'],
    sound: ['noise', 'healthy and solid'], book: ['a bound story', 'to reserve'], dream: ['a sleep vision', 'an ambition'],
    work: ['a job', 'a piece of art'], game: ['something played', 'wild animals hunted for food'], water: ['a liquid', 'to give plants a drink'],
    coffee: ['a drink', 'a brown colour'], phone: ['a device', 'a unit of sound in linguistics'], home: ['a dwelling', 'the base in baseball'],
    sky: ['the heavens', 'to hit a ball very high'], tree: ['a woody plant', 'a family diagram'], moon: ['the night light', 'to daydream'],
    star2: []
  };
  delete DOUBLE.star2;

  // A vocabulary for phonetic search and re-dividing words. Short, vivid words.
  var VOCAB = (
    'a i an am at as be by do go he if in is it me my no of oh on or ox so to up us we ' +
    'ace act add age ago aid aim air ale all and ant any ape arc are ark arm art ash ask ate awe axe bad bag ban bar bat bay bed bee beg bet bib bid big bin bit bow box boy bud bug bun bus but buy cab can cap car cat cod cog cow cry cub cup cut dam day den dew did die dig dim dip doe dog dot dry due dug dye ear eat eel egg ego elf elk elm end era eve eye fad fan far fat fax fed fee few fig fin fir fit fix fly foe fog for fox fry fun fur gag gap gas gel gem get gig gin gnu god got gum gun gut guy gym had ham has hat hay hem hen her hew hid him hip his hit hog hop hot how hub hue hug hum hut ice icy ill ink inn ion ire irk its ivy jab jam jar jaw jay jet jig job jog joy jug keg ken key kid kin kit lab lad lag lap law lay led leg let lid lie lip lit log lot low mad man map mat may men met mix mob mop mud mug nag nap net new nib nil nip nit nod nor not now nun nut oak oar oat odd off oil old one opt orb ore our out owe owl own pad pal pan par pat paw pay pea peg pen pep pet pie pig pin pit ply pod pop pot pro pry pub pun pup put rag ram ran rap rat raw ray red rib rid rig rim rip rob rod roe rot row rub rug rum run rut rye sad sag sap sat saw say sea see set sew she shy sin sip sir sit six ski sky sly sob sod son soy spa spy sty sub sue sum sun tab tag tan tap tar tea tee ten the tie tin tip toe ton too top toy try tub tug two urn use van vat vet vow wag war was wax way web wed wet who why wig win wit woe wok won woo wow yak yam yap yes yet yew you zap zen zip zoo ' +
    'able ache acre aged also arch area army atom aunt away axle baby back bake bald ball band bank bare bark barn base bath bead beak beam bean bear beat beef been beer beet bell belt bend best bike bill bird bite blue blur boat body boil bold bolt bomb bond bone book boom boot bore born boss both bowl brag bran brew brim bulb bull bump bunk burn bush busy cafe cage cake calf call calm came camp cane cape card care cart case cash cast cave cell chat chef chin chip chop city clam clap claw clay clip clog club clue coal coat code coil coin cold colt comb cone cook cool cope copy cord core cork corn cost cosy crab crew crow cube cult curb cure curl dame damp dare dark dart dash data dawn dead deaf deal dear debt deck deep deer desk dial dice diet dine dirt disc dish dive dock doll dome done doom door dose dove down doze drag draw drip drop drum duck duel dull dune dusk dust duty each earl earn ease east easy echo edge else envy epic even ever evil exam exit face fact fade fail fair fake fall fame fang farm fast fate fawn fear feat feed feel feet fell felt fern file fill film find fine fire firm fish fist five flag flap flat flaw flea flew flip flow foam foil fold folk fond font food fool foot fork form fort foul four fowl free frog from fuel full fume fuse fuss gain gale game gang gate gave gaze gear germ gift gill girl give glad glee glow glue gnat gnaw goal goat gold golf gone good gown grab gray grew grey grid grim grin grip grit grow gulf gull gust hail hair half hall halo halt hand hang hard hare harm harp hash hate haul have hawk haze head heal heap hear heat heel held hell helm help herb herd here hero hide high hike hill hint hire hive hold hole holy home hood hook hoop hope horn hose host hour huge hull hung hunt hurt hush hymn icon idea idle inch iron isle item jail jazz jeep jest joke jolt jump june jury just keen keep kelp kept kick kill kind king kiss kite knee knew knit knob knot know lace lack lady laid lake lamb lamp land lane lard lark last late lava lawn lazy lead leaf leak lean leap left lend lens less liar lice lick life lift like lime limp line link lint lion list live load loaf loan lock loft lone long look loop lord lose loss lost loud love luck lump lung lure lush mail main make male mall malt mane many mare mark mask mass mast mate math maze meal mean meat meek meet melt menu mere mesh mess mice mild mile milk mill mime mind mine mint mist mitt moan moat mock mode mole monk mood moon moor more moss most moth move much mule muse mush must mute nail name navy near neat neck need nest news newt next nice nine node none noon norm nose note noun oath obey odor once only onto open oven over pace pack page paid pail pain pair pale palm pane park part pass past path peak pear peel peer pest pick pier pike pile pill pine pink pint pipe plan play plea plot plow plug plum poem poet pole poll pond pony pool poor pore pork port pose post pour pray prey prop pull pulp pump pure push quit quiz race rack raft rage raid rail rain rake ramp rang rank rare rash rate read real reap rear reed reef reel rent rest rice rich ride rind ring riot rise risk road roam roar robe rock rode role roll roof room root rope rose ruby rude ruin rule rush rust sack safe saga sage said sail sale salt same sand sane sang sash save scar seal seam seat seed seek seem seen self sell send sent shed ship shoe shop shot show shut sick side sigh sign silk sing sink site size skin skip slab sled slim slip slot slow slug snap snow soak soap soar sock soda sofa soft soil sold sole some song soon soot sore sort soul soup sour span spin spot spun stab star stay stem step stew stir stop such suit sung sunk sure surf swan swap sway swim tail take tale talk tall tame tank tape task taxi team tear tell tend tent term test text than that thaw then they thin this thud tick tide tidy tile till time tiny tire toad toil told toll tomb tone took tool torn toss tour town tray tree trim trip true tube tuck tuna tune turf turn twin type ugly undo unit upon urge used vain vase vast veil vein verb very vest veto view vine void vote wade wage wail wait wake walk wall wand want ward warm warn wart wash wasp wave wavy weak wear weed week well went were west what when whim whip wide wife wild will wilt wind wine wing wink wipe wire wise wish with woke wolf womb wood wool word wore work worm worn wrap wren yard yarn yawn year yell yoga yolk your zero zone zoom ' +
    'about above actor adore adult after again agent alarm album alien alive alley alone along alter amber angel anger angle angry ankle apple apron arena argue arise armor aroma arrow aside atlas attic award awful bacon badge bagel baker basin beach beard beast begin being bell belly bench berry bible bingo birth black blade blame blank blast blaze bleak blend bless blind blink bliss block bloom blown blues bluff blunt blush board boast bonus boost booth bored bough brain brake brand brass brave bread break bream brick bride brief bring brink brisk broom broth brown brush buddy build bunch bunny burst cabin cable camel candy canoe cargo carol carry carve catch cause cease chain chair chalk champ charm chart chase cheap cheat check cheek cheer chess chest chick chief child chill chime choir chord chunk cider cigar civic claim clamp clash class clean clear clerk click cliff climb cloak clock close cloth cloud clown coach coast cobra cocoa comet comic coral couch cough count court cover crack craft crane crash crate crawl crazy cream creek creep crisp crowd crown crude cruel crumb crush crust cubic curve cycle daily dairy daisy dance dated dealt death debut decay decoy delay delta demon dense depth devil diary diner disco ditch diver dizzy dodge donor donut doubt dough dozen draft drain drake drama drank dread dream dress dried drift drill drink drive drone drown dwarf eager eagle early earth easel eaten ebony eight elbow elder elect elite elope empty enemy enjoy entry equal error essay event every exact exist extra fable faint fairy faith false fancy feast fence ferry fever fiber field fiery fifth fight final flame flash fleet flesh flint float flock flood floor flour fluid flute focus force forge forth forum found frame fraud freak fresh fried front frost froze fruit fudge funny gauge ghost giant given glass gleam glide globe gloom glory glove gnome goose grace grade grain grand grant grape graph grasp grass grave gravy great greed green greet grief grill groan groom gross group grove growl guard guess guest guide guilt habit hairy happy hardy harsh haste hatch haunt haven heart heavy hedge hello hippo hobby honey honor horse hotel hound house human humid humor hurry ideal igloo image inner input irony issue ivory jelly jewel joint jolly judge juice jumbo kayak kebab kneel knife knock koala label labor laser latch later laugh layer learn lease leash least leave ledge lemon level lever light lilac limit linen liver llama lobby local lodge logic loose lotus lover lower loyal lucky lunar lunch lunge lyric magic major maker mango manor maple march marry marsh match mayor medal media melon mercy merit merry metal meter might mimic minor mirth mixer model moist money month moose moral motor motto mound mount mourn mouse mouth movie muddy mural music naive nanny nasty nerve never niece night ninja noble noise north notch novel nurse nylon oasis ocean offer often olive onion opera orbit order organ otter ought ounce outer owner oxide ozone paint panda panel panic paper party pasta paste patch pause peace peach pearl pedal penny perch peril petal phase phone photo piano piece pilot pinch pizza place plain plane plant plate plaza plead pluck plumb plume plump plush poach point poise polar porch pouch pound power press price pride prime print prism prize probe proof proud prune pulse punch pupil puppy purse quack queen query quest queue quick quiet quilt quirk quote radar radio raise rally ranch range rapid raven razor reach react ready realm rebel reign relax relay remix reply rider ridge rifle right rigid rinse ripen risky rival river roast robin robot rocky rogue roman roost rough round route royal ruler rumor rural rusty saint salad salon salsa sandy sauce sauna scale scarf scene scent scone scoop scope score scout scrap scrub sense serve seven shade shake shame shape share shark sharp shave shawl sheep sheet shelf shell shift shine shirt shock shore short shout shrub siege sight silky silly since siren skate skill skirt skull skunk slate sleep slice slide slope sloth small smart smell smile smoke snack snail snake sneak sniff snore solar solid sound south space spade spare spark speak spear speed spell spend spice spider spike spill spine spoon sport spray squad squid stack staff stage stain stair stake stale stalk stamp stand stare start state steak steal steam steel steep stick still sting stink stock stone stool storm story stove straw stray strip stuck study stuff style sugar suite sunny super swamp swarm sweat sweep sweet swell swift swing sword syrup table taste teach teeth tempo tense thank theme thick thief thing think thorn three throw thumb tiger timer tired toast today token tooth topic torch total touch towel tower toxic trace track trade trail train trait tramp trash tread treat trend trial tribe trick troll truck truly trunk trust truth tulip tumor twist ultra uncle under union unity upper upset urban usual vague valid value valve vapor vault venom verse video villa vinyl viola viper virus visit vital vivid vocal voice wagon waist waltz waste watch water weary weave wedge weird whale wheat wheel while whirl whisk white whole widow width witch woman world worry worth would wound wreck wrist write wrong yacht yeast yield young youth zebra ' +
    'action advice almond animal answer anchor apron artist autumn badger ballet banana bandit barrel basket beacon beaver beetle bishop blanket bottle branch breeze bridge bright bubble bucket budget butter button camera candle carpet carrot castle cattle cellar cement cereal chance change chapel cherry chosen church circle circus clever closet clover coffee collar comedy cookie copper cotton cousin coward cradle crayon cruise cursor custom dancer dazzle decade desert design detail dinner doctor dollar donkey dragon drawer dreamy effort eleven empire engine escape ethics fabric factor falcon family famous farmer father fellow fender fiddle figure finger forest fossil friend frozen future galaxy garage garden garlic ginger giraffe glider goblin gospel gravel guitar hammer handle harbor hazard health helmet hermit hiccup honest hornet hunger hunter hurdle insect island jacket jigsaw jingle jockey jungle kennel kettle kidney kitten ladder legend lemony lesson letter lizard locket lumber magnet mammal manner marble market meadow memory mentor mirror misery mitten modern moment monkey mother motion muffin museum muzzle napkin narrow nature needle nephew noodle normal number object orange oyster paddle palace parade parcel parrot pastry pebble pencil people pepper person pickle pigeon pillow pirate planet pocket poetry potato powder prince prison puddle puppet puzzle rabbit racket ribbon riddle rocket rodent rubber saddle salmon sample saucer scheme school season secret shadow shovel signal silver singer sister sketch slogan socket spirit sponge spring square statue stream street string studio summer sunset supper symbol tablet talent tangle teapot temple tennis thread throne ticket timber tomato tongue toucan travel trophy tunnel turkey turtle velvet violin voyage waffle walnut wander window winter wisdom wizard wonder yellow zipper ' +
    'balloon bicycle blossom boredom breakfast brother cabbage captain caramel cartoon ceiling chicken chimney comfort compass concert courage cowboy cupcake curtain diamond dolphin elephant evening fantasy feather festival firefly fortune freedom gallery giggle glacier gorilla granite harmony harvest history holiday horizon iceberg imagine jasmine journey justice kingdom kitchen lantern laughter library machine mailbox mammoth mansion meaning midnight miracle mistake monster morning mustard mystery nothing octopus orchard ostrich painter pancake panther parsley passion peanut pelican penguin picnic pilgrim popcorn pudding pumpkin pyramid rainbow recipe reindeer rhubarb science seaweed shelter silence soldier spaghetti squirrel stomach stranger sunlight surgeon sweater teacher theater thunder tornado trumpet umbrella unicorn vampire vanilla volcano whisper whistle'
  ).split(/\s+/).filter(Boolean);

  var STOP = toSet('a an the of to in on at by for and or but is are was were be been am i you he she it we they me my your his her its our their this that these those with as from so do does did not no yes just very');

  // ---------------------------------------------------------------------------
  // Creative templates. Placeholders:
  //   {orig} original phrase  {alt} misheard phrase  {Alt} capitalised  {Title} Title Case
  //   {a} the original word(s)  {b} the misheard word(s)  {aA}/{bA} with "a"/"an"
  //   {A}/{B} capitalised words
  // "short: true" templates are only used when {a} and {b} are short.
  // ---------------------------------------------------------------------------
  var TEMPLATES = {
    invention: [
      { t: 'Invention: {Title}. A kitchen appliance that turns every {a} into {bA}. Early testers say it works perfectly, but only on Tuesdays.', short: true },
      { t: 'Invention: the {B} Detector, a wristband that vibrates gently whenever someone nearby says “{a}” but secretly means “{b}”.', short: true },
      { t: 'Invention: a subscription box called “{Title}”. Each month you receive one {b} and a handwritten note explaining why it was supposed to be {aA}.', short: true },
      { t: 'Invention: a doorbell that announces “{Alt}” instead of ringing. Guests arrive already confused, which saves time.' },
      { t: 'Invention: the {Title} app. Point your phone at anything that reminds you of {a}, and it shows you the nearest {b}.', short: true },
      { t: 'Invention: noise-cancelling headphones that cancel only the word “{a}” and let “{b}” through.', short: true },
      { t: 'Invention: a museum audio guide that describes every painting as “{alt}”. Attendance doubles. Understanding stays exactly the same.' },
      { t: 'Invention: “{Title}”, a board game where players must convince each other they said “{orig}” when everyone clearly heard “{alt}”.' },
      { t: 'Invention: a thermostat with three settings: {a}, {b}, and whatever you actually meant.', short: true },
      { t: 'Invention: {Title} Bakery. Every pastry is shaped like {bA} and tastes faintly of {a}.', short: true },
      { t: 'Invention: an umbrella that only opens when someone nearby says “{alt}”. Weather forecasts now include a pronunciation guide.' },
      { t: 'Invention: a GPS voice that gives directions entirely in misunderstandings. “In two hundred feet, {alt}.”' },
      { t: 'Invention: a self-correcting dictionary. The entry for “{a}” says: see “{b}”. The entry for “{b}” says: you were right the first time.', short: true },
      { t: 'Invention: the {Title} 3000, a pocket gadget that does exactly what its name suggests — nobody is sure what that is, which is why it sells so well.' },
      { t: 'Invention: a translation earpiece that translates English into slightly different English. You say “{orig}”; your listener hears “{alt}”; friendships deepen.' }
    ],
    observation: [
      { t: 'Observation: “{orig}” and “{alt}” are separated by a sound smaller than a breath. Perhaps most of what we disagree about lives in that gap.' },
      { t: 'Observation: we hear what we are ready to hear. Someone, somewhere, needed “{alt}” today more than they needed “{orig}”.' },
      { t: 'Observation: {aA} is only {bA} that somebody listened to too carefully.', short: true },
      { t: 'Observation: if “{alt}” is a mistake, it is a mistake with its own furniture, its own weather, and its own reasons to exist.' },
      { t: 'Observation: the ear is not a microphone; it is a storyteller. Given “{orig}”, it quietly drafted “{alt}” as a second opinion.' },
      { t: 'Observation: every word is a door with two handles. Grab “{a}” and you might walk into “{b}”.', short: true },
      { t: 'Observation: language works because we agree to ignore the other meanings. “{Alt}” is simply what we stopped ignoring.' },
      { t: 'Observation: maybe {b} is just what {a} looks like from the other side of the room.', short: true },
      { t: 'Observation: “{Orig}” is what was said. “{Alt}” is what was possible.' },
      { t: 'Observation: the distance from {a} to {b} is one sound. The distance back is a whole new life.', short: true },
      { t: 'Observation: certainty is just a mishearing that nobody has corrected yet. “{Alt}” is honest about it.' },
      { t: 'Observation: a misunderstanding is a translation into a language nobody asked for — and yet, it is still a translation. “{Alt}” has a meaning; it is just not the one we ordered.' },
      { t: 'Observation: every sentence carries stowaways. “{Orig}” was carrying “{alt}” the whole time.' }
    ],
    joke: [
      { t: 'Joke: I asked for “{orig}”. They brought me “{alt}”. Honestly, best service I have ever had.' },
      { t: 'Joke: Doctor: “I\'m afraid you have {alt}.” Me: “Is it serious?” Doctor: “Only if you say it slowly.”' },
      { t: 'Joke: Why did the {a} go to therapy? Everyone kept calling it {bA}.', short: true },
      { t: 'Joke: My grandmother insists the phrase is “{alt}”. We stopped correcting her years ago. She has since been proven right twice.' },
      { t: 'Joke: I wrote “{orig}” on a birthday card. It arrived saying “{alt}”. The post office has developed a sense of humour.' },
      { t: 'Joke: {AA} and {bA} walk into a bar. The bartender squints and says, “Is this some kind of hearing test?”', short: true },
      { t: 'Joke: Autocorrect turned “{orig}” into “{alt}”. I have decided to live there now. The rent is reasonable.' },
      { t: 'Joke: Knock knock. Who\'s there? {A}. {A} who? {Alt}! …Sorry, the door is very thick.', short: true },
      { t: 'Joke: I told my smart speaker “{orig}”. It ordered “{alt}”. Delivery is Thursday.' },
      { t: 'Joke: I\'m not saying I misheard you, but I\'ve already printed the “{Alt}” T-shirts.' },
      { t: 'Joke: The sign at the hearing clinic says “{Alt}”. Nobody has complained, because nobody can agree what it says.' },
      { t: 'Joke: My therapist said I keep hearing {b} when people say {a}. I said, “Thank you, that\'s very {b} of you.”', short: true }
    ],
    art: [
      { t: 'Art concept: a gallery of empty frames, each labelled “{alt}”. Visitors are asked to remember what “{orig}” looked like.' },
      { t: 'Poem:\n  I said “{orig}”,\n  the air said “{alt}”,\n  and somewhere in between us\n  a new thing learned to sing.' },
      { t: 'Art concept: one choir sings “{orig}” very slowly while a second choir sings “{alt}”. The audience leaves humming a third thing nobody wrote.' },
      { t: 'Art concept: a sculpture of {bA} made entirely out of {a}.', short: true },
      { t: 'Art concept: a photograph series titled “{Alt}”. Every picture shows something ordinary, captioned as though it were astonishing.' },
      { t: 'Poem:\n  Not {a}, but {b}.\n  Not what I meant,\n  but what I needed.\n  The ear forgives what the mouth forgets.', short: true },
      { t: 'Art concept: a mural in two halves — one painted only with things that mean “{a}”, one with things that mean “{b}”. Where they meet, a door.', short: true },
      { t: 'Art concept: a radio play in which two lovers fall out over “{orig}” versus “{alt}”, then make up when they realise they meant the same thing.' },
      { t: 'Art concept: a cookbook in which every recipe is called “{Alt}” and no two taste alike.' },
      { t: 'Poem:\n  {Alt} —\n  said nobody, ever,\n  until now.\n  Welcome, little stranger.' },
      { t: 'Art concept: a lullaby that begins as “{orig}” and, verse by verse, drifts into “{alt}”, so the listener falls asleep in one meaning and wakes in another.' },
      { t: 'Poem:\n  A {a} walked out one morning\n  and came home {bA}.\n  Its family hardly noticed.\n  That is how most of us change.', short: true }
    ]
  };

  var KIND_LABELS = { invention: 'Invention', observation: 'Philosophical observation', joke: 'Joke', art: 'Art concept or poem' };
  var KINDS = ['invention', 'observation', 'joke', 'art'];

  var METHOD_LABELS = {
    famous: 'Famous mishearing',
    homophone: 'Homophone',
    soundalike: 'Similar-sounding word',
    phonetic: 'Sound substitution',
    boundary: 'Shifted word boundary',
    literal: 'Taken literally',
    double: 'Double meaning combined',
    recogniser: "The computer's second guess",
    invention: 'Heard as an invention',
    combo: 'Double mishearing'
  };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function toSet(s) { var o = {}; s.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }

  function rng(seed) {
    var t = (seed >>> 0) || 1;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function normalize(phrase) {
    return String(phrase || '')
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[^a-z0-9' -]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function words(phrase) { return normalize(phrase).split(' ').filter(Boolean); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function titleCase(s) {
    var small = toSet('a an the of to in on at and or but for');
    return s.split(' ').map(function (w, i) { return i > 0 && small[w] ? w : cap(w); }).join(' ');
  }
  function article(w) {
    if (!w) return w;
    if (/^(a|an|the|some|my|your|his|her|our|their)\s/.test(w)) return w;
    return (/^[aeiou]/i.test(w) && !/^(uni|use|one|eu)/i.test(w)) || /^(hour|honest|honou?r)/i.test(w) ? 'an ' + w : 'a ' + w;
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  // A rough "how does it sound" key. Not real phonetics — just good enough to
  // find words that a tired ear might swap.
  function soundKey(word) {
    var w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return '';
    w = w.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^ps/, 's').replace(/^gn/, 'n').replace(/^x/, 's').replace(/^wh/, 'w');
    w = w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/tch/g, 'ch').replace(/dge/g, 'j').replace(/sch/g, 'sk')
      .replace(/igh/g, 'i').replace(/gh/g, '').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k')
      .replace(/x/g, 'ks').replace(/z/g, 's').replace(/tion/g, 'shn').replace(/sion/g, 'shn');
    if (w.length > 3) w = w.replace(/([^aeiou])e$/, '$1');
    w = w.replace(/(.)\1+/g, '$1');                 // collapse doubles
    w = w.replace(/y(?=[^aeiou]|$)/g, 'i');         // y as a vowel
    w = w.replace(/[aeiou]+/g, 'a');                // vowels blur together
    return w;
  }

  var VOCAB_SET = {};
  VOCAB.forEach(function (w) { VOCAB_SET[w] = true; });
  var VOCAB_KEYS = VOCAB.map(function (w) { return { w: w, k: soundKey(w) }; });

  var HOMO = {};
  HOMOPHONE_GROUPS.forEach(function (g) {
    var ws = g.split(' ');
    ws.forEach(function (w) {
      HOMO[w] = (HOMO[w] || []).concat(ws.filter(function (x) { return x !== w; }));
    });
  });

  function isVariantOf(a, b) {
    // plural / tense / tiny spelling variants are not interesting mishearings
    if (a === b) return true;
    var s = a.length < b.length ? a : b, l = a.length < b.length ? b : a;
    return l.indexOf(s) === 0 && l.length - s.length <= 2;
  }

  function replaceWords(ws, start, len, replacement) {
    return ws.slice(0, start).concat(replacement.split(' '), ws.slice(start + len)).join(' ');
  }

  // ---------------------------------------------------------------------------
  // Candidate generators — one per misunderstanding method
  // ---------------------------------------------------------------------------
  function findPhrase(ws, target) {
    var t = target.split(' ');
    for (var i = 0; i + t.length <= ws.length; i++) {
      var ok = true;
      for (var j = 0; j < t.length; j++) if (ws[i + j] !== t[j]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }

  function genFamous(ws) {
    var out = [];
    FAMOUS.forEach(function (e) {
      [[e[0], e[1]], [e[1], e[0]]].forEach(function (pair, dir) {
        var from = normalize(pair[0]), to = normalize(pair[1]);
        if (from === to) return;
        var at = findPhrase(ws, from);
        if (at < 0) return;
        out.push({
          method: 'famous', text: replaceWords(ws, at, from.split(' ').length, to), a: from, b: to,
          explanation: '“' + from + '” is famously misheard as “' + to + '”.',
          idea: dir === 0 ? e[2] : null, score: 10
        });
      });
    });
    return out;
  }

  function genLiteral(ws) {
    var out = [], joined = ws.join(' ');
    IDIOMS.forEach(function (e) {
      var id = normalize(e[0]);
      if ((' ' + joined + ' ').indexOf(' ' + id + ' ') < 0) return;
      out.push({
        method: 'literal', text: joined + ' (literally: ' + e[1] + ')', a: id, b: e[1],
        explanation: 'The familiar expression “' + id + '” taken completely literally: ' + e[1] + '.',
        idea: e[2], score: 9
      });
    });
    return out;
  }

  function genHomophones(ws) {
    var out = [];
    ws.forEach(function (w, i) {
      (HOMO[w] || []).forEach(function (h) {
        out.push({
          method: 'homophone', text: replaceWords(ws, i, 1, h), a: w, b: h,
          explanation: '“' + w + '” and “' + h + '” sound the same but mean different things.', score: 7
        });
      });
    });
    return out;
  }

  function genNear(ws) {
    var out = [];
    ws.forEach(function (w, i) {
      (NEAR[w] || []).forEach(function (n) {
        out.push({
          method: 'soundalike', text: replaceWords(ws, i, 1, n), a: w, b: n,
          explanation: '“' + w + '” sounds a lot like “' + n + '”.', score: 7
        });
      });
    });
    return out;
  }

  function genPhonetic(ws) {
    var out = [];
    ws.forEach(function (w, i) {
      if (w.length < 3 || STOP[w]) return;
      var k = soundKey(w), firstK = k.charAt(0);
      var matches = [];
      VOCAB_KEYS.forEach(function (v) {
        if (isVariantOf(v.w, w) || Math.abs(v.w.length - w.length) > 2) return;
        var d = levenshtein(k, v.k);
        if (d > (k.length <= 4 ? 1 : 2)) return;
        // keep the spelling close too, so the vowels and rhythm still match
        if (levenshtein(w, v.w) > Math.max(1, Math.floor(w.length * 0.4))) return;
        var s = 6 - d * 1.5 - Math.abs(v.w.length - w.length) * 0.3 + (v.k.charAt(0) === firstK ? 1 : 0) + (v.k.slice(-1) === k.slice(-1) ? 0.7 : 0);
        matches.push({ w: v.w, s: s });
      });
      matches.sort(function (x, y) { return y.s - x.s; });
      matches.slice(0, 6).forEach(function (m) {
        out.push({
          method: 'phonetic', text: replaceWords(ws, i, 1, m.w), a: w, b: m.w,
          explanation: 'Swapping one similar sound turns “' + w + '” into “' + m.w + '”.', score: m.s
        });
      });
    });
    return out;
  }

  // Split a run of letters into vocabulary words in every way possible (max 4 pieces).
  function segmentations(letters, maxPieces) {
    var results = [];
    (function walk(pos, acc) {
      if (results.length > 40) return;
      if (pos === letters.length) { results.push(acc.slice()); return; }
      if (acc.length >= maxPieces) return;
      for (var end = Math.min(letters.length, pos + 10); end > pos; end--) {
        var piece = letters.slice(pos, end);
        if (VOCAB_SET[piece] && (piece.length > 1 || piece === 'a' || piece === 'i')) {
          acc.push(piece); walk(end, acc); acc.pop();
        }
      }
    })(0, []);
    return results;
  }

  function genBoundary(ws) {
    var out = [];
    // Within one word, and across pairs of neighbouring words.
    for (var span = 1; span <= 2; span++) {
      for (var i = 0; i + span <= ws.length; i++) {
        var orig = ws.slice(i, i + span);
        var letters = orig.join('').replace(/[^a-z]/g, '');
        if (letters.length < 4) continue;
        segmentations(letters, 3).forEach(function (seg) {
          var alt = seg.join(' ');
          if (alt === orig.join(' ')) return;
          if (seg.length === 1 && span === 1) return;
          var tooChoppy = seg.filter(function (p) { return p.length <= 2; }).length;
          if (tooChoppy > 1) return;
          out.push({
            method: 'boundary', text: replaceWords(ws, i, span, alt), a: orig.join(' '), b: alt,
            explanation: 'Moving the gap between words turns “' + orig.join(' ') + '” into “' + alt + '”.',
            score: 6 + (seg.length === 1 ? 1.5 : 0) - tooChoppy - seg.length * 0.3
          });
        });
      }
    }
    // "a nice" <-> "an ice" style n-shifts, even when the result isn't in the vocabulary.
    for (var j = 0; j + 1 < ws.length; j++) {
      var w1 = ws[j], w2 = ws[j + 1];
      if (w1 === 'an' && w2.length > 2) addShift('a', 'n' + w2);
      if (w1 === 'a' && w2.charAt(0) === 'n' && w2.length > 2 && /^[aeiou]/.test(w2.charAt(1))) addShift('an', w2.slice(1));
    }
    function addShift(n1, n2) {
      var a = ws[j] + ' ' + ws[j + 1], b = n1 + ' ' + n2;
      out.push({ method: 'boundary', text: replaceWords(ws, j, 2, b), a: a, b: b,
        explanation: 'The “n” slides across the gap: “' + a + '” becomes “' + b + '”.', score: 7 });
    }
    return out;
  }

  function genDouble(ws) {
    var out = [];
    ws.forEach(function (w, i) {
      var senses = DOUBLE[w];
      if (!senses) return;
      out.push({
        method: 'double', text: replaceWords(ws, i, 1, w + ' (as in ' + senses[1] + ')'), a: senses[0], b: senses[1],
        explanation: '“' + w + '” can mean ' + senses[0] + ' or ' + senses[1] + '. This version hears both at once.',
        word: w, senses: senses, score: 6.5
      });
    });
    return out;
  }

  function genInvention(ws) {
    var phrase = ws.join(' ');
    var frames = [
      ['the ' + phrase + ' 3000', 'a gadget'],
      ['pocket ' + phrase, 'a portable device'],
      [phrase + ' deluxe', 'a luxury appliance'],
      ['the ' + phrase + ' machine', 'a machine']
    ];
    if (ws.length <= 3) frames.splice(3, 0, ["doctor " + ws[ws.length - 1] + "'s patented " + phrase + ' tonic', 'a suspicious medicine']);
    return frames.map(function (f, i) {
      return {
        method: 'invention', text: f[0], a: phrase, b: f[0],
        explanation: 'Heard as the name of ' + f[1] + ' rather than a sentence.', score: 4 - i * 0.2, frame: f[1]
      };
    });
  }

  function genRecogniser(ws, alternatives) {
    var phrase = ws.join(' ');
    return (alternatives || []).map(normalize).filter(function (a) { return a && a !== phrase; }).map(function (a) {
      return { method: 'recogniser', text: a, a: phrase, b: a,
        explanation: 'The speech recogniser also thought you might have said “' + a + '”.', score: 9.5 };
    });
  }

  // Two single-word swaps at different positions, for "More" when we run low.
  function genCombos(ws, singles, rand) {
    var bySpot = {};
    singles.forEach(function (c) {
      if (c.method === 'literal' || c.method === 'invention' || c.method === 'double' || c.method === 'recogniser' || c.a.indexOf(' ') >= 0) return;
      var at = ws.indexOf(c.a);
      if (at < 0) return;
      (bySpot[at] = bySpot[at] || []).push(c);
    });
    var spots = Object.keys(bySpot).map(Number);
    var out = [];
    for (var x = 0; x < spots.length; x++) for (var y = x + 1; y < spots.length; y++) {
      var c1 = bySpot[spots[x]][Math.floor(rand() * bySpot[spots[x]].length)];
      var c2 = bySpot[spots[y]][Math.floor(rand() * bySpot[spots[y]].length)];
      var copy = ws.slice(); copy[spots[x]] = c1.b; copy[spots[y]] = c2.b;
      out.push({ method: 'combo', text: copy.join(' '), a: c1.a + ' … ' + c2.a, b: c1.b + ' … ' + c2.b,
        shortA: c2.a, shortB: c2.b,
        explanation: 'Two mishearings at once: “' + c1.a + '” → “' + c1.b + '” and “' + c2.a + '” → “' + c2.b + '”.', score: 3 });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Idea writer
  // ---------------------------------------------------------------------------
  function fill(t, c, orig) {
    var a = c.shortA || c.a, b = c.shortB || c.b;
    var alt = c.method === 'literal' ? orig + ', literally' : c.method === 'double' ? c.text.replace(/ \(as in .*\)$/, '') + ' (the other kind)' : c.text;
    var map = {
      '{orig}': orig, '{Orig}': cap(orig), '{alt}': alt, '{Alt}': cap(alt), '{Title}': titleCase(c.method === 'literal' || c.method === 'double' ? orig : c.text),
      '{aA}': article(a), '{bA}': article(b), '{AA}': cap(article(a)), '{A}': cap(a), '{B}': titleCase(b), '{a}': a, '{b}': b
    };
    return t.replace(/\{(orig|Orig|alt|Alt|Title|aA|bA|AA|A|B|a|b)\}/g, function (m) { return map[m]; });
  }

  function isShort(c) {
    var a = c.shortA || c.a, b = c.shortB || c.b;
    return a.split(' ').length <= 2 && b.split(' ').length <= 3 && c.method !== 'literal' && c.method !== 'invention';
  }

  function doubleIdea(c, kind, rand) {
    var w = c.word, s0 = c.senses[0], s1 = c.senses[1];
    var opts = {
      invention: ['Invention: a single object that is both ' + s0 + ' and ' + s1 + '. Nobody asked for it. Everybody wants one.',
        'Invention: the hybrid ' + w + ' — part ' + s0 + ', part ' + s1 + '. The instruction manual is a love letter to confusion.'],
      observation: ['Observation: “' + w + '” holds ' + s0 + ' and ' + s1 + ' in one breath. Maybe they were always secretly related, and the word remembers.',
        'Observation: when a word means both ' + s0 + ' and ' + s1 + ', it is not being careless. It is being generous.'],
      joke: ['Joke: I asked for ' + article(w) + '. They gave me ' + s1 + '. Technically correct — the most dangerous kind of correct.',
        'Joke: “Is that ' + s0 + ' or ' + s1 + '?” “Yes.”'],
      art: ['Art concept: a painting of ' + s0 + ' that, viewed from the left, becomes ' + s1 + '. The title is simply “' + cap(w) + '”.',
        'Poem:\n  One word, two rooms:\n  ' + s0 + ' in the first,\n  ' + s1 + ' in the second,\n  and a hallway where they meet.']
    };
    var list = opts[kind];
    return list[Math.floor(rand() * list.length)];
  }

  function inventionIdea(c, kind, rand, orig) {
    var name = titleCase(c.text);
    var opts = {
      invention: ['Invention: ' + name + '. ' + cap(c.frame) + ' that does exactly one thing: it makes the phrase “' + orig + '” come true, slightly wrongly.',
        'Invention: ' + name + '. Press the button and it says “' + orig + '” in the voice of whoever you miss most.'],
      observation: ['Observation: say any phrase with enough confidence and it becomes a product. “' + name + '” is proof that a sentence is just an invention waiting for a patent.'],
      joke: ['Joke: Introducing ' + name + '. Side effects may include saying “' + orig + '” at weddings.'],
      art: ['Art concept: an advert for ' + name + ' that never explains what it is. Viewers write in with their guesses, and the guesses become the product.']
    };
    var list = opts[kind];
    return list[Math.floor(rand() * list.length)];
  }

  function writeIdea(c, kind, rand, orig, used) {
    if (c.idea && !used['hand:' + c.idea]) { used['hand:' + c.idea] = true; return c.idea; }
    if (c.method === 'double') return doubleIdea(c, kind, rand);
    if (c.method === 'invention') return inventionIdea(c, kind, rand, orig);
    var short = isShort(c);
    var pool = TEMPLATES[kind].filter(function (t) { return short || !t.short; });
    var fresh = pool.filter(function (t) { return !used[t.t]; });
    var list = fresh.length ? fresh : pool;
    // Prefer word-level templates when the swap is a single word: they are funnier.
    if (short && rand() < 0.6) {
      var wordy = list.filter(function (t) { return t.short; });
      if (wordy.length) list = wordy;
    }
    var pick = list[Math.floor(rand() * list.length)];
    used[pick.t] = true;
    return fill(pick.t, c, orig);
  }

  // Ideas are written with a leading label ("Joke: ..."). Split it off so the
  // page can show the label separately.
  var PREFIXES = [[/^Invention:\s*/, 'invention', 'Invention'], [/^Observation:\s*/, 'observation', 'Philosophical observation'],
    [/^Joke:\s*/, 'joke', 'Joke'], [/^Art concept:\s*/, 'art', 'Art concept'], [/^Poem:\s*/, 'art', 'Poem']];
  function splitIdea(text, fallback) {
    for (var i = 0; i < PREFIXES.length; i++) {
      if (PREFIXES[i][0].test(text)) return { kind: PREFIXES[i][1], label: PREFIXES[i][2], text: text.replace(PREFIXES[i][0], '') };
    }
    return { kind: fallback, label: KIND_LABELS[fallback], text: text };
  }

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------
  var METHOD_ORDER = ['recogniser', 'famous', 'literal', 'homophone', 'soundalike', 'boundary', 'phonetic', 'double', 'combo', 'invention'];

  function generate(phrase, options) {
    options = options || {};
    var count = options.count || 5;
    var heard = normalize(phrase);
    var ws = words(phrase);
    if (!ws.length) return { heard: '', interpretations: [] };
    var seed = (options.seed == null ? hashString(heard) : options.seed) >>> 0;
    var rand = rng(seed ^ hashString(heard));
    var exclude = {};
    (options.exclude || []).forEach(function (k) { exclude[k] = true; });

    var all = []
      .concat(genRecogniser(ws, options.alternatives))
      .concat(genFamous(ws))
      .concat(genLiteral(ws))
      .concat(genHomophones(ws))
      .concat(genNear(ws))
      .concat(genBoundary(ws))
      .concat(genPhonetic(ws))
      .concat(genDouble(ws));
    all = all.concat(genCombos(ws, all, rand)).concat(genInvention(ws));

    // De-duplicate by text, keep the best-scoring version.
    var seenText = {}, unique = [];
    all.sort(function (x, y) { return y.score - x.score; });
    all.forEach(function (c) {
      var t = normalize(c.text);
      if (t === heard || seenText[t]) return;
      seenText[t] = true;
      c.key = c.method + ':' + t;
      unique.push(c);
    });

    // Group by method, lightly shuffle within each group (better ones stay near the top).
    var groups = {};
    unique.forEach(function (c) { c._r = c.score + rand() * 2.5; (groups[c.method] = groups[c.method] || []).push(c); });
    Object.keys(groups).forEach(function (m) { groups[m].sort(function (x, y) { return y._r - x._r; }); });

    // Round-robin across methods so every batch mixes techniques.
    var order = METHOD_ORDER.filter(function (m) { return groups[m]; });
    var lead = order.filter(function (m) { return m === 'recogniser' || m === 'famous' || m === 'literal'; });
    var rest = shuffle(order.filter(function (m) { return lead.indexOf(m) < 0 && m !== 'invention'; }), rand);
    order = lead.concat(rest, groups.invention ? ['invention'] : []);

    // First pass caps the fallback methods at one each; the second lifts the cap.
    var picked = [], taken = {};
    [{ invention: 1, combo: 1 }, {}].forEach(function (caps) {
      var progress = true;
      while (picked.length < count && progress) {
        progress = false;
        for (var i = 0; i < order.length && picked.length < count; i++) {
          var m = order[i], g = groups[m];
          if (caps[m] != null && (taken[m] || 0) >= caps[m]) continue;
          while (g.length && exclude[g[0].key]) g.shift();
          if (g.length) { picked.push(g.shift()); taken[m] = (taken[m] || 0) + 1; progress = true; }
        }
      }
    });

    // Ran out of new ones? Revisit earlier interpretations from a new angle.
    var recycled = 0;
    if (picked.length < count) {
      var pool = shuffle(unique.filter(function (c) { return picked.indexOf(c) < 0; }), rand);
      for (var p = 0; p < pool.length && picked.length < count; p++) {
        var copy = Object.assign({}, pool[p]);
        copy.idea = null;
        copy.recycled = true;
        copy.key = copy.key + '#' + seed + ':' + p;
        picked.push(copy);
        recycled++;
      }
    }

    // Assign idea kinds so each batch includes a variety.
    var kinds = shuffle(KINDS, rand);
    var used = options.usedTemplates || {};
    var interpretations = picked.map(function (c, i) {
      var kind = kinds[i % kinds.length];
      var idea = splitIdea(writeIdea(c, kind, rand, heard, used), kind);
      return {
        key: c.key,
        text: c.method === 'invention' ? titleCase(c.text) : cap(c.text),
        method: c.method,
        methodLabel: METHOD_LABELS[c.method],
        explanation: (c.recycled ? 'Another angle: ' : '') + c.explanation,
        kind: idea.kind,
        kindLabel: idea.label,
        idea: idea.text
      };
    });

    return { heard: cap(heard), interpretations: interpretations, recycled: recycled };
  }

  return {
    generate: generate,
    // exposed for tests and for anyone extending the engine
    _internal: { soundKey: soundKey, normalize: normalize, segmentations: segmentations, levenshtein: levenshtein, METHOD_LABELS: METHOD_LABELS, KIND_LABELS: KIND_LABELS, VOCAB: VOCAB }
  };
});
