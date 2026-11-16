const POLLINATIONS = 'https://text.pollinations.ai';

async function callPollinations(prompt, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${POLLINATIONS}/${encodeURIComponent(prompt)}`, {
      signal: controller.signal,
      method: 'GET',
      headers: { 'Accept': 'text/plain' }
    });
    if (!res.ok) throw new Error('AI request failed');
    const text = (await res.text()).trim();
    if (!text) throw new Error('Empty response');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function detectLanguage(path) {
  const ext = (path || '').split('.').pop().toLowerCase();
  return {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    html: 'html', css: 'css', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', sh: 'shell', c: 'c', cpp: 'cpp', h: 'c'
  }[ext] || 'plaintext';
}

function localCommitMessage(files = []) {
  if (!files.length) return 'chore: update files';
  const names = files.map(f => (typeof f === 'string' ? f : f.path));
  const hasDocs = names.some(n => /\.(md|txt)$/i.test(n));
  const hasCss = names.some(n => n.endsWith('.css'));
  const hasJs = names.some(n => /\.(js|ts|jsx|tsx)$/i.test(n));
  const hasHtml = names.some(n => n.endsWith('.html'));
  const parts = [];
  if (hasHtml) parts.push('update markup');
  if (hasCss) parts.push('styles');
  if (hasJs) parts.push('logic');
  if (hasDocs) parts.push('docs');
  if (parts.length) return `feat: refine ${parts.join(' & ')}`;
  const base = names[0].split('/').pop();
  return `chore: update ${base}`;
}

function localExplain(code, lang) {
  const lines = code.split('\n');
  const fnCount = (code.match(/function |=>|def |class /g) || []).length;
  const imports = (code.match(/^import |^const .* = require|^from /gm) || []).length;
  return [
    `**Static analysis (offline fallback)**`,
    ``,
    `- **Language:** ${lang || 'unknown'}`,
    `- **Total lines:** ${lines.length}`,
    `- **Function/class definitions:** ${fnCount}`,
    `- **Import/require statements:** ${imports}`,
    ``,
    `**Suggested improvements:**`,
    `- Add JSDoc / docstrings for exported symbols.`,
    `- Extract long functions into smaller units.`,
    `- Use \`const\` over \`let\` where variables are not reassigned.`,
    `- Consider error boundaries around async operations.`
  ].join('\n');
}

function localReadme(repo, files) {
  const name = repo.name;
  const desc = repo.description || 'A modern project built on NexusGit.';
  const langs = new Set();
  for (const f of files) {
    const ext = f.path.split('.').pop();
    if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) langs.add('JavaScript');
    if (ext === 'py') langs.add('Python');
    if (ext === 'go') langs.add('Go');
    if (ext === 'rs') langs.add('Rust');
    if (ext === 'html') langs.add('HTML');
    if (ext === 'css') langs.add('CSS');
  }
  const badges = [
    `![status](https://img.shields.io/badge/status-active-brightgreen)`,
    `![license](https://img.shields.io/badge/license-MIT-blue)`,
    `![version](https://img.shields.io/badge/version-1.0.0-purple)`
  ].join(' ');

  return `# ${name}\n\n${badges}\n\n${desc}\n\n## ✨ Features\n\n- Modern architecture\n- Developer-first tooling\n- AI-powered workflows\n- Full Git support\n\n## 📦 Installation\n\n\`\`\`bash\ngit clone https://nexusgit.dev/${repo.owner}/${name}.git\ncd ${name}\nnpm install\n\`\`\`\n\n## 🚀 Usage\n\n\`\`\`bash\nnpm run dev\n\`\`\`\n\n## 🗂 Structure\n\n${files.slice(0, 12).map(f => `- \`${f.path}\``).join('\n')}\n\n## 🛠 Tech\n\n${[...langs].map(l => `- ${l}`).join('\n') || '- Universal'}\n\n## 📄 License\n\nMIT © ${repo.owner}\n`;
}

function localChat(question, context = {}) {
  const files = context.files || [];
  const q = question.toLowerCase();
  let hits = files.filter(f => q.split(/\s+/).some(w => w.length > 3 && f.path.toLowerCase().includes(w)));
  if (!hits.length) hits = files.slice(0, 3);
  return `**Offline analysis**\n\nI scanned ${files.length} files. Here's what I found:\n\n${hits.map(f => `- \`${f.path}\` (${(f.content || '').length} chars)`).join('\n')}\n\n**Answer:** Based on the repository structure, this appears to be a project composed of ${new Set(files.map(f => f.path.split('.').pop())).size} file types. Try asking more specifically about a function or file.`;
}

export const AI = {
  async generate(prompt) {
    try {
      return await callPollinations(prompt);
    } catch (e) {
      return null;
    }
  },

  async commitMessage(files) {
    const names = files.map(f => (typeof f === 'string' ? f : f.path));
    const prompt = `You are a senior engineer. Generate a single-line professional Git commit message (conventional commits format, max 72 chars, no quotes, no markdown) for changes touching: ${names.join(', ')}. Reply with ONLY the commit message.`;
    const res = await this.generate(prompt);
    if (res) return res.split('\n')[0].replace(/^["'`]|["'`]$/g, '').slice(0, 72);
    return localCommitMessage(files);
  },

  async explainCode(code, path) {
    const lang = detectLanguage(path);
    const prompt = `You are a senior code reviewer. Explain and suggest bug fixes/optimizations for the following ${lang} file in concise markdown. Code:\n\n\`\`\`${lang}\n${code.slice(0, 4000)}\n\`\`\``;
    const res = await this.generate(prompt);
    if (res) return res;
    return localExplain(code, lang);
  },

  async generateReadme(repo, files) {
    const tree = files.slice(0, 25).map(f => f.path).join('\n');
    const prompt = `You are a technical writer. Generate a complete, professional README.md in markdown for a repository named "${repo.name}" (${repo.description || 'no description'}). Include badges, features, installation, usage, folder structure, tech stack, and license. File tree:\n${tree}`;
    const res = await this.generate(prompt);
    if (res) return res;
    return localReadme(repo, files);
  },

  async chat(question, context = {}) {
    const files = context.files || [];
    const repoName = context.repo ? `${context.repo.owner}/${context.repo.name}` : 'the repository';
    const sample = files.slice(0, 6).map(f => `--- ${f.path} ---\n${(f.content || '').slice(0, 800)}`).join('\n\n');
    const prompt = `You are NexusGit Copilot, a helpful coding assistant. Answer concisely in markdown. Context for ${repoName}:\n\n${sample}\n\nUser question: ${question}`;
    const res = await this.generate(prompt);
    if (res) return res;
    return localChat(question, context);
  }
};
