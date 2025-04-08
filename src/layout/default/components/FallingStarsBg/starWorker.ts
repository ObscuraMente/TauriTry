interface Star {
  x: number;
  y: number;
  z: number;
  speed: number;
}

interface WorkerMessage {
  type: "init" | "update";
  data?: {
    stars: Star[];
    canvasWidth: number;
    canvasHeight: number;
    dpr: number;
    performanceMode: number;
  };
}

let stars: Star[] = [];
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;
let performanceMode = 0;

// 初始化星星
function initializeStars(count: number) {
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2 * canvasWidth,
      y: (Math.random() - 0.5) * 2 * canvasHeight,
      z: Math.random() * canvasWidth,
      speed: Math.random() * 5 + 2,
    });
  }
}

// 更新星星位置
function updateStars() {
  const speedFactor =
    60 / (performanceMode === 0 ? 60 : performanceMode === 1 ? 40 : 30);

  stars.forEach((star) => {
    star.z -= star.speed * speedFactor;

    if (star.z <= 0) {
      star.z = canvasWidth;
      star.x = (Math.random() - 0.5) * 2 * canvasWidth;
      star.y = (Math.random() - 0.5) * 2 * canvasHeight;
    }
  });

  return stars;
}

// 监听主线程消息
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, data } = e.data;

  if (type === "init" && data) {
    canvasWidth = data.canvasWidth;
    canvasHeight = data.canvasHeight;
    dpr = data.dpr;
    performanceMode = data.performanceMode;
    initializeStars(data.stars.length);
  } else if (type === "update") {
    const updatedStars = updateStars();
    self.postMessage({ type: "update", stars: updatedStars });
  }
};
