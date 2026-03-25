import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { parseProject } from '../core/parser.js';
import { validate } from '../core/validator.js';
import { printError, printOk, printWarning } from '../utils/output.js';

export default class Validate extends Command {
  static summary = 'Validate tespec YAML references';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);
    const configPath = resolveConfigPath(flags.config);
    const parsed = await parseProject(configPath);

    if (parsed.errors.length > 0 || !parsed.result) {
      for (const error of parsed.errors) {
        printError(error.file, error.message);
      }

      this.exit(1);
    }

    const validation = validate(parsed.result.screens, parsed.result.setups);

    for (const issue of validation.issues) {
      const message = `${issue.field}: ${issue.message}`;

      if (issue.level === 'error') {
        printError(issue.file, message);
      } else {
        printWarning(issue.file, message);
      }
    }

    const errorFiles = new Set(
      validation.issues.filter((issue) => issue.level === 'error').map((issue) => issue.file),
    );

    for (const screen of parsed.result.screens) {
      const screenFile = toScreenFile(screen.screen);

      if (!errorFiles.has(screenFile)) {
        printOk(screenFile);
      }
    }

    if (validation.hasErrors) {
      this.exit(1);
    }
  }
}

function resolveConfigPath(configPath?: string): string {
  return path.resolve(configPath ?? './docs/tespec/config.yaml');
}

function toScreenFile(screenId: string): string {
  return `screens/${screenId}.yaml`;
}
