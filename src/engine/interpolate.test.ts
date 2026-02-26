import {describe, expect, test} from 'bun:test';
import {extractTemplateTokens, interpolateTemplate} from './interpolate.js';

describe('interpolateTemplate', () => {
  test('replaces tokens from context', () => {
    const result = interpolateTemplate('hello {{name}}', {name: 'julio'});
    expect(result).toBe('hello julio');
  });

  test('keeps escaped opening braces as literal', () => {
    const result = interpolateTemplate('literal \\{{x}} and {{name}}', {name: 'ok'});
    expect(result).toBe('literal {{x}} and ok');
  });

  test('throws on missing variable', () => {
    expect(() => interpolateTemplate('hello {{missing}}', {})).toThrow('Missing interpolation variable');
  });
});

describe('extractTemplateTokens', () => {
  test('extracts unique template tokens', () => {
    const result = extractTemplateTokens('{{a}}/{{b}}/{{a}}');
    expect(result).toEqual(['a', 'b']);
  });
});
