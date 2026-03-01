import type {
  InputDefinition,
  NonPromptStep,
  StepWhen,
  WizardConfig,
  WizardStep
} from '../config/types.js';
import {collectInputDefinitions} from './context.js';

type LlmOperation = {
  stepId: string;
  type: NonPromptStep['type'];
  when?: StepWhen;
  pathTemplate?: string;
  sourcePathTemplate?: string;
  contentTemplate?: string;
  messageTemplate?: string;
  entries?: Array<{key: string; valueTemplate: string}>;
  commandTemplate?: string;
  cwdTemplate?: string;
  consentMessage?: string;
  installHint?: string;
};

type LlmSafety = {
  stepId: string;
  type: NonPromptStep['type'];
  when?: StepWhen;
  overwrite?: boolean;
  createIfMissing?: boolean;
  requiresApproval?: boolean;
  blocksWizardWhenMissing?: boolean;
};

function toOperation(step: WizardStep): LlmOperation | undefined {
  if (step.type === 'file.write' || step.type === 'file.append') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      pathTemplate: step.path,
      contentTemplate: step.content
    };
  }

  if (step.type === 'env.write') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      pathTemplate: step.path,
      entries: step.entries.map(entry => ({key: entry.key, valueTemplate: entry.value}))
    };
  }

  if (step.type === 'command.run') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      commandTemplate: step.command,
      cwdTemplate: step.cwd,
      consentMessage: step.consentMessage
    };
  }

  if (step.type === 'command.check') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      commandTemplate: step.command,
      installHint: step.installHint
    };
  }

  if (step.type === 'display' || step.type === 'note') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      messageTemplate: step.message
    };
  }

  if (step.type === 'ascii' || step.type === 'banner') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      sourcePathTemplate: step.path,
      contentTemplate: step.content
    };
  }

  return undefined;
}

function toSafety(step: WizardStep): LlmSafety | undefined {
  if (step.type === 'file.write') {
    return {stepId: step.id, type: step.type, when: step.when, overwrite: step.overwrite ?? false};
  }

  if (step.type === 'file.append') {
    return {
      stepId: step.id,
      type: step.type,
      when: step.when,
      createIfMissing: step.createIfMissing ?? true
    };
  }

  if (step.type === 'env.write') {
    return {stepId: step.id, type: step.type, when: step.when, overwrite: step.overwrite ?? false};
  }

  if (step.type === 'command.run') {
    return {stepId: step.id, type: step.type, when: step.when, requiresApproval: true};
  }

  if (step.type === 'command.check') {
    return {stepId: step.id, type: step.type, when: step.when, blocksWizardWhenMissing: true};
  }

  if (step.type === 'display' || step.type === 'note' || step.type === 'ascii' || step.type === 'banner') {
    return {stepId: step.id, type: step.type, when: step.when};
  }

  return undefined;
}

function toLlmInput(definition: InputDefinition) {
  return {
    var: definition.var,
    sourceStepId: definition.sourceStepId,
    inputType: definition.inputType,
    message: definition.message,
    envFile: definition.envFile,
    envKey: definition.envKey,
    sensitive: definition.sensitive,
    required: definition.required,
    default: definition.default,
    validateRegex: definition.validateRegex,
    options: definition.options
  };
}

function collectNestedOperations(steps: WizardStep[]): LlmOperation[] {
  const operations: LlmOperation[] = [];

  for (const step of steps) {
    const operation = toOperation(step);
    if (operation) {
      operations.push(operation);
    }

    if (step.type === 'match') {
      for (const matchCase of step.cases) {
        operations.push(...collectNestedOperations(matchCase.steps));
      }

      if (step.default) {
        operations.push(...collectNestedOperations(step.default.steps));
      }
    }

    if (step.type === 'group') {
      operations.push(...collectNestedOperations(step.steps));
    }
  }

  return operations;
}

function collectNestedSafety(steps: WizardStep[]): LlmSafety[] {
  const safety: LlmSafety[] = [];

  for (const step of steps) {
    const entry = toSafety(step);
    if (entry) {
      safety.push(entry);
    }

    if (step.type === 'match') {
      for (const matchCase of step.cases) {
        safety.push(...collectNestedSafety(matchCase.steps));
      }

      if (step.default) {
        safety.push(...collectNestedSafety(step.default.steps));
      }
    }

    if (step.type === 'group') {
      safety.push(...collectNestedSafety(step.steps));
    }
  }

  return safety;
}

export function describeConfigForLlm(config: WizardConfig, resolvedPath: string) {
  const inputs = collectInputDefinitions(config);
  const operations = collectNestedOperations(config.steps);
  const safety = collectNestedSafety(config.steps);

  const requirements = inputs.filter(input => input.required && !input.default).map(input => input.var);

  const exampleValues = Object.fromEntries(
    inputs.map(input => [input.var, input.default ?? '<fill-me>'])
  );

  return {
    version: config.version,
    name: config.name,
    configPath: resolvedPath,
    inputs: inputs.map(toLlmInput),
    steps: config.steps,
    operations,
    requirements,
    safety,
    exampleValues
  };
}
