// Weapon stats. Damage is body damage; headshots use the multiplier.
// fireRate = rounds per second. spread = max radians of inaccuracy while moving/spraying.

export const WEAPONS = [
  { id: 'classic',  name: 'CLASSIC',  type: 'SIDEARM', price: 0,    dmg: 26,  head: 3.0, fireRate: 6.75, mag: 12, auto: false, spread: 0.012, recoil: 0.011 },
  { id: 'sheriff',  name: 'SHERIFF',  type: 'SIDEARM', price: 800,  dmg: 55,  head: 2.9, fireRate: 4.0,  mag: 6,  auto: false, spread: 0.010, recoil: 0.028 },
  { id: 'spectre',  name: 'SPECTRE',  type: 'SMG',     price: 1600, dmg: 22,  head: 2.5, fireRate: 13.3, mag: 30, auto: true,  spread: 0.020, recoil: 0.007 },
  { id: 'bulldog',  name: 'BULLDOG',  type: 'RIFLE',   price: 2050, dmg: 35,  head: 3.3, fireRate: 10.0, mag: 24, auto: true,  spread: 0.014, recoil: 0.010 },
  { id: 'phantom',  name: 'PHANTOM',  type: 'RIFLE',   price: 2900, dmg: 39,  head: 4.0, fireRate: 11.0, mag: 30, auto: true,  spread: 0.012, recoil: 0.009 },
  { id: 'vandal',   name: 'VANDAL',   type: 'RIFLE',   price: 2900, dmg: 40,  head: 4.0, fireRate: 9.75, mag: 25, auto: true,  spread: 0.015, recoil: 0.011 },
  { id: 'operator', name: 'OPERATOR', type: 'SNIPER',  price: 4700, dmg: 150, head: 1.7, fireRate: 0.75, mag: 5,  auto: false, spread: 0.001, recoil: 0.05 },
  { id: 'odin',     name: 'ODIN',     type: 'HEAVY',   price: 3200, dmg: 32,  head: 2.4, fireRate: 15.6, mag: 100, auto: true, spread: 0.026, recoil: 0.006 },
  { id: 'shorty',   name: 'SHORTY',   type: 'SIDEARM', price: 300,  dmg: 11,  head: 2.0, fireRate: 3.3,  mag: 2,  auto: false, spread: 0.07, recoil: 0.03, pellets: 12 },
];

export const getWeapon = (id) => WEAPONS.find((w) => w.id === id);

// Blade Storm pseudo-weapon for Jett's ult.
export const BLADE_STORM = {
  id: 'knives', name: 'BLADE STORM', type: 'ULT', dmg: 250, head: 1, fireRate: 3.5, mag: Infinity, auto: false, spread: 0.002, recoil: 0.004,
};
