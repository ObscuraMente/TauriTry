// 定义星星接口
interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
  size?: number;
  opacity?: number;
  // 闪烁相关属性
  twinkle?: boolean;
  twinkleSpeed?: number;
  twinkleOffset?: number;
  // 抖动相关属性
  jitter?: boolean;
  jitterAmount?: number;
  // 原始位置属性，用于恢复抖动
  originalX?: number;
  originalY?: number;
  // 特效相关属性
  specialEffect?: string; // 特效类型：'snowflake', 'sakura', 'leaf'
  rotation?: number; // 旋转角度
  rotationSpeed?: number; // 旋转速度
  color?: string; // 特效颜色
}

// 定义配置接口
interface WorkerConfig {
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  performanceMode: number;
  starCount: number;
  targetFPS: number;
  perspective: number;
  season?: string; // 添加季节信息
  specialEffectType?: string; // 添加特效类型
  specialEffectRatio?: number; // 添加特效比例
}

// 定义接收消息的类型
type IncomingMessageType =
  | { type: "init"; config: WorkerConfig }
  | { type: "updateConfig"; config: Partial<WorkerConfig> }
  | { type: "updatePerformanceMode"; performanceMode: number }
  | { type: "updateTargetFPS"; targetFPS: number }
  | { type: "updateCanvasSize"; canvasSize: { width: number; height: number } }
  | { type: "pause" }
  | { type: "resume" };

// 定义发送消息的类型
type OutgoingMessageType = {
  type: "update";
  stars: Star[];
};

// 状态变量
let starsArray: Star[] = []; // 使用let而不是const，允许重新分配
let config: WorkerConfig = {
  canvasWidth: 800,
  canvasHeight: 600,
  dpr: 1,
  performanceMode: 0,
  starCount: 100,
  targetFPS: 60,
  perspective: 400,
};

// 上次更新时间，用于计算增量时间
let lastUpdateTime = performance.now();
let updateInterval: number | null = null;

// 初始化星星
function initializeOptimizedStars() {
  const { canvasWidth, canvasHeight, starCount, performanceMode } = config;
  starsArray.length = 0;

  // 根据性能模式调整星星数量
  let actualStarCount = starCount;
  if (performanceMode === 1) actualStarCount = Math.floor(starCount * 0.7);
  if (performanceMode === 2) actualStarCount = Math.floor(starCount * 0.4);

  // 预先分配数组空间，避免动态扩容
  starsArray = new Array(actualStarCount);

  // 创建不同类型的星星
  for (let i = 0; i < actualStarCount; i++) {
    // 使用更高效的随机数生成
    const starType = Math.random();
    let size, opacity, speed;

    // 使用更简化的星星类型分配
    if (starType < 0.7) {
      // 70% 普通星星 - 增大星星大小
      size = Math.random() * 0.6 + 1.0; // 增大星星大小
      opacity = Math.random() * 0.3 + 0.5;
      speed = Math.random() * 4 + 2;
    } else if (starType < 0.9) {
      // 20% 中等星星
      size = Math.random() * 0.8 + 1.2; // 增大星星大小
      opacity = Math.random() * 0.3 + 0.6;
      speed = Math.random() * 3 + 1.5;
    } else {
      // 10% 大星星
      size = Math.random() * 1.0 + 1.5; // 增大星星大小
      opacity = Math.random() * 0.2 + 0.7;
      speed = Math.random() * 2 + 1;
    }

    // 添加闪烁属性 - 减少闪烁星星比例
    const twinkle = Math.random() > 0.8; // 20% 的星星会闪烁
    const twinkleSpeed = Math.random() * 0.02 + 0.01; // 降低闪烁速度

    // 添加抖动属性 - 减少抖动星星比例
    const jitter = Math.random() > 0.8; // 20% 的星星有抖动
    const jitterAmount = Math.random() * 0.3 + 0.1; // 减小抖动幅度

    // 初始化星星位置
    const x = (Math.random() - 0.5) * 2 * canvasWidth;
    const y = (Math.random() - 0.5) * 2 * canvasHeight;

    // 随机决定是否为特效星星
    // 在Worker中我们不处理特效类型，这将由主线程处理
    // 但我们需要保留特效相关属性，以便主线程能正确处理

    // 根据季节和特效比例决定特效类型
    const effectRandom = Math.random();
    let specialEffect = undefined;

    // 使用配置中的特效比例，如果没有则使用默认值 0.25
    const effectRatio =
      config.specialEffectRatio !== undefined
        ? config.specialEffectRatio
        : 0.25;

    if (effectRandom < effectRatio) {
      // 使用配置中的特效类型，如果没有则根据季节决定
      if (config.specialEffectType) {
        specialEffect = config.specialEffectType;
      } else if (config.season === "winter") {
        specialEffect = "snowflake";
      } else if (config.season === "spring") {
        specialEffect = "sakura";
      } else if (config.season === "autumn") {
        specialEffect = "leaf";
      }
    }

    let rotation = undefined;
    let rotationSpeed = undefined;
    let color = undefined;

    if (specialEffect) {
      rotation = Math.random() * Math.PI * 2; // 随机初始旋转角度
      rotationSpeed =
        (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1); // 随机旋转速度和方向

      // 根据特效类型设置颜色
      if (specialEffect === "sakura") {
        // 樱花粉色色调
        const pinkHue = Math.floor(Math.random() * 20) + 340; // 340-360 或 0-20 的色相
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 70; // 70-90% 亮度
        color = `hsl(${pinkHue}, ${saturation}%, ${lightness}%)`;
      } else if (specialEffect === "snowflake") {
        // 在白色背景上使用淡蓝色雪花，增强可见度
        color = "#A5D8FF"; // 淡蓝色雪花
      } else if (specialEffect === "leaf") {
        // 秋叶色调 - 使用更鲜艳的秋叶颜色
        const leafHues = [30, 40, 50, 20, 10, 15, 25]; // 黄色、橙色、红色色相
        const hue = leafHues[Math.floor(Math.random() * leafHues.length)];
        const saturation = Math.floor(Math.random() * 30) + 70; // 70-100% 饱和度
        const lightness = Math.floor(Math.random() * 20) + 40; // 40-60% 亮度
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        // 增大叶子的尺寸
        size = size * 1.5; // 叶子特效需要更大的尺寸
      }
    }

    starsArray[i] = {
      x,
      y,
      z: Math.random() * canvasWidth,
      speed,
      size,
      opacity,
      twinkle,
      twinkleSpeed,
      twinkleOffset: Math.random() * Math.PI * 2, // 随机相位，使得星星不同时闪烁
      jitter,
      jitterAmount,
      originalX: x,
      originalY: y,
      specialEffect,
      rotation,
      rotationSpeed,
      color,
    };
  }
}

// 更新星星位置
function updateOptimizedStars(deltaTime: number) {
  const { canvasWidth, canvasHeight } = config;

  // 使用实际的时间增量来计算移动，确保在不同帧率下移动速度一致
  const timeScale = deltaTime / (1000 / 60); // 标准化到60FPS
  const currentTime = performance.now() / 1000; // 当前时间（秒）

  // 使用for循环代替forEach，提高性能
  const len = starsArray.length;
  for (let i = 0; i < len; i++) {
    const star = starsArray[i];

    // 使用时间增量计算移动距离，确保在不同帧率下移动速度一致
    star.z -= star.speed * timeScale;

    // 如果星星超出视野，重置位置
    if (star.z <= 0) {
      star.z = canvasWidth;

      // 初始化新位置
      const x = (Math.random() - 0.5) * 2 * canvasWidth;
      const y = (Math.random() - 0.5) * 2 * canvasHeight;
      star.x = x;
      star.y = y;
      star.originalX = x;
      star.originalY = y;

      // 随机决定新的属性 - 使用更粗的星星尺寸
      star.opacity = Math.random() * 0.5 + 0.5;
      star.size = Math.random() * 1.0 + 1.0; // 增大星星大小

      // 随机决定是否添加闪烁和抖动效果 - 减少特效比例
      // 对于叶子，不添加闪烁效果
      if (star.specialEffect === "leaf") {
        star.twinkle = false; // 叶子不闪烁
        star.opacity = 0.9; // 固定的不透明度
      } else {
        star.twinkle = Math.random() > 0.8; // 减少闪烁星星比例
        star.twinkleSpeed = Math.random() * 0.02 + 0.01; // 降低闪烁速度
        star.twinkleOffset = Math.random() * Math.PI * 2;
      }

      // 对于叶子，使用更小的抖动幅度
      if (star.specialEffect === "leaf") {
        star.jitter = true; // 叶子始终有轻微抖动，模拟风吹效果
        star.jitterAmount = 0.05; // 使用固定的抖动幅度，避免随机性
      } else {
        star.jitter = Math.random() > 0.8; // 减少抖动星星比例
        star.jitterAmount = Math.random() * 0.3 + 0.1; // 正常抖动幅度
      }
    }

    // 使用条件分支优化，减少不必要的计算
    // 如果星星有闪烁属性，计算闪烁效果
    // 但对于叶子特效，不应用闪烁效果
    if (star.twinkle && star.twinkleSpeed && star.specialEffect !== "leaf") {
      // 使用更高效的正弦计算
      const twinkleFactor =
        0.8 +
        0.2 *
          Math.sin(
            currentTime * star.twinkleSpeed * Math.PI * 2 +
              (star.twinkleOffset || 0)
          );
      star.opacity = (star.opacity || 0.6) * twinkleFactor;
    } else if (star.specialEffect === "leaf") {
      // 对于叶子，使用固定的不透明度，避免闪烁
      star.opacity = 0.9;
    }

    // 如果星星有抖动属性，计算抖动效果
    if (
      star.jitter &&
      star.originalX !== undefined &&
      star.originalY !== undefined
    ) {
      const jitterAmount = star.jitterAmount || 0.2;

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
        const jitterX = Math.sin(currentTime * 2.0 + star.z) * jitterAmount;
        const jitterY =
          Math.cos(currentTime * 1.7 + star.z * 0.5) * jitterAmount;

        // 应用抖动效果
        star.x = star.originalX + jitterX;
        star.y = star.originalY + jitterY;
      }
    }

    // 如果星星有旋转属性，更新旋转角度
    if (star.rotationSpeed !== undefined && star.rotation !== undefined) {
      star.rotation += star.rotationSpeed * timeScale;
      // 保持旋转角度在 0-2π 范围内
      if (star.rotation > Math.PI * 2) {
        star.rotation -= Math.PI * 2;
      } else if (star.rotation < 0) {
        star.rotation += Math.PI * 2;
      }
    }
  }

  return starsArray;
}

// 开始定时更新
function startUpdateLoop() {
  if (updateInterval !== null) {
    clearInterval(updateInterval);
  }

  // 根据目标帧率设置更新间隔
  const interval = Math.max(1000 / config.targetFPS, 16); // 最小16ms (约60fps)

  updateInterval = setInterval(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastUpdateTime;
    lastUpdateTime = currentTime;

    const updatedStars = updateOptimizedStars(deltaTime);
    const message: OutgoingMessageType = {
      type: "update",
      stars: updatedStars,
    };
    self.postMessage(message);
  }, interval) as unknown as number;
}

// 更新配置
function updateConfig(newConfig: Partial<WorkerConfig>) {
  const oldPerformanceMode = config.performanceMode;
  const oldTargetFPS = config.targetFPS;

  // 更新配置
  config = { ...config, ...newConfig };

  // 如果性能模式改变，重新初始化星星
  if (
    newConfig.performanceMode !== undefined &&
    newConfig.performanceMode !== oldPerformanceMode
  ) {
    initializeOptimizedStars();
  }

  // 如果目标帧率改变，重新启动更新循环
  if (
    newConfig.targetFPS !== undefined &&
    newConfig.targetFPS !== oldTargetFPS
  ) {
    startUpdateLoop();
  }
}

// 更新画布大小
function updateCanvasSize(width: number, height: number) {
  config.canvasWidth = width;
  config.canvasHeight = height;
  config.perspective = width / 2;

  // 重新初始化星星以适应新的画布大小
  initializeOptimizedStars();
}

// 监听主线程消息
self.onmessage = (e: MessageEvent<IncomingMessageType>) => {
  const message = e.data;

  switch (message.type) {
    case "init":
      config = message.config;
      lastUpdateTime = performance.now();
      initializeOptimizedStars();
      startUpdateLoop();
      break;

    case "updateConfig":
      updateConfig(message.config);
      break;

    case "updatePerformanceMode":
      updateConfig({ performanceMode: message.performanceMode });
      break;

    case "updateTargetFPS":
      updateConfig({ targetFPS: message.targetFPS });
      break;

    case "updateCanvasSize":
      updateCanvasSize(message.canvasSize.width, message.canvasSize.height);
      break;

    case "pause":
      if (updateInterval !== null) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
      break;

    case "resume":
      if (updateInterval === null) {
        lastUpdateTime = performance.now();
        startUpdateLoop();
      }
      break;
  }
};
