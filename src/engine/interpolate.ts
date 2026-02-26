const TOKEN_REGEX = /(?<!\\)\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}/g;
const ESCAPED_OPENING = /\\\{\{/g;
const ESCAPED_SENTINEL = '__REPO_ONBOARD_ESCAPED_OPENING__';

export function extractTemplateTokens(value: string): string[] {
  const matches = value.matchAll(TOKEN_REGEX);
  const tokens = new Set<string>();

  for (const match of matches) {
    const token = match[1];
    if (token) {
      tokens.add(token);
    }
  }

  return [...tokens];
}

export function interpolateTemplate(value: string, context: Record<string, string>): string {
  const escapedInput = value.replace(ESCAPED_OPENING, ESCAPED_SENTINEL);

  const interpolated = escapedInput.replace(TOKEN_REGEX, (_, token: string) => {
    if (!(token in context)) {
      throw new Error(`Missing interpolation variable: ${token}`);
    }

    return context[token] ?? '';
  });

  return interpolated.replaceAll(ESCAPED_SENTINEL, '{{');
}
