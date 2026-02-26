import type {InputDefinition, InputStep, PromptStep, SelectStep, WizardConfig} from '../config/types.js';

export function collectInputDefinitions(config: WizardConfig): InputDefinition[] {
  const definitions: InputDefinition[] = [];

  for (const step of config.steps) {
    if (step.type === 'input') {
      definitions.push({
        var: step.var,
        sourceStepId: step.id,
        inputType: 'input',
        message: step.message,
        envFile: step.envFile,
        envKey: step.envKey,
        sensitive: step.sensitive ?? true,
        required: step.required ?? true,
        default: step.default,
        validateRegex: step.validateRegex
      });
    }

    if (step.type === 'select') {
      definitions.push({
        var: step.var,
        sourceStepId: step.id,
        inputType: 'select',
        message: step.message,
        envFile: step.envFile,
        envKey: step.envKey,
        sensitive: step.sensitive ?? true,
        required: true,
        options: step.options
      });
    }
  }

  return definitions;
}

function validateInputStepValue(step: InputStep, value: string): string | undefined {
  const required = step.required ?? true;

  if (required && value.length === 0) {
    return `Input step '${step.id}' requires a value for '${step.var}'.`;
  }

  if (step.validateRegex && value.length > 0) {
    const regex = new RegExp(step.validateRegex);
    if (!regex.test(value)) {
      return `Input step '${step.id}' value for '${step.var}' does not match regex '${step.validateRegex}'.`;
    }
  }

  return undefined;
}

function validateSelectStepValue(step: SelectStep, value: string): string | undefined {
  const validValues = new Set(step.options.map(option => option.value));
  if (!validValues.has(value)) {
    return `Select step '${step.id}' value for '${step.var}' must be one of: ${step.options
      .map(option => option.value)
      .join(', ')}`;
  }

  return undefined;
}

export function getPromptValidationError(step: PromptStep, value: string): string | undefined {
  if (step.type === 'input') {
    return validateInputStepValue(step, value);
  }

  return validateSelectStepValue(step, value);
}

export type ValuesValidationResult = {
  context: Record<string, string>;
  errors: string[];
};

export function validateProvidedValues(
  config: WizardConfig,
  providedValues: Record<string, unknown>
): ValuesValidationResult {
  const context: Record<string, string> = {};
  const errors: string[] = [];

  for (const step of config.steps) {
    if (step.type !== 'input' && step.type !== 'select') {
      continue;
    }

    const provided = providedValues[step.var];

    if (provided !== undefined && typeof provided !== 'string') {
      errors.push(`Provided value '${step.var}' must be a string.`);
      continue;
    }

    const rawValue =
      typeof provided === 'string'
        ? provided
        : step.type === 'input' && step.default !== undefined
          ? step.default
          : undefined;

    if (rawValue === undefined) {
      if (step.type === 'input' && (step.required ?? true) === false) {
        context[step.var] = '';
        continue;
      }

      errors.push(`Missing required value for '${step.var}' from step '${step.id}'.`);
      continue;
    }

    if (step.type === 'input') {
      const validationError = validateInputStepValue(step, rawValue);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
    }

    if (step.type === 'select') {
      const validationError = validateSelectStepValue(step, rawValue);
      if (validationError) {
        errors.push(validationError);
        continue;
      }
    }

    context[step.var] = rawValue;
  }

  return {context, errors};
}

export function parseValuesJson(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Values JSON must be an object mapping variable names to strings.');
  }

  return parsed as Record<string, unknown>;
}
