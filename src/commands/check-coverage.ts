import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { checkCoverage } from '../core/coverage-checker.js';
import { parseProject } from '../core/parser.js';
import { printError, printOk, printWarning } from '../utils/output.js';

export default class CheckCoverage extends Command {
  static summary = 'Check test coverage against tespec YAML specs';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    'tests-dir': Flags.string({
      char: 'd',
      description: 'Path to test files directory',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CheckCoverage);

    const configPath = path.resolve(flags.config ?? './docs/tespec/config.yaml');
    const testsDir = path.resolve(flags['tests-dir'] ?? './tests');

    const parsed = await parseProject(configPath);

    if (parsed.errors.length > 0 || !parsed.result) {
      for (const error of parsed.errors) {
        printError(error.file, error.message);
      }

      this.exit(1);
    }

    const result = await checkCoverage(parsed.result.screens, parsed.result.units, testsDir);

    for (const issue of result.issues) {
      if (issue.level === 'error') {
        printError(issue.specFile, issue.message);
      } else if (issue.level === 'warn') {
        printWarning(issue.specFile, issue.message);
      } else {
        printOk(`${issue.specFile} → ${issue.message}`);
      }
    }

    if (result.hasErrors) {
      this.exit(1);
    }
  }
}
