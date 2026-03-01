import {afterEach, describe, expect, test} from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {PromptStep} from '../config/types.js';
import {parseEnvLine} from './envFile.js';
import {formatEnvPrefillPreview, loadEnvPrefillValue, maskEnvValue} from './envPrefill.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiz-env-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})));
});

describe('maskEnvValue', () => {
  test('masks value showing first two chars', () => {
    expect(maskEnvValue('secret-token')).toBe('se**');
    expect(maskEnvValue('a')).toBe('a**');
    expect(maskEnvValue('')).toBe('**');
  });
});

describe('formatEnvPrefillPreview', () => {
  test('masks by default for input when sensitive is undefined', () => {
    const step: PromptStep = {
      id: 'token',
      type: 'input',
      message: 'Token',
      var: 'TOKEN'
    };
    expect(formatEnvPrefillPreview(step, 'abcdef')).toBe('ab**');
  });

  test('shows full value when sensitive is false', () => {
    const step: PromptStep = {
      id: 'mode',
      type: 'select',
      message: 'Mode',
      var: 'MODE',
      sensitive: false,
      options: [
        {label: 'dev', value: 'development'},
        {label: 'prod', value: 'production'}
      ]
    };
    expect(formatEnvPrefillPreview(step, 'development')).toBe('development');
  });

  test('masks by default for select when sensitive is undefined', () => {
    const step: PromptStep = {
      id: 'mode',
      type: 'select',
      message: 'Mode',
      var: 'MODE',
      options: [
        {label: 'dev', value: 'development'},
        {label: 'prod', value: 'production'}
      ]
    };
    expect(formatEnvPrefillPreview(step, 'development')).toBe('de**');
  });
});

describe('loadEnvPrefillValue', () => {
  test('reads value from configured envFile and envKey', async () => {
    const cwd = await makeTempDir();
    await fs.writeFile(path.join(cwd, '.custom.env'), 'API_KEY=abcdef\n', 'utf8');

    const step: PromptStep = {
      id: 'api-key',
      type: 'input',
      message: 'API key',
      var: 'API_KEY',
      envFile: '.custom.env'
    };

    const loaded = await loadEnvPrefillValue(step, cwd);
    expect(loaded?.value).toBe('abcdef');
    expect(loaded?.envKey).toBe('API_KEY');
  });

  test('returns undefined when env file is missing', async () => {
    const cwd = await makeTempDir();
    const step: PromptStep = {
      id: 'api-key',
      type: 'input',
      message: 'API key',
      var: 'API_KEY',
      envFile: '.missing.env'
    };

    const loaded = await loadEnvPrefillValue(step, cwd);
    expect(loaded).toBeUndefined();
  });

  test('supports envKey override', async () => {
    const cwd = await makeTempDir();
    await fs.writeFile(path.join(cwd, '.env'), 'CUSTOM_NAME=julio\n', 'utf8');

    const step: PromptStep = {
      id: 'name',
      type: 'input',
      message: 'Name',
      var: 'NAME',
      envFile: '.env',
      envKey: 'CUSTOM_NAME'
    };

    const loaded = await loadEnvPrefillValue(step, cwd);
    expect(loaded?.value).toBe('julio');
    expect(loaded?.envKey).toBe('CUSTOM_NAME');
  });

  test('reads export statements and quoted values', async () => {
    const cwd = await makeTempDir();
    await fs.writeFile(path.join(cwd, '.env'), 'export APP_NAME="repo onboard"\n', 'utf8');

    const step: PromptStep = {
      id: 'app-name',
      type: 'input',
      message: 'App name',
      var: 'APP_NAME',
      envFile: '.env'
    };

    const loaded = await loadEnvPrefillValue(step, cwd);
    expect(loaded?.value).toBe('repo onboard');
  });
});

describe('parseEnvLine', () => {
  test('ignores comments and strips wrapping quotes', () => {
    expect(parseEnvLine('# comment')).toBeUndefined();
    expect(parseEnvLine(' export API_KEY = "abc 123" ')).toEqual({key: 'API_KEY', value: 'abc 123'});
  });
});
