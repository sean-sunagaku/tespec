import { Command } from '@oclif/core';
import { vi } from 'vitest';

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`Command exited with code ${code}`);
  }
}

export async function runCommand(
  CommandClass: typeof Command,
  argv: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderr.push(args.map(String).join(' '));
  });
  const catchSpy = vi
    .spyOn(Command.prototype as unknown as { catch: (error: unknown) => Promise<never> }, 'catch')
    .mockImplementation(async (error: unknown) => {
      throw error;
    });
  const exitSpy = vi
    .spyOn(Command.prototype, 'exit')
    .mockImplementation(((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as typeof Command.prototype.exit);

  try {
    await CommandClass.run(argv, { root: process.cwd() });
    return {
      code: 0,
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
    };
  } catch (error) {
    if (error instanceof ExitSignal) {
      return {
        code: error.code,
        stdout: stdout.join('\n'),
        stderr: stderr.join('\n'),
      };
    }

    throw error;
  } finally {
    exitSpy.mockRestore();
    catchSpy.mockRestore();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  }
}
