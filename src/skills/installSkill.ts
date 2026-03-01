import fs from 'node:fs/promises';
import path from 'node:path';

export const GENERATED_SKILL_NAME = 'wiiz-yaml-author';

const SKILL_MD_CONTENT = [
  '---',
  'name: wiiz-yaml-author',
  "description: Generate .wiiz/wizard.yaml and .wiiz/values.example.json for repository onboarding with wiiz. Use when a user wants to create or update onboarding wizard config from an existing repository\'s setup requirements, environment variables, and developer workflows.",
  '---',
  '',
  '# wiiz YAML Author',
  '',
  'Build onboarding config that works with wiiz.',
  '',
  '## Workflow',
  '',
  '1. Inspect repository setup sources.',
  '- Read README, CONTRIBUTING, setup docs, .env.example, docker compose files, package scripts, and CI configs.',
  '- Extract required environment variables, selectable options, and file mutations needed for a first-time setup.',
  '',
  '2. Define prompt variables first.',
  '- Add `input` steps for free-text values.',
  '- Add `select` steps for constrained values.',
  '- For env-related prompts, set `envFile` (and optional `envKey`) to allow keep/replace from existing files.',
  '- Sensitivity defaults: prompts are sensitive by default. Set `sensitive: false` only for non-secret values where full preview is useful.',
  '- Keep identifiers stable: use uppercase variable names and kebab-case step ids.',
  '- Prefer required inputs unless a default is trustworthy.',
  '',
  '3. Define operation steps after prompts.',
  '- Use `env.write` for `.env` generation.',
  '- Use `command.check` to verify required tooling before file operations.',
  '- Use `command.run` for optional setup commands that need user consent.',
  '- Use `confirm` checkpoints before risky operations when explicit user acknowledgement is needed.',
  '- For `confirm`, optional `var` stores decision as `yes`/`no` for later `when` or interpolation.',
  '- `confirm` defaults: in non-interactive mode, omitted `default` behaves as `no`; declined confirmation aborts unless `abortOnDecline: false`.',
  '- Use `display`/`note` for short inline guidance.',
  '- Use `ascii`/`banner` for section headers in terminal output. Prefer `path` when reusing large ASCII art.',
  '- Use `file.write` for full-file templates.',
  '- Use `file.append` for additive setup notes.',
  '- Optional `when` condition gates step execution based on prior prompt variables.',
  '- `when` supports: `var` (required) plus `equals`, `notEquals`, `oneOf`, and/or `exists`.',
  '- Reference prior values with `{{VAR_NAME}}`.',
  '- Escape literal braces with `\\{{`.',
  '',
  '4. Enforce safe defaults.',
  '- Omit overwrite flags unless replacement is explicitly intended.',
  '- Keep flow sequential (no branching).',
  '- Place file operations after all referenced variables are collected.',
  '',
  '5. Produce deterministic outputs.',
  '- Write `.wiiz/wizard.yaml`.',
  '- Optionally write `.wiiz/values.example.json` with realistic placeholders.',
  '- Keep content concise and editable by humans.',
  '',
  '## Output Contract',
  '',
  'When generating onboarding artifacts, produce these files:',
  '',
  '1. `.wiiz/wizard.yaml`',
  '- Must use `version: 1`.',
  '- Must include `name` and non-empty ordered `steps`.',
  '- Must only use supported step types: `input`, `select`, `confirm`, `match`, `display`, `note`, `ascii`, `banner`, `file.write`, `file.append`, `env.write`, `command.run`, `command.check`.',
  '',
  '2. `.wiiz/values.example.json`',
  '- Map each prompt `var` to a representative sample value.',
  '- Ensure select values match declared option `value` exactly.',
  '',
  '## Quality Checks',
  '',
  'Before finishing:',
  '',
  '1. Verify every `{{VAR}}` token is defined by a prior prompt step.',
  '2. Verify all select options have unique `value` fields.',
  '3. Verify every `when.var` references a value collected by a prior input/select/confirm(with var) step.',
  '4. Verify regex patterns are valid when present.',
  '5. Verify non-interactive execution can run with values JSON.',
  '',
  'If wiiz is available, run:',
  '',
  '- `onboard validate --config .wiiz/wizard.yaml`',
  '- `onboard llm --config .wiiz/wizard.yaml`',
  '',
  'If unavailable, still generate both files and explain unverified checks.',
  ''
].join('\n');

export type InstallSkillOptions = {
  rootDir?: string;
  force?: boolean;
};

export type InstallSkillResult = {
  skillName: string;
  skillDir: string;
  skillFile: string;
  created: boolean;
};

export async function installWiizAuthorSkill(
  options: InstallSkillOptions = {}
): Promise<InstallSkillResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const skillDir = path.join(rootDir, '.agents', 'skills', GENERATED_SKILL_NAME);
  const skillFile = path.join(skillDir, 'SKILL.md');

  await fs.mkdir(skillDir, {recursive: true});

  let exists = false;
  try {
    await fs.access(skillFile);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !options.force) {
    return {
      skillName: GENERATED_SKILL_NAME,
      skillDir,
      skillFile,
      created: false
    };
  }

  await fs.writeFile(skillFile, SKILL_MD_CONTENT, 'utf8');

  return {
    skillName: GENERATED_SKILL_NAME,
    skillDir,
    skillFile,
    created: true
  };
}
