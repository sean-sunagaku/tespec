import chokidar from 'chokidar';

export interface WatcherOptions {
  directories: string[];
  debounceMs?: number;
}

export interface WatchHandle {
  stop(): Promise<void>;
}

export function watchProject(options: WatcherOptions, onUpdate: () => void): WatchHandle {
  const { directories, debounceMs = 300 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const watcher = chokidar.watch(directories, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on('all', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(onUpdate, debounceMs);
  });

  watcher.on('error', (error) => {
    console.error('[tespec] watcher error:', error.message);
  });

  return {
    async stop() {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
