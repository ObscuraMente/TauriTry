<template>
  <canvas
    ref="starsCanvas"
    :class="cn('absolute inset-0 w-full h-full', $props.class)"
  ></canvas>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { cn } from "../../../lib/utils";

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

const starsCanvas = ref<HTMLCanvasElement | null>(null);
let perspective: number = 0;
let stars: Star[] = [];
let ctx: CanvasRenderingContext2D | null = null;

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

onMounted(() => {
  setTimeout(() => {
    const canvas = starsCanvas.value;
    if (!canvas) return;

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas(); // Call it initially to set correct size
    createOffscreenCanvas(); // 创建离屏画布

    perspective = canvas.width / 2;
    stars = [];

    // 检测设备性能，根据硬件初始化性能模式
    checkInitialPerformance();

    // 根据当前性能模式初始化星星
    initializeStars();

    // 根据性能模式设置初始帧率
    updateTargetFPS();

    animate(); // Start animation
  }, 1);
});

// 检测设备初始性能并设置合适的性能模式
function checkInitialPerformance() {
  // 移动设备默认使用中等质量
  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  ) {
    performanceMode = 1;
  }

  // 低端设备使用低质量
  if (
    window.navigator.hardwareConcurrency &&
    window.navigator.hardwareConcurrency <= 2
  ) {
    performanceMode = 2;
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

  const scale = perspective / (perspective + star.z); // 3D perspective scale
  const x2d = canvas.width / 2 + star.x * scale;
  const y2d = canvas.height / 2 + star.y * scale;
  const size = Math.max(scale * 2, 0.5); // 减小尺寸

  // Previous position for a trail effect
  const prevScale = perspective / (perspective + star.z + star.speed * 8); // 缩短轨迹长度
  const xPrev = canvas.width / 2 + star.x * prevScale;
  const yPrev = canvas.height / 2 + star.y * prevScale;

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

// Function to animate the stars
function animate(currentTime = 0) {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 请求下一帧动画
  requestAnimationFrame(animate);

  // 帧率限制
  const elapsed = currentTime - lastFrameTime;
  if (elapsed < frameInterval) {
    // 如果距离上一帧的时间小于帧间隔，则跳过这一帧
    return;
  }

  // 更新上一帧时间（使用实际的帧间隔而不是理论值，避免累积误差）
  lastFrameTime = currentTime - (elapsed % frameInterval);

  ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 确保offscreenCanvas和offscreenCtx已经创建
  if (!offscreenCanvas || !offscreenCtx) {
    createOffscreenCanvas();
    if (!offscreenCtx) return;
  }

  // 安全处理：确保offscreenCanvas确实存在
  const safeOffscreenCanvas = offscreenCanvas as HTMLCanvasElement;
  const safeOffscreenCtx = offscreenCtx as CanvasRenderingContext2D;

  // 计算FPS
  frames++;
  if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
    fps = Math.round((frames * 1000) / (currentTime - lastFpsUpdate));
    lastFpsUpdate = currentTime;
    frames = 0;

    // 根据FPS动态调整性能
    adjustPerformance();
  }

  // 如果性能模式改变或初次绘制，执行完全重绘
  if (needsFullRedraw) {
    // 清空离屏画布
    safeOffscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    needsFullRedraw = false;
  } else {
    // 在离屏画布上应用半透明白色层，创建淡出效果而不是完全清除
    // 透明度根据性能模式调整，低性能模式使用更高透明度（更明显的拖尾效果）
    let fadeAlpha = 0.2;
    if (performanceMode === 1) fadeAlpha = 0.15;
    if (performanceMode === 2) fadeAlpha = 0.1;

    safeOffscreenCtx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;
    safeOffscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 在离屏画布上绘制所有星星
  stars.forEach((star) => {
    // 使用offscreenCtx而不是ctx
    drawStarToContext(star, safeOffscreenCtx);

    // Move star towards the screen (decrease z)
    // 根据帧率调整移动速度，保持视觉一致性
    const speedFactor = 60 / targetFPS;
    star.z -= star.speed * speedFactor;

    // Reset star when it reaches the viewer (z = 0)
    if (star.z <= 0) {
      star.z = canvas.width;
      star.x = (Math.random() - 0.5) * 2 * canvas.width;
      star.y = (Math.random() - 0.5) * 2 * canvas.height;
    }
  });

  // 清空主画布并将离屏画布内容复制到主画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(safeOffscreenCanvas, 0, 0);
}

// 根据FPS调整性能模式
function adjustPerformance() {
  // 上次的性能模式
  const prevMode = performanceMode;

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

// Set canvas to full screen
function resizeCanvas() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  // 重新创建缓存画布
  createOffscreenCanvas();

  // 窗口大小变化时需要完全重绘
  needsFullRedraw = true;
}

// 创建离屏缓存画布
function createOffscreenCanvas() {
  const canvas = starsCanvas.value;
  if (!canvas) return;

  // 创建与主画布相同大小的离屏画布
  offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  offscreenCtx = offscreenCanvas.getContext("2d");
}
</script>
