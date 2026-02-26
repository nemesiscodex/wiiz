import {describe, expect, test} from 'bun:test';
import type {WizardConfig} from '../config/types.js';
import {collectInputDefinitions, validateProvidedValues} from './context.js';

const config: WizardConfig = {
  version: 1,
  name: 'ctx',
  steps: [
    {
      id: 'service-url',
      type: 'input',
      message: 'URL',
      var: 'SERVICE_URL',
      validateRegex: '^https://.+'
    },
    {
      id: 'env',
      type: 'select',
      message: 'Env',
      var: 'NODE_ENV',
      options: [
        {label: 'dev', value: 'development'},
        {label: 'prod', value: 'production'}
      ]
    }
  ]
};

describe('validateProvidedValues', () => {
  test('accepts valid values', () => {
    const result = validateProvidedValues(config, {
      SERVICE_URL: 'https://example.com',
      NODE_ENV: 'development'
    });

    expect(result.errors).toEqual([]);
    expect(result.context.SERVICE_URL).toBe('https://example.com');
  });

  test('fails on missing required values', () => {
    const result = validateProvidedValues(config, {
      SERVICE_URL: 'https://example.com'
    });

    expect(result.errors.join('\n')).toContain("Missing required value for 'NODE_ENV'");
  });

  test('fails regex and invalid select option', () => {
    const result = validateProvidedValues(config, {
      SERVICE_URL: 'http://example.com',
      NODE_ENV: 'staging'
    });

    expect(result.errors.join('\n')).toContain("does not match regex");
    expect(result.errors.join('\n')).toContain("must be one of");
  });
});

describe('collectInputDefinitions', () => {
  test('uses sensitive=true defaults for prompt steps', () => {
    const definitions = collectInputDefinitions(config);
    const input = definitions.find(definition => definition.var === 'SERVICE_URL');
    const select = definitions.find(definition => definition.var === 'NODE_ENV');

    expect(input?.sensitive).toBe(true);
    expect(select?.sensitive).toBe(true);
  });
});
