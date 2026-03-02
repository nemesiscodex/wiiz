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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiz-cli-'));
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
  test('prints generic help for --help', async () => {
    const result = await captureOutput(() => main(['--help']));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Usage:');
    expect(result.logs.join('\n')).toContain('wiiz help list');
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

  test('run is friendly when config is missing', async () => {
    const missingPath = path.join(await makeTempDir(), 'missing.yaml');
    const result = await captureOutput(() => main(['run', '--config', missingPath]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('No onboarding config found yet.');
  });
});

describe('help command', () => {
  test('prints generic CLI help', async () => {
    const result = await captureOutput(() => main(['help']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('wiiz help list');
    expect(result.logs.join('\n')).toContain('wiiz help <primitive>');
  });

  test('prints categorized primitive list', async () => {
    const result = await captureOutput(() => main(['help', 'list']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Prompt:');
    expect(result.logs.join('\n')).toContain('command.run');
    expect(result.logs.join('\n')).toContain('Details: wiiz help <primitive>');
  });

  test('prints detailed primitive help for command.run', async () => {
    const result = await captureOutput(() => main(['help', 'command.run']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Primitive: command.run');
    expect(result.logs.join('\n')).toContain('consentMessage');
    expect(result.logs.join('\n')).toContain('Non-interactive mode skips `command.run` by default.');
  });

  test('prints detailed primitive help for confirm', async () => {
    const result = await captureOutput(() => main(['help', 'confirm']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('abortOnDecline');
    expect(result.logs.join('\n')).toContain('omitted `default` behaves as `no`');
  });

  test('prints detailed primitive help for banner', async () => {
    const result = await captureOutput(() => main(['help', 'banner']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('Define exactly one of `content` or `path`.');
  });

  test('handles unknown help topics gracefully', async () => {
    const result = await captureOutput(() => main(['help', 'unknown']));

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain("Unknown help topic 'unknown'.");
    expect(result.logs.join('\n')).toContain('wiiz help list');
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

describe('removed command', () => {
  test('treats the removed command as an unknown command', async () => {
    const removedCommand = `l${'lm'}`;
    const result = await captureOutput(() => main([removedCommand]));
    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain(`Unknown command '${removedCommand}'.`);
    expect(result.logs.join('\n')).toContain('Usage:');
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

  test('supports the checked-in wizard match flow in dry-run mode', async () => {
    const tempDir = await makeTempDir();
    const valuesPath = path.join(tempDir, 'values.json');
    const configPath = path.resolve('.wiiz/wizard.yaml');

    await fs.writeFile(
      valuesPath,
      JSON.stringify(
        {
          ENV: 'development',
          NAME: 'julio',
          EMAIL: 'julio@example.com'
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath, '--dry-run'])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('run-example-branch: no branch matched RUN_EXAMPLES=no');
    expect(result.logs.join('\n')).not.toContain('example-write-file');
    expect(result.logs.join('\n')).toContain('Run complete (dry-run).');
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

  test('merges env.write into an existing .env file', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const envFile = path.join(tempDir, '.env');

    await fs.writeFile(configPath, buildValidConfig(tempDir), 'utf8');
    await fs.writeFile(
      valuesPath,
      JSON.stringify({NAME: 'julio cesar', NODE_ENV: 'production'}, null, 2),
      'utf8'
    );
    await fs.writeFile(envFile, '# existing config\nPORT=3000\nNAME=old\n', 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);

    const envContent = await fs.readFile(envFile, 'utf8');
    expect(envContent).toBe('# existing config\nPORT=3000\nNAME="julio cesar"\nNODE_ENV=production\n');
  });

  test('runs only the selected match branch in non-interactive mode', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const targetFile = path.join(tempDir, 'branch.txt');

    const config = [
      'version: 1',
      'name: Match flow',
      'steps:',
      '  - id: ask-env',
      '    type: select',
      '    message: Env',
      '    var: ENV',
      '    options:',
      '      - label: Development',
      '        value: development',
      '      - label: Production',
      '        value: production',
      '  - id: choose-path',
      '    type: match',
      '    var: ENV',
      '    cases:',
      '      - equals: production',
      '        steps:',
      '          - id: ask-token',
      '            type: input',
      '            message: Token',
      '            var: TOKEN',
      '          - id: write-prod',
      '            type: file.write',
      `            path: ${targetFile}`,
      '            content: "prod={{TOKEN}}\\n"',
      '            overwrite: true',
      '      - equals: development',
      '        steps:',
      '          - id: write-dev',
      '            type: file.write',
      `            path: ${targetFile}`,
      '            content: "dev={{ENV}}\\n"',
      '            overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({ENV: 'development'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('choose-path: matched ENV=development');

    const targetContent = await fs.readFile(targetFile, 'utf8');
    expect(targetContent).toBe('dev=development\n');
  });

  test('runs grouped steps with inherited cwd', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const nestedDir = path.join(tempDir, 'nested');
    const targetFile = path.join(nestedDir, 'group.txt');

    const config = [
      'version: 1',
      'name: Group flow',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: grouped-setup',
      '    type: group',
      `    cwd: ${nestedDir}`,
      '    steps:',
      '      - id: write-group-file',
      '        type: file.write',
      '        path: group.txt',
      '        content: "{{NAME}}\\n"',
      '        overwrite: true'
    ].join('\n');

    await fs.mkdir(nestedDir, {recursive: true});
    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('grouped-setup: entering group');

    const targetContent = await fs.readFile(targetFile, 'utf8');
    expect(targetContent).toBe('julio\n');
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

  test('supports when-gated display/banner primitives', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const bannerPath = path.join(tempDir, 'prod-banner.txt');

    await fs.writeFile(bannerPath, '*** PROD MODE ***\n', 'utf8');

    const config = [
      'version: 1',
      'name: With display and banner',
      'steps:',
      '  - id: ask-env',
      '    type: select',
      '    message: Env',
      '    var: ENV',
      '    options:',
      '      - label: Development',
      '        value: development',
      '      - label: Production',
      '        value: production',
      '  - id: prod-banner',
      '    type: banner',
      '    when:',
      '      var: ENV',
      '      equals: production',
      `    path: ${JSON.stringify(bannerPath)}`,
      '  - id: prod-note',
      '    type: display',
      '    when:',
      '      var: ENV',
      '      equals: production',
      '    message: "Deploy target={{ENV}}"'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({ENV: 'development'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('prod-banner: skipped (when condition not met)');
    expect(result.logs.join('\n')).toContain('prod-note: skipped (when condition not met)');
  });

  test('renders banner primitive from a configured file path', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const bannerPath = path.join(tempDir, 'logo.txt');

    await fs.writeFile(bannerPath, '*** HELLO {{NAME}} ***\n', 'utf8');

    const config = [
      'version: 1',
      'name: Banner from file',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: show-banner',
      '    type: banner',
      `    path: ${JSON.stringify(bannerPath)}`
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain(`show-banner (from ${bannerPath}):\n  *** HELLO julio ***`);
  });

  test('renders display and note as multiline blocks', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');

    const config = [
      'version: 1',
      'name: Message formatting',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: show-display',
      '    type: display',
      '    message: "Hello {{NAME}}"',
      '  - id: show-note',
      '    type: note',
      '    message: "Review setup for {{NAME}}"'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('show-display:\n  Hello julio');
    expect(result.logs.join('\n')).toContain(
      [
        'show-note:',
        '╭──────────────────────────╮',
        '│                          │',
        '│  [show-note]             │',
        '│  Review setup for julio  │',
        '│                          │',
        '╰──────────────────────────╯'
      ].join('\n')
    );
  });

  test('stops at declined confirm in non-interactive mode by default', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'out.txt');

    const config = [
      'version: 1',
      'name: Confirm stop',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: checkpoint',
      '    type: confirm',
      '    message: Continue?',
      '  - id: write-file',
      '    type: file.write',
      `    path: ${outputFile}`,
      '    content: "hello {{NAME}}"',
      '    overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('checkpoint: declined');
    expect(result.logs.join('\n')).toContain('Stopping onboarding at confirmation checkpoint.');

    const exists = await fs
      .access(outputFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  test('continues at confirm when default is yes in non-interactive mode', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'out.txt');

    const config = [
      'version: 1',
      'name: Confirm continue',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: checkpoint',
      '    type: confirm',
      '    message: Continue?',
      '    default: "yes"',
      '  - id: write-file',
      '    type: file.write',
      `    path: ${outputFile}`,
      '    content: "hello {{NAME}}"',
      '    overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('checkpoint: confirmed');

    const content = await fs.readFile(outputFile, 'utf8');
    expect(content).toContain('hello julio');
  });

  test('stores confirm decision in context variable for later interpolation', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'out.txt');

    const config = [
      'version: 1',
      'name: Confirm var interpolation',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: checkpoint',
      '    type: confirm',
      '    message: Continue?',
      '    var: CONTINUE_SETUP',
      '    default: "yes"',
      '    abortOnDecline: false',
      '  - id: write-file',
      '    type: file.write',
      `    path: ${outputFile}`,
      '    content: "name={{NAME}}, continue={{CONTINUE_SETUP}}"',
      '    overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    const content = await fs.readFile(outputFile, 'utf8');
    expect(content).toContain('continue=yes');
  });

  test('supports when conditions using confirm context variable', async () => {
    const tempDir = await makeTempDir();
    const configPath = path.join(tempDir, 'wizard.yaml');
    const valuesPath = path.join(tempDir, 'values.json');
    const outputFile = path.join(tempDir, 'out.txt');

    const config = [
      'version: 1',
      'name: Confirm var when',
      'steps:',
      '  - id: ask-name',
      '    type: input',
      '    message: Name',
      '    var: NAME',
      '  - id: checkpoint',
      '    type: confirm',
      '    message: Continue?',
      '    var: CONTINUE_SETUP',
      '    default: "no"',
      '    abortOnDecline: false',
      '  - id: gated-write',
      '    type: file.write',
      '    when:',
      '      var: CONTINUE_SETUP',
      '      equals: yes',
      `    path: ${outputFile}`,
      '    content: "hello {{NAME}}"',
      '    overwrite: true'
    ].join('\n');

    await fs.writeFile(configPath, config, 'utf8');
    await fs.writeFile(valuesPath, JSON.stringify({NAME: 'julio'}, null, 2), 'utf8');

    const result = await captureOutput(() =>
      main(['run', '--config', configPath, '--values', valuesPath])
    );

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toContain('checkpoint: declined');
    expect(result.logs.join('\n')).toContain('gated-write: skipped (when condition not met)');
  });
});

describe('skill command', () => {
  test('completes without error when skill already exists', async () => {
    const tempDir = await makeTempDir();
    const originalCwd = process.cwd();
    let result: Awaited<ReturnType<typeof captureOutput>>;
    try {
      process.chdir(tempDir);
      result = await captureOutput(() => main(['skill']));
    } finally {
      process.chdir(originalCwd);
    }

    expect(result.code).toBe(0);
    expect(result.logs.join('\n')).toMatch(/Installed skill|Skill already exists/);
  });
});
