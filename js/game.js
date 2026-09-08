// game.js - Vertical Scrolling Highway Curve & Obstacle Racer (Apex Highway)

(function () {
  "use strict";

  // ==========================================================================
  // 1. 프로시저 오디오 신디사이저 (Web Audio API)
  // ==========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.engineOsc = null;
      this.engineGain = null;
      this.skidGain = null;
      this.skidFilter = null;
      this.nitroGain = null;
      this.nitroFilter = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // 1) 엔진 사운드 (Sawtooth + Lowpass)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineOsc.frequency.setValueAtTime(50, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();

        // 2) 타이어 스키드 사운드 (White Noise Buffer)
        const bufferSize = this.ctx.sampleRate * 1;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.skidFilter = this.ctx.createBiquadFilter();
        this.skidFilter.type = "bandpass";
        this.skidFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        this.skidFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

        this.skidGain = this.ctx.createGain();
        this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);

        whiteNoise.connect(this.skidFilter);
        this.skidFilter.connect(this.skidGain);
        this.skidGain.connect(this.ctx.destination);
        whiteNoise.start();

        this.initialized = true;
      } catch (e) {
        console.warn("Web Audio initialization failed", e);
      }
    }

    updateEngine(speedKmH, isBoosting) {
      if (!this.initialized || this.muted) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      // 속도(0 ~ 260)에 비례하는 엔진 RPM 피치
      const baseFreq = 48 + (speedKmH / 260) * 110 + (isBoosting ? 35 : 0);
      this.engineOsc.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);

      const targetGain = 0.035 + (speedKmH / 260) * 0.04 + (isBoosting ? 0.025 : 0);
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    setSkid(active) {
      if (!this.initialized || this.muted) return;
      const targetGain = active ? 0.1 : 0;
      this.skidGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }

    playCrash() {
      if (!this.initialized || this.muted) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
      } catch (e) {}
    }

    playCoin() {
      if (!this.initialized || this.muted) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5
        osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.08); // E6

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
      } catch (e) {}
    }

    playBoost() {
      if (!this.initialized || this.muted) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(260, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(780, this.ctx.currentTime + 0.3);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
      } catch (e) {}
    }

    playGameOver() {
      if (!this.initialized || this.muted) return;
      try {
        const notes = [392.0, 349.23, 329.63, 293.66]; // G4, F4, E4, D4
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.18);
          gain.gain.setValueAtTime(0.12, this.ctx.currentTime + idx * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.18 + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(this.ctx.currentTime + idx * 0.18);
          osc.stop(this.ctx.currentTime + idx * 0.18 + 0.35);
        });
      } catch (e) {}
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.engineGain) {
        this.engineGain.gain.setValueAtTime(this.muted ? 0 : 0.04, this.ctx ? this.ctx.currentTime : 0);
      }
      if (this.skidGain) {
        this.skidGain.gain.setValueAtTime(0, this.ctx ? this.ctx.currentTime : 0);
      }
      return this.muted;
    }
  }

  // ==========================================================================
  // 2. 수직 고속도로 커브 & 레이서 메인 클래스 (Apex Highway)
  // ==========================================================================
  class ApexHighwayGame {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");

      // 오디오 신디사이저
      this.sound = new SoundEngine();

      // 차량 스프라이트
      this.playerImg = new Image();
      this.playerImg.src = "images/car-red.png";
      this.trafficImg = new Image();
      this.trafficImg.src = "images/car-yellow.png";

      // 키보드 상태
      this.keys = {
        up: false,
        down: false,
        left: false,
        right: false,
        boost: false
      };

      // 도로 규격
      this.ROAD_WIDTH = 460;
      this.LANE_COUNT = 3;
      this.SEGMENT_LENGTH = 16; // 도로 세그먼트 높이

      // 게임 상태
      this.gameState = "ready"; // 'ready', 'racing', 'gameover'
      this.distance = 0; // 주행 누적 거리 (m)
      this.score = 0; // 점수
      this.overtakes = 0; // 추월 횟수
      this.highScore = parseInt(localStorage.getItem("apex_highway_highscore") || "0", 10);

      // 플레이어 차량 물리 상태
      this.player = {
        x: this.canvas.width / 2,
        y: this.canvas.height - 150,
        width: 44,
        height: 88,
        speed: 80, // 현재 속도 (km/h)
        minSpeed: 40,
        normalMaxSpeed: 180,
        boostMaxSpeed: 250,
        vx: 0,
        tiltAngle: 0, // 좌우 조향 틸팅 (-0.18 ~ +0.18 rad)
        lives: 3,
        maxLives: 3,
        invincibleTimer: 0, // 피격 무적 시간
        nitro: 100, // 부스트 게이지 (0 ~ 100)
        isBoosting: false,
        spinTimer: 0, // 오일 웅덩이 피격 시 스핀
        onGrass: false
      };

      // 게임 엔티티 (트래픽 차량, 장애물, 코인, 아이템)
      this.entities = [];
      this.spawnTimer = 0;

      // 파티클 시스템 (배기 연기, 부스트 화염, 스파크, 잔디 파편)
      this.particles = [];

      // 화면 진동(Screen Shake)
      this.shakeIntensity = 0;

      // 플로팅 점수 텍스트 ("+50 OVERTAKE!", "+100 COIN!")
      this.floatingTexts = [];

      // UI 및 이벤트 초기화
      this.initInput();
      this.initUI();

      // 메인 루프 가동
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    // 도로 중심 곡률 계산 (진행 거리 d와 화면 y 좌표에 따른 곡선 오프셋)
    getCurveOffset(worldDistance) {
      // 복합 사인파로 부드럽고 스릴 넘치는 완급 조절의 S자/헤어핀 커브 구현
      const s1 = Math.sin(worldDistance * 0.0018) * 160;
      const s2 = Math.sin(worldDistance * 0.0035 + 1.2) * 90;
      const s3 = Math.cos(worldDistance * 0.0007) * 60;
      return s1 + s2 + s3;
    }

    initInput() {
      window.addEventListener("keydown", (e) => {
        this.sound.init();
        if (["ArrowUp", "KeyW"].includes(e.code)) this.keys.up = true;
        if (["ArrowDown", "KeyS"].includes(e.code)) this.keys.down = true;
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = true;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = true;
        if (e.code === "Space") {
          this.keys.boost = true;
          e.preventDefault();
        }
      });

      window.addEventListener("keyup", (e) => {
        if (["ArrowUp", "KeyW"].includes(e.code)) this.keys.up = false;
        if (["ArrowDown", "KeyS"].includes(e.code)) this.keys.down = false;
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = false;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = false;
        if (e.code === "Space") this.keys.boost = false;
      });

      // 가상 터치 컨트롤러 바인딩
      const bindBtn = (btnId, keyName) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const press = (e) => {
          e.preventDefault();
          this.sound.init();
          this.keys[keyName] = true;
          btn.classList.add("active");
        };
        const release = (e) => {
          e.preventDefault();
          this.keys[keyName] = false;
          btn.classList.remove("active");
        };
        btn.addEventListener("touchstart", press, { passive: false });
        btn.addEventListener("touchend", release, { passive: false });
        btn.addEventListener("mousedown", press);
        btn.addEventListener("mouseup", release);
        btn.addEventListener("mouseleave", release);
      };

      bindBtn("btnLeft", "left");
      bindBtn("btnRight", "right");
      bindBtn("btnGas", "up");
      bindBtn("btnBrake", "down");
      bindBtn("btnDrift", "boost");
    }

    initUI() {
      const btnStart = document.getElementById("btnStart");
      const btnRestart = document.getElementById("btnRestart");
      const btnMute = document.getElementById("btnMute");

      if (btnStart) {
        btnStart.addEventListener("click", () => this.startGame());
      }
      if (btnRestart) {
        btnRestart.addEventListener("click", () => this.resetGame());
      }
      if (btnMute) {
        btnMute.addEventListener("click", () => {
          this.sound.init();
          const isMuted = this.sound.toggleMute();
          btnMute.textContent = isMuted ? "🔇 음소거 해제" : "🔊 사운드 켬";
        });
      }

      this.updateHUD();
    }

    startGame() {
      this.sound.init();
      const overlay = document.getElementById("gameOverlay");
      if (overlay) overlay.style.display = "none";
      const victoryModal = document.getElementById("victoryModal");
      if (victoryModal) victoryModal.style.display = "none";

      this.resetStats();
      this.gameState = "racing";
    }

    resetGame() {
      this.sound.init();
      const overlay = document.getElementById("gameOverlay");
      if (overlay) overlay.style.display = "none";
      const victoryModal = document.getElementById("victoryModal");
      if (victoryModal) victoryModal.style.display = "none";

      this.resetStats();
      this.gameState = "racing";
    }

    resetStats() {
      this.distance = 0;
      this.score = 0;
      this.overtakes = 0;
      this.entities = [];
      this.particles = [];
      this.floatingTexts = [];
      this.spawnTimer = 0;

      const p = this.player;
      p.x = this.canvas.width / 2;
      p.speed = 80;
      p.vx = 0;
      p.tiltAngle = 0;
      p.lives = 3;
      p.invincibleTimer = 0;
      p.nitro = 100;
      p.isBoosting = false;
      p.spinTimer = 0;
      p.onGrass = false;
    }

    update(dt) {
      if (this.gameState !== "racing") return;

      const p = this.player;

      // 1. 니트로 부스트 판단
      if (this.keys.boost && p.nitro > 0) {
        p.isBoosting = true;
        p.nitro = Math.max(0, p.nitro - dt * 28);
        this.shakeIntensity = Math.max(this.shakeIntensity, 3);
        if (Math.random() < 0.6) this.sound.playBoost();
      } else {
        p.isBoosting = false;
        // 비가속 시 서서히 니트로 자연 충전
        p.nitro = Math.min(100, p.nitro + dt * 6);
      }

      // 2. 속도 가감속 물리
      let targetMaxSpeed = p.isBoosting ? p.boostMaxSpeed : p.normalMaxSpeed;
      if (p.onGrass) {
        targetMaxSpeed = 45; // 잔디밭 감속 패널티
      }

      if (this.keys.up) {
        p.speed += (p.isBoosting ? 140 : 85) * dt;
      } else if (this.keys.down) {
        p.speed -= 160 * dt;
      } else {
        // 자연 감속 / 관성
        if (p.speed > targetMaxSpeed) {
          p.speed -= 100 * dt;
        } else if (p.speed < 70 && !p.onGrass) {
          p.speed += 30 * dt;
        }
      }

      p.speed = Math.max(p.minSpeed, Math.min(targetMaxSpeed, p.speed));

      // 3. 주행 거리 및 점수 증가
      const speedMps = (p.speed * 1000) / 3600; // m/s
      const movedMeters = speedMps * dt;
      this.distance += movedMeters;
      this.score += Math.round(movedMeters * (p.isBoosting ? 2.5 : 1));

      // 4. 좌우 조향 및 틸팅 물리
      let steerInput = 0;
      if (this.keys.left) steerInput -= 1;
      if (this.keys.right) steerInput += 1;

      // 오일 피격 시 통제 불가 스핀
      if (p.spinTimer > 0) {
        p.spinTimer -= dt;
        steerInput = Math.sin(p.spinTimer * 16) * 1.8;
      }

      const steerPower = 480 * (p.speed / 120);
      p.vx = p.vx * 0.82 + steerInput * steerPower * dt;
      p.x += p.vx;

      // 차량 틸팅 각도 보간 (-0.18 ~ +0.18 rad)
      const targetTilt = steerInput * 0.15;
      p.tiltAngle = p.tiltAngle * 0.8 + targetTilt * 0.2;

      // 도로 중심선 및 도로 이탈(Grass) 판정
      const currentRoadCenter = this.canvas.width / 2 + this.getCurveOffset(this.distance);
      const roadLeft = currentRoadCenter - this.ROAD_WIDTH / 2;
      const roadRight = currentRoadCenter + this.ROAD_WIDTH / 2;

      if (p.x < roadLeft + 20 || p.x > roadRight - 20) {
        p.onGrass = true;
        this.shakeIntensity = Math.max(this.shakeIntensity, 2);
        // 잔디 먼지 및 스파크 파티클 방출
        if (Math.random() < 0.6) {
          this.particles.push({
            x: p.x + (Math.random() - 0.5) * 20,
            y: p.y + p.height / 2,
            vx: (Math.random() - 0.5) * 80,
            vy: Math.random() * 80 + 40,
            life: 0.4,
            color: p.x < roadLeft ? "#4ade80" : "#fbbf24",
            size: Math.random() * 5 + 3
          });
        }
      } else {
        p.onGrass = false;
      }

      // 화면 경계 제한
      p.x = Math.max(40, Math.min(this.canvas.width - 40, p.x));

      // 5. 무적 타이머
      if (p.invincibleTimer > 0) {
        p.invincibleTimer -= dt;
      }

      // 6. 배기 및 부스트 화염 파티클
      if (p.isBoosting) {
        for (let k = 0; k < 3; k++) {
          this.particles.push({
            x: p.x + (Math.random() - 0.5) * 14,
            y: p.y + p.height / 2 + 5,
            vx: (Math.random() - 0.5) * 30,
            vy: Math.random() * 120 + 80,
            life: 0.35,
            color: Math.random() < 0.5 ? "#38bdf8" : "#f97316",
            size: Math.random() * 7 + 4
          });
        }
      } else if (p.speed > 100 && Math.random() < 0.4) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 12,
          y: p.y + p.height / 2 + 5,
          vx: (Math.random() - 0.5) * 20,
          vy: Math.random() * 50 + 30,
          life: 0.25,
          color: "rgba(255, 255, 255, 0.4)",
          size: Math.random() * 4 + 2
        });
      }

      // 7. 엔티티 스폰 (트래픽 차량, 바리케이드, 오일 슬릭, 코인)
      this.spawnTimer += dt;
      const spawnInterval = Math.max(0.65, 1.6 - (this.distance / 5000) * 0.6);
      if (this.spawnTimer >= spawnInterval) {
        this.spawnTimer = 0;
        this.spawnEntity();
      }

      // 8. 엔티티 이동 및 충돌 판정
      this.updateEntities(dt, movedMeters);

      // 9. 파티클 업데이트
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }

      // 10. 플로팅 텍스트 업데이트
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y -= 45 * dt;
        ft.life -= dt;
        if (ft.life <= 0) this.floatingTexts.splice(i, 1);
      }

      // 11. 화면 진동 감쇠
      if (this.shakeIntensity > 0) {
        this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 10);
      }

      // 12. 사운드 업데이트
      this.sound.updateEngine(p.speed, p.isBoosting);
      this.sound.setSkid(p.spinTimer > 0 || Math.abs(p.vx) > 3.5);

      // 13. HUD 업데이트
      this.updateHUD();
    }

    spawnEntity() {
      // 3개 레인 중 무작위 1개 선택
      const laneIndex = Math.floor(Math.random() * this.LANE_COUNT);
      const laneWidth = this.ROAD_WIDTH / this.LANE_COUNT;
      const laneOffsetX = (laneIndex - 1) * laneWidth;

      // 스폰 지점에서의 도로 중심
      const spawnDistance = this.distance + 800;
      const spawnCurve = this.getCurveOffset(spawnDistance);
      const spawnX = this.canvas.width / 2 + spawnCurve + laneOffsetX;

      const rand = Math.random();

      if (rand < 0.45) {
        // [트래픽 일반 주행 차량]
        const trafficSpeed = Math.floor(Math.random() * 50) + 60; // 60 ~ 110 km/h
        this.entities.push({
          type: "traffic",
          x: spawnX,
          y: -120,
          width: 44,
          height: 86,
          speed: trafficSpeed,
          laneOffsetX: laneOffsetX,
          worldDist: spawnDistance,
          passed: false
        });
      } else if (rand < 0.65) {
        // [도로 공사 바리케이드]
        this.entities.push({
          type: "barrier",
          x: spawnX,
          y: -80,
          width: 52,
          height: 32,
          speed: 0,
          laneOffsetX: laneOffsetX,
          worldDist: spawnDistance,
          passed: false
        });
      } else if (rand < 0.8) {
        // [오일 슬릭 (미끄러짐 웅덩이)]
        this.entities.push({
          type: "oil",
          x: spawnX,
          y: -60,
          width: 48,
          height: 36,
          speed: 0,
          laneOffsetX: laneOffsetX,
          worldDist: spawnDistance,
          passed: false
        });
      } else {
        // [황금 코인 또는 니트로 아이템]
        const isNitro = Math.random() < 0.25;
        this.entities.push({
          type: isNitro ? "nitro" : "coin",
          x: spawnX,
          y: -50,
          width: 32,
          height: 32,
          speed: 0,
          laneOffsetX: laneOffsetX,
          worldDist: spawnDistance,
          passed: false
        });
      }
    }

    updateEntities(dt, movedMeters) {
      const p = this.player;

      for (let i = this.entities.length - 1; i >= 0; i--) {
        const ent = this.entities[i];

        // 상대 속도 계산: (플레이어 속도 - 엔티티 자체 속도)
        const relSpeedKmh = p.speed - ent.speed;
        const relSpeedPx = (relSpeedKmh * 1000 / 3600) * 8.5; // 화면 픽셀 스케일
        ent.y += relSpeedPx * dt;

        // 도로 커브를 따라 엔티티의 X 위치를 곡선에 동기화
        const entCurve = this.getCurveOffset(this.distance + (this.canvas.height - ent.y) * 0.8);
        ent.x = this.canvas.width / 2 + entCurve + ent.laneOffsetX;

        // 1) 추월 판정 (트래픽 차량/장애물을 스치듯 지나갔을 때 보너스)
        if (!ent.passed && ent.y > p.y + p.height / 2) {
          ent.passed = true;
          if (ent.type === "traffic") {
            this.overtakes++;
            this.score += 50;
            this.addFloatingText(ent.x, p.y - 20, "+50 추월!", "#38bdf8");
          }
        }

        // 2) 플레이어와의 충돌 감지 (AABB 히트박스)
        if (this.checkCollision(p, ent)) {
          if (ent.type === "coin") {
            this.score += 100;
            this.sound.playCoin();
            this.addFloatingText(p.x, p.y - 30, "+100 COIN!", "#facc15");
            this.entities.splice(i, 1);
            continue;
          } else if (ent.type === "nitro") {
            p.nitro = Math.min(100, p.nitro + 45);
            this.sound.playBoost();
            this.addFloatingText(p.x, p.y - 30, "⚡ NITRO +45%", "#38bdf8");
            this.entities.splice(i, 1);
            continue;
          } else if (ent.type === "oil") {
            p.spinTimer = 0.85;
            this.sound.setSkid(true);
            this.shakeIntensity = 4;
            this.addFloatingText(p.x, p.y - 20, "⚠️ SLIP!", "#f87171");
            this.entities.splice(i, 1);
            continue;
          } else if (ent.type === "traffic" || ent.type === "barrier") {
            // 무적 상태가 아닐 때만 피격 데미지 적용
            if (p.invincibleTimer <= 0) {
              p.lives--;
              p.invincibleTimer = 1.8; // 1.8초간 무적 점멸
              p.speed = Math.max(40, p.speed * 0.55); // 충돌 시 급감속
              this.shakeIntensity = 9; // 강한 화면 진동
              this.sound.playCrash();

              // 충돌 스파크 파티클 폭발
              for (let k = 0; k < 20; k++) {
                this.particles.push({
                  x: p.x + (Math.random() - 0.5) * 30,
                  y: p.y,
                  vx: (Math.random() - 0.5) * 220,
                  vy: (Math.random() - 0.5) * 220,
                  life: 0.6,
                  color: Math.random() < 0.5 ? "#f97316" : "#facc15",
                  size: Math.random() * 6 + 3
                });
              }

              this.addFloatingText(p.x, p.y - 40, "CRASH! -1 ❤️", "#ef4444");

              // 하트 소진 시 게임오버
              if (p.lives <= 0) {
                this.triggerGameOver();
                return;
              }
            }
          }
        }

        // 화면 아래로 벗어난 엔티티 제거
        if (ent.y > this.canvas.height + 150) {
          this.entities.splice(i, 1);
        }
      }
    }

    checkCollision(a, b) {
      const padX = 10;
      const padY = 8;
      return (
        a.x - a.width / 2 + padX < b.x + b.width / 2 - padX &&
        a.x + a.width / 2 - padX > b.x - b.width / 2 + padX &&
        a.y - a.height / 2 + padY < b.y + b.height / 2 - padY &&
        a.y + a.height / 2 - padY > b.y - b.height / 2 + padY
      );
    }

    addFloatingText(x, y, text, color) {
      this.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        life: 0.9
      });
    }

    triggerGameOver() {
      this.gameState = "gameover";
      this.sound.playGameOver();
      this.shakeIntensity = 12;

      // 하이스코어 갱신 체크
      let isNewRecord = false;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem("apex_highway_highscore", this.highScore.toString());
        isNewRecord = true;
      }

      // 모달 팝업 표출
      const modal = document.getElementById("victoryModal");
      const summary = document.getElementById("victorySummary");
      if (modal && summary) {
        const titleEl = modal.querySelector(".victory-title");
        if (titleEl) titleEl.textContent = "💥 GAME OVER";

        summary.innerHTML = `
          <div class="result-rank">${isNewRecord ? "🏆 새로운 최고 기록 달성!" : "고속도로 레이스 종료"}</div>
          <div class="result-item"><span>최종 점수:</span> <strong>${this.score.toLocaleString()} 점</strong></div>
          <div class="result-item"><span>총 주행 거리:</span> <strong>${Math.floor(this.distance).toLocaleString()} m</strong></div>
          <div class="result-item"><span>추월한 차량:</span> <strong>${this.overtakes} 대</strong></div>
          <div class="result-item"><span>최고 기록:</span> <strong style="color: #38bdf8;">${this.highScore.toLocaleString()} 점</strong></div>
        `;
        modal.style.display = "flex";
      }
    }

    updateHUD() {
      const p = this.player;

      const speedEl = document.getElementById("hudSpeed");
      if (speedEl) speedEl.textContent = Math.round(p.speed);

      const distEl = document.getElementById("hudDistance");
      if (distEl) distEl.textContent = `${Math.floor(this.distance)}m`;

      const scoreEl = document.getElementById("hudScore");
      if (scoreEl) scoreEl.textContent = this.score.toLocaleString();

      const bestEl = document.getElementById("hudBestLap");
      if (bestEl) bestEl.textContent = this.highScore > 0 ? this.highScore.toLocaleString() : "--";

      // 라이프 하트 (♥♥♥)
      const heartsEl = document.getElementById("hudHearts");
      if (heartsEl) {
        let heartsStr = "";
        for (let i = 0; i < p.maxLives; i++) {
          heartsStr += i < p.lives ? "❤️" : "🖤";
        }
        heartsEl.textContent = heartsStr;
      }

      // 니트로 바 게이지
      const nitroBarEl = document.getElementById("hudNitroBar");
      if (nitroBarEl) {
        nitroBarEl.style.width = `${Math.round(p.nitro)}%`;
      }
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // 1. 화면 진동 트랜스폼 적용
      ctx.save();
      if (this.shakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 2;
        ctx.translate(shakeX, shakeY);
      }

      // 2. 배경 잔디밭 (Grassland)
      ctx.fillStyle = "#1e3a1e";
      ctx.fillRect(0, 0, w, h);

      // 도로 밖 가로 스트라이프 잔디 질감 (고속 스크롤 연출)
      const scrollOffset = (this.distance * 12) % 60;
      ctx.fillStyle = "#224222";
      for (let y = -60 + scrollOffset; y < h; y += 60) {
        ctx.fillRect(0, y, w, 30);
      }

      // 3. 굽이치는 도로 렌더링 (수평 슬라이스 세그먼트)
      const sliceH = 8;
      const totalSlices = Math.ceil(h / sliceH);

      for (let i = totalSlices; i >= 0; i--) {
        const sliceY = i * sliceH;
        // 깊이에 따른 도로 중심 오프셋 계산
        const depthDist = this.distance + (h - sliceY) * 0.8;
        const roadCenterX = w / 2 + this.getCurveOffset(depthDist);
        const roadLeft = roadCenterX - this.ROAD_WIDTH / 2;
        const roadRight = roadCenterX + this.ROAD_WIDTH / 2;

        // 3-1) 아스팔트 본선 노면
        ctx.fillStyle = "#18202c";
        ctx.fillRect(roadLeft, sliceY, this.ROAD_WIDTH, sliceH);

        // 3-2) 도로 양쪽 적백 연석 (Curb / Rumble Strip)
        const curbWidth = 16;
        const isRed = Math.floor((depthDist * 0.1) % 2) === 0;
        ctx.fillStyle = isRed ? "#dc2626" : "#f8fafc";
        ctx.fillRect(roadLeft - curbWidth, sliceY, curbWidth, sliceH);
        ctx.fillRect(roadRight, sliceY, curbWidth, sliceH);

        // 3-3) 중앙 점선 차선 (3개 차선 -> 2개의 구분선)
        const laneWidth = this.ROAD_WIDTH / this.LANE_COUNT;
        const isDashed = Math.floor((depthDist * 0.15) % 2) === 0;
        if (isDashed) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillRect(roadLeft + laneWidth - 2, sliceY, 4, sliceH);
          ctx.fillRect(roadLeft + laneWidth * 2 - 2, sliceY, 4, sliceH);
        }
      }

      // 4. 엔티티 렌더링 (장애물, 트래픽 차량, 코인 등)
      for (const ent of this.entities) {
        this.drawEntity(ctx, ent);
      }

      // 5. 파티클 렌더링
      for (const pt of this.particles) {
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. 플레이어 차량 렌더링
      this.drawPlayer(ctx);

      // 7. 플로팅 텍스트 렌더링
      ctx.font = "bold 16px 'Noto Sans KR', sans-serif";
      ctx.textAlign = "center";
      for (const ft of this.floatingTexts) {
        ctx.fillStyle = ft.color;
        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    drawPlayer(ctx) {
      const p = this.player;

      // 무적 점멸 효과 (Invincible Blink)
      if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 12) % 2 === 0) {
        return;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tiltAngle);

      // 차체 하부 지면 그림자
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.ellipse(3, 8, p.width / 2 + 2, p.height / 2 - 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 플레이어 차량 이미지 렌더링
      if (this.playerImg.complete && this.playerImg.naturalWidth > 0) {
        ctx.drawImage(this.playerImg, -p.width / 2, -p.height / 2, p.width, p.height);
      } else {
        // 이미지 로딩 중 대체 박스
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }

      // 전조등 헤드라이트 빔 효과 (전방 위쪽을 밝게 비춤)
      const grad = ctx.createLinearGradient(0, -p.height / 2, 0, -p.height / 2 - 120);
      grad.addColorStop(0, "rgba(255, 255, 200, 0.25)");
      grad.addColorStop(1, "rgba(255, 255, 200, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-15, -p.height / 2);
      ctx.lineTo(-45, -p.height / 2 - 120);
      ctx.lineTo(45, -p.height / 2 - 120);
      ctx.lineTo(15, -p.height / 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    drawEntity(ctx, ent) {
      ctx.save();
      ctx.translate(ent.x, ent.y);

      if (ent.type === "traffic") {
        // 트래픽 차량 (노란색 스포츠카)
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(2, 6, ent.width / 2, ent.height / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.trafficImg.complete && this.trafficImg.naturalWidth > 0) {
          ctx.drawImage(this.trafficImg, -ent.width / 2, -ent.height / 2, ent.width, ent.height);
        } else {
          ctx.fillStyle = "#eab308";
          ctx.fillRect(-ent.width / 2, -ent.height / 2, ent.width, ent.height);
        }
      } else if (ent.type === "barrier") {
        // 공사 바리케이드 (오렌지/화이트 스트라이프)
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(-ent.width / 2 + 2, 4, ent.width, ent.height / 2);

        ctx.fillStyle = "#f97316";
        ctx.fillRect(-ent.width / 2, -ent.height / 2, ent.width, ent.height);

        ctx.fillStyle = "#ffffff";
        for (let x = -ent.width / 2 + 4; x < ent.width / 2; x += 14) {
          ctx.beginPath();
          ctx.moveTo(x, -ent.height / 2);
          ctx.lineTo(x + 7, -ent.height / 2);
          ctx.lineTo(x, ent.height / 2);
          ctx.lineTo(x - 7, ent.height / 2);
          ctx.fill();
        }

        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 2;
        ctx.strokeRect(-ent.width / 2, -ent.height / 2, ent.width, ent.height);
      } else if (ent.type === "oil") {
        // 오일 슬릭 (미끄러운 검은 타원 웅덩이)
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.beginPath();
        ctx.ellipse(0, 0, ent.width / 2, ent.height / 2, 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        ctx.beginPath();
        ctx.ellipse(-4, -2, ent.width / 4, ent.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.type === "coin") {
        // 황금 코인
        ctx.shadowColor = "#facc15";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#eab308";
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ca8a04";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("★", 0, 0);
        ctx.shadowBlur = 0;
      } else if (ent.type === "nitro") {
        // 니트로 부스트 캡슐
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.roundRect(-10, -14, 20, 28, 6);
        ctx.fill();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N₂O", 0, 0);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    loop(time) {
      const dt = Math.min(0.05, (time - this.lastTime) / 1000);
      this.lastTime = time;

      this.update(dt);
      this.draw();

      requestAnimationFrame((t) => this.loop(t));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("gameCanvas")) {
      window.turboGame = new ApexHighwayGame();
    }
  });
})();
