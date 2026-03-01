import fs from 'node:fs/promises';
import path from 'node:path';
import type {PromptStep} from '../config/types.js';
import {parseEnvContent} from './envFile.js';

export function maskEnvValue(value: string): string {
  const visible = value.slice(0, 2);
  return `${visible}**`;
}

function isStepSensitive(step: PromptStep): boolean {
  if (step.sensitive !== undefined) {
    return step.sensitive;
  }

  return true;
}

export function formatEnvPrefillPreview(step: PromptStep, value: string): string {
  const sensitive = isStepSensitive(step);
  if (!sensitive) {
    return value;
  }

  return maskEnvValue(value);
}

export async function loadEnvPrefillValue(
  step: PromptStep,
  cwd: string
): Promise<{envFile: string; envKey: string; value: string} | undefined> {
  const envFile = step.envFile;
  if (!envFile) {
    return undefined;
  }

  const resolvedFile = path.resolve(cwd, envFile);
  let raw: string;
  try {
    raw = await fs.readFile(resolvedFile, 'utf8');
  } catch {
    return undefined;
  }

  const envMap = parseEnvContent(raw);
  const envKey = step.envKey ?? step.var;
  const value = envMap[envKey];

  if (value === undefined) {
    return undefined;
  }

  return {envFile, envKey, value};
}
