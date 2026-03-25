import pc from 'picocolors';

export function printError(file: string, message: string): void {
  console.error(pc.red('ERROR:'), `${file}:`, message);
}

export function printWarning(file: string, message: string): void {
  console.error(pc.yellow('WARN: '), `${file}:`, message);
}

export function printOk(file: string): void {
  console.log(pc.green('OK:   '), file);
}

export function printSuccess(message: string): void {
  console.log(pc.bold(pc.green(message)));
}
