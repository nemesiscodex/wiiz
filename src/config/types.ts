export const DEFAULT_CONFIG_PATH = '.onboard/wizard.yaml';

export type StepWhen = {
  var: string;
  equals?: string;
  notEquals?: string;
  oneOf?: string[];
  exists?: boolean;
};

export type StepBase = {
  id: string;
  when?: StepWhen;
};

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
} & StepBase;

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
} & StepBase;

export type FileWriteStep = {
  id: string;
  type: 'file.write';
  path: string;
  content: string;
  overwrite?: boolean;
} & StepBase;

export type FileAppendStep = {
  id: string;
  type: 'file.append';
  path: string;
  content: string;
  createIfMissing?: boolean;
} & StepBase;

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
} & StepBase;

export type CommandRunStep = {
  id: string;
  type: 'command.run';
  command: string;
  consentMessage?: string;
  cwd?: string;
} & StepBase;

export type CommandCheckStep = {
  id: string;
  type: 'command.check';
  command: string;
  installHint?: string;
} & StepBase;

export type DisplayStep = {
  id: string;
  type: 'display' | 'note';
  message: string;
} & StepBase;

export type BannerStep = {
  id: string;
  type: 'ascii' | 'banner';
  content?: string;
  path?: string;
} & StepBase;

export type ConfirmStep = {
  id: string;
  type: 'confirm';
  message: string;
  var?: string;
  default?: 'yes' | 'no';
  abortOnDecline?: boolean;
} & StepBase;

export type WizardStep =
  | InputStep
  | SelectStep
  | FileWriteStep
  | FileAppendStep
  | EnvWriteStep
  | CommandRunStep
  | CommandCheckStep
  | DisplayStep
  | BannerStep
  | ConfirmStep;

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
  | CommandCheckStep
  | DisplayStep
  | BannerStep;

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
