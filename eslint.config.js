import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";

import fs from "fs";
import path from "path";

// 读取 AutoImport 生成的 globals
let autoImportGlobals = {};
const autoImportPath = path.resolve("./.eslintrc-auto-import.json");

if (fs.existsSync(autoImportPath)) {
  try {
    const content = fs.readFileSync(autoImportPath, "utf8");
    autoImportGlobals = JSON.parse(content).globals ?? {};
  } catch (err) {
    console.warn("读取 .eslintrc-auto-import.json 出错:", err);
  }
}

export default defineConfig([
  {
    ignores: [
      "node_modules",
      "dist",
      "public",
      "src-tauri/",
      "*.config.js",
      "setup-deepseek.js",
      "eslint.config.js",
      ".stylelintrc.cjs",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...autoImportGlobals,
      },
    },
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,vue}"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
]);
