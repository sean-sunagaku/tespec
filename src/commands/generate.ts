import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import {
  getScreenGenerator,
  getUnitGenerator,
  getWorkflowGenerator,
  isScreenTarget,
  isUnitTarget,
  isWorkflowTarget,
  SCREEN_TARGETS,
  UNIT_TARGETS,
  WORKFLOW_TARGETS,
} from '../core/generators/registry.js';
import { parseProject } from '../core/parser.js';
import { validateUnits } from '../core/unit-validator.js';
import { validate } from '../core/validator.js';
import { validateWorkflows } from '../core/workflow-validator.js';
import { printError, printSuccess, printWarning } from '../utils/output.js';

const DEFAULT_OUTPUT_DIR = './tests';

export default class Generate extends Command {
  static summary = 'Generate test skeletons from tespec YAML';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    screen: Flags.string({
      description: 'Generate only a specific screen id',
    }),
    unit: Flags.string({
      description: 'Generate only a specific unit id',
    }),
    workflow: Flags.string({ description: 'Generate only a specific workflow id' }),
    'dry-run': Flags.boolean({
      description: 'Print generated output instead of writing files',
      default: false,
    }),
    'out-dir': Flags.string({
      char: 'o',
      description: 'Directory to write generated spec files',
      default: DEFAULT_OUTPUT_DIR,
    }),
    target: Flags.string({
      char: 't',
      description: 'Target test framework for screen specs',
      options: [...SCREEN_TARGETS],
      default: 'playwright',
    }),
    'unit-target': Flags.string({
      description: 'Target test framework for unit specs',
      options: [...UNIT_TARGETS],
      default: 'vitest',
    }),
    'workflow-target': Flags.string({
      description: 'Target test framework for workflow specs',
      options: [...WORKFLOW_TARGETS],
      default: 'playwright',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    const configPath = resolveConfigPath(flags.config);
    const outputDir = resolveOutputDir(flags['out-dir']);

    if (!isScreenTarget(flags.target)) {
      printError('target', `Unknown target: ${flags.target}`);
      this.exit(1);
    }
    if (!isUnitTarget(flags['unit-target'])) {
      printError('unit-target', `Unknown unit target: ${flags['unit-target']}`);
      this.exit(1);
    }
    if (!isWorkflowTarget(flags['workflow-target'])) {
      printError('workflow-target', `Unknown workflow target: ${flags['workflow-target']}`);
      this.exit(1);
    }

    const screenGenerator = getScreenGenerator(flags.target);
    const unitGenerator = getUnitGenerator(flags['unit-target']);
    const workflowGenerator = getWorkflowGenerator(flags['workflow-target']);

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

    if (screenValidation.hasErrors || unitValidation.hasErrors || workflowValidation.hasErrors) {
      this.exit(1);
    }

    const { screens, setups, units, workflows } = parsed.result;
    const hasScreenFlag = typeof flags.screen !== 'undefined';
    const hasUnitFlag = typeof flags.unit !== 'undefined';
    const hasWorkflowFlag = typeof flags.workflow !== 'undefined';
    const anySpecified = hasScreenFlag || hasUnitFlag || hasWorkflowFlag;

    const shouldGenerateScreens = !anySpecified || hasScreenFlag;
    const shouldGenerateUnits = !anySpecified || hasUnitFlag;
    const shouldGenerateWorkflows = !anySpecified || hasWorkflowFlag;

    const selectedScreens = shouldGenerateScreens
      ? flags.screen
        ? screens.filter((screen) => screen.screen === flags.screen)
        : screens
      : [];
    const selectedUnits = shouldGenerateUnits
      ? flags.unit
        ? units.filter((unit) => unit.unit === flags.unit)
        : units
      : [];
    const selectedWorkflows = shouldGenerateWorkflows
      ? flags.workflow
        ? workflows.filter((workflow) => workflow.workflow === flags.workflow)
        : workflows
      : [];

    if (flags.screen && selectedScreens.length === 0) {
      printError('screen', `screen "${flags.screen}" が見つかりません`);
      this.exit(1);
    }
    if (flags.unit && selectedUnits.length === 0) {
      printError('unit', `unit "${flags.unit}" が見つかりません`);
      this.exit(1);
    }
    if (flags.workflow && selectedWorkflows.length === 0) {
      printError('workflow', `workflow "${flags.workflow}" が見つかりません`);
      this.exit(1);
    }

    const outputs = [
      ...selectedScreens.map((screen) => ({
        id: screen.screen,
        fileName: screenGenerator.fileNameFor(screen.screen),
        content: screenGenerator.generate(screen, setups),
      })),
      ...selectedUnits.map((unit) => ({
        id: unit.unit,
        fileName: unitGenerator.fileNameFor(unit.unit),
        content: unitGenerator.generate(unit),
      })),
      ...selectedWorkflows.map((workflow) => ({
        id: workflow.workflow,
        fileName: workflowGenerator.fileNameFor(workflow.workflow),
        content: workflowGenerator.generate(workflow),
      })),
    ];

    if (flags['dry-run']) {
      for (const output of outputs) {
        this.log(`// ${toDisplayPath(path.join(outputDir, output.fileName))}`);
        this.log(output.content.trimEnd());
      }
    } else {
      await mkdir(outputDir, { recursive: true });

      await Promise.all(
        outputs.map((output) =>
          writeFile(path.join(outputDir, output.fileName), output.content, 'utf8'),
        ),
      );
    }

    printSuccess(`${outputs.length} files generated`);
  }
}

function resolveConfigPath(configPath?: string): string {
  return path.resolve(configPath ?? './docs/tespec/config.yaml');
}

function resolveOutputDir(outputDir?: string): string {
  return path.resolve(outputDir ?? DEFAULT_OUTPUT_DIR);
}

function toDisplayPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return relativePath === '' ? '.' : relativePath;
}
