import { Star } from './types';

// 定义Worker配置接口
export interface WorkerConfig {
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

/**
 * 初始化优化的 Web Worker
 */
export function initWorker(
  onStarsUpdate: (stars: Star[]) => void
): Worker | null {
  try {
    const starWorker = new Worker(new URL("./optimizedStarWorker.ts", import.meta.url), {
      type: "module",
    });

    // 定义Worker消息类型
    interface WorkerUpdateMessage {
      type: "update";
      stars: Star[];
    }

    starWorker.onmessage = (e: MessageEvent<WorkerUpdateMessage>) => {
      if (e.data.type === "update") {
        // 更新星星数组
        onStarsUpdate(e.data.stars || []);
      }
    };

    return starWorker;
  } catch (error) {
    console.error("初始化Worker失败:", error);
    return null;
  }
}

/**
 * 发送初始化消息给Worker
 */
export function initializeWorker(
  worker: Worker,
  config: WorkerConfig
): void {
  // 定义初始化消息类型
  interface InitMessage {
    type: "init";
    config: WorkerConfig;
  }

  const message: InitMessage = {
    type: "init",
    config
  };

  worker.postMessage(message);
}

/**
 * 更新Worker配置
 */
export function updateWorkerConfig(
  worker: Worker | null,
  performanceMode: number,
  targetFPS: number
): void {
  if (worker) {
    // 定义发送给Worker的消息类型
    interface UpdateConfigMessage {
      type: "updateConfig";
      config: {
        performanceMode: number;
        targetFPS: number;
      };
    }

    const message: UpdateConfigMessage = {
      type: "updateConfig",
      config: {
        performanceMode,
        targetFPS
      }
    };

    worker.postMessage(message);
  }
}

/**
 * 更新Worker画布大小
 */
export function updateWorkerCanvasSize(
  worker: Worker | null,
  width: number,
  height: number
): void {
  if (worker) {
    // 定义画布大小更新消息类型
    interface UpdateCanvasSizeMessage {
      type: "updateCanvasSize";
      canvasSize: {
        width: number;
        height: number;
      };
    }

    const message: UpdateCanvasSizeMessage = {
      type: "updateCanvasSize",
      canvasSize: {
        width,
        height
      }
    };

    worker.postMessage(message);
  }
}

/**
 * 暂停Worker
 */
export function pauseWorker(worker: Worker | null): void {
  if (worker) {
    worker.postMessage({ type: "pause" });
  }
}

/**
 * 恢复Worker
 */
export function resumeWorker(worker: Worker | null): void {
  if (worker) {
    worker.postMessage({ type: "resume" });
  }
}
