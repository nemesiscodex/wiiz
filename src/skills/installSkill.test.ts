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
  });
});
