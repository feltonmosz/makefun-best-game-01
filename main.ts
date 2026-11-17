// Emberfall's entrypoint (Node 22, standard library only). It stages the
// deliverable for the make.fun grader: game/ and screenshots/ copied from
// beside this file into the output directory (MAKEFUN_OUTPUT_DIR, or /output
// in the grader), then dossier.json written from that staged copy with the
// vendored make.fun library. The dossier is the judge's view of the entry,
// so it is built from what was staged, never from the working tree.
//
// Local run:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally first with:
//   node serve.ts   # then http://localhost:8080

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Never stage the entry into the repository itself (or into game/ or
// screenshots/): copying a directory into itself would recurse until the disk
// fills. A subdirectory like out/ is fine — it is not one of the staged trees.
const outputResolved = resolve(outputDir);
const repoResolved = resolve(repoRoot);
if (
  outputResolved === repoResolved ||
  outputResolved.startsWith(join(repoResolved, 'game')) ||
  outputResolved.startsWith(join(repoResolved, 'screenshots'))
) {
  throw new Error(`refusing to stage into ${outputDir}: pick an output directory outside game/ and screenshots/`);
}

// The competition's own caps (kit gate.json). Only text_max_bytes shapes the
// dossier; the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; game/ over 993 entries or 48 MiB, or a
// game path over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** How many files and directories sit under a directory, the way the grader counts them. */
function countEntries(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

/** Copy one top-level directory (game/ or screenshots/) into the output, fresh. */
function stage(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  if (!existsSync(from)) throw new Error(`${name}/ is missing from the repository`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return countEntries(to);
}

const dossierPath = join(outputDir, 'dossier.json');
mkdirSync(outputDir, { recursive: true });
rmSync(dossierPath, { force: true });
const gameEntries = stage('game');
const shotEntries = stage('screenshots');
const dossier = buildDossier(outputDir, CAPS);
writeFileSync(dossierPath, dossier);
console.log(`staged ${gameEntries} game entries, ${shotEntries} screenshots -> ${outputDir}`);
console.log(`dossier.json: ${statSync(dossierPath).size} bytes`);
