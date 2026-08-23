import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Globales du navigateur qui traversent le typecheck sans un mot.
 *
 * `status`, `name`, `length`, `origin`, `top`… sont déclarées sur `Window` dans
 * `lib.dom.d.ts`. Une référence à `status` dans un composant serveur résout donc
 * vers `Window.status`, de type `string` : TypeScript est satisfait, et le code
 * lève un `ReferenceError` au rendu, en production.
 *
 * C'est exactement ce qui est arrivé aux écrans Apprenants et Formations : lors
 * de l'extraction de la barre de filtres dans un sous-composant, une référence
 * est restée en `status` au lieu de `params.status`. Les deux écrans ont été
 * livrés cassés avec typecheck, lint et tests unitaires au vert.
 *
 * Cette règle transforme ce piège silencieux en erreur de lint.
 */
const AMBIGUOUS_BROWSER_GLOBALS = [
  { name: "status", message: "Ambigu : `status` désigne `Window.status`. Utilisez une variable locale explicite (ex. `params.status`)." },
  { name: "name", message: "Ambigu : `name` désigne `Window.name`. Nommez la variable explicitement." },
  { name: "length", message: "Ambigu : `length` désigne `Window.length`. Nommez la variable explicitement." },
  { name: "origin", message: "Ambigu : `origin` désigne `Window.origin`. Utilisez `new URL(...).origin` ou une variable locale." },
  { name: "top", message: "Ambigu : `top` désigne `Window.top`. Nommez la variable explicitement." },
  { name: "self", message: "Ambigu : `self` désigne `Window.self`. Nommez la variable explicitement." },
  { name: "closed", message: "Ambigu : `closed` désigne `Window.closed`. Nommez la variable explicitement." },
  { name: "parent", message: "Ambigu : `parent` désigne `Window.parent`. Nommez la variable explicitement." },
  { name: "event", message: "Ambigu : `event` désigne l'ancienne globale `Window.event`. Utilisez le paramètre du gestionnaire." },
  { name: "history", message: "Ambigu : `history` désigne `Window.history`. Nommez la variable explicitement." },
  { name: "screen", message: "Ambigu : `screen` désigne `Window.screen`. Nommez la variable explicitement." },
  { name: "external", message: "Ambigu : `external` désigne `Window.external`. Nommez la variable explicitement." },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", ...AMBIGUOUS_BROWSER_GLOBALS],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Client Prisma généré : ni relu, ni corrigé à la main.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
