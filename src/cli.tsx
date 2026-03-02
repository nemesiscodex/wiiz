import React from 'react';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Box, Text, render} from 'ink';
import Spinner from 'ink-spinner';
import {WizardApp, type PromptResult} from './WizardApp.js';
import {loadConfig} from './config/loadConfig.js';
import {
  getPrimitiveReference,
  listPrimitiveCategories,
  type PrimitiveFieldReference
} from './config/primitiveReference.js';
import {assertValidConfig, isPromptStep, validateConfigShape} from './config/validateConfig.js';
import type {CommandRunStep, ConfirmStep, MatchCase, MatchStep, PromptStep, SelectStep, WizardStep} from './config/types.js';
import {executeOperationStep, type StepExecutionResult} from './engine/executeStep.js';
import {getPromptValidationError, parseValuesJson, validateProvidedValues} from './engine/context.js';
import {formatEnvPrefillPreview, loadEnvPrefillValue} from './engine/envPrefill.js';
import {interpolateTemplate} from './engine/interpolate.js';
import {shouldRunWhen} from './engine/when.js';
import {installWiizAuthorSkill} from './skills/installSkill.js';

function formatField(field: PrimitiveFieldReference): string {
  return [
    `- ${field.name} (${field.type}, ${field.required ? 'required' : 'optional'})`,
    `  Default: ${field.defaultDescription}`,
    `  ${field.description}`
  ].join('\n');
}

function renderGeneralHelp(): string {
  return [
    'wiiz',
    '',
    'Repeatable repository onboarding from `.wiiz/wizard.yaml`.',
    '',
    'Usage:',
    '  wiiz help',
    '  wiiz help list',
    '  wiiz help <primitive>',
    '  wiiz run [--config <path>] [--dry-run] [--values <file.json>]',
    '  wiiz validate [--config <path>]',
    '  wiiz skill [--force]',
    '',
    'Top-level commands:',
    '  help      Show CLI help, primitive lists, or primitive details.',
    '  run       Execute the onboarding flow.',
    '  validate  Validate `.wiiz/wizard.yaml` without running it.',
    '  skill     Install the built-in `wiiz-yaml-author` skill.',
    '',
    'Primitive reference:',
    '  wiiz help list        List all primitives by category.',
    '  wiiz help <primitive> Show exact fields, defaults, and usage for one primitive.'
  ].join('\n');
}

function renderPrimitiveListHelp(): string {
  const lines = ['Primitive Reference', '', 'Run `wiiz help <primitive>` for detailed usage.'];

  for (const group of listPrimitiveCategories()) {
    if (group.entries.length === 0) {
      continue;
    }

    lines.push('', `${group.category}:`);
    for (const entry of group.entries) {
      lines.push(`  ${entry.name}  ${entry.summary}`);
    }
  }

  lines.push('', 'Details: wiiz help <primitive>');
  return lines.join('\n');
}

function renderPrimitiveDetailHelp(name: string): string | undefined {
  const entry = getPrimitiveReference(name);
  if (!entry) {
    return undefined;
  }

  const requiredFields = entry.fields.filter(field => field.required);
  const optionalFields = entry.fields.filter(field => !field.required);

  const lines = [
    `Primitive: ${entry.name}`,
    '',
    `Purpose: ${entry.purpose}`,
    '',
    'Required fields:'
  ];

  if (requiredFields.length === 0) {
    lines.push('- None.');
  } else {
    lines.push(...requiredFields.map(formatField));
  }

  lines.push('', 'Optional fields:');
  if (optionalFields.length === 0) {
    lines.push('- None.');
  } else {
    lines.push(...optionalFields.map(formatField));
  }

  lines.push('', 'Constraints and validation rules:');
  lines.push(...entry.constraints.map(rule => `- ${rule}`));

  lines.push('', 'Runtime behavior and defaults:');
  lines.push(...entry.behaviorNotes.map(note => `- ${note}`));

  lines.push('', '`when` support:');
  lines.push(`- ${entry.whenSupport}`);

  lines.push('', 'Interpolation notes:');
  lines.push(...entry.interpolationNotes.map(note => `- ${note}`));

  lines.push('', 'Minimal YAML example:', '```yaml', entry.exampleYaml, '```');

  lines.push('', 'Related primitives:');
  lines.push(`- ${entry.relatedPrimitives.join(', ')}`);

  return lines.join('\n');
}

function printGeneralHelp(): void {
  console.log(renderGeneralHelp());
}

function printPrimitiveListHelp(): void {
  console.log(renderPrimitiveListHelp());
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function RunningStep({label}: {label: string}) {
  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" /> {label}
      </Text>
    </Box>
  );
}

async function promptForStep(step: PromptStep): Promise<PromptResult> {
  let result: PromptResult | undefined;

  const {waitUntilExit} = render(
    <WizardApp
      step={step}
      onFinish={nextResult => {
        result = nextResult;
      }}
    />
  );

  await waitUntilExit();

  if (!result) {
    return {status: 'cancelled'};
  }

  return result;
}

async function promptForCommandPermission(step: CommandRunStep): Promise<boolean | 'cancelled'> {
  const headline = step.consentMessage ?? 'Run this command now?';
  const promptMessage = `${headline}\nCommand: ${step.command}\nWarning: only run commands you understand.`;

  const confirmStep: SelectStep = {
    id: `${step.id}__confirm`,
    type: 'select',
    message: promptMessage,
    var: `${step.id}__confirm`,
    options: [
      {label: 'Yes, run it', value: 'yes'},
      {label: 'No, skip', value: 'no'}
    ]
  };

  const result = await promptForStep(confirmStep);
  if (result.status === 'cancelled') {
    return 'cancelled';
  }

  return result.value === 'yes';
}

async function executeWithSpinner<T>(label: string, task: () => Promise<T>): Promise<T> {
  const instance = render(<RunningStep label={label} />);
  try {
    return await task();
  } finally {
    instance.clear();
    instance.unmount();
  }
}

function printValidationMessages(prefix: string, messages: string[]): void {
  if (messages.length === 0) {
    return;
  }

  console.error(prefix);
  for (const message of messages) {
    console.error(`- ${message}`);
  }
}

function printMissingConfigMessage(): void {
  console.log('No onboarding config found yet.');
  console.log('Create .wiiz/wizard.yaml to continue.');
  console.log('Tip: run `wiiz skill` to install a skill that can generate this file.');
}

async function loadConfigWithHelp(configPath: string | undefined): Promise<
  | {
      loaded: Awaited<ReturnType<typeof loadConfig>>;
      shouldContinue: true;
    }
  | {
      shouldContinue: false;
    }
> {
  try {
    return {
      loaded: await loadConfig(configPath),
      shouldContinue: true
    };
  } catch (error) {
    const message = String(error);
    if (message.includes('Config file not found:')) {
      printMissingConfigMessage();
      return {shouldContinue: false};
    }

    throw error;
  }
}

async function loadValuesFile(valuesPath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(valuesPath, 'utf8');
    return parseValuesJson(raw);
  } catch (error) {
    throw new Error(`Unable to load values file '${valuesPath}': ${String(error)}`);
  }
}

function formatResultLine(result: StepExecutionResult): string {
  const skipped =
    result.action === 'command.run' && result.contentPreview.startsWith('Skipped command by user choice');
  const blocked = result.stopExecution === true;

  const symbol = blocked ? '✗' : skipped ? '○' : '✓';
  const color = blocked ? '\x1b[31m' : skipped ? '\x1b[33m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const statusPrefix = `${color}${symbol}${reset} ${result.stepId}`;

  if (result.type === 'command.check' || result.type === 'command.run') {
    return `${statusPrefix}: ${result.contentPreview}`;
  }

  if (result.type === 'ascii' || result.type === 'banner') {
    const sourceSuffix = result.targetPath ? ` (from ${result.targetPath})` : '';
    return `${statusPrefix}${sourceSuffix}:\n${formatIndentedBlock(result.contentPreview)}`;
  }

  if (result.type === 'display') {
    return `${statusPrefix}:\n${formatIndentedBlock(result.contentPreview)}`;
  }

  if (result.type === 'note') {
    return `${statusPrefix}:\n${formatFramedBlock(result.contentPreview)}`;
  }

  if (result.targetPath) {
    return `${statusPrefix} -> ${result.targetPath}: ${result.contentPreview}`;
  }

  return `${statusPrefix}: ${result.contentPreview}`;
}

function normalizeRenderedLines(content: string): string[] {
  const normalized = content.replaceAll('\r\n', '\n').replace(/\n+$/u, '');
  if (normalized.length === 0) {
    return [''];
  }

  return normalized.split('\n');
}

function formatIndentedBlock(content: string): string {
  return normalizeRenderedLines(content).map(line => `  ${line}`).join('\n');
}

function formatFramedBlock(content: string): string {
  const lines = normalizeRenderedLines(content);
  const width = Math.max(...lines.map(line => line.length), 0);
  const border = `  +-${'-'.repeat(width)}-+`;
  const body = lines.map(line => `  | ${line.padEnd(width, ' ')} |`).join('\n');

  return [border, body, border].join('\n');
}

async function resolveConfirmDecision(
  step: ConfirmStep,
  context: Record<string, string>,
  valuesPath: string | undefined
): Promise<boolean | 'cancelled'> {
  const message = interpolateTemplate(step.message, context);

  if (valuesPath) {
    return step.default === 'yes';
  }

  const confirmPrompt: SelectStep = {
    id: `${step.id}__confirm`,
    type: 'select',
    message,
    var: `${step.id}__confirm`,
    options: [
      {label: 'Yes, continue', value: 'yes'},
      {label: 'No, stop here', value: 'no'}
    ]
  };

  const result = await promptForStep(confirmPrompt);
  if (result.status === 'cancelled') {
    return 'cancelled';
  }

  return result.value === 'yes';
}

function resolveMatchBranch(
  step: MatchStep,
  context: Record<string, string>
): {steps: WizardStep[]; description: string} | undefined {
  const selectedValue = context[step.var];
  const matchedCase = step.cases.find((candidate: MatchCase) =>
    candidate.equals !== undefined
      ? candidate.equals === selectedValue
      : (candidate.oneOf ?? []).includes(selectedValue)
  );

  if (matchedCase) {
    return {
      steps: matchedCase.steps,
      description: `matched ${step.var}=${selectedValue}`
    };
  }

  if (step.default) {
    return {
      steps: step.default.steps,
      description: `used default branch for ${step.var}=${selectedValue ?? '(unset)'}`
    };
  }

  return undefined;
}

function resolveGroupCwd(
  cwdTemplate: string | undefined,
  context: Record<string, string>,
  cwd: string
): string {
  if (!cwdTemplate) {
    return cwd;
  }

  return path.resolve(cwd, interpolateTemplate(cwdTemplate, context));
}

async function runCommand(args: string[]): Promise<number> {
  const configPath = getFlagValue(args, '--config');
  const valuesPath = getFlagValue(args, '--values');
  const dryRun = hasFlag(args, '--dry-run');

  const loadResult = await loadConfigWithHelp(configPath);
  if (!loadResult.shouldContinue) {
    return 0;
  }

  const {loaded} = loadResult;
  const validation = validateConfigShape(loaded.config);

  printValidationMessages('Config warnings:', validation.warnings);
  if (validation.errors.length > 0) {
    printValidationMessages('Config validation failed:', validation.errors);
    return 1;
  }

  assertValidConfig(loaded.config);

  const context: Record<string, string> = {};

  if (valuesPath) {
    let providedValues: Record<string, unknown>;
    try {
      providedValues = await loadValuesFile(valuesPath);
    } catch (error) {
      console.log(String(error));
      console.log('Provide a valid JSON file mapping variable names to string values.');
      return 0;
    }
    const valuesValidation = validateProvidedValues(loaded.config, providedValues);

    if (valuesValidation.errors.length > 0) {
      printValidationMessages('Values validation failed:', valuesValidation.errors);
      return 1;
    }

    Object.assign(context, valuesValidation.context);
  }

  const operationResults: Awaited<ReturnType<typeof executeOperationStep>>[] = [];
  const cwd = process.cwd();

  async function runSteps(
    steps: WizardStep[],
    activeCwd: string
  ): Promise<'completed' | 'cancelled' | 'stopped' | 'failed'> {
    for (const step of steps) {
      if (!shouldRunWhen(step.when, context)) {
        console.log(`- \x1b[90m○\x1b[0m ${step.id}: skipped (when condition not met)`);
        continue;
      }

      if (step.type === 'match') {
        const branch = resolveMatchBranch(step, context);
        if (!branch) {
          console.log(`- \x1b[90m○\x1b[0m ${step.id}: no branch matched ${step.var}=${context[step.var] ?? '(unset)'}`);
          continue;
        }

        console.log(`- \x1b[32m✓\x1b[0m ${step.id}: ${branch.description}`);
        const nestedStatus = await runSteps(branch.steps, activeCwd);
        if (nestedStatus !== 'completed') {
          return nestedStatus;
        }
        continue;
      }

      if (step.type === 'group') {
        const groupCwd = resolveGroupCwd(step.cwd, context, activeCwd);
        console.log(`- \x1b[32m✓\x1b[0m ${step.id}: entering group`);
        const nestedStatus = await runSteps(step.steps, groupCwd);
        if (nestedStatus !== 'completed') {
          return nestedStatus;
        }
        continue;
      }

      if (step.type === 'confirm') {
        const decision = await resolveConfirmDecision(step, context, valuesPath);
        if (decision === 'cancelled') {
          return 'cancelled';
        }

        if (step.var) {
          context[step.var] = decision ? 'yes' : 'no';
        }

        if (decision) {
          console.log(`- \x1b[32m✓\x1b[0m ${step.id}: confirmed`);
          continue;
        }

        console.log(`- \x1b[33m○\x1b[0m ${step.id}: declined`);
        if (step.abortOnDecline ?? true) {
          console.log('Stopping onboarding at confirmation checkpoint.');
          return 'stopped';
        }
        continue;
      }

      if (isPromptStep(step)) {
        if (valuesPath) {
          continue;
        }

        const prefill = await loadEnvPrefillValue(step, activeCwd);
        if (prefill) {
          const canKeep = getPromptValidationError(step, prefill.value) === undefined;

          if (canKeep) {
            const keepReplaceStep: SelectStep = {
              id: `${step.id}__keep_replace`,
              type: 'select',
              message: `Found ${prefill.envKey} in ${prefill.envFile} (${formatEnvPrefillPreview(step, prefill.value)}). Keep or replace?`,
              var: `${step.var}__keep_replace`,
              options: [
                {label: 'Keep existing', value: 'keep'},
                {label: 'Replace value', value: 'replace'}
              ]
            };
            const keepReplaceResult = await promptForStep(keepReplaceStep);
            if (keepReplaceResult.status === 'cancelled') {
              return 'cancelled';
            }

            if (keepReplaceResult.value === 'keep') {
              context[step.var] = prefill.value;
              console.log(`- \x1b[32m✓\x1b[0m ${step.id}: Keeping existing ${prefill.envKey} from ${prefill.envFile}`);
              continue;
            }
          }
        }

        const promptResult = await promptForStep(step);
        if (promptResult.status === 'cancelled') {
          return 'cancelled';
        }

        context[step.var] = promptResult.value;
        continue;
      }

      let approved: boolean | undefined;
      if (step.type === 'command.run') {
        if (valuesPath) {
          approved = false;
        } else {
          const permission = await promptForCommandPermission(step);
          if (permission === 'cancelled') {
            return 'cancelled';
          }
          approved = permission;
        }
      }

      try {
        const shouldSpin =
          !valuesPath &&
          step.type !== 'display' &&
          step.type !== 'note' &&
          step.type !== 'ascii' &&
          step.type !== 'banner' &&
          !(step.type === 'command.run' && approved && !dryRun);
        const execute = () => executeOperationStep(step, {context, dryRun, approved, cwd: activeCwd});
        if (!shouldSpin && step.type === 'command.run' && approved && !dryRun) {
          console.log(`\x1b[36m→ Running ${step.id}...\x1b[0m`);
        }
        const result = shouldSpin
          ? await executeWithSpinner(`Running ${step.id}...`, execute)
          : await execute();
        operationResults.push(result);
        console.log(`- ${formatResultLine(result)}`);

        if (step.type === 'command.check' && result.stopExecution) {
          console.log(`\n${result.contentPreview}`);
          console.log('Ending onboarding until dependency is installed.');
          return 'stopped';
        }
      } catch (error) {
        console.error(`Failed at step '${step.id}': ${String(error)}`);
        return 'failed';
      }
    }

    return 'completed';
  }

  const runStatus = await runSteps(loaded.config.steps, cwd);
  if (runStatus === 'cancelled') {
    console.log('\nWizard cancelled.');
    return 0;
  }

  if (runStatus === 'stopped') {
    return 0;
  }

  if (runStatus === 'failed') {
    return 1;
  }

  console.log(`\nRun complete (${dryRun ? 'dry-run' : 'applied'}).`);

  if (operationResults.length === 0) {
    console.log('- No file operations were executed.');
  }

  return 0;
}

async function validateCommand(args: string[]): Promise<number> {
  const configPath = getFlagValue(args, '--config');
  const loadResult = await loadConfigWithHelp(configPath);
  if (!loadResult.shouldContinue) {
    console.log('Nothing to validate yet.');
    return 0;
  }
  const {loaded} = loadResult;
  const validation = validateConfigShape(loaded.config);

  printValidationMessages('Config warnings:', validation.warnings);

  if (validation.errors.length > 0) {
    printValidationMessages('Config validation failed:', validation.errors);
    return 1;
  }

  console.log(`Config is valid: ${loaded.resolvedPath}`);
  return 0;
}

async function skillCommand(args: string[]): Promise<number> {
  const force = hasFlag(args, '--force');
  const result = await installWiizAuthorSkill({force});

  if (!result.created) {
    console.log(
      `Skill already exists at ${result.skillFile}. Re-run with --force to overwrite.`
    );
    return 0;
  }

  console.log(`Installed skill '${result.skillName}' at ${result.skillFile}`);
  return 0;
}

async function helpCommand(args: string[]): Promise<number> {
  const topic = args[0];

  if (!topic) {
    printGeneralHelp();
    return 0;
  }

  if (topic === 'list') {
    printPrimitiveListHelp();
    return 0;
  }

  const detail = renderPrimitiveDetailHelp(topic);
  if (detail) {
    console.log(detail);
    return 0;
  }

  console.log(`Unknown help topic '${topic}'.`);
  console.log('Run `wiiz help` for CLI usage.');
  console.log('Run `wiiz help list` to see valid primitive names.');
  return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const command = argv[0];
    const args = argv.slice(1);

    if (!command || command === '--help' || command === '-h') {
      printGeneralHelp();
      return 0;
    }

    if (command === 'help') {
      return helpCommand(args);
    }

    if (command === 'run') {
      return runCommand(args);
    }

    if (command === 'validate') {
      return validateCommand(args);
    }

    if (command === 'skill') {
      return skillCommand(args);
    }

    console.log(`Unknown command '${command}'.`);
    printGeneralHelp();
    return 0;
  } catch (error) {
    console.error(`Unexpected error: ${String(error)}`);
    return 1;
  }
}
