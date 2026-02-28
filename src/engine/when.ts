import type {StepWhen} from '../config/types.js';

export function shouldRunWhen(
  when: StepWhen | undefined,
  context: Record<string, string>
): boolean {
  if (!when) {
    return true;
  }

  const value = context[when.var];

  if (when.exists !== undefined) {
    const exists = typeof value === 'string' && value.length > 0;
    if (exists !== when.exists) {
      return false;
    }
  }

  if (when.equals !== undefined && value !== when.equals) {
    return false;
  }

  if (when.notEquals !== undefined && value === when.notEquals) {
    return false;
  }

  if (when.oneOf && !when.oneOf.includes(value ?? '')) {
    return false;
  }

  return true;
}
