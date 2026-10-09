/* Treebook sample data: 20 fictional trees.
   Positions are offsets in metres (east, north) from SAMPLE_CENTER,
   so the whole neighborhood can be moved near the user in one step. */

window.SAMPLE_CENTER = { lat: 38.8849, lng: -77.1087, label: 'Arlington, Virginia (sample neighborhood)' };

window.SAMPLE_TREES = [
  {
    id: 'oakley', name: 'Oakley', species: 'White Oak', scientific: 'Quercus alba', kind: 'oak',
    at: [120, 80], planted: 1890, heightFt: 82, girthIn: 168,
    place: 'Corner of the old schoolyard, by the bike rack',
    about: 'Oldest resident of the block. I have watched horses, streetcars and scooters go by. Acorn production is strictly my business.',
    posts: [
      { d: 1, by: 'tree', type: 'status', text: 'Dropped about four thousand acorns this week. The squirrels have formed a committee.' },
      { d: 3, by: 'Maya R.', type: 'wildlife', text: 'Counted three blue jays and a very bold squirrel burying acorns at the base.', photo: 1 },
      { d: 12, by: 'Jordan P.', type: 'measure', text: 'Measured the trunk at chest height: 168 inches around. Still growing!' },
      { d: 40, by: 'tree', type: 'status', text: 'Feeling shady. In the good way.' }
    ]
  },
  {
    id: 'sally', name: 'Sally', species: 'Sugar Maple', scientific: 'Acer saccharum', kind: 'maple',
    at: [-260, 140], planted: 1962, heightFt: 64, girthIn: 96,
    place: 'Front lawn of the public library',
    about: 'Famous for my October outfit. Yes, I am sweet on the inside. No, you may not tap me.',
    posts: [
      { d: 2, by: 'tree', type: 'status', text: 'Starting my annual color change. Orange first, then red. Stay tuned.' },
      { d: 2, by: 'Priya N.', type: 'fall', text: 'Top third of the canopy has turned bright orange. Lower branches still green.', photo: 1 },
      { d: 30, by: 'Sam K.', type: 'note', text: 'Story time group sat under Sally today. Perfect shade.' }
    ]
  },
  {
    id: 'barksalot', name: 'Sir Barksalot', species: 'American Sycamore', scientific: 'Platanus occidentalis', kind: 'sycamore',
    at: [430, -210], planted: 1935, heightFt: 95, girthIn: 140,
    place: 'Along the creek trail, near the footbridge',
    about: 'My bark peels like a jigsaw puzzle. Patchy is a look. Creek-side living for almost a century.',
    posts: [
      { d: 4, by: 'Luis G.', type: 'note', text: 'Large patches of bark have peeled away, showing creamy white wood underneath. Normal for sycamores.' },
      { d: 9, by: 'tree', type: 'status', text: 'Shedding again. It is called self-care.' },
      { d: 21, by: 'Ada W.', type: 'wildlife', text: 'A great blue heron was standing in the creek right below the big low branch.' }
    ]
  },
  {
    id: 'bettie', name: 'Blossom Bettie', species: 'Yoshino Cherry', scientific: 'Prunus × yedoensis', kind: 'cherry',
    at: [-80, -320], planted: 1998, heightFt: 28, girthIn: 44,
    place: 'Pocket park on the hill, next to the bench',
    about: 'Two glorious weeks of pink every spring, and I spend the rest of the year recovering from the attention.',
    posts: [
      { d: 5, by: 'tree', type: 'status', text: 'Off-season. Please respect my privacy.' },
      { d: 170, by: 'Theo B.', type: 'bloom', text: 'Peak bloom today! Nearly every bud open. Petals falling like snow in the wind.', photo: 1 },
      { d: 176, by: 'Maya R.', type: 'bloom', text: 'First blossoms open on the south side.' }
    ]
  },
  {
    id: 'willa', name: 'Willa', species: 'Weeping Willow', scientific: 'Salix babylonica', kind: 'willow',
    at: [520, 160], planted: 1975, heightFt: 45, girthIn: 110,
    place: 'Edge of the duck pond',
    about: 'I am not sad, I am just relaxed. My branches touch the water and I like it that way.',
    posts: [
      { d: 1, by: 'Sam K.', type: 'wildlife', text: 'A family of mallards napping in the shade under the branches.' },
      { d: 15, by: 'tree', type: 'status', text: 'Hair day: long and flowy.' },
      { d: 60, by: 'Jordan P.', type: 'concern', text: 'One long branch is cracked after the storm and hangs over the path. Reported to parks department.' }
    ]
  },
  {
    id: 'needles', name: 'Needles McGee', species: 'Eastern White Pine', scientific: 'Pinus strobus', kind: 'pine',
    at: [-480, -60], planted: 1950, heightFt: 88, girthIn: 102,
    place: 'Behind the community center',
    about: 'Soft needles in bundles of five. Count them: W-H-I-T-E. Evergreen and ever cheerful.',
    posts: [
      { d: 6, by: 'tree', type: 'status', text: 'Dropped some old needles. Do not worry, I keep the new ones.' },
      { d: 18, by: 'Priya N.', type: 'seeds', text: 'Long sticky cones all over the ground. Smells wonderful.', photo: 1 }
    ]
  },
  {
    id: 'ginny', name: 'Ginny', species: 'Ginkgo', scientific: 'Ginkgo biloba', kind: 'ginkgo',
    at: [40, 410], planted: 1971, heightFt: 52, girthIn: 70,
    place: 'Median strip on the main avenue',
    about: 'My family has been around since the dinosaurs. My fan-shaped leaves turn gold all at once and drop in a single day.',
    posts: [
      { d: 3, by: 'tree', type: 'status', text: 'Still green. Waiting for the right moment to go gold. It will be dramatic.' },
      { d: 365, by: 'Ada W.', type: 'fall', text: 'All the leaves dropped overnight. A perfect golden carpet on the sidewalk.', photo: 1 }
    ]
  },
  {
    id: 'magnus', name: 'Magnus', species: 'Southern Magnolia', scientific: 'Magnolia grandiflora', kind: 'magnolia',
    at: [300, 360], planted: 1958, heightFt: 60, girthIn: 88,
    place: 'Courtyard of the brick apartment building',
    about: 'Glossy leaves all year and flowers the size of dinner plates. A little Southern charm on your street.',
    posts: [
      { d: 8, by: 'Luis G.', type: 'seeds', text: 'Seed cones are opening and showing bright red seeds.', photo: 1 },
      { d: 120, by: 'tree', type: 'status', text: 'Blooming. You are welcome for the smell.' }
    ]
  },
  {
    id: 'birchard', name: 'Birchard', species: 'River Birch', scientific: 'Betula nigra', kind: 'birch',
    at: [-350, 300], planted: 2004, heightFt: 38, girthIn: 30,
    place: 'Rain garden by the elementary school',
    about: 'Three trunks, one personality. I love wet feet and I have curly, peeling bark.',
    posts: [
      { d: 2, by: 'Theo B.', type: 'note', text: 'Students tied a measuring tape around each of the three trunks for science class.' },
      { d: 25, by: 'tree', type: 'status', text: 'Rain garden flooded. Living my best life.' }
    ]
  },
  {
    id: 'rosie', name: 'Rosie', species: 'Eastern Redbud', scientific: 'Cercis canadensis', kind: 'redbud',
    at: [-150, 600], planted: 2010, heightFt: 22, girthIn: 20,
    place: 'Front yard of the yellow house on the corner',
    about: 'Small but loud. My flowers pop out straight from my bark every spring in bright magenta.',
    posts: [
      { d: 7, by: 'tree', type: 'status', text: 'Heart-shaped leaves turning a little yellow.' },
      { d: 190, by: 'Maya R.', type: 'bloom', text: 'Covered in pink-purple flowers, even on the trunk.', photo: 1 }
    ]
  },
  {
    id: 'dot', name: 'Dot', species: 'Flowering Dogwood', scientific: 'Cornus florida', kind: 'dogwood',
    at: [660, -40], planted: 1999, heightFt: 20, girthIn: 18,
    place: 'Under the big oaks in the shady lot',
    about: 'Virginia’s state tree. I like dappled shade, white spring flowers and red berries for the birds.',
    posts: [
      { d: 4, by: 'Sam K.', type: 'wildlife', text: 'Robins eating the red berries this morning.', photo: 1 },
      { d: 30, by: 'tree', type: 'status', text: 'Berries are ready. Birds, form an orderly line.' }
    ]
  },
  {
    id: 'holly', name: 'Holly Golightly', species: 'American Holly', scientific: 'Ilex opaca', kind: 'holly',
    at: [-620, 220], planted: 1965, heightFt: 35, girthIn: 40,
    place: 'Beside the church steps',
    about: 'Evergreen, spiky and festive. Look but do not touch.',
    posts: [
      { d: 10, by: 'tree', type: 'status', text: 'Berries coming in red. Getting ready for my season.' },
      { d: 50, by: 'Ada W.', type: 'wildlife', text: 'Mockingbird has claimed Holly and chases away everyone else.' }
    ]
  },
  {
    id: 'cedric', name: 'Cedric', species: 'Eastern Red Cedar', scientific: 'Juniperus virginiana', kind: 'cedar',
    at: [200, -520], planted: 1940, heightFt: 40, girthIn: 60,
    place: 'Fence line at the end of the dead-end street',
    about: 'Technically a juniper. Smell my wood and think of pencils and grandma’s closet.',
    posts: [
      { d: 5, by: 'Jordan P.', type: 'seeds', text: 'Covered in frosty blue berry-like cones.', photo: 1 },
      { d: 90, by: 'tree', type: 'status', text: 'Cedar waxwings visited. Very polite guests.' }
    ]
  },
  {
    id: 'elmer', name: 'Elmer', species: 'American Elm', scientific: 'Ulmus americana', kind: 'elm',
    at: [-40, -90], planted: 1925, heightFt: 75, girthIn: 130,
    place: 'Middle of the town green',
    about: 'Survivor of Dutch elm disease. My vase shape once lined streets across America.',
    posts: [
      { d: 1, by: 'tree', type: 'status', text: 'Annual check-up from the arborist went great.' },
      { d: 1, by: 'Luis G.', type: 'note', text: 'Arborist crew inspected the canopy with a bucket truck. Thumbs up.' },
      { d: 45, by: 'Priya N.', type: 'note', text: 'Farmers market tents set up in Elmer’s shade.' }
    ]
  },
  {
    id: 'tom', name: 'Tulip Tom', species: 'Tulip Poplar', scientific: 'Liriodendron tulipifera', kind: 'tulip',
    at: [740, 420], planted: 1948, heightFt: 105, girthIn: 115,
    place: 'Woods behind the soccer field',
    about: 'Tallest tree in the neighborhood. Straight as a ruler. My flowers look like orange and green tulips.',
    posts: [
      { d: 6, by: 'tree', type: 'status', text: 'View is excellent up here.' },
      { d: 140, by: 'Theo B.', type: 'bloom', text: 'Tulip-shaped flowers up high. Found some on the ground after the wind.', photo: 1 }
    ]
  },
  {
    id: 'beatrice', name: 'Beatrice', species: 'American Beech', scientific: 'Fagus grandifolia', kind: 'beech',
    at: [-560, -380], planted: 1910, heightFt: 70, girthIn: 120,
    place: 'Nature trail, past the second bench',
    about: 'Smooth grey bark like an elephant’s leg. Please do not carve your initials in me.',
    posts: [
      { d: 3, by: 'Ada W.', type: 'concern', text: 'Someone carved letters into the bark at eye level. Sad to see.' },
      { d: 20, by: 'tree', type: 'status', text: 'Keeping my papery leaves all winter again. Rustle rustle.' }
    ]
  },
  {
    id: 'baldwin', name: 'Baldwin', species: 'Bald Cypress', scientific: 'Taxodium distichum', kind: 'cypress',
    at: [600, -330], planted: 1980, heightFt: 55, girthIn: 66,
    place: 'Wetland boardwalk',
    about: 'A conifer that loses its needles every fall. I grow knobby “knees” up out of the mud.',
    posts: [
      { d: 2, by: 'tree', type: 'status', text: 'Needles turning a rusty copper. Bald season approaches.' },
      { d: 35, by: 'Jordan P.', type: 'note', text: 'Counted 14 cypress knees sticking out around the base.', photo: 1 }
    ]
  },
  {
    id: 'dickory', name: 'Dickory', species: 'Shagbark Hickory', scientific: 'Carya ovata', kind: 'hickory',
    at: [-250, -540], planted: 1930, heightFt: 80, girthIn: 98,
    place: 'Hilltop behind the water tower',
    about: 'My bark hangs off in long shaggy strips. Bats like to sleep under it in summer.',
    posts: [
      { d: 9, by: 'Maya R.', type: 'seeds', text: 'Hickory nuts falling. Wear a hat!' },
      { d: 70, by: 'tree', type: 'status', text: 'Hosted a bat sleepover. Quiet guests, slept all day.' }
    ]
  },
  {
    id: 'gumdrop', name: 'Gumdrop', species: 'Sweetgum', scientific: 'Liquidambar styraciflua', kind: 'sweetgum',
    at: [360, 40], planted: 1968, heightFt: 66, girthIn: 85,
    place: 'Parking strip on Maple Street (ironic, I know)',
    about: 'Star-shaped leaves and spiky seed balls. Love me in autumn, forgive me when you step on my gumballs.',
    posts: [
      { d: 1, by: 'Priya N.', type: 'seeds', text: 'Spiky gumballs everywhere on the sidewalk. Careful walking!', photo: 1 },
      { d: 11, by: 'tree', type: 'status', text: 'Starting to blush purple and red.' }
    ]
  },
  {
    id: 'percy', name: 'Percy', species: 'American Persimmon', scientific: 'Diospyros virginiana', kind: 'persimmon',
    at: [-420, 520], planted: 1985, heightFt: 33, girthIn: 36,
    place: 'Community garden, north corner',
    about: 'My orange fruit is delicious after the first frost and terrible before it. Patience is everything.',
    posts: [
      { d: 4, by: 'Theo B.', type: 'seeds', text: 'Small orange fruits hanging on the branches. Not soft yet.', photo: 1 },
      { d: 4, by: 'tree', type: 'status', text: 'Do not pick yet. I am serious.' }
    ]
  }
];

window.OBSERVATION_TYPES = {
  note:    { label: 'Note',            icon: '📝' },
  bloom:   { label: 'Flowers',         icon: '🌸' },
  leaves:  { label: 'New leaves',      icon: '🌱' },
  fall:    { label: 'Leaf color',     icon: '🍂' },
  seeds:   { label: 'Fruit or seeds',  icon: '🌰' },
  wildlife:{ label: 'Wildlife',        icon: '🐦' },
  measure: { label: 'Measurement',     icon: '📏' },
  concern: { label: 'Damage or concern', icon: '⚠️' },
  status:  { label: 'Status update',   icon: '💬' }
};

window.TREE_KINDS = {
  oak: 'Oak', maple: 'Maple', sycamore: 'Sycamore', elm: 'Elm', beech: 'Beech', hickory: 'Hickory',
  sweetgum: 'Sweetgum', tulip: 'Tulip poplar', persimmon: 'Persimmon', ginkgo: 'Ginkgo', magnolia: 'Magnolia',
  birch: 'Birch', willow: 'Willow', cherry: 'Cherry', redbud: 'Redbud', dogwood: 'Dogwood',
  pine: 'Pine', cedar: 'Cedar or juniper', holly: 'Holly', cypress: 'Cypress', other: 'Other or not sure'
};
