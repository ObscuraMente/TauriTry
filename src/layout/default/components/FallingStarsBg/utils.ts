import { RGBColor } from "./types";

// 缓存默认颜色值，避免重复计算
const defaultStarColor: RGBColor = { r: 100, g: 100, b: 100 }; // 深灰色星星

// 颜色缓存对象，避免重复计算
const colorCache: Record<string, RGBColor> = {};

// HSL转换缓存
const hslCache: Record<string, RGBColor> = {};

// 季节检测缓存
let cachedSeason: string | null = null;
let lastSeasonCheck = 0;

/**
 * 获取默认星星颜色
 */
export function hexToRgb(): RGBColor {
  // 对于白色背景，我们使用深灰色星星而不是纯黑色
  // 直接返回预定义的颜色对象，避免创建新对象
  return defaultStarColor;
}

/**
 * 解析颜色字符串为RGB值
 */
export function parseColor(color: string): RGBColor | null {
  // 检查缓存
  if (colorCache[color]) {
    return colorCache[color];
  }

  let result = null;

  // 处理十六进制颜色
  if (color.startsWith("#")) {
    let hex = color.replace(/^#/, "");

    // 如果是短十六进制格式，展开为长格式
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => char + char)
        .join("");
    }

    // 解析RGB值
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    result = { r, g, b };
  }
  // 处理HSL颜色
  else if (color.startsWith("hsl")) {
    // 提取HSL值
    const match = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
    if (match) {
      const h = parseInt(match[1]) / 360;
      const s = parseInt(match[2]) / 100;
      const l = parseInt(match[3]) / 100;

      // 转换HSL为RGB
      result = hslToRgb(h, s, l);
    }
  }

  // 如果解析成功，存入缓存
  if (result) {
    colorCache[color] = result;
  }

  return result;
}

/**
 * 将HSL颜色转换为RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGBColor {
  // 创建缓存键
  const cacheKey = `${h.toFixed(3)},${s.toFixed(3)},${l.toFixed(3)}`;

  // 检查缓存
  if (hslCache[cacheKey]) {
    return hslCache[cacheKey];
  }

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // 灰色
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const result = {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };

  // 存入缓存
  hslCache[cacheKey] = result;

  return result;
}

/**
 * 检测当前季节并返回对应的特效类型
 */
export function detectSeason(): string | null {
  // 直接返回秋季，用于测试秋叶特效
  // return 'summer';

  // 原始季节检测代码，暂时注释掉
  const now = Date.now();
  // 每小时只检测一次季节，减少不必要的计算
  if (cachedSeason !== null && now - lastSeasonCheck < 3600000) {
    return cachedSeason;
  }

  lastSeasonCheck = now;
  const date = new Date();
  const month = date.getMonth(); // 0-11

  // 使用查表法代替多个if-else，提高效率
  const seasons = [
    "winter", // 0 - 一月
    "winter", // 1 - 二月
    "spring", // 2 - 三月
    "spring", // 3 - 四月
    "spring", // 4 - 五月
    "summer", // 5 - 六月
    "summer", // 6 - 七月
    "summer", // 7 - 八月
    "autumn", // 8 - 九月
    "autumn", // 9 - 十月
    "autumn", // 10 - 十一月
    "winter", // 11 - 十二月
  ];

  cachedSeason = seasons[month];
  return cachedSeason;
}

/**
 * 获取季节特效配置
 */
export function getSeasonEffects(
  currentSeason: string | null,
  effectDensityFactor: number,
): {
  ratio: number;
  type: string;
} {
  // 使用对象映射代替多个if-else，提高可读性和效率
  const seasonEffects: Record<string, { ratio: number; type: string }> = {
    winter: { ratio: 0.15 * effectDensityFactor, type: "snowflake" },
    spring: { ratio: 0.15 * effectDensityFactor, type: "sakura" }, // 增加樱花比例
    autumn: { ratio: 0.15 * effectDensityFactor, type: "leaf" }, // 显著增加秋叶比例
    summer: { ratio: 0, type: "" }, // 夏季不显示特效
  };

  // 获取当前季节的特效设置，如果没有则使用空特效
  return currentSeason ? seasonEffects[currentSeason] : { ratio: 0, type: "" };
}

/**
 * 检测设备类型和性能
 */
export function detectDeviceType(): {
  isMobile: boolean;
  isTablet: boolean;
  isLowEndDevice: boolean;
  memory: number;
  isHighResolution: boolean;
} {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet =
    isMobile && Math.min(window.screen.width, window.screen.height) > 768;
  const isLowEndDevice = navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency <= 2
    : false;
  const memory =
    (navigator as unknown as { deviceMemory: number }).deviceMemory || 4; // 默认4GB

  // 检测屏幕分辨率
  const screenWidth = window.screen.width * (window.devicePixelRatio || 1);
  const isHighResolution = screenWidth > 2000; // 高分辨率屏幕

  return {
    isMobile,
    isTablet,
    isLowEndDevice,
    memory,
    isHighResolution,
  };
}
