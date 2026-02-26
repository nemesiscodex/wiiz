#!/usr/bin/env bun
import React from 'react';
import fs from 'node:fs/promises';
import {Box, Text, render} from 'ink';
import Spinner from 'ink-spinner';
import {WizardApp, type PromptResult} from './WizardApp.js';
import {loadConfig} from './config/loadConfig.js';
import {assertValidConfig, isPromptStep, validateConfigShape} from './config/validateConfig.js';
import type {CommandRunStep, PromptStep, SelectStep} from './config/types.js';
import {describeConfigForLlm} from './engine/describeForLlm.js';
import {executeOperationStep, type StepExecutionResult} from './engine/executeStep.js';
import {getPromptValidationError, parseValuesJson, validateProvidedValues} from './engine/context.js';
import {formatEnvPrefillPreview, loadEnvPrefillValue} from './engine/envPrefill.js';
import {installRepoOnboardAuthorSkill} from './skills/installSkill.js';

function printUsage(): void {
  console.log(
    `repo-onboard\n\nUsage:\n  onboard run [--config <path>] [--dry-run] [--values <file.json>]\n  onboard validate [--config <path>]\n  onboard llm [--config <path>]\n  onboard skill [--force]`
  );
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
  console.log('Create .onboard/wizard.yaml to continue.');
  console.log('Tip: run `onboard skill` to install a skill that can generate this file.');
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

  if (result.type === 'command.check' || result.type === 'command.run') {
    return `${color}${symbol}${reset} ${result.stepId}: ${result.contentPreview}`;
  }

  return `${color}${symbol}${reset} ${result.stepId} -> ${result.targetPath}: ${result.contentPreview}`;
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

  for (const step of loaded.config.steps) {
    if (isPromptStep(step)) {
      if (valuesPath) {
        continue;
      }

      const prefill = await loadEnvPrefillValue(step, cwd);
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
            console.log('\nWizard cancelled.');
            return 0;
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
        console.log('\nWizard cancelled.');
        return 0;
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
          console.log('\nWizard cancelled.');
          return 0;
        }
        approved = permission;
      }
    }

    try {
      const shouldSpin = !valuesPath && !(step.type === 'command.run' && approved && !dryRun);
      const execute = () => executeOperationStep(step, {context, dryRun, approved});
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
        return 0;
      }
    } catch (error) {
      console.error(`Failed at step '${step.id}': ${String(error)}`);
      return 1;
    }
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

async function llmCommand(args: string[]): Promise<number> {
  const configPath = getFlagValue(args, '--config');
  const loadResult = await loadConfigWithHelp(configPath);
  if (!loadResult.shouldContinue) {
    console.log('LLM spec unavailable until .onboard/wizard.yaml exists.');
    return 0;
  }
  const {loaded} = loadResult;
  const validation = validateConfigShape(loaded.config);

  if (validation.errors.length > 0) {
    printValidationMessages('Config validation failed:', validation.errors);
    return 1;
  }

  assertValidConfig(loaded.config);

  const description = describeConfigForLlm(loaded.config, loaded.resolvedPath);
  console.log(JSON.stringify(description, null, 2));
  return 0;
}

async function skillCommand(args: string[]): Promise<number> {
  const force = hasFlag(args, '--force');
  const result = await installRepoOnboardAuthorSkill({force});

  if (!result.created) {
    console.log(
      `Skill already exists at ${result.skillFile}. Re-run with --force to overwrite.`
    );
    return 0;
  }

  console.log(`Installed skill '${result.skillName}' at ${result.skillFile}`);
  return 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const command = argv[0];
    const args = argv.slice(1);

    if (!command || command === '--help' || command === '-h') {
      printUsage();
      return 0;
    }

    if (command === 'run') {
      return runCommand(args);
    }

    if (command === 'validate') {
      return validateCommand(args);
    }

    if (command === 'llm') {
      return llmCommand(args);
    }

    if (command === 'skill') {
      return skillCommand(args);
    }

    console.log(`Unknown command '${command}'.`);
    printUsage();
    return 0;
  } catch (error) {
    console.error(`Unexpected error: ${String(error)}`);
    return 1;
  }
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
