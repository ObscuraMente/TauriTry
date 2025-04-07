/**
 * 用于合并多个类名的工具函数
 * 在UnoCSS中，我们可以简单地使用字符串连接或数组过滤的方式合并类名
 */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
