import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, '_site');

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  await copyDir(path.join(ROOT_DIR, 'public'), OUT_DIR);
  await copyDir(path.join(ROOT_DIR, 'src'), path.join(OUT_DIR, 'src'));
  await copyDir(path.join(ROOT_DIR, 'data'), path.join(OUT_DIR, 'data'));
  await fs.writeFile(path.join(OUT_DIR, '.nojekyll'), '', 'utf8');

  console.log('✓ Built static site into _site/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
