import fs from 'node:fs/promises';
import path from 'node:path';
import type {PromptStep} from '../config/types.js';

function parseEnvLine(line: string): {key: string; value: string} | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    return undefined;
  }

  const normalized = trimmed.startsWith('export ') ? trimmed.slice('export '.length) : trimmed;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex <= 0) {
    return undefined;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return {key, value};
}

function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    result[parsed.key] = parsed.value;
  }

  return result;
}

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
