// Agent roster — colors drive both UI cards and in-game ability VFX.
// Ability slots map to keys: C (basic), Q (signature 1), E (signature 2), X (ultimate).

export const AGENTS = [
  {
    id: 'jett',
    name: 'JETT',
    role: 'DUELIST',
    color: '#9ad7e8',
    color2: '#4aa3c0',
    bio: 'A wind-runner from a homeland torn open by war. She darts through fights faster than anyone can track — if you blink, she is already behind you.',
    abilities: {
      C: { name: 'CLOUDBURST', icon: '☁', desc: 'Throw a smoke cloud that blocks vision where your crosshair lands.', cd: 7 },
      Q: { name: 'UPDRAFT', icon: '⇧', desc: 'Propel yourself high into the air.', cd: 8 },
      E: { name: 'TAILWIND', icon: '➤', desc: 'Dash a short distance in your movement direction.', cd: 5 },
      X: { name: 'BLADE STORM', icon: '⚔', desc: 'Equip deadly throwing knives. One-shot kills, no ammo, 12 seconds.', pts: 4 },
    },
  },
  {
    id: 'raze',
    name: 'RAZE',
    role: 'DUELIST',
    color: '#f5a04b',
    color2: '#d4502a',
    bio: 'Out of the painted alleys of Salvador, Raze brings the boom. Demolition is not a job to her — it is self-expression with a blast radius.',
    abilities: {
      C: { name: 'BLAST PACK', icon: '🧨', desc: 'Satchel that launches you forward and upward. Rocket-jump anywhere.', cd: 7 },
      Q: { name: 'PAINT SHELLS', icon: '✸', desc: 'Throw a cluster grenade. Big area damage on impact.', cd: 9 },
      E: { name: 'BOOM BOT', icon: '🤖', desc: 'Deploy a bot that rolls forward and detonates on the first enemy it finds.', cd: 12 },
      X: { name: 'SHOWSTOPPER', icon: '🚀', desc: 'Fire a rocket launcher round with massive area damage.', pts: 4 },
    },
  },
  {
    id: 'yoru',
    name: 'YORU',
    role: 'DUELIST',
    color: '#7d8cff',
    color2: '#3b4bd8',
    bio: 'Yoru rips holes through reality itself. He fights the war his ancestors started — unseen, unheard, and exactly where you least expect him.',
    abilities: {
      C: { name: 'FAKEOUT', icon: '👤', desc: 'Send out a decoy that draws enemy fire.', cd: 10 },
      Q: { name: 'BLINDSIDE', icon: '✦', desc: 'Throw a rift flash that blinds all enemies looking at it.', cd: 8 },
      E: { name: 'GATECRASH', icon: '⟲', desc: 'Place a rift tether, then reactivate to teleport back to it.', cd: 14 },
      X: { name: 'DIMENSIONAL DRIFT', icon: '🌀', desc: 'Slip into another dimension — invisible and invulnerable for 8 seconds.', pts: 5 },
    },
  },
  {
    id: 'brimstone',
    name: 'BRIMSTONE',
    role: 'CONTROLLER',
    color: '#e8744b',
    color2: '#8a3c1e',
    bio: 'First boots on the ground, last to leave. Brimstone’s orbital arsenal makes him the only commander you want calling in fire from above.',
    abilities: {
      C: { name: 'STIM BEACON', icon: '▲', desc: 'Drop a beacon that grants RapidFire — massively boosted fire rate.', cd: 10 },
      Q: { name: 'INCENDIARY', icon: '🔥', desc: 'Launch a grenade that ignites the ground in a damaging zone.', cd: 9 },
      E: { name: 'SKY SMOKE', icon: '◌', desc: 'Call down a smoke screen at your crosshair, anywhere on the map.', cd: 8 },
      X: { name: 'ORBITAL STRIKE', icon: '☄', desc: 'Call a devastating laser strike from orbit onto the targeted zone.', pts: 5 },
    },
  },
  {
    id: 'sova',
    name: 'SOVA',
    role: 'INITIATOR',
    color: '#6fd0f0',
    color2: '#2a6a9e',
    bio: 'Born from the eternal winter of Russia’s tundra, Sova tracks, finds, and eliminates. Nowhere to hide — his bow sees through walls.',
    abilities: {
      C: { name: 'OWL DRONE', icon: '🦉', desc: 'Launch a drone forward that tags enemies it passes.', cd: 12 },
      Q: { name: 'SHOCK BOLT', icon: '⚡', desc: 'Fire an explosive bolt that damages everything near impact.', cd: 7 },
      E: { name: 'RECON BOLT', icon: '◎', desc: 'Fire a sonar bolt that reveals all enemies through walls for 6 seconds.', cd: 10 },
      X: { name: "HUNTER'S FURY", icon: '⚶', desc: 'Fire 3 wall-piercing energy blasts across the entire map.', pts: 5 },
    },
  },
];

export const getAgent = (id) => AGENTS.find((a) => a.id === id);

// Procedural card art — angular gradient figure per agent, no image assets needed.
export function cardBackground(agent) {
  return `
    radial-gradient(120% 90% at 80% 0%, ${agent.color}33, transparent 60%),
    linear-gradient(160deg, #1f2933 10%, #141d27 70%)`;
}

export function cardFigure(agent) {
  return `
    linear-gradient(200deg, ${agent.color} 0%, ${agent.color2} 55%, transparent 90%)`;
}
