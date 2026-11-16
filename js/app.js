import { DB } from './core/db.js';
import { AI } from './core/keylessAI.js';
import { loadModules } from './core/autoLoader.js';
import { renderProfile } from './components/profileView.js';
import { renderRepo } from './components/repoView.js';

export const state = {
  user: null,
  repo: null,
  branch: 'main',
  currentFile: null
};

const repoTabs = [];
const routes = [];

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
}

export const api = {
  state,
  navigate: (h) => { location.hash = h; },
  toast,
  addRoute: (pattern, handler) => routes.push({ pattern, handler }),
  addRepoTab: (tab) => {
    if (!repoTabs.find(t => t.id === tab.id)) repoTabs.push(tab);
  },
  addGlobalNav: (item) => {
    const container = document.getElementById('globalNavModules');
    const btn = document.createElement('button');
    btn.className = 'nav-link';
    btn.innerHTML = (item.icon || '') + ' ' + item.label;
    btn.onclick = item.onClick;
    container.appendChild(btn);
  },
  openModal, closeModal,
  get repoTabs() { return repoTabs; },
  DB, AI,
  refresh: () => route()
};

function openModal(html, { wide = false } = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay"><div class="modal-box ${wide ? 'wide' : ''} fade-in">${html}</div></div>`;
  root.querySelector('.modal-overlay').onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal();
  };
  root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

async function renderTopNav() {
  const userMenu = document.getElementById('userMenu');
  if (state.user) {
    userMenu.innerHTML = `
      <button id="userBtn" class="flex items-center gap-2">
        <img src="${state.user.avatar}" class="w-8 h-8 rounded-full border border-border2" />
      </button>`;
    document.getElementById('userBtn').onclick = (e) => {
      e.stopPropagation();
      const existing = document.getElementById('userDropdown');
      if (existing) { existing.remove(); return; }
      const dd = document.createElement('div');
      dd.id = 'userDropdown';
      dd.className = 'absolute right-0 mt-2 w-56 bg-panel border border-border2 rounded-lg shadow-2xl overflow-hidden z-50';
      dd.innerHTML = `
        <div class="px-3 py-2 border-b border-border">
          <div class="text-sm text-white font-semibold">${state.user.name || state.user.username}</div>
          <div class="text-xs text-muted">@${state.user.username}</div>
        </div>
        <a href="#/profile" class="block px-3 py-2 text-sm hover:bg-panel2">Profile</a>
        <a href="#/new" class="block px-3 py-2 text-sm hover:bg-panel2">New repository</a>
        <button id="logoutBtn" class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-panel2">Sign out</button>`;
      userMenu.appendChild(dd);
      document.getElementById('logoutBtn').onclick = () => {
        localStorage.removeItem('nexusgit:session');
        state.user = null;
        dd.remove();
        renderTopNav();
        route();
      };
      setTimeout(() => document.addEventListener('click', () => dd.remove(), { once: true }), 0);
    };
  } else {
    userMenu.innerHTML = `<a href="#/profile" class="btn-ghost text-xs">Sign in</a>`;
  }
}

async function renderHome() {
  const app = document.getElementById('app');
  const repos = await DB.getAll('repos');
  const users = await DB.getAll('users');
  const visible = repos.filter(r => !r.isPrivate || (state.user && (r.owner === state.user.username || r.starred?.includes(state.user.username))));

  app.innerHTML = `
    <div class="fade-in">
      <div class="rounded-2xl p-8 mb-6 border border-border bg-gradient-to-br from-panel via-panel to-panel2 relative overflow-hidden">
        <div class="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/20 blur-3xl"></div>
        <div class="relative">
          <h1 class="text-3xl sm:text-4xl font-bold gradient-text mb-2">NexusGit</h1>
          <p class="text-muted mb-4 max-w-2xl">The ultra-premium, AI-first developer platform. Code, commit, collaborate — all in your browser, all client-side, all persistent.</p>
          <div class="flex gap-2">
            <a href="#/new" class="btn-primary">Create repository</a>
            <a href="#/explore" class="btn-ghost">Explore →</a>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">Recent repositories</h2>
        <span class="text-xs text-muted">${visible.length} total</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
        ${visible.slice(0, 8).map(r => `
          <a href="#/repo/${r.id}" class="card p-4 block hover:border-accent/50 transition">
            <div class="flex items-center gap-2 mb-2">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(r.owner)}" class="w-6 h-6 rounded-full" />
              <span class="text-sm text-accent">${r.owner} / </span>
              <span class="text-sm font-semibold text-white">${r.name}</span>
              ${r.isPrivate ? '<span class="badge badge-default">Private</span>' : ''}
            </div>
            <p class="text-xs text-muted mb-3 line-clamp-2">${r.description || 'No description'}</p>
            <div class="flex gap-3 text-xs text-muted">
              <span>⭐ ${r.stars || 0}</span>
              <span>🍴 ${r.forks || 0}</span>
            </div>
          </a>
        `).join('') || '<div class="text-sm text-muted">No repositories yet.</div>'}
      </div>

      <h2 class="text-lg font-semibold text-white mb-3">Active developers</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${users.slice(0, 4).map(u => `
          <a href="#/profile/${u.username}" class="card p-3 flex items-center gap-2 hover:border-accent/50">
            <img src="${u.avatar}" class="w-8 h-8 rounded-full" />
            <div class="min-w-0">
              <div class="text-sm text-white font-medium truncate">${u.name || u.username}</div>
              <div class="text-xs text-muted truncate">@${u.username}</div>
            </div>
          </a>
        `).join('')}
      </div>
    </div>`;
}

async function renderNewRepo() {
  const app = document.getElementById('app');
  if (!state.user) { location.hash = '#/profile'; return; }
  app.innerHTML = `
    <div class="max-w-xl mx-auto card p-6 fade-in">
      <h1 class="text-xl font-semibold text-white mb-4">Create a new repository</h1>
      <label class="label">Repository name</label>
      <input id="repoName" class="input mb-3" placeholder="my-awesome-project" />
      <label class="label">Description (optional)</label>
      <input id="repoDesc" class="input mb-3" placeholder="What is this project about?" />
      <label class="flex items-center gap-2 mb-4">
        <input id="repoPrivate" type="checkbox" class="accent-accent" />
        <span class="text-sm">Private</span>
      </label>
      <div class="flex justify-end gap-2">
        <a href="#/" class="btn-ghost">Cancel</a>
        <button id="createRepoBtn" class="btn-primary">Create repository</button>
      </div>
    </div>`;
  document.getElementById('createRepoBtn').onclick = async () => {
    const name = document.getElementById('repoName').value.trim();
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(name)) return toast('Invalid repo name', 'error');
    try {
      const repo = await DB.createRepo(state.user.username, name, document.getElementById('repoPrivate').checked, document.getElementById('repoDesc').value);
      toast('Repository created', 'success');
      api.navigate(`#/repo/${repo.id}`);
    } catch (e) { toast(e.message, 'error'); }
  };
}

async function renderExplore() {
  const app = document.getElementById('app');
  const repos = (await DB.getAll('repos')).filter(r => !r.isPrivate);
  app.innerHTML = `
    <div class="fade-in">
      <h1 class="text-2xl font-bold gradient-text mb-4">Explore</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${repos.map(r => `
          <a href="#/repo/${r.id}" class="card p-4 hover:border-accent/50">
            <div class="text-sm font-semibold text-accent mb-1">${r.owner} / ${r.name}</div>
            <div class="text-xs text-muted mb-3 line-clamp-2">${r.description || 'No description'}</div>
            <div class="flex gap-3 text-xs text-muted"><span>⭐ ${r.stars || 0}</span><span>🍴 ${r.forks || 0}</span></div>
          </a>
        `).join('') || '<div class="text-sm text-muted">No public repositories yet.</div>'}
      </div>
    </div>`;
}

const BUILTIN_ROUTES = [
  { pattern: /^#?\/?$/, handler: renderHome },
  { pattern: /^#\/explore$/, handler: renderExplore },
  { pattern: /^#\/new$/, handler: renderNewRepo },
  { pattern: /^#\/profile(?:\/([^/]+))?$/, handler: async (u) => renderProfile(api, u || null) },
  { pattern: /^#\/repo\/([^/]+)\/([^/]+)$/, handler: async (o, n) => renderRepo(api, o, n, 'code') },
  { pattern: /^#\/repo\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)$/, handler: async (o, n, b, p) => { state.branch = b; await renderRepo(api, o, n, 'code', decodeURIComponent(p || '') || b); } },
  { pattern: /^#\/repo\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/, handler: async (o, n, b) => { state.branch = b; await renderRepo(api, o, n, 'code', b); } },
  { pattern: /^#\/repo\/([^/]+)\/([^/]+)\/preview$/, handler: async (o, n) => renderRepo(api, o, n, 'preview') },
  { pattern: /^#\/repo\/([^/]+)\/([^/]+)\/settings$/, handler: async (o, n) => renderRepo(api, o, n, 'settings') }
];

async function route() {
  const hash = location.hash || '#/';
  const allRoutes = [...BUILTIN_ROUTES, ...routes];
  for (const r of allRoutes) {
    const m = hash.match(r.pattern);
    if (m) {
      try {
        await r.handler(...m.slice(1));
        updateActiveNav(hash);
      } catch (e) {
        console.error(e);
        document.getElementById('app').innerHTML = `<div class="text-center py-20 text-red-400">Error: ${e.message}</div>`;
      }
      return;
    }
  }
  document.getElementById('app').innerHTML = `<div class="text-center py-20"><h2 class="text-2xl font-semibold text-white">404 — Not found</h2><p class="text-muted mt-2">${hash}</p><a href="#/" class="btn-primary mt-4 inline-flex">Go home</a></div>`;
}

function updateActiveNav(hash) {
  document.querySelectorAll('#globalNav a, #globalNavModules .nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash || (a.tagName === 'A' && hash.startsWith(a.getAttribute('href') || '#/')));
  });
}

const COMMANDS = [
  { label: '🏠 Go home', action: () => api.navigate('#/') },
  { label: '🧭 Explore repositories', action: () => api.navigate('#/explore') },
  { label: '👤 My profile', action: () => api.navigate('#/profile') },
  { label: '➕ Create new repository', action: () => api.navigate('#/new') },
  { label: '🤖 Open AI Copilot', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true })) },
  { label: '❓ Keyboard shortcuts', action: () => openModal(`<h2 class="text-lg font-semibold mb-3 text-white">Keyboard shortcuts</h2><div class="text-sm space-y-2 text-gray-300"><div><kbd class="px-2 py-1 bg-panel2 rounded border border-border">⌘K</kbd> Command palette</div><div><kbd class="px-2 py-1 bg-panel2 rounded border border-border">Ctrl+I</kbd> AI Copilot</div><div><kbd class="px-2 py-1 bg-panel2 rounded border border-border">Esc</kbd> Close modals</div></div>`) }
];

function setupCommandPalette() {
  const palette = document.getElementById('cmdPalette');
  const input = document.getElementById('cmdInput');
  const results = document.getElementById('cmdResults');
  const open = () => {
    palette.classList.remove('hidden');
    input.value = '';
    input.focus();
    renderResults('');
  };
  const close = () => palette.classList.add('hidden');
  const renderResults = (q) => {
    const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
    results.innerHTML = filtered.length
      ? filtered.map((c, i) => `<button data-i="${i}" class="w-full text-left px-4 py-2.5 text-sm hover:bg-panel2 border-b border-border/50">${c.label}</button>`).join('')
      : `<div class="px-4 py-6 text-center text-muted text-sm">No commands found</div>`;
    results.querySelectorAll('button').forEach(b => b.onclick = () => {
      close();
      filtered[+b.dataset.i].action();
    });
  };
  document.getElementById('cmdBtn').onclick = open;
  input.oninput = () => renderResults(input.value);
  palette.onclick = (e) => { if (e.target === palette) close(); };
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape') { close(); closeModal(); }
  });
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('button');
      if (first) first.click();
    }
  };
}

async function init() {
  await DB.init();
  await DB.seed();
  const session = localStorage.getItem('nexusgit:session');
  if (session) state.user = await DB.get('users', session);

  await loadModules(api);
  await renderTopNav();
  setupCommandPalette();

  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/';
  await route();

  document.getElementById('bootScreen').style.display = 'none';
}

init().catch(e => {
  console.error(e);
  document.getElementById('bootScreen').innerHTML = `<div class="text-center text-red-400">Boot failed: ${e.message}</div>`;
});
