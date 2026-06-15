// WebValo engine — Three.js first-person shooter.
// One file owns the whole match: world, player, weapons, abilities, bots, HUD.

import * as THREE from 'three';
import { getWeapon, BLADE_STORM } from './weapons.js';
import { CLIPS } from './models.js';

const BOT_COUNT = 5;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;
const GRAVITY = 22;
const RESPAWN_DELAY = 3;

// ---------------------------------------------------------------- audio
class Sfx {
  constructor() { this.ctx = null; }
  ensure() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  // Short procedural blip — type shapes the envelope. No audio assets needed.
  play(type) {
    try {
      this.ensure();
      const ctx = this.ctx, t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      if (type === 'shot' || type === 'botshot') {
        const len = 0.09, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'shot' ? 2400 : 1100;
        src.connect(f); f.connect(gain);
        gain.gain.setValueAtTime(type === 'shot' ? 0.22 : 0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.start(t);
      } else if (type === 'hit') {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(880, t);
        o.connect(gain); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        o.start(t); o.stop(t + 0.08);
      } else if (type === 'kill') {
        const o = ctx.createOscillator(); o.type = 'square';
        o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.07);
        o.connect(gain); gain.gain.setValueAtTime(0.09, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      } else if (type === 'boom') {
        const len = 0.5, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
        src.connect(f); f.connect(gain);
        gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.001, t + len);
        src.start(t);
      } else if (type === 'ability') {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(440, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.18);
        o.connect(gain); gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.start(t); o.stop(t + 0.25);
      } else if (type === 'reload') {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t);
        o.connect(gain); gain.gain.setValueAtTime(0.07, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.start(t); o.stop(t + 0.13);
      }
    } catch { /* audio is best-effort */ }
  }
}

// ---------------------------------------------------------------- map
// FORGE — industrial district. Two sites, a mid corridor, crates and ramps.
function buildMap(scene) {
  const colliders = []; // AABB boxes for player + bullet collision
  const shootables = []; // meshes raycast for bullets

  const matFloor = new THREE.MeshStandardMaterial({ color: 0x3d4a57, roughness: 0.95 });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x5a6b7d, roughness: 0.9 });
  const matCrate = new THREE.MeshStandardMaterial({ color: 0x76879b, roughness: 0.85 });
  const matAccent = new THREE.MeshStandardMaterial({ color: 0xff4655, emissive: 0xff4655, emissiveIntensity: 0.55 });
  const matTeal = new THREE.MeshStandardMaterial({ color: 0x53d9d1, emissive: 0x53d9d1, emissiveIntensity: 0.5 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x4d5b69, roughness: 1 });

  function box(w, h, d, x, y, z, mat = matCrate, solid = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    if (solid) {
      m.geometry.computeBoundingBox();
      const bb = new THREE.Box3().setFromObject(m);
      colliders.push(bb);
      shootables.push(m);
    }
    return m;
  }

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  shootables.push(floor);

  // floor markings — painted site letters
  const grid = new THREE.GridHelper(120, 60, 0x2f3b48, 0x222c37);
  grid.position.y = 0.01;
  scene.add(grid);

  // perimeter walls (60 x 60 play area)
  const W = 30, H = 6;
  box(2 * W + 2, H, 1, 0, H / 2, -W, matWall);
  box(2 * W + 2, H, 1, 0, H / 2, W, matWall);
  box(1, H, 2 * W + 2, -W, H / 2, 0, matWall);
  box(1, H, 2 * W + 2, W, H / 2, 0, matWall);

  // mid corridor walls
  box(1, 3.4, 18, -6, 1.7, 0, matWall);
  box(1, 3.4, 18, 6, 1.7, 0, matWall);
  box(10, 3.4, 1, 0, 1.7, -14, matWall);
  box(10, 3.4, 1, 0, 1.7, 14, matWall);

  // A site (north-west)
  box(8, 2.6, 8, -18, 1.3, -18, matDark);           // raised platform block
  box(2.2, 2.2, 2.2, -12, 1.1, -20, matCrate);
  box(2.2, 2.2, 2.2, -22, 1.1, -12, matCrate);
  box(2.2, 1.1, 2.2, -12, 0.55, -12, matCrate);
  box(6, 0.4, 6, -18, 0.2, -18, matAccent, false);  // glowing site pad

  // B site (south-east)
  box(8, 2.6, 8, 18, 1.3, 18, matDark);
  box(2.2, 2.2, 2.2, 12, 1.1, 20, matCrate);
  box(2.2, 2.2, 2.2, 22, 1.1, 12, matCrate);
  box(2.2, 1.1, 2.2, 12, 0.55, 12, matCrate);
  box(6, 0.4, 6, 18, 0.2, 18, matTeal, false);

  // scattered cover
  const coverSpots = [
    [-14, 6], [14, -6], [-20, 8], [20, -8], [0, -22], [0, 22],
    [-8, -8], [8, 8], [-24, -2], [24, 2], [10, -18], [-10, 18],
  ];
  for (const [x, z] of coverSpots) box(2, 1.6, 2, x, 0.8, z, matCrate);

  // tall pillars
  box(1.6, 5, 1.6, -15, 2.5, 2, matWall);
  box(1.6, 5, 1.6, 15, 2.5, -2, matWall);

  // accent strips on perimeter
  for (let i = -2; i <= 2; i++) {
    box(6, 0.18, 0.12, i * 12, 3.4, -W + 0.6, i % 2 ? matAccent : matTeal, false);
    box(6, 0.18, 0.12, i * 12, 3.4, W - 0.6, i % 2 ? matTeal : matAccent, false);
  }

  // lighting
  scene.fog = new THREE.FogExp2(0x141f2b, 0.014);
  scene.background = new THREE.Color(0x16222e);
  const hemi = new THREE.HemisphereLight(0xbdd4e8, 0x46525e, 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8d0, 3.2);
  sun.position.set(20, 32, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
  scene.add(sun);
  const redGlow = new THREE.PointLight(0xff4655, 6, 22);
  redGlow.position.set(-18, 3, -18);
  scene.add(redGlow);
  const tealGlow = new THREE.PointLight(0x53d9d1, 6, 22);
  tealGlow.position.set(18, 3, 18);
  scene.add(tealGlow);

  const spawnPoints = [
    new THREE.Vector3(-18, 0, -10), new THREE.Vector3(18, 0, 10),
    new THREE.Vector3(-22, 0, 14), new THREE.Vector3(22, 0, -14),
    new THREE.Vector3(0, 0, -24), new THREE.Vector3(0, 0, 24),
    new THREE.Vector3(-10, 0, 24), new THREE.Vector3(10, 0, -24),
  ];

  return { colliders, shootables, spawnPoints };
}

// ---------------------------------------------------------------- bots
const BOT_NAMES = ['REYNA-BOT', 'PHX-UNIT', 'OMEN-77', 'CYPHER.EXE', 'KAYO-MK2', 'VIPER-X', 'SAGE-9000'];

// KayKit skeleton faces +Z; combined with group.lookAt this points it at its
// target, so no extra yaw is needed.
const BOT_MODEL_YAW = 0;
const BOT_MODEL_H = 1.45; // skeleton stands this tall (chibi proportions)

class Bot {
  constructor(scene, spawn, name, asset = null) {
    this.name = name;
    this.hp = 100;
    this.alive = true;
    this.respawnAt = 0;
    this.hideAt = 0;
    this.shootCooldown = 0;
    this.wanderTarget = null;
    this.flashUntil = 0;
    this.speed = 3.2 + Math.random() * 1.2;
    const hasModel = !!(asset && asset.model);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb8323e, roughness: 0.6, emissive: 0x550b12, emissiveIntensity: 0.6 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.4, emissive: 0xff4655, emissiveIntensity: 0.35 });

    this.group = new THREE.Group();
    // Body + head double as the bullet hitboxes. When a glTF model is shown they
    // become invisible (material.visible=false) but stay raycastable — so all the
    // existing headshot logic keeps working unchanged. The chibi skeleton needs a
    // big head sphere up over the skull and a short body; the procedural fallback
    // keeps the original human-ish capsule that matches its visible shape.
    // For the chibi skeleton, derive the hitbox from its height so it stays
    // correct if BOT_MODEL_H changes: big head sphere over the skull (top ~30%),
    // short body capsule over torso+legs. Procedural fallback keeps human-ish dims.
    const H = BOT_MODEL_H;
    const bodyR = hasModel ? 0.235 * H : 0.38, bodyCyl = hasModel ? 0.31 * H : 0.85, bodyY = hasModel ? 0.31 * H : 0.85;
    const headR = hasModel ? 0.30 * H : 0.24, headY = hasModel ? 0.70 * H : 1.62;
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(bodyR, bodyCyl, 4, 10), bodyMat);
    this.body.position.y = bodyY;
    this.body.castShadow = true;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 12), headMat);
    this.head.position.y = headY;
    this.head.castShadow = true;
    this.visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.07, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x53d9d1, emissive: 0x53d9d1, emissiveIntensity: 1.4 })
    );
    this.visor.position.set(0, 1.64, 0.2);
    this.group.add(this.body, this.head, this.visor);
    this.body.userData.bot = this; this.body.userData.part = 'body';
    this.head.userData.bot = this; this.head.userData.part = 'head';
    this.group.position.copy(spawn);

    // ---- animated glTF skeleton (optional visual) ----
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.skinMeshes = [];
    if (hasModel) {
      const m = asset.model;
      // normalize height, feet on the ground
      const h = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y || 1.7;
      m.scale.setScalar(BOT_MODEL_H / h);
      m.position.y -= new THREE.Box3().setFromObject(m).min.y;
      m.traverse((o) => { if (o.isMesh) this.skinMeshes.push(o); });
      this.modelWrap = new THREE.Group();
      this.modelWrap.rotation.y = BOT_MODEL_YAW;
      this.modelWrap.add(m);
      this.group.add(this.modelWrap);
      // hide the hitbox meshes (still raycast — Raycaster honors Object3D.visible,
      // which stays true; only the material is hidden)
      for (const hb of [this.body, this.head, this.visor]) { hb.material.visible = false; hb.castShadow = false; }
      this.mixer = new THREE.AnimationMixer(m);
      for (const [key, clipName] of Object.entries(CLIPS)) {
        const clip = asset.animations.find((a) => a.name === clipName);
        if (clip) this.actions[key] = this.mixer.clipAction(clip);
      }
      this.playAction('idle');
    }
    scene.add(this.group);
  }

  // Crossfade to a named animation state.
  playAction(key, { once = false } = {}) {
    const a = this.actions[key];
    if (!a || a === this.current) return;
    a.reset().setEffectiveWeight(1);
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    a.clampWhenFinished = once;
    a.fadeIn(0.18).play();
    if (this.current) this.current.fadeOut(0.18);
    this.current = a;
  }

  setRevealed(on) {
    // Recon reveal — render through walls with a hot glow.
    if (this.skinMeshes.length) {
      for (const o of this.skinMeshes) {
        o.material.depthTest = !on;
        o.material.emissiveIntensity = on ? 2.4 : 0.5;
        o.renderOrder = on ? 999 : 0;
      }
      return;
    }
    for (const m of [this.body, this.head]) {
      m.material.depthTest = !on;
      m.material.emissiveIntensity = on ? 2.2 : (m === this.head ? 0.35 : 0.6);
      m.renderOrder = on ? 999 : 0;
    }
  }

  damage(amount) {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.alive = false;
    const now = performance.now() / 1000;
    this.respawnAt = now + RESPAWN_DELAY + Math.random() * 2;
    if (this.mixer) {
      this.current = null; // force the crossfade
      this.playAction('death', { once: true });
      this.hideAt = now + 1.6; // linger so the death animation plays out
    } else {
      this.group.visible = false; // procedural fallback: vanish as before
    }
  }

  respawn(spawn) {
    this.hp = 100;
    this.alive = true;
    this.group.position.copy(spawn);
    this.group.visible = true;
    if (this.mixer) { this.current = null; this.playAction('idle'); }
    this.setRevealed(false);
  }
}

// ---------------------------------------------------------------- engine
export class Game {
  constructor(canvas, agent, callbacks, models = null) {
    this.canvas = canvas;
    this.agent = agent;
    this.cb = callbacks; // { onQuit }
    this.models = models; // preloaded glTF store (null → procedural fallback)
    this.mixers = []; // active AnimationMixers (bots, decoy)
    this.sfx = new Sfx();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 300);

    const { colliders, shootables, spawnPoints } = buildMap(this.scene);
    this.colliders = colliders;
    this.shootables = shootables;
    this.spawnPoints = spawnPoints;

    // player state
    this.pos = new THREE.Vector3(0, PLAYER_HEIGHT, 24);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; // yaw 0 faces -z, toward arena center
    this.onGround = true;
    this.hp = 100; this.armor = 50;
    this.dead = false; this.deadUntil = 0;
    this.kills = 0; this.deaths = 0;
    this.ultPoints = 0;
    this.fireRateMult = 1; // stim beacon
    this.invisible = false; // yoru ult

    // weapon state
    this.weapon = getWeapon('classic');
    this.preUltWeapon = null;
    this.mag = this.weapon.mag;
    this.reloading = false; this.reloadEnd = 0;
    this.lastShot = 0;
    this.recoilKick = 0;

    // abilities
    this.cooldowns = { C: 0, Q: 0, E: 0 };
    this.effects = []; // transient world objects { mesh, until, update? }
    this.projectiles = [];
    this.zones = []; // damage/buff zones { pos, r, dps?, buff?, until, hostile }
    this.gateMarker = null; // yoru E
    this.ultActiveUntil = 0;
    this.reveal = { until: 0 };

    this.keys = {};
    this.mouseDown = false;
    this.paused = false;
    this.running = false;
    this.clock = new THREE.Clock();

    // bots — each gets its own tinted skeleton clone from the shared download
    this.bots = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      const asset = this.models ? this.models.skeleton(0x6a1414) : null;
      const bot = new Bot(this.scene, this.randomSpawn(), BOT_NAMES[i % BOT_NAMES.length], asset);
      if (bot.mixer) this.mixers.push(bot.mixer);
      this.bots.push(bot);
    }

    this.buildViewmodel();
    this.bindEvents();
    this.resize();
  }

  // ---------------- viewmodel
  buildViewmodel() {
    this.viewmodel = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x2c3845, roughness: 0.5, metalness: 0.4, emissive: 0x131b26, emissiveIntensity: 1 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.agent.color), emissive: new THREE.Color(this.agent.color), emissiveIntensity: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.5), gunMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), gunMat);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.38);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.02, 0.3), accent);
    stripe.position.set(0, 0.045, -0.05);
    // Procedural gun lives in its own group so it can hide when a glTF model loads.
    this.procGun = new THREE.Group();
    this.procGun.add(body, barrel, stripe);
    this.gunMount = new THREE.Group(); // holds the loaded glTF weapon, if any
    this.muzzle = new THREE.PointLight(0xffd9a0, 0, 4);
    this.muzzle.position.set(0, 0.03, -0.55);
    this.viewmodel.add(this.procGun, this.gunMount, this.muzzle);
    this.viewmodel.scale.setScalar(0.62);
    this.viewmodel.traverse((o) => { o.frustumCulled = false; });
    // Dedicated overlay pass: own scene + camera, rendered after the world with a depth clear.
    // Keeps the gun out of world geometry and immune to fog/frustum issues.
    this.vmZ = -0.45;
    this.viewmodel.position.set(0.26, -0.22, this.vmZ);
    this.vmScene = new THREE.Scene();
    this.vmScene.add(this.viewmodel);
    this.vmScene.add(new THREE.HemisphereLight(0xbdd4e8, 0x46525e, 2.2));
    const vmKey = new THREE.DirectionalLight(0xfff0dc, 2.4);
    vmKey.position.set(0.6, 0.8, 0.4);
    this.vmScene.add(vmKey);
    this.vmCamera = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.setGunModel(this.weapon.id);
  }

  // Swap the first-person weapon to its glTF model; falls back to the procedural
  // gun if there's no store or the model fails to load.
  async setGunModel(weaponId) {
    if (!this.models) return; // no store → keep procedural gun
    let mount = null;
    try { mount = await this.models.gun(weaponId); } catch { mount = null; }
    if (!this.gunMount) return; // destroyed mid-load
    this.gunMount.clear();
    if (mount) {
      this.gunMount.add(mount);
      this.gunMount.traverse((o) => { o.frustumCulled = false; });
      this.procGun.visible = false;
    } else {
      this.procGun.visible = true;
    }
  }

  // ---------------- input
  bindEvents() {
    this._onKeyDown = (e) => this.onKey(e, true);
    this._onKeyUp = (e) => this.onKey(e, false);
    this._onMouseMove = (e) => {
      if (!this.locked() || this.paused) return;
      this.yaw -= e.movementX * 0.0021;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.tryShoot(); } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onLockChange = () => {
      if (!this.locked() && this.running && !this.dead) this.setPaused(true);
    };
    this._onResize = () => this.resize();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    this.running = false;
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    window.removeEventListener('resize', this._onResize);
    if (this.locked()) document.exitPointerLock();
    this.renderer.dispose();
  }

  locked() { return document.pointerLockElement === this.canvas; }

  // Pointer lock can be rejected (no user gesture, sandboxed iframe) — never let that throw.
  lock() { try { this.canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* ignored */ } }

  onKey(e, down) {
    if (!this.running) return;
    this.keys[e.code] = down;
    if (!down) return;
    if (e.code === 'KeyB') { this.toggleBuy(); return; }
    if (this.paused || this.dead) return;
    if (e.code === 'KeyR') this.startReload();
    if (e.code === 'KeyC') this.useAbility('C');
    if (e.code === 'KeyQ') this.useAbility('Q');
    if (e.code === 'KeyE') this.useAbility('E');
    if (e.code === 'KeyX') this.useAbility('X');
    if (/^Digit[1-9]$/.test(e.code) && !document.getElementById('buy-menu').classList.contains('hidden')) {
      this.cb.onQuickBuy(parseInt(e.code.slice(5), 10) - 1);
    }
  }

  setPaused(p) {
    this.paused = p;
    document.getElementById('pause-menu').classList.toggle('hidden', !p);
    if (!p) this.lock();
  }

  toggleBuy() {
    const menu = document.getElementById('buy-menu');
    const open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    if (open) { document.exitPointerLock(); this.paused = true; document.getElementById('pause-menu').classList.add('hidden'); }
    else { this.paused = false; this.lock(); }
  }

  start() {
    this.running = true;
    this.lock();
    this.clock.start();
    this.loop();
    this.announce('MATCH START', false);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.vmCamera) {
      this.vmCamera.aspect = w / h;
      this.vmCamera.updateProjectionMatrix();
    }
  }

  randomSpawn() {
    return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)].clone();
  }

  // ---------------- weapons
  equip(weapon) {
    this.weapon = weapon;
    this.mag = weapon.mag;
    this.reloading = false;
    this.setGunModel(weapon.id);
    this.sfx.play('reload');
    this.updateHud();
  }

  startReload() {
    if (this.reloading || this.mag === this.weapon.mag || this.weapon === BLADE_STORM) return;
    this.reloading = true;
    this.reloadEnd = this.now() + 1.4;
    this.sfx.play('reload');
  }

  now() { return performance.now() / 1000; }

  tryShoot() {
    if (!this.running || this.paused || this.dead || !this.locked()) return;
    const t = this.now();
    const interval = 1 / (this.weapon.fireRate * this.fireRateMult);
    if (t - this.lastShot < interval) return;
    if (this.reloading) return;
    if (this.mag <= 0) { this.startReload(); return; }
    this.lastShot = t;
    if (this.weapon !== BLADE_STORM) this.mag--;

    const pellets = this.weapon.pellets || 1;
    for (let i = 0; i < pellets; i++) this.fireRay();

    this.recoilKick = Math.min(this.recoilKick + this.weapon.recoil, 0.09);
    this.muzzle.intensity = 14;
    this.vmZ = -0.38;
    this.sfx.play('shot');
    this.updateHud();
  }

  fireRay() {
    const moving = this.vel.lengthSq() > 4;
    const spread = this.weapon.spread * (moving ? 2.6 : 1) + this.recoilKick * 0.35;
    const dir = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.camera.quaternion)
      .add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, 0).applyQuaternion(this.camera.quaternion))
      .normalize();

    const ray = new THREE.Raycaster(this.camera.getWorldPosition(new THREE.Vector3()), dir, 0, 200);
    const botMeshes = this.bots.filter((b) => b.alive).flatMap((b) => [b.body, b.head]);
    const hits = ray.intersectObjects([...this.shootables, ...botMeshes], false);
    const hit = hits[0];

    const end = hit ? hit.point : ray.ray.at(120, new THREE.Vector3());
    this.spawnTracer(ray.ray.origin, end);

    if (hit && hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const isHead = hit.object.userData.part === 'head';
      const dmg = Math.round(this.weapon.dmg * (isHead ? this.weapon.head : 1));
      const killed = bot.damage(dmg);
      this.showHitmarker(killed);
      this.sfx.play(killed ? 'kill' : 'hit');
      if (killed) this.onKill(bot, isHead);
    } else if (hit) {
      this.spawnImpact(hit.point);
    }
  }

  onKill(bot, headshot) {
    this.kills++;
    this.ultPoints = Math.min(this.ultPoints + 1, this.agent.abilities.X.pts);
    this.cb.onKillFeed(`YOU`, bot.name, headshot, false);
    this.cb.onScore(this.kills, this.deaths);
    this.updateHud();
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      from.clone().add(new THREE.Vector3(0, -0.06, 0)), to,
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.effects.push({ mesh: line, until: this.now() + 0.05 });
  }

  spawnImpact(point) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc46b })
    );
    m.position.copy(point);
    this.scene.add(m);
    this.effects.push({ mesh: m, until: this.now() + 0.18 });
  }

  showHitmarker(kill) {
    const hm = document.getElementById('hitmarker');
    hm.classList.remove('show', 'kill');
    void hm.offsetWidth; // restart animation
    hm.classList.add('show');
    if (kill) hm.classList.add('kill');
  }

  // ---------------- abilities
  useAbility(slot) {
    const ab = this.agent.abilities[slot];
    if (!ab) return;
    const t = this.now();
    if (slot === 'X') {
      if (this.ultPoints < ab.pts) return;
      this.ultPoints = 0;
      this.castUlt();
      this.sfx.play('ability');
      this.updateHud();
      return;
    }
    if (this.cooldowns[slot] > t) return;
    const used = this.castBasic(slot);
    if (used === false) return; // ability declined (e.g. yoru E with no marker logic)
    this.cooldowns[slot] = t + ab.cd;
    this.sfx.play('ability');
    this.updateHud();
  }

  aimDir() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); }

  aimPoint(maxDist = 60) {
    const ray = new THREE.Raycaster(this.camera.getWorldPosition(new THREE.Vector3()), this.aimDir(), 0, maxDist);
    const hits = ray.intersectObjects(this.shootables, false);
    return hits[0] ? hits[0].point : ray.ray.at(maxDist, new THREE.Vector3());
  }

  castBasic(slot) {
    const id = this.agent.id;
    if (id === 'jett') {
      if (slot === 'C') this.spawnSmoke(this.aimPoint(24), 3.2, 5, 0x9ad7e8);
      if (slot === 'Q') { this.vel.y = 11; this.onGround = false; }
      if (slot === 'E') {
        const move = this.moveInputDir();
        const dir = move.lengthSq() > 0 ? move : this.flatAimDir();
        this.vel.x = dir.x * 26; this.vel.z = dir.z * 26;
        this.dashUntil = this.now() + 0.16;
      }
    } else if (id === 'raze') {
      if (slot === 'C') { // blast pack: launch yourself
        const d = this.flatAimDir();
        this.vel.x += d.x * 14; this.vel.z += d.z * 14; this.vel.y = 9;
        this.onGround = false;
        this.sfx.play('boom');
        this.spawnExplosionVfx(this.pos.clone().setY(0.3), 1.6, 0xf5a04b);
      }
      if (slot === 'Q') this.throwProjectile({ speed: 22, arc: 6, radius: 4.5, dmg: 80, color: 0xf5a04b });
      if (slot === 'E') this.deployBoomBot();
    } else if (id === 'yoru') {
      if (slot === 'C') this.deployDecoy();
      if (slot === 'Q') this.throwFlash();
      if (slot === 'E') {
        if (this.gateMarker) {
          this.pos.copy(this.gateMarker.position).setY(PLAYER_HEIGHT);
          this.scene.remove(this.gateMarker);
          this.gateMarker = null;
          this.spawnExplosionVfx(this.pos.clone().setY(0.3), 1.4, 0x7d8cff);
        } else {
          const marker = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.07, 8, 24),
            new THREE.MeshBasicMaterial({ color: 0x7d8cff })
          );
          marker.position.copy(this.pos).setY(0.4);
          marker.rotation.x = Math.PI / 2;
          this.scene.add(marker);
          this.gateMarker = marker;
          return; // placing the tether costs no cooldown; teleporting does
        }
      }
    } else if (id === 'brimstone') {
      if (slot === 'C') this.zones.push({ pos: this.pos.clone().setY(0), r: 4, buff: 'stim', until: this.now() + 8, mesh: this.spawnZoneVfx(this.pos.clone().setY(0.05), 4, 0xf5b945) });
      if (slot === 'Q') this.throwProjectile({ speed: 18, arc: 7, radius: 3.4, dmg: 0, molly: true, color: 0xe8744b });
      if (slot === 'E') this.spawnSmoke(this.aimPoint(80).setY(1.6), 3.6, 7, 0xe8744b);
    } else if (id === 'sova') {
      if (slot === 'C') this.deployDrone();
      if (slot === 'Q') this.throwProjectile({ speed: 30, arc: 2.5, radius: 3.4, dmg: 60, color: 0x6fd0f0 });
      if (slot === 'E') {
        this.reveal.until = this.now() + 6;
        for (const b of this.bots) if (b.alive) b.setRevealed(true);
        this.spawnExplosionVfx(this.aimPoint(80), 2, 0x6fd0f0);
        this.cb.onAnnounce('ENEMIES REVEALED', false);
      }
    }
  }

  castUlt() {
    const id = this.agent.id;
    if (id === 'jett') {
      this.preUltWeapon = this.weapon;
      this.weapon = BLADE_STORM;
      this.mag = Infinity;
      this.ultActiveUntil = this.now() + 12;
      this.cb.onAnnounce('BLADE STORM', true);
    } else if (id === 'raze') {
      this.throwProjectile({ speed: 34, arc: 0.5, radius: 8, dmg: 250, color: 0xff4655, big: true });
      this.cb.onAnnounce('FIRE IN THE HOLE', true);
    } else if (id === 'yoru') {
      this.invisible = true;
      this.ultActiveUntil = this.now() + 8;
      document.getElementById('ult-overlay').classList.add('yoru');
      this.cb.onAnnounce('DIMENSIONAL DRIFT', true);
    } else if (id === 'brimstone') {
      const target = this.aimPoint(100).setY(0);
      this.zones.push({ pos: target, r: 7, dps: 80, until: this.now() + 4, hostileToBots: true, mesh: this.spawnZoneVfx(target.clone().setY(0.06), 7, 0xff4655) });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 7, 60, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff4655, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
      );
      beam.position.copy(target).setY(30);
      this.scene.add(beam);
      this.effects.push({ mesh: beam, until: this.now() + 4 });
      this.sfx.play('boom');
      this.cb.onAnnounce('ORBITAL STRIKE', true);
    } else if (id === 'sova') {
      this.cb.onAnnounce("HUNTER'S FURY", true);
      let shots = 0;
      const fire = () => {
        if (shots++ >= 3 || !this.running) return;
        const origin = this.camera.getWorldPosition(new THREE.Vector3());
        const dir = this.aimDir();
        // wall-piercing: damage every bot near the beam line
        for (const b of this.bots) {
          if (!b.alive) continue;
          const toBot = b.group.position.clone().setY(origin.y).sub(origin);
          const along = toBot.dot(dir);
          if (along < 0) continue;
          const perp = toBot.sub(dir.clone().multiplyScalar(along)).length();
          if (perp < 2.2 && b.damage(130)) this.onKill(b, false);
        }
        const beamEnd = origin.clone().add(dir.clone().multiplyScalar(90));
        const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().add(new THREE.Vector3(0, -0.1, 0)), beamEnd]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x6fd0f0, linewidth: 3 }));
        this.scene.add(line);
        this.effects.push({ mesh: line, until: this.now() + 0.4 });
        this.sfx.play('boom');
        if (shots < 3) setTimeout(fire, 700);
      };
      fire();
    }
  }

  moveInputDir() {
    const f = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
    const s = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    if (!f && !s) return new THREE.Vector3();
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    return new THREE.Vector3(-sin * f + cos * s, 0, -cos * f - sin * s).normalize();
  }

  flatAimDir() {
    const d = this.aimDir(); d.y = 0;
    return d.lengthSq() > 0 ? d.normalize() : new THREE.Vector3(0, 0, -1);
  }

  spawnSmoke(point, radius, duration, color) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.82, roughness: 1, depthWrite: false })
    );
    m.position.copy(point).setY(Math.max(point.y, radius * 0.55));
    this.scene.add(m);
    this.effects.push({ mesh: m, until: this.now() + duration, smoke: true });
  }

  spawnZoneVfx(point, radius, color) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.5, 28, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    m.position.copy(point).setY(0.25);
    this.scene.add(m);
    return m;
  }

  spawnExplosionVfx(point, radius, color) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 14, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
    );
    m.position.copy(point);
    this.scene.add(m);
    this.effects.push({ mesh: m, until: this.now() + 0.35, grow: true });
  }

  throwProjectile({ speed, arc, radius, dmg, color, molly = false, big = false }) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(big ? 0.3 : 0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 })
    );
    m.position.copy(this.camera.getWorldPosition(new THREE.Vector3())).add(this.aimDir().multiplyScalar(0.6));
    this.scene.add(m);
    const vel = this.aimDir().multiplyScalar(speed);
    vel.y += arc;
    this.projectiles.push({ mesh: m, vel, radius, dmg, molly, color });
  }

  deployBoomBot() {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf5a04b, emissive: 0xf5a04b, emissiveIntensity: 1 })
    );
    m.position.copy(this.pos).setY(0.32).add(this.flatAimDir().multiplyScalar(1));
    this.scene.add(m);
    this.projectiles.push({ mesh: m, vel: this.flatAimDir().multiplyScalar(7), radius: 4, dmg: 110, ground: true, color: 0xf5a04b, fuse: this.now() + 6 });
  }

  deployDecoy() {
    let m = null, mixer = null;
    // Use the agent's own glTF body as the decoy when available.
    const c = this.models ? this.models.character() : null;
    if (c && c.model) {
      const model = c.model;
      const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y || 1.7;
      model.scale.setScalar(1.6 / h);
      model.position.y -= new THREE.Box3().setFromObject(model).min.y;
      model.traverse((o) => { if (o.isMesh) { o.material.emissive = new THREE.Color(0x3b4bd8); o.material.emissiveIntensity = 0.8; o.frustumCulled = false; } });
      m = new THREE.Group();
      m.rotation.y = BOT_MODEL_YAW;
      m.add(model);
      const idle = c.animations.find((a) => a.name === CLIPS.idle);
      if (idle) { mixer = new THREE.AnimationMixer(model); mixer.clipAction(idle).play(); this.mixers.push(mixer); }
    }
    if (!m) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x7d8cff, transparent: true, opacity: 0.75, emissive: 0x3b4bd8, emissiveIntensity: 0.6 });
      m = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.85, 4, 10), mat);
    }
    const base = this.pos.clone().add(this.flatAimDir().multiplyScalar(1.2));
    m.position.set(base.x, mixer ? 0 : 0.85, base.z);
    this.scene.add(m);
    this.effects.push({ mesh: m, until: this.now() + 6, decoy: true, mixer, vel: this.flatAimDir().multiplyScalar(3) });
  }

  deployDrone() {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3),
      new THREE.MeshStandardMaterial({ color: 0x6fd0f0, emissive: 0x6fd0f0, emissiveIntensity: 1.2 })
    );
    m.position.copy(this.pos).setY(2.2);
    this.scene.add(m);
    this.effects.push({ mesh: m, until: this.now() + 5, drone: true, vel: this.flatAimDir().multiplyScalar(6) });
  }

  throwFlash() {
    const point = this.aimPoint(20);
    this.spawnExplosionVfx(point, 1, 0xffffff);
    for (const b of this.bots) {
      if (b.alive && b.group.position.distanceTo(point) < 14) b.flashUntil = this.now() + 3.2;
    }
    this.cb.onAnnounce('ENEMIES BLINDED', false);
  }

  // ---------------- damage to player
  hurt(amount, fromDir) {
    if (this.dead || this.invisible) return;
    // armor absorbs 66% of its share
    const absorbed = Math.min(this.armor, Math.round(amount * 0.5));
    this.armor -= absorbed;
    this.hp -= (amount - absorbed);
    const v = document.getElementById('damage-vignette');
    v.style.opacity = 1;
    clearTimeout(this._vt);
    this._vt = setTimeout(() => (v.style.opacity = 0), 280);
    if (this.hp <= 0) this.die();
    this.updateHud();
  }

  die() {
    this.dead = true;
    this.deaths++;
    this.deadUntil = this.now() + RESPAWN_DELAY;
    document.getElementById('death-screen').classList.remove('hidden');
    document.exitPointerLock();
    const killer = this.bots[Math.floor(Math.random() * this.bots.length)];
    this.cb.onKillFeed(killer.name, 'YOU', false, true);
    this.cb.onScore(this.kills, this.deaths);
  }

  respawnPlayer() {
    this.dead = false;
    this.hp = 100; this.armor = 50;
    this.pos.copy(this.randomSpawn()).setY(PLAYER_HEIGHT);
    this.vel.set(0, 0, 0);
    document.getElementById('death-screen').classList.add('hidden');
    this.lock();
    this.updateHud();
  }

  // ---------------- per-frame
  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.now();

    if (!this.paused) {
      if (this.dead) {
        if (t >= this.deadUntil) this.respawnPlayer();
      } else {
        this.updatePlayer(dt, t);
        this.updateBots(dt, t);
      }
      this.updateProjectiles(dt, t);
      this.updateEffects(dt, t);
      this.updateZones(dt, t);
      this.updateUltState(t);
      for (let i = 0; i < this.mixers.length; i++) this.mixers[i].update(dt);
      if (this.mouseDown && this.weapon.auto) this.tryShoot();
      if (this.reloading && t >= this.reloadEnd) { this.reloading = false; this.mag = this.weapon.mag; this.updateHud(); }
    }

    // camera
    this.camera.position.copy(this.pos);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch + this.recoilKick, this.yaw, 0, 'YXZ'));
    this.recoilKick = Math.max(0, this.recoilKick - dt * 0.35);
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 160);
    this.vmZ += (-0.45 - this.vmZ) * dt * 14;
    // subtle weapon bob
    const speed2d = Math.hypot(this.vel.x, this.vel.z);
    this._bob = (this._bob || 0) + dt * speed2d * 1.6;
    const bobY = Math.sin(this._bob) * 0.006 * Math.min(speed2d, 6);
    this.viewmodel.position.set(0.26, -0.22 + bobY, this.vmZ);
    this.viewmodel.visible = !this.dead;

    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.autoClear = false;
    this.renderer.render(this.vmScene, this.vmCamera);
    this.renderer.autoClear = true;
  }

  updatePlayer(dt, t) {
    const walk = this.keys.ShiftLeft || this.keys.ShiftRight;
    const speed = walk ? 3.1 : 6.2;
    const move = this.moveInputDir();
    const dashing = this.dashUntil && t < this.dashUntil;

    if (!dashing) {
      const accel = this.onGround ? 60 : 14;
      this.vel.x += (move.x * speed - this.vel.x) * Math.min(accel * dt / 6, 1) * (this.onGround ? 1 : 0.4);
      this.vel.z += (move.z * speed - this.vel.z) * Math.min(accel * dt / 6, 1) * (this.onGround ? 1 : 0.4);
      if (this.onGround && move.lengthSq() === 0) { this.vel.x *= Math.pow(0.0001, dt); this.vel.z *= Math.pow(0.0001, dt); }
    }

    if (this.keys.Space && this.onGround) { this.vel.y = 7.4; this.onGround = false; }
    this.vel.y -= GRAVITY * dt;

    // integrate + collide per axis
    const next = this.pos.clone();
    next.x += this.vel.x * dt;
    if (this.collides(next)) { next.x = this.pos.x; this.vel.x = 0; }
    next.z += this.vel.z * dt;
    if (this.collides(next)) { next.z = this.pos.z; this.vel.z = 0; }
    next.y += this.vel.y * dt;
    if (next.y < PLAYER_HEIGHT) { next.y = PLAYER_HEIGHT; this.vel.y = 0; this.onGround = true; }
    else if (this.collides(next)) {
      // landed on top of a box or bumped a ceiling edge
      if (this.vel.y < 0) { this.onGround = true; }
      next.y = this.pos.y; this.vel.y = 0;
    } else {
      this.onGround = next.y <= PLAYER_HEIGHT + 0.001;
    }
    this.pos.copy(next);

    // hard map bounds
    this.pos.x = Math.max(-28.6, Math.min(28.6, this.pos.x));
    this.pos.z = Math.max(-28.6, Math.min(28.6, this.pos.z));
  }

  collides(p) {
    const min = new THREE.Vector3(p.x - PLAYER_RADIUS, p.y - PLAYER_HEIGHT, p.z - PLAYER_RADIUS);
    const max = new THREE.Vector3(p.x + PLAYER_RADIUS, p.y + 0.1, p.z + PLAYER_RADIUS);
    const me = new THREE.Box3(min, max);
    return this.colliders.some((c) => c.intersectsBox(me));
  }

  updateBots(dt, t) {
    // decoys attract bot aim
    const decoys = this.effects.filter((e) => e.decoy).map((e) => e.mesh.position);

    for (const b of this.bots) {
      if (!b.alive) {
        if (b.mixer && b.hideAt && t > b.hideAt) b.group.visible = false;
        if (t >= b.respawnAt) b.respawn(this.randomSpawn());
        continue;
      }
      if (this.reveal.until < t) b.setRevealed(false);

      const flashed = b.flashUntil > t;
      const playerVisible = !this.invisible && !flashed && this.hasLineOfSight(b);
      const target = decoys.length && !playerVisible ? decoys[0] : this.pos;
      const toTarget = target.clone().setY(0).sub(b.group.position.clone().setY(0));
      const dist = toTarget.length();

      if (playerVisible && dist < 30) {
        // face & strafe-approach
        b.group.lookAt(this.pos.x, b.group.position.y, this.pos.z);
        if (dist > 9) { b.group.position.add(toTarget.normalize().multiplyScalar(b.speed * dt)); b.playAction('run'); }
        else b.playAction('idle');
        b.shootCooldown -= dt;
        if (b.shootCooldown <= 0 && dist < 26) {
          b.shootCooldown = 0.55 + Math.random() * 0.7;
          this.sfx.play('botshot');
          // accuracy falls off with distance and player speed
          const hitChance = Math.max(0.12, 0.55 - dist * 0.012 - Math.hypot(this.vel.x, this.vel.z) * 0.03);
          if (Math.random() < hitChance) this.hurt(8 + Math.floor(Math.random() * 12));
        }
      } else {
        // wander between random points
        if (!b.wanderTarget || b.group.position.distanceTo(b.wanderTarget) < 1.5) {
          b.wanderTarget = this.randomSpawn();
        }
        const dir = b.wanderTarget.clone().setY(0).sub(b.group.position.clone().setY(0)).normalize();
        b.group.position.add(dir.multiplyScalar(b.speed * 0.55 * dt));
        b.group.lookAt(b.wanderTarget.x, b.group.position.y, b.wanderTarget.z);
        b.playAction('run');
      }

      // keep inside arena
      b.group.position.x = Math.max(-28, Math.min(28, b.group.position.x));
      b.group.position.z = Math.max(-28, Math.min(28, b.group.position.z));
    }
  }

  hasLineOfSight(bot) {
    const from = bot.group.position.clone().setY(1.5);
    const to = this.pos.clone();
    const dir = to.clone().sub(from);
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(from, dir, 0, dist);
    // blocked by walls or active smokes
    const smokes = this.effects.filter((e) => e.smoke).map((e) => e.mesh);
    return ray.intersectObjects([...this.shootables.filter((s) => s.geometry.type !== 'PlaneGeometry'), ...smokes], false).length === 0;
  }

  updateProjectiles(dt, t) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.ground) {
        // boombot: roll forward, hunt nearby bots, explode on contact or fuse
        p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
        p.mesh.rotation.x += dt * 8;
        const prey = this.bots.find((b) => b.alive && b.group.position.distanceTo(p.mesh.position) < 6);
        if (prey) {
          const d = prey.group.position.clone().sub(p.mesh.position).setY(0).normalize();
          p.vel.lerp(d.multiplyScalar(7), 0.12);
        }
        const boom = (prey && prey.group.position.distanceTo(p.mesh.position) < 1.2) || t > p.fuse
          || Math.abs(p.mesh.position.x) > 28 || Math.abs(p.mesh.position.z) > 28;
        if (boom) { this.explode(p); this.projectiles.splice(i, 1); }
        continue;
      }
      p.vel.y -= GRAVITY * 0.55 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      if (p.mesh.position.y <= 0.15 || this.pointInWall(p.mesh.position)) {
        this.explode(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  pointInWall(point) {
    return this.colliders.some((c) => c.containsPoint(point));
  }

  explode(p) {
    this.sfx.play('boom');
    this.spawnExplosionVfx(p.mesh.position.clone(), p.radius * 0.6, p.color);
    this.scene.remove(p.mesh);
    if (p.molly) {
      this.zones.push({ pos: p.mesh.position.clone().setY(0), r: p.radius, dps: 30, until: this.now() + 5, hostileToBots: true, mesh: this.spawnZoneVfx(p.mesh.position.clone().setY(0.06), p.radius, 0xe8744b) });
      return;
    }
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = b.group.position.distanceTo(p.mesh.position);
      if (d < p.radius) {
        const dmg = Math.round(p.dmg * (1 - d / p.radius * 0.6));
        if (b.damage(dmg)) this.onKill(b, false);
      }
    }
    // self-damage knockback only, no damage (it's a power fantasy build)
  }

  updateEffects(dt, t) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      if (e.grow) e.mesh.scale.addScalar(dt * 4);
      if (e.grow && e.mesh.material && e.mesh.material.transparent) e.mesh.material.opacity = Math.max(0, e.mesh.material.opacity - dt * 2);
      if (e.decoy && e.vel) { e.mesh.position.add(e.vel.clone().multiplyScalar(dt)); e.vel.multiplyScalar(0.98); }
      if (e.drone && e.vel) {
        e.mesh.position.add(e.vel.clone().multiplyScalar(dt));
        e.mesh.rotation.y += dt * 6;
        for (const b of this.bots) {
          if (b.alive && b.group.position.distanceTo(e.mesh.position) < 8) b.setRevealed(true);
        }
      }
      if (t >= e.until) {
        if (e.drone) for (const b of this.bots) { if (this.reveal.until < t) b.setRevealed(false); }
        if (e.mixer) { const mi = this.mixers.indexOf(e.mixer); if (mi >= 0) this.mixers.splice(mi, 1); }
        this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }
  }

  updateZones(dt, t) {
    this.fireRateMult = 1;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (t >= z.until) {
        if (z.mesh) this.scene.remove(z.mesh);
        this.zones.splice(i, 1);
        continue;
      }
      if (z.buff === 'stim' && this.pos.clone().setY(0).distanceTo(z.pos) < z.r) this.fireRateMult = 1.8;
      if (z.dps && z.hostileToBots) {
        for (const b of this.bots) {
          if (b.alive && b.group.position.clone().setY(0).distanceTo(z.pos) < z.r) {
            if (b.damage(z.dps * dt)) this.onKill(b, false);
          }
        }
      }
    }
  }

  updateUltState(t) {
    if (this.ultActiveUntil && t >= this.ultActiveUntil) {
      this.ultActiveUntil = 0;
      if (this.weapon === BLADE_STORM) {
        this.weapon = this.preUltWeapon || getWeapon('classic');
        this.mag = this.weapon.mag;
      }
      if (this.invisible) {
        this.invisible = false;
        document.getElementById('ult-overlay').classList.remove('yoru');
      }
      this.updateHud();
    }
  }

  // ---------------- HUD
  announce(text, red) { this.cb.onAnnounce(text, red); }

  updateHud() {
    document.getElementById('hp-num').textContent = Math.max(0, Math.ceil(this.hp));
    const fill = document.getElementById('hp-fill');
    fill.style.width = `${Math.max(0, this.hp)}%`;
    fill.classList.toggle('low', this.hp <= 35);
    document.getElementById('armor-fill').style.width = `${Math.max(0, this.armor) * 2}%`;
    document.getElementById('weapon-name').textContent = this.weapon.name;
    document.getElementById('ammo-mag').textContent = this.weapon === BLADE_STORM ? '∞' : this.mag;
    this.cb.onAbilityHud(this.cooldowns, this.ultPoints, this.now());
  }
}
