// --- 遊戲設定 ---
const GROUND_LEVEL_PERCENT = 0.85;
const GRAVITY_FORCE = 0.4;
const DRAG_COEFFICIENT_Y = 0.997;
const DRAG_COEFFICIENT_X = 0.995;
const LAUNCH_POWER_MAX = 35;
const BOUNCE_FACTOR = 0.7;
const ROCK_BOUNCE_FACTOR = 0.6;
const FRICTION_FACTOR = 0.8;
const BOUNCE_BOX_BOUNCE_Y = -25;
const BOUNCE_BOX_BOUNCE_X_FACTOR = 0.98;
const SPRING_BOUNCE_Y = -30;
const SPRING_BOUNCE_X_ADD = 3;
const BOOST_PAD_SPEED = 40;
const BOOST_PAD_LAUNCH_Y = -30;
const BOOST_DURATION_FRAMES = 100;
const RAMP_LAUNCH_SPEED_FACTOR = 1.3;
const RAMP_LAUNCH_ANGLE = -Math.PI / 5;
const OBSTACLE_MIN_DIST = 280;
const OBSTACLE_MAX_DIST = 650;
const SCROLL_FOLLOW_FACTOR = 0.3;

// --- 遊戲狀態 ---
let gameState = 'instructions';
let launcher;
let projectile;
let obstacles = [];
let cameraX = 0;
let maxDistance = 0;
let currentDistance = 0;
let lastObstacleX = 0;

// --- 輸入 ---
let isCharging = false;
let chargeStartX, chargeStartY;

// --- 美術風格 ---
let animalColor;
let obstacleColors = {};

// ==========================================================================
// P5.js 主要函式
// ==========================================================================

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  pixelDensity(1);
  frameRate(60);

  launcher = {
    x: 100,
    y: height * GROUND_LEVEL_PERCENT - 30,
    angle: -Math.PI / 4,
    power: 10,
  };

  animalColor = color(255, 100, 100);
  obstacleColors = {
    bush: color(100, 200, 100, 200),
    rock: color(150, 75, 0),
    spring: color(50, 150, 250),
    stopper: color(255, 0, 0),
    bounceBox: color(210, 105, 30),
    boostPad: color(255, 215, 0),
    ramp: color(160, 160, 160),
  };

  resetGame();
}

function draw() {
  background(135, 206, 250);

  let targetCameraX = cameraX;
  if (projectile) {
    targetCameraX = projectile.pos.x - width * SCROLL_FOLLOW_FACTOR;
  }
  cameraX += (targetCameraX - cameraX) * 0.1;
  cameraX = max(0, cameraX);

  push();
  translate(-cameraX, 0);

  fill(100, 180, 80);
  noStroke();
  rect(
    cameraX - 100,
    height * GROUND_LEVEL_PERCENT,
    width + 200,
    height * (1 - GROUND_LEVEL_PERCENT) + 50
  );

  if (launcher) {
    drawLauncher();
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    let obs = obstacles[i];
    if (obs.x + obs.w > cameraX - 100 && obs.x < cameraX + width + 100) {
      drawObstacle(obs);
    }
    if (obs.x + obs.w < cameraX - width * 0.5) {
      obstacles.splice(i, 1);
    }
  }

  if (gameState !== 'instructions' && projectile) {
    drawPixelAnimal(projectile.pos.x, projectile.pos.y);
  }

  if (gameState === 'aiming' && launcher && projectile) {
    aimingLogic();
  } else if (gameState === 'flying' && launcher && projectile) {
    flyingLogic();
    generateObstacles();
  }

  pop();

  drawUI();
}

// ==========================================================================
// 輸入處理
// ==========================================================================
function mousePressed() {
  if (gameState === 'instructions') {
    gameState = 'aiming';
    if (launcher) {
      resetGame();
    } else {
      console.error('錯誤：發射器未在滑鼠點擊時初始化！');
    }
    return;
  }
  if (gameState === 'aiming' && launcher) {
    isCharging = true;
    chargeStartX = mouseX;
    chargeStartY = mouseY;
  } else if (gameState === 'result') {
    gameState = 'instructions';
  }
}

function mouseDragged() {
  if (isCharging && gameState === 'aiming' && launcher) {
    let dx = mouseX - chargeStartX;
    let dy = mouseY - chargeStartY;
    launcher.angle = constrain(atan2(dy, dx), -Math.PI * 0.9, -Math.PI * 0.05);
    let dist = sqrt(dx * dx + dy * dy);
    launcher.power = map(dist, 0, width / 3, 0, LAUNCH_POWER_MAX, true);
  }
}

function mouseReleased() {
  if (isCharging && gameState === 'aiming' && launcher) {
    isCharging = false;
    launchProjectile();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (launcher) {
    launcher.y = height * GROUND_LEVEL_PERCENT - 30;
  }
  if (
    (gameState === 'aiming' ||
      gameState === 'instructions' ||
      gameState === 'result') &&
    launcher
  ) {
    resetGame();
  }
}
// ==========================================================================
// 遊戲邏輯函式
// ==========================================================================
function resetGame() {
  if (!launcher) {
    console.error(
      '嚴重錯誤：在 resetGame 中 launcher 尚未初始化！將跳過此次重設。'
    );
    return;
  }
  projectile = {
    pos: createVector(
      launcher.x + cos(launcher.angle) * 35,
      launcher.y + sin(launcher.angle) * 35
    ),
    vel: createVector(0, 0),
    radius: 15,
    onGround: false,
    stoppedFrames: 0,
    isBoosting: false,
    boostTimer: 0,
  };
  obstacles = [];
  cameraX = 0;
  currentDistance = 0;
  lastObstacleX = launcher.x + width * 0.7;
  gameState = gameState === 'instructions' ? 'instructions' : 'aiming';
  launcher.angle = -Math.PI / 4;
  launcher.power = 10;
}

function aimingLogic() {
  if (!projectile || !launcher) return;
  projectile.pos.set(
    launcher.x + cos(launcher.angle) * 35,
    launcher.y + sin(launcher.angle) * 35
  );
  if (isCharging) {
    push();
    translate(launcher.x, launcher.y);
    rotate(launcher.angle);
    stroke(255, 0, 0, 150);
    strokeWeight(map(launcher.power, 0, LAUNCH_POWER_MAX, 2, 10));
    line(0, 0, launcher.power * 4, 0);
    fill(255, 0, 0, 150);
    noStroke();
    triangle(
      launcher.power * 4,
      -6,
      launcher.power * 4 + 12,
      0,
      launcher.power * 4,
      6
    );
    pop();
  } else {
    push();
    translate(launcher.x, launcher.y);
    rotate(launcher.angle);
    stroke(200, 200, 200, 100);
    strokeWeight(2);
    line(0, 0, 30, 0);
    pop();
  }
}

function launchProjectile() {
  if (!projectile || !launcher) return;
  if (launcher.power > 1) {
    projectile.vel = p5.Vector.fromAngle(launcher.angle, launcher.power);
    gameState = 'flying';
    projectile.onGround = false;
    projectile.stoppedFrames = 0;
    projectile.isBoosting = false;
    projectile.boostTimer = 0;
  } else {
    isCharging = false;
  }
}

function flyingLogic() {
  if (!projectile) return;
  let gravity = createVector(0, GRAVITY_FORCE);
  projectile.vel.add(gravity);
  if (projectile.isBoosting) {
    projectile.boostTimer--;
    projectile.vel.x = max(projectile.vel.x, BOOST_PAD_SPEED);
    projectile.vel.y *= DRAG_COEFFICIENT_Y;
    if (projectile.boostTimer <= 0) {
      projectile.isBoosting = false;
    }
  } else {
    projectile.vel.x *= DRAG_COEFFICIENT_X;
    projectile.vel.y *= DRAG_COEFFICIENT_Y;
  }
  projectile.pos.add(projectile.vel);
  let groundY = height * GROUND_LEVEL_PERCENT - projectile.radius;
  if (projectile.pos.y >= groundY) {
    projectile.pos.y = groundY;
    projectile.onGround = true;
    if (abs(projectile.vel.y) > 1.0) {
      projectile.vel.y *= -BOUNCE_FACTOR;
      if (!projectile.isBoosting) {
        projectile.vel.x *= FRICTION_FACTOR;
      }
      if (abs(projectile.vel.y) < 0.5) projectile.vel.y = 0;
    } else {
      projectile.vel.y = 0;
      if (!projectile.isBoosting) {
        projectile.vel.x *= FRICTION_FACTOR * 0.85;
        if (abs(projectile.vel.x) < 0.05) projectile.vel.x = 0;
      }
    }
  } else {
    projectile.onGround = false;
  }
  checkObstacleCollisions();
  if (launcher) {
    currentDistance = max(0, projectile.pos.x - launcher.x);
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance;
    }
  }
  if (!projectile.isBoosting) {
    if (projectile.onGround && projectile.vel.magSq() < 0.01) {
      projectile.stoppedFrames++;
    } else {
      projectile.stoppedFrames = 0;
    }
    if (projectile.stoppedFrames > 45) {
      gameState = 'result';
    }
  } else {
    projectile.stoppedFrames = 0;
  }
  if (projectile.pos.x < cameraX - width * 0.7) {
    gameState = 'result';
  }
}

function checkObstacleCollisions() {
  if (!projectile) return;
  for (let obs of obstacles) {
    if (
      projectile.pos.x + projectile.radius > obs.x &&
      projectile.pos.x - projectile.radius < obs.x + obs.w &&
      projectile.pos.y + projectile.radius > obs.y &&
      projectile.pos.y - projectile.radius < obs.y + obs.h
    ) {
      let closestX = constrain(projectile.pos.x, obs.x, obs.x + obs.w);
      let closestY = constrain(projectile.pos.y, obs.y, obs.y + obs.h);
      let distanceSq =
        sq(projectile.pos.x - closestX) + sq(projectile.pos.y - closestY);
      if (distanceSq < sq(projectile.radius)) {
        handleCollision(projectile, obs);
        return;
      }
    }
  }
}

// ==========================================================================
// *** 碰撞處理 (已更新) ***
// ==========================================================================
function handleCollision(proj, obs) {
  let closestX = constrain(proj.pos.x, obs.x, obs.x + obs.w);
  let closestY = constrain(proj.pos.y, obs.y, obs.y + obs.h);
  let hitDepthVec = createVector(proj.pos.x - closestX, proj.pos.y - closestY);
  let dist = hitDepthVec.mag();
  let overlap = proj.radius - dist;
  let normal = dist === 0 ? createVector(0, -1) : hitDepthVec.normalize(); // 從碰撞點指向圓心

  // --- 稍微加強基礎推出效果 ---
  proj.pos.add(normal.copy().mult(overlap * 1.05)); // 乘數略微增加

  let velOriginal = proj.vel.copy();

  switch (obs.type) {
    case 'bush':
      proj.vel.mult(0.88);
      if (normal.y < -0.1) proj.vel.y = min(proj.vel.y, -1);
      proj.isBoosting = false;
      proj.boostTimer = 0;
      break;
    case 'rock':
      let vn = proj.vel.dot(normal);
      if (vn < 0) {
        let impulseMagnitude = -(1 + ROCK_BOUNCE_FACTOR) * vn;
        proj.vel.add(normal.copy().mult(impulseMagnitude));
        if (!proj.isBoosting) proj.vel.mult(0.98);
      }
      if (abs(normal.y) > 0.9 && normal.y < 0 && abs(proj.vel.y) < 1.0) {
        proj.vel.y = -1.0;
        proj.onGround = false;
      }
      proj.isBoosting = false;
      proj.boostTimer = 0;
      break;
    case 'spring':
      proj.vel.y = SPRING_BOUNCE_Y - abs(velOriginal.y * 0.4);
      proj.vel.x += SPRING_BOUNCE_X_ADD;
      proj.onGround = false;
      proj.isBoosting = false;
      proj.boostTimer = 0;
      break;
    case 'bounceBox':
      proj.vel.y = BOUNCE_BOX_BOUNCE_Y - abs(velOriginal.y * 0.5);
      proj.vel.x *= BOUNCE_BOX_BOUNCE_X_FACTOR;
      proj.onGround = false;
      proj.isBoosting = false;
      proj.boostTimer = 0;
      break;
    case 'boostPad':
      proj.isBoosting = true;
      proj.boostTimer = BOOST_DURATION_FRAMES;
      proj.vel.x = BOOST_PAD_SPEED;
      proj.vel.y = BOOST_PAD_LAUNCH_Y; // 向上彈射
      proj.onGround = false;
      break;
    case 'ramp':
      let currentSpeed = velOriginal.mag();
      let launchSpeed = max(
        currentSpeed * RAMP_LAUNCH_SPEED_FACTOR,
        LAUNCH_POWER_MAX * 0.8
      );
      proj.vel = p5.Vector.fromAngle(RAMP_LAUNCH_ANGLE, launchSpeed);
      proj.onGround = false;
      proj.isBoosting = false;
      proj.boostTimer = 0;
      break;

    case 'stopper':
      proj.vel.set(0, 0); // 先停止速度
      proj.stoppedFrames = 100;
      proj.isBoosting = false;
      proj.boostTimer = 0;

      // --- *** 修正停止器卡住問題 *** ---
      const pushOutEpsilon = 0.1; // 微小的額外推出距離
      if (abs(normal.x) > abs(normal.y)) {
        // 主要撞擊側面
        proj.pos.x =
          normal.x > 0
            ? obs.x + obs.w + proj.radius + pushOutEpsilon
            : obs.x - proj.radius - pushOutEpsilon;
      } else {
        // 主要撞擊頂部或底部
        if (normal.y < 0) {
          // 撞擊頂部 (normal 指向上)
          proj.pos.y = obs.y - proj.radius - pushOutEpsilon; // 放置在頂部 *上方* 一點點
        } else {
          // 撞擊底部 (normal 指向下)
          proj.pos.y = obs.y + obs.h + proj.radius + pushOutEpsilon; // 放置在底部 *下方* 一點點
        }
      }
      // ----------------------------------
      break;
  }
  // 移除了最後的保底速度，因為 stopper 的精確放置應該能解決卡住問題
  // if (obs.type !== 'stopper' && proj.vel.magSq() < 0.01 && dist < proj.radius) {
  //     proj.vel.add(normal.copy().mult(0.1));
  // }
}

// ==========================================================================
// 生成障礙物
// ==========================================================================
function generateObstacles() {
  let lookAheadFactor = projectile ? abs(projectile.vel.x) * 10 : 0;
  let generateUntilX = cameraX + width * 1.5 + lookAheadFactor;

  while (lastObstacleX < generateUntilX) {
    lastObstacleX += random(OBSTACLE_MIN_DIST, OBSTACLE_MAX_DIST);

    let obsY;
    let obsW = random(30, 90);
    let obsH = random(20, 100);
    let typeRoll = random();
    let obsType;
    let obsColor;
    let isFloating = false;

    if (typeRoll < 0.18) {
      obsType = 'bush';
      obsH = random(20, 50);
    } else if (typeRoll < 0.36) {
      obsType = 'rock';
      obsH = random(40, 110);
    } else if (typeRoll < 0.5) {
      obsType = 'bounceBox';
      obsH = random(25, 50);
      obsW = random(40, 70);
    } else if (typeRoll < 0.64) {
      obsType = 'spring';
      obsH = random(15, 30);
      obsW = random(25, 40);
    } else if (typeRoll < 0.8) {
      obsType = 'boostPad';
      obsH = random(15, 25);
      obsW = random(60, 100);
    } else if (typeRoll < 0.9) {
      obsType = 'ramp';
      obsH = random(30, 60);
      obsW = random(80, 150);
    } else if (typeRoll < 0.97) {
      obsType = 'stopper';
      obsH = random(70, 160);
      obsW = random(15, 30);
    } else {
      obsType = 'rock';
      isFloating = true;
      obsW = random(40, 100);
      obsH = random(20, 40);
      obsY = random(height * 0.25, height * GROUND_LEVEL_PERCENT - obsH - 90);
    }

    if (!isFloating) {
      obsY = height * GROUND_LEVEL_PERCENT - obsH;
    } else {
      obsY = min(obsY, height * GROUND_LEVEL_PERCENT - obsH - 50);
    }

    obsColor = obstacleColors[obsType];
    obstacles.push({
      x: lastObstacleX,
      y: obsY,
      w: obsW,
      h: obsH,
      type: obsType,
      color: obsColor,
    });
  }
}

// ==========================================================================
// 繪圖函式
// ==========================================================================
function drawLauncher() {
  if (!launcher) return;
  push();
  translate(launcher.x, launcher.y);
  fill(100);
  rect(-15, 0, 30, 20);
  if (gameState === 'aiming') {
    rotate(launcher.angle);
    fill(120);
    rect(0, -5, 40, 10);
  }
  pop();
}

function drawPixelAnimal(x, y) {
  if (!projectile) return;
  push();
  translate(x, y);
  let angle = 0;
  if (!projectile.onGround && projectile.vel.magSq() > 1) {
    angle = projectile.vel.heading();
  } else if (projectile.isBoosting && projectile.vel.magSq() > 1) {
    angle = projectile.vel.heading() * 0.5;
  }
  rotate(angle);
  fill(animalColor);
  noStroke();
  let bodyW = projectile.radius * 1.8;
  let bodyH = projectile.radius * 1.4;
  rect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 3);
  let headSize = projectile.radius * 0.8;
  rect(bodyW * 0.25, -headSize * 0.75, headSize, headSize, 2);
  fill(0);
  ellipse(
    bodyW * 0.25 + headSize * 0.5,
    -headSize * 0.4,
    headSize * 0.25,
    headSize * 0.25
  );
  if (projectile.onGround && !projectile.isBoosting) {
    fill(animalColor);
    let legW = bodyW * 0.2;
    let legH = bodyH * 0.25;
    rect(-bodyW * 0.4, bodyH / 2, legW, legH);
    rect(bodyW * 0.2, bodyH / 2, legW, legH);
  }
  if (projectile.isBoosting) {
    noStroke();
    let baseFlameLength = bodyW * 1.2;
    let dynamicLength = map(
      projectile.boostTimer,
      0,
      BOOST_DURATION_FRAMES,
      baseFlameLength * 0.2,
      baseFlameLength * 1.8,
      true
    );
    let coreAlpha = map(
      projectile.boostTimer,
      0,
      BOOST_DURATION_FRAMES,
      100,
      255,
      true
    );
    let outerAlpha = map(
      projectile.boostTimer,
      0,
      BOOST_DURATION_FRAMES,
      50,
      200,
      true
    );
    fill(255, random(60, 140), 0, outerAlpha);
    beginShape();
    vertex(-bodyW / 2, -bodyH / 3);
    vertex(-bodyW / 2 - dynamicLength, 0);
    vertex(-bodyW / 2, bodyH / 3);
    endShape(CLOSE);
    fill(255, 255, random(0, 100), coreAlpha);
    beginShape();
    vertex(-bodyW / 2, -bodyH / 4);
    vertex(-bodyW / 2 - dynamicLength * 0.7, 0);
    vertex(-bodyW / 2, bodyH / 4);
    endShape(CLOSE);
  }
  pop();
}

function drawObstacle(obs) {
  push();
  fill(obs.color);
  noStroke();
  if (obs.type === 'bush') {
    let R = obs.w / 2.5;
    ellipse(obs.x + obs.w * 0.3, obs.y + obs.h * 0.6, R * 1.5, R * 1.5);
    ellipse(obs.x + obs.w * 0.7, obs.y + obs.h * 0.55, R * 1.6, R * 1.6);
    ellipse(obs.x + obs.w * 0.5, obs.y + obs.h * 0.3, R * 1.4, R * 1.4);
  } else if (obs.type === 'spring') {
    stroke(80);
    strokeWeight(3);
    rect(obs.x, obs.y + obs.h * 0.7, obs.w, obs.h * 0.3, 2);
    line(
      obs.x + obs.w * 0.15,
      obs.y + obs.h * 0.7,
      obs.x + obs.w * 0.85,
      obs.y + obs.h * 0.15
    );
    line(
      obs.x + obs.w * 0.85,
      obs.y + obs.h * 0.7,
      obs.x + obs.w * 0.15,
      obs.y + obs.h * 0.15
    );
    noStroke();
    fill(obs.color);
    rect(obs.x, obs.y, obs.w, obs.h * 0.2, 3);
  } else if (obs.type === 'stopper') {
    rect(obs.x, obs.y, obs.w, obs.h, 2);
    fill(255, 80, 80, 200);
    for (let i = 5; i < obs.h; i += 15) {
      rect(obs.x, obs.y + i, obs.w, 6);
    }
  } else if (obs.type === 'bounceBox') {
    rect(obs.x, obs.y, obs.w, obs.h, 4);
    stroke(139, 69, 19, 200);
    strokeWeight(2.5);
    line(obs.x, obs.y + obs.h / 2, obs.x + obs.w, obs.y + obs.h / 2);
    line(obs.x + obs.w / 3, obs.y, obs.x + obs.w / 3, obs.y + obs.h);
    line(
      obs.x + (obs.w * 2) / 3,
      obs.y,
      obs.x + (obs.w * 2) / 3,
      obs.y + obs.h
    );
    fill(40);
    noStroke();
    ellipse(obs.x + 6, obs.y + 6, 4, 4);
    ellipse(obs.x + obs.w - 6, obs.y + 6, 4, 4);
    ellipse(obs.x + 6, obs.y + obs.h - 6, 4, 4);
    ellipse(obs.x + obs.w - 6, obs.y + obs.h - 6, 4, 4);
  } else if (obs.type === 'boostPad') {
    rect(obs.x, obs.y, obs.w, obs.h, 3);
    fill(255, 255, 255, 180);
    let arrowWidth = obs.w * 0.6;
    let arrowHeight = obs.h * 0.7;
    let centerX = obs.x + obs.w / 2;
    let centerY = obs.y + obs.h / 2;
    beginShape();
    vertex(centerX - arrowWidth / 2, centerY - arrowHeight / 2);
    vertex(centerX, centerY - arrowHeight / 2);
    vertex(centerX + arrowWidth / 2, centerY);
    vertex(centerX, centerY + arrowHeight / 2);
    vertex(centerX - arrowWidth / 2, centerY + arrowHeight / 2);
    vertex(centerX - arrowWidth / 4, centerY);
    endShape(CLOSE);
  } else if (obs.type === 'ramp') {
    beginShape();
    vertex(obs.x, obs.y + obs.h);
    vertex(obs.x + obs.w, obs.y);
    vertex(obs.x + obs.w, obs.y + obs.h);
    endShape(CLOSE);
    stroke(120, 120, 120);
    strokeWeight(2);
    line(
      obs.x + obs.w * 0.2,
      obs.y + obs.h * 0.8,
      obs.x + obs.w * 0.8,
      obs.y + obs.h * 0.2
    );
    line(
      obs.x + obs.w * 0.4,
      obs.y + obs.h * 0.6,
      obs.x + obs.w * 0.9,
      obs.y + obs.h * 0.1
    );
  } else {
    rect(obs.x, obs.y, obs.w, obs.h, 5);
    fill(80, 40, 0, 150);
    for (let i = 0; i < 5; i++) {
      let spotX = obs.x + random(obs.w * 0.1, obs.w * 0.9);
      let spotY = obs.y + random(obs.h * 0.1, obs.h * 0.9);
      ellipse(spotX, spotY, random(5, 12), random(5, 12));
    }
  }
  pop();
}

function drawUI() {
  const padding = 15;
  const boxAlpha = 190;
  fill(0, 0, 0, boxAlpha);
  noStroke();
  textSize(20);
  textAlign(LEFT, TOP);
  textFont('monospace');
  fill(255);

  if (gameState === 'instructions') {
    let currentY = height / 4;
    const lineSpacing = 45;
    textAlign(CENTER, TOP);
    textSize(36);
    text('像素寵物發射器！', width / 2, currentY);
    currentY += lineSpacing + 10;
    textSize(22);
    text('點擊並向後拖曳滑鼠來瞄準', width / 2, currentY);
    currentY += lineSpacing;
    text('放開滑鼠即可發射！', width / 2, currentY);
    currentY += lineSpacing + 10;
    text('撞擊彈簧、彈跳箱、加速墊和斜坡！', width / 2, currentY);
    currentY += lineSpacing;
    text('小心紅色的停止器！', width / 2, currentY);
    currentY += lineSpacing + 20;
    fill(255, 255, 100);
    textSize(24);
    text('點擊任意處開始遊戲', width / 2, currentY);
  } else if (gameState === 'aiming') {
    let textContent = isCharging
      ? `角度: ${nf(-degrees(launcher.angle), 1, 1)} 度\n力量: ${nf(
          (launcher.power / LAUNCH_POWER_MAX) * 100,
          1,
          0
        )} %\n放開以發射！`
      : '點擊並拖曳以瞄準和蓄力！';
    let lines = textContent.split('\n').length;
    let textHeight = lines * 25 + padding * 1.5;
    let textWidthEstimate = 300;
    fill(0, 0, 0, boxAlpha);
    rect(padding, padding, textWidthEstimate, textHeight, 8);
    fill(255);
    text(textContent, padding + 10, padding + 10);
  } else if (gameState === 'flying') {
    let textContent = `距離: ${nf(currentDistance / 10, 0, 0)} 公尺`;
    let textW = textWidth(textContent) + 20;
    let textH = 45;
    fill(0, 0, 0, boxAlpha);
    rect(padding, padding, textW, textH, 8);
    fill(255);
    text(textContent, padding + 10, padding + 10);
    if (projectile && projectile.isBoosting && projectile.boostTimer > 0) {
      let boostText = `加速中: ${ceil(projectile.boostTimer / 60)} 秒`;
      let boostTextW = textWidth(boostText) + 20;
      fill(0, 0, 0, boxAlpha);
      rect(padding, padding + textH + 10, boostTextW, textH, 8);
      fill(255, 215, 0);
      text(boostText, padding + 10, padding + textH + 10 + 10);
    }
  } else if (gameState === 'result') {
    fill(0, 0, 0, 210);
    rect(width * 0.15, height * 0.2, width * 0.7, height * 0.6, 15);
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(34);
    text(`發射完成！`, width / 2, height * 0.3);
    textSize(28);
    text(
      `最終距離: ${nf(currentDistance / 10, 0, 0)} 公尺`,
      width / 2,
      height * 0.45
    );
    textSize(24);
    text(
      `本次最高紀錄: ${nf(maxDistance / 10, 0, 0)} 公尺`,
      width / 2,
      height * 0.58
    );
    fill(255, 255, 120);
    textSize(22);
    text('\n\n點擊畫面重新開始', width / 2, height * 0.7);
  }

  if (gameState !== 'instructions') {
    let bestScoreText = `最高紀錄: ${nf(maxDistance / 10, 0, 0)} 公尺`;
    let textW = textWidth(bestScoreText) + 30;
    let textH = 45;
    fill(0, 0, 0, boxAlpha);
    rect(width - textW - padding, padding, textW, textH, 8);
    fill(255);
    textAlign(RIGHT, TOP);
    text(bestScoreText, width - padding - 10, padding + 10);
  }
}
