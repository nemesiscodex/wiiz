import {afterEach, describe, expect, test} from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {main} from './cli.js';

type CapturedOutput = {
  logs: string[];
  errors: string[];
};

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-onboard-cli-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})));
});

async function captureOutput(run: () => Promise<number>): Promise<{code: number} & CapturedOutput> {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => logs.push(args.map(arg => String(arg)).join(' '));
  console.error = (...args: unknown[]) => errors.push(args.map(arg => String(arg)).join(' '));

  try {
    const code = await run();
    return {code, logs, errors};
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function buildValidConfig(targetDir: string): string {
  const writeTarget = path.join(targetDir, 'app.txt');
  const appendTarget = path.join(targetDir, 'notes.txt');
  const envTarget = path.join(targetDir, '.env');

  return [
    'version: 1',
    'name: CLI test config',
    'steps:',
    '  - id: ask-name',
    '    type: input',
    '    message: Enter name',
    '    var: NAME',
    '  - id: ask-env',
    '    type: select',
    '    message: Choose env',
    '    var: NODE_ENV',
    '    options:',
    '      - label: Development',
    '        value: development',
    '      - label: Production',
    '        value: production',
    '  - id: check-shell',
    '    type: command.check',
    '    command: sh',
    '  - id: install-deps',
    '    type: command.run',
    '    command: echo installing deps',
    '    consentMessage: Install dependencies now?',
    '  - id: write-file',
    '    type: file.write',
    `    path: ${writeTarget}`,
    '    content: "name={{NAME}}\\n"',
    '    overwrite: true',
    '  - id: append-file',
    '    type: file.append',
    `    path: ${appendTarget}`,
    '    content: "env={{NODE_ENV}}\\n"',
    '    createIfMissing: true',
    '  - id: write-env',
    '    type: env.write',
    `    path: ${envTarget}`,
    '    entries:',
    '      - key: NAME',
    '        value: "{{NAME}}"',
    '      - key: NODE_ENV',
    '        value: "{{NODE_ENV}}"',
    '    overwrite: true'
  ].join('\n');
}

describe('main command routing', () => {
  test('prints usage for help', async () => {
    const result = await captureOutput(() => main(['--help']));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Usage:');
  });

  test('prints helpful message for unknown command', async () => {
    const result = await captureOutput(() => main(['unknown']));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain("Unknown command 'unknown'");
  });

  test('validate is friendly when config is missing', async () => {
    const missingPath = path.join(await makeTempDir(), 'missing.yaml');
    const result = await captureOutput(() => main(['validate', '--config', missingPath]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('No onboarding config found yet.');
  });

  test('llm is friendly when config is missing', async () => {
    const missingPath = path.join(await makeTempDir(), 'missing.yaml');
    const result = await captureOutput(() => main(['llm', '--config', missingPath]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('LLM spec unavailable');
  });

  test('run is friendly when config is missing', async () => {
    const missingPath = path.join(await makeTempDir(), 'missing.yaml');
    const result = await captureOutput(() => main(['run', '--config', missingPath]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('No onboarding config found yet.');
  });
});

describe('validate command', () => {
  test('returns success for valid config', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');

    const result = await captureOutput(() => main(['validate', '--config', configPath]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Config is valid:');
  });

  test('returns non-zero for invalid config', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    await fs.writeFile(
      configPath,
      'version: 1\nname: Bad\nsteps:\n  - id: broken\n    type: nope\n',
      'utf8'
    );

    const result = await captureOutput(() => main(['validate', '--config', configPath]));
    expect(result.code).toBe(1);
    expect(result.errors.join('\n')).toContain('Config validation failed:');
  });
});

describe('llm command', () => {
  test('prints JSON description for valid config', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');

    const result = await captureOutput(() => main(['llm', '--config', configPath]));
    expect(result.code).toBe(0);

    const payload = JSON.parse(result.logs.join('\n'));
    expect(payload).toHaveProperty('version', 1);
    expect(payload).toHaveProperty('steps');
    expect(payload).toHaveProperty('operations');
    expect(payload).toHaveProperty('exampleValues');
  });
});

describe('run command', () => {
  test('supports dry-run with values file', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'app.txt');

    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');
    await fs.writeFile(
      valuesPath,
      JSON.stringify({NAME: 'julio', NODE_ENV: 'development'}, null, 2),
      'utf8'
    );

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath, '--dry-run'])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Run complete (dry-run).');

    const exists = await fs
      .access(outputFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  test('applies primitives with values file', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'app.txt');
    const appendFile = path.join(tempDir, 'notes.txt');
    const envFile = path.join(tempDir, '.env');

    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');
    await fs.writeFile(
      valuesPath,
      JSON.stringify({NAME: 'julio', NODE_ENV: 'production'}, null, 2),
      'utf8'
    );

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Run complete (applied).');

    const appContent = await fs.readFile(outputFile, 'utf8');
    const notesContent = await fs.readFile(appendFile, 'utf8');
    const envContent = await fs.readFile(envFile, 'utf8');

    expect(appContent).toContain('name=julio');
    expect(notesContent).toContain('env=production');
    expect(envContent).toContain('NAME=julio');
    expect(envContent).toContain('NODE_ENV=production');
  });

  test('reports missing values in non-interactive mode', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');

    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(1);
    expect(result.errors.join('\n')).toContain('Values validation failed:');
  });

  test('explains invalid JSON values file', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');

    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');
    await fs.writeFile(valuesPath, '{bad json', 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Unable to load values file');
    expect(result.logs.join('\n')).toContain('Provide a valid JSON file');
  });

  test('stops wizard when command.check dependency is missing', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');

    const config = [
      'version: 1',
      'name: Missing dependency',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: check-missing',
      '    type: command.check',
      '    command: __repo_onboard_missing_cmd__',
      '    installHint: Please install missing dependency first.',
      '  - id: write-file',
      '    type: file.write',
      `    path: ${path.join(tempDir, 'out.txt')}`,
      '    content: "hello {{NAME}}"',
      '    overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Please install missing dependency first.');
    expect(result.logs.join('\n')).toContain('Ending onboarding until dependency is installed.');
  });
});

describe('skill command', () => {
  test('completes without error when skill already exists', async () => {
    const result = await captureOutput(() => main(['skill']));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toMatch(/Installed skill|Skill already exists/);
  });
});
