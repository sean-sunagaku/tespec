import path from 'node:path';

import { Command, Flags } from '@oclif/core';

import { parseProject } from '../core/parser.js';
import { startServer } from '../core/viewer/server.js';
import { watchProject } from '../core/viewer/watcher.js';
import { printError, printWarning } from '../utils/output.js';

export default class View extends Command {
  static summary = 'Serve tespec YAML specs in a local browser';

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to tespec config.yaml',
    }),
    port: Flags.integer({
      char: 'p',
      description: 'Port to listen on',
      default: 3737,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(View);
    const configPath = resolveConfigPath(flags.config);

    const parsed = await parseProject(configPath);

    if (parsed.errors.length > 0 || !parsed.result) {
      for (const error of parsed.errors) {
        printError(error.file, error.message);
      }
      this.exit(1);
    }

    const server = await startServer(parsed.result, { port: flags.port });
    this.log(`Serving at ${server.url}`);

    const configDir = path.dirname(path.resolve(configPath));
    const directories = [
      path.resolve(configDir, parsed.result.config.screens_dir),
      path.resolve(configDir, parsed.result.config.setups_dir),
      ...(parsed.result.config.units_dir
        ? [path.resolve(configDir, parsed.result.config.units_dir)]
        : []),
    ];

    const watcher = watchProject({ directories }, async () => {
      const result = await parseProject(configPath);
      if (result.result) {
        server.updateData(result.result);
        this.log('Updated');
      } else {
        for (const error of result.errors) {
          printWarning(error.file, error.message);
        }
      }
    });

    const cleanup = async () => {
      await watcher.stop();
      await server.stop();
      process.exit(0);
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }
}

function resolveConfigPath(configPath?: string): string {
  return path.resolve(configPath ?? './docs/tespec/config.yaml');
}
