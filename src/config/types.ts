export const DEFAULT_CONFIG_PATH = '.onboard/wizard.yaml';

export type InputStep = {
  id: string;
  type: 'input';
  message: string;
  var: string;
  envFile?: string;
  envKey?: string;
  sensitive?: boolean;
  required?: boolean;
  default?: string;
  validateRegex?: string;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type SelectStep = {
  id: string;
  type: 'select';
  message: string;
  var: string;
  envFile?: string;
  envKey?: string;
  sensitive?: boolean;
  options: SelectOption[];
};

export type FileWriteStep = {
  id: string;
  type: 'file.write';
  path: string;
  content: string;
  overwrite?: boolean;
};

export type FileAppendStep = {
  id: string;
  type: 'file.append';
  path: string;
  content: string;
  createIfMissing?: boolean;
};

export type EnvWriteEntry = {
  key: string;
  value: string;
};

export type EnvWriteStep = {
  id: string;
  type: 'env.write';
  path: string;
  entries: EnvWriteEntry[];
  overwrite?: boolean;
};

export type CommandRunStep = {
  id: string;
  type: 'command.run';
  command: string;
  consentMessage?: string;
  cwd?: string;
};

export type CommandCheckStep = {
  id: string;
  type: 'command.check';
  command: string;
  installHint?: string;
};

export type WizardStep =
  | InputStep
  | SelectStep
  | FileWriteStep
  | FileAppendStep
  | EnvWriteStep
  | CommandRunStep
  | CommandCheckStep;

export type WizardConfig = {
  version: 1;
  name: string;
  steps: WizardStep[];
};

export type PromptStep = InputStep | SelectStep;
export type NonPromptStep =
  | FileWriteStep
  | FileAppendStep
  | EnvWriteStep
  | CommandRunStep
  | CommandCheckStep;

export type InputDefinition = {
  var: string;
  sourceStepId: string;
  inputType: 'input' | 'select';
  message: string;
  envFile?: string;
  envKey?: string;
  sensitive: boolean;
  required: boolean;
  default?: string;
  validateRegex?: string;
  options?: SelectOption[];
};

export type ConfigValidationResult = {
  errors: string[];
  warnings: string[];
};
