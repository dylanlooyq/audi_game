export const LEVELS = [
  {
    id: 'level-1', name: 'LEVEL 1', difficulty: 'EASY', bpm: 94,
    music: 'src/assets/music/prettyjohn1-hip-hop-hip-hop-beat-525029.mp3',
    firstBeat: 8017, // ms into the track of the beat the first arrows land on: 4 beats before the drop (10.57 s, bar 1 of the full beat)
    sequences: [
      { arrows: ['left','up','right'], choreo: 'Step Touch' },
      { arrows: ['down','right','up'], choreo: 'Star Pose' },
      { arrows: ['left','left','down','right'], choreo: 'Side Slide' },
      { arrows: ['up','right','down','left'], choreo: 'Turn' },
      { arrows: ['right','up','left'], choreo: 'Clap Beat' },
      { arrows: ['down','down','up','up'], choreo: 'Moonwalk' },
      { arrows: ['left','right','left','right'], choreo: 'Point Up' },
      // Moves are scored on bar lines, 2 bars apart (3 bars for 5-arrow moves), so this list is laid out
      // against the song: move 9 lands as the quiet breakdown starts (51.4 s), move 12 lands on the second drop
      // (66.7 s), and Finale lands on the last full-beat bar (92.3 s), leaving the fade-out for the dancer.
      { arrows: ['right','left','up','down'], choreo: 'Bounce' },
      { arrows: ['left','up','down','up'], choreo: 'Groove' },
      // Breakdown (51.4 s to 66.7 s)
      { arrows: ['right','down','left'], choreo: 'Snap' },
      { arrows: ['left','down','right','up'], choreo: 'Power Pose' },
      { arrows: ['up','right','left','down'], choreo: 'Cross Step' },
      // Second full-beat section (66.7 s to 92.3 s), building up to the finale
      { arrows: ['right','right','up','left'], choreo: 'Kick' },
      { arrows: ['down','up','left','right'], choreo: 'Slide' },
      { arrows: ['up','up','right','left','down'], choreo: 'Jump' },
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
