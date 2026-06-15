// Model registry + loader.
// Real 3D models stream at runtime from jsDelivr (CC0 packs) so the repo keeps
// zero binary assets. Everything degrades gracefully: a failed load returns null
// and the engine falls back to its procedural shapes — the game never breaks.
//
// Sources (all CC0 / public domain):
//   Guns  — Quaternius "Modular Sci-Fi Guns" (via trebeljahr/quaternius-showcase)
//   Bots  — KayKit "Skeletons" pack (rigged + animated)
//   Agent — KayKit "Adventurers" pack (rigged + animated)

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const GH = 'https://cdn.jsdelivr.net/gh';
const GUNS = `${GH}/trebeljahr/quaternius-showcase/public/glb/modular_sci_fi_guns_pack`;
const ADV = `${GH}/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf`;
const SKEL = `${GH}/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf`;

// Shared KayKit rig clip names (identical across Adventurers + Skeletons packs).
export const CLIPS = { idle: 'Idle', run: 'Running_A', death: 'Death_A', hit: 'Hit_A', shoot: '1H_Ranged_Shoot' };

// Per-weapon gun model + local transform for the first-person overlay viewmodel.
// pos/rot are applied to the model inside its mount group; game.js places the mount.
// Tuned for the vmCamera (fov 62) and the existing mount at ~(0.26,-0.22,-0.45).
const GUN_DEFAULT = { scale: 0.13, pos: [0, 0, 0.18], rot: [0, Math.PI / 2, 0] };
export const WEAPON_MODELS = {
  classic:  { file: 'Pistol_1.glb', scale: 0.12 },
  shorty:   { file: 'Pistol_2.glb', scale: 0.12 },
  sheriff:  { file: 'Pistol_3.glb', scale: 0.13 },
  spectre:  { file: 'SMG_1.glb',    scale: 0.13 },
  bulldog:  { file: 'AR_2.glb',     scale: 0.14 },
  phantom:  { file: 'AR_5.glb',     scale: 0.14 },
  vandal:   { file: 'AR_1.glb',     scale: 0.14 },
  operator: { file: 'Sniper_1.glb', scale: 0.15 },
  odin:     { file: 'AR_6.glb',     scale: 0.15 },
};

// Each agent gets a distinct KayKit body (used for the Gatecrash/Fakeout decoy,
// and available for future first/third-person uses).
export const AGENT_CHARACTER = {
  jett: 'Rogue.glb', raze: 'Barbarian.glb', yoru: 'Rogue_Hooded.glb',
  brimstone: 'Knight.glb', sova: 'Mage.glb',
};

// Enemy bots — one skeleton model cloned per bot (single download, many instances).
export const SKELETON_FILE = 'Skeleton_Minion.glb';

// ---------------------------------------------------------------- loader
const loader = new GLTFLoader();
const cache = new Map(); // url -> Promise<gltf | null>

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url).catch((e) => {
      console.warn('[models] failed to load', url, e?.message || e);
      return null; // graceful: callers fall back to procedural shapes
    }));
  }
  return cache.get(url);
}

// A clone whose materials are independent of the cache (so per-instance tinting
// doesn't bleed across bots) and that casts shadows.
function instanceCharacter(gltf, { tint } = {}) {
  if (!gltf) return null;
  const model = cloneSkinned(gltf.scene);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // skinned bounds get large; avoid pop-out culling
    o.material = o.material.clone();
    if (tint) {
      o.material.emissive = new THREE.Color(tint);
      o.material.emissiveIntensity = 0.5;
    }
  });
  return { model, animations: gltf.animations };
}

// Preloads every model a match needs and hands back synchronous accessors.
export async function preloadMatch(agentId, onProgress) {
  const gunFiles = [...new Set(Object.values(WEAPON_MODELS).map((w) => w.file))];
  const jobs = [
    ...gunFiles.map((f) => `${GUNS}/${f}`),
    `${SKEL}/${SKELETON_FILE}`,
    `${ADV}/${AGENT_CHARACTER[agentId] || 'Knight.glb'}`,
  ];

  let done = 0;
  await Promise.all(jobs.map((u) => load(u).then((r) => { onProgress?.(++done / jobs.length); return r; })));

  const skelGltf = await load(`${SKEL}/${SKELETON_FILE}`);
  const charGltf = await load(`${ADV}/${AGENT_CHARACTER[agentId] || 'Knight.glb'}`);

  return {
    // Fresh oriented gun group for a weapon id (null → procedural fallback).
    async gun(weaponId) {
      const spec = WEAPON_MODELS[weaponId];
      if (!spec) return null;
      const gltf = await load(`${GUNS}/${spec.file}`);
      if (!gltf) return null;
      const model = gltf.scene.clone(true);
      const t = { ...GUN_DEFAULT, ...spec };
      const mount = new THREE.Group();
      model.scale.setScalar(t.scale);
      model.position.fromArray(t.pos);
      model.rotation.fromArray(t.rot);
      model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
      mount.add(model);
      return mount;
    },
    // A tinted, independently-materialed skeleton instance + its clips.
    skeleton(tint) { return instanceCharacter(skelGltf, { tint }); },
    // The selected agent's body + its clips (for the decoy).
    character() { return instanceCharacter(charGltf); },
    hasSkeleton: !!skelGltf,
  };
}
