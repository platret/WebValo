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

// Per-weapon gun model. Each model is bbox-normalized at load (robust to the
// pack's unknown intrinsic scale) so `len` is the target longest-axis length in
// viewmodel-local units; bigger guns just get a bigger len. Orientation is a
// fixed pack rotation (barrel toward -Z) plus the mount offset below.
const PACK_ROT = [0, Math.PI / 2, 0]; // Quaternius guns model down +X → rotate to -Z
const MOUNT_POS = [0.02, -0.02, -0.06]; // grip offset inside the viewmodel
export const WEAPON_MODELS = {
  classic:  { file: 'Pistol_1.glb', len: 0.34 },
  shorty:   { file: 'Pistol_2.glb', len: 0.32 },
  sheriff:  { file: 'Pistol_3.glb', len: 0.36 },
  spectre:  { file: 'SMG_1.glb',    len: 0.46 },
  bulldog:  { file: 'AR_2.glb',     len: 0.56 },
  phantom:  { file: 'AR_5.glb',     len: 0.58 },
  vandal:   { file: 'AR_1.glb',     len: 0.58 },
  operator: { file: 'Sniper_1.glb', len: 0.66 },
  odin:     { file: 'AR_6.glb',     len: 0.62 },
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
      model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });

      // Normalize: recenter to origin, scale longest axis to `len`.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const longest = Math.max(size.x, size.y, size.z) || 1;
      model.position.sub(center);

      const inner = new THREE.Group();   // applies normalized scale
      inner.add(model);
      inner.scale.setScalar((spec.len || 0.5) / longest);

      const mount = new THREE.Group();   // applies orientation + grip offset
      mount.add(inner);
      mount.rotation.fromArray(spec.rot || PACK_ROT);
      mount.position.fromArray(spec.pos || MOUNT_POS);
      return mount;
    },
    // A tinted, independently-materialed skeleton instance + its clips.
    skeleton(tint) { return instanceCharacter(skelGltf, { tint }); },
    // The selected agent's body + its clips (for the decoy).
    character() { return instanceCharacter(charGltf); },
    hasSkeleton: !!skelGltf,
  };
}
