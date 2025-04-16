<template>
  <canvas
    ref="starsCanvas"
    :class="cn('absolute inset-0 w-full h-full', $props.class)"
  ></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { cn } from "../../../../lib/utils";
import { Star, FallingStarsBgProps } from './types';
import { detectSeason, getSeasonEffects } from './utils';
import { drawStarToContext } from './starRenderer';
import { checkInitialPerformance, updateTargetFPS, adjustPerformance } from './performanceManager';
import { initWorker, initializeWorker, updateWorkerConfig, updateWorkerCanvasSize, pauseWorker, resumeWorker } from './workerManager';
import { adjustCanvasSize, createOffscreenCanvas, calculateStarCount } from './canvasManager';

// 定义组件属性
const props = withDefaults(
  defineProps<FallingStarsBgProps>(),
  {
    color: "#FFF",
    count: 150, // 增加默认星星数量以提升视觉效果
  }
);

// 组件状态变量
const starsCanvas = ref<HTMLCanvasElement | null>(null);
let perspective: number = 0;
let stars: Star[] = [];
let ctx: CanvasRenderingContext2D | null = null;
let starWorker: Worker | null = null;
let animationFrameId: number | null = null;
let isComponentVisible = true;
let isPageVisible = true;

// 缓存画布相关变量
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
let needsFullRedraw = true; // 是否需要完全重绘

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
let lastFrameTime = 0; // 上一帧的时间

// 稳定期计数器
let stabilizationPeriod = 20; // 前20次FPS计算不调整性能模式

// DPR变量
let dpr = 1; // 设备像素比
let resizeObserver: ResizeObserver | null = null;
let visibilityObserver: IntersectionObserver | null = null;

// 窗口调整防抖相关变量
let resizeTimeout: number | null = null;
let pendingResize = false;
const RESIZE_DEBOUNCE_DELAY = 300; // 窗口调整防抖延迟（毫秒）

// 组件挂载
onMounted(() => {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  dpr = window.devicePixelRatio || 1;

  // 添加窗口大小变化监听
  window.addEventListener("resize", handleResize);

  // 使用ResizeObserver监听元素大小变化
  resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(canvas);

  // 使用IntersectionObserver监听元素可见性
  visibilityObserver = new IntersectionObserver(handleVisibilityChange, {
    threshold: 0.01 // 当元素有1%可见时触发
  });
  visibilityObserver.observe(canvas);

  // 监听页面可见性变化
  document.addEventListener("visibilitychange", handleDocumentVisibility);

  // 初始化画布
  setInitialCanvasSize();

  // 确保星星被初始化
  if (stars.length === 0) {
    initializeStars();
  }

  // 强制重绘
  needsFullRedraw = true;

  // 启动动画
  startAnimation();

  // 仅在开发环境输出调试信息
  if (process.env.NODE_ENV === 'development') {
    console.log("星空背景初始化完成，星星数量:", stars.length);
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

// 处理窗口大小变化
function handleResize() {
  // 标记有待处理的调整
  pendingResize = true;

  // 清除之前的定时器
  if (resizeTimeout !== null) {
    window.clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }

  // 立即调整画布大小，但不重新初始化星星
  const { ctx: newCtx, perspective: newPerspective, needsFullRedraw: needsRedraw } = adjustCanvasSize(starsCanvas.value, dpr);
  if (newCtx) ctx = newCtx;
  if (newPerspective) perspective = newPerspective;
  if (needsRedraw) needsFullRedraw = needsRedraw;

  // 设置定时器，在窗口调整停止后才重新初始化星星
  resizeTimeout = window.setTimeout(() => {
    // 在窗口调整停止后完全重新调整
    resizeCanvas();
    pendingResize = false;
    resizeTimeout = null;
    if (process.env.NODE_ENV === 'development') {
      console.log('窗口调整完成，重新初始化星星');
    }
  }, RESIZE_DEBOUNCE_DELAY);
}

// 处理元素可见性变化
function handleVisibilityChange(entries: IntersectionObserverEntry[]) {
  // 检测元素是否至少部分可见
  const isVisible = entries.some(entry => entry.isIntersecting);

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
        targetFPS = updateTargetFPS(performanceMode, stars.length);
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
  const newVisibility = document.visibilityState === 'visible';

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
      lastFrameTime = performance.now();
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
  lastFrameTime = performance.now();
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
  // 调用画布大小调整函数
  const { ctx: newCtx, perspective: newPerspective, needsFullRedraw: needsRedraw } = adjustCanvasSize(starsCanvas.value, dpr);
  if (newCtx) ctx = newCtx;
  if (newPerspective) perspective = newPerspective;
  if (needsRedraw) needsFullRedraw = needsRedraw;

  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 检测设备性能并设置初始性能模式
  performanceMode = checkInitialPerformance();

  // 更新目标帧率
  targetFPS = updateTargetFPS(performanceMode, stars.length);
  frameInterval = 1000 / targetFPS;

  // 初始化FPS历史记录
  fpsHistory = Array(FPS_HISTORY_SIZE).fill(targetFPS);

  try {
    // 初始化优化的Worker
    if (!starWorker) {
      starWorker = initWorker((updatedStars) => {
        stars = updatedStars;
      });

      if (!starWorker) {
        // 如果Worker初始化失败，在主线程中初始化星星
        initializeStars();
        return;
      }
    }

    // 发送初始化消息给Worker
    if (starWorker) {
      // 检测当前季节，添加季节信息
      const currentSeason = detectSeason() || 'spring'; // 如果返回空，默认使用春季

      // 获取季节特效配置
      const effectDensityFactor = 1.2; // 使用更高的密度因子
      const effect = getSeasonEffects(currentSeason, effectDensityFactor);

      initializeWorker(starWorker, {
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr,
        performanceMode,
        starCount: props.count,
        targetFPS,
        perspective,
        season: currentSeason, // 添加季节信息
        specialEffectType: effect.type, // 添加特效类型
        specialEffectRatio: effect.ratio // 添加特效比例
      });
    }
  } catch (error) {
    console.error("初始化Worker失败:", error);
    // 如果Worker初始化失败，在主线程中初始化星星
    starWorker = null;
    initializeStars();
  }

  // 如果星星数组为空，在主线程中初始化星星
  if (stars.length === 0 && !starWorker) {
    initializeStars();
  }

  // 标记需要完全重绘
  needsFullRedraw = true;

  // 设置初始背景为白色
  if (ctx) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // 立即绘制星星，确保初始化时就能看到
    if (stars.length > 0) {
      stars.forEach(star => {
        // 使用类型断言确保 ctx 不为 null
        drawStarToContext(star, ctx as CanvasRenderingContext2D, undefined, perspective);
      });
    }
  }
}

// 在窗口调整停止后完全重新调整画布和星星
function resizeCanvas() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 如果有Worker，通知其画布大小变化
  updateWorkerCanvasSize(starWorker, canvas.width, canvas.height);

  // 根据新的屏幕尺寸重新初始化星星
  // 这将使星星数量和分布适应新的屏幕尺寸
  initializeStars();

  // 窗口大小变化时需要完全重绘
  needsFullRedraw = true;

  // 立即绘制星星，确保在窗口大小变化停止后立即看到新的星星
  if (ctx && stars.length > 0) {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    stars.forEach(star => {
      drawStarToContext(star, ctx as CanvasRenderingContext2D, undefined, perspective);
    });
  }

  // 仅在开发环境输出日志
  if (process.env.NODE_ENV === 'development') {
    console.log(`屏幕尺寸调整完成: ${canvas.width/dpr}x${canvas.height/dpr}, 星星数量: ${stars.length}`);
  }
}

// 根据性能模式初始化星星
function initializeStars() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  stars = [];

  // 计算星星数量
  const starCount = calculateStarCount(canvas, dpr, props.count, performanceMode);

  // 检测当前季节，添加季节性特效
  const currentSeason = detectSeason();
  if (process.env.NODE_ENV === 'development') {
    console.log(`当前季节: ${currentSeason || '无特殊季节'}`);
  }

  // 根据季节和设备类型决定特效比例
  let effectDensityFactor = 1.0;

  // 检测设备类型
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet = isMobile && Math.min(window.screen.width, window.screen.height) > 768;

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
  if (process.env.NODE_ENV === 'development') {
    console.log(`季节: ${currentSeason}, 特效类型: ${specialEffectType}, 特效比例: ${specialEffectRatio.toFixed(2)}, 密度因子: ${effectDensityFactor.toFixed(2)}`);
  }

  // 创建不同类型的星星
  for (let i = 0; i < starCount; i++) {
    // 随机决定星星类型
    const starType = Math.random();
    let size, opacity, speed;

    if (starType < 0.7) { // 70% 普通星星
      size = Math.random() * 0.6 + 1.0; // 增大星星大小
      opacity = Math.random() * 0.3 + 0.5;
      speed = Math.random() * 4 + 2;
    } else if (starType < 0.9) { // 20% 中等星星
      size = Math.random() * 0.8 + 1.2; // 增大星星大小
      opacity = Math.random() * 0.3 + 0.6;
      speed = Math.random() * 3 + 1.5;
    } else { // 10% 大星星
      size = Math.random() * 1.0 + 1.5; // 增大星星大小
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
      rotationSpeed = (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1); // 随机旋转速度和方向

      // 根据特效类型设置颜色
      if (specialEffectType === 'snowflake') {
        color = '#A5D8FF'; // 淡蓝色雪花，在白色背景上更加明显
      } else if (specialEffectType === 'sakura') {
        // 樱花粉色色调
        const pinkHue = Math.floor(Math.random() * 20) + 340; // 340-360 或 0-20 的色相
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 70; // 70-90% 亮度
        color = `hsl(${pinkHue}, ${saturation}%, ${lightness}%)`;
      } else if (specialEffectType === 'leaf') {
        // 秋叶色调
        const leafHues = [30, 40, 50, 20, 10]; // 黄色、橙色、红色色相
        const hue = leafHues[Math.floor(Math.random() * leafHues.length)];
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 40; // 40-60% 亮度
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }
    }

    // 添加闪烁属性（非特殊效果星星或非叶子）
    const twinkle = !isSpecialEffect && Math.random() > 0.8 || (specialEffectType === 'leaf' ? false : isSpecialEffect && Math.random() > 0.9);
    const twinkleSpeed = Math.random() * 0.02 + 0.01; // 闪烁速度

    // 初始化星星位置
    const x = (Math.random() - 0.5) * 2 * canvas.width;
    const y = (Math.random() - 0.5) * 2 * canvas.height;

    stars.push({
      x,
      y,
      z: Math.random() * canvas.width,
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
      color
    });
  }
}

// 优化的 animate 函数
function animate(currentTime = 0) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 请求下一帧
  animationFrameId = requestAnimationFrame(animate);

  // 如果星星数组为空，初始化星星而不是返回
  if (stars.length === 0) {
    // 如果没有星星，先初始化星星
    initializeStars();
    // 继续执行而不是返回，确保立即渲染
  }

  // 如果正在调整窗口大小，减少渲染频率
  if (pendingResize) {
    // 在调整窗口大小时降低渲染频率，减少资源消耗
    const resizeElapsed = currentTime - lastFrameTime;
    if (resizeElapsed < frameInterval * 2) { // 在调整期间降低一半帧率
      return;
    }
  }

  // 帧率控制
  const elapsed = currentTime - lastFrameTime;
  if (elapsed < frameInterval) {
    return;
  }

  lastFrameTime = currentTime - (elapsed % frameInterval);

  // 确保上下文存在
  if (!ctx) {
    ctx = canvas.getContext("2d", { alpha: true });
    if (ctx) ctx.scale(dpr, dpr);
    if (!ctx) return;
  }

  if (!offscreenCanvas || !offscreenCtx) {
    const { offscreenCanvas: newCanvas, offscreenCtx: newCtx } = createOffscreenCanvas(canvas, dpr);
    offscreenCanvas = newCanvas;
    offscreenCtx = newCtx;
    if (!offscreenCtx) return;
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
    if (process.env.NODE_ENV === 'development') {
      console.log(`当前FPS: ${Math.round(fps)}, 性能模式: ${performanceMode}`);
    }

    lastFpsUpdate = currentTime;
    frames = 0;

    // 调整性能模式
    const { newPerformanceMode, newStabilizationPeriod, needsFullRedraw: needsRedraw } =
      adjustPerformance(fps, performanceMode, stabilizationPeriod, fpsHistory);

    performanceMode = newPerformanceMode;
    stabilizationPeriod = newStabilizationPeriod;

    if (needsRedraw) {
      needsFullRedraw = true;
      targetFPS = updateTargetFPS(performanceMode, stars.length);
      frameInterval = 1000 / targetFPS;
      updateWorkerConfig(starWorker, performanceMode, targetFPS);
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
    safeOffscreenCtx.globalCompositeOperation = 'destination-out';
    safeOffscreenCtx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    safeOffscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
    safeOffscreenCtx.globalCompositeOperation = 'source-over';
  }

  // 如果没有Worker，在主线程中更新星星位置
  if (!starWorker) {
    const deltaTime = elapsed;
    const timeScale = deltaTime / (1000 / 60); // 标准化到60FPS
    const currentTime = performance.now() / 1000; // 当前时间（秒）

    stars.forEach((star) => {
      // 更新z位置（距离）
      star.z -= star.speed * timeScale;

      // 如果星星超出视野，重置位置
      if (star.z <= 0) {
        star.z = canvas.width;

        // 初始化新位置
        const x = (Math.random() - 0.5) * 2 * canvas.width;
        const y = (Math.random() - 0.5) * 2 * canvas.height;
        star.x = x;
        star.y = y;
        star.originalX = x;
        star.originalY = y;

        // 重置速度
        star.velocityX = 0;
        star.velocityY = 0;

        // 随机决定新的属性
        star.opacity = Math.random() * 0.5 + 0.5;
        star.size = Math.random() * 1.0 + 1.0; // 增大星星大小

        // 随机决定是否添加抖动效果
        // 对于叶子，使用更小的抖动幅度并确保不闪烁
        if (star.specialEffect === 'leaf') {
          star.twinkle = false; // 叶子不闪烁
          star.opacity = 0.9; // 固定的不透明度
          star.jitter = true; // 叶子始终有轻微抖动，模拟风吹效果
          star.jitterAmount = 0.05; // 使用固定的抖动幅度，避免随机性
        } else {
          star.jitter = Math.random() > 0.8; // 20% 的普通星星有抖动效果
          star.jitterAmount = Math.random() * 0.3 + 0.1; // 正常抖动幅度
        }
      }

      // 如果星星有抖动属性，计算抖动效果
      if (star.jitter && star.originalX !== undefined && star.originalY !== undefined) {
        const jitterAmount = star.jitterAmount || 0.3;

        // 对于叶子，使用非常稳定的抖动模式
        if (star.specialEffect === 'leaf') {
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
          const jitterY = Math.cos(currentTime * 2.1 + star.z * 0.7) * jitterAmount;

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
  const len = stars.length;

  // 第一次遍历绘制普通星星
  for (let i = 0; i < len; i++) {
    const star = stars[i];
    if (!star.specialEffect) {
      drawStarToContext(star, safeOffscreenCtx, undefined, perspective);
    }
  }

  // 第二次遍历绘制特效星星
  for (let i = 0; i < len; i++) {
    const star = stars[i];
    if (star.specialEffect) {
      drawStarToContext(star, safeOffscreenCtx, undefined, perspective);
    }
  }

  safeOffscreenCtx.restore();

  // 将离屏画布内容复制到主画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(safeOffscreenCanvas, 0, 0);
}
</script>
