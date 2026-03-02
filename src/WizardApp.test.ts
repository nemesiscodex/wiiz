import {describe, expect, test} from 'bun:test';
import {
  formatStaticCard,
  formatInputDefaultHint,
  formatPromptControls,
  formatPromptInputValue
} from './WizardApp.js';

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

  test('formats a visible default hint for non-empty defaults', () => {
    const result = formatInputDefaultHint('http://localhost:3000');

    expect(result).toBe('Default: http://localhost:3000 (press Enter on an empty field to use it)');
  });

  test('formats a visible default hint for empty-string defaults', () => {
    const result = formatInputDefaultHint('');

    expect(result).toBe('Default: empty value (press Enter on an empty field to use it)');
  });

  test('uses explicit controls when an input has a default', () => {
    const result = formatPromptControls({
      id: 'site-url',
      type: 'input',
      message: 'Site URL',
      var: 'SITE_URL',
      default: 'http://localhost:3000'
    });

    expect(result).toBe('Type: edit • Enter: confirm (empty uses default) • q/Esc: cancel');
  });

  test('uses generic controls when an input has no default', () => {
    const result = formatPromptControls({
      id: 'site-url',
      type: 'input',
      message: 'Site URL',
      var: 'SITE_URL'
    });

    expect(result).toBe('Type: edit • Enter: confirm • q/Esc: cancel');
  });

  test('keeps select controls unchanged', () => {
    const result = formatPromptControls({
      id: 'runtime',
      type: 'select',
      message: 'Pick runtime',
      var: 'RUNTIME',
      options: [
        {label: 'Node', value: 'node'},
        {label: 'Bun', value: 'bun'}
      ]
    });

    expect(result).toBe('↑/↓: move • Enter: confirm • q/Esc: cancel');
  });

  test('formats static cards using the wizard border style', () => {
    const result = formatStaticCard('show-note', 'Review setup for julio');

    expect(result).toBe(
      [
        '╭──────────────────────────╮',
        '│                          │',
        '│  [show-note]             │',
        '│  Review setup for julio  │',
        '│                          │',
        '╰──────────────────────────╯'
      ].join('\n')
    );
  });
});
