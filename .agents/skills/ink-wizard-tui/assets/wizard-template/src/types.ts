export type WizardOption = {
  label: string;
  action: string;
  nextStepId?: string;
  done?: boolean;
};

export type WizardStep = {
  id: string;
  question: string;
  options: WizardOption[];
};

export type WizardAnswers = Record<string, string>;

export type WizardStatus = 'completed' | 'cancelled';

export type WizardResult = {
  status: WizardStatus;
  answers: WizardAnswers;
};
