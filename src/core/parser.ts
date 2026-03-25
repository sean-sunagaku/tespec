import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import type { ZodIssue, ZodType } from 'zod';

import {
  type Config,
  ConfigSchema,
  type Screen,
  ScreenSchema,
  type Setup,
  SetupSchema,
} from './schema.js';

export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
}

export interface ParseError {
  file: string;
  message: string;
}

interface ParsedFileResult<T> {
  data?: T;
  errors: ParseError[];
}

interface ParsedDirectoryResult<T> {
  items: T[];
  errors: ParseError[];
}

export async function parseProject(
  configPath: string,
): Promise<{ result?: ParsedProject; errors: ParseError[] }> {
  const resolvedConfigPath = path.resolve(configPath);
  const configResult = await parseYamlFile(resolvedConfigPath, ConfigSchema);

  if (!configResult.data) {
    return { errors: configResult.errors };
  }

  const configDir = path.dirname(resolvedConfigPath);
  const screensDir = path.resolve(configDir, configResult.data.screens_dir);
  const setupsDir = path.resolve(configDir, configResult.data.setups_dir);

  const [screensResult, setupsResult] = await Promise.all([
    parseYamlDirectory(screensDir, ScreenSchema),
    parseYamlDirectory(setupsDir, SetupSchema),
  ]);

  const errors = [...screensResult.errors, ...setupsResult.errors];
  if (errors.length > 0) {
    return { errors };
  }

  return {
    result: {
      config: configResult.data,
      screens: screensResult.items,
      setups: setupsResult.items,
    },
    errors: [],
  };
}

async function parseYamlDirectory<T>(
  directoryPath: string,
  schema: ZodType<T>,
): Promise<ParsedDirectoryResult<T>> {
  let entries: string[];

  try {
    const dirents = await readdir(directoryPath, { withFileTypes: true });
    entries = dirents
      .filter((dirent) => dirent.isFile() && isYamlFile(dirent.name))
      .map((dirent) => dirent.name)
      .sort();
  } catch (error) {
    return {
      items: [],
      errors: [
        {
          file: directoryPath,
          message:
            error instanceof Error
              ? `ディレクトリが見つかりません: ${error.message}`
              : 'ディレクトリが見つかりません',
        },
      ],
    };
  }

  const items: T[] = [];
  const errors: ParseError[] = [];

  for (const entry of entries) {
    const filePath = path.join(directoryPath, entry);
    const parsed = await parseYamlFile(filePath, schema);
    if (parsed.data) {
      items.push(parsed.data);
    } else {
      errors.push(...parsed.errors);
    }
  }

  return { items, errors };
}

async function parseYamlFile<T>(
  filePath: string,
  schema: ZodType<T>,
): Promise<ParsedFileResult<T>> {
  let source: string;

  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    return {
      errors: [
        {
          file: filePath,
          message:
            error instanceof Error
              ? `ファイルが見つかりません: ${error.message}`
              : 'ファイルが見つかりません',
        },
      ],
    };
  }

  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return {
      errors: document.errors.map((error) => ({
        file: filePath,
        message: formatYamlError(error.message, error.linePos?.[0]?.line, error.linePos?.[0]?.col),
      })),
    };
  }

  const parsed = schema.safeParse(document.toJSON());
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => ({
        file: filePath,
        message: formatZodError(issue),
      })),
    };
  }

  return {
    data: parsed.data,
    errors: [],
  };
}

function formatYamlError(message: string, line?: number, column?: number): string {
  const summary = message
    .split('\n')[0]
    .replace(/ at line \d+, column \d+:?$/, '')
    .trim();

  if (line && column) {
    return `line ${line}, column ${column}: ${summary}`;
  }

  return summary;
}

function formatZodError(issue: ZodIssue): string {
  const field = issue.path.length > 0 ? issue.path.join('.') : '<root>';
  return `${field}: ${issue.message}`;
}

function isYamlFile(fileName: string): boolean {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}
