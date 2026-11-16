import { DB } from '../core/db.js';
import { timeAgo } from './repoView.js';

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function isoDate(d) { return d.toISOString().slice(0, 10); }

function buildHeatmap(contributions) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  const weeks = [];
  let current = new Date(start);
  while (current <= today) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const key = isoDate(current);
      const future = current > today;
      const count = contributions[key] || 0;
      week.push({ date: key, count, future, display: current.getMonth() + 1 + '/' + current.getDate() });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const cellsHTML = [];
  for (const week of weeks) {
    for (const cell of week) {
      if (cell.future) {
        cellsHTML.push(`<div class="heatmap-cell future" title=""></div>`);
      } else {
        const level = cell.count === 0 ? 0 : cell.count < 3 ? 1 : cell.count < 6 ? 2 : cell.count < 10 ? 3 : 4;
        cellsHTML.push(`<div class="heatmap-cell" data-level="${level}" title="${cell.count} contributions on ${cell.display}"></div>`);
      }
    }
  }
  return `<div class="heatmap">${cellsHTML.join('')}</div>`;
}

export async function renderProfile(api, username = null) {
  const user = username ? await DB.get('users', username) : api.state.user;
  const app = document.getElementById('app');

  if (!user) {
    app.innerHTML = `
      <div class="max-w-md mx-auto card p-8 fade-in text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">Welcome to NexusGit</h1>
        <p class="text-sm text-muted mb-6">Sign in or create an account to continue.</p>
        <div class="space-y-2 text-left">
          <label class="label">Username</label>
          <input id="loginUser" class="input" placeholder="octocat" />
        </div>
        <div class="flex gap-2 mt-4">
          <button id="loginBtn" class="btn-primary flex-1">Sign in</button>
          <button id="signupBtn" class="btn-ghost flex-1">Create account</button>
        </div>
        <div class="mt-4 text-xs text-muted">
          Demo: try <span class="text-accent font-mono">octocat</span>
        </div>
      </div>`;
    document.getElementById('loginBtn').onclick = async () => {
      const u = document.getElementById('loginUser').value.trim().toLowerCase();
      const existing = await DB.get('users', u);
      if (!existing) return api.toast('User not found. Create account instead.', 'error');
      localStorage.setItem('nexusgit:session', u);
      api.state.user = existing;
      api.refresh();
    };
    document.getElementById('signupBtn').onclick = async () => {
      const u = document.getElementById('loginUser').value.trim().toLowerCase();
      if (!/^[a-z0-9-]{2,30}$/.test(u)) return api.toast('Invalid username (a-z, 0-9, -)', 'error');
      try {
        const newUser = await DB.createUser(u, {});
        localStorage.setItem('nexusgit:session', u);
        api.state.user = newUser;
        api.refresh();
        api.toast('Account created!', 'success');
      } catch (e) { api.toast(e.message, 'error'); }
    };
    return;
  }

  const contributions = await DB.getContributions(user.username);
  const totalContribs = await DB.getContributionTotal(user.username);
  const allRepos = await DB.getAll('repos');
  const repos = allRepos.filter(r => r.owner === user.username);
  const pinned = repos.filter(r => (user.pinned || []).includes(r.id));
  const isMe = api.state.user && api.state.user.username === user.username;
  const followers = user.followers || [];
  const following = user.following || [];

  app.innerHTML = `
    <div class="fade-in">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="md:col-span-1">
          <img src="${user.avatar}" class="w-full max-w-[260px] aspect-square rounded-full border-2 border-border2 mb-4 object-cover" />
          <h1 class="text-2xl font-bold text-white">${esc(user.name)}</h1>
          <div class="text-lg text-muted mb-3">@${esc(user.username)}</div>
          ${user.status?.text ? `<div class="inline-flex items-center gap-1.5 text-xs bg-panel border border-border rounded-full px-2.5 py-1 mb-3">${esc(user.status.emoji || '')} ${esc(user.status.text)}</div>` : ''}
          <div class="text-sm text-gray-300 mb-4">${esc(user.bio || '')}</div>
          ${user.company ? `<div class="text-xs text-muted mb-1">🏢 ${esc(user.company)}</div>` : ''}
          ${user.location ? `<div class="text-xs text-muted mb-1">📍 ${esc(user.location)}</div>` : ''}
          ${user.website ? `<div class="text-xs text-muted mb-1">🔗 <a href="${esc(user.website)}" target="_blank" class="text-accent hover:underline">${esc(user.website)}</a></div>` : ''}
          <div class="flex items-center gap-3 text-xs text-muted mt-3">
            <span><span class="text-white font-semibold">${followers.length}</span> followers</span>
            <span><span class="text-white font-semibold">${following.length}</span> following</span>
          </div>
          ${isMe ? `<button id="editProfileBtn" class="w-full btn-ghost mt-3 text-xs">Edit profile</button>` : `<button id="followBtn" class="w-full btn-primary mt-3 text-xs">${followers.includes(api.state.user?.username) ? 'Unfollow' : 'Follow'}</button>`}
        </div>

        <div class="md:col-span-3">
          <div class="card p-4 mb-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-semibold text-white">${totalContribs} contributions in the last year</h2>
            </div>
            <div class="overflow-x-auto pb-2">${buildHeatmap(contributions)}</div>
            <div class="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted">
              <span>Less</span>
              <span class="heatmap-cell" data-level="0"></span>
              <span class="heatmap-cell" data-level="1"></span>
              <span class="heatmap-cell" data-level="2"></span>
              <span class="heatmap-cell" data-level="3"></span>
              <span class="heatmap-cell" data-level="4"></span>
              <span>More</span>
            </div>
          </div>

          ${pinned.length ? `
            <h3 class="text-sm font-semibold text-white mb-2">📌 Pinned</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              ${pinned.map(r => repoCard(r)).join('')}
            </div>
          ` : ''}

          <h3 class="text-sm font-semibold text-white mb-2">Repositories (${repos.length})</h3>
          <div class="space-y-3">
            ${repos.length ? repos.map(r => repoRow(r)).join('') : '<div class="text-sm text-muted">No repositories yet. <a href="#/new" class="text-accent hover:underline">Create one</a></div>'}
          </div>
        </div>
      </div>
    </div>`;

  if (isMe) {
    document.getElementById('editProfileBtn').onclick = () => editProfileModal(api, user);
  } else if (api.state.user) {
    document.getElementById('followBtn').onclick = async () => {
      const me = await DB.get('users', api.state.user.username);
      me.following = me.following || [];
      user.followers = user.followers || [];
      const idx = followers.indexOf(me.username);
      if (idx >= 0) { user.followers.splice(idx, 1); me.following = me.following.filter(u => u !== user.username); }
      else { user.followers.push(me.username); me.following.push(user.username); }
      await DB.put('users', user);
      await DB.put('users', me);
      api.state.user = me;
      api.refresh();
    };
  }
}

function repoRow(r) {
  return `
    <a href="#/repo/${r.id}" class="card p-3 block hover:border-accent/50 transition">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-sm font-semibold text-accent">${esc(r.name)}</span>
        ${r.isPrivate ? '<span class="badge badge-default">Private</span>' : ''}
      </div>
      <div class="text-xs text-muted mb-2">${esc(r.description || 'No description')}</div>
      <div class="flex items-center gap-3 text-xs text-muted">
        <span><span class="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>JavaScript</span>
        <span>⭐ ${r.stars || 0}</span>
        <span>🍴 ${r.forks || 0}</span>
        <span>Updated ${timeAgo(r.updatedAt || r.createdAt)}</span>
      </div>
    </a>`;
}

function repoCard(r) {
  return `
    <a href="#/repo/${r.id}" class="card p-3 block hover:border-accent/50">
      <div class="text-sm font-semibold text-accent mb-1">${esc(r.name)}</div>
      <div class="text-xs text-muted line-clamp-2">${esc(r.description || 'No description')}</div>
    </a>`;
}

function editProfileModal(api, user) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">Edit profile</h2>
          <button class="close text-muted hover:text-white text-xl leading-none">&times;</button>
        </div>
        <label class="label">Name</label>
        <input id="pName" class="input mb-3" value="${esc(user.name)}" />
        <label class="label">Bio</label>
        <textarea id="pBio" class="input mb-3">${esc(user.bio)}</textarea>
        <label class="label">Company</label>
        <input id="pCompany" class="input mb-3" value="${esc(user.company || '')}" />
        <label class="label">Location</label>
        <input id="pLocation" class="input mb-3" value="${esc(user.location || '')}" />
        <label class="label">Website</label>
        <input id="pWebsite" class="input mb-3" value="${esc(user.website || '')}" />
        <label class="label">Status emoji</label>
        <input id="pEmoji" class="input mb-3" value="${esc(user.status?.emoji || '')}" placeholder="🚀" maxlength="2" />
        <label class="label">Status text</label>
        <input id="pStatus" class="input mb-3" value="${esc(user.status?.text || '')}" placeholder="Building things" />
        <div class="flex justify-end gap-2 mt-4">
          <button class="close btn-ghost">Cancel</button>
          <button id="pSave" class="btn-primary">Save</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('.close').forEach(b => b.onclick = () => root.innerHTML = '');
  document.getElementById('pSave').onclick = async () => {
    user.name = document.getElementById('pName').value;
    user.bio = document.getElementById('pBio').value;
    user.company = document.getElementById('pCompany').value;
    user.location = document.getElementById('pLocation').value;
    user.website = document.getElementById('pWebsite').value;
    user.status = {
      emoji: document.getElementById('pEmoji').value,
      text: document.getElementById('pStatus').value
    };
    await DB.put('users', user);
    api.state.user = user;
    root.innerHTML = '';
    api.toast('Profile saved', 'success');
    api.refresh();
  };
}
