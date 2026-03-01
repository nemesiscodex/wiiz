import type {
  ConfigValidationResult,
  InputStep,
  MatchCase,
  StepWhen,
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

function collectBannerTemplates(step: {content?: string; path?: string}): string[] {
  const templates: string[] = [];

  if (typeof step.content === 'string') {
    templates.push(step.content);
  }

  if (typeof step.path === 'string') {
    templates.push(step.path);
  }

  return templates;
}

function collectStepTemplateStrings(step: WizardStep): string[] {
  if (step.type === 'input' || step.type === 'select') {
    return [];
  }

  if (step.type === 'file.write' || step.type === 'file.append') {
    return [step.path, step.content];
  }

  if (step.type === 'env.write') {
    return [step.path, ...step.entries.map(entry => `${entry.key}=${entry.value}`)];
  }

  if (step.type === 'command.run') {
    return [step.command, step.cwd ?? '', step.consentMessage ?? ''];
  }

  if (step.type === 'display' || step.type === 'note') {
    return [step.message];
  }

  if (step.type === 'ascii' || step.type === 'banner') {
    return collectBannerTemplates(step);
  }

  if (step.type === 'confirm') {
    return [step.message];
  }

  if (step.type === 'command.check') {
    return [step.command, step.installHint ?? ''];
  }

  if (step.type === 'group') {
    return [step.cwd ?? ''];
  }

  return [];
}

function validateCaseConditionShape(
  condition: unknown,
  label: string,
  errors: string[]
): condition is MatchCase {
  if (!isRecord(condition)) {
    errors.push(`${label} must be an object.`);
    return false;
  }

  if (condition.equals !== undefined && typeof condition.equals !== 'string') {
    errors.push(`${label} has invalid 'equals'; expected string.`);
  }

  if (condition.oneOf !== undefined) {
    if (!Array.isArray(condition.oneOf) || condition.oneOf.length === 0) {
      errors.push(`${label} has invalid 'oneOf'; expected non-empty string array.`);
    } else if (!condition.oneOf.every(value => typeof value === 'string')) {
      errors.push(`${label} has invalid 'oneOf'; expected non-empty string array.`);
    }
  }

  if ((condition.equals === undefined) === (condition.oneOf === undefined)) {
    errors.push(`${label} must define exactly one of 'equals' or 'oneOf'.`);
  }

  return true;
}

function validateWhenShape(
  when: unknown,
  label: string,
  errors: string[]
): when is StepWhen {
  if (!isRecord(when)) {
    errors.push(`${label} has invalid 'when'; expected object.`);
    return false;
  }

  if (!isNonEmptyString(when.var)) {
    errors.push(`${label} has invalid 'when.var'; expected non-empty string.`);
  }

  if (when.equals !== undefined && typeof when.equals !== 'string') {
    errors.push(`${label} has invalid 'when.equals'; expected string.`);
  }

  if (when.notEquals !== undefined && typeof when.notEquals !== 'string') {
    errors.push(`${label} has invalid 'when.notEquals'; expected string.`);
  }

  if (when.exists !== undefined && typeof when.exists !== 'boolean') {
    errors.push(`${label} has invalid 'when.exists'; expected boolean.`);
  }

  if (when.oneOf !== undefined) {
    if (!Array.isArray(when.oneOf) || when.oneOf.length === 0) {
      errors.push(`${label} has invalid 'when.oneOf'; expected non-empty string array.`);
    } else if (!when.oneOf.every(value => typeof value === 'string')) {
      errors.push(`${label} has invalid 'when.oneOf'; expected non-empty string array.`);
    }
  }

  if (
    when.equals === undefined &&
    when.notEquals === undefined &&
    when.exists === undefined &&
    when.oneOf === undefined
  ) {
    errors.push(
      `${label} defines 'when' but no condition. Provide at least one of: equals, notEquals, oneOf, exists.`
    );
  }

  return true;
}

function validateStepsShape(steps: unknown[], errors: string[], path = 'steps'): void {
  for (const [index, step] of steps.entries()) {
    validateStepShape(step, index, errors, path);
  }
}

function validateStepShape(step: unknown, index: number, errors: string[], path = 'steps'): void {
  if (!isRecord(step)) {
    errors.push(`Step at ${path}[${index}] must be an object.`);
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

  const stepLabel = `Step '${String(id)}'`;
  if (step.when !== undefined) {
    validateWhenShape(step.when, stepLabel, errors);
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
    case 'display':
    case 'note': {
      if (!isNonEmptyString(step.message)) {
        errors.push(`Step '${String(id)}' (${type}) must define a non-empty 'message'.`);
      }
      break;
    }
    case 'ascii':
    case 'banner': {
      const hasContent = step.content !== undefined;
      const hasPath = step.path !== undefined;

      if (hasContent && !isNonEmptyString(step.content)) {
        errors.push(`Step '${String(id)}' (${type}) has invalid 'content'; expected non-empty string.`);
      }

      if (hasPath && !isNonEmptyString(step.path)) {
        errors.push(`Step '${String(id)}' (${type}) has invalid 'path'; expected non-empty string.`);
      }

      if (hasContent === hasPath) {
        errors.push(
          `Step '${String(id)}' (${type}) must define exactly one of 'content' or 'path'.`
        );
      }
      break;
    }
    case 'confirm': {
      if (!isNonEmptyString(step.message)) {
        errors.push(`Step '${String(id)}' (confirm) must define a non-empty 'message'.`);
      }
      if (step.var !== undefined && !isNonEmptyString(step.var)) {
        errors.push(`Step '${String(id)}' (confirm) has invalid 'var'; expected non-empty string.`);
      }
      if (
        step.default !== undefined &&
        step.default !== 'yes' &&
        step.default !== 'no'
      ) {
        errors.push(`Step '${String(id)}' (confirm) has invalid 'default'; expected 'yes' or 'no'.`);
      }
      if (
        step.abortOnDecline !== undefined &&
        typeof step.abortOnDecline !== 'boolean'
      ) {
        errors.push(
          `Step '${String(id)}' (confirm) has invalid 'abortOnDecline'; expected boolean.`
        );
      }
      break;
    }
    case 'group': {
      if (step.cwd !== undefined && typeof step.cwd !== 'string') {
        errors.push(`Step '${String(id)}' (group) has invalid 'cwd'; expected string.`);
      }
      if (!Array.isArray(step.steps) || step.steps.length === 0) {
        errors.push(`Step '${String(id)}' (group) must define a non-empty 'steps' array.`);
        break;
      }

      validateStepsShape(step.steps, errors, `${stepLabel}.steps`);
      break;
    }
    case 'match': {
      if (!isNonEmptyString(step.var)) {
        errors.push(`Step '${String(id)}' (match) must define a non-empty 'var'.`);
      }
      if (!Array.isArray(step.cases) || step.cases.length === 0) {
        errors.push(`Step '${String(id)}' (match) must define a non-empty 'cases' array.`);
        break;
      }

      for (const [caseIndex, matchCase] of step.cases.entries()) {
        const caseLabel = `Step '${String(id)}' case at index ${caseIndex}`;
        if (!validateCaseConditionShape(matchCase, caseLabel, errors)) {
          continue;
        }

        if (!Array.isArray(matchCase.steps) || matchCase.steps.length === 0) {
          errors.push(`${caseLabel} must define a non-empty 'steps' array.`);
          continue;
        }

        validateStepsShape(matchCase.steps, errors, `${stepLabel}.cases[${caseIndex}].steps`);
      }

      if (step.default !== undefined) {
        if (!isRecord(step.default)) {
          errors.push(`Step '${String(id)}' (match) has invalid 'default'; expected object.`);
          break;
        }

        if (!Array.isArray(step.default.steps) || step.default.steps.length === 0) {
          errors.push(`Step '${String(id)}' (match) default must define a non-empty 'steps' array.`);
          break;
        }

        validateStepsShape(step.default.steps, errors, `${stepLabel}.default.steps`);
      }
      break;
    }
    default:
      errors.push(`Step '${String(id)}' has unsupported type '${type}'.`);
  }
}

function validateStepSemantics(config: WizardConfig, errors: string[], warnings: string[]): void {
  const seenStepIds = new Set<string>();
  const assignedVars = new Set<string>();
  const duplicateVars = new Set<string>();

  function recordAssignedVar(varName: string): void {
    if (assignedVars.has(varName)) {
      duplicateVars.add(varName);
    }
    assignedVars.add(varName);
  }

  function validateSteps(steps: WizardStep[], availableVars: Set<string>): void {
    for (const step of steps) {
      if (seenStepIds.has(step.id)) {
        errors.push(`Duplicate step id '${step.id}'.`);
      }
      seenStepIds.add(step.id);

      if (step.when) {
        if (!availableVars.has(step.when.var)) {
          errors.push(
            `Step '${step.id}' references 'when.var=${step.when.var}' before it is collected by a prior step.`
          );
        }

        if (step.when.oneOf) {
          const unique = new Set(step.when.oneOf);
          if (unique.size !== step.when.oneOf.length) {
            errors.push(`Step '${step.id}' has duplicate values in 'when.oneOf'.`);
          }
        }
      }

      const templates = collectStepTemplateStrings(step);
      for (const template of templates) {
        for (const token of extractTemplateTokens(template)) {
          if (!availableVars.has(token)) {
            errors.push(
              `Step '${step.id}' references '{{${token}}}' before it is collected by a prior step.`
            );
          }
        }
      }

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

      if (step.type === 'confirm') {
        if (step.abortOnDecline === false && step.default === 'no') {
          warnings.push(
            `Confirm step '${step.id}' defaults to 'no' but does not abort when declined; it will auto-continue in non-interactive mode.`
          );
        }
      }

      if (step.type === 'group') {
        validateSteps(step.steps, availableVars);
        continue;
      }

      if (step.type === 'match') {
        if (!availableVars.has(step.var)) {
          errors.push(
            `Step '${step.id}' references 'var=${step.var}' before it is collected by a prior step.`
          );
        }

        const seenCaseValues = new Set<string>();
        for (const [caseIndex, matchCase] of step.cases.entries()) {
          const rawValues = matchCase.equals !== undefined ? [matchCase.equals] : (matchCase.oneOf ?? []);
          const uniqueCaseValues = new Set(rawValues);
          if (uniqueCaseValues.size !== rawValues.length) {
            errors.push(`Step '${step.id}' case at index ${caseIndex} has duplicate values.`);
          }

          for (const value of uniqueCaseValues) {
            if (seenCaseValues.has(value)) {
              errors.push(`Step '${step.id}' has overlapping match cases for value '${value}'.`);
            }
            seenCaseValues.add(value);
          }

          validateSteps(matchCase.steps, new Set(availableVars));
        }

        if (step.default) {
          validateSteps(step.default.steps, new Set(availableVars));
        }

        continue;
      }

      if (step.type === 'input' || step.type === 'select') {
        recordAssignedVar(step.var);
        availableVars.add(step.var);
      }

      if (step.type === 'confirm' && step.var) {
        recordAssignedVar(step.var);
        availableVars.add(step.var);
      }
    }
  }

  validateSteps(config.steps, new Set<string>());

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

  validateStepsShape(config.steps, errors);

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
