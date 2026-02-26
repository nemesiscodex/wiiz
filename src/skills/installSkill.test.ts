import {afterEach, describe, expect, test} from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  GENERATED_SKILL_NAME,
  installRepoOnboardAuthorSkill
} from './installSkill.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-onboard-skill-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})));
});

describe('installRepoOnboardAuthorSkill', () => {
  test('creates SKILL.md in .agents/skills', async () => {
    const rootDir = await makeTempDir();

    const result = await installRepoOnboardAuthorSkill({rootDir});

    expect(result.created).toBe(true);
    expect(result.skillName).toBe(GENERATED_SKILL_NAME);

    const content = await fs.readFile(result.skillFile, 'utf8');
    expect(content).toContain('name: repo-onboard-yaml-author');
    expect(content).toContain('Generate .onboard/wizard.yaml');
  });

  test('does not overwrite existing skill by default', async () => {
    const rootDir = await makeTempDir();
    const first = await installRepoOnboardAuthorSkill({rootDir});

    await fs.writeFile(first.skillFile, 'custom', 'utf8');

    const second = await installRepoOnboardAuthorSkill({rootDir});
    expect(second.created).toBe(false);

    const content = await fs.readFile(first.skillFile, 'utf8');
    expect(content).toBe('custom');
  });

  test('overwrites when force is true', async () => {
    const rootDir = await makeTempDir();
    const first = await installRepoOnboardAuthorSkill({rootDir});

    await fs.writeFile(first.skillFile, 'custom', 'utf8');

    const second = await installRepoOnboardAuthorSkill({rootDir, force: true});
    expect(second.created).toBe(true);

    const content = await fs.readFile(first.skillFile, 'utf8');
    expect(content).toContain('Repo Onboard YAML Author');
  });
});
