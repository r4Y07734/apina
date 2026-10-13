// Keep Wrangler's writable state inside the checkout in restricted cloud workspaces.
// Explicit configuration, logging, telemetry, and authentication bindings take precedence.
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const directory = import.meta.dirname;
const env = { ...process.env };
env.XDG_CONFIG_HOME ||= join(directory, '.wrangler', 'config');
env.WRANGLER_LOG_PATH ||= join(directory, '.wrangler', 'logs');
env.WRANGLER_SEND_METRICS ||= 'false';

const child = spawn(process.execPath, [
  join(directory, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  ...process.argv.slice(2),
], { cwd: directory, env, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { child.kill(signal); });
}
child.on('error', error => {
  console.error(`Could not start Wrangler: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
});
