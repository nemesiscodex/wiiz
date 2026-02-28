import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {NonPromptStep} from '../config/types.js';
import {interpolateTemplate} from './interpolate.js';

export type StepExecutionResult = {
  stepId: string;
  type: NonPromptStep['type'];
  targetPath?: string;
  action:
    | 'write'
    | 'append'
    | 'env.write'
    | 'command.run'
    | 'command.check'
    | 'display'
    | 'banner';
  contentPreview: string;
  dryRun: boolean;
  stopExecution?: boolean;
};

type ExecuteStepOptions = {
  context: Record<string, string>;
  dryRun: boolean;
  cwd?: string;
  approved?: boolean;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDirectory(targetPath: string): Promise<void> {
  const parentDirectory = path.dirname(targetPath);
  await fs.mkdir(parentDirectory, {recursive: true});
}

function previewContent(content: string): string {
  return content.length > 240 ? `${content.slice(0, 240)}...` : content;
}

function resolveInterpolatedPath(pathTemplate: string, context: Record<string, string>, cwd: string): string {
  const interpolated = interpolateTemplate(pathTemplate, context);
  return path.resolve(cwd, interpolated);
}

function runShellCommandCapture(command: string, cwd: string): Promise<{code: number; output: string}> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-lc', command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', chunk => {
      output += String(chunk);
    });
    child.stderr.on('data', chunk => {
      output += String(chunk);
    });

    child.on('error', error => {
      reject(error);
    });

    child.on('close', code => {
      resolve({code: code ?? 1, output: output.trim()});
    });
  });
}

function runShellCommandStreaming(command: string, cwd: string): Promise<{code: number}> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-lc', command], {
      cwd,
      stdio: 'inherit'
    });

    child.on('error', error => {
      reject(error);
    });

    child.on('close', code => {
      resolve({code: code ?? 1});
    });
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function isCommandAvailable(commandName: string, cwd: string): Promise<boolean> {
  const result = await runShellCommandCapture(`command -v ${shellQuote(commandName)}`, cwd);
  return result.code === 0;
}

async function resolveBannerContent(
  step: Extract<NonPromptStep, {type: 'ascii' | 'banner'}>,
  context: Record<string, string>,
  cwd: string
): Promise<{content: string; sourcePath?: string}> {
  if (step.content !== undefined) {
    return {
      content: interpolateTemplate(step.content, context)
    };
  }

  if (!step.path) {
    throw new Error(`Step '${step.id}' must define 'content' or 'path'.`);
  }

  const sourcePath = resolveInterpolatedPath(step.path, context, cwd);

  let rawContent: string;
  try {
    rawContent = await fs.readFile(sourcePath, 'utf8');
  } catch {
    throw new Error(`Step '${step.id}' could not read source file: ${sourcePath}`);
  }

  return {
    content: interpolateTemplate(rawContent, context),
    sourcePath
  };
}

export async function executeOperationStep(
  step: NonPromptStep,
  options: ExecuteStepOptions
): Promise<StepExecutionResult> {
  const cwd = options.cwd ?? process.cwd();

  if (step.type === 'file.write') {
    const targetPath = resolveInterpolatedPath(step.path, options.context, cwd);
    const content = interpolateTemplate(step.content, options.context);

    if ((await pathExists(targetPath)) && !step.overwrite) {
      throw new Error(`Step '${step.id}' refused to overwrite existing file: ${targetPath}`);
    }

    if (!options.dryRun) {
      await ensureParentDirectory(targetPath);
      await fs.writeFile(targetPath, content, 'utf8');
    }

    return {
      stepId: step.id,
      type: step.type,
      targetPath,
      action: 'write',
      contentPreview: previewContent(content),
      dryRun: options.dryRun
    };
  }

  if (step.type === 'file.append') {
    const targetPath = resolveInterpolatedPath(step.path, options.context, cwd);
    const content = interpolateTemplate(step.content, options.context);
    const exists = await pathExists(targetPath);

    if (!exists && step.createIfMissing === false) {
      throw new Error(`Step '${step.id}' cannot append because file does not exist: ${targetPath}`);
    }

    if (!options.dryRun) {
      await ensureParentDirectory(targetPath);
      await fs.appendFile(targetPath, content, 'utf8');
    }

    return {
      stepId: step.id,
      type: step.type,
      targetPath,
      action: 'append',
      contentPreview: previewContent(content),
      dryRun: options.dryRun
    };
  }

  if (step.type === 'env.write') {
    const targetPath = resolveInterpolatedPath(step.path, options.context, cwd);
    const lines = step.entries.map(entry => `${entry.key}=${interpolateTemplate(entry.value, options.context)}`);
    const content = `${lines.join('\n')}\n`;

    if ((await pathExists(targetPath)) && !step.overwrite) {
      throw new Error(`Step '${step.id}' refused to overwrite existing file: ${targetPath}`);
    }

    if (!options.dryRun) {
      await ensureParentDirectory(targetPath);
      await fs.writeFile(targetPath, content, 'utf8');
    }

    return {
      stepId: step.id,
      type: step.type,
      targetPath,
      action: 'env.write',
      contentPreview: previewContent(content),
      dryRun: options.dryRun
    };
  }

  if (step.type === 'command.run') {
    const resolvedCommand = interpolateTemplate(step.command, options.context);
    const commandCwd = step.cwd ? resolveInterpolatedPath(step.cwd, options.context, cwd) : cwd;

    if (!options.approved) {
      return {
        stepId: step.id,
        type: step.type,
        targetPath: commandCwd,
        action: 'command.run',
        contentPreview: `Skipped command by user choice: ${resolvedCommand}`,
        dryRun: options.dryRun
      };
    }

    if (options.dryRun) {
      return {
        stepId: step.id,
        type: step.type,
        targetPath: commandCwd,
        action: 'command.run',
        contentPreview: `Would run command: ${resolvedCommand}`,
        dryRun: true
      };
    }

    // Mirror shell behavior in terminal: print the command and stream child stdio live.
    process.stdout.write(
      'Warning: only run commands you understand.\n'
    );
    process.stdout.write(`$ ${resolvedCommand}\n`);
    const result = await runShellCommandStreaming(resolvedCommand, commandCwd);
    if (result.code !== 0) {
      throw new Error(`Step '${step.id}' command failed (${result.code}).`);
    }

    return {
      stepId: step.id,
      type: step.type,
      targetPath: commandCwd,
      action: 'command.run',
      contentPreview: `Ran command: ${resolvedCommand}`,
      dryRun: false
    };
  }

  if (step.type === 'display' || step.type === 'note') {
    const message = interpolateTemplate(step.message, options.context);
    return {
      stepId: step.id,
      type: step.type,
      action: 'display',
      contentPreview: message,
      dryRun: options.dryRun
    };
  }

  if (step.type === 'ascii' || step.type === 'banner') {
    const resolved = await resolveBannerContent(step, options.context, cwd);
    return {
      stepId: step.id,
      type: step.type,
      targetPath: resolved.sourcePath,
      action: 'banner',
      contentPreview: resolved.content,
      dryRun: options.dryRun
    };
  }

  if (step.type === 'command.check') {
    const commandName = interpolateTemplate(step.command, options.context);
    const available = await isCommandAvailable(commandName, cwd);
    if (!available) {
      return {
        stepId: step.id,
        type: step.type,
        targetPath: cwd,
        action: 'command.check',
        contentPreview:
          step.installHint ??
          `Command '${commandName}' is missing. Install it and re-run onboarding.`,
        dryRun: options.dryRun,
        stopExecution: true
      };
    }

    return {
      stepId: step.id,
      type: step.type,
      targetPath: cwd,
      action: 'command.check',
      contentPreview: `Command '${commandName}' is available.`,
      dryRun: options.dryRun
    };
  }

  throw new Error(`Unsupported non-prompt step type at runtime: ${String(step.type)}`);
}
