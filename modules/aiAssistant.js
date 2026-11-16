import { AI } from '../core/keylessAI.js';
import { DB } from '../core/db.js';

const ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>`;

async function renderAiTab(api, owner, name) {
  const repoId = `${owner}/${name}`;
  const repo = await DB.get('repos', repoId);
  if (!repo) return;
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
        <a href="#/profile/${repo.owner}" class="text-accent hover:underline text-sm">${repo.owner}</a>
        <span class="text-muted">/</span>
        <a href="#/repo/${repoId}" class="text-white font-semibold hover:underline">${repo.name}</a>
      </div>
      <div class="border-b border-border mb-4">
        <div class="tab-strip">
          ${tabs.map(t => `<a href="${t.href}" class="px-3 py-2 text-sm border-b-2 ${t.id === 'ai' ? 'border-accent text-white' : 'border-transparent text-muted hover:text-white'}">${t.icon || ''} ${t.label}</a>`).join('')}
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-white mb-3">🤖 AI Tools</h3>
          <div class="space-y-2">
            <button id="genReadme" class="w-full btn-ghost justify-start">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
              Generate README.md
            </button>
            <button id="explainRepo" class="w-full btn-ghost justify-start">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
              Explain this repository
            </button>
            <button id="suggestTests" class="w-full btn-ghost justify-start">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Suggest tests
            </button>
          </div>
        </div>
        <div class="card p-4">
          <h3 class="text-sm font-semibold text-white mb-3">Quick actions</h3>
          <p class="text-xs text-muted mb-3">Press <kbd class="px-1.5 py-0.5 rounded bg-panel2 border border-border text-[10px]">Ctrl+I</kbd> to open the floating Copilot anywhere.</p>
          <button id="openDrawer" class="btn-primary w-full">Open Copilot Drawer</button>
        </div>
      </div>
      <div id="aiOutput" class="mt-4"></div>
    </div>`;

  const showOutput = (title, text) => {
    document.getElementById('aiOutput').innerHTML = `
      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold text-white">${title}</h3>
          <button id="copyAi" class="btn-ghost text-xs">Copy</button>
        </div>
        <div class="markdown bg-bg border border-border rounded-lg p-3 max-h-96 overflow-y-auto">${marked.parse(text)}</div>
      </div>`;
    document.getElementById('copyAi').onclick = () => { navigator.clipboard.writeText(text); api.toast('Copied', 'success'); };
  };

  const loadFiles = async () => DB.getFiles(repoId, repo.defaultBranch || 'main');

  document.getElementById('genReadme').onclick = async () => {
    const out = document.getElementById('aiOutput');
    out.innerHTML = `<div class="card p-4 text-sm text-muted"><span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin mr-2"></span>Generating README…</div>`;
    const files = await loadFiles();
    const text = await AI.generateReadme(repo, files);
    showOutput('Generated README.md', text);
    const btn = document.createElement('button');
    btn.className = 'btn-primary mt-3';
    btn.textContent = '💾 Save as README.md';
    btn.onclick = async () => {
      await DB.saveFile(repoId, repo.defaultBranch || 'main', 'README.md', text);
      api.toast('README saved!', 'success');
    };
    out.querySelector('.card').appendChild(btn);
  };
  document.getElementById('explainRepo').onclick = async () => {
    const files = await loadFiles();
    const summary = files.map(f => `${f.path}\n${(f.content || '').slice(0, 200)}`).join('\n\n');
    document.getElementById('aiOutput').innerHTML = `<div class="card p-4 text-sm text-muted"><span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin mr-2"></span>Analyzing…</div>`;
    const text = await AI.explainCode(summary, 'repository');
    showOutput('Repository overview', text);
  };
  document.getElementById('suggestTests').onclick = async () => {
    const files = await loadFiles();
    const sample = files.slice(0, 3).map(f => `--- ${f.path} ---\n${f.content.slice(0, 500)}`).join('\n');
    document.getElementById('aiOutput').innerHTML = `<div class="card p-4 text-sm text-muted"><span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin mr-2"></span>Thinking…</div>`;
    const res = await AI.generate(`Suggest a comprehensive test plan and example test snippets for this repository. Use markdown.\n\n${sample}`);
    showOutput('Suggested tests', res || 'Could not generate tests.');
  };
  document.getElementById('openDrawer').onclick = () => openDrawer(api);
}

function openDrawer(api) {
  let drawer = document.getElementById('aiDrawerRoot');
  if (drawer) { drawer.classList.add('open'); return; }
  const root = document.createElement('div');
  root.id = 'aiDrawerRoot';
  root.className = 'ai-drawer';
  root.innerHTML = `
    <div class="p-4 border-b border-border flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center text-white text-xs">✨</div>
        <span class="text-sm font-semibold text-white">NexusGit Copilot</span>
      </div>
      <button id="closeDrawer" class="text-muted hover:text-white text-xl leading-none">&times;</button>
    </div>
    <div id="aiChatLog" class="flex-1 overflow-y-auto p-3 space-y-3"></div>
    <div class="p-3 border-t border-border">
      <div class="flex gap-2">
        <input id="aiChatInput" class="input flex-1" placeholder="Ask anything about this repo…" />
        <button id="aiChatSend" class="btn-primary px-3">→</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  requestAnimationFrame(() => root.classList.add('open'));
  document.getElementById('closeDrawer').onclick = () => root.classList.remove('open');

  const log = document.getElementById('aiChatLog');
  const input = document.getElementById('aiChatInput');

  const addMsg = (role, html) => {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';
    div.innerHTML = `<div class="max-w-[85%] rounded-lg px-3 py-2 text-sm ${role === 'user' ? 'bg-accent text-white' : 'bg-panel border border-border text-gray-200 markdown'}">${role === 'user' ? html.replace(/</g, '&lt;') : html}</div>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  addMsg('assistant', 'Hi! I\'m your Copilot. Ask me anything about this repo — try "explain the folder structure" or "how do I run this?".');

  const send = async () => {
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    addMsg('user', q);
    const loading = document.createElement('div');
    loading.className = 'flex justify-start';
    loading.innerHTML = `<div class="bg-panel border border-border rounded-lg px-3 py-2 text-sm text-muted"><span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin"></span> Thinking…</div>`;
    log.appendChild(loading);
    log.scrollTop = log.scrollHeight;

    let files = [];
    if (api.state.repo) {
      files = await DB.getFiles(api.state.repo.id, api.state.branch || 'main');
    }
    const answer = await AI.chat(q, { repo: api.state.repo, files });
    loading.remove();
    addMsg('assistant', marked.parse(answer));
  };

  document.getElementById('aiChatSend').onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  setTimeout(() => input.focus(), 150);
}

export default {
  id: 'aiAssistant',
  async register(api) {
    api.addRepoTab({ id: 'ai', label: '✨ AI Copilot', icon: ICON, getHref: (id) => `#/repo/${id}/ai` });
    api.addRoute(/^#\/repo\/([^/]+)\/([^/]+)\/ai$/, (o, n) => renderAiTab(api, o, n));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        openDrawer(api);
      }
    });
  }
};
