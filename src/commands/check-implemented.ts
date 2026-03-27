import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { checkImplemented } from '../core/impl-checker.js';
import { printError, printOk, printWarning } from '../utils/output.js';

export default class CheckImplemented extends Command {
  static summary = 'Check test implementation status';

  static flags = {
    'tests-dir': Flags.string({
      char: 'd',
      description: 'Path to test files directory',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CheckImplemented);

    const testsDir = path.resolve(flags['tests-dir'] ?? './tests');

    const result = await checkImplemented(testsDir);

    for (const issue of result.issues) {
      if (issue.level === 'warn') {
        printWarning(issue.file, issue.message);
      } else {
        printOk(issue.message);
      }
    }

    if (result.hasUnimplemented) {
      this.exit(1);
    }
  }
}
