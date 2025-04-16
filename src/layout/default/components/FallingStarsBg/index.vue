<template>
  <div
    class="absolute inset-0 overflow-hidden flex items-center justify-center"
  >
    <canvas
      ref="starsCanvas"
      :class="cn('', $props.class)"
      width="1920"
      height="1080"
      style="
        object-fit: cover;
        min-width: 100%;
        min-height: 100%;
        transform: translate(-50%, -50%);
        position: absolute;
        top: 50%;
        left: 50%;
      "
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { cn } from "../../../../lib/utils";
import { Star, FallingStarsBgProps } from "./types";
import { detectSeason, getSeasonEffects } from "./utils";
import { drawStarToContext } from "./starRenderer";
import {
  checkInitialPerformance,
  updateTargetFPS,
  adjustPerformance,
} from "./performanceManager";
import {
  initWorker,
  initializeWorker,
  updateWorkerConfig,
  pauseWorker,
  resumeWorker,
} from "./workerManager";
import { createOffscreenCanvas, calculateStarCount } from "./canvasManager";

// 定义组件属性
const props = withDefaults(defineProps<FallingStarsBgProps>(), {
  color: "#FFF",
  count: 250, // 增加默认星星数量，从150增加到250
});

// 组件状态变量
const isAnimating = ref(true);
const stars = ref<Star[]>([]);
const starsCanvas = ref<HTMLCanvasElement | null>(null);
const starsCtx = ref<CanvasRenderingContext2D | null>(null);
const rafId = ref<number | null>(null);
const lastTime = ref<number>(0);
const isTransitioning = ref(false);
const transitionStartTime = ref<number>(0);
const mouseMoveTracker = {
  lastX: 0,
  lastY: 0,
  moveX: 0,
  moveY: 0,
  lastUpdateTime: 0,
};

// 添加窗口状态变量
const lastWindowWidth = ref(window.innerWidth);
const lastWindowHeight = ref(window.innerHeight);
const isWindowEnlarged = ref(false);
const windowSizeChangeTime = ref(0);
let needsFullRedraw = false;

// 添加过渡时间常量
const TRANSITION_DURATION = 1200; // 过渡持续时间（毫秒）
const FADE_DURATION = 600; // 淡入淡出持续时间（毫秒）

let perspective: number = 0;
let starWorker: Worker | null = null;
let animationFrameId: number | null = null;
let isComponentVisible = true;
let isPageVisible = true;

// 缓存画布相关变量
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

// 性能监控变量
let frames = 0;
let fps = 60;
let fpsUpdateInterval = 1000; // 每秒更新FPS
let lastFpsUpdate = 0;
let performanceMode = 0; // 0: 高质量, 1: 中等质量, 2: 低质量
let fpsHistory: number[] = []; // 存储最近的FPS值
const FPS_HISTORY_SIZE = 5; // 保存最近5次FPS测量值

// 帧率限制相关变量
let targetFPS = 60; // 目标帧率
let frameInterval = 1000 / targetFPS; // 每帧的时间间隔

// 稳定期计数器
let stabilizationPeriod = 20; // 前20次FPS计算不调整性能模式

// DPR变量
let resizeObserver: ResizeObserver | null = null;
let visibilityObserver: IntersectionObserver | null = null;

// 添加过渡相关变量
let targetStarCount: number = 0; // 目标星星数量

// 添加缓动函数
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 添加缓动函数
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// 组件挂载
onMounted(() => {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 添加窗口大小变化监听
  window.addEventListener("resize", handleResize);

  // 使用ResizeObserver监听元素大小变化
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(canvas);

  // 使用IntersectionObserver监听元素可见性
  visibilityObserver = new IntersectionObserver(handleVisibilityChange, {
    threshold: 0.01, // 当元素有1%可见时触发
  });
  visibilityObserver.observe(canvas);

  // 监听页面可见性变化
  document.addEventListener("visibilitychange", handleDocumentVisibility);

  // 初始化画布
  setInitialCanvasSize();

  // 计算视口相对于标准尺寸的缩放比例
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const areaRatio = (viewportWidth * viewportHeight) / (1920 * 1080);

  // 根据面积比例调整星星数量
  const densityFactor = 1.5; // 增加密度系数
  const adjustedCount = Math.max(
    120, // 提高最小星星数量
    Math.round(props.count * Math.sqrt(areaRatio) * densityFactor)
  );

  // 初始化Web Worker - 现在在onMounted中直接调用
  initializeWorkerIfNeeded(adjustedCount);

  // 确保星星被初始化
  if (stars.value.length === 0) {
    initializeStars();
  }

  // 强制重绘
  needsFullRedraw = true;

  // 启动动画
  startAnimation();

  // 仅在开发环境输出调试信息
  if (process.env.NODE_ENV === "development") {
    console.log("星空背景初始化完成，星星数量:", stars.value.length);
  }
});

// 组件卸载前清理
onBeforeUnmount(() => {
  // 清理所有监听器和Worker
  if (resizeObserver && starsCanvas.value) {
    resizeObserver.unobserve(starsCanvas.value);
    resizeObserver.disconnect();
  }

  if (visibilityObserver && starsCanvas.value) {
    visibilityObserver.unobserve(starsCanvas.value);
    visibilityObserver.disconnect();
  }

  window.removeEventListener("resize", handleResize);
  document.removeEventListener("visibilitychange", handleDocumentVisibility);

  // 停止动画
  stopAnimation();

  // 终止 Worker
  if (starWorker) {
    pauseWorker(starWorker);
    starWorker.terminate();
    starWorker = null;
  }
});

// 修改窗口大小处理函数
function handleResize() {
  if (!starsCanvas.value || !starsCtx.value) return;

  // 获取当前窗口尺寸
  const currentWidth = window.innerWidth;
  const currentHeight = window.innerHeight;

  // 检查窗口大小变化状态
  const isEnlarged =
    currentWidth > lastWindowWidth.value + 100 ||
    currentHeight > lastWindowHeight.value + 100;

  // 如果窗口增大了很多（如从最小化恢复），设置标志以便更好地分布星星
  if (isEnlarged) {
    isWindowEnlarged.value = true;
    windowSizeChangeTime.value = performance.now();

    // 记录大小变更时间并添加更多星星来填充新区域
    const newStarsCount = Math.floor((currentWidth * currentHeight) / 6000);
    addStars(newStarsCount);

    // 5秒后重置窗口放大状态
    setTimeout(() => {
      isWindowEnlarged.value = false;
    }, 5000);
  }

  // 更新上次窗口尺寸
  lastWindowWidth.value = currentWidth;
  lastWindowHeight.value = currentHeight;

  // 调整画布尺寸
  starsCanvas.value.width = currentWidth;
  starsCanvas.value.height = currentHeight;
  starsCtx.value.fillStyle = "#000";

  // 标记需要完全重绘
  needsFullRedraw = true;
}

// 处理元素可见性变化
function handleVisibilityChange(entries: IntersectionObserverEntry[]) {
  // 检测元素是否至少部分可见
  const isVisible = entries.some((entry) => entry.isIntersecting);

  // 计算可见区域比例，用于性能调整
  if (entries.length > 0 && entries[0].isIntersecting) {
    const entry = entries[0];
    const visibleRatio = entry.intersectionRatio;

    // 如果可见区域很小，降低性能模式
    if (visibleRatio < 0.3 && isVisible) {
      // 如果只有小部分可见，降低质量
      const oldMode = performanceMode;
      performanceMode = Math.max(performanceMode, 1);
      if (oldMode !== performanceMode) {
        targetFPS = updateTargetFPS(performanceMode, stars.value.length);
        frameInterval = 1000 / targetFPS;
        updateWorkerConfig(starWorker, performanceMode, targetFPS);
      }
    } else if (visibleRatio > 0.8) {
      // 如果大部分可见，恢复正常性能检测
      performanceMode = checkInitialPerformance();
    }
  }

  if (isVisible !== isComponentVisible) {
    isComponentVisible = isVisible;
    updateAnimationState();
  }
}

// 处理页面可见性变化
function handleDocumentVisibility() {
  const newVisibility = document.visibilityState === "visible";

  if (newVisibility !== isPageVisible) {
    isPageVisible = newVisibility;

    // 如果页面变为可见，重新计算性能模式
    if (newVisibility) {
      // 页面重新可见时，重置性能监控变量
      frames = 0;
      lastFpsUpdate = performance.now();
      fpsHistory = Array(FPS_HISTORY_SIZE).fill(targetFPS);
      stabilizationPeriod = 20; // 重置稳定期
    }

    updateAnimationState();
  }
}

// 更新动画状态（启动或暂停）
function updateAnimationState() {
  const shouldAnimate = isComponentVisible && isPageVisible;

  if (shouldAnimate) {
    if (!animationFrameId) {
      // 重置时间相关变量，避免大幅度时间增量
      lastTime.value = performance.now();
      lastFpsUpdate = performance.now();
      startAnimation();
    }
    resumeWorker(starWorker);
  } else {
    stopAnimation();
    pauseWorker(starWorker);

    // 强制重绘标记，确保恢复时重绘
    needsFullRedraw = true;
  }
}

// 启动动画
function startAnimation() {
  if (animationFrameId) return;
  lastTime.value = performance.now();
  lastFpsUpdate = performance.now();
  frames = 0;
  animationFrameId = requestAnimationFrame(animate);
}

// 停止动画
function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// 优化的 setInitialCanvasSize 函数
function setInitialCanvasSize() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 使用固定大小画布 - 1920x1080
  // 不使用devicePixelRatio，保持固定像素
  const canvasWidth = 1920;
  const canvasHeight = 1080;

  // 计算视口相对于标准尺寸的缩放比例，用于动态调整星星数量
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const areaRatio = (viewportWidth * viewportHeight) / (1920 * 1080);

  // 记录调试信息
  if (process.env.NODE_ENV === "development") {
    console.log(
      `视口尺寸: ${viewportWidth}x${viewportHeight}, 面积比例: ${areaRatio.toFixed(
        2
      )}`
    );
  }

  // 根据面积比例调整星星数量，使用更高的密度系数1.5
  const densityFactor = 1.5; // 增加密度系数
  const adjustedCount = Math.max(
    120, // 提高最小星星数量
    Math.round(props.count * Math.sqrt(areaRatio) * densityFactor)
  );

  // 获取上下文
  starsCtx.value = canvas.getContext("2d", { alpha: true });

  // 设置透视值，使用固定值
  perspective = 400;

  // 初始化FPS和性能相关值
  performanceMode = checkInitialPerformance();
  targetFPS = updateTargetFPS(performanceMode, adjustedCount);
  frameInterval = 1000 / targetFPS;
  fpsHistory = Array(FPS_HISTORY_SIZE).fill(targetFPS);

  // 通过离屏画布提高性能
  if (!offscreenCanvas || !offscreenCtx) {
    const { offscreenCanvas: newCanvas, offscreenCtx: newCtx } =
      createOffscreenCanvas(canvas, 1); // 使用统一DPR=1
    offscreenCanvas = newCanvas;
    offscreenCtx = newCtx;
  }

  // 如果星星数组为空，在主线程中初始化星星
  if (stars.value.length === 0) {
    initializeStars(adjustedCount);
  }

  // 标记需要完全重绘
  needsFullRedraw = true;

  // 设置初始背景为白色
  if (starsCtx.value) {
    starsCtx.value.fillStyle = "#FFFFFF";
    starsCtx.value.fillRect(0, 0, canvasWidth, canvasHeight);

    // 立即绘制星星，确保初始化时就能看到
    if (stars.value.length > 0) {
      stars.value.forEach((star) => {
        // 使用类型断言确保 ctx 不为 null
        drawStarToContext(
          star,
          starsCtx.value as CanvasRenderingContext2D,
          undefined,
          perspective
        );
      });
    }
  }
}

// 初始化web worker - 将此逻辑移到onMounted中
function initializeWorkerIfNeeded(adjustedCount: number) {
  try {
    // 初始化优化的Worker
    if (!starWorker) {
      starWorker = initWorker((updatedStars) => {
        stars.value = updatedStars;
      });

      if (!starWorker) {
        // 如果Worker初始化失败，在主线程中初始化星星
        initializeStars(adjustedCount);
        return;
      }
    }

    // 发送初始化消息给Worker
    if (starWorker) {
      // 使用固定大小画布
      const canvasWidth = 1920;
      const canvasHeight = 1080;

      // 检测当前季节，添加季节信息
      const currentSeason = detectSeason() || "spring"; // 如果返回空，默认使用春季

      // 获取季节特效配置
      const effectDensityFactor = 1.2; // 使用更高的密度因子
      const effect = getSeasonEffects(currentSeason, effectDensityFactor);

      initializeWorker(starWorker, {
        canvasWidth,
        canvasHeight,
        dpr: 1, // 使用固定尺寸画布不需要考虑dpr
        performanceMode,
        starCount: adjustedCount, // 使用调整后的数量
        targetFPS,
        perspective,
        season: currentSeason, // 添加季节信息
        specialEffectType: effect.type, // 添加特效类型
        specialEffectRatio: effect.ratio, // 添加特效比例
      });
    }
  } catch (error) {
    console.error("初始化Worker失败:", error);
    // 如果Worker初始化失败，在主线程中初始化星星
    starWorker = null;
    initializeStars(adjustedCount);
  }
}

// 根据性能模式初始化星星
function initializeStars(count = props.count) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 使用固定尺寸画布
  const canvasWidth = 1920;
  const canvasHeight = 1080;

  // 记录调试信息
  if (process.env.NODE_ENV === "development") {
    console.log(
      `初始化星星，画布尺寸: ${canvasWidth}x${canvasHeight}, 星星数量: ${count}`
    );
  }

  stars.value = [];

  // 计算星星数量 - 增加密度系数
  const densityFactor = 1.2; // 应用额外的密度提升
  const starCount = Math.ceil(
    calculateStarCount(
      canvas,
      1, // 使用固定的DPR=1
      count,
      performanceMode
    ) * densityFactor
  );

  // 检测当前季节，添加季节性特效
  const currentSeason = detectSeason();
  if (process.env.NODE_ENV === "development") {
    console.log(`当前季节: ${currentSeason || "无特殊季节"}`);
  }

  // 根据季节和设备类型决定特效比例
  let effectDensityFactor = 1.0;

  // 检测设备类型
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet =
    isMobile && Math.min(window.screen.width, window.screen.height) > 768;

  // 根据设备类型调整特效密度
  if (isMobile && !isTablet) {
    // 手机上降低特效密度
    effectDensityFactor = 0.5;
  } else if (isTablet) {
    // 平板上的特效密度
    effectDensityFactor = 0.7;
  } else {
    // 桌面设备上的特效密度
    // 大屏幕上增加特效比例
    effectDensityFactor *= 1.2;
  }

  // 获取季节特效配置
  const effect = getSeasonEffects(currentSeason, effectDensityFactor);
  const specialEffectRatio = effect.ratio;
  const specialEffectType = effect.type;

  // 仅在开发环境输出特效信息
  if (process.env.NODE_ENV === "development") {
    console.log(
      `季节: ${currentSeason}, 特效类型: ${specialEffectType}, 特效比例: ${specialEffectRatio.toFixed(
        2
      )}, 密度因子: ${effectDensityFactor.toFixed(2)}`
    );
  }

  // 创建不同类型的星星
  for (let i = 0; i < starCount; i++) {
    // 随机决定星星类型
    const starType = Math.random();
    let size, opacity, speed;

    if (starType < 0.7) {
      // 70% 普通星星
      size = Math.random() * 0.7 + 1.1; // 略微增大星星大小
      opacity = Math.random() * 0.3 + 0.5;
      speed = Math.random() * 4 + 2;
    } else if (starType < 0.9) {
      // 20% 中等星星
      size = Math.random() * 0.9 + 1.3; // 略微增大星星大小
      opacity = Math.random() * 0.3 + 0.6;
      speed = Math.random() * 3 + 1.5;
    } else {
      // 10% 大星星
      size = Math.random() * 1.2 + 1.6; // 略微增大星星大小
      opacity = Math.random() * 0.2 + 0.7;
      speed = Math.random() * 2 + 1;
    }

    // 随机决定是否为特殊效果星星
    const isSpecialEffect = Math.random() < specialEffectRatio;
    let specialEffect = undefined;
    let rotation = undefined;
    let rotationSpeed = undefined;
    let color = undefined;

    if (isSpecialEffect && specialEffectType) {
      specialEffect = specialEffectType;
      rotation = Math.random() * Math.PI * 2; // 随机初始旋转角度
      rotationSpeed =
        (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1); // 随机旋转速度和方向

      // 根据特效类型设置颜色
      if (specialEffectType === "snowflake") {
        color = "#A5D8FF"; // 淡蓝色雪花，在白色背景上更加明显
      } else if (specialEffectType === "sakura") {
        // 樱花粉色色调
        const pinkHue = Math.floor(Math.random() * 20) + 340; // 340-360 或 0-20 的色相
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 70; // 70-90% 亮度
        color = `hsl(${pinkHue}, ${saturation}%, ${lightness}%)`;
      } else if (specialEffectType === "leaf") {
        // 秋叶色调
        const leafHues = [30, 40, 50, 20, 10]; // 黄色、橙色、红色色相
        const hue = leafHues[Math.floor(Math.random() * leafHues.length)];
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 40; // 40-60% 亮度
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }
    }

    // 添加闪烁属性（非特殊效果星星或非叶子）
    const twinkle =
      (!isSpecialEffect && Math.random() > 0.8) ||
      (specialEffectType === "leaf"
        ? false
        : isSpecialEffect && Math.random() > 0.9);
    const twinkleSpeed = Math.random() * 0.02 + 0.01; // 闪烁速度

    // 初始化星星位置 - 使用固定尺寸
    const x = (Math.random() - 0.5) * 2 * canvasWidth;
    const y = (Math.random() - 0.5) * 2 * canvasHeight;

    stars.value.push({
      x,
      y,
      z: Math.random() * canvasWidth,
      speed,
      size,
      opacity,
      twinkle,
      twinkleSpeed,
      twinkleOffset: Math.random() * Math.PI * 2, // 随机相位，使得星星不同时闪烁
      originalX: x,
      originalY: y,
      velocityX: 0,
      velocityY: 0,
      specialEffect,
      rotation,
      rotationSpeed,
      color,
    });
  }
}

// 修改animate函数，添加星星数量平滑过渡逻辑
function animate(currentTime = 0) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 请求下一帧
  animationFrameId = requestAnimationFrame(animate);

  // 如果星星数组为空，初始化星星而不是返回
  if (stars.value.length === 0) {
    // 如果没有星星，先初始化星星
    initializeStars();
    // 继续执行而不是返回，确保立即渲染
  }

  // 帧率控制
  const elapsed = currentTime - lastTime.value;
  if (elapsed < frameInterval) {
    return;
  }

  lastTime.value = currentTime - (elapsed % frameInterval);

  // 处理星星数量过渡
  if (isTransitioning.value && targetStarCount !== stars.value.length) {
    const transitionElapsed = currentTime - transitionStartTime.value;
    const rawProgress = Math.min(transitionElapsed / TRANSITION_DURATION, 1);

    // 使用缓动函数获得更自然的过渡效果
    const progress = easeInOutCubic(rawProgress);

    if (progress >= 1 || Math.abs(stars.value.length - targetStarCount) <= 5) {
      // 过渡结束，直接设置为目标数量
      isTransitioning.value = false;

      // 停止当前动画
      stopAnimation();

      // 重新初始化星星到目标数量
      if (starWorker) {
        pauseWorker(starWorker);
        initializeWorkerIfNeeded(targetStarCount);
      } else {
        initializeStars(targetStarCount);
      }

      // 标记需要完全重绘
      needsFullRedraw = true;

      // 重启动画
      startAnimation();

      if (process.env.NODE_ENV === "development") {
        console.log(`星星数量过渡完成: ${targetStarCount}`);
      }

      return;
    }

    // 计算当前帧应该有的星星数量
    const currentTargetCount = Math.round(
      stars.value.length + (targetStarCount - stars.value.length) * progress
    );

    // 只有当数量变化时才更新
    if (currentTargetCount !== stars.value.length) {
      // 根据方向增加或减少星星
      if (currentTargetCount > stars.value.length) {
        // 需要增加星星
        addStars(currentTargetCount - stars.value.length);
      } else if (currentTargetCount < stars.value.length) {
        // 需要减少星星
        removeStars(stars.value.length - currentTargetCount);
      }

      if (process.env.NODE_ENV === "development" && Math.random() < 0.05) {
        // 只记录大约5%的帧，避免日志过多
        console.log(
          `星星数量过渡中: ${
            stars.value.length
          } / ${targetStarCount} (${Math.round(progress * 100)}%)`
        );
      }
    }

    // 移除高耗GPU的模糊效果，保持高性能
  } else if (offscreenCtx) {
    // 确保非过渡时没有滤镜效果
    offscreenCtx.filter = "none";
  }

  // 确保上下文存在
  if (!starsCtx.value) {
    starsCtx.value = canvas.getContext("2d", { alpha: true });
    if (!starsCtx.value) return;
  }

  // 确保离屏画布存在且尺寸正确
  if (
    !offscreenCanvas ||
    !offscreenCtx ||
    offscreenCanvas.width !== canvas.width ||
    offscreenCanvas.height !== canvas.height
  ) {
    const { offscreenCanvas: newCanvas, offscreenCtx: newCtx } =
      createOffscreenCanvas(canvas, 1); // 使用统一DPR=1
    offscreenCanvas = newCanvas;
    offscreenCtx = newCtx;
    if (!offscreenCtx) return;

    // 离屏画布重新创建，需要完全重绘
    needsFullRedraw = true;
  }

  const safeOffscreenCanvas = offscreenCanvas as HTMLCanvasElement;
  const safeOffscreenCtx = offscreenCtx as CanvasRenderingContext2D;

  // FPS计算和性能调整
  frames++;
  if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
    const newFps = Math.round((frames * 1000) / (currentTime - lastFpsUpdate));

    // 将新的FPS值添加到历史记录中
    fpsHistory.push(newFps);
    if (fpsHistory.length > FPS_HISTORY_SIZE) {
      fpsHistory.shift(); // 移除最早的记录
    }

    // 使用平均FPS来平滑性能调整
    fps = fpsHistory.reduce((sum, value) => sum + value, 0) / fpsHistory.length;

    // 只在开发模式下输出日志
    if (process.env.NODE_ENV === "development") {
      console.log(
        `当前FPS: ${Math.round(fps)}, 性能模式: ${performanceMode}, 星星数量: ${
          stars.value.length
        }`
      );
    }

    lastFpsUpdate = currentTime;
    frames = 0;

    // 调整性能模式
    const {
      newPerformanceMode,
      newStabilizationPeriod,
      needsFullRedraw: needsRedraw,
    } = adjustPerformance(
      fps,
      performanceMode,
      stabilizationPeriod,
      fpsHistory
    );

    performanceMode = newPerformanceMode;
    stabilizationPeriod = newStabilizationPeriod;

    if (needsRedraw) {
      needsFullRedraw = true;
      targetFPS = updateTargetFPS(performanceMode, stars.value.length);
      frameInterval = 1000 / targetFPS;
      updateWorkerConfig(starWorker, performanceMode, targetFPS);
    }

    // 定期检查视口大小变化(每5秒左右)
    if (Math.random() < 0.2) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const areaRatio = (viewportWidth * viewportHeight) / (1920 * 1080);
      const densityFactor = 1.5; // 使用更高的密度系数
      const idealCount = Math.max(
        120, // 提高最小星星数量
        Math.round(props.count * Math.sqrt(areaRatio) * densityFactor)
      );

      // 如果当前星星数量与理想数量差距较大，触发重新初始化
      const countDiff = Math.abs(stars.value.length - idealCount);
      if (countDiff > idealCount * 0.3) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `星星数量需要调整: ${stars.value.length} -> ${idealCount}`
          );
        }
        handleResize();
      }
    }
  }

  // 清除画布或应用渐变效果 - 渲染路径优化
  if (needsFullRedraw) {
    // 完全重绘时使用清除操作
    safeOffscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    needsFullRedraw = false;
  } else {
    // 根据性能模式和当前FPS动态调整渐变效果
    let fadeAlpha = 0.25; // 默认值

    // 根据性能模式调整基础透明度
    if (performanceMode === 1) fadeAlpha = 0.2;
    if (performanceMode === 2) fadeAlpha = 0.15;

    // 根据当前FPS进一步调整
    if (fps < targetFPS * 0.8) {
      // 如果FPS低于目标的80%，增加透明度以减少拖尾效果
      fadeAlpha += 0.05;
    } else if (fps > targetFPS * 1.1) {
      // 如果FPS高于目标的110%，减少透明度以增强拖尾效果
      fadeAlpha = Math.max(0.1, fadeAlpha - 0.05);
    }

    // 使用更高效的渐变方式
    safeOffscreenCtx.globalCompositeOperation = "destination-out";
    safeOffscreenCtx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    safeOffscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
    safeOffscreenCtx.globalCompositeOperation = "source-over";
  }

  // 如果没有Worker，在主线程中更新星星位置
  if (!starWorker) {
    const deltaTime = elapsed;
    const timeScale = deltaTime / (1000 / 60); // 标准化到60FPS
    const currentTime = performance.now() / 1000; // 当前时间（秒）

    // 使用固定尺寸画布
    const canvasWidth = 1920;
    const canvasHeight = 1080;

    stars.value.forEach((star) => {
      // 更新z位置（距离）
      star.z -= star.speed * timeScale;

      // 如果星星超出视野，重置位置
      if (star.z <= 0) {
        star.z = canvasWidth; // 使用固定画布宽度

        // 初始化新位置 - 使用固定尺寸
        const x = (Math.random() - 0.5) * 2 * canvasWidth;
        const y = (Math.random() - 0.5) * 2 * canvasHeight;
        star.x = x;
        star.y = y;
        star.originalX = x;
        star.originalY = y;

        // 重置速度
        star.velocityX = 0;
        star.velocityY = 0;

        // 随机决定新的属性
        star.opacity = Math.random() * 0.5 + 0.5;

        // 增加星星大小
        const sizeBoost = Math.random() > 0.9 ? 0.5 : 0; // 10%的概率获得更大尺寸
        star.size = Math.random() * 1.0 + 1.0 + sizeBoost;

        // 提高闪烁几率
        if (star.specialEffect === "leaf") {
          star.twinkle = false; // 叶子不闪烁
          star.opacity = 0.9; // 固定的不透明度
          star.jitter = true; // 叶子始终有轻微抖动，模拟风吹效果
          star.jitterAmount = 0.05; // 使用固定的抖动幅度，避免随机性
        } else {
          // 增加普通星星的闪烁和抖动概率
          star.twinkle = Math.random() > 0.3; // 70%的星星会闪烁，大幅提升闪烁比例
          star.twinkleSpeed = Math.random() * 0.03 + 0.01; // 闪烁速度略微加快
          star.twinkleOffset = Math.random() * Math.PI * 2; // 随机相位
          star.jitter = Math.random() > 0.5; // 50%的普通星星有抖动效果，提高抖动比例
          star.jitterAmount = Math.random() * 0.4 + 0.1; // 增加抖动幅度
        }
      }

      // 如果星星有抖动属性，计算抖动效果
      if (
        star.jitter &&
        star.originalX !== undefined &&
        star.originalY !== undefined
      ) {
        const jitterAmount = star.jitterAmount || 0.3;

        // 对于叶子，使用非常稳定的抖动模式
        if (star.specialEffect === "leaf") {
          // 使用固定的抖动模式，避免闪烁
          // 只使用z值确定抖动，这个值变化非常缓慢
          const fixedTime = Math.floor(star.z / 100) * 100; // 将时间固定到大的间隔
          // 叶子不应该水平抖动
          const jitterY = Math.cos(fixedTime * 0.01) * (jitterAmount * 0.5); // 非常小的垂直抖动

          // 应用抖动效果
          star.x = star.originalX;
          star.y = star.originalY + jitterY;
        } else {
          // 对于普通星星，使用正常的抖动计算
          const jitterX = Math.sin(currentTime * 2.5 + star.z) * jitterAmount;
          const jitterY =
            Math.cos(currentTime * 2.1 + star.z * 0.7) * jitterAmount;

          // 应用抖动效果
          star.x = star.originalX + jitterX;
          star.y = star.originalY + jitterY;
        }
      }
    });
  }

  // 批量绘制星星以提高性能
  safeOffscreenCtx.save();

  // 使用更高效的渲染方式，避免创建临时数组
  // 先绘制普通星星，再绘制特效星星，减少状态切换

  // 使用for循环代替forEach，提高性能
  const len = stars.value.length;

  // 第一次遍历绘制普通星星
  for (let i = 0; i < len; i++) {
    const star = stars.value[i];
    if (!star.specialEffect) {
      drawStarToContext(star, safeOffscreenCtx, undefined, perspective);
    }
  }

  // 第二次遍历绘制特效星星
  for (let i = 0; i < len; i++) {
    const star = stars.value[i];
    if (star.specialEffect) {
      drawStarToContext(star, safeOffscreenCtx, undefined, perspective);
    }
  }

  safeOffscreenCtx.restore();

  // 将离屏画布内容复制到主画布
  starsCtx.value.clearRect(0, 0, canvas.width, canvas.height);
  starsCtx.value.drawImage(safeOffscreenCanvas, 0, 0);
}

// 修改添加星星函数，优化星星分布
function addStars(count: number) {
  if (!count || count <= 0) return;

  // 确保有画布
  const canvas = starsCanvas.value;
  if (!canvas) return;

  const canvasWidth = 1920;
  const canvasHeight = 1080;

  // 检测当前季节 - 较大窗口时降低特效密度防止GPU过载
  const currentSeason = detectSeason() || "spring";

  // 根据屏幕大小动态调整特效密度
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  // 屏幕面积比例
  const screenRatio = (viewportWidth * viewportHeight) / (1920 * 1080);

  // 大屏幕时降低特效比例，防止过载
  let effectDensityFactor = 1.2;
  if (screenRatio > 1.5) {
    // 大屏幕上降低特效密度
    effectDensityFactor = 0.8;
  } else if (screenRatio > 1) {
    // 中等屏幕
    effectDensityFactor = 1.0;
  }

  const seasonEffect = getSeasonEffects(currentSeason, effectDensityFactor);

  // 在过渡期间使用更低的特效比例
  const specialEffectRatio = seasonEffect.ratio * 0.6;

  // 判断是否需要广泛分布（窗口放大或生成大量星星）
  const needWiderDistribution = isWindowEnlarged.value || count > 100;

  // 创建新星星
  for (let i = 0; i < count; i++) {
    // 随机决定星星类型
    const starType = Math.random();
    let size, opacity, speed;

    if (starType < 0.7) {
      // 70% 普通星星
      size = Math.random() * 0.7 + 1.1;
      opacity = Math.random() * 0.3 + 0.5;
      speed = Math.random() * 4 + 2;
    } else if (starType < 0.9) {
      // 20% 中等星星
      size = Math.random() * 0.9 + 1.3;
      opacity = Math.random() * 0.3 + 0.6;
      speed = Math.random() * 3 + 1.5;
    } else {
      // 10% 大星星
      size = Math.random() * 1.2 + 1.6;
      opacity = Math.random() * 0.2 + 0.7;
      speed = Math.random() * 2 + 1;
    }

    // 添加闪烁属性
    const twinkle = Math.random() > 0.7;
    const twinkleSpeed = Math.random() * 0.02 + 0.01;

    // 改进的星星分布逻辑
    let x, y;
    const angle = Math.random() * Math.PI * 2; // 随机角度

    if (needWiderDistribution) {
      // 窗口放大或大量星星时使用更广泛的分布
      // 使用非线性分布确保边缘区域也有适当密度
      const distributionFactor = Math.pow(Math.random(), 0.7); // 非线性分布

      // 放大时使用更大的分布半径，最高可达画布的50%
      let distributionRadius;
      if (isWindowEnlarged.value) {
        // 从最小化恢复时使用更均匀的分布
        distributionRadius = canvasWidth * (0.3 + Math.random() * 0.2);
      } else {
        // 正常大量星星生成时使用逐渐扩大的分布
        const expansionProgress = i / count; // 随着生成进度扩大分布
        distributionRadius = canvasWidth * (0.15 + expansionProgress * 0.15);
      }

      const distanceFromCenter = distributionFactor * distributionRadius;
      x = Math.cos(angle) * distanceFromCenter;
      y = Math.sin(angle) * distanceFromCenter;
    } else {
      // 正常情况下使用中心分布
      const centerRadius = 0.15 * canvasWidth;
      const distanceFromCenter = Math.random() * centerRadius;
      x = Math.cos(angle) * distanceFromCenter;
      y = Math.sin(angle) * distanceFromCenter;
    }

    // 新星星从中心位置开始，设置较大的z值（远处）
    const z = canvasWidth * (0.7 + Math.random() * 0.3);

    // 较大的屏幕上减少特效星星，防止GPU过载
    const screenSizeAdjustedRatio =
      specialEffectRatio / Math.max(1, screenRatio * 0.7);
    const isSpecialEffect = Math.random() < screenSizeAdjustedRatio;

    let specialEffect = undefined;
    let rotation = undefined;
    let rotationSpeed = undefined;
    let color = undefined;

    if (isSpecialEffect) {
      specialEffect = seasonEffect.type;
      rotation = Math.random() * Math.PI * 2; // 随机初始旋转角度
      rotationSpeed =
        (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1);

      // 根据特效类型设置颜色 - 简化颜色生成逻辑
      if (specialEffect === "snowflake") {
        color = "#A5D8FF"; // 淡蓝色雪花
      } else if (specialEffect === "sakura") {
        const pinkHue = 345 + Math.floor(Math.random() * 15);
        color = `hsl(${pinkHue}, 80%, 75%)`;
      } else if (specialEffect === "leaf") {
        const leafHues = [30, 40, 15, 20];
        const hue = leafHues[Math.floor(Math.random() * leafHues.length)];
        color = `hsl(${hue}, 80%, 50%)`;
        size *= 1.2; // 叶子略大
      }
    }

    // 添加视觉过渡效果 - 保留淡入效果，但简化计算
    let adjustedOpacity = opacity;
    if (isTransitioning.value) {
      const progress = Math.min(
        (performance.now() - transitionStartTime.value) / 500,
        1
      );
      adjustedOpacity = opacity * progress;
    }

    stars.value.push({
      x,
      y,
      z,
      speed,
      size,
      opacity: adjustedOpacity,
      twinkle,
      twinkleSpeed,
      twinkleOffset: Math.random() * Math.PI * 2,
      originalX: x,
      originalY: y,
      velocityX: 0,
      velocityY: 0,
      specialEffect,
      rotation,
      rotationSpeed,
      color,
    });
  }

  // 标记需要完全重绘
  needsFullRedraw = true;
}

// 修改减少星星的函数，简化逻辑提高性能
function removeStars(count: number) {
  if (!count || count <= 0 || stars.value.length === 0) return;

  // 限制移除数量，不超过当前星星总数
  count = Math.min(count, stars.value.length);

  // 简化移除逻辑 - 大屏幕时直接移除，避免额外计算
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const screenRatio = (viewportWidth * viewportHeight) / (1920 * 1080);

  // 只在小屏幕和过渡初期使用平滑淡出
  if (screenRatio < 1.2 && isTransitioning.value) {
    const progress =
      (performance.now() - transitionStartTime.value) / TRANSITION_DURATION;

    if (progress < 0.3) {
      // 简化淡出逻辑 - 只处理部分星星，而且只调整不透明度
      const starsToFade = Math.ceil(count * 0.5);
      const remainingStars = stars.value.length - starsToFade;

      // 直接设置不透明度而不是每个都单独计算
      for (let i = remainingStars; i < stars.value.length; i++) {
        if (stars.value[i]) {
          stars.value[i].opacity = (stars.value[i].opacity || 0.5) * 0.6;
        }
      }

      // 一次移除较少的星星，其余在下一帧处理
      stars.value = stars.value.slice(
        0,
        stars.value.length - Math.ceil(count * 0.3)
      );
      return;
    }
  }

  // 大多数情况下直接移除星星 - 更高效
  stars.value = stars.value.slice(0, stars.value.length - count);

  // 标记需要完全重绘
  needsFullRedraw = true;
}
</script>
