import { DB } from '../core/db.js';

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  return `${Math.floor(d/86400)}d ago`;
}
function labelClass(label) {
  const l = label.toLowerCase();
  if (l.includes('bug')) return 'badge-bug';
  if (l.includes('urgent')) return 'badge-urgent';
  if (l.includes('feature') || l.includes('enhancement')) return 'badge-feature';
  if (l.includes('help')) return 'badge-help';
  return 'badge-default';
}

const ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`;
const PR_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6M18 6a6 6 0 016 6v6"/></svg>`;

async function renderIssues(api, owner, name) {
  const repoId = `${owner}/${name}`;
  const repo = await DB.get('repos', repoId);
  if (!repo) { document.getElementById('app').innerHTML = '<div class="text-center py-20 text-muted">Repository not found</div>'; return; }
  const issues = await DB.getIssues(repoId);
  const open = issues.filter(i => i.status === 'open');
  const closed = issues.filter(i => i.status === 'closed');

  api.state.repo = repo;
  const branches = await DB.getBranches(repoId);
  const tabs = [
    { id: 'code', label: 'Code', href: `#/repo/${repoId}` },
    { id: 'preview', label: 'Live Preview', href: `#/repo/${repoId}/preview` },
    ...api.repoTabs.map(t => ({ id: t.id, label: t.label, href: t.getHref(repoId), icon: t.icon })),
    { id: 'settings', label: 'Settings', href: `#/repo/${repoId}/settings` }
  ];

  document.getElementById('app').innerHTML = `
    <div class="fade-in">
      <div class="flex items-center gap-3 mb-3">
        <a href="#/profile/${repo.owner}" class="text-accent hover:underline text-sm">${esc(repo.owner)}</a>
        <span class="text-muted">/</span>
        <a href="#/repo/${repoId}" class="text-white font-semibold hover:underline">${esc(repo.name)}</a>
        <span class="badge badge-default">${repo.isPrivate ? 'Private' : 'Public'}</span>
      </div>
      <div class="border-b border-border mb-4">
        <div class="tab-strip">
          ${tabs.map(t => `<a href="${t.href}" class="px-3 py-2 text-sm border-b-2 ${t.id === 'issues' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}">${t.icon || ''} ${t.label}</a>`).join('')}
        </div>
      </div>

      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3 text-sm">
          <span class="text-white font-semibold">${open.length} Open</span>
          <span class="text-muted">${closed.length} Closed</span>
        </div>
        <button id="newIssueBtn" class="btn-primary text-xs">New issue</button>
      </div>

      <div class="space-y-2">
        ${issues.length ? issues.map(i => `
          <div class="card p-3 flex items-start gap-3 cursor-pointer hover:border-accent/50" data-issue="${i.id}">
            <div class="mt-0.5">${i.status === 'open' ? '<span class="text-green-400">●</span>' : '<span class="text-purple-400">●</span>'}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold text-white">${esc(i.title)}</span>
                ${(i.labels || []).map(l => `<span class="badge ${labelClass(l)}">${esc(l)}</span>`).join('')}
              </div>
              <div class="text-xs text-muted mt-1">#${i.number} opened ${timeAgo(i.createdAt)} by ${esc(i.author)}</div>
            </div>
          </div>
        `).join('') : '<div class="text-sm text-muted text-center py-8">No issues yet</div>'}
      </div>
    </div>`;

  document.getElementById('newIssueBtn').onclick = () => openIssueModal(api, repo, () => renderIssues(api, owner, name));
  document.querySelectorAll('[data-issue]').forEach(el => {
    el.onclick = () => openIssueDetail(api, repo, el.dataset.issue, () => renderIssues(api, owner, name));
  });
}

function openIssueModal(api, repo, onDone) {
  if (!api.state.user) return api.toast('Login first', 'error');
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">New issue</h2>
          <button class="close text-muted hover:text-white text-xl">&times;</button>
        </div>
        <label class="label">Title</label>
        <input id="iTitle" class="input mb-3" placeholder="Bug: something is broken" />
        <label class="label">Description (Markdown)</label>
        <textarea id="iBody" class="input mb-3" rows="5" placeholder="Describe the issue…"></textarea>
        <label class="label">Labels</label>
        <div class="flex flex-wrap gap-2 mb-4">
          ${['bug', 'feature', 'urgent', 'help wanted'].map(l => `
            <label class="flex items-center gap-1.5 text-xs bg-panel border border-border rounded-full px-3 py-1 cursor-pointer">
              <input type="checkbox" value="${l}" class="accent-accent" data-label />
              ${l}
            </label>
          `).join('')}
        </div>
        <div class="flex justify-end gap-2">
          <button class="close btn-ghost">Cancel</button>
          <button id="submitIssue" class="btn-primary">Open issue</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('.close').forEach(b => b.onclick = () => root.innerHTML = '');
  document.getElementById('submitIssue').onclick = async () => {
    const title = document.getElementById('iTitle').value.trim();
    const body = document.getElementById('iBody').value.trim();
    if (!title) return;
    const labels = Array.from(root.querySelectorAll('[data-label]:checked')).map(c => c.value);
    await DB.createIssue(repo.id, api.state.user.username, title, body, labels);
    root.innerHTML = '';
    api.toast('Issue opened', 'success');
    onDone();
  };
}

async function openIssueDetail(api, repo, issueId, onDone) {
  const issue = await DB.get('issues', issueId);
  if (!issue) return;
  const comments = await DB.getComments(issueId);
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box wide">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-lg font-semibold text-white">${esc(issue.title)}</h2>
            <div class="text-xs text-muted">#${issue.number} · ${issue.status} · opened by ${esc(issue.author)} · ${timeAgo(issue.createdAt)}</div>
          </div>
          <button class="close text-muted hover:text-white text-xl">&times;</button>
        </div>
        <div class="flex gap-2 mb-3">
          ${(issue.labels || []).map(l => `<span class="badge ${labelClass(l)}">${l}</span>`).join('')}
        </div>
        <div class="markdown bg-bg border border-border rounded-lg p-3 mb-4">${marked.parse(issue.body || '_No description_')}</div>

        <h3 class="text-sm font-semibold text-white mb-2">Comments (${comments.length})</h3>
        <div class="space-y-2 mb-3 max-h-64 overflow-y-auto">
          ${comments.map(c => `
            <div class="bg-panel border border-border rounded-lg p-3">
              <div class="text-xs text-muted mb-1">${esc(c.author)} · ${timeAgo(c.createdAt)}</div>
              <div class="markdown text-sm">${marked.parse(c.body)}</div>
            </div>
          `).join('') || '<div class="text-xs text-muted">No comments yet</div>'}
        </div>
        <textarea id="newComment" class="input" rows="2" placeholder="Leave a comment…"></textarea>
        <div class="flex justify-between mt-3">
          <button id="toggleStatus" class="btn-ghost text-xs">${issue.status === 'open' ? 'Close issue' : 'Reopen issue'}</button>
          <div class="flex gap-2">
            <button class="close btn-ghost">Close</button>
            <button id="postComment" class="btn-primary">Comment</button>
          </div>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('.close').forEach(b => b.onclick = () => root.innerHTML = '');
  document.getElementById('postComment').onclick = async () => {
    const body = document.getElementById('newComment').value.trim();
    if (!body) return;
    await DB.addComment(issueId, api.state.user.username, body);
    openIssueDetail(api, repo, issueId, onDone);
  };
  document.getElementById('toggleStatus').onclick = async () => {
    issue.status = issue.status === 'open' ? 'closed' : 'open';
    await DB.updateIssue(issue);
    root.innerHTML = '';
    onDone();
  };
}

async function renderPulls(api, owner, name) {
  const repoId = `${owner}/${name}`;
  const repo = await DB.get('repos', repoId);
  if (!repo) return;
  const prs = await DB.getPRs(repoId);
  api.state.repo = repo;
  const tabs = [
    { id: 'code', label: 'Code', href: `#/repo/${repoId}` },
    { id: 'preview', label: 'Live Preview', href: `#/repo/${repoId}/preview` },
    ...api.repoTabs.map(t => ({ id: t.id, label: t.label, href: t.getHref(repoId), icon: t.icon })),
    { id: 'settings', label: 'Settings', href: `#/repo/${repoId}/settings` }
  ];
  document.getElementById('app').innerHTML = `
    <div class="fade-in">
      <div class="flex items-center gap-3 mb-3">
        <a href="#/profile/${repo.owner}" class="text-accent hover:underline text-sm">${esc(repo.owner)}</a>
        <span class="text-muted">/</span>
        <a href="#/repo/${repoId}" class="text-white font-semibold hover:underline">${esc(repo.name)}</a>
      </div>
      <div class="border-b border-border mb-4">
        <div class="tab-strip">
          ${tabs.map(t => `<a href="${t.href}" class="px-3 py-2 text-sm border-b-2 ${t.id === 'pulls' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}">${t.icon || ''} ${t.label}</a>`).join('')}
        </div>
      </div>
      <div class="flex items-center justify-between mb-4">
        <div class="text-sm text-white font-semibold">${prs.length} pull requests</div>
        <button id="newPrBtn" class="btn-primary text-xs">New pull request</button>
      </div>
      <div class="space-y-2">
        ${prs.length ? prs.map(p => `
          <div class="card p-3">
            <div class="text-sm font-semibold text-white">${esc(p.title)}</div>
            <div class="text-xs text-muted mt-1">#${p.number} · ${esc(p.fromBranch)} → ${esc(p.toBranch)} · by ${esc(p.author)} · ${timeAgo(p.createdAt)}</div>
          </div>
        `).join('') : '<div class="text-sm text-muted text-center py-8">No pull requests yet</div>'}
      </div>
    </div>`;
  document.getElementById('newPrBtn').onclick = async () => {
    if (!api.state.user) return api.toast('Login first', 'error');
    const branches = (await DB.getBranches(repoId)).map(b => b.name);
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-overlay"><div class="modal-box">
        <div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold text-white">New pull request</h2><button class="close text-muted hover:text-white text-xl">&times;</button></div>
        <label class="label">Title</label>
        <input id="prTitle" class="input mb-3" placeholder="Add new feature" />
        <label class="label">Description</label>
        <textarea id="prBody" class="input mb-3" rows="3"></textarea>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div><label class="label">From</label><select id="prFrom" class="input">${branches.map(b => `<option>${b}</option>`).join('')}</select></div>
          <div><label class="label">To</label><select id="prTo" class="input">${branches.map(b => `<option ${b === 'main' ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
        </div>
        <div class="flex justify-end gap-2"><button class="close btn-ghost">Cancel</button><button id="submitPr" class="btn-primary">Create</button></div>
      </div></div>`;
    root.querySelectorAll('.close').forEach(b => b.onclick = () => root.innerHTML = '');
    document.getElementById('submitPr').onclick = async () => {
      await DB.createPR(repoId, api.state.user.username, document.getElementById('prTitle').value, document.getElementById('prBody').value, document.getElementById('prFrom').value, document.getElementById('prTo').value);
      root.innerHTML = '';
      api.toast('PR created', 'success');
      renderPulls(api, owner, name);
    };
  };
}

export default {
  id: 'issues',
  async register(api) {
    api.addRepoTab({ id: 'issues', label: 'Issues', icon: ICON, getHref: (id) => `#/repo/${id}/issues` });
    api.addRepoTab({ id: 'pulls', label: 'Pull Requests', icon: PR_ICON, getHref: (id) => `#/repo/${id}/pulls` });
    api.addRoute(/^#\/repo\/([^/]+)\/([^/]+)\/issues$/, (o, n) => renderIssues(api, o, n));
    api.addRoute(/^#\/repo\/([^/]+)\/([^/]+)\/pulls$/, (o, n) => renderPulls(api, o, n));
  }
};
