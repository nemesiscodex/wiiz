import {afterEach, describe, expect, test} from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {executeOperationStep} from './executeStep.js';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiiz-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, {recursive: true, force: true})));
});

describe('executeOperationStep', () => {
  test('respects dry-run for file.write', async () => {
    const cwd = await makeTempDir();

    const result = await executeOperationStep(
      {
        id: 'write',
        type: 'file.write',
        path: 'a.txt',
        content: 'hello {{name}}'
      },
      {context: {name: 'julio'}, dryRun: true, cwd}
    );

    expect(result.dryRun).toBe(true);
    const exists = await fs
      .access(path.join(cwd, 'a.txt'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  test('refuses overwrite when disabled', async () => {
    const cwd = await makeTempDir();
    await fs.writeFile(path.join(cwd, '.env'), 'EXISTING=1\n', 'utf8');

    await expect(
      executeOperationStep(
        {
          id: 'env',
          type: 'env.write',
          path: '.env',
          entries: [{key: 'NAME', value: '{{name}}'}]
        },
        {context: {name: 'julio'}, dryRun: false, cwd}
      )
    ).rejects.toThrow('refused to overwrite');
  });

  test('appends content when file exists', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, 'README.md');
    await fs.writeFile(target, 'start\n', 'utf8');

    await executeOperationStep(
      {
        id: 'append',
        type: 'file.append',
        path: 'README.md',
        content: 'value={{name}}\n'
      },
      {context: {name: 'julio'}, dryRun: false, cwd}
    );

    const content = await fs.readFile(target, 'utf8');
    expect(content).toContain('value=julio');
  });

  test('fails append when target is missing and createIfMissing is false', async () => {
    const cwd = await makeTempDir();

    await expect(
      executeOperationStep(
        {
          id: 'append-missing',
          type: 'file.append',
          path: 'missing.txt',
          content: 'hello\n',
          createIfMissing: false
        },
        {context: {}, dryRun: false, cwd}
      )
    ).rejects.toThrow('cannot append because file does not exist');
  });

  test('writes env file content', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, '.env');

    const result = await executeOperationStep(
      {
        id: 'write-env',
        type: 'env.write',
        path: '.env',
        overwrite: true,
        entries: [
          {key: 'NAME', value: '{{name}}'},
          {key: 'NODE_ENV', value: 'production mode'}
        ]
      },
      {context: {name: 'julio'}, dryRun: false, cwd}
    );

    const content = await fs.readFile(target, 'utf8');
    expect(content).toBe('NAME=julio\nNODE_ENV="production mode"\n');
    expect(result.contentPreview).toBe('NAME=julio\nNODE_ENV="production mode"\n');
  });

  test('merges env entries into an existing file and preserves unrelated content', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, '.env');
    await fs.writeFile(target, '# keep me\r\nPORT=3000\r\nNAME=old\r\n\r\n', 'utf8');

    await executeOperationStep(
      {
        id: 'write-env',
        type: 'env.write',
        path: '.env',
        overwrite: true,
        entries: [
          {key: 'NAME', value: 'julio'},
          {key: 'NODE_ENV', value: 'production'}
        ]
      },
      {context: {}, dryRun: false, cwd}
    );

    const content = await fs.readFile(target, 'utf8');
    expect(content).toBe('# keep me\r\nPORT=3000\r\nNAME=julio\r\n\r\nNODE_ENV=production\r\n');
  });

  test('rewrites duplicate managed keys and escapes quoted values with whitespace', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, '.env');
    await fs.writeFile(target, 'NAME=old\nNAME=older\n', 'utf8');

    await executeOperationStep(
      {
        id: 'write-env',
        type: 'env.write',
        path: '.env',
        overwrite: true,
        entries: [{key: 'NAME', value: 'say "hi" \\ now'}]
      },
      {context: {}, dryRun: false, cwd}
    );

    const content = await fs.readFile(target, 'utf8');
    expect(content).toBe('NAME="say \\"hi\\" \\\\ now"\nNAME="say \\"hi\\" \\\\ now"\n');
  });

  test('shows merged final content during dry-run without changing the file', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, '.env');
    await fs.writeFile(target, 'KEEP=1\nNAME=old\n', 'utf8');

    const result = await executeOperationStep(
      {
        id: 'write-env',
        type: 'env.write',
        path: '.env',
        overwrite: true,
        entries: [
          {key: 'NAME', value: 'julio cesar'},
          {key: 'NODE_ENV', value: 'production'}
        ]
      },
      {context: {}, dryRun: true, cwd}
    );

    const content = await fs.readFile(target, 'utf8');
    expect(content).toBe('KEEP=1\nNAME=old\n');
    expect(result.contentPreview).toBe('KEEP=1\nNAME="julio cesar"\nNODE_ENV=production\n');
  });

  test('skips command.run when not approved', async () => {
    const cwd = await makeTempDir();
    const result = await executeOperationStep(
      {
        id: 'install',
        type: 'command.run',
        command: 'echo hello'
      },
      {context: {}, dryRun: false, cwd, approved: false}
    );

    expect(result.action).toBe('command.run');
    expect(result.contentPreview).toContain('Skipped command');
  });

  test('runs command.run when approved', async () => {
    const cwd = await makeTempDir();
    const target = path.join(cwd, 'installed.txt');

    const result = await executeOperationStep(
      {
        id: 'install',
        type: 'command.run',
        command: `echo installed > ${target}`
      },
      {context: {}, dryRun: false, cwd, approved: true}
    );

    expect(result.action).toBe('command.run');
    const content = await fs.readFile(target, 'utf8');
    expect(content).toContain('installed');
  });

  test('stops execution when command.check is missing', async () => {
    const cwd = await makeTempDir();
    const result = await executeOperationStep(
      {
        id: 'check-missing',
        type: 'command.check',
        command: '__repo_onboard_missing_cmd__'
      },
      {context: {}, dryRun: false, cwd}
    );

    expect(result.action).toBe('command.check');
    expect(result.stopExecution).toBe(true);
    expect(result.contentPreview).toContain('is missing');
  });

  test('passes command.check when command exists', async () => {
    const cwd = await makeTempDir();
    const result = await executeOperationStep(
      {
        id: 'check-sh',
        type: 'command.check',
        command: 'sh'
      },
      {context: {}, dryRun: false, cwd}
    );

    expect(result.action).toBe('command.check');
    expect(result.stopExecution).toBeUndefined();
    expect(result.contentPreview).toContain('is available');
  });

  test('renders display primitive with interpolation', async () => {
    const cwd = await makeTempDir();
    const result = await executeOperationStep(
      {
        id: 'show-note',
        type: 'display',
        message: 'Hello {{name}}'
      },
      {context: {name: 'julio'}, dryRun: false, cwd}
    );

    expect(result.action).toBe('display');
    expect(result.contentPreview).toBe('Hello julio');
    expect(result.targetPath).toBeUndefined();
  });

  test('renders banner primitive with interpolation', async () => {
    const cwd = await makeTempDir();
    const result = await executeOperationStep(
      {
        id: 'show-banner',
        type: 'banner',
        content: '*** {{name}} ***'
      },
      {context: {name: 'julio'}, dryRun: false, cwd}
    );

    expect(result.action).toBe('banner');
    expect(result.contentPreview).toBe('*** julio ***');
    expect(result.targetPath).toBeUndefined();
  });

  test('renders banner primitive from a file path', async () => {
    const cwd = await makeTempDir();
    const sourcePath = path.join(cwd, 'logo.txt');
    await fs.writeFile(sourcePath, '*** {{name}} ***', 'utf8');

    const result = await executeOperationStep(
      {
        id: 'show-banner-file',
        type: 'banner',
        path: 'logo.txt'
      },
      {context: {name: 'julio'}, dryRun: false, cwd}
    );

    expect(result.action).toBe('banner');
    expect(result.contentPreview).toBe('*** julio ***');
    expect(result.targetPath).toBe(sourcePath);
  });
});
