import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    
    
    rules: {
      // ✅ Ignore borrowed code's unnecessary disables
      'eslint-comments/no-unused-disable': 'off',
      '@next/next/no-img-element': 'off',

      // Optional: turn off these rules globally if not needed
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
