import {describe, expect, test} from 'bun:test';
import {formatPromptInputValue} from './WizardApp.js';

describe('formatPromptInputValue', () => {
  test('masks sensitive input values by default', () => {
    const result = formatPromptInputValue(
      {
        id: 'token',
        type: 'input',
        message: 'Token',
        var: 'TOKEN'
      },
      'secret123'
    );

    expect(result).toBe('•••••••••');
  });

  test('shows input values when sensitive is false', () => {
    const result = formatPromptInputValue(
      {
        id: 'name',
        type: 'input',
        message: 'Name',
        var: 'NAME',
        sensitive: false
      },
      'Julio'
    );

    expect(result).toBe('Julio');
  });
});
