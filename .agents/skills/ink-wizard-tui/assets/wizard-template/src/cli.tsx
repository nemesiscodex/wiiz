#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import {WizardApp} from './WizardApp.js';
import {wizardSteps} from './wizard.js';
import type {WizardResult} from './types.js';

let result: WizardResult | undefined;

const {waitUntilExit} = render(
  <WizardApp
    steps={wizardSteps}
    onFinish={nextResult => {
      result = nextResult;
    }}
  />
);

await waitUntilExit();

if (!result) {
  process.exit(1);
}

if (result.status === 'cancelled') {
  console.log('\nWizard cancelled.');
  process.exit(0);
}

console.log('\nWizard complete. Answers:');
for (const [stepId, action] of Object.entries(result.answers)) {
  console.log(`- ${stepId}: ${action}`);
}
