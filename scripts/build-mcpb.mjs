// Build the Claude Desktop extension (MCP Bundle, .mcpb).
//
// The bundle is a zip that Claude Desktop installs with one click. It must run without
// `npm install`, so the server and its dependencies are bundled into a single file.
// Output: build/timetree-mcp-<version>.mcpb
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'tsup';

// Pinned so a release does not change because the packer did.
const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';

// fileURLToPath decodes spaces and non-ASCII characters and handles Windows drive letters.
const root = fileURLToPath(new URL('..', import.meta.url));
const stage = join(root, 'build', 'mcpb');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'mcpb', 'manifest.json'), 'utf8'));

if (manifest.version !== pkg.version) {
  throw new Error(`mcpb/manifest.json version ${manifest.version} does not match package.json ${pkg.version}`);
}

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

await build({
  entry: { index: 'src/index.ts' },
  outDir: join(stage, 'server'),
  format: ['esm'],
  platform: 'node',
  // Runs on the Node.js that ships with Claude Desktop (Node 24 as of Claude Desktop 2.9939).
  target: 'node22',
  // Bundle every dependency: the extension has no node_modules.
  noExternal: [/.*/],
  // Bundled CommonJS dependencies still call require().
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  dts: false,
  sourcemap: false,
  clean: true,
  silent: true,
});

// Mark the bundle as ESM without shipping the project's package.json.
writeFileSync(join(stage, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`);
cpSync(join(root, 'mcpb', 'manifest.json'), join(stage, 'manifest.json'));
cpSync(join(root, 'mcpb', 'icon.png'), join(stage, 'icon.png'));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));

const output = join(root, 'build', `timetree-mcp-${pkg.version}.mcpb`);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(npx, ['--yes', MCPB_CLI, 'validate', join(stage, 'manifest.json')], { stdio: 'inherit' });
execFileSync(npx, ['--yes', MCPB_CLI, 'pack', stage, output], { stdio: 'inherit' });

console.log(`\nBuilt ${output}`);
