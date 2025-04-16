// 星星接口定义
export interface Star {
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
  // 速度属性用于抖动效果
  velocityX?: number;
  velocityY?: number;
  // 特殊效果属性
  specialEffect?: string; // 特殊效果类型：'snowflake', 'sakura', 'leaf', 'star'
  rotation?: number;     // 旋转角度
  rotationSpeed?: number; // 旋转速度
  color?: string;        // 特殊颜色
}

// 导入Worker配置接口
import type { WorkerConfig } from './workerManager';
// 重新导出接口
export type { WorkerConfig };

// 组件属性接口
export interface FallingStarsBgProps {
  color?: string;
  count?: number;
  class?: string;
}

// RGB颜色接口
export interface RGBColor {
  r: number;
  g: number;
  b: number;
}
