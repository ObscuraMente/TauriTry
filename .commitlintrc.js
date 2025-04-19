import { defineConfig } from "cz-git";
export default defineConfig({
  // 继承的规则
  extends: ["@commitlint/config-conventional"],
  // @see: https://commitlint.js.org/#/reference-rules
  rules: {
    "subject-case": [0], // subject大小写不做校验

    // 类型枚举，git提交type必须是以下类型
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新增功能
        "fix", // 修复缺陷
        "docs", // 文档变更
        "style", // 代码格式（不影响功能，例如空格、分号等格式修正）
        "refactor", // 代码重构（不包括 bug 修复、功能新增）
        "perf", // 性能优化
        "test", // 添加疏漏测试或已有测试改动
        "build", // 构建流程、外部依赖变更（如升级 npm 包、修改 webpack 配置等）
        "ci", // 修改 CI 配置、脚本
        "revert", // 回滚 commit
        "chore", // 对构建过程或辅助工具和库的更改（不影响源文件、测试用例）
        "i18n", // 国际化相关的更改
        "wip", // 进行中的工作
      ],
    ],
  },
  prompt: {
    messages: {
      type: "选择你要提交的类型 :",
      scope: "选择一个提交范围（可选）:",
      customScope: "请输入自定义的提交范围 :",
      subject: "填写简短精炼的变更描述 :\n",
      body: '填写更加详细的变更描述（可选）。使用 "|" 换行 :\n',
      breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行 :\n',
      footerPrefixesSelect: "选择关联issue前缀（可选）:",
      customFooterPrefix: "输入自定义issue前缀 :",
      footer: "列举关联issue (可选) 例如: #31, #I3244 :\n",
      generatingByAI: "正在通过 AI 生成你的提交简短描述...",
      generatedSelectByAI: "选择一个 AI 生成的简短描述:",
      confirmCommit: "是否提交或修改commit ?",
    },
    // prettier-ignore
    types: [
        { value: "feat",     name: "特性:     ✨  新增功能", emoji: ":sparkles:" },
        { value: "fix",      name: "修复:     🐛  修复缺陷", emoji: ":bug:" },
        { value: "docs",     name: "文档:     📝  文档变更", emoji: ":memo:" },
        { value: "style",    name: "格式:     💄  代码格式（不影响功能，例如空格、分号等格式修正）", emoji: ":lipstick:" },
        { value: "refactor", name: "重构:     ♻️  代码重构（不包括 bug 修复、功能新增）", emoji: ":recycle:" },
        { value: "perf",     name: "性能:     ⚡️  性能优化", emoji: ":zap:" },
        { value: "test",     name: "测试:     ✅  添加疏漏测试或已有测试改动", emoji: ":white_check_mark:"},
        { value: "build",    name: "构建:     📦️  构建流程、外部依赖变更（如升级 npm 包、修改 vite 配置等）", emoji: ":package:"},
        { value: "ci",       name: "集成:     🎡  修改 CI 配置、脚本",  emoji: ":ferris_wheel:"},
        { value: "revert",   name: "回退:     ⏪️  回滚 commit",emoji: ":rewind:"},
        { value: "chore",    name: "其他:     🔨  对构建过程或辅助工具和库的更改（不影响源文件、测试用例）", emoji: ":hammer:"},
        { value: "i18n",     name: "国际化:   🌐  国际化相关的更改", emoji: ":globe_with_meridians:" },
        { value: "wip",      name: "进行中:   🚧  进行中的工作", emoji: ":construction:" },
      ],
    useEmoji: true,
    emojiAlign: "center",
    useAI: true,
    aiModel: "deepseek-chat",
    aiNumber: 1,
    aiQuestionCB: ({ maxSubjectLength, diff }) => {
      return `用完整句子为以下 Git diff 代码写一个有见解并简洁的 Git 中文提交消息，不加任何前缀，并且内容不能超过 ${maxSubjectLength} 个字符: \`\`\`diff\n${diff}\n\`\`\``;
    },
    themeColorCode: "",
    scopes: [
      { name: "components", description: "组件相关" },
      { name: "utils", description: "工具函数相关" },
      { name: "styles", description: "样式相关" },
      { name: "hooks", description: "钩子函数相关" },
      { name: "api", description: "接口相关" },
      { name: "store", description: "状态管理相关" },
      { name: "router", description: "路由相关" },
      { name: "config", description: "配置文件相关" },
      { name: "assets", description: "静态资源相关" },
    ],
    allowCustomScopes: true,
    allowEmptyScopes: true,
    customScopesAlign: "bottom",
    customScopesAlias: "custom",
    emptyScopesAlias: "empty",
    upperCaseSubject: false,
    markBreakingChangeMode: true,
    allowBreakingChanges: ["feat", "fix"],
    breaklineNumber: 100,
    breaklineChar: "|",
    skipQuestions: [],
    issuePrefixes: [
      { value: "closed", name: "closed:   ISSUES has been processed" },
      { value: "fix", name: "fix:      修复了相关问题" },
      { value: "ref", name: "ref:      引用相关问题" },
      { value: "relates", name: "relates:  与问题相关" },
    ],
    customIssuePrefixAlign: "top",
    emptyIssuePrefixAlias: "skip",
    customIssuePrefixAlias: "custom",
    allowCustomIssuePrefix: true,
    allowEmptyIssuePrefix: true,
    confirmColorize: true,
    maxHeaderLength: 100,
    maxSubjectLength: 100,
    minSubjectLength: 3,
    scopeOverrides: {
      fix: [
        { name: "bug", description: "错误修复" },
        { name: "security", description: "安全问题" },
        { name: "performance", description: "性能问题" },
      ],
      feat: [
        { name: "ui", description: "用户界面" },
        { name: "api", description: "接口功能" },
        { name: "auth", description: "认证功能" },
      ],
    },
    defaultBody: "本次提交解决的问题：\n\n实现方式：",
    defaultIssues: "",
    defaultScope: "",
    defaultSubject: "",
  },
});
