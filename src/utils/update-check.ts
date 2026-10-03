/**
 * Update check
 *
 * Users install from a git clone of the default branch or from a Claude Desktop extension
 * (.mcpb) built from it, so the newest version is the `version` in that branch's package.json. MCP clients rarely surface server logs, so a
 * pending update is reported to the assistant inside the next tool response instead.
 */

import { CHANGELOG_URL, RELEASES_URL, UPDATE_CHECK_URL } from '../config/config.js';
import { logger } from './logger.js';

const CHECK_TIMEOUT_MS = 3000;

/** True when `candidate` is a higher x.y.z version than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string) => version.split('-')[0].split('.').map((part) => Number(part) || 0);
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Fetch the latest version and return it when it is newer than `currentVersion`.
 * Any failure (offline, timeout, bad response) returns null: the check must never
 * affect the server. Uses plain fetch so no TimeTree cookies are sent to GitHub.
 */
export async function fetchNewerVersion(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  try {
    const response = await fetchImpl(UPDATE_CHECK_URL, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const { version } = (await response.json()) as { version?: unknown };
    if (typeof version !== 'string') return null;

    return isNewerVersion(version, currentVersion) ? version : null;
  } catch (error) {
    logger.debug('Update check skipped', { error });
    return null;
  }
}

/**
 * The .mcpb manifest sets TIMETREE_INSTALL_SOURCE=mcpb; those installs have no git folder
 * to pull, so they are pointed at the release download instead.
 */
export function formatUpdateNotice(
  currentVersion: string,
  latestVersion: string,
  installSource: string | undefined = process.env.TIMETREE_INSTALL_SOURCE
): string {
  const howTo =
    installSource === 'mcpb'
      ? [
          `To update: download the latest timetree-mcp .mcpb file from ${RELEASES_URL}`,
          'and open it to reinstall the Claude Desktop extension.',
        ]
      : [
          'To update: re-run the TimeTree MCP installer, or run `git pull origin main && npm ci && npm run build`',
          'in the TimeTree-MCP folder, then restart the MCP client.',
        ];
  return [
    `[TimeTree MCP update available: ${currentVersion} -> ${latestVersion}]`,
    'Please tell the user about this update in your reply.',
    ...howTo,
    `What changed: ${CHANGELOG_URL}`,
  ].join('\n');
}
