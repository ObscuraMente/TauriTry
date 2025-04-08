const animate = () => { if (!canvas.value || !ctx.value) return; // 清除画布
ctx.value.clearRect(0, 0, canvas.value.width, canvas.value.height); //
只在星星位置发生变化时才发送更新请求 if (starWorker.value) {
starWorker.value.postMessage({ type: "update", timestamp: Date.now(),
performanceMode: isPerformanceMode.value }); } else { // 如果没有
Worker，在主线程更新星星 updateStars(); } // 绘制星星 drawStars(); // 使用
requestAnimationFrame 控制帧率 animationFrameId =
requestAnimationFrame(animate); }; // 修改 Worker 消息处理 const
handleWorkerMessage = (event: MessageEvent) => { const { type, data } =
event.data; if (type === "update") { // 只在星星数据发生变化时更新 if
(JSON.stringify(stars.value) !== JSON.stringify(data)) { stars.value = data; } }
};
