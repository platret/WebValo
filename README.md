<div align="center">

# ⟁ WEBVALO

**A Valorant-inspired tactical FPS that runs entirely in your browser.**
No install. No launcher. No queue. Just `index.html` and a pointer lock.

[![Made with Three.js](https://img.shields.io/badge/Three.js-r160-0f1923?style=for-the-badge&logo=three.js&logoColor=ff4655)](https://threejs.org)
[![Zero Build](https://img.shields.io/badge/build_step-none-ff4655?style=for-the-badge)](#tech)
[![Deployed on Vercel](https://img.shields.io/badge/deployed-vercel-0f1923?style=for-the-badge&logo=vercel)](https://webvalo.vercel.app)

</div>

---

## ▸ What is this?

WebValo is a fan-made, browser-native tribute to Valorant: pick one of **5 agents**, lock in on the map **FORGE**, buy anything from the armory with **unlimited credits**, and fight respawning AI combatants with full ability kits — smokes, dashes, teleports, recon bolts, and orbital lasers.

Everything is procedural: the map geometry, the agent card art, even the gunshot sounds (synthesized with the Web Audio API). There are **zero binary assets** in this repo.

## ▸ Agents

| Agent | Role | C | Q | E | X (Ultimate) |
|---|---|---|---|---|---|
| **JETT** | Duelist | Cloudburst (smoke) | Updraft (boost) | Tailwind (dash) | **Blade Storm** — one-shot knives |
| **RAZE** | Duelist | Blast Pack (rocket-jump) | Paint Shells (nade) | Boom Bot (seeker) | **Showstopper** — rocket launcher |
| **YORU** | Duelist | Fakeout (decoy) | Blindside (flash) | Gatecrash (teleport) | **Dimensional Drift** — untouchable |
| **BRIMSTONE** | Controller | Stim Beacon (fire rate) | Incendiary (molly) | Sky Smoke (anywhere) | **Orbital Strike** — laser from space |
| **SOVA** | Initiator | Owl Drone (tagger) | Shock Bolt (AOE) | Recon Bolt (wallhack) | **Hunter's Fury** — 3 wall-piercing blasts |

## ▸ Controls

| Key | Action |
|---|---|
| `WASD` | Move |
| `Mouse` | Aim · `LMB` Fire |
| `Space` | Jump · `Shift` Walk |
| `R` | Reload |
| `C` `Q` `E` | Abilities |
| `X` | Ultimate (charge by getting kills) |
| `B` | Buy menu (unlimited credits — everything is free) |
| `1–9` | Quick-buy while armory is open |
| `Esc` | Pause |

## ▸ The Armory

Classic · Shorty · Sheriff · Spectre · Bulldog · Phantom · Vandal · Operator · Odin.
Real-ish damage models with headshot multipliers. Money is infinite, so is ammo reserve. Go wild.

## ▸ Run it locally

It's a static site — any file server works:

```bash
git clone https://github.com/platret/WebValo.git
cd WebValo
python3 -m http.server 8000
# open http://localhost:8000
```

<a id="tech"></a>
## ▸ Tech

- **Three.js r160** via CDN import map — no bundler, no `node_modules`
- Pointer-lock FPS controller with per-axis AABB collision
- Hitscan raycast weapons with spread, recoil & headshot hitboxes
- Bot AI: line-of-sight checks (blocked by walls *and* smokes), wander/chase/shoot states, flash & decoy reactions
- Procedural Web Audio sound design (gunshots, hits, explosions, ability chimes)
- Pure CSS UI — Valorant-style angular clip-paths, Anton + Rajdhani type, animated agent select

## ▸ Disclaimer

WebValo is a non-commercial fan project for learning purposes. It is **not affiliated with or endorsed by Riot Games**. Valorant and all related characters are property of Riot Games, Inc.

---

<div align="center"><sub>built in the browser, for the browser · <code>FPS.SYS READY_</code></sub></div>
