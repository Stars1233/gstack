import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
  scripts: Record<string, string>;
};

// Strip single-quoted strings so JS code emitted as `echo '{ ... }'` doesn't
// trip the shell-brace-group check. Conservative: only `'...'` segments.
function stripSingleQuoted(s: string): string {
  return s.replace(/'[^']*'/g, "''");
}

describe('package.json build scripts — POSIX shell compat (D-1460)', () => {
  // Bun's Windows shell parser doesn't grok bash brace groups `{ cmd; }`.
  // Subshells `( cmd )` are POSIX-universal. This test prevents regression.
  test('no bash brace groups in any npm script', () => {
    const offending: { script: string; pattern: string }[] = [];
    for (const [name, body] of Object.entries(PKG.scripts)) {
      const stripped = stripSingleQuoted(body);
      const match = stripped.match(/\{\s+[^}]*;\s*\}/);
      if (match) {
        offending.push({ script: name, pattern: match[0] });
      }
    }
    expect(offending).toEqual([]);
  });

  test('every `> path/.version` redirect is preceded by a subshell, not a brace group', () => {
    // The original PR #1460 target: package.json line 12 had three of these.
    const build = PKG.scripts.build ?? '';
    const versionRedirects = [...build.matchAll(/(\([^)]*\)|\{[^}]*\})\s*>\s*\S+\/\.version/g)];
    expect(versionRedirects.length).toBeGreaterThan(0);
    for (const m of versionRedirects) {
      expect(m[1].startsWith('(')).toBe(true);
    }
  });
});
