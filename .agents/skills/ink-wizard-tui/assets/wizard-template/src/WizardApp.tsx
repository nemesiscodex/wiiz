import React, {useMemo, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import type {WizardAnswers, WizardResult, WizardStep} from './types.js';

type WizardAppProps = {
  steps: WizardStep[];
  onFinish: (result: WizardResult) => void;
};

export function WizardApp({steps, onFinish}: WizardAppProps) {
  const {exit} = useApp();
  const [currentStepId, setCurrentStepId] = useState(steps[0]?.id ?? '');
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({});

  const stepById = useMemo(() => {
    return new Map(steps.map(step => [step.id, step]));
  }, [steps]);

  const currentStep = stepById.get(currentStepId);

  useInput((input, key) => {
    if (!currentStep) {
      onFinish({status: 'cancelled', answers});
      exit();
      return;
    }

    if (input === 'q' || key.escape) {
      onFinish({status: 'cancelled', answers});
      exit();
      return;
    }

    if (key.upArrow) {
      setCursor(previous => Math.max(0, previous - 1));
      return;
    }

    if (key.downArrow) {
      setCursor(previous => Math.min(currentStep.options.length - 1, previous + 1));
      return;
    }

    if (!key.return) {
      return;
    }

    const selected = currentStep.options[cursor];
    if (!selected) {
      return;
    }

    const nextAnswers = {...answers, [currentStep.id]: selected.action};
    setAnswers(nextAnswers);

    if (selected.done || !selected.nextStepId) {
      const status = selected.action === 'cancel' ? 'cancelled' : 'completed';
      onFinish({status, answers: nextAnswers});
      exit();
      return;
    }

    if (!stepById.has(selected.nextStepId)) {
      onFinish({status: 'cancelled', answers: nextAnswers});
      exit();
      return;
    }

    setCurrentStepId(selected.nextStepId);
    setCursor(0);
  });

  if (!currentStep) {
    return (
      <Box>
        <Text color="red">Invalid wizard step configuration.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" padding={1}>
      <Text bold>{currentStep.question}</Text>
      <Box height={1} />
      {currentStep.options.map((option, index) => {
        const selected = index === cursor;
        return (
          <Text key={option.action} color={selected ? 'cyan' : undefined}>
            {selected ? '›' : ' '} {option.label}
          </Text>
        );
      })}
      <Box height={1} />
      <Text dimColor>Up/Down: move • Enter: select • q/Esc: cancel</Text>
    </Box>
  );
}
