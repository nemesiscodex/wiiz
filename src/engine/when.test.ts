import {describe, expect, test} from 'bun:test';
import {shouldRunWhen} from './when.js';

describe('shouldRunWhen', () => {
  test('returns true when no condition is provided', () => {
    expect(shouldRunWhen(undefined, {})).toBe(true);
  });

  test('supports equals and exists checks', () => {
    expect(
      shouldRunWhen({var: 'ENV', equals: 'production', exists: true}, {ENV: 'production'})
    ).toBe(true);
    expect(
      shouldRunWhen({var: 'ENV', equals: 'production', exists: true}, {ENV: ''})
    ).toBe(false);
  });

  test('supports notEquals and oneOf checks', () => {
    expect(
      shouldRunWhen({var: 'ENV', notEquals: 'development', oneOf: ['production', 'staging']}, {ENV: 'production'})
    ).toBe(true);
    expect(
      shouldRunWhen({var: 'ENV', notEquals: 'development', oneOf: ['production', 'staging']}, {ENV: 'development'})
    ).toBe(false);
  });
});
