import path from 'node:path';
import {DEFAULT_CONFIG_PATH, type WizardConfig} from './types.js';

export type LoadedConfig = {
  config: WizardConfig;
  resolvedPath: string;
};

export async function loadConfig(configPath?: string): Promise<LoadedConfig> {
  const resolvedPath = path.resolve(process.cwd(), configPath ?? DEFAULT_CONFIG_PATH);
  const file = Bun.file(resolvedPath);

  if (!(await file.exists())) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = await file.text();

  let parsed: unknown;
  try {
    parsed = (Bun as any).YAML.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse YAML at ${resolvedPath}: ${String(error)}`);
  }

  return {
    config: parsed as WizardConfig,
    resolvedPath
  };
}
