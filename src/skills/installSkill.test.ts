import {afterEach, describe, expect, test} from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  GENERATED_SKILL_NAME,
  installWiizAuthorSkill
} from './installSkill.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiz-skill-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})));
});

describe('installWiizAuthorSkill', () => {
  test('creates SKILL.md in .agents/skills', async () => {
    const rootDir = await makeTempDir();

    const result = await installWiizAuthorSkill({rootDir});

    expect(result.created).toBe(true);
    expect(result.skillName).toBe(GENERATED_SKILL_NAME);

    const content = await fs.readFile(result.skillFile, 'utf8');
    expect(content).toContain('name: wiiz-yaml-author');
    expect(content).toContain('Generate .wiiz/wizard.yaml');
    expect(content).toContain('Use `match` to branch into one nested path');
    expect(content).toContain('Use `group` to bundle nested steps');
    expect(content).toContain('If the `wiiz` binary is installed, use it directly.');
    expect(content).toContain('Use `wiiz help list` (or `bunx wiiz help list` / `npx wiiz help list`)');
    expect(content).toContain('`bunx wiiz help list` / `npx wiiz help list`');
    expect(content).toContain('run `wiiz help <primitive>`');
    expect(content).toContain('equivalent `bunx` / `npx` form');
    expect(content).toContain('With `overwrite: true`, `env.write` updates known keys');
    expect(content).toContain('In non-interactive (`--values`) runs, `command.run` is skipped by default.');
    expect(content).toContain('When a trustworthy default is known, set `input.default`');
    expect(content).toContain('leaving the field empty will use that default');
    expect(content).toContain('Write prompt messages as actionable instructions, not labels.');
    expect(content).toContain('add nearby `note` or `display` guidance');
    expect(content).toContain('Reuse real defaults when they exist; otherwise use realistic placeholders.');
    expect(content).toContain('Do not reference variables that are collected only inside one `match` branch');
    expect(content).toContain('Minimal `match` example');
    expect(content).toContain('Minimal `group` example');
    expect(content).not.toContain('Keep flow sequential (no branching).');
  });

  test('does not overwrite existing skill by default', async () => {
    const rootDir = await makeTempDir();
    const first = await installWiizAuthorSkill({rootDir});

    await fs.writeFile(first.skillFile, 'custom', 'utf8');

    const second = await installWiizAuthorSkill({rootDir});
    expect(second.created).toBe(false);

    const content = await fs.readFile(first.skillFile, 'utf8');
    expect(content).toBe('custom');
  });

  test('overwrites when force is true', async () => {
    const rootDir = await makeTempDir();
    const first = await installWiizAuthorSkill({rootDir});

    await fs.writeFile(first.skillFile, 'custom', 'utf8');

    const second = await installWiizAuthorSkill({rootDir, force: true});
    expect(second.created).toBe(true);

    const content = await fs.readFile(first.skillFile, 'utf8');
    expect(content).toContain('wiiz YAML Author');
    expect(content).toContain('`wiiz validate --config .wiiz/wizard.yaml`');
    expect(content).toContain('`bunx wiiz validate --config .wiiz/wizard.yaml`');
    expect(content).toContain('`npx wiiz validate --config .wiiz/wizard.yaml`');
  });
});
