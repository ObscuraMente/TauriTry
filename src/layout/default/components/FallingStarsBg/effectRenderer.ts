/**
 * 绘制雪花
 */
export function drawSnowflake(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
) {
  // 增大雪花尺寸，使其更加明显
  const armLength = size * 1.8; // 增大臂长
  const armCount = 6; // 六边形雪花

  // 在白色背景上使用淡蓝色雪花，增强可见度
  // 即使传入的是其他颜色，也强制使用淡蓝色
  context.strokeStyle = `rgba(165, 216, 255, ${opacity * 1.5})`; // 使用淡蓝色(#A5D8FF)并增强不透明度
  context.lineWidth = size / 4; // 进一步增大线条粗细

  // 绘制雪花主干
  for (let i = 0; i < armCount; i++) {
    const angle = ((Math.PI * 2) / armCount) * i;
    const endX = x + Math.cos(angle) * armLength;
    const endY = y + Math.sin(angle) * armLength;

    // 绘制主干
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(endX, endY);
    context.stroke();

    // 绘制分支 - 增加更多分支
    const branchLength = armLength * 0.5; // 增大分支长度
    const branchAngle1 = angle + Math.PI / 4;
    const branchAngle2 = angle - Math.PI / 4;

    // 分支起点，从主干中间开始
    const branchStartX = x + Math.cos(angle) * (armLength * 0.5);
    const branchStartY = y + Math.sin(angle) * (armLength * 0.5);

    // 绘制第一个分支
    context.beginPath();
    context.moveTo(branchStartX, branchStartY);
    context.lineTo(
      branchStartX + Math.cos(branchAngle1) * branchLength,
      branchStartY + Math.sin(branchAngle1) * branchLength,
    );
    context.stroke();

    // 绘制第二个分支
    context.beginPath();
    context.moveTo(branchStartX, branchStartY);
    context.lineTo(
      branchStartX + Math.cos(branchAngle2) * branchLength,
      branchStartY + Math.sin(branchAngle2) * branchLength,
    );
    context.stroke();

    // 添加二级分支
    const secondBranchLength = branchLength * 0.6;

    // 第一个分支的终点
    const branch1EndX = branchStartX + Math.cos(branchAngle1) * branchLength;
    const branch1EndY = branchStartY + Math.sin(branchAngle1) * branchLength;

    // 第二个分支的终点
    const branch2EndX = branchStartX + Math.cos(branchAngle2) * branchLength;
    const branch2EndY = branchStartY + Math.sin(branchAngle2) * branchLength;

    // 为第一个分支添加二级分支
    context.beginPath();
    context.moveTo(branch1EndX, branch1EndY);
    context.lineTo(
      branch1EndX + Math.cos(branchAngle1) * secondBranchLength * 0.7,
      branch1EndY + Math.sin(branchAngle1) * secondBranchLength * 0.7,
    );
    context.stroke();

    // 为第二个分支添加二级分支
    context.beginPath();
    context.moveTo(branch2EndX, branch2EndY);
    context.lineTo(
      branch2EndX + Math.cos(branchAngle2) * secondBranchLength * 0.7,
      branch2EndY + Math.sin(branchAngle2) * secondBranchLength * 0.7,
    );
    context.stroke();
  }

  // 绘制中心圆
  context.fillStyle = `rgba(165, 216, 255, ${opacity * 1.5})`; // 使用淡蓝色(#A5D8FF)并增强不透明度
  context.beginPath();
  context.arc(x, y, size / 2.5, 0, Math.PI * 2); // 增大中心圆大小
  context.fill();

  // 添加深色边框，增强可见度
  context.strokeStyle = `rgba(125, 176, 215, ${opacity * 1.2})`; // 使用更深的淡蓝色
  context.lineWidth = size / 10;
  context.beginPath();
  context.arc(x, y, size / 2.5, 0, Math.PI * 2);
  context.stroke();

  // 添加浅色光晕效果
  context.fillStyle = `rgba(200, 230, 255, ${opacity * 0.2})`; // 使用浅淡蓝色光晕
  context.beginPath();
  context.arc(x, y, size * 0.8, 0, Math.PI * 2);
  context.fill();
}

/**
 * 绘制樱花
 */
export function drawSakura(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
) {
  // 增大樱花尺寸，使其更加明显
  const petalCount = 5; // 五片花瓣
  const petalLength = size * 1.8; // 增大花瓣长度
  const petalWidth = size * 0.9; // 增大花瓣宽度

  // 使用樱花粉色，而不是使用黑色
  // 即使传入的是黑色，也强制使用粉色
  context.fillStyle = `rgba(255, 182, 193, ${opacity * 1.2})`; // 使用淡粉色并增强不透明度

  // 绘制花瓣
  for (let i = 0; i < petalCount; i++) {
    const angle = ((Math.PI * 2) / petalCount) * i;

    context.save();
    context.translate(x, y);
    context.rotate(angle);

    // 绘制更精细的花瓣形状
    context.beginPath();
    context.moveTo(0, 0);

    // 使用更复杂的路径创建更真实的樱花形状
    context.bezierCurveTo(
      petalWidth * 0.4,
      petalLength * 0.3,
      petalWidth * 0.5,
      petalLength * 0.7,
      0,
      petalLength,
    );
    context.bezierCurveTo(
      -petalWidth * 0.5,
      petalLength * 0.7,
      -petalWidth * 0.4,
      petalLength * 0.3,
      0,
      0,
    );

    context.fill();

    // 添加花瓣纹理
    context.strokeStyle = `rgba(255, 150, 180, ${opacity * 0.8})`;
    context.lineWidth = size * 0.05;
    context.beginPath();
    context.moveTo(0, petalLength * 0.2);
    context.lineTo(0, petalLength * 0.8);
    context.stroke();

    context.restore();
  }

  // 绘制中心圆
  context.fillStyle = `rgba(255, 220, 100, ${opacity * 1.2})`; // 增强黄色花心
  context.beginPath();
  context.arc(x, y, size * 0.4, 0, Math.PI * 2); // 增大花心尺寸
  context.fill();

  // 添加花心边缘
  context.strokeStyle = `rgba(255, 180, 100, ${opacity})`;
  context.lineWidth = size * 0.1;
  context.beginPath();
  context.arc(x, y, size * 0.4, 0, Math.PI * 2);
  context.stroke();
}

/**
 * 绘制叶子
 */
export function drawLeaf(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
) {
  // 简化位置坐标计算
  const posX = Math.round(x);
  const posY = Math.round(y);

  // 叶子尺寸
  const leafLength = size * 4;
  const leafWidth = size * 2;

  // 颜色设置 - 使用秋季色系（红橙黄）
  // 随机选择一种秋季颜色，基于位置确保同一位置总是相同颜色
  const autumnColors = [
    `rgba(232, 137, 0, ${opacity})`, // 橙色
    `rgba(210, 105, 30, ${opacity})`, // 巧克力色
    `rgba(178, 80, 0, ${opacity})`, // 深橙色
    `rgba(204, 85, 0, ${opacity})`, // 燃烧的橙色
    `rgba(165, 42, 42, ${opacity})`, // 棕色
  ];
  const colorIndex = Math.abs(
    Math.floor((posX * 13 + posY * 17) % autumnColors.length),
  );
  const fillColor = autumnColors[colorIndex];
  const strokeColor = `rgba(139, 69, 19, ${opacity * 1.2})`; // 深棕色
  const veinColor = `rgba(86, 46, 13, ${opacity * 0.9})`; // 暗棕色

  // 保存状态
  context.save();

  // 固定旋转角度，与位置相关但几乎不旋转
  // 使用非常小的角度基数，使叶子几乎不旋转
  const angleBase = ((Math.PI / 30) * ((posX * posY) % 10)) / 10; // 大幅减小基本角度

  // 使用很小的正弦与余弦变化混合，并增大周期
  const rotation =
    angleBase + (Math.PI / 60) * (Math.sin(posX / 800) + Math.cos(posY / 800));

  // 应用变换
  context.translate(posX, posY);
  context.rotate(rotation);

  // 绘制叶子主体 - 使用更自然的形状
  context.beginPath();

  // 叶子的起点（叶柄连接处）
  context.moveTo(0, leafLength * 0.3);

  // 右侧曲线
  context.bezierCurveTo(
    leafWidth * 0.8,
    leafLength * 0.1, // 控制点1
    leafWidth * 0.7,
    -leafLength * 0.3, // 控制点2
    0,
    -leafLength * 0.5, // 终点（叶尖）
  );

  // 左侧曲线（镜像）
  context.bezierCurveTo(
    -leafWidth * 0.7,
    -leafLength * 0.3, // 控制点1
    -leafWidth * 0.8,
    leafLength * 0.1, // 控制点2
    0,
    leafLength * 0.3, // 终点回到起点
  );

  // 填充和描边
  context.fillStyle = fillColor;
  context.fill();

  context.strokeStyle = strokeColor;
  context.lineWidth = size * 0.15;
  context.stroke();

  // 绘制主叶脉
  context.beginPath();
  context.moveTo(0, leafLength * 0.3);
  context.lineTo(0, -leafLength * 0.5);
  context.strokeStyle = veinColor;
  context.lineWidth = size * 0.2;
  context.stroke();

  // 绘制侧叶脉 - 更自然的弧形
  const veinCount = 5; // 增加叶脉数量，看起来更自然
  context.lineWidth = size * 0.1;

  for (let i = 1; i <= veinCount; i++) {
    const veinPos = i / (veinCount + 1);
    const veinY = leafLength * 0.3 - leafLength * 0.8 * veinPos;
    const veinLength = leafWidth * 0.6 * Math.sin(veinPos * Math.PI);

    // 左侧叶脉 - 弧形
    context.beginPath();
    context.moveTo(0, veinY);
    context.quadraticCurveTo(
      -veinLength * 0.6,
      veinY - veinLength * 0.2,
      -veinLength,
      veinY - veinLength * 0.1,
    );
    context.stroke();

    // 右侧叶脉 - 弧形（镜像）
    context.beginPath();
    context.moveTo(0, veinY);
    context.quadraticCurveTo(
      veinLength * 0.6,
      veinY - veinLength * 0.2,
      veinLength,
      veinY - veinLength * 0.1,
    );
    context.stroke();
  }

  // 绘制叶柄 - 秋季棕色
  context.beginPath();
  context.moveTo(0, leafLength * 0.3);
  context.lineTo(0, leafLength * 0.5);
  context.strokeStyle = `rgba(101, 67, 33, ${opacity * 1.2})`; // 深棕色
  context.lineWidth = size * 0.25;
  context.stroke();

  // 恢复状态
  context.restore();
}
