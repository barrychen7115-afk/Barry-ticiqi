/**
 * 智能提词器 Pro — v2.5
 * 前置摄像头 · Capacitor 原生语音跟读 · 相机拍摄 · 文字浮镜
 * Capacitor · iPhone 13
 */

const App = {
  state: {
    // 样式
    fontSize: 28,
    fontColor: '#FFD60A',
    opacity: 90,
    lineHeight: 2.2,
    // 滚屏
    scrollMode: 'auto',    // 'auto' | 'ai'
    speed: 1,
    isPaused: false,
    isRunning: false,
    textHidden: false,
    currentWordIndex: 0,
    words: [],
    scrollTimer: null,
    // 相机
    cameraStream: null,
    hasCamera: false,
    // 语音识别跟读 (Capacitor 原生 SFSpeechRecognizer)
    recognition: null,           // Web Speech 实例
    _srPlugin: null,             // Capacitor 注册的 SpeechRecognition 插件引用
    recognitionType: null,       // 'capacitor' | 'webspeech' | null
    isRecognitionActive: false,
    lastRecognizedWords: '',
    recognitionRestartTimer: null,
    sensitivity: 7,              // 跟读灵敏度 1-10
    algoMode: 'fuzzy',           // 'fuzzy' | 'strict' | 'semantic'
    // 录制
    isRecording: false,
    recordingTimer: null,
    recordingStartTime: 0,
    recordingSeconds: 0,
    mediaRecorder: null,         // MediaRecorder 实例
    recordedChunks: [],          // 录制的视频片段
  },

  /* ─── 初始化 ─── */
  init() {
    document.addEventListener('gesturestart', e => e.preventDefault());
    console.log('[提词器 v2.5] 前置镜头 · 原生语音跟读 · 相机拍摄 · 文字浮镜');
    // 预检测语音识别能力
    this._detectSpeechCapability();
  },

  /** 检测/初始化可用的语音识别引擎
   *  在 Capacitor 原生环境中，延迟到用户点击 AI 模式时才检测，
   *  因为此时 bridge 肯定已经初始化完成
   */
  _detectSpeechCapability() {
    // 只要不在原生环境，就标记 null 让后续逻辑回退到 Web Speech
    if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
      // 浏览器环境：检查 Web Speech
      const WS = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.state.recognitionType = WS ? 'webspeech' : null;
      return;
    }
    // 原生环境：先假设可用，等 startVoiceDetection 时再真正初始化
    this.state.recognitionType = 'capacitor';
    this.state._srPlugin = null;
  },

  /* ═══════ 页面导航 ═══════ */
  switchPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const m = { home: 0, style: 1, ai: 2, about: 3 };
    const items = document.querySelectorAll('.nav-item');
    if (items[m[name]]) items[m[name]].classList.add('active');
  },

  /* ═══════ 设置 ═══════ */
  setSpeed(val, el) {
    this.state.speed = val;
    document.querySelectorAll('#page-home .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  setColor(hex, el) {
    this.state.fontColor = hex;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  updateFontSize(val) {
    this.state.fontSize = parseInt(val);
    const d = document.getElementById('fontSizeVal');
    if (d) d.textContent = val + 'px';
    this._applyStyle();
  },

  updateOpacity(val) {
    this.state.opacity = parseInt(val);
    const v1 = document.getElementById('opacityVal');
    const v2 = document.getElementById('opacityVal2');
    if (v1) v1.textContent = val + '%';
    if (v2) v2.textContent = val + '%';
    const s = document.getElementById('overlayOpacity');
    if (s) s.value = val;
    this._applyStyle();
  },

  setBgStyle(style, el) {
    document.querySelectorAll('#page-style .card:nth-child(4) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
  },

  setLineHeight(val, el) {
    this.state.lineHeight = val;
    document.querySelectorAll('#page-style .card:nth-child(5) .speed-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    this._applyStyle();
  },

  _applyStyle() {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    content.style.color = this.state.fontColor;
    content.style.fontSize = this.state.fontSize + 'px';
    content.style.lineHeight = this.state.lineHeight;
    content.style.opacity = this.state.opacity / 100;
  },

  _showSpeechUnavailableMessage() {
    alert(
      'AI 跟读当前不可用。\n\n' +
      '请确认你在 iOS 原生 Capacitor 应用中运行，并已经安装并同步 @capacitor-community/speech-recognition 插件。\n' +
      '如果当前环境不支持语音识别，可以继续使用自动滚动或手动拖动文本。'
    );
  },

  _setupPrompterScrollInteractions() {
    if (this._prompterScrollEventsAttached) return;
    const content = document.getElementById('prompter-content');
    if (!content) return;
    this._prompterScrollEventsAttached = true;

    const startScroll = () => {
      if (!this.state.isRunning) return;
      this.state.userScrollActive = true;
      this.state.isPaused = true;
      this._showTapHint('已启用手动滚动');
    };

    const stopScroll = () => {
      if (!this.state.userScrollActive) return;
      if (this._scrollStopTimer) clearTimeout(this._scrollStopTimer);
      this._scrollStopTimer = setTimeout(() => this._onScrollStopped(), 120);
    };

    const onScroll = () => {
      if (!this.state.userScrollActive) return;
      this.state.isPaused = true;
      if (this._scrollStopTimer) clearTimeout(this._scrollStopTimer);
      this._scrollStopTimer = setTimeout(() => this._onScrollStopped(), 180);
    };

    content.addEventListener('pointerdown', startScroll);
    content.addEventListener('touchstart', startScroll);
    content.addEventListener('mousedown', startScroll);
    content.addEventListener('pointerup', stopScroll);
    content.addEventListener('touchend', stopScroll);
    content.addEventListener('mouseup', stopScroll);
    content.addEventListener('scroll', onScroll);
  },

  _onScrollStopped() {
    this.state.userScrollActive = false;
    this._updateCurrentWordFromScroll();
  },

  _updateCurrentWordFromScroll() {
    const content = document.getElementById('prompter-content');
    if (!content || !this.state.words.length) return;

    const centerY = content.scrollTop + content.clientHeight / 2;
    let bestIdx = -1;
    let bestDelta = Infinity;

    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      const mid = el.offsetTop + el.offsetHeight / 2;
      const delta = Math.abs(mid - centerY);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    });

    if (bestIdx >= 0) {
      this.state.currentWordIndex = bestIdx;
      this._highlightCurrent(false);
    }
  },

  /* ═══════ 模式切换 ═══════ */
  setScrollMode(mode) {
    // 兼容 'ai' 和 'voice' 两种传参
    const normalized = (mode === 'ai' || mode === 'voice') ? 'ai' : 'auto';
    this.state.scrollMode = normalized;
    document.getElementById('modeAuto').classList.toggle('active', normalized === 'auto');
    document.getElementById('modeAI').classList.toggle('active', normalized === 'ai');

    // 同步主页 AI 开关
    const aiToggle = document.getElementById('aiToggle');
    if (aiToggle) aiToggle.checked = (normalized === 'ai');
    const aiLabel = document.getElementById('aiLabel');
    if (aiLabel) aiLabel.textContent = normalized === 'ai' ? '已开启' : '已关闭';

    if (normalized === 'ai') {
      if (this.state.recognitionType === null) {
        // 还没检测过，重新检测
        this._detectSpeechCapability();
      }
      if (this.state.recognitionType) {
        this._startVoiceDetection();
      } else {
        alert('AI 跟读当前不可用。\n\n请确认你在 iOS 原生 Capacitor 应用中运行，并已经安装并同步 @capacitor-community/speech-recognition 插件。');
        this.state.scrollMode = 'auto';
        document.getElementById('modeAuto').classList.add('active');
        document.getElementById('modeAI').classList.remove('active');
        if (aiToggle) aiToggle.checked = false;
        if (aiLabel) aiLabel.textContent = '不可用';
      }
    } else {
      this._stopVoiceDetection();
    }
  },

  toggleTextHide() {
    this.state.textHidden = !this.state.textHidden;
    document.getElementById('prompter-content').classList.toggle('hidden-text', this.state.textHidden);
  },

  /* ═════ 提词器主控 ═════ */
  async startPrompter() {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.currentWordIndex = 0;
    this.state._volumePaused = false;

    // 启动相机
    await this.requestCamera();

    // 渲染台词
    this._renderContent();

    // 显示提词 overlay
    document.getElementById('prompter-overlay').classList.add('active');

    // 启动滚动
    this._startAutoScroll();

    // 如果 AI 模式，启动音量检测
    if (this.state.scrollMode === 'ai') {
      await this._startVoiceDetection();
    }

    console.log('[Prompter] 已启动，模式:', this.state.scrollMode);
  },

  stopPrompter() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this._stopAutoScroll();
    this._stopVoiceDetection();
    this.releaseCamera();
    document.getElementById('prompter-overlay').classList.remove('active');
    console.log('[Prompter] 已停止');
  },

  _startAutoScroll() {
    this._stopAutoScroll();
    const tick = () => {
      if (!this.state.isRunning || this.state.isPaused) return;
      if (this.state.scrollMode === 'ai' && this.state._volumePaused) {
        // AI 模式 + 静音 → 极慢滚动
        this._scrollBy(0.15 * this.state.speed);
        this.state.scrollTimer = setTimeout(tick, 100);
        return;
      }
      const speed = this.state.scrollMode === 'ai' ? this.state.speed * 0.8 : this.state.speed;
      this._scrollBy(speed);
      this.state.scrollTimer = setTimeout(tick, 50);
    };
    tick();
  },

  _stopAutoScroll() {
    if (this.state.scrollTimer) {
      clearTimeout(this.state.scrollTimer);
      this.state.scrollTimer = null;
    }
  },

  _scrollBy(amount) {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    content.scrollTop += amount;
    this._updateCurrentWord();
  },

  _updateCurrentWord() {
    const content = document.getElementById('prompter-content');
    if (!content || !this.state.words.length) return;
    const centerY = content.scrollTop + content.clientHeight / 2;
    let bestIdx = 0;
    let bestDelta = Infinity;
    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      const mid = el.offsetTop + el.offsetHeight / 2;
      const delta = Math.abs(mid - centerY);
      if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
    });
    if (bestIdx !== this.state.currentWordIndex) {
      this.state.currentWordIndex = bestIdx;
      this._highlightCurrent();
    }
  },

  _highlightCurrent() {
    const idx = this.state.currentWordIndex;
    this.state.words.forEach((_, i) => {
      const el = document.getElementById('w' + i);
      if (!el) return;
      el.classList.toggle('current-word', i === idx);
      el.classList.toggle('read-word', i < idx);
    });
  },

  _renderContent() {
    const content = document.getElementById('prompter-content');
    if (!content) return;
    const text = document.getElementById('scriptInput').value.trim();
    if (!text) return;
    const words = text.split(/(\s+|[，。！？、；：""''（）【】]+)/).filter(Boolean);
    this.state.words = words;
    content.innerHTML = words.map((w, i) => '<span id="w' + i + '" class="word">' + w + '</span>').join('');
    this.state.currentWordIndex = 0;
  },

  slowerSpeed() {
    this.state.speed = Math.max(0.2, this.state.speed - 0.3);
    console.log('[Prompter] 减速至:', this.state.speed);
  },

  fasterSpeed() {
    this.state.speed = Math.min(5, this.state.speed + 0.3);
    console.log('[Prompter] 加速至:', this.state.speed);
  },

  togglePause() {
    this.state.isPaused = !this.state.isPaused;
    const btn = document.getElementById('pauseBtn');
    if (btn) btn.textContent = this.state.isPaused ? '▶' : '⏸';
    console.log('[Prompter]', this.state.isPaused ? '暂停' : '继续');
  },

  updateOverlayOpacity(val) {
    const content = document.getElementById('prompter-content');
    if (content) content.style.opacity = parseInt(val) / 100;
  },

  resetTextPosition() {
    const content = document.getElementById('prompter-content');
    if (content) content.scrollTop = 0;
    this.state.currentWordIndex = 0;
    this._highlightCurrent();
  },

  /* ═══════ 高清前置相机 ═══════ */
  async requestCamera() {
    // 优先前置镜头（自拍模式）
    const constraints = [
      { video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true },
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: true },
    ];
    for (const c of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        this.state.cameraStream = stream;
        const video = document.getElementById('cameraVideo');
        if (video) { video.srcObject = stream; await video.play(); }
        this.state.hasCamera = true;
        return true;
      } catch (e) { continue; }
    }
    this.state.hasCamera = false;
    return false;
  },

  releaseCamera() {
    if (this.state.cameraStream) {
      this.state.cameraStream.getTracks().forEach(t => t.stop());
      this.state.cameraStream = null;
    }
    this.state.hasCamera = false;
  },

  /* ═════ 音量感应跟读（稳定可靠，不需要语音识别） ═════ */
  async _startVoiceDetection() {
    this._stopVoiceDetection();
    this._startVolumeDetection();
  },

  /** 启动音量检测（AnalyserNode） */
  _startVolumeDetection() {
    const stream = this.state.cameraStream;
    if (!stream) { console.warn(`[Volume] 无媒体流`); return; }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let isSpeaking = false;
      const NOISE_FLOOR = 15;
      const SPEAKING_THRESHOLD = 40;
      let silenceStart = null;

      this.state._audioCtx = audioCtx;
      this.state._analyser = analyser;
      this.state.isRecognitionActive = true;

      this.state._volumeTimer = setInterval(() => {
        if (!this.state.isRunning || this.state.scrollMode !== `ai`) return;
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const volume = sum / buffer.length;

        const now = Date.now();
        if (volume > SPEAKING_THRESHOLD) {
          if (!isSpeaking) { isSpeaking = true; console.log(`[Volume] 说话中, 音量:`, volume.toFixed(1)); }
          silenceStart = null;
          this.state._volumePaused = false;
        } else {
          if (isSpeaking) { isSpeaking = false; silenceStart = now; console.log(`[Volume] 静音, 音量:`, volume.toFixed(1)); }
          if (silenceStart && (now - silenceStart) > 1500) { this.state._volumePaused = true; }
        }
      }, 150);

      console.log(`[Volume] 音量检测已启动`);
    } catch (e) { console.warn(`[Volume] 启动失败:`, e.message || e); }
  },

  _stopVoiceDetection() {
    this.state.isRecognitionActive = false;
    if (this.state._volumeTimer) { clearInterval(this.state._volumeTimer); this.state._volumeTimer = null; }
    if (this.state._audioCtx) { try { this.state._audioCtx.close(); } catch(e){} this.state._audioCtx = null; }
    this.state._analyser = null;
    this.state._volumePaused = false;
  },

  /* ═══════ 相机拍摄 & 录制 ═══════ */
  async capturePhoto() {
    // 切换录制模式（显示计时器）
    if (!this.state.isRecording) {
      this._startRecording();
    } else {
      this._stopRecording();
    }
  },

  _startRecording() {
    this.state.isRecording = true;
    this.state.recordingStartTime = Date.now();
    this.state.recordingSeconds = 0;
    this.state.recordedChunks = [];

    // 显示计时器
    const timerEl = document.getElementById('recording-timer');
    if (timerEl) timerEl.style.display = 'flex';
    this._updateRecordingTimer();

    // 改变按钮样式为「录制中」
    const btn = document.querySelector('.bb-capture');
    if (btn) { btn.style.background = '#FF453A'; btn.style.color = 'white'; }

    // 启动 MediaRecorder 录制视频流
    this._startMediaRecorder();

    console.log('[Camera] 录制开始');
  },

  _startMediaRecorder() {
    const stream = this.state.cameraStream;
    if (!stream) {
      console.warn('[Camera] 无视频流，无法录制');
      return;
    }

    try {
      // 优先使用 mp4 格式（iOS 原生支持）
      const mimeTypes = [
        'video/mp4',
        'video/mp4;codecs=avc1',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          mimeType = mt;
          break;
        }
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      this.state.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.state.recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        this._saveRecordedVideo();
      };

      recorder.onerror = (e) => {
        console.warn('[Camera] MediaRecorder 错误:', e.message || e);
      };

      // 每 1 秒收集一次数据（确保有数据）
      recorder.start(1000);
      console.log('[Camera] MediaRecorder 已启动，格式:', mimeType || '默认');

    } catch (e) {
      console.warn('[Camera] MediaRecorder 启动失败:', e.message || e);
    }
  },

  _stopRecording() {
    this.state.isRecording = false;
    if (this.state.recordingTimer) {
      clearInterval(this.state.recordingTimer);
      this.state.recordingTimer = null;
    }

    // 隐藏计时器
    const timerEl = document.getElementById('recording-timer');
    if (timerEl) timerEl.style.display = 'none';

    // 恢复按钮样式
    const btn = document.querySelector('.bb-capture');
    if (btn) { btn.style.background = 'rgba(255,255,255,0.9)'; btn.style.color = '#000'; }

    // 停止 MediaRecorder
    const recorder = this.state.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        console.log('[Camera] MediaRecorder 已停止');
      } catch (e) {
        console.warn('[Camera] 停止 MediaRecorder 失败:', e.message || e);
      }
    } else {
      // 如果没有 MediaRecorder，回退到截图
      this._takeCanvasSnapshot();
    }

    console.log('[Camera] 录制结束，时长:', this._formatTime(this.state.recordingSeconds));
  },

  /** 将录制的视频保存到相册 */
  async _saveRecordedVideo() {
    const chunks = this.state.recordedChunks;
    if (!chunks || chunks.length === 0) {
      console.warn('[Camera] 无录制数据');
      return;
    }

    try {
      // 合并所有片段为 Blob
      const blob = new Blob(chunks, { type: chunks[0].type || 'video/mp4' });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const filename = '逆象提词-' + Date.now() + '.' + ext;
      const file = new File([blob], filename, { type: blob.type });

      // 闪屏效果
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;opacity:0.6;pointer-events:none';
      document.body.appendChild(flash);
      requestAnimationFrame(() => { flash.style.transition = 'opacity 0.35s'; flash.style.opacity = '0'; });
      setTimeout(() => flash.remove(), 400);

      // 使用 navigator.share 保存视频（iOS 15+ WKWebView 兼容）
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '逆象提词录制' });
          console.log('[Camera] 视频已通过分享面板保存');
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.warn('[Camera] 分享失败:', e.message || e);
          }
        }
      } else {
        // 回退：创建 Blob URL 下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.log('[Camera] 视频已通过下载链接保存');
      }

    } catch (e) {
      console.warn('[Camera] 保存视频失败:', e.message || e);
    }
  },

  _updateRecordingTimer() {
    if (this.state.recordingTimer) clearInterval(this.state.recordingTimer);
    this.state.recordingTimer = setInterval(() => {
      if (!this.state.isRecording) { clearInterval(this.state.recordingTimer); return; }
      const elapsed = Math.floor((Date.now() - this.state.recordingStartTime) / 1000);
      this.state.recordingSeconds = elapsed;
      const timeEl = document.getElementById('rec-time');
      if (timeEl) timeEl.textContent = this._formatTime(elapsed);
    }, 1000);
  },

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return m + ':' + s;
  },

  /** 从视频流截取一帧并保存到相册 (WKWebView 兼容) */
  _takeCanvasSnapshot() {
    const video = document.getElementById('cameraVideo');
    if (!video || video.readyState < 2) {
      console.warn('[Camera] 视频未就绪');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      // 镜像翻转（前置镜头通常需要）
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 闪屏效果
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;opacity:0.6;pointer-events:none';
      document.body.appendChild(flash);
      requestAnimationFrame(() => { flash.style.transition = 'opacity 0.35s'; flash.style.opacity = '0'; });
      setTimeout(() => flash.remove(), 400);

      // 使用 navigator.share 保存图片（iOS 15+ WKWebView 兼容）
      // link.click() 在 WKWebView 中无法触发 data URL 下载
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.warn('[Camera] canvas.toBlob 失败');
          return;
        }
        const file = new File([blob], 'teleprompter-' + Date.now() + '.png', { type: 'image/png' });

        // 优先使用 Web Share API (触发 iOS 分享面板 → 保存图片)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] });
            console.log('[Camera] 截图已通过分享面板保存');
          } catch (e) {
            // 用户取消分享不算错误
            if (e.name !== 'AbortError') {
              console.warn('[Camera] 分享失败:', e.message || e);
            }
          }
        } else {
          // 回退：创建 Blob URL 下载（桌面浏览器测试用）
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'teleprompter-' + Date.now() + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          console.log('[Camera] 截图已通过下载链接保存');
        }
      }, 'image/png');

    } catch (e) {
      console.warn('[Camera] 截图失败:', e);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
