import {describe, expect, test} from 'bun:test';
import type {WizardConfig} from '../config/types.js';
import {describeConfigForLlm} from './describeForLlm.js';

const config: WizardConfig = {
  version: 1,
  name: 'spec',
  steps: [
    {id: 'ask-name', type: 'input', message: 'Name?', var: 'NAME', envFile: '.env', sensitive: false},
    {
      id: 'pick-env',
      type: 'select',
      message: 'Env?',
      var: 'ENV',
      options: [
        {label: 'dev', value: 'development'},
        {label: 'prod', value: 'production'}
      ]
    },
    {
      id: 'write-env',
      type: 'env.write',
      path: '.env',
      entries: [
        {key: 'NAME', value: '{{NAME}}'},
        {key: 'ENV', value: '{{ENV}}'}
      ]
    },
    {
      id: 'branch',
      type: 'match',
      var: 'ENV',
      cases: [
        {
          equals: 'production',
          steps: [
            {id: 'ask-token', type: 'input', message: 'Token?', var: 'TOKEN'},
            {
              id: 'write-token',
              type: 'file.write',
              path: '.token',
              content: '{{TOKEN}}',
              overwrite: true
            }
          ]
        }
      ]
    }
  ]
};

describe('describeConfigForLlm', () => {
  test('returns stable shape', () => {
    const result = describeConfigForLlm(config, '/tmp/wizard.yaml');

    expect(result.version).toBe(1);
    expect(result.name).toBe('spec');
    expect(result.configPath).toBe('/tmp/wizard.yaml');
    expect(result.inputs.length).toBe(3);
    expect(result.inputs[0]?.envFile).toBe('.env');
    expect(result.inputs[0]?.sensitive).toBe(false);
    expect(result.operations.length).toBe(2);
    expect(result.safety.length).toBe(2);
    expect(result.exampleValues.NAME).toBe('<fill-me>');
    expect(result.exampleValues.TOKEN).toBe('<fill-me>');
  });
});
