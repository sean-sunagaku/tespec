import type { ParsedProject } from '../parser.js';

export function renderHtml(project: ParsedProject): string {
  const initialData = JSON.stringify({
    project: project.config.project,
    screens: project.screens,
    setups: project.setups,
    units: project.units,
  });

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tespec viewer — ${escapeHtml(project.config.project)}</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">
<header class="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
  <h1 class="text-lg font-semibold">tespec viewer</h1>
  <span class="text-sm text-gray-400">${escapeHtml(project.config.project)}</span>
</header>
<div id="root" class="flex min-h-[calc(100vh-64px)]"></div>
<script>window.__TESPEC_DATA__ = ${initialData};</script>
<script type="module" src="/viewer-client.js"></script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
