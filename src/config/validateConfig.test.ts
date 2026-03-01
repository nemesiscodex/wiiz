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
          when: {var: 'NAME', exists: true},
          path: 'out.txt',
          content: 'Hello {{NAME}}'
        },
        {
          id: 'checkpoint',
          type: 'confirm',
          message: 'Continue?',
          default: 'yes'
        },
        {
          id: 'note',
          type: 'note',
          when: {var: 'NAME', notEquals: ''},
          message: 'Using {{NAME}}'
        },
        {
          id: 'banner',
          type: 'banner',
          path: '.wiiz/logo.txt'
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
        },
        {
          id: 'match-env',
          type: 'match',
          var: 'NAME',
          cases: [
            {
              equals: 'julio',
              steps: [
                {
                  id: 'nested-note',
                  type: 'note',
                  message: 'Hello {{NAME}}'
                }
              ]
            }
          ],
          default: {
            steps: [
              {
                id: 'nested-display',
                type: 'display',
                message: 'Fallback'
              }
            ]
          }
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

  test('rejects banner step when both content and path are set', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'banner',
          type: 'banner',
          content: '*** START ***',
          path: '.wiiz/logo.txt'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("must define exactly one of 'content' or 'path'");
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

  test('rejects invalid when shape', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'bad-when',
          type: 'file.write',
          when: {var: 'ENV'},
          path: 'out.txt',
          content: 'x'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("defines 'when' but no condition");
  });

  test('rejects when.var that is not collected by prior prompt step', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'note',
          type: 'display',
          when: {var: 'ENV', equals: 'production'},
          message: 'Hello'
        },
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("references 'when.var=ENV' before it is collected");
  });

  test('rejects confirm with invalid default value', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'checkpoint',
          type: 'confirm',
          message: 'Continue?',
          default: 'maybe'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("invalid 'default'");
  });

  test('rejects confirm with invalid var type', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'checkpoint',
          type: 'confirm',
          message: 'Continue?',
          var: ''
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("invalid 'var'");
  });

  test('rejects match without cases', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'branch',
          type: 'match',
          var: 'ENV',
          cases: []
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("must define a non-empty 'cases' array");
  });

  test('rejects overlapping match cases', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'branch',
          type: 'match',
          var: 'ENV',
          cases: [
            {
              equals: 'production',
              steps: [{id: 'prod-note', type: 'note', message: 'prod'}]
            },
            {
              oneOf: ['development', 'production'],
              steps: [{id: 'fallback-note', type: 'note', message: 'other'}]
            }
          ]
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("overlapping match cases for value 'production'");
  });

  test('rejects referencing branch-only vars after match', () => {
    const config = {
      version: 1,
      name: 'bad',
      steps: [
        {
          id: 'ask-env',
          type: 'input',
          message: 'Env',
          var: 'ENV'
        },
        {
          id: 'branch',
          type: 'match',
          var: 'ENV',
          cases: [
            {
              equals: 'production',
              steps: [
                {
                  id: 'ask-token',
                  type: 'input',
                  message: 'Token',
                  var: 'TOKEN'
                }
              ]
            }
          ]
        },
        {
          id: 'write-file',
          type: 'file.write',
          path: 'out.txt',
          content: 'Token={{TOKEN}}'
        }
      ]
    };

    const result = validateConfigShape(config);
    expect(result.errors.join('\n')).toContain("references '{{TOKEN}}'");
  });
});
