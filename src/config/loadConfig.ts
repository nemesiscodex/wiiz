import fs from 'node:fs/promises';
import path from 'node:path';
import {DEFAULT_CONFIG_PATH, type WizardConfig} from './types.js';

export type LoadedConfig = {
  config: WizardConfig;
  resolvedPath: string;
};

async function parseConfigYaml(raw: string): Promise<unknown> {
  try {
    const {parse} = await import('yaml');
    return parse(raw);
  } catch (error) {
    const bunYaml = (globalThis as {Bun?: {YAML?: {parse: (value: string) => unknown}}}).Bun?.YAML;
    if (bunYaml) {
      return bunYaml.parse(raw);
    }

    throw error;
  }
}

export async function loadConfig(configPath?: string): Promise<LoadedConfig> {
  const resolvedPath = path.resolve(process.cwd(), configPath ?? DEFAULT_CONFIG_PATH);
  let raw: string;
  try {
    raw = await fs.readFile(resolvedPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Config file not found: ${resolvedPath}`);
    }

    throw error;
  }

  let parsed: unknown;
  try {
    parsed = await parseConfigYaml(raw);
  } catch (error) {
    throw new Error(`Failed to parse YAML at ${resolvedPath}: ${String(error)}`);
  }

  return {
    config: parsed as WizardConfig,
    resolvedPath
  };
}
