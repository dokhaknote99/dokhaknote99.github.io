// game.js - Top-Down 2D Racing Game Engine (Turbo Apex)

(function () {
  "use strict";

  // ==========================================================================
  // 1. 오디오 합성 엔진 (Web Audio API - 무결점 프로시저 사운드)
  // ==========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.engineOsc = null;
      this.engineGain = null;
      this.tireGain = null;
      this.tireFilter = null;
      this.initialized = false;
    }

    init() {
      if (this.initialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        // 엔진 소음 신디사이저 (Sawtooth + LowPass Filter)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(280, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();

        // 타이어 스키드 소음 (White Noise + Bandpass Filter)
        const bufferSize = this.ctx.sampleRate * 1;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        this.tireFilter = this.ctx.createBiquadFilter();
        this.tireFilter.type = "bandpass";
        this.tireFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
        this.tireFilter.Q.setValueAtTime(3, this.ctx.currentTime);

        this.tireGain = this.ctx.createGain();
        this.tireGain.gain.setValueAtTime(0, this.ctx.currentTime);

        whiteNoise.connect(this.tireFilter);
        this.tireFilter.connect(this.tireGain);
        this.tireGain.connect(this.ctx.destination);
        whiteNoise.start();

        this.initialized = true;
      } catch (e) {
        console.warn("Web Audio initialization failed", e);
      }
    }

    updateEngine(speedRatio) {
      if (!this.initialized || this.muted) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const targetFreq = 45 + speedRatio * 110;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
      const targetGain = 0.03 + speedRatio * 0.06;
      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }

    setSkid(intensity) {
      if (!this.initialized || this.muted) return;
      const targetGain = Math.min(0.12, intensity * 0.12);
      this.tireGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }

    playDing() {
      if (!this.initialized || this.muted) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    }

    playBoost() {
      if (!this.initialized || this.muted) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.5);
    }

    playFanfare() {
      if (!this.initialized || this.muted) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.12);
        osc.stop(this.ctx.currentTime + idx * 0.12 + 0.4);
      });
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.engineGain) {
        this.engineGain.gain.setValueAtTime(this.muted ? 0 : 0.04, this.ctx ? this.ctx.currentTime : 0);
      }
      if (this.tireGain) {
        this.tireGain.gain.setValueAtTime(0, this.ctx ? this.ctx.currentTime : 0);
      }
      return this.muted;
    }
  }

  // ==========================================================================
  // 2. 레이싱 서킷 트랙 정의 (Closed Circuit Track)
  // ==========================================================================
  const TRACK_WIDTH = 110;
  const WAYPOINTS = [
    { x: 300, y: 150 }, // 스타트 직선
    { x: 620, y: 150 },
    { x: 880, y: 160 },
    { x: 1040, y: 240 }, // 코너 1 (우측 고속 커브)
    { x: 1060, y: 400 },
    { x: 960, y: 550 },  // 코너 2 (헤어핀 유도)
    { x: 780, y: 590 },
    { x: 680, y: 480 },  // 시케인 S자 커브
    { x: 570, y: 430 },
    { x: 480, y: 520 },
    { x: 440, y: 620 },
    { x: 260, y: 630 },  // 서안 커브
    { x: 140, y: 520 },
    { x: 130, y: 320 },
    { x: 180, y: 200 },
  ];

  // 부스트 존 (직선 주로에 배치된 황금 부스트 패드)
  const BOOST_PADS = [
    { x: 500, y: 150, angle: 0 },
    { x: 190, y: 420, angle: -Math.PI / 2 }
  ];

  // ==========================================================================
  // 3. 헬퍼 수학 함수 (거리, 각도, 보간)
  // ==========================================================================
  function distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = distSq(x1, y1, x2, y2);
    if (l2 === 0) return Math.sqrt(distSq(px, py, x1, y1));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(distSq(px, py, x1 + t * (x2 - x1), y1 + t * (y2 - y1)));
  }

  function isOnTrack(x, y) {
    const n = WAYPOINTS.length;
    let minDist = 999999;
    for (let i = 0; i < n; i++) {
      const p1 = WAYPOINTS[i];
      const p2 = WAYPOINTS[(i + 1) % n];
      const d = distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
      if (d < minDist) minDist = d;
    }
    return minDist <= TRACK_WIDTH / 2;
  }

  // ==========================================================================
  // 4. 메인 게임 클래스
  // ==========================================================================
  class TurboApexGame {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      this.ctx = this.canvas.getContext("2d");

      // 스키드마크 캔버스 (영구 보존 레이어)
      this.skidCanvas = document.createElement("canvas");
      this.skidCanvas.width = this.canvas.width;
      this.skidCanvas.height = this.canvas.height;
      this.skidCtx = this.skidCanvas.getContext("2d");

      // 오디오
      this.sound = new SoundEngine();

      // 스프라이트 이미지 로드
      this.playerImg = new Image();
      this.playerImg.src = "images/car-red.png";
      this.rivalImg = new Image();
      this.rivalImg.src = "images/car-yellow.png";

      // 키보드 상태
      this.keys = {
        up: false,
        down: false,
        left: false,
        right: false,
        handbrake: false
      };

      // 플레이어 카 물리 상태
      this.player = {
        x: 240,
        y: 150,
        angle: 0,
        speed: 0,
        vx: 0,
        vy: 0,
        boostTime: 0,
        lap: 1,
        maxLaps: 3,
        nextCheckpoint: 1,
        finished: false,
        lapStartTime: 0,
        currentLapTime: 0,
        bestLapTime: parseFloat(localStorage.getItem("turbo_apex_best_lap") || 0),
        lapTimes: []
      };

      // 라이벌 AI 카
      this.rival = {
        x: 200,
        y: 180,
        angle: 0,
        speed: 0,
        targetSpeed: 5.6,
        targetWpIndex: 1,
        lap: 1
      };

      // 파티클 (연기, 부스트 불꽃, 풀먼지)
      this.particles = [];

      // 게임 루프 및 UI 타이머
      this.gameState = "ready";
      this.countdown = 3;
      this.countdownTimer = null;
      this.totalRaceTime = 0;
      this.raceStartTime = 0;

      // 입력 바인딩 및 UI 초기화
      this.initInput();
      this.initUI();

      // 렌더링 루프 시작
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    initInput() {
      window.addEventListener("keydown", (e) => {
        this.sound.init();
        if (["ArrowUp", "KeyW"].includes(e.code)) this.keys.up = true;
        if (["ArrowDown", "KeyS"].includes(e.code)) this.keys.down = true;
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = true;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = true;
        if (["Space"].includes(e.code)) {
          this.keys.handbrake = true;
          e.preventDefault();
        }
      });

      window.addEventListener("keyup", (e) => {
        if (["ArrowUp", "KeyW"].includes(e.code)) this.keys.up = false;
        if (["ArrowDown", "KeyS"].includes(e.code)) this.keys.down = false;
        if (["ArrowLeft", "KeyA"].includes(e.code)) this.keys.left = false;
        if (["ArrowRight", "KeyD"].includes(e.code)) this.keys.right = false;
        if (["Space"].includes(e.code)) this.keys.handbrake = false;
      });

      // 가상 터치 버튼 바인딩
      const bindTouch = (btnId, keyName) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const start = (e) => {
          e.preventDefault();
          this.sound.init();
          this.keys[keyName] = true;
          btn.classList.add("active");
        };
        const end = (e) => {
          e.preventDefault();
          this.keys[keyName] = false;
          btn.classList.remove("active");
        };
        btn.addEventListener("touchstart", start, { passive: false });
        btn.addEventListener("touchend", end, { passive: false });
        btn.addEventListener("mousedown", start);
        btn.addEventListener("mouseup", end);
        btn.addEventListener("mouseleave", end);
      };

      bindTouch("btnGas", "up");
      bindTouch("btnBrake", "down");
      bindTouch("btnLeft", "left");
      bindTouch("btnRight", "right");
      bindTouch("btnDrift", "handbrake");
    }

    initUI() {
      const btnStart = document.getElementById("btnStart");
      const btnRestart = document.getElementById("btnRestart");
      const btnMute = document.getElementById("btnMute");

      if (btnStart) {
        btnStart.addEventListener("click", () => this.startCountdown());
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

      this.updateBestLapUI();
    }

    startCountdown() {
      this.sound.init();
      const overlay = document.getElementById("gameOverlay");
      if (overlay) overlay.style.display = "none";
      const victoryBox = document.getElementById("victoryModal");
      if (victoryBox) victoryBox.style.display = "none";

      this.gameState = "countdown";
      this.countdown = 3;
      const countEl = document.getElementById("countdownDisplay");
      if (countEl) {
        countEl.style.display = "block";
        countEl.textContent = "3";
      }
      this.sound.playDing();

      this.countdownTimer = setInterval(() => {
        this.countdown--;
        if (this.countdown > 0) {
          if (countEl) countEl.textContent = this.countdown;
          this.sound.playDing();
        } else if (this.countdown === 0) {
          if (countEl) countEl.textContent = "GO!";
          this.sound.playBoost();
        } else {
          clearInterval(this.countdownTimer);
          if (countEl) countEl.style.display = "none";
          this.gameState = "racing";
          this.raceStartTime = performance.now();
          this.player.lapStartTime = performance.now();
        }
      }, 800);
    }

    resetGame() {
      this.skidCtx.clearRect(0, 0, this.skidCanvas.width, this.skidCanvas.height);
      this.player.x = 240;
      this.player.y = 150;
      this.player.angle = 0;
      this.player.speed = 0;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.boostTime = 0;
      this.player.lap = 1;
      this.player.nextCheckpoint = 1;
      this.player.finished = false;
      this.player.lapTimes = [];

      this.rival.x = 200;
      this.rival.y = 180;
      this.rival.angle = 0;
      this.rival.speed = 0;
      this.rival.targetWpIndex = 1;
      this.rival.lap = 1;

      this.particles = [];
      const victoryModal = document.getElementById("victoryModal");
      if (victoryModal) victoryModal.style.display = "none";

      this.startCountdown();
    }

    update(dt) {
      if (this.gameState !== "racing") return;

      const now = performance.now();
      this.player.currentLapTime = (now - this.player.lapStartTime) / 1000;
      this.totalRaceTime = (now - this.raceStartTime) / 1000;

      // 1. 플레이어 물리 계산
      const p = this.player;
      const onTrack = isOnTrack(p.x, p.y);

      // 부스트 처리
      if (p.boostTime > 0) {
        p.boostTime -= dt;
      }

      // 부스트 패드 통과 감지
      for (const b of BOOST_PADS) {
        if (distSq(p.x, p.y, b.x, b.y) < 1800 && p.boostTime <= 0) {
          p.boostTime = 1.6;
          this.sound.playBoost();
          for (let i = 0; i < 16; i++) {
            this.particles.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 4 - Math.cos(p.angle) * 5,
              vy: (Math.random() - 0.5) * 4 - Math.sin(p.angle) * 5,
              life: 1.0,
              color: "#fbbf24",
              size: Math.random() * 5 + 3
            });
          }
        }
      }

      let maxSpeed = p.boostTime > 0 ? 9.5 : 7.2;
      let accel = 0.22;
      let friction = 0.985;

      // 잔디밭 진입 시 감속 패널티
      if (!onTrack) {
        maxSpeed = 2.4;
        friction = 0.92;
        if (Math.abs(p.speed) > 1.0 && Math.random() < 0.4) {
          this.particles.push({
            x: p.x + (Math.random() - 0.5) * 16,
            y: p.y + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 0.6,
            color: "#65a30d",
            size: Math.random() * 4 + 2
          });
        }
      }

      // 가속 및 후진
      if (this.keys.up) {
        p.speed += accel;
      } else if (this.keys.down) {
        p.speed -= accel * 0.8;
      } else {
        p.speed *= friction;
      }

      p.speed = Math.max(-2.5, Math.min(maxSpeed, p.speed));

      // 핸들링 & 조향
      const speedFactor = Math.min(1.0, Math.abs(p.speed) / 3.0);
      let steerAngle = 0.052 * speedFactor;

      if (this.keys.handbrake) {
        steerAngle *= 1.4;
        p.speed *= 0.97;
      }

      if (this.keys.left) p.angle -= steerAngle;
      if (this.keys.right) p.angle += steerAngle;

      const forwardX = Math.cos(p.angle);
      const forwardY = Math.sin(p.angle);

      // 관성 드리프트 혼합
      const driftGrip = this.keys.handbrake ? 0.78 : (onTrack ? 0.92 : 0.84);
      p.vx = p.vx * (1 - driftGrip) + forwardX * p.speed * driftGrip;
      p.vy = p.vy * (1 - driftGrip) + forwardY * p.speed * driftGrip;

      p.x += p.vx;
      p.y += p.vy;

      p.x = Math.max(30, Math.min(this.canvas.width - 30, p.x));
      p.y = Math.max(30, Math.min(this.canvas.height - 30, p.y));

      const lateralVel = Math.abs(p.vx * -forwardY + p.vy * forwardX);
      const isDrifting = (lateralVel > 1.2 && Math.abs(p.speed) > 3.0) || this.keys.handbrake;

      if (isDrifting && onTrack) {
        this.sound.setSkid(lateralVel / 3.0);

        this.skidCtx.fillStyle = "rgba(15, 23, 42, 0.12)";
        const backOffset = 18;
        const sideOffset = 10;
        const cos = Math.cos(p.angle);
        const sin = Math.sin(p.angle);

        const t1x = p.x - cos * backOffset - sin * sideOffset;
        const t1y = p.y - sin * backOffset + cos * sideOffset;
        const t2x = p.x - cos * backOffset + sin * sideOffset;
        const t2y = p.y - sin * backOffset - cos * sideOffset;

        this.skidCtx.beginPath();
        this.skidCtx.arc(t1x, t1y, 3, 0, Math.PI * 2);
        this.skidCtx.arc(t2x, t2y, 3, 0, Math.PI * 2);
        this.skidCtx.fill();

        if (Math.random() < 0.6) {
          this.particles.push({
            x: t1x,
            y: t1y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 0.5,
            color: "rgba(255, 255, 255, 0.6)",
            size: Math.random() * 6 + 3
          });
        }
      } else {
        this.sound.setSkid(0);
      }

      this.sound.updateEngine(Math.abs(p.speed) / 8.0);
      this.checkPlayerCheckpoints();
      this.updateRival(dt);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= dt * 1.8;
        if (pt.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      this.updateHUD();
    }

    checkPlayerCheckpoints() {
      const p = this.player;
      const targetWp = WAYPOINTS[p.nextCheckpoint];
      if (!targetWp) return;

      if (distSq(p.x, p.y, targetWp.x, targetWp.y) < 6400) {
        p.nextCheckpoint = (p.nextCheckpoint + 1) % WAYPOINTS.length;

        if (p.nextCheckpoint === 1) {
          const finishedLapTime = p.currentLapTime;
          p.lapTimes.push(finishedLapTime);
          this.sound.playDing();

          if (p.bestLapTime === 0 || finishedLapTime < p.bestLapTime) {
            p.bestLapTime = finishedLapTime;
            localStorage.setItem("turbo_apex_best_lap", p.bestLapTime.toFixed(2));
            this.updateBestLapUI();
          }

          if (p.lap < p.maxLaps) {
            p.lap++;
            p.lapStartTime = performance.now();
          } else {
            p.finished = true;
            this.gameState = "finished";
            this.sound.playFanfare();
            this.showVictoryModal();
          }
        }
      }
    }

    updateRival(dt) {
      const r = this.rival;
      const targetWp = WAYPOINTS[r.targetWpIndex];
      const dx = targetWp.x - r.x;
      const dy = targetWp.y - r.y;
      const targetAngle = Math.atan2(dy, dx);

      let angleDiff = targetAngle - r.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      r.angle += angleDiff * 0.08;

      if (r.speed < r.targetSpeed) r.speed += 0.08;
      r.x += Math.cos(r.angle) * r.speed;
      r.y += Math.sin(r.angle) * r.speed;

      if (distSq(r.x, r.y, targetWp.x, targetWp.y) < 3600) {
        r.targetWpIndex = (r.targetWpIndex + 1) % WAYPOINTS.length;
        if (r.targetWpIndex === 1) {
          r.lap++;
        }
      }
    }

    updateHUD() {
      const p = this.player;
      const speedKmH = Math.round(Math.abs(p.speed) * 28);
      const speedEl = document.getElementById("hudSpeed");
      if (speedEl) speedEl.textContent = speedKmH;

      const lapEl = document.getElementById("hudLap");
      if (lapEl) lapEl.textContent = `${p.lap} / ${p.maxLaps}`;

      const timeEl = document.getElementById("hudTime");
      if (timeEl) timeEl.textContent = p.currentLapTime.toFixed(2) + "s";
    }

    updateBestLapUI() {
      const bestEl = document.getElementById("hudBestLap");
      if (bestEl) {
        bestEl.textContent = this.player.bestLapTime > 0 ? this.player.bestLapTime.toFixed(2) + "s" : "--:--";
      }
    }

    showVictoryModal() {
      const modal = document.getElementById("victoryModal");
      const summaryEl = document.getElementById("victorySummary");
      if (!modal || !summaryEl) return;

      const pRank = this.player.lap >= this.rival.lap ? "1위 (우승! 🏆)" : "2위 (준우승 🥈)";
      summaryEl.innerHTML = `
        <div class="result-rank">${pRank}</div>
        <div class="result-item"><span>총 경기 시간:</span> <strong>${this.totalRaceTime.toFixed(2)}초</strong></div>
        <div class="result-item"><span>최고 랩타임:</span> <strong>${this.player.bestLapTime.toFixed(2)}초</strong></div>
      `;
      modal.style.display = "flex";
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // 잔디밭 배경
      ctx.fillStyle = "#1e3a1e";
      ctx.fillRect(0, 0, w, h);

      // 잔디 결 텍스처
      ctx.fillStyle = "#244424";
      for (let i = 0; i < w; i += 40) {
        ctx.fillRect(i, 0, 20, h);
      }

      // 서킷 아스팔트 바깥쪽 레드/화이트 연석(Curb)
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = TRACK_WIDTH + 18;
      ctx.strokeStyle = "#b91c1c";
      this.drawCircuitPath(ctx);
      ctx.stroke();

      ctx.lineWidth = TRACK_WIDTH + 14;
      ctx.strokeStyle = "#ffffff";
      ctx.setLineDash([14, 14]);
      this.drawCircuitPath(ctx);
      ctx.stroke();
      ctx.setLineDash([]);

      // 서킷 아스팔트 본선 도로
      ctx.lineWidth = TRACK_WIDTH;
      ctx.strokeStyle = "#1f2937";
      this.drawCircuitPath(ctx);
      ctx.stroke();

      // 도로 중앙 점선
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.setLineDash([16, 20]);
      this.drawCircuitPath(ctx);
      ctx.stroke();
      ctx.setLineDash([]);

      // 영구 스키드마크 레이어 합성
      ctx.drawImage(this.skidCanvas, 0, 0);

      // 황금 부스트 패드 렌더링
      for (const b of BOOST_PADS) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = "#eab308";
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 12;

        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(k * 18 - 8, -14);
          ctx.lineTo(k * 18 + 6, 0);
          ctx.lineTo(k * 18 - 8, 14);
          ctx.lineWidth = 4;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
        ctx.restore();
      }

      // 스타트 / 피니시 라인 (체커보드 그리드)
      ctx.save();
      const startP = WAYPOINTS[0];
      ctx.translate(startP.x, startP.y);
      const rows = 2;
      const cols = 8;
      const cellW = 8;
      const cellH = TRACK_WIDTH / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? "#ffffff" : "#000000";
          ctx.fillRect(r * cellW - 8, c * cellH - TRACK_WIDTH / 2, cellW, cellH);
        }
      }
      ctx.restore();

      // 파티클 렌더링
      for (const pt of this.particles) {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 라이벌 AI 차량 렌더링
      this.drawCar(ctx, this.rivalImg, this.rival.x, this.rival.y, this.rival.angle, 26, 52);

      // 플레이어 차량 렌더링
      this.drawCar(ctx, this.playerImg, this.player.x, this.player.y, this.player.angle, 25, 52);
    }

    drawCircuitPath(ctx) {
      ctx.beginPath();
      const n = WAYPOINTS.length;
      ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
      for (let i = 1; i <= n; i++) {
        const curr = WAYPOINTS[i % n];
        const prev = WAYPOINTS[(i - 1) % n];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.closePath();
    }

    drawCar(ctx, img, x, y, angle, width, height) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);

      // 차량 지면 그림자
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.ellipse(3, 4, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
      } else {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(-width / 2, -height / 2, width, height);
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
      window.turboGame = new TurboApexGame();
    }
  });
})();
