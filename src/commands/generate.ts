import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { generateTestFile } from '../core/generator.js';
import { parseProject } from '../core/parser.js';
import { validate } from '../core/validator.js';
import { printError, printSuccess, printWarning } from '../utils/output.js';

const DEFAULT_OUTPUT_DIR = './tests';

export default class Generate extends Command {
  static summary = 'Generate Playwright skeletons from tespec YAML';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    screen: Flags.string({
      description: 'Generate only a specific screen id',
    }),
    'dry-run': Flags.boolean({
      description: 'Print generated output instead of writing files',
      default: false,
    }),
    'out-dir': Flags.string({
      char: 'o',
      description: 'Directory to write generated spec files',
      default: DEFAULT_OUTPUT_DIR,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    const configPath = resolveConfigPath(flags.config);
    const outputDir = resolveOutputDir(flags['out-dir']);
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

    if (validation.hasErrors) {
      this.exit(1);
    }

    const { screens, setups } = parsed.result;
    const selectedScreens = flags.screen
      ? screens.filter((screen) => screen.screen === flags.screen)
      : screens;

    if (flags.screen && selectedScreens.length === 0) {
      printError('screen', `screen "${flags.screen}" が見つかりません`);
      this.exit(1);
    }

    const outputs = selectedScreens.map((screen) => ({
      screenId: screen.screen,
      content: generateTestFile(screen, setups),
    }));

    if (flags['dry-run']) {
      for (const output of outputs) {
        this.log(`// ${toDisplayPath(path.join(outputDir, `${output.screenId}.spec.ts`))}`);
        this.log(output.content.trimEnd());
      }
    } else {
      await mkdir(outputDir, { recursive: true });

      await Promise.all(
        outputs.map((output) =>
          writeFile(path.join(outputDir, `${output.screenId}.spec.ts`), output.content, 'utf8'),
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
