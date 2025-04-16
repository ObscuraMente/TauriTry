import { Star, RGBColor } from './types';
import { hexToRgb, parseColor } from './utils';
import { drawSnowflake, drawSakura, drawLeaf } from './effectRenderer';

/**
 * 绘制星星到指定上下文
 */
export function drawStarToContext(
  star: Star, 
  context: CanvasRenderingContext2D, 
  rgbColor?: RGBColor,
  perspective: number = 400
) {
  const canvas = context.canvas;
  if (!canvas) return;

  // 使用CSS像素计算位置（除以dpr）
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = canvas.width / dpr;
  const canvasHeight = canvas.height / dpr;

  // 计算透视效果
  const scale = perspective / (perspective + star.z);
  const x2d = canvasWidth / 2 + star.x * scale;
  const y2d = canvasHeight / 2 + star.y * scale;

  // 视口裁剪优化 - 检查星星是否在视口内
  // 添加缓冲区，确保轨迹线也能正确显示
  const bufferSize = 50; // 缓冲区大小，单位像素
  if (x2d < -bufferSize || x2d > canvasWidth + bufferSize ||
      y2d < -bufferSize || y2d > canvasHeight + bufferSize) {
    return; // 如果星星在视口外，不绘制
  }

  // 根据距离计算大小，并考虑自定义大小
  // 对于灰色星星在白色背景上，增大星星尺寸使其更粗
  const baseSize = star.size || 2.5; // 增大基础尺寸
  const size = Math.max(scale * 1.1 * baseSize, 3.5); // 增大缩放因子和最小尺寸

  // 计算轨迹效果的前一个位置
  const prevScale = perspective / (perspective + star.z + star.speed * 8);
  const xPrev = canvasWidth / 2 + star.x * prevScale;
  const yPrev = canvasHeight / 2 + star.y * prevScale;

  // 使用传入的RGB值或计算新的
  const rgb = rgbColor || hexToRgb();

  // 计算不透明度，考虑自定义不透明度和距离
  // 对于灰色星星在白色背景上，降低不透明度使其更加柔和
  let opacity = star.opacity || 0.6;
  const distanceOpacity = Math.min(1, scale * 1.2); // 降低远处星星的可见度

  // 如果星星有闪烁属性，计算闪烁效果
  if (star.twinkle) {
    const time = performance.now() / 1000; // 转换为秒
    const twinkleOffset = star.twinkleOffset || 0;
    const twinkleSpeed = star.twinkleSpeed || 0.02;

    // 使用正弦波计算闪烁因子 (0.7 - 1.0 范围内变化)
    const twinkleFactor = 0.7 + 0.3 * Math.sin(time * twinkleSpeed * Math.PI * 2 + twinkleOffset);
    opacity *= twinkleFactor;
  }

  // 特殊效果星星的处理
  if (star.specialEffect) {
    // 如果是特殊效果星星，使用自定义颜色
    if (star.color) {
      // 解析颜色字符串为RGB值
      const color = parseColor(star.color);
      if (color) {
        rgb.r = color.r;
        rgb.g = color.g;
        rgb.b = color.b;
      }
    }
  }

  // 绘制轨迹线 - 进一步减小线条粗细和不透明度
  context.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * distanceOpacity * 0.4})`; // 降低不透明度
  context.lineWidth = size * 0.4; // 显著减小线条粗细
  context.beginPath();
  context.moveTo(x2d, y2d);
  context.lineTo(xPrev, yPrev);
  context.stroke();

  // 绘制星星点 - 增强视觉效果
  if (star.specialEffect) {
    // 特殊效果星星的绘制
    context.save();

    // 应用旋转效果（如果有）
    if (star.rotation !== undefined) {
      // 移动到星星位置
      context.translate(x2d, y2d);
      // 旋转
      context.rotate(star.rotation);
      // 重置原点
      context.translate(-x2d, -y2d);
    }

    // 根据特效类型绘制不同形状
    switch(star.specialEffect) {
      case 'snowflake':
        // 绘制雪花
        drawSnowflake(context, x2d, y2d, size, opacity * distanceOpacity, rgb);
        break;
      case 'sakura':
        // 绘制樱花
        drawSakura(context, x2d, y2d, size, opacity * distanceOpacity, rgb);
        break;
      case 'leaf':
        // 绘制叶子
        drawLeaf(context, x2d, y2d, size, opacity * distanceOpacity, rgb);
        break;
      case 'meteor':
        // 流星特效已移除，使用更小的普通星星代替
        context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * distanceOpacity * 0.9})`;
        context.beginPath();
        context.arc(x2d, y2d, size / 2.5, 0, Math.PI * 2); // 增大半径
        context.fill();
        break;
      default:
        // 默认圆形 - 使用更大的半径和增强不透明度
        context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * distanceOpacity * 0.9})`;
        context.beginPath();
        context.arc(x2d, y2d, size / 2.5, 0, Math.PI * 2); // 增大半径
        context.fill();
    }

    context.restore();
  } else {
    // 普通星星的绘制 - 移除光晕效果，使用简单的圆形
    // 增强不透明度和增大星星大小
    context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * distanceOpacity * 0.9})`;
    context.beginPath();
    context.arc(x2d, y2d, size / 2.5, 0, Math.PI * 2); // 增大星星点的半径
    context.fill();
  }
}
