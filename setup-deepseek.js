#!/usr/bin/env node

import { execSync } from "child_process";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("请输入您的 DeepSeek API 密钥: ", (apiKey) => {
  if (!apiKey) {
    console.error("API 密钥不能为空");
    rl.close();
    return;
  }

  try {
    execSync(
      `npx czg --api-key="${apiKey}" --api-endpoint="https://api.deepseek.com" --api-model="deepseek-chat"`,
    );
    console.log("已成功配置 DeepSeek API 密钥!");
    console.log(
      '您现在可以使用 "npm run cz" 或 "npx czg" 命令来生成 AI 辅助的提交信息。',
    );
  } catch (error) {
    console.error("配置 DeepSeek API 密钥时出错:", error.message);
  }

  rl.close();
});
