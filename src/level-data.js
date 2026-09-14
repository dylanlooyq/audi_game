export const LEVELS = [
  {
    id: 'level-1', name: 'LEVEL 1', difficulty: 'EASY', bpm: 105, leadIn: 2000,
    sequences: [
      { arrows: ['left','up','right'], choreo: 'Step Touch' },
      { arrows: ['down','right','up'], choreo: 'Star Pose' },
      { arrows: ['left','left','down','right'], choreo: 'Side Slide' },
      { arrows: ['up','right','down','left'], choreo: 'Turn' },
      { arrows: ['right','up','left'], choreo: 'Clap Beat' },
      { arrows: ['down','down','up','up'], choreo: 'Moonwalk' },
      { arrows: ['left','right','left','right'], choreo: 'Point Up' },
      { arrows: ['up','down','left','right','up'], choreo: 'Finale' }
    ]
  },
  {
    id: 'level-2', name: 'LEVEL 2', difficulty: 'NORMAL', bpm: 132, leadIn: 1800,
    sequences: [
      { arrows: ['up','left','down','right'], choreo: 'Bounce' },
      { arrows: ['left','up','right','down','up'], choreo: 'Cross Step' },
      { arrows: ['down','right','up','left','down'], choreo: 'Spin' },
      { arrows: ['left','left','right','right'], choreo: 'Power Pose' },
      { arrows: ['up','up','down','down'], choreo: 'Kick' },
      { arrows: ['right','left','up','down','right','left'], choreo: 'Wave' },
      { arrows: ['down','up','left','right','up','down'], choreo: 'Slide' },
      { arrows: ['left','up','right','down','up','left'], choreo: 'Jump' },
      { arrows: ['up','down','up','down','left','right'], choreo: 'Snap' },
      { arrows: ['right','right','left','left','up'], choreo: 'Turn' },
      { arrows: ['left','right','up','down','left','right'], choreo: 'Groove' },
      { arrows: ['up','left','down','right','up','down','left','right'], choreo: 'Finale' }
    ]
  },
  {
    id: 'level-3', name: 'LEVEL 3', difficulty: 'HARD', bpm: 158, leadIn: 1600,
    sequences: [
      { arrows: ['up','down','left','right','up','down'], choreo: 'Pop Lock' },
      { arrows: ['left','right','left','right','up','up'], choreo: 'Roll Out' },
      { arrows: ['down','left','up','right','down','left','up'], choreo: 'Flare' },
      { arrows: ['up','up','right','right','down','down','left','left'], choreo: 'Konami' },
      { arrows: ['left','up','down','right','left','up','right'], choreo: 'Freeze' },
      { arrows: ['right','down','left','up','right','down','left'], choreo: 'Spin Out' },
      { arrows: ['up','down','left','right','up','down','left','right'], choreo: 'Cypher' },
      { arrows: ['left','right','up','down','left','right','up','down'], choreo: 'Windmill' },
      { arrows: ['up','left','right','down','up','left','right','down'], choreo: 'Head Spin' },
      { arrows: ['down','down','up','up','left','right','left','right','up'], choreo: 'Six Step' },
      { arrows: ['up','right','down','left','up','right','down','left'], choreo: 'Krump' },
      { arrows: ['left','up','right','down','left','up','right','down','up','left'], choreo: 'Finale' }
    ]
  }
];

export const ARROWS = { left: '←', up: '↑', right: '→', down: '↓' };
