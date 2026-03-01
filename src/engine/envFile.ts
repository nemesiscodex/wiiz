export type EnvAssignment = {
  key: string;
  value: string;
};

export function parseEnvLine(line: string): EnvAssignment | undefined {
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

export function parseEnvContent(content: string): Record<string, string> {
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

export function serializeEnvAssignment(key: string, value: string): string {
  if (!/[ \t]/.test(value)) {
    return `${key}=${value}`;
  }

  const escapedValue = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `${key}="${escapedValue}"`;
}

function detectNewline(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function splitPreservingTrailingBlankLines(content: string): string[] {
  if (content.length === 0) {
    return [];
  }

  const normalized = content.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');

  if (normalized.endsWith('\n')) {
    lines.pop();
  }

  return lines;
}

export function renderEnvFileContent(entries: EnvAssignment[], newline = '\n'): string {
  return `${entries.map(entry => serializeEnvAssignment(entry.key, entry.value)).join(newline)}${newline}`;
}

export function mergeEnvFileContent(entries: EnvAssignment[], existingContent: string): string {
  const newline = detectNewline(existingContent);
  const nextValues = new Map<string, string>();
  const orderedKeys: string[] = [];

  for (const entry of entries) {
    if (!nextValues.has(entry.key)) {
      orderedKeys.push(entry.key);
    }
    nextValues.set(entry.key, entry.value);
  }

  const seenKeys = new Set<string>();
  const mergedLines = splitPreservingTrailingBlankLines(existingContent).map(line => {
    const parsed = parseEnvLine(line);
    if (!parsed || !nextValues.has(parsed.key)) {
      return line;
    }

    seenKeys.add(parsed.key);
    return serializeEnvAssignment(parsed.key, nextValues.get(parsed.key) ?? '');
  });

  for (const key of orderedKeys) {
    if (seenKeys.has(key)) {
      continue;
    }

    mergedLines.push(serializeEnvAssignment(key, nextValues.get(key) ?? ''));
  }

  return `${mergedLines.join(newline)}${newline}`;
}
