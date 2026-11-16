const DB_NAME = 'nexusgit';
const DB_VERSION = 1;

let _db = null;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('users')) {
        const s = db.createObjectStore('users', { keyPath: 'username' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('repos')) {
        const s = db.createObjectStore('repos', { keyPath: 'id' });
        s.createIndex('owner', 'owner');
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'id' });
        s.createIndex('repoId', 'repoId');
        s.createIndex('repoBranch', ['repoId', 'branch']);
      }
      if (!db.objectStoreNames.contains('commits')) {
        const s = db.createObjectStore('commits', { keyPath: 'sha' });
        s.createIndex('repoId', 'repoId');
        s.createIndex('repoBranch', ['repoId', 'branch']);
        s.createIndex('timestamp', 'timestamp');
      }
      if (!db.objectStoreNames.contains('branches')) {
        const s = db.createObjectStore('branches', { keyPath: 'id' });
        s.createIndex('repoId', 'repoId');
      }
      if (!db.objectStoreNames.contains('issues')) {
        const s = db.createObjectStore('issues', { keyPath: 'id' });
        s.createIndex('repoId', 'repoId');
        s.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('prs')) {
        const s = db.createObjectStore('prs', { keyPath: 'id' });
        s.createIndex('repoId', 'repoId');
      }
      if (!db.objectStoreNames.contains('comments')) {
        const s = db.createObjectStore('comments', { keyPath: 'id' });
        s.createIndex('targetId', 'targetId');
      }
      if (!db.objectStoreNames.contains('contributions')) {
        const s = db.createObjectStore('contributions', { keyPath: 'id' });
        s.createIndex('username', 'username');
        s.createIndex('date', 'date');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sha1(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const DB = {
  async init() {
    if (!_db) await open();
    return _db;
  },

  async put(store, obj) { return wrap(tx(store, 'readwrite').put(obj)); },
  async get(store, key) { return wrap(tx(store).get(key)); },
  async getAll(store) { return wrap(tx(store).getAll()); },
  async getAllBy(store, index, value) { return wrap(tx(store).index(index).getAll(value)); },
  async delete(store, key) { return wrap(tx(store, 'readwrite').delete(key)); },
  async clear(store) { return wrap(tx(store, 'readwrite').clear()); },

  async seed() {
    const users = await DB.getAll('users');
    if (users.length > 0) return;

    const demo = {
      username: 'octocat',
      name: 'The Octocat',
      email: 'octocat@nexus.git',
      bio: 'Building the future of code collaboration • Principal @NexusGit',
      location: 'San Francisco, CA',
      company: '@nexusgit',
      website: 'https://nexusgit.dev',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=octocat&backgroundColor=7c3aed',
      status: { emoji: '🚀', text: 'Shipping AI features' },
      followers: ['dev_alice', 'dev_bob', 'dev_carol'],
      following: ['dev_alice'],
      pinned: ['octocat/nexus-demo'],
      createdAt: Date.now()
    };
    await DB.put('users', demo);

    for (const extra of [
      { username: 'dev_alice', name: 'Alice Chen', bio: 'Frontend wizard', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=alice&backgroundColor=06b6d4', followers: ['octocat'], following: ['octocat'], pinned: [], createdAt: Date.now() },
      { username: 'dev_bob', name: 'Bob Rivers', bio: 'Backend engineer', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=bob&backgroundColor=ec4899', followers: [], following: [], pinned: [], createdAt: Date.now() },
      { username: 'dev_carol', name: 'Carol Mendes', bio: 'DevOps & Cloud', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=carol&backgroundColor=10b981', followers: [], following: [], pinned: [], createdAt: Date.now() }
    ]) {
      await DB.put('users', extra);
    }

    await DB.createRepo('octocat', 'nexus-demo', false, 'A stunning demo repository showcasing NexusGit capabilities', [
      { path: 'README.md', content: '# Nexus Demo\n\nWelcome to **NexusGit** — the AI-powered developer platform.\n\n## Features\n\n- 🚀 Monaco Editor\n- 🤖 Keyless AI Copilot\n- 📦 ZIP import/export\n- 🌿 Full Git branches\n- 💬 Issues & PRs\n\n## Quick Start\n\n```bash\nnpm install\nnpm run dev\n```\n' },
      { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Nexus Demo</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div class="hero">\n    <h1>Hello, NexusGit ✨</h1>\n    <p>This page is rendered live from your repository files.</p>\n    <button id="btn">Click me</button>\n  </div>\n  <script src="app.js"><\\/script>\n</body>\n</html>\n' },
      { path: 'styles.css', content: 'body { margin: 0; font-family: system-ui; background: #0a0a0f; color: #e5e7eb; display: flex; align-items: center; justify-content: center; min-height: 100vh; }\n.hero { text-align: center; }\nh1 { font-size: 3rem; background: linear-gradient(135deg, #a78bfa, #06b6d4); -webkit-background-clip: text; color: transparent; }\nbutton { padding: 0.6rem 1.2rem; border-radius: 8px; border: none; background: #7c3aed; color: white; font-weight: 600; cursor: pointer; }\n' },
      { path: 'app.js', content: 'document.getElementById("btn").addEventListener("click", () => {\n  alert("Hello from NexusGit live sandbox!");\n});\n' },
      { path: 'src/utils/helpers.js', content: 'export const greet = (name) => `Hello, ${name}!`;\nexport const sum = (...nums) => nums.reduce((a, b) => a + b, 0);\n' },
      { path: '.gitignore', content: 'node_modules/\n.DS_Store\n*.log\n.env\n' }
    ]);

    await DB.createRepo('dev_alice', 'react-toolkit', false, 'Opinionated React utilities for modern apps', [
      { path: 'README.md', content: '# react-toolkit\n\nA collection of hooks and components.\n\n## Install\n\n```bash\nnpm i @alice/react-toolkit\n```\n' },
      { path: 'index.js', content: 'export * from "./hooks";\nexport * from "./components";\n' },
      { path: 'hooks/useDebounce.js', content: 'export function useDebounce(value, delay = 300) {\n  const [v, setV] = React.useState(value);\n  React.useEffect(() => {\n    const t = setTimeout(() => setV(value), delay);\n    return () => clearTimeout(t);\n  }, [value, delay]);\n  return v;\n}\n' }
    ]);

    await DB.createRepo('dev_bob', 'api-gateway', true, 'Private microservices gateway', [
      { path: 'README.md', content: '# API Gateway\n\nPrivate service mesh gateway.\n' },
      { path: 'server.js', content: 'const express = require("express");\nconst app = express();\napp.use(express.json());\napp.get("/health", (req, res) => res.json({ ok: true }));\napp.listen(8080);\n' }
    ]);

    const demoRepos = await DB.getAllBy('repos', 'owner', 'octocat');
    const mainRepo = demoRepos[0];
    await DB.createIssue(mainRepo.id, 'octocat', 'Add dark mode toggle', 'Currently the UI is always dark. We should allow users to switch.', ['feature']);
    await DB.createIssue(mainRepo.id, 'dev_alice', 'Broken link in README', 'The quick start link returns 404.', ['bug']);
    await DB.createIssue(mainRepo.id, 'octocat', 'Add contribution graph export', 'Users want to export their 365-day heatmap as PNG.', ['feature', 'help wanted']);

    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = isoDate(d);
      const r = Math.random();
      let count = 0;
      if (r > 0.55) count = Math.floor(Math.random() * 12) + 1;
      if (count > 0) {
        await DB.put('contributions', { id: `octocat:${key}`, username: 'octocat', date: key, count });
      }
    }
    for (let i = 0; i < 90; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = isoDate(d);
      if (Math.random() > 0.7) {
        await DB.put('contributions', { id: `dev_alice:${key}`, username: 'dev_alice', date: key, count: Math.floor(Math.random() * 6) + 1 });
      }
    }
  },

  async createUser(username, data) {
    const existing = await DB.get('users', username);
    if (existing) throw new Error('Username already taken');
    const user = {
      username,
      name: data.name || username,
      email: data.email || '',
      bio: data.bio || '',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      followers: [],
      following: [],
      pinned: [],
      status: { emoji: '', text: '' },
      createdAt: Date.now()
    };
    await DB.put('users', user);
    return user;
  },

  async createRepo(owner, name, isPrivate, description, initialFiles = null) {
    const id = `${owner}/${name}`;
    const existing = await DB.get('repos', id);
    if (existing) throw new Error('Repository already exists');

    const repo = {
      id, owner, name, isPrivate: !!isPrivate,
      description: description || '',
      stars: 0, forks: 0, watchers: 0,
      defaultBranch: 'main',
      language: 'JavaScript',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await DB.put('repos', repo);

    await DB.put('branches', { id: `${id}:main`, repoId: id, name: 'main', createdAt: Date.now(), isDefault: true });

    const files = initialFiles || [
      { path: 'README.md', content: `# ${name}\n\n${description || 'A new NexusGit repository.'}\n` },
      { path: '.gitignore', content: 'node_modules/\n.env\n*.log\n.DS_Store\n' },
      { path: 'LICENSE', content: 'MIT License\n\nCopyright (c) ' + new Date().getFullYear() + ' ' + owner + '\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software…\n' }
    ];

    await DB.commit(id, 'main', files, 'Initial commit', owner);
    await DB.recordContribution(owner, 1);
    return repo;
  },

  async commit(repoId, branch, files, message, author) {
    const now = Date.now();
    const tree = files.map(f => ({ path: f.path, content: f.content })).sort((a, b) => a.path.localeCompare(b.path));
    const sha = await sha1(`${repoId}:${branch}:${now}:${message}:${JSON.stringify(tree)}`);

    for (const f of files) {
      await DB.put('files', {
        id: `${repoId}:${branch}:${f.path}`,
        repoId, branch, path: f.path, content: f.content, updatedAt: now
      });
    }

    const commit = { sha, repoId, branch, message, author, timestamp: now, files: tree.map(f => f.path) };
    await DB.put('commits', commit);
    if (author) await DB.recordContribution(author, 1);
    return sha;
  },

  async getFiles(repoId, branch = 'main') {
    return DB.getAllBy('files', 'repoBranch', [repoId, branch]);
  },

  async getFile(repoId, branch, path) {
    return DB.get('files', `${repoId}:${branch}:${path}`);
  },

  async saveFile(repoId, branch, path, content) {
    const id = `${repoId}:${branch}:${path}`;
    const existing = await DB.get('files', id);
    return DB.put('files', {
      id, repoId, branch, path, content,
      updatedAt: Date.now(),
      createdAt: existing ? existing.createdAt : Date.now()
    });
  },

  async deleteFile(repoId, branch, path) {
    return DB.delete('files', `${repoId}:${branch}:${path}`);
  },

  async getCommits(repoId, branch = null) {
    if (!branch) return DB.getAllBy('commits', 'repoId', repoId);
    const all = await DB.getAllBy('commits', 'repoBranch', [repoId, branch]);
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },

  async getBranches(repoId) {
    return DB.getAllBy('branches', 'repoId', repoId);
  },

  async createBranch(repoId, name, fromBranch = 'main', author = 'octocat') {
    const id = `${repoId}:${name}`;
    const existing = await DB.get('branches', id);
    if (existing) throw new Error('Branch exists');
    const files = await DB.getFiles(repoId, fromBranch);
    const parentCommits = await DB.getCommits(repoId, fromBranch);
    await DB.put('branches', { id, repoId, name, createdAt: Date.now(), isDefault: false });
    for (const f of files) {
      await DB.put('files', {
        id: `${repoId}:${name}:${f.path}`,
        repoId, branch: name, path: f.path, content: f.content, updatedAt: Date.now()
      });
    }
    for (const c of parentCommits) {
      const newSha = await sha1(`${repoId}:${name}:${c.sha}:${c.timestamp}`);
      await DB.put('commits', { ...c, sha: newSha, branch: name });
    }
    if (author) await DB.recordContribution(author, 1);
    return DB.get('branches', id);
  },

  async recordContribution(username, count = 1) {
    const d = today();
    const id = `${username}:${d}`;
    const existing = await DB.get('contributions', id);
    await DB.put('contributions', {
      id, username, date: d,
      count: (existing ? existing.count : 0) + count
    });
  },

  async getContributions(username, days = 365) {
    const all = await DB.getAllBy('contributions', 'username', username);
    const map = {};
    for (const c of all) map[c.date] = c.count;
    return map;
  },

  async getContributionTotal(username) {
    const all = await DB.getAllBy('contributions', 'username', username);
    return all.reduce((s, c) => s + c.count, 0);
  },

  async createIssue(repoId, author, title, body, labels = []) {
    const all = await DB.getAllBy('issues', 'repoId', repoId);
    const num = all.length + 1;
    const id = `${repoId}#${num}`;
    const issue = {
      id, repoId, number: num, author, title, body,
      labels: labels.length ? labels : ['enhancement'],
      status: 'open', createdAt: Date.now(),
      comments: []
    };
    await DB.put('issues', issue);
    await DB.recordContribution(author, 1);
    return issue;
  },

  async updateIssue(issue) {
    return DB.put('issues', issue);
  },

  async getIssues(repoId) {
    const all = await DB.getAllBy('issues', 'repoId', repoId);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  async createPR(repoId, author, title, body, fromBranch, toBranch) {
    const all = await DB.getAllBy('prs', 'repoId', repoId);
    const num = all.length + 1;
    const id = `${repoId}!${num}`;
    const pr = {
      id, repoId, number: num, author, title, body,
      fromBranch, toBranch, status: 'open',
      createdAt: Date.now(), comments: []
    };
    await DB.put('prs', pr);
    await DB.recordContribution(author, 1);
    return pr;
  },

  async getPRs(repoId) {
    const all = await DB.getAllBy('prs', 'repoId', repoId);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },

  async addComment(targetId, author, body) {
    const id = `${targetId}:c${Date.now()}`;
    const comment = { id, targetId, author, body, createdAt: Date.now() };
    await DB.put('comments', comment);
    return comment;
  },

  async getComments(targetId) {
    const all = await DB.getAllBy('comments', 'targetId', targetId);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  async toggleStar(repoId, username) {
    const repo = await DB.get('repos', repoId);
    if (!repo) return;
    repo.starred = repo.starred || [];
    const idx = repo.starred.indexOf(username);
    if (idx >= 0) { repo.starred.splice(idx, 1); repo.stars = Math.max(0, repo.stars - 1); }
    else { repo.starred.push(username); repo.stars++; }
    await DB.put('repos', repo);
    return repo;
  },

  async forkRepo(repoId, forkerUsername) {
    const repo = await DB.get('repos', repoId);
    if (!repo) throw new Error('Repo not found');
    const newId = `${forkerUsername}/${repo.name}`;
    if (await DB.get('repos', newId)) throw new Error('You already forked this repo');

    const newRepo = {
      ...repo, id: newId, owner: forkerUsername,
      stars: 0, forks: 0, watchers: 0,
      forkedFrom: repoId,
      createdAt: Date.now(), updatedAt: Date.now(),
      starred: []
    };
    await DB.put('repos', newRepo);

    const branches = await DB.getBranches(repoId);
    for (const b of branches) {
      const files = await DB.getFiles(repoId, b.name);
      const commits = await DB.getCommits(repoId, b.name);
      await DB.put('branches', { id: `${newId}:${b.name}`, repoId: newId, name: b.name, createdAt: Date.now(), isDefault: b.isDefault });
      for (const f of files) {
        await DB.put('files', {
          id: `${newId}:${b.name}:${f.path}`,
          repoId: newId, branch: b.name, path: f.path, content: f.content, updatedAt: Date.now()
        });
      }
      for (const c of commits) {
        const newSha = await sha1(`${newId}:${b.name}:${c.sha}:${c.timestamp}`);
        await DB.put('commits', { ...c, sha: newSha, repoId: newId });
      }
    }
    repo.forks = (repo.forks || 0) + 1;
    await DB.put('repos', repo);
    await DB.recordContribution(forkerUsername, 1);
    return newRepo;
  },

  async buildTree(repoId, branch = 'main') {
    const files = await DB.getFiles(repoId, branch);
    const root = { name: '', path: '', type: 'dir', children: {} };
    for (const f of files) {
      const parts = f.path.split('/');
      let node = root;
      let cumulative = '';
      for (let i = 0; i < parts.length; i++) {
        cumulative = cumulative ? `${cumulative}/${parts[i]}` : parts[i];
        const isFile = i === parts.length - 1;
        if (!node.children[parts[i]]) {
          node.children[parts[i]] = {
            name: parts[i], path: cumulative,
            type: isFile ? 'file' : 'dir',
            children: isFile ? null : {},
            content: isFile ? f.content : null
          };
        }
        node = node.children[parts[i]];
        if (node.type === 'file') break;
      }
    }
    return root;
  },

  async touchRepo(repoId) {
    const repo = await DB.get('repos', repoId);
    if (repo) { repo.updatedAt = Date.now(); await DB.put('repos', repo); }
  }
};

export { DB, sha1 };
