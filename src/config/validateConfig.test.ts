import {describe, expect, test} from 'bun:test';
import {validateConfigShape} from './validateConfig.js';

describe('validateConfigShape', () => {
  test('accepts a valid config', () => {
    const config = {
      version: 1,
      name: 'test',
      steps: [
        {
          id: 'ask-name',
          type: 'input',
          message: 'Name?',
          var: 'NAME'
        },
        {
          id: 'write-file',
          type: 'file.write',
          path: 'out.txt',
          content: 'Hello {{NAME}}'
        },
        {
          id: 'check-bun',
          type: 'command.check',
          command: 'bun'
        },
        {
          id: 'install',
          type: 'command.run',
          command: 'bun install'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors).toEqual([]);
  });

  test('rejects unknown step type', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [{id: 'x', type: 'boom'}]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain('unsupported type');
  });

  test('rejects interpolation of unknown variable', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'write-file',
          type: 'file.write',
          path: 'out.txt',
          content: 'Hello {{NAME}}'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("references '{{NAME}}'");
  });

  test('rejects command.check without command', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [{id: 'check', type: 'command.check', command: ''}]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain('must define a non-empty');
  });

  test('rejects input step with invalid envFile type', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-token',
          type: 'input',
          message: 'Token',
          var: 'TOKEN',
          envFile: 123
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("invalid 'envFile'");
  });

  test('rejects select step with invalid sensitive type', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'pick-env',
          type: 'select',
          message: 'Pick env',
          var: 'NODE_ENV',
          sensitive: 'no',
          options: [
            {label: 'dev', value: 'development'},
            {label: 'prod', value: 'production'}
          ]
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("invalid 'sensitive'");
  });
});
