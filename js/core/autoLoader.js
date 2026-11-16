export async function loadModules(api) {
  let manifest;
  try {
    manifest = (await import('../../modules/manifest.js')).default;
  } catch (e) {
    console.warn('[autoLoader] No manifest found:', e);
    return;
  }
  if (!Array.isArray(manifest)) return;

  for (const name of manifest) {
    try {
      const mod = await import(`../../modules/${name}.js`);
      const plugin = mod.default || mod;
      if (plugin && typeof plugin.register === 'function') {
        await plugin.register(api);
        console.log(`[autoLoader] Loaded module: ${plugin.id || name}`);
      } else {
        console.warn(`[autoLoader] Module ${name} has no register() export`);
      }
    } catch (e) {
      console.error(`[autoLoader] Failed to load ${name}:`, e);
    }
  }
}
