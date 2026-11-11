// Serves original/index.html (the pre-Next.js single-file store) on http://localhost:3301 for side-by-side comparison.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../original/index.html', import.meta.url));
createServer(async (req, res) => {
  if (req.url === '/' || req.url?.startsWith('/?') || req.url?.startsWith('/#')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await readFile(file));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(3301, () => console.log('original on http://localhost:3301'));
