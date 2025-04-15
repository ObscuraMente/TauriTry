<template>
  <canvas
    ref="starsCanvas"
    :class="cn('absolute inset-0 w-full h-full', $props.class)"
  ></canvas>
</template>

<script setup lang="ts">
import { cn } from "../../../../lib/utils";

// 定义生命周期钩子必须在所有其他逻辑之前
const starsCanvas = ref<HTMLCanvasElement | null>(null);
let perspective: number = 0;
let stars: Star[] = [];
let ctx: CanvasRenderingContext2D | null = null;
let starWorker: Worker | null = null;

// 添加缓存画布相关变量
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
let needsFullRedraw = true; // 是否需要完全重绘

// 添加性能监控变量
let frames = 0;
let fps = 60;
let fpsUpdateInterval = 1000; // 每秒更新FPS
let lastFpsUpdate = 0;
let performanceMode = 0; // 0: 高质量, 1: 中等质量, 2: 低质量

// 帧率限制相关变量
let targetFPS = 60; // 目标帧率
let frameInterval = 1000 / targetFPS; // 每帧的时间间隔
let lastFrameTime = 0; // 上一帧的时间

// 添加稳定期计数器
let stabilizationPeriod = 100; // 前20次FPS计算不调整性能模式

// 添加DPR变量
let dpr = 1; // 设备像素比
let resizeObserver: ResizeObserver | null = null;

// 所有生命周期钩子必须直接放在组件顶部
onMounted(() => {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  dpr = window.devicePixelRatio || 1;
  window.addEventListener("resize", resizeCanvas);
  resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvas);
  setInitialCanvasSize();
  animate();
});

onBeforeUnmount(() => {
  if (resizeObserver && starsCanvas.value) {
    resizeObserver.unobserve(starsCanvas.value);
    resizeObserver.disconnect();
  }
  window.removeEventListener("resize", resizeCanvas);

  // 终止 Worker
  if (starWorker) {
    starWorker.terminate();
    starWorker = null;
  }
});

interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
}

const props = withDefaults(
  defineProps<{
    color?: string;
    count?: number;
    class?: string;
  }>(),
  {
    color: "#FFF",
    count: 100,
  }
);

// 检测设备初始性能并设置合适的性能模式
function checkInitialPerformance() {
  // 全部默认从高质量开始
  performanceMode = 0;

  // 仅在明确是移动设备时降级
  if (/iPhone|Android.*Mobile/i.test(navigator.userAgent)) {
    performanceMode = 1;
  }
}

// 根据性能模式更新目标帧率
function updateTargetFPS() {
  // 根据性能模式调整帧率
  switch (performanceMode) {
    case 0: // 高质量
      targetFPS = 60;
      break;
    case 1: // 中等质量
      targetFPS = 40;
      break;
    case 2: // 低质量
      targetFPS = 30;
      break;
  }

  // 更新帧间隔
  frameInterval = 1000 / targetFPS;
}

// 根据性能模式初始化星星
function initializeStars() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  stars = [];

  // 根据性能模式调整星星数量
  let starCount = props.count;
  if (performanceMode === 1) starCount = Math.floor(props.count * 0.6); // 中等质量降低40%
  if (performanceMode === 2) starCount = Math.floor(props.count * 0.3); // 低质量降低70%

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2 * canvas.width,
      y: (Math.random() - 0.5) * 2 * canvas.height,
      z: Math.random() * canvas.width,
      speed: Math.random() * 5 + 2, // Speed for falling effect
    });
  }
}

function hexToRgb() {
  let hex = props.color.replace(/^#/, "");

  // If the hex code is 3 characters, expand it to 6 characters
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  // Parse the r, g, b values from the hex string
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255; // Extract the red component
  const g = (bigint >> 8) & 255; // Extract the green component
  const b = bigint & 255; // Extract the blue component

  // Return the RGB values as a string separated by spaces
  return {
    r,
    g,
    b,
  };
}

// 修改绘制星星函数，接受自定义context
function drawStarToContext(star: Star, context: CanvasRenderingContext2D) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 使用CSS像素计算位置（除以dpr）
  const canvasWidth = canvas.width / dpr;
  const canvasHeight = canvas.height / dpr;

  const scale = perspective / (perspective + star.z); // 3D perspective scale
  const x2d = canvasWidth / 2 + star.x * scale;
  const y2d = canvasHeight / 2 + star.y * scale;
  const size = Math.max(scale * 2, 0.5); // 减小尺寸

  // Previous position for a trail effect
  const prevScale = perspective / (perspective + star.z + star.speed * 8); // 缩短轨迹长度
  const xPrev = canvasWidth / 2 + star.x * prevScale;
  const yPrev = canvasHeight / 2 + star.y * prevScale;

  const rgb = hexToRgb();

  // 移除模糊轨迹效果和阴影，只绘制一条线
  context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
  context.lineWidth = size;
  context.beginPath();
  context.moveTo(x2d, y2d);
  context.lineTo(xPrev, yPrev);
  context.stroke();

  // Draw the actual star (dot)
  context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
  context.beginPath();
  context.arc(x2d, y2d, size / 4, 0, Math.PI * 2);
  context.fill();
}

// 初始化 Web Worker
function initWorker() {
  starWorker = new Worker(new URL("./starWorker.ts", import.meta.url), {
    type: "module",
  });

  starWorker.onmessage = (e) => {
    if (e.data.type === "update") {
      stars = e.data.stars;
      // console.log("接收到Worker更新：星星数量", stars.length);
    }
  };
}

// 修改 animate 函数
function animate(currentTime = 0) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  requestAnimationFrame(animate);

  if (stars.length === 0) {
    setInitialCanvasSize();
    return;
  }

  const elapsed = currentTime - lastFrameTime;
  if (elapsed < frameInterval) {
    return;
  }

  lastFrameTime = currentTime - (elapsed % frameInterval);

  if (!ctx) {
    ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    if (!ctx) return;
  }

  if (!offscreenCanvas || !offscreenCtx) {
    createOffscreenCanvas();
    if (!offscreenCtx) return;
  }

  const safeOffscreenCanvas = offscreenCanvas as HTMLCanvasElement;
  const safeOffscreenCtx = offscreenCtx as CanvasRenderingContext2D;

  frames++;
  if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
    fps = Math.round((frames * 1000) / (currentTime - lastFpsUpdate));
    console.log(`当前FPS: ${fps}, 性能模式: ${performanceMode}`);
    lastFpsUpdate = currentTime;
    frames = 0;
    adjustPerformance();
  }

  if (needsFullRedraw) {
    safeOffscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    needsFullRedraw = false;
  } else {
    let fadeAlpha = 0.2;
    if (performanceMode === 1) fadeAlpha = 0.15;
    if (performanceMode === 2) fadeAlpha = 0.1;

    safeOffscreenCtx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;
    safeOffscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 发送更新消息给 Worker
  if (starWorker) {
    starWorker.postMessage({ type: "update" });
  } else {
    stars.forEach((star) => {
      const speedFactor = 60 / targetFPS;
      star.z -= star.speed * speedFactor;

      if (star.z <= 0) {
        star.z = canvas.width;
        star.x = (Math.random() - 0.5) * 2 * canvas.width;
        star.y = (Math.random() - 0.5) * 2 * canvas.height;
      }
    });
  }

  // 绘制星星
  stars.forEach((star) => {
    drawStarToContext(star, safeOffscreenCtx);
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(safeOffscreenCanvas, 0, 0);
}

// 根据FPS调整性能模式
function adjustPerformance() {
  // 上次的性能模式
  const prevMode = performanceMode;

  // 如果处于稳定期，不调整性能模式
  if (stabilizationPeriod > 0) {
    stabilizationPeriod--;
    return;
  }

  // 性能提升：如果FPS很高并且当前不是高质量模式，提升质量
  if (fps > 55 && performanceMode > 0) {
    performanceMode--;
    initializeStars();
    updateTargetFPS();
  }

  // 性能下降：如果FPS较低，降低质量
  else if (fps < 30 && performanceMode < 2) {
    performanceMode++;
    initializeStars();
    updateTargetFPS();
  }

  // 如果性能模式改变，标记需要完全重绘
  if (prevMode !== performanceMode) {
    needsFullRedraw = true;
  }
}

// 修改 setInitialCanvasSize 函数
function setInitialCanvasSize() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  const parent = canvas.parentElement;
  if (!parent) return;

  const parentWidth = parent.clientWidth || window.innerWidth;
  const parentHeight = parent.clientHeight || window.innerHeight;

  canvas.style.width = `${parentWidth}px`;
  canvas.style.height = `${parentHeight}px`;

  canvas.width = Math.floor(parentWidth * dpr);
  canvas.height = Math.floor(parentHeight * dpr);

  ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  createOffscreenCanvas();
  perspective = canvas.width / (2 * dpr);
  checkInitialPerformance();
  initializeStars();
  updateTargetFPS();

  try {
    // 初始化 Worker
    if (!starWorker) {
      initWorker();
    }

    // 发送初始化消息给 Worker
    if (starWorker) {
      starWorker.postMessage({
        type: "init",
        data: {
          stars,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          dpr,
          performanceMode,
        },
      });
      console.log("发送初始化消息给Worker：星星数量", stars.length);
    }
  } catch (error) {
    console.error("初始化Worker失败:", error);
    // 如果Worker初始化失败，使用默认方式
    starWorker = null;
  }

  needsFullRedraw = true;
}

// Set canvas to full screen
function resizeCanvas() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  const parent = canvas.parentElement;
  if (!parent) return;

  // 获取父容器实际尺寸
  const parentWidth = parent.clientWidth || window.innerWidth;
  const parentHeight = parent.clientHeight || window.innerHeight;

  // 保存当前的canvas内容
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  if (tempCtx && ctx) {
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);
  }

  // 获取设备像素比
  dpr = window.devicePixelRatio || 1;

  // 设置CSS尺寸
  canvas.style.width = `${parentWidth}px`;
  canvas.style.height = `${parentHeight}px`;

  // 设置Canvas的实际尺寸（物理像素）
  canvas.width = Math.floor(parentWidth * dpr);
  canvas.height = Math.floor(parentHeight * dpr);

  // 获取新的上下文并适应设备像素比
  ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  // 重新绘制之前的内容（如果有）
  if (tempCtx && ctx) {
    ctx.drawImage(
      tempCanvas,
      0,
      0,
      tempCanvas.width,
      tempCanvas.height,
      0,
      0,
      parentWidth,
      parentHeight
    );
  }

  // 重新创建缓存画布
  createOffscreenCanvas();

  // 窗口大小变化时需要完全重绘
  needsFullRedraw = true;
}

// 创建离屏缓存画布
function createOffscreenCanvas() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 创建与主画布相同物理尺寸的离屏画布
  offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  offscreenCtx = offscreenCanvas.getContext("2d");

  // 适应设备像素比
  if (offscreenCtx) {
    offscreenCtx.scale(dpr, dpr);
  }
}
</script>
