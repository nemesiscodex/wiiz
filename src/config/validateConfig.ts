import type {
  ConfigValidationResult,
  InputStep,
  NonPromptStep,
  SelectStep,
  WizardConfig,
  WizardStep
} from './types.js';
import {extractTemplateTokens} from '../engine/interpolate.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectStepTemplateStrings(step: NonPromptStep): string[] {
  if (step.type === 'file.write' || step.type === 'file.append') {
    return [step.path, step.content];
  }

  if (step.type === 'env.write') {
    return [step.path, ...step.entries.map(entry => `${entry.key}=${entry.value}`)];
  }

  if (step.type === 'command.run') {
    return [step.command, step.cwd ?? '', step.consentMessage ?? ''];
  }

  return [step.command, step.installHint ?? ''];
}

function validateStepShape(step: unknown, index: number, errors: string[]): void {
  if (!isRecord(step)) {
    errors.push(`Step at index ${index} must be an object.`);
    return;
  }

  const id = step.id;
  const type = step.type;

  if (!isNonEmptyString(id)) {
    errors.push(`Step at index ${index} is missing a non-empty string 'id'.`);
  }

  if (!isNonEmptyString(type)) {
    errors.push(`Step '${String(id ?? index)}' is missing a non-empty string 'type'.`);
    return;
  }

  switch (type) {
    case 'input': {
      if (!isNonEmptyString(step.message)) {
        errors.push(`Input step '${String(id)}' must define a non-empty 'message'.`);
      }
      if (!isNonEmptyString(step.var)) {
        errors.push(`Input step '${String(id)}' must define a non-empty 'var'.`);
      }
      if (step.envFile !== undefined && !isNonEmptyString(step.envFile)) {
        errors.push(`Input step '${String(id)}' has invalid 'envFile'; expected non-empty string.`);
      }
      if (step.envKey !== undefined && !isNonEmptyString(step.envKey)) {
        errors.push(`Input step '${String(id)}' has invalid 'envKey'; expected non-empty string.`);
      }
      if (step.sensitive !== undefined && typeof step.sensitive !== 'boolean') {
        errors.push(`Input step '${String(id)}' has invalid 'sensitive'; expected boolean.`);
      }
      if (step.default !== undefined && typeof step.default !== 'string') {
        errors.push(`Input step '${String(id)}' has an invalid 'default'; expected string.`);
      }
      if (step.required !== undefined && typeof step.required !== 'boolean') {
        errors.push(`Input step '${String(id)}' has an invalid 'required'; expected boolean.`);
      }
      if (step.validateRegex !== undefined && typeof step.validateRegex !== 'string') {
        errors.push(`Input step '${String(id)}' has an invalid 'validateRegex'; expected string.`);
      }
      break;
    }
    case 'select': {
      if (!isNonEmptyString(step.message)) {
        errors.push(`Select step '${String(id)}' must define a non-empty 'message'.`);
      }
      if (!isNonEmptyString(step.var)) {
        errors.push(`Select step '${String(id)}' must define a non-empty 'var'.`);
      }
      if (step.envFile !== undefined && !isNonEmptyString(step.envFile)) {
        errors.push(`Select step '${String(id)}' has invalid 'envFile'; expected non-empty string.`);
      }
      if (step.envKey !== undefined && !isNonEmptyString(step.envKey)) {
        errors.push(`Select step '${String(id)}' has invalid 'envKey'; expected non-empty string.`);
      }
      if (step.sensitive !== undefined && typeof step.sensitive !== 'boolean') {
        errors.push(`Select step '${String(id)}' has invalid 'sensitive'; expected boolean.`);
      }
      if (!Array.isArray(step.options) || step.options.length === 0) {
        errors.push(`Select step '${String(id)}' must define a non-empty 'options' array.`);
        break;
      }
      for (const [optionIndex, option] of step.options.entries()) {
        if (!isRecord(option)) {
          errors.push(`Select step '${String(id)}' option at index ${optionIndex} must be an object.`);
          continue;
        }
        if (!isNonEmptyString(option.label) || !isNonEmptyString(option.value)) {
          errors.push(`Select step '${String(id)}' option at index ${optionIndex} must define non-empty 'label' and 'value'.`);
        }
      }
      break;
    }
    case 'file.write':
    case 'file.append': {
      if (!isNonEmptyString(step.path)) {
        errors.push(`Step '${String(id)}' (${type}) must define a non-empty 'path'.`);
      }
      if (!isNonEmptyString(step.content)) {
        errors.push(`Step '${String(id)}' (${type}) must define a non-empty 'content'.`);
      }
      break;
    }
    case 'env.write': {
      if (!isNonEmptyString(step.path)) {
        errors.push(`Step '${String(id)}' (env.write) must define a non-empty 'path'.`);
      }
      if (!Array.isArray(step.entries) || step.entries.length === 0) {
        errors.push(`Step '${String(id)}' (env.write) must define a non-empty 'entries' array.`);
        break;
      }
      for (const [entryIndex, entry] of step.entries.entries()) {
        if (!isRecord(entry)) {
          errors.push(`Env step '${String(id)}' entry at index ${entryIndex} must be an object.`);
          continue;
        }
        if (!isNonEmptyString(entry.key)) {
          errors.push(`Env step '${String(id)}' entry at index ${entryIndex} must define non-empty 'key'.`);
        }
        if (typeof entry.value !== 'string') {
          errors.push(`Env step '${String(id)}' entry at index ${entryIndex} must define string 'value'.`);
        }
      }
      break;
    }
    case 'command.run': {
      if (!isNonEmptyString(step.command)) {
        errors.push(`Step '${String(id)}' (command.run) must define a non-empty 'command'.`);
      }
      if (step.consentMessage !== undefined && typeof step.consentMessage !== 'string') {
        errors.push(
          `Step '${String(id)}' (command.run) has invalid 'consentMessage'; expected string.`
        );
      }
      if (step.cwd !== undefined && typeof step.cwd !== 'string') {
        errors.push(`Step '${String(id)}' (command.run) has invalid 'cwd'; expected string.`);
      }
      break;
    }
    case 'command.check': {
      if (!isNonEmptyString(step.command)) {
        errors.push(`Step '${String(id)}' (command.check) must define a non-empty 'command'.`);
      }
      if (step.installHint !== undefined && typeof step.installHint !== 'string') {
        errors.push(
          `Step '${String(id)}' (command.check) has invalid 'installHint'; expected string.`
        );
      }
      break;
    }
    default:
      errors.push(`Step '${String(id)}' has unsupported type '${type}'.`);
  }
}

function validateInterpolationReferences(steps: WizardStep[], errors: string[]): string[] {
  const availableVars = new Set<string>();
  const assignedVars = new Set<string>();
  const duplicateVars: string[] = [];

  for (const step of steps) {
    if (step.type === 'input' || step.type === 'select') {
      if (assignedVars.has(step.var)) {
        duplicateVars.push(step.var);
      }
      assignedVars.add(step.var);
      availableVars.add(step.var);
      continue;
    }

    const templates = collectStepTemplateStrings(step);
    for (const template of templates) {
      for (const token of extractTemplateTokens(template)) {
        if (!availableVars.has(token)) {
          errors.push(
            `Step '${step.id}' references '{{${token}}}' before it is collected by a prior input/select step.`
          );
        }
      }
    }
  }

  return [...new Set(duplicateVars)];
}

function validateStepSemantics(config: WizardConfig, errors: string[], warnings: string[]): void {
  const seenStepIds = new Set<string>();

  for (const step of config.steps) {
    if (seenStepIds.has(step.id)) {
      errors.push(`Duplicate step id '${step.id}'.`);
    }
    seenStepIds.add(step.id);

    if (step.type === 'input' && step.validateRegex) {
      try {
        new RegExp(step.validateRegex);
      } catch (error) {
        errors.push(`Input step '${step.id}' has invalid validateRegex: ${String(error)}`);
      }
    }

    if (step.type === 'select') {
      const values = step.options.map(option => option.value);
      const uniqueValues = new Set(values);
      if (uniqueValues.size !== values.length) {
        errors.push(`Select step '${step.id}' has duplicate option values.`);
      }
    }
  }

  const duplicateVars = validateInterpolationReferences(config.steps, errors);
  for (const duplicateVar of duplicateVars) {
    warnings.push(`Variable '${duplicateVar}' is collected by multiple steps; latest value wins.`);
  }
}

export function validateConfigShape(config: unknown): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(config)) {
    return {errors: ['Config root must be an object.'], warnings};
  }

  if (config.version !== 1) {
    errors.push(`Config 'version' must be 1.`);
  }

  if (!isNonEmptyString(config.name)) {
    errors.push(`Config 'name' must be a non-empty string.`);
  }

  if (!Array.isArray(config.steps) || config.steps.length === 0) {
    errors.push(`Config 'steps' must be a non-empty array.`);
    return {errors, warnings};
  }

  for (const [index, step] of config.steps.entries()) {
    validateStepShape(step, index, errors);
  }

  if (errors.length > 0) {
    return {errors, warnings};
  }

  validateStepSemantics(config as WizardConfig, errors, warnings);

  return {errors, warnings};
}

export function assertValidConfig(config: unknown): asserts config is WizardConfig {
  const validation = validateConfigShape(config);
  if (validation.errors.length > 0) {
    throw new Error(`Invalid config:\n${validation.errors.map(error => `- ${error}`).join('\n')}`);
  }
}

export function isPromptStep(step: WizardStep): step is InputStep | SelectStep {
  return step.type === 'input' || step.type === 'select';
}
