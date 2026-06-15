// WebValo shell — screens, agent select, buy menu, HUD bridge.

import { AGENTS, cardBackground, cardFigure } from './agents.js';
import { WEAPONS, getWeapon } from './weapons.js';
import { Game } from './game.js';
import { preloadMatch } from './models.js';

const $ = (sel) => document.querySelector(sel);

let selectedAgent = null;
let game = null;

// ---------------------------------------------------------------- screens
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ---------------------------------------------------------------- agent select
function buildAgentSelect() {
  const rail = $('#agent-rail');
  rail.innerHTML = '';
  AGENTS.forEach((agent, i) => {
    const card = document.createElement('button');
    card.className = 'agent-card';
    card.dataset.id = agent.id;
    card.innerHTML = `
      <div class="card-bg" style="background:${cardBackground(agent)}"></div>
      <div class="card-figure" style="background:${cardFigure(agent)}"></div>
      <div class="card-num">0${i + 1}</div>
      <div class="card-role">${agent.role}</div>
      <div class="card-name">${agent.name}</div>`;
    card.addEventListener('click', () => selectAgent(agent));
    card.addEventListener('mouseenter', () => renderDetail(agent));
    rail.appendChild(card);
  });
  renderDetail(AGENTS[0]);
}

function selectAgent(agent) {
  selectedAgent = agent;
  document.querySelectorAll('.agent-card').forEach((c) =>
    c.classList.toggle('selected', c.dataset.id === agent.id));
  renderDetail(agent);
  $('#btn-lock').disabled = false;
}

function renderDetail(agent) {
  const slots = ['C', 'Q', 'E', 'X'];
  $('#agent-detail').innerHTML = `
    <div class="detail-role">// ${agent.role}</div>
    <h3 class="detail-name" style="color:${agent.color}">${agent.name}</h3>
    <p class="detail-bio">${agent.bio}</p>
    <div class="detail-abilities">
      ${slots.map((k) => {
        const ab = agent.abilities[k];
        return `<div class="detail-ab ${k === 'X' ? 'ult' : ''}">
          <span class="key">${k}</span>
          <span class="ab-ic">${ab.icon}</span>
          <span class="ab-name">${ab.name}</span>
          <span class="ab-desc">${ab.desc}</span>
        </div>`;
      }).join('')}
    </div>`;
}

// ---------------------------------------------------------------- buy menu
function buildBuyMenu() {
  const grid = $('#buy-grid');
  grid.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const item = document.createElement('button');
    item.className = 'buy-item';
    item.dataset.id = w.id;
    item.innerHTML = `
      <div class="bi-top"><span class="bi-key">[${i + 1}]</span><span class="bi-price">$${w.price.toLocaleString()} → FREE</span></div>
      <div class="bi-name">${w.name}</div>
      <div class="bi-stats">${w.type} · DMG ${w.dmg} · ${w.fireRate.toFixed(1)}/s · MAG ${w.mag}</div>`;
    item.addEventListener('click', () => buyWeapon(w.id));
    grid.appendChild(item);
  });
}

function buyWeapon(id) {
  if (!game) return;
  game.equip(getWeapon(id));
  document.querySelectorAll('.buy-item').forEach((el) =>
    el.classList.toggle('equipped', el.dataset.id === id));
}

// ---------------------------------------------------------------- HUD bridge
function buildAbilityBar(agent) {
  const bar = $('#ability-bar');
  const slots = ['C', 'Q', 'E', 'X'];
  bar.innerHTML = slots.map((k) => {
    const ab = agent.abilities[k];
    const ult = k === 'X';
    return `<div class="ability ${ult ? 'ult' : 'ready'}" id="ab-${k}" title="${ab.name}">
      <span class="ic">${ab.icon}</span>
      <span class="kb">${k}</span>
      <span class="cd" id="cd-${k}"></span>
      ${ult ? `<span class="ult-pips">${Array.from({ length: ab.pts }, (_, i) => `<span class="pip" id="pip-${i}"></span>`).join('')}</span>` : ''}
    </div>`;
  }).join('');
}

function onAbilityHud(cooldowns, ultPoints, now) {
  for (const k of ['C', 'Q', 'E']) {
    const el = $(`#ab-${k}`);
    const remaining = cooldowns[k] - now;
    el.classList.toggle('cooling', remaining > 0);
    el.classList.toggle('ready', remaining <= 0);
    $(`#cd-${k}`).textContent = remaining > 0 ? Math.ceil(remaining) : '';
  }
  const ultAb = selectedAgent.abilities.X;
  const ultEl = $('#ab-X');
  ultEl.classList.toggle('ready', ultPoints >= ultAb.pts);
  for (let i = 0; i < ultAb.pts; i++) {
    const pip = $(`#pip-${i}`);
    if (pip) pip.classList.toggle('on', i < ultPoints);
  }
}

function onKillFeed(killer, victim, headshot, enemy) {
  const feed = $('#killfeed');
  const row = document.createElement('div');
  row.className = `kf-row ${enemy ? 'enemy' : ''}`;
  row.innerHTML = `<span class="k">${killer}</span> ${headshot ? '☠ HEADSHOT' : '⟶'} <span class="d">${victim}</span>`;
  feed.prepend(row);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => row.remove(), 5000);
}

function onScore(kills, deaths) {
  $('#score-ally').textContent = kills;
  $('#score-enemy').textContent = deaths;
}

function onAnnounce(text, red) {
  const el = $('#announce');
  el.textContent = text;
  el.classList.remove('show', 'red');
  void el.offsetWidth;
  el.classList.add('show');
  if (red) el.classList.add('red');
}

function onQuickBuy(index) {
  if (WEAPONS[index]) buyWeapon(WEAPONS[index].id);
}

// ---------------------------------------------------------------- match lifecycle
// Preload models behind a progress bar, then gate the actual launch behind a
// DEPLOY click — pointer lock requires a fresh user gesture, which an awaited
// preload would otherwise consume.
async function startMatch() {
  showScreen('#screen-game');
  const loading = $('#loading');
  const fill = $('#loading-fill');
  const status = $('#loading-status');
  const title = $('#loading-title');
  const deploy = $('#btn-deploy');
  loading.classList.remove('hidden');
  deploy.classList.add('hidden');
  title.textContent = 'DEPLOYING';
  status.textContent = 'STREAMING ASSETS…';
  fill.style.width = '0%';

  let store = null;
  try {
    store = await preloadMatch(selectedAgent.id, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
  } catch (e) {
    console.warn('[match] model preload failed, using procedural fallback', e);
  }
  fill.style.width = '100%';
  title.textContent = 'READY';
  status.textContent = `${selectedAgent.name} // FORGE`;
  deploy.classList.remove('hidden');

  deploy.onclick = () => {
    loading.classList.add('hidden');
    $('#hud').classList.remove('hidden');
    buildAbilityBar(selectedAgent);
    buildBuyMenu();

    game = new Game($('#game-canvas'), selectedAgent, {
      onKillFeed, onScore, onAnnounce, onAbilityHud, onQuickBuy,
    }, store);
    window.__game = game; // debug handle
    game.updateHud();
    game.start();

    // ability cooldown ticker (cheap DOM updates outside the render loop)
    clearInterval(window._hudTick);
    window._hudTick = setInterval(() => {
      if (game && game.running) onAbilityHud(game.cooldowns, game.ultPoints, game.now());
    }, 250);
  };
}

function quitMatch() {
  clearInterval(window._hudTick);
  if (game) { game.destroy(); game = null; }
  $('#hud').classList.add('hidden');
  $('#buy-menu').classList.add('hidden');
  $('#pause-menu').classList.add('hidden');
  $('#death-screen').classList.add('hidden');
  showScreen('#screen-agents');
}

// ---------------------------------------------------------------- wiring
$('#btn-play').addEventListener('click', () => showScreen('#screen-agents'));
$('#btn-back-landing').addEventListener('click', () => showScreen('#screen-landing'));
$('#btn-lock').addEventListener('click', () => { if (selectedAgent) startMatch(); });
$('#btn-resume').addEventListener('click', () => game && game.setPaused(false));
$('#btn-quit').addEventListener('click', quitMatch);

buildAgentSelect();
