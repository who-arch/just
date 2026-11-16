import { DB } from '../core/db.js';
import { AI } from '../core/keylessAI.js';

let monacoInstance = null;

async function getMonaco() {
  if (monacoInstance) return monacoInstance;
  monacoInstance = await window.monacoReady;
  return monacoInstance;
}

function detectLanguage(path) {
  const ext = (path || '').split('.').pop().toLowerCase();
  return {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    html: 'html', css: 'css', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', sh: 'shell', c: 'c', cpp: 'cpp'
  }[ext] || 'plaintext';
}

function iconForFile(name) {
  if (name.endsWith('.js') || name.endsWith('.jsx')) return '🟨';
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return '🔷';
  if (name.endsWith('.html')) return '🟧';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.md')) return '📘';
  if (name.endsWith('.json')) return '📦';
  if (name.endsWith('.py')) return '🐍';
  return '📄';
}

export async function renderFileTree(container, { repoId, branch, activePath, onSelect }) {
  const tree = await DB.buildTree(repoId, branch);
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'space-y-0.5';

  function renderNode(node, depth = 0) {
    const children = Object.values(node.children || {}).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of children) {
      if (child.type === 'dir') {
        const group = document.createElement('div');
        const head = document.createElement('div');
        head.className = 'tree-item font-medium';
        head.style.paddingLeft = `${depth * 12 + 8}px`;
        head.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-accent"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg> ${child.name}`;
        const kids = document.createElement('div');
        kids.style.display = 'block';
        head.onclick = () => { kids.style.display = kids.style.display === 'none' ? 'block' : 'none'; };
        group.appendChild(head);
        group.appendChild(kids);
        const inner = document.createElement('div');
        renderNodeInto(inner, child, depth + 1, activePath, onSelect);
        kids.appendChild(inner);
        root.appendChild(group);
      } else {
        const item = document.createElement('div');
        item.className = 'tree-item' + (child.path === activePath ? ' active' : '');
        item.style.paddingLeft = `${depth * 12 + 8}px`;
        item.dataset.path = child.path;
        item.innerHTML = `<span>${iconForFile(child.name)}</span><span class="truncate">${child.name}</span>`;
        item.onclick = () => onSelect(child.path);
        root.appendChild(item);
      }
    }
  }
  renderNode(tree);
  container.appendChild(root);
}

async function renderNodeInto(container, dirNode, depth, activePath, onSelect) {
  const children = Object.values(dirNode.children || {}).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of children) {
    if (child.type === 'dir') {
      const head = document.createElement('div');
      head.className = 'tree-item font-medium';
      head.style.paddingLeft = `${depth * 12 + 8}px`;
      head.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" class="text-accent"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z"/></svg> ${child.name}`;
      const kids = document.createElement('div');
      head.onclick = () => { kids.style.display = kids.style.display === 'none' ? 'block' : 'none'; };
      container.appendChild(head);
      container.appendChild(kids);
      await renderNodeInto(kids, child, depth + 1, activePath, onSelect);
    } else {
      const item = document.createElement('div');
      item.className = 'tree-item' + (child.path === activePath ? ' active' : '');
      item.style.paddingLeft = `${depth * 12 + 8}px`;
      item.dataset.path = child.path;
      item.innerHTML = `<span>${iconForFile(child.name)}</span><span class="truncate">${child.name}</span>`;
      item.onclick = () => onSelect(child.path);
      container.appendChild(item);
    }
  }
}

export async function mountEditor(el, { value, path, readOnly = false }) {
  const monaco = await getMonaco();
  if (!monaco) {
    el.innerHTML = `<textarea class="w-full h-full bg-bg text-gray-200 font-mono text-sm p-3 outline-none" readonly>${value.replace(/</g, '&lt;')}</textarea>`;
    return null;
  }
  el.innerHTML = '';
  const editor = monaco.editor.create(el, {
    value,
    language: detectLanguage(path),
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13.5,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 20,
    scrollBeyondLastLine: false,
    readOnly,
    padding: { top: 12, bottom: 12 },
    smoothScrolling: true,
    renderLineHighlight: 'all',
    cursorBlinking: 'smooth'
  });
  return editor;
}

export async function mountDiff(el, { original, modified, path }) {
  const monaco = await getMonaco();
  if (!monaco) {
    el.innerHTML = `<div class="p-3 font-mono text-xs"><div class="diff-remove">- ${original.split('\n').join('<br>- ')}</div><div class="diff-add mt-2">+ ${modified.split('\n').join('<br>+ ')}</div></div>`;
    return;
  }
  el.innerHTML = '';
  const diffEditor = monaco.editor.createDiffEditor(el, {
    theme: 'vs-dark', automaticLayout: true, renderSideBySide: true,
    fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", readOnly: true
  });
  const lang = detectLanguage(path);
  diffEditor.setModel({
    original: monaco.editor.createModel(original, lang),
    modified: monaco.editor.createModel(modified, lang)
  });
  return diffEditor;
}

export function renderCommitModal({ repoId, branch, files, onCommit }) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-box fade-in">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">Commit changes</h2>
          <button class="close text-muted hover:text-white text-xl leading-none">&times;</button>
        </div>
        <p class="text-xs text-muted mb-3">${files.length} file${files.length > 1 ? 's' : ''} changed on <span class="text-accent font-mono">${branch}</span></p>
        <div class="mb-3">
          <div class="text-xs text-muted mb-1">Files</div>
          <div class="bg-bg border border-border rounded-lg p-2 max-h-32 overflow-y-auto text-xs font-mono">
            ${files.map(f => `<div class="text-gray-300">${iconForFile(f)} ${f}</div>`).join('')}
          </div>
        </div>
        <label class="label">Commit message</label>
        <div class="flex gap-2 mb-2">
          <input id="commitMsg" class="input flex-1" placeholder="feat: add new feature" autofocus />
          <button id="aiMsg" class="btn-ghost" title="AI-generate commit message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>
            AI
          </button>
        </div>
        <div id="aiMsgStatus" class="text-xs text-muted mb-3 hidden"></div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="close btn-ghost">Cancel</button>
          <button id="doCommit" class="btn-primary">Commit changes</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll('.close').forEach(b => b.onclick = () => root.innerHTML = '');
  root.querySelector('#aiMsg').onclick = async () => {
    const status = root.querySelector('#aiMsgStatus');
    status.classList.remove('hidden');
    status.innerHTML = '<span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full spin"></span> Generating…';
    const msg = await AI.commitMessage(files);
    root.querySelector('#commitMsg').value = msg;
    status.innerHTML = '✨ AI-generated. Edit if needed.';
  };
  root.querySelector('#doCommit').onclick = async () => {
    const msg = root.querySelector('#commitMsg').value.trim();
    if (!msg) return;
    root.innerHTML = '';
    await onCommit(msg);
  };
}

export async function commitFiles(repoId, branch, files, message, author) {
  await DB.commit(repoId, branch, files, message, author);
  await DB.touchRepo(repoId);
}

export function detectLang(path) { return detectLanguage(path); }
