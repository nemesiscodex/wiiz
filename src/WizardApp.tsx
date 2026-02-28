import React, {useMemo, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import type {PromptStep} from './config/types.js';

export type PromptResult =
  | {status: 'completed'; value: string}
  | {status: 'cancelled'};

type WizardAppProps = {
  step: PromptStep;
  onFinish: (result: PromptResult) => void;
};

type MessageDetail =
  | {kind: 'text'; value: string}
  | {kind: 'command'; label: string; value: string};

function resolveInputValue(rawValue: string, defaultValue?: string): string {
  if (rawValue.length > 0) {
    return rawValue;
  }

  return defaultValue ?? '';
}

export function formatPromptInputValue(
  step: Extract<PromptStep, {type: 'input'}>,
  inputValue: string
): string {
  if (step.sensitive === false) {
    return inputValue;
  }

  return '•'.repeat(inputValue.length);
}

function getDisplayStepId(stepId: string): string {
  const baseId = stepId.split('__')[0] ?? stepId;
  return `[${baseId}]`;
}

function parseDetailLine(line: string): MessageDetail {
  const commandPrefix = 'Command:';
  if (!line.startsWith(commandPrefix)) {
    return {kind: 'text', value: line};
  }

  const commandValue = line.slice(commandPrefix.length).trim();
  return {kind: 'command', label: commandPrefix, value: commandValue};
}

export function WizardApp({step, onFinish}: WizardAppProps) {
  const {exit} = useApp();
  const [cursor, setCursor] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messageLines = useMemo(
    () =>
      step.message
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    [step.message]
  );
  const headline = messageLines[0] ?? step.message;
  const details = useMemo(() => messageLines.slice(1).map(parseDetailLine), [messageLines]);

  const inputRegex = useMemo(() => {
    if (step.type !== 'input' || !step.validateRegex) {
      return undefined;
    }

    return new RegExp(step.validateRegex);
  }, [step]);
  const renderedInputValue =
    step.type === 'input' ? formatPromptInputValue(step, inputValue) : inputValue;

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onFinish({status: 'cancelled'});
      exit();
      return;
    }

    if (step.type === 'select') {
      if (key.upArrow) {
        setCursor(previous => Math.max(0, previous - 1));
        return;
      }

      if (key.downArrow) {
        setCursor(previous => Math.min(step.options.length - 1, previous + 1));
        return;
      }

      if (!key.return) {
        return;
      }

      const selected = step.options[cursor];
      if (!selected) {
        return;
      }

      onFinish({status: 'completed', value: selected.value});
      exit();
      return;
    }

    if (key.return) {
      const resolvedValue = resolveInputValue(inputValue, step.default);
      const required = step.required ?? true;

      if (required && resolvedValue.length === 0) {
        setErrorMessage(`A value is required for '${step.var}'.`);
        return;
      }

      if (inputRegex && resolvedValue.length > 0 && !inputRegex.test(resolvedValue)) {
        setErrorMessage(`Value must match regex: ${step.validateRegex}`);
        return;
      }

      onFinish({status: 'completed', value: resolvedValue});
      exit();
      return;
    }

    if (key.backspace || key.delete) {
      setInputValue(previous => previous.slice(0, -1));
      setErrorMessage(null);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setInputValue(previous => `${previous}${input}`);
      setErrorMessage(null);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text color="cyan">{getDisplayStepId(step.id)}</Text>
      <Text bold>{headline}</Text>
      {details.map((detail, index) =>
        detail.kind === 'command' ? (
          <Box key={`${step.id}:detail:${index}`}>
            <Text dimColor>{detail.label} </Text>
            <Text backgroundColor="black" color="white" bold>
              {' '}
              {detail.value}
              {' '}
            </Text>
          </Box>
        ) : (
          <Text key={`${step.id}:detail:${index}`} dimColor>
            {detail.value}
          </Text>
        )
      )}

      {step.type === 'select' ? (
        <Box marginTop={1} flexDirection="column">
          {step.options.map((option, index) => {
            const selected = index === cursor;
            return (
              <Text key={`${step.id}:${option.value}`} color={selected ? 'cyan' : 'gray'} bold={selected}>
                {selected ? '›' : ' '} {option.label}
              </Text>
            );
          })}
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">
            {'>'} {renderedInputValue}
            {inputValue.length === 0 && step.default ? <Text dimColor>[default: {step.default}]</Text> : null}
          </Text>
          <Text dimColor>Variable: {step.var}</Text>
          <Text dimColor>Required: {step.required ?? true ? 'yes' : 'no'}</Text>
          {step.validateRegex ? <Text dimColor>Regex: {step.validateRegex}</Text> : null}
        </Box>
      )}

      <Box height={1} />
      {errorMessage ? <Text color="red">! {errorMessage}</Text> : null}
      <Text dimColor>
        {step.type === 'select'
          ? '↑/↓: move • Enter: confirm • q/Esc: cancel'
          : 'Type: edit • Enter: confirm • q/Esc: cancel'}
      </Text>
    </Box>
  );
}
