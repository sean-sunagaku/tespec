import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { type ParseError, parseProject, parseYamlFile } from '../core/parser.js';
import { ScreenSchema, SetupSchema, UnitSpecSchema, WorkflowSchema } from '../core/schema.js';
import { validateUnits } from '../core/unit-validator.js';
import { validate } from '../core/validator.js';
import { validateWorkflows } from '../core/workflow-validator.js';
import { printError, printOk, printWarning } from '../utils/output.js';

export default class Validate extends Command {
  static summary = 'Validate tespec YAML references';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    file: Flags.string({
      description: 'Validate a specific screen or setup YAML file (no config.yaml required)',
      helpValue: 'screens/login.yaml',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    if (flags.file && flags.config) {
      printError('flags', '--file と --config は同時に指定できません');
      this.exit(1);
    }

    if (flags.file) {
      await this.validateSingleFile(flags.file);
      return;
    }

    const configPath = resolveConfigPath(flags.config);
    const parsed = await parseProject(configPath);

    if (parsed.errors.length > 0 || !parsed.result) {
      for (const error of parsed.errors) {
        printError(error.file, error.message);
      }

      this.exit(1);
    }

    const screenValidation = validate(parsed.result.screens, parsed.result.setups);
    const unitValidation = validateUnits(parsed.result.units);
    const workflowValidation = validateWorkflows(parsed.result.workflows, parsed.result.screens);
    const issues = [
      ...screenValidation.issues,
      ...unitValidation.issues,
      ...workflowValidation.issues,
    ];

    for (const issue of issues) {
      const message = `${issue.field}: ${issue.message}`;

      if (issue.level === 'error') {
        printError(issue.file, message);
      } else {
        printWarning(issue.file, message);
      }
    }

    const errorFiles = new Set(
      issues.filter((issue) => issue.level === 'error').map((issue) => issue.file),
    );

    for (const screen of parsed.result.screens) {
      const screenFile = toScreenFile(screen.screen);

      if (!errorFiles.has(screenFile)) {
        printOk(screenFile);
      }
    }

    for (const unit of parsed.result.units) {
      const unitFile = toUnitFile(unit.unit);

      if (!errorFiles.has(unitFile)) {
        printOk(unitFile);
      }
    }

    for (const workflow of parsed.result.workflows) {
      const workflowFile = toWorkflowFile(workflow.workflow);

      if (!errorFiles.has(workflowFile)) {
        printOk(workflowFile);
      }
    }

    if (screenValidation.hasErrors || unitValidation.hasErrors || workflowValidation.hasErrors) {
      this.exit(1);
    }
  }

  private async validateSingleFile(inputPath: string): Promise<void> {
    const filePath = path.resolve(inputPath);
    const screenResult = await parseYamlFile(filePath, ScreenSchema);

    if (screenResult.data) {
      printOk(toDisplayPath(filePath));
      return;
    }

    const setupResult = await parseYamlFile(filePath, SetupSchema);
    if (setupResult.data) {
      printOk(toDisplayPath(filePath));
      return;
    }

    const unitResult = await parseYamlFile(filePath, UnitSpecSchema);
    if (unitResult.data) {
      printOk(toDisplayPath(filePath));
      return;
    }

    const workflowResult = await parseYamlFile(filePath, WorkflowSchema);
    if (workflowResult.data) {
      printOk(toDisplayPath(filePath));
      return;
    }

    for (const error of selectSingleFileErrors(
      filePath,
      screenResult.errors,
      setupResult.errors,
      unitResult.errors,
      workflowResult.errors,
    )) {
      printError(toDisplayPath(error.file), error.message);
    }

    this.exit(1);
  }
}

function resolveConfigPath(configPath?: string): string {
  return path.resolve(configPath ?? './docs/tespec/config.yaml');
}

function toScreenFile(screenId: string): string {
  return `screens/${screenId}.yaml`;
}

function toUnitFile(unitId: string): string {
  return `units/${unitId}.yaml`;
}

function toWorkflowFile(workflowId: string): string {
  return `workflows/${workflowId}.yaml`;
}

function selectSingleFileErrors(
  filePath: string,
  screenErrors: ParseError[],
  setupErrors: ParseError[],
  unitErrors: ParseError[],
  workflowErrors: ParseError[],
): ParseError[] {
  const parseErrors = [screenErrors, setupErrors, unitErrors, workflowErrors].find(
    hasReadOrYamlError,
  );
  if (parseErrors) {
    return parseErrors;
  }

  const normalizedPath = filePath.replaceAll('\\', '/');

  if (normalizedPath.includes('/workflows/')) {
    return workflowErrors;
  }

  if (normalizedPath.includes('/units/')) {
    return unitErrors;
  }

  if (normalizedPath.includes('/setups/')) {
    return setupErrors;
  }

  return screenErrors;
}

function hasReadOrYamlError(errors: ParseError[]): boolean {
  return errors.some(
    (error) =>
      error.message.startsWith('ファイルが見つかりません') || error.message.startsWith('line '),
  );
}

function toDisplayPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath === '' ? path.basename(filePath) : relativePath;
}
