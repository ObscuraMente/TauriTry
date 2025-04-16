import { detectDeviceType } from './utils';

/**
 * 检测设备初始性能并设置合适的性能模式
 */
export function checkInitialPerformance(): number {
  // 检测设备性能
  let performanceMode = 0; // 默认高质量

  const { isMobile, isLowEndDevice, memory } = detectDeviceType();

  // 移动设备检测
  if (isMobile) {
    performanceMode = 1; // 移动设备使用中等质量
  }

  // 低端设备检测
  if (isLowEndDevice) {
    performanceMode = 2; // 低端设备使用低质量
  }

  // 检测内存限制
  if (memory && memory <= 2) {
    performanceMode = Math.max(performanceMode, 1); // 内存低于2GB的设备至少使用中等质量
  }

  // 检测是否使用电池
  // 使用类型断言解决电池API的类型问题
  const nav = navigator as any;
  if (nav.getBattery) {
    nav.getBattery().then((battery: any) => {
      if (!battery.charging && battery.level < 0.3) {
        // 如果电量低于30%且没有充电，降低质量以节省电量
        performanceMode = Math.max(performanceMode, 1);
      }
    }).catch(() => {
      // 如果无法获取电池信息，忽略错误
    });
  }

  return performanceMode;
}

/**
 * 根据性能模式更新目标帧率
 */
export function updateTargetFPS(performanceMode: number, starCount: number): number {
  // 获取设备信息以更精确地调整帧率
  const { isMobile, isLowEndDevice, isHighResolution, memory } = detectDeviceType();

  // 根据性能模式调整帧率
  let targetFPS = 60; // 默认值

  switch (performanceMode) {
    case 0: // 高质量
      if (isHighResolution && memory <= 4) {
        // 高分辨率低内存设备
        targetFPS = 50;
      } else if (isMobile) {
        // 移动设备
        targetFPS = 45;
      } else if (starCount > 200) {
        // 星星数量较多
        targetFPS = 50;
      } else {
        // 标准高质量
        targetFPS = 60;
      }
      break;

    case 1: // 中等质量
      if (isMobile || isHighResolution) {
        // 移动设备或高分辨率
        targetFPS = 30;
      } else if (isLowEndDevice) {
        // 低端设备
        targetFPS = 30;
      } else {
        // 标准中等质量
        targetFPS = 40;
      }
      break;

    case 2: // 低质量
      if (isMobile && isLowEndDevice) {
        // 低端移动设备
        targetFPS = 20;
      } else {
        // 标准低质量
        targetFPS = 30;
      }
      break;
  }

  // 仅在开发环境输出日志
  if (process.env.NODE_ENV === 'development') {
    console.log(`更新目标帧率: ${targetFPS}FPS, 性能模式: ${performanceMode}`);
  }

  return targetFPS;
}

/**
 * 根据FPS调整性能模式
 */
export function adjustPerformance(
  fps: number, 
  performanceMode: number, 
  stabilizationPeriod: number,
  fpsHistory: number[]
): {
  newPerformanceMode: number;
  newStabilizationPeriod: number;
  needsFullRedraw: boolean;
} {
  // 上次的性能模式
  const prevMode = performanceMode;
  let newPerformanceMode = performanceMode;
  let newStabilizationPeriod = stabilizationPeriod;
  let needsFullRedraw = false;

  // 如果处于稳定期，不调整性能模式
  if (stabilizationPeriod > 0) {
    newStabilizationPeriod--;
    return { 
      newPerformanceMode, 
      newStabilizationPeriod, 
      needsFullRedraw 
    };
  }

  // 确保有足够的样本进行决策
  if (fpsHistory.length < 3) {
    return { 
      newPerformanceMode, 
      newStabilizationPeriod, 
      needsFullRedraw 
    };
  }

  // 性能提升：如果FPS持续很高并且当前不是高质量模式
  if (fps > 55 && performanceMode > 0) {
    newPerformanceMode--;
    if (process.env.NODE_ENV === 'development') {
      console.log(`性能足够好，提升质量到模式 ${newPerformanceMode}`);
    }
  }
  // 性能下降：如果FPS持续较低，降低质量
  else if (fps < 30 && performanceMode < 2) {
    newPerformanceMode++;
    if (process.env.NODE_ENV === 'development') {
      console.log(`性能不足，降低质量到模式 ${newPerformanceMode}`);
    }
  }

  // 如果性能模式改变，标记需要完全重绘
  if (prevMode !== newPerformanceMode) {
    needsFullRedraw = true;
  }

  return {
    newPerformanceMode,
    newStabilizationPeriod,
    needsFullRedraw
  };
}
