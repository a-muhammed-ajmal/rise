import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vitest coverage output
    "coverage/**",
  ]),
  {
    rules: {
      // Async data fetchers called inside useEffect are a valid React pattern
      // (setState is called asynchronously after await, not synchronously).
      "react-hooks/set-state-in-effect": "off",
      // Allow _-prefixed variables to be unused (destructured-to-strip pattern)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
