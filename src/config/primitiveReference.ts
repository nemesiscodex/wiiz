import type {WizardStep} from './types.js';

export type PrimitiveName = WizardStep['type'];

export type PrimitiveFieldReference = {
  name: string;
  type: string;
  required: boolean;
  defaultDescription: string;
  description: string;
};

export type PrimitiveReferenceEntry = {
  name: PrimitiveName;
  category: 'Prompt' | 'Flow Control' | 'Output' | 'File' | 'Command';
  summary: string;
  purpose: string;
  fields: PrimitiveFieldReference[];
  constraints: string[];
  behaviorNotes: string[];
  whenSupport: string;
  interpolationNotes: string[];
  exampleYaml: string;
  relatedPrimitives: PrimitiveName[];
};

const primitiveReferences = [
  {
    name: 'input',
    category: 'Prompt',
    summary: 'Collect a free-form text value into a variable.',
    purpose: 'Prompt for a text value and store it in `var` for later interpolation or conditions.',
    fields: [
      {
        name: 'id',
        type: 'string',
        required: true,
        defaultDescription: 'None.',
        description: 'Stable step identifier.'
      },
      {
        name: 'type',
        type: '"input"',
        required: true,
        defaultDescription: 'None.',
        description: 'Primitive discriminator.'
      },
      {
        name: 'message',
        type: 'string',
        required: true,
        defaultDescription: 'None.',
        description: 'Prompt shown to the user.'
      },
      {
        name: 'var',
        type: 'string',
        required: true,
        defaultDescription: 'None.',
        description: 'Variable name to store the collected value.'
      },
      {
        name: 'envFile',
        type: 'string',
        required: false,
        defaultDescription: 'No prefill source.',
        description: 'Optional env file used to offer keep/replace when a matching value exists.'
      },
      {
        name: 'envKey',
        type: 'string',
        required: false,
        defaultDescription: 'Uses `var` semantics for env lookup.',
        description: 'Optional env key override when reading from `envFile`.'
      },
      {
        name: 'sensitive',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `true` for masked previews.',
        description: 'Controls whether existing values are masked in preview.'
      },
      {
        name: 'required',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as optional unless set.',
        description: 'Marks the prompt as required during validation.'
      },
      {
        name: 'default',
        type: 'string',
        required: false,
        defaultDescription: 'No default value.',
        description: 'Pre-populates the prompt so pressing Enter can reuse a known value.'
      },
      {
        name: 'validateRegex',
        type: 'string',
        required: false,
        defaultDescription: 'No regex validation.',
        description: 'Regex pattern used to validate entered text.'
      }
    ],
    constraints: [
      '`id`, `message`, and `var` must be non-empty strings.',
      '`validateRegex` must compile as a valid JavaScript regular expression when present.',
      '`when` may only reference variables collected by earlier steps.'
    ],
    behaviorNotes: [
      'If `envFile` points at an existing value, wiiz offers keep/replace before prompting.',
      'Sensitive previews are masked by default.',
      'Values are available to later steps after this step runs.'
    ],
    whenSupport: 'Supported. `when` gates whether this prompt runs.',
    interpolationNotes: ['The prompt fields themselves are not interpolated.'],
    exampleYaml: [
      '- id: service-url',
      '  type: input',
      '  message: Enter service URL',
      '  var: SERVICE_URL',
      '  envFile: .env',
      '  sensitive: false',
      '  required: true',
      '  validateRegex: "^https?://.+"'
    ].join('\n'),
    relatedPrimitives: ['select', 'confirm']
  },
  {
    name: 'select',
    category: 'Prompt',
    summary: 'Collect one value from a fixed option list.',
    purpose: 'Prompt for a value from declared options and store the selected option `value` in `var`.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"select"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'message', type: 'string', required: true, defaultDescription: 'None.', description: 'Prompt shown to the user.'},
      {name: 'var', type: 'string', required: true, defaultDescription: 'None.', description: 'Variable name to store the selected value.'},
      {
        name: 'options',
        type: 'Array<{label: string; value: string}>',
        required: true,
        defaultDescription: 'None.',
        description: 'Non-empty list of choices presented to the user.'
      },
      {
        name: 'envFile',
        type: 'string',
        required: false,
        defaultDescription: 'No prefill source.',
        description: 'Optional env file used to offer keep/replace when a matching value exists.'
      },
      {
        name: 'envKey',
        type: 'string',
        required: false,
        defaultDescription: 'Uses `var` semantics for env lookup.',
        description: 'Optional env key override when reading from `envFile`.'
      },
      {
        name: 'sensitive',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `true` for masked previews.',
        description: 'Controls whether existing values are masked in preview.'
      }
    ],
    constraints: [
      '`options` must be a non-empty array.',
      'Each option must define non-empty `label` and `value`.',
      'Option `value` entries must be unique.'
    ],
    behaviorNotes: [
      'If `envFile` points at an existing value, wiiz offers keep/replace before prompting.',
      'The stored result is the option `value`, not the `label`.',
      'In non-interactive runs, provided values must match an option `value` exactly.'
    ],
    whenSupport: 'Supported. `when` gates whether this prompt runs.',
    interpolationNotes: ['The prompt fields themselves are not interpolated.'],
    exampleYaml: [
      '- id: runtime-env',
      '  type: select',
      '  message: Choose runtime environment',
      '  var: RUNTIME_ENV',
      '  options:',
      '    - label: Development',
      '      value: development',
      '    - label: Production',
      '      value: production'
    ].join('\n'),
    relatedPrimitives: ['input', 'match']
  },
  {
    name: 'confirm',
    category: 'Flow Control',
    summary: 'Require an explicit yes/no checkpoint.',
    purpose: 'Pause the flow for a yes/no decision before a risky or important transition.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"confirm"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'message', type: 'string', required: true, defaultDescription: 'None.', description: 'Question shown to the user.'},
      {
        name: 'var',
        type: 'string',
        required: false,
        defaultDescription: 'Decision is not stored.',
        description: 'Optional variable name that stores `yes` or `no`.'
      },
      {
        name: 'default',
        type: '"yes" | "no"',
        required: false,
        defaultDescription: 'Interactive mode asks; non-interactive mode treats omitted default as `no`.',
        description: 'Decision used in non-interactive mode.'
      },
      {
        name: 'abortOnDecline',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `true`.',
        description: 'Stops onboarding when the answer is `no`.'
      }
    ],
    constraints: [
      '`default` must be `yes` or `no` when present.',
      '`abortOnDecline` must be boolean when present.'
    ],
    behaviorNotes: [
      'Interactive mode prompts Yes/No.',
      'Non-interactive mode uses `default`; omitted `default` behaves as `no`.',
      'A declined confirmation aborts the run unless `abortOnDecline: false`.'
    ],
    whenSupport: 'Supported. `when` gates whether this checkpoint runs.',
    interpolationNotes: ['`message` supports interpolation from values collected by earlier steps.'],
    exampleYaml: [
      '- id: confirm-destructive',
      '  type: confirm',
      '  message: Continue with database reset?',
      '  var: CONTINUE_RESET',
      '  default: "no"',
      '  abortOnDecline: true'
    ].join('\n'),
    relatedPrimitives: ['match', 'command.run']
  },
  {
    name: 'match',
    category: 'Flow Control',
    summary: 'Run exactly one nested branch based on an earlier variable.',
    purpose: 'Select one nested path by matching an existing variable against branch conditions.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"match"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'var', type: 'string', required: true, defaultDescription: 'None.', description: 'Previously collected variable used for branch selection.'},
      {
        name: 'cases',
        type: 'Array<{equals?: string; oneOf?: string[]; steps: WizardStep[]}>',
        required: true,
        defaultDescription: 'None.',
        description: 'Non-empty list of mutually exclusive match cases.'
      },
      {
        name: 'default',
        type: '{steps: WizardStep[]}',
        required: false,
        defaultDescription: 'No fallback branch.',
        description: 'Optional fallback branch when no case matches.'
      }
    ],
    constraints: [
      '`var` must reference a variable collected by a prior step.',
      '`cases` must be non-empty.',
      'Each case must define exactly one of `equals` or `oneOf` and a non-empty `steps` array.',
      'Case values must not overlap across the same `match` step.',
      '`default.steps` must be non-empty when `default` is present.'
    ],
    behaviorNotes: [
      'The first matching case runs.',
      'Only the selected branch runs in non-interactive mode.',
      'Variables collected inside a branch are scoped to that branch and are not available to later top-level steps.'
    ],
    whenSupport: 'Supported. `when` gates whether the entire `match` step runs.',
    interpolationNotes: ['The branch selector does not interpolate. Nested steps follow their own interpolation rules.'],
    exampleYaml: [
      '- id: branch-by-env',
      '  type: match',
      '  var: RUNTIME_ENV',
      '  cases:',
      '    - equals: production',
      '      steps:',
      '        - id: prod-note',
      '          type: note',
      '          message: Production checks enabled.',
      '  default:',
      '    steps:',
      '      - id: fallback-note',
      '        type: display',
      '        message: Using custom runtime settings.'
    ].join('\n'),
    relatedPrimitives: ['group', 'confirm']
  },
  {
    name: 'group',
    category: 'Flow Control',
    summary: 'Bundle nested steps under shared wrapper settings.',
    purpose: 'Apply a shared `when` and optional `cwd` to a block of nested steps.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"group"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {
        name: 'steps',
        type: 'WizardStep[]',
        required: true,
        defaultDescription: 'None.',
        description: 'Non-empty list of nested steps.'
      },
      {
        name: 'cwd',
        type: 'string',
        required: false,
        defaultDescription: 'Inherits the current working directory.',
        description: 'Base directory for nested file paths, env files, banner paths, and command execution.'
      }
    ],
    constraints: [
      '`steps` must be a non-empty array.',
      '`cwd` must be a string when present.'
    ],
    behaviorNotes: [
      'A group-level `when` gates the entire block.',
      'Nested steps keep their normal primitive-specific behavior.',
      'Prompts inside a skipped group do not require values in non-interactive mode.'
    ],
    whenSupport: 'Supported. `when` applies to the entire group block.',
    interpolationNotes: ['The group wrapper does not interpolate. Nested steps follow their own interpolation rules.'],
    exampleYaml: [
      '- id: setup-files',
      '  type: group',
      '  cwd: scripts',
      '  steps:',
      '    - id: write-local-file',
      '      type: file.write',
      '      path: output.txt',
      '      overwrite: true',
      '      content: "generated\\n"'
    ].join('\n'),
    relatedPrimitives: ['match', 'file.write']
  },
  {
    name: 'display',
    category: 'Output',
    summary: 'Print interpolated informational text.',
    purpose: 'Render plain informational output during execution.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"display"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'message', type: 'string', required: true, defaultDescription: 'None.', description: 'Text to render.'}
    ],
    constraints: ['`message` must be a non-empty string.'],
    behaviorNotes: ['Renders inline output without mutating files.', 'Useful for short progress or context messages.'],
    whenSupport: 'Supported. `when` gates whether the message is shown.',
    interpolationNotes: ['`message` supports interpolation from values collected by earlier steps.'],
    exampleYaml: [
      '- id: show-target',
      '  type: display',
      '  message: Preparing deployment for {{RUNTIME_ENV}}'
    ].join('\n'),
    relatedPrimitives: ['note', 'banner']
  },
  {
    name: 'note',
    category: 'Output',
    summary: 'Print interpolated guidance in a wizard-style note card.',
    purpose: 'Render emphasized informational output during execution.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"note"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'message', type: 'string', required: true, defaultDescription: 'None.', description: 'Text to render.'}
    ],
    constraints: ['`message` must be a non-empty string.'],
    behaviorNotes: ['Renders inline output without mutating files.', 'Uses the same rounded card styling as other wizard prompts to make guidance stand out.'],
    whenSupport: 'Supported. `when` gates whether the note is shown.',
    interpolationNotes: ['`message` supports interpolation from values collected by earlier steps.'],
    exampleYaml: [
      '- id: prod-note',
      '  type: note',
      '  message: Production checks enabled.'
    ].join('\n'),
    relatedPrimitives: ['display', 'banner']
  },
  {
    name: 'ascii',
    category: 'Output',
    summary: 'Render ASCII or banner content from inline text or a file.',
    purpose: 'Print reusable or inline banner-style text during execution.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"ascii"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {
        name: 'content',
        type: 'string',
        required: false,
        defaultDescription: 'No inline content.',
        description: 'Inline banner text. Mutually exclusive with `path`.'
      },
      {
        name: 'path',
        type: 'string',
        required: false,
        defaultDescription: 'No file source.',
        description: 'Path to banner text. Mutually exclusive with `content`.'
      }
    ],
    constraints: ['Define exactly one of `content` or `path`.', 'When present, `content` and `path` must be non-empty strings.'],
    behaviorNotes: ['If `path` is used, wiiz reads the file before rendering.', 'Useful for reusable section headers.'],
    whenSupport: 'Supported. `when` gates whether the banner is shown.',
    interpolationNotes: [
      '`content` supports interpolation from values collected by earlier steps.',
      'When `path` is used, the loaded file contents are interpolated after reading.'
    ],
    exampleYaml: ['- id: section-header', '  type: ascii', '  path: .wiiz/logo.txt'].join('\n'),
    relatedPrimitives: ['banner', 'display']
  },
  {
    name: 'banner',
    category: 'Output',
    summary: 'Render banner content from inline text or a file.',
    purpose: 'Print banner-style text during execution with the same behavior as `ascii`.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"banner"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {
        name: 'content',
        type: 'string',
        required: false,
        defaultDescription: 'No inline content.',
        description: 'Inline banner text. Mutually exclusive with `path`.'
      },
      {
        name: 'path',
        type: 'string',
        required: false,
        defaultDescription: 'No file source.',
        description: 'Path to banner text. Mutually exclusive with `content`.'
      }
    ],
    constraints: ['Define exactly one of `content` or `path`.', 'When present, `content` and `path` must be non-empty strings.'],
    behaviorNotes: ['If `path` is used, wiiz reads the file before rendering.', 'Use `path` when reusing large banner text across steps.'],
    whenSupport: 'Supported. `when` gates whether the banner is shown.',
    interpolationNotes: [
      '`content` supports interpolation from values collected by earlier steps.',
      'When `path` is used, the loaded file contents are interpolated after reading.'
    ],
    exampleYaml: ['- id: section-header', '  type: banner', '  content: "*** SETUP ***"'].join('\n'),
    relatedPrimitives: ['ascii', 'note']
  },
  {
    name: 'file.write',
    category: 'File',
    summary: 'Write interpolated content to a file.',
    purpose: 'Create or replace a file from an interpolated template.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"file.write"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'path', type: 'string', required: true, defaultDescription: 'None.', description: 'Target file path.'},
      {name: 'content', type: 'string', required: true, defaultDescription: 'None.', description: 'Interpolated file content.'},
      {
        name: 'overwrite',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `false`.',
        description: 'Allows replacing an existing file.'
      }
    ],
    constraints: ['`path` and `content` must be non-empty strings.'],
    behaviorNotes: [
      'Fails on an existing file unless `overwrite: true`.',
      'Writes the full file contents in one operation.'
    ],
    whenSupport: 'Supported. `when` gates whether the file write runs.',
    interpolationNotes: [
      '`path` supports interpolation from values collected by earlier steps.',
      '`content` supports interpolation from values collected by earlier steps.'
    ],
    exampleYaml: [
      '- id: write-config',
      '  type: file.write',
      '  path: config/app.conf',
      '  overwrite: true',
      '  content: |',
      '    endpoint={{SERVICE_URL}}'
    ].join('\n'),
    relatedPrimitives: ['file.append', 'env.write']
  },
  {
    name: 'file.append',
    category: 'File',
    summary: 'Append interpolated content to a file.',
    purpose: 'Add content to the end of a file instead of replacing it.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"file.append"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'path', type: 'string', required: true, defaultDescription: 'None.', description: 'Target file path.'},
      {name: 'content', type: 'string', required: true, defaultDescription: 'None.', description: 'Interpolated content to append.'},
      {
        name: 'createIfMissing',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `true`.',
        description: 'Creates the file first when it does not exist.'
      }
    ],
    constraints: ['`path` and `content` must be non-empty strings.'],
    behaviorNotes: [
      'Creates the file when missing unless `createIfMissing: false`.',
      'Preserves existing content and appends to the end.'
    ],
    whenSupport: 'Supported. `when` gates whether the append runs.',
    interpolationNotes: [
      '`path` supports interpolation from values collected by earlier steps.',
      '`content` supports interpolation from values collected by earlier steps.'
    ],
    exampleYaml: [
      '- id: append-readme',
      '  type: file.append',
      '  path: README.md',
      '  createIfMissing: true',
      '  content: "\\nService URL: {{SERVICE_URL}}\\n"'
    ].join('\n'),
    relatedPrimitives: ['file.write', 'display']
  },
  {
    name: 'env.write',
    category: 'File',
    summary: 'Write explicit key/value entries into an env file.',
    purpose: 'Create or update a dotenv-style file from declared entries.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"env.write"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'path', type: 'string', required: true, defaultDescription: 'None.', description: 'Target env file path.'},
      {
        name: 'entries',
        type: 'Array<{key: string; value: string}>',
        required: true,
        defaultDescription: 'None.',
        description: 'Non-empty list of env entries to write.'
      },
      {
        name: 'overwrite',
        type: 'boolean',
        required: false,
        defaultDescription: 'Treated as `false`.',
        description: 'Allows merging into an existing env file.'
      }
    ],
    constraints: [
      '`path` must be a non-empty string.',
      '`entries` must be a non-empty array.',
      'Each entry must define non-empty `key` and string `value`.'
    ],
    behaviorNotes: [
      'Fails on an existing file unless `overwrite: true`.',
      'With `overwrite: true`, wiiz updates configured keys, preserves unrelated lines, and appends missing keys.',
      'Values containing spaces or tabs are written with double quotes automatically.'
    ],
    whenSupport: 'Supported. `when` gates whether the env write runs.',
    interpolationNotes: [
      '`path` supports interpolation from values collected by earlier steps.',
      'Each entry `value` supports interpolation from values collected by earlier steps.'
    ],
    exampleYaml: [
      '- id: write-env',
      '  type: env.write',
      '  path: .env',
      '  overwrite: true',
      '  entries:',
      '    - key: SERVICE_URL',
      '      value: "{{SERVICE_URL}}"'
    ].join('\n'),
    relatedPrimitives: ['file.write', 'input']
  },
  {
    name: 'command.run',
    category: 'Command',
    summary: 'Ask for consent, then run a shell command.',
    purpose: 'Execute an optional shell command only after explicit approval.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"command.run"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'command', type: 'string', required: true, defaultDescription: 'None.', description: 'Shell command to execute.'},
      {
        name: 'consentMessage',
        type: 'string',
        required: false,
        defaultDescription: 'Uses the built-in prompt asking whether to run the command.',
        description: 'Custom approval prompt shown before running.'
      },
      {
        name: 'cwd',
        type: 'string',
        required: false,
        defaultDescription: 'Runs in the current working directory or inherited group cwd.',
        description: 'Optional working directory override for the command.'
      }
    ],
    constraints: [
      '`command` must be a non-empty string.',
      '`consentMessage` and `cwd` must be strings when present.'
    ],
    behaviorNotes: [
      'Interactive mode asks for approval before executing.',
      'Non-interactive mode skips `command.run` by default.',
      'If the user declines, wiiz skips the command and continues.'
    ],
    whenSupport: 'Supported. `when` gates whether the command prompt is reached.',
    interpolationNotes: [
      '`command`, `cwd`, and `consentMessage` support interpolation from values collected by earlier steps.'
    ],
    exampleYaml: [
      '- id: install-deps',
      '  type: command.run',
      '  command: bun install',
      '  consentMessage: Install dependencies now?'
    ].join('\n'),
    relatedPrimitives: ['command.check', 'confirm']
  },
  {
    name: 'command.check',
    category: 'Command',
    summary: 'Verify a command exists in PATH before continuing.',
    purpose: 'Fail fast on missing dependencies before later steps run.',
    fields: [
      {name: 'id', type: 'string', required: true, defaultDescription: 'None.', description: 'Stable step identifier.'},
      {name: 'type', type: '"command.check"', required: true, defaultDescription: 'None.', description: 'Primitive discriminator.'},
      {name: 'command', type: 'string', required: true, defaultDescription: 'None.', description: 'Command name to look up in PATH.'},
      {
        name: 'installHint',
        type: 'string',
        required: false,
        defaultDescription: 'Uses the built-in missing-command guidance.',
        description: 'Custom guidance printed when the dependency is missing.'
      }
    ],
    constraints: [
      '`command` must be a non-empty string.',
      '`installHint` must be a string when present.'
    ],
    behaviorNotes: [
      'If the command is missing, wiiz prints install guidance and ends the run early.',
      'Use this before steps that depend on external tooling.'
    ],
    whenSupport: 'Supported. `when` gates whether the dependency check runs.',
    interpolationNotes: ['`command` and `installHint` support interpolation from values collected by earlier steps.'],
    exampleYaml: [
      '- id: check-bun',
      '  type: command.check',
      '  command: bun',
      '  installHint: Bun is required. Install it and re-run onboarding.'
    ].join('\n'),
    relatedPrimitives: ['command.run', 'display']
  }
] satisfies PrimitiveReferenceEntry[];

const primitiveReferenceMap = new Map(primitiveReferences.map(entry => [entry.name, entry]));
const primitiveCategories = ['Prompt', 'Flow Control', 'Output', 'File', 'Command'] as const;

export function getPrimitiveReference(name: string): PrimitiveReferenceEntry | undefined {
  return primitiveReferenceMap.get(name as PrimitiveName);
}

export function listPrimitiveReferences(): PrimitiveReferenceEntry[] {
  return [...primitiveReferences];
}

export function listPrimitiveCategories(): Array<{
  category: PrimitiveReferenceEntry['category'];
  entries: PrimitiveReferenceEntry[];
}> {
  return primitiveCategories.map(category => ({
    category,
    entries: primitiveReferences.filter(entry => entry.category === category)
  }));
}
