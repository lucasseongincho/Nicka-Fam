import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // design/** and public/bubble-bobble/support.js are generated
    // asset-preview tooling artifacts, not app source -- same reasoning
    // as the existing design/** exclusion.
    ignores: ["design/**", "public/bubble-bobble/support.js"],
  },
];

export default eslintConfig;
