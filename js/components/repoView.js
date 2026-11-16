import { DB } from '../core/db.js';
import { renderFileTree, mountEditor, mountDiff, renderCommitModal, commitFiles, detectLang } from './editor.js';
import { AI } from '../core/keylessAI.js';

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  if (d < 86400) return `${Math.floor(d/3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d/86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

export async function renderRepo(api, owner, name, subview = '', extra = '') {
  const repoId = `${owner}/${name}`;
  const repo = await DB.get('repos', repoId);
  const app = document.getElementById('app');
  if (!repo) {
    app.innerHTML = `<div class="text-center py-20"><h2 class="text-2xl font-semibold text-white mb-2">Repository not found</h2><p class="text-muted">${esc(repoId)}</p><a href="#/" class="btn-primary mt-4 inline-flex">Go home</a></div>`;
    return;
  }
  api.state.repo = repo;
  const branches = await DB.getBranches(repoId);
  const branchList = branches.map(b => b.name);
  let currentBranch = api.state.branch || 'main';
  if (extra) currentBranch = extra;
  if (!branchList.includes(currentBranch)) currentBranch = 'main';
  api.state.branch = currentBranch;

  const commits = await DB.getCommits(repoId, currentBranch);
  const latest = commits[0];

  const tabs = [
    { id: 'code', label: 'Code', href: `#/repo/${repoId}` },
    { id: 'preview', label: 'Live Preview', href: `#/repo/${repoId}/preview` },
    ...api.repoTabs.map(t => ({ id: t.id, label: t.label, href: t.getHref(repoId), icon: t.icon })),
    { id: 'settings', label: 'Settings', href: `#/repo/${repoId}/settings` }
  ];
  const activeTab = subview || 'code';

  app.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center gap-3 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b9e" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
        <div class="text-sm"><a href="#/profile/${repo.owner}" class="text-accent hover:underline">${esc(repo.owner)}</a> <span class="text-muted">/</span> <a href="#/repo/${repoId}" class="text-white font-semibold hover:underline">${esc(repo.name)}</a></div>
        ${repo.isPrivate ? '<span class="badge badge-default">Private</span>' : '<span class="badge badge-default">Public</span>'}
        ${repo.forkedFrom ? `<span class="text-xs text-muted">forked from <a href="#/repo/${repo.forkedFrom}" class="text-accent hover:underline">${esc(repo.forkedFrom)}</a></span>` : ''}
      </div>
      <p class="text-sm text-muted mb-4">${esc(repo.description || 'No description')}</p>

      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <button id="starBtn" class="btn-ghost ${repo.starred?.includes(api.state.user?.username) ? 'text-yellow-400' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${repo.starred?.includes(api.state.user?.username) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
          Star <span id="starCount">${repo.stars || 0}</span>
        </button>
        <button id="forkBtn" class="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M6 9v3a3 3 0 003 3h6a3 3 0 003-3V9M12 15v3"/></svg>
          Fork <span>${repo.forks || 0}</span>
        </button>
        <button id="zipBtn" class="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          Download ZIP
        </button>
        <button id="uploadBtn" class="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Upload
        </button>
        <input id="uploadInput" type="file" multiple webkitdirectory class="hidden" />
      </div>

      <div class="border-b border-border mb-4">
        <div class="tab-strip">
          ${tabs.map(t => `<a href="${t.href}" class="px-3 py-2 text-sm border-b-2 ${activeTab === t.id ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}">${t.icon || ''} ${t.label}</a>`).join('')}
        </div>
      </div>

      <div id="repoSubView"></div>
    </div>`;

  document.getElementById('starBtn').onclick = async () => {
    if (!api.state.user) return api.toast('Login first', 'error');
    await DB.toggleStar(repoId, api.state.user.username);
    renderRepo(api, owner, name, subview, extra);
  };
  document.getElementById('forkBtn').onclick = async () => {
    if (!api.state.user) return api.toast('Login first', 'error');
    try {
      const newRepo = await DB.forkRepo(repoId, api.state.user.username);
      api.toast('Forked!', 'success');
      api.navigate(`#/repo/${newRepo.id}`);
    } catch (e) { api.toast(e.message, 'error'); }
  };
  document.getElementById('zipBtn').onclick = () => downloadZip(repoId, currentBranch);
  document.getElementById('uploadBtn').onclick = () => document.getElementById('uploadInput').click();
  document.getElementById('uploadInput').onchange = async (e) => {
    const fs = Array.from(e.target.files);
    if (!fs.length) return;
    const files = [];
    for (const file of fs) {
      const content = await file.text();
      files.push({ path: file.webkitRelativePath || file.name, content });
    }
    const names = files.map(f => f.path);
    renderCommitModal({
      repoId, branch: currentBranch, files: names,
      onCommit: async (msg) => {
        await commitFiles(repoId, currentBranch, files, msg, api.state.user.username);
        api.toast('Files uploaded', 'success');
        renderRepo(api, owner, name, subview, extra);
      }
    });
  };

  const sub = document.getElementById('repoSubView');
  if (activeTab === 'code') await renderCodeTab(api, repo, currentBranch, branchList, sub, extra);
  else if (activeTab === 'preview') await renderPreviewTab(repo, currentBranch, sub);
  else if (activeTab === 'settings') await renderSettingsTab(api, repo, sub);
}

async function renderCodeTab(api, repo, branch, branchList, container, extra) {
  const repoId = repo.id;
  const commits = await DB.getCommits(repoId, branch);
  const latest = commits[0];
  const files = await DB.getFiles(repoId, branch);
  const activePath = extra || null;
  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="lg:col-span-1 card p-3">
        <div class="flex items-center gap-2 mb-3">
          <select id="branchSelect" class="input text-xs py-1 flex-1">
            ${branchList.map(b => `<option value="${b}" ${b === branch ? 'selected' : ''}>🌿 ${b}</option>`).join('')}
          </select>
          <button id="newBranchBtn" class="btn-ghost text-xs px-2 py-1" title="New branch">+</button>
        </div>
        <div id="fileTree" class="text-sm"></div>
        <button id="newFileBtn" class="w-full mt-3 btn-ghost text-xs">+ New file</button>
      </div>
      <div class="lg:col-span-3 card p-3">
        ${latest ? `
          <div class="flex items-center justify-between mb-3 pb-3 border-b border-border">
            <div class="flex items-center gap-2 text-sm">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(latest.author)}" class="w-6 h-6 rounded-full" />
              <span class="text-white font-medium">${esc(latest.author)}</span>
              <span class="text-muted">${esc(latest.message)}</span>
              <span class="text-xs text-muted">· ${timeAgo(latest.timestamp)}</span>
            </div>
            <span class="font-mono text-xs text-muted">${latest.sha.slice(0, 7)}</span>
          </div>
        ` : ''}
        <div id="editorContainer"></div>
      </div>
    </div>
    <div class="mt-4 card p-4">
      <h3 class="text-sm font-semibold text-white mb-3">Commit history</h3>
      <div id="commitList" class="space-y-2 max-h-64 overflow-y-auto">
        ${commits.length ? commits.map(c => `
          <div class="flex items-center gap-3 text-xs py-1.5 border-b border-border/50">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(c.author)}" class="w-5 h-5 rounded-full" />
            <span class="text-white font-medium w-24 truncate">${esc(c.author)}</span>
            <span class="text-gray-300 flex-1 truncate">${esc(c.message)}</span>
            <span class="font-mono text-muted">${c.sha.slice(0, 7)}</span>
            <span class="text-muted">${timeAgo(c.timestamp)}</span>
          </div>
        `).join('') : '<div class="text-xs text-muted">No commits yet</div>'}
      </div>
    </div>`;

  document.getElementById('branchSelect').onchange = (e) => {
    api.state.branch = e.target.value;
    api.navigate(`#/repo/${repoId}/tree/${e.target.value}`);
  };
  document.getElementById('newBranchBtn').onclick = async () => {
    const name = prompt('New branch name:');
    if (!name) return;
    try {
      await DB.createBranch(repoId, name, branch, api.state.user.username);
      api.toast('Branch created', 'success');
      renderRepo(api, repo.owner, repo.name, 'code', name);
    } catch (e) { api.toast(e.message, 'error'); }
  };
  document.getElementById('newFileBtn').onclick = async () => {
    const path = prompt('File path (e.g. src/App.js):');
    if (!path) return;
    await DB.saveFile(repoId, branch, path, '');
    api.navigate(`#/repo/${repoId}/tree/${branch}/${path}`);
  };

  const treeEl = document.getElementById('fileTree');
  const editorEl = document.getElementById('editorContainer');
  let editor = null;
  let currentPath = activePath || files[0]?.path || null;

  async function loadFile(path) {
    currentPath = path;
    api.state.currentFile = path;
    history.replaceState(null, '', `#/repo/${repoId}/tree/${branch}/${path}`);
    const file = await DB.getFile(repoId, branch, path);
    if (!file) return;
    editorEl.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-accent font-mono">${esc(path)}</span>
        </div>
        <div class="flex items-center gap-1">
          <button id="aiExplainBtn" class="btn-ghost text-xs" title="AI explain & fix"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg> Explain</button>
          <button id="deleteFileBtn" class="btn-ghost text-xs text-red-400">Delete</button>
          <button id="saveFileBtn" class="btn-primary text-xs">Commit</button>
        </div>
      </div>
      <div id="monacoHost" class="monaco-host"></div>
      <div id="aiPanel" class="hidden mt-3 p-3 bg-panel2 border border-border rounded-lg markdown text-sm"></div>`;
    editor = await mountEditor(document.getElementById('monacoHost'), { value: file.content, path });
    document.getElementById('saveFileBtn').onclick = async () => {
      const newContent = editor.getValue();
      const names = [path];
      renderCommitModal({
        repoId, branch, files: names,
        onCommit: async (msg) => {
          await commitFiles(repoId, branch, [{ path, content: newContent }], msg, api.state.user.username);
          api.toast('Committed', 'success');
          renderRepo(api, repo.owner, repo.name, 'code', branch);
        }
      });
    };
    document.getElementById('deleteFileBtn').onclick = async () => {
      if (!confirm(`Delete ${path}?`)) return;
      await DB.deleteFile(repoId, branch, path);
      api.toast('Deleted', 'success');
      renderRepo(api, repo.owner, repo.name, 'code', branch);
    };
    document.getElementById('aiExplainBtn').onclick = async () => {
      const panel = document.getElementById('aiPanel');
      panel.classList.remove('hidden');
      panel.innerHTML = '<div class="flex items-center gap-2 text-xs text-muted"><span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin"></span> Analyzing…</div>';
      const out = await AI.explainCode(editor.getValue(), path);
      panel.innerHTML = `<div class="text-xs text-muted mb-2">🤖 NexusGit Copilot</div><div class="markdown">${marked.parse(out)}</div>`;
    };
  }

  await renderFileTree(treeEl, {
    repoId, branch, activePath: currentPath,
    onSelect: loadFile
  });
  if (currentPath) await loadFile(currentPath);
  else editorEl.innerHTML = '<div class="text-center text-muted text-sm py-12">Select or create a file to start editing</div>';
}

async function renderPreviewTab(repo, branch, container) {
  const files = await DB.getFiles(repo.id, branch);
  const html = files.find(f => f.path === 'index.html');
  if (!html) {
    container.innerHTML = `<div class="card p-8 text-center"><div class="text-3xl mb-2">📄</div><div class="text-white font-semibold mb-1">No index.html found</div><div class="text-muted text-sm">Add an index.html file to enable live preview.</div></div>`;
    return;
  }
  let doc = html.content;
  const css = files.filter(f => f.path.endsWith('.css')).map(f => `<style>\n${f.content}\n</style>`).join('\n');
  const js = files.filter(f => f.path.endsWith('.js') && f.path !== 'index.html').map(f => `<script>\n${f.content}\n<\/script>`).join('\n');
  if (css) doc = doc.replace('</head>', css + '\n</head>');
  if (js) doc = doc.replace('</body>', js + '\n</body>');
  container.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm text-muted">Live sandbox · <span class="font-mono text-accent">${esc(branch)}</span></span>
      <button id="refreshPreview" class="btn-ghost text-xs">↻ Reload</button>
    </div>
    <iframe id="sandboxFrame" class="w-full rounded-lg border border-border bg-white" style="height:600px"></iframe>`;
  const iframe = document.getElementById('sandboxFrame');
  iframe.srcdoc = doc;
  document.getElementById('refreshPreview').onclick = () => { iframe.srcdoc = doc; };
}

async function renderSettingsTab(api, repo, container) {
  container.innerHTML = `
    <div class="card p-6 max-w-2xl">
      <h3 class="text-lg font-semibold text-white mb-4">Repository settings</h3>
      <label class="label">Repository name</label>
      <input id="setName" class="input mb-3" value="${esc(repo.name)}" />
      <label class="label">Description</label>
      <textarea id="setDesc" class="input mb-3">${esc(repo.description || '')}</textarea>
      <label class="flex items-center gap-2 mb-4">
        <input id="setPrivate" type="checkbox" ${repo.isPrivate ? 'checked' : ''} class="accent-accent" />
        <span class="text-sm">Private repository</span>
      </label>
      <div class="flex gap-2">
        <button id="saveSettings" class="btn-primary">Save</button>
        <button id="deleteRepo" class="btn-ghost text-red-400">Delete repository</button>
      </div>
    </div>`;
  document.getElementById('saveSettings').onclick = async () => {
    repo.name = document.getElementById('setName').value.trim() || repo.name;
    repo.description = document.getElementById('setDesc').value;
    repo.isPrivate = document.getElementById('setPrivate').checked;
    await DB.put('repos', repo);
    api.toast('Settings saved', 'success');
  };
  document.getElementById('deleteRepo').onclick = async () => {
    if (!confirm('Delete this repository permanently?')) return;
    await DB.delete('repos', repo.id);
    api.toast('Deleted', 'success');
    api.navigate('#/');
  };
}

async function downloadZip(repoId, branch) {
  const files = await DB.getFiles(repoId, branch);
  const zip = new JSZip();
  const folder = zip.folder(`${repoId.replace('/', '-')}-${branch}`);
  for (const f of files) folder.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${repoId.replace('/', '-')}-${branch}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { downloadZip, timeAgo };
