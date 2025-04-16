/**
 * 调整画布大小
 */
export function adjustCanvasSize(
  canvas: HTMLCanvasElement | null,
  dpr: number
): {
  ctx: CanvasRenderingContext2D | null;
  perspective: number;
  needsFullRedraw: boolean;
} {
  if (!canvas) return { ctx: null, perspective: 0, needsFullRedraw: false };

  const parent = canvas.parentElement;
  if (!parent) return { ctx: null, perspective: 0, needsFullRedraw: false };

  // 获取父容器尺寸
  const parentWidth = parent.clientWidth || window.innerWidth;
  const parentHeight = parent.clientHeight || window.innerHeight;

  // 检查尺寸是否真的变化
  const currentWidth = parseInt(canvas.style.width, 10) || 0;
  const currentHeight = parseInt(canvas.style.height, 10) || 0;

  if (currentWidth === parentWidth && currentHeight === parentHeight) {
    return { ctx: null, perspective: 0, needsFullRedraw: false }; // 尺寸没有变化，不需要调整
  }

  // 设置CSS尺寸
  canvas.style.width = `${parentWidth}px`;
  canvas.style.height = `${parentHeight}px`;

  // 设置物理像素尺寸，考虑设备像素比
  canvas.width = Math.floor(parentWidth * dpr);
  canvas.height = Math.floor(parentHeight * dpr);

  // 创建上下文并调整像素比
  const ctx = canvas.getContext("2d", { alpha: true });
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  // 设置透视参数
  const perspective = canvas.width / (2 * dpr);

  // 标记需要完全重绘
  const needsFullRedraw = true;

  return { ctx, perspective, needsFullRedraw };
}

/**
 * 创建离屏缓存画布
 */
export function createOffscreenCanvas(
  canvas: HTMLCanvasElement | null,
  dpr: number
): {
  offscreenCanvas: HTMLCanvasElement | null;
  offscreenCtx: CanvasRenderingContext2D | null;
} {
  if (!canvas) return { offscreenCanvas: null, offscreenCtx: null };

  // 创建与主画布相同物理尺寸的离屏画布
  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  const offscreenCtx = offscreenCanvas.getContext("2d");

  // 适应设备像素比
  if (offscreenCtx) {
    offscreenCtx.scale(dpr, dpr);

    // 初始化离屏画布为白色
    offscreenCtx.fillStyle = "#FFFFFF";
    offscreenCtx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  }

  return { offscreenCanvas, offscreenCtx };
}

/**
 * 计算星星数量
 */
export function calculateStarCount(
  canvas: HTMLCanvasElement | null,
  dpr: number,
  baseCount: number,
  performanceMode: number
): number {
  if (!canvas) return baseCount;

  // 根据屏幕尺寸自适应调整星星数量
  const screenArea = (canvas.width / dpr) * (canvas.height / dpr);
  const baseArea = 1920 * 1080; // 基准屏幕面积
  const areaRatio = Math.min(1.5, Math.max(0.5, screenArea / baseArea)); // 限制比例在 0.5-1.5 之间

  // 检测设备方向和屏幕宽高比
  const isLandscape = canvas.width > canvas.height;
  const aspectRatio = canvas.width / canvas.height;

  // 检测设备类型
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet =
    isMobile && Math.min(window.screen.width, window.screen.height) > 768;

  // 根据设备类型和方向调整星星密度
  let densityFactor = 1.0;

  if (isMobile && !isTablet) {
    // 手机上降低星星密度
    densityFactor = 0.7;

    // 竖屏手机上进一步降低密度
    if (!isLandscape && aspectRatio < 0.7) {
      densityFactor = 0.5;
    }
  } else if (isTablet) {
    // 平板上的密度调整
    densityFactor = 0.8;
  } else {
    // 桌面设备上的密度调整
    if (aspectRatio > 2.0) {
      // 超宽屏幕增加星星密度
      densityFactor = 1.2;
    } else if (aspectRatio < 1.0) {
      // 竖屏显示器降低星星密度
      densityFactor = 0.8;
    }
  }

  // 根据屏幕面积、设备类型和性能模式调整星星数量
  let starCount = Math.floor(baseCount * areaRatio * densityFactor);
  if (performanceMode === 1) starCount = Math.floor(starCount * 0.6); // 中等质量降低40%
  if (performanceMode === 2) starCount = Math.floor(starCount * 0.3); // 低质量降低70%

  // 确保星星数量在合理范围内
  starCount = Math.max(50, Math.min(starCount, 500));

  // 仅在开发环境输出日志
  if (process.env.NODE_ENV === "development") {
    console.log(
      `屏幕面积比例: ${areaRatio.toFixed(2)}, 星星数量: ${starCount}`
    );
  }

  return starCount;
}
