import {describe, expect, test} from 'bun:test';
import type {WizardStep} from './types.js';
import {
  getPrimitiveReference,
  listPrimitiveCategories,
  listPrimitiveReferences
} from './primitiveReference.js';

describe('primitiveReference', () => {
  test('covers every supported primitive type', () => {
    const primitiveNames: WizardStep['type'][] = [
      'input',
      'select',
      'confirm',
      'match',
      'group',
      'display',
      'note',
      'ascii',
      'banner',
      'file.write',
      'file.append',
      'env.write',
      'command.run',
      'command.check'
    ];

    for (const name of primitiveNames) {
      expect(getPrimitiveReference(name)).toBeDefined();
    }
  });

  test('list ordering and category assignments are stable', () => {
    expect(listPrimitiveReferences().map(entry => entry.name)).toEqual([
      'input',
      'select',
      'confirm',
      'match',
      'group',
      'display',
      'note',
      'ascii',
      'banner',
      'file.write',
      'file.append',
      'env.write',
      'command.run',
      'command.check'
    ]);

    expect(
      listPrimitiveCategories().map(group => ({
        category: group.category,
        entries: group.entries.map(entry => entry.name)
      }))
    ).toEqual([
      {category: 'Prompt', entries: ['input', 'select']},
      {category: 'Flow Control', entries: ['confirm', 'match', 'group']},
      {category: 'Output', entries: ['display', 'note', 'ascii', 'banner']},
      {category: 'File', entries: ['file.write', 'file.append', 'env.write']},
      {category: 'Command', entries: ['command.run', 'command.check']}
    ]);
  });

  test('every primitive has required field metadata', () => {
    for (const entry of listPrimitiveReferences()) {
      expect(entry.category.length).toBeGreaterThan(0);
      expect(entry.fields.some(field => field.required)).toBe(true);
    }
  });
});
