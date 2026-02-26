import type {WizardStep} from './types.js';

export const wizardSteps: WizardStep[] = [
  {
    id: 'project-type',
    question: 'What do you want to scaffold?',
    options: [
      {label: 'CLI app', action: 'scaffold-cli', nextStepId: 'language'},
      {label: 'Library', action: 'scaffold-library', nextStepId: 'language'},
      {label: 'Cancel', action: 'cancel', done: true}
    ]
  },
  {
    id: 'language',
    question: 'Which language should be used?',
    options: [
      {label: 'TypeScript', action: 'lang-ts', done: true},
      {label: 'JavaScript', action: 'lang-js', done: true}
    ]
  }
];
