import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// Certaines variables sont consommées pendant `next build` et figées dans
// l'image : les poser dans docker-compose ou dans le `.env` du serveur reste
// sans effet. Le Dockerfile le documente déjà pour les NEXT_PUBLIC_* — le
// projet s'était fait piéger une fois, avec un Turnstile silencieusement
// désactivé en production.
//
// CSP_MODE relevait du même cas sans être câblé : `.env.production.example` le
// déclarait et `validate-production-env.sh` le contrôlait comme une variable
// d'exécution, alors qu'aucune valeur ne parvenait au build. Ce test garde le
// câblage en place.

const root = process.cwd();

test("CSP_MODE parvient au build de l'image", async () => {
  const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /^ARG CSP_MODE=/m, "Dockerfile : ARG CSP_MODE manquant");
  assert.match(dockerfile, /^ENV CSP_MODE=\$\{CSP_MODE\}/m, "Dockerfile : ENV CSP_MODE manquant");

  const deploy = await readFile(path.join(root, "scripts/deploy.sh"), "utf8");
  assert.match(deploy, /--build-arg CSP_MODE=/, "deploy.sh : CSP_MODE non transmis au build");
  assert.match(deploy, /\^CSP_MODE=/, "deploy.sh : CSP_MODE non lu depuis .env.deploy");
  assert.match(deploy, /enforce\|report-only/, "deploy.sh : CSP_MODE non validé");
});

test("le défaut de CSP_MODE applique la politique plutôt que de la rapporter", async () => {
  const config = await readFile(path.join(root, "next.config.ts"), "utf8");
  assert.match(
    config,
    /process\.env\.CSP_MODE \?\? "enforce"/,
    "next.config.ts : le défaut doit être `enforce`",
  );
  const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /^ARG CSP_MODE="enforce"/m, "Dockerfile : défaut non strict");
  const deploy = await readFile(path.join(root, "scripts/deploy.sh"), "utf8");
  assert.match(deploy, /:\s*"\$\{CSP_MODE:=enforce\}"/, "deploy.sh : défaut non strict");
});

test("`upgrade-insecure-requests` n'est déclarée que là où elle agit", async () => {
  // En report-only le navigateur ignore la directive ET écrit une erreur dans
  // la console à chaque page — précisément le mode où l'on lit la console.
  const config = await readFile(path.join(root, "next.config.ts"), "utf8");
  assert.match(
    config,
    /cspMode === "enforce" \? \["upgrade-insecure-requests"\] : \[\]/,
    "next.config.ts : la directive doit être conditionnée au mode enforce",
  );
});
