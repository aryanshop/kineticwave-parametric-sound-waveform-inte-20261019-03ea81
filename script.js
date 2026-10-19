/* KineticWave: Parametric Sound Waveform & Interference Lab */

document.addEventListener('DOMContentLoaded', () => {
    // Wave Source Model State
    const defaultWaves = [
        { id: 1, name: 'Wave Alpha', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
        { id: 2, name: 'Wave Beta', freq: 224, amp: 1.0, phase: 0, type: 'sine', color: '#8b5cf6', active: true }
    ];

    let waves = JSON.parse(JSON.stringify(defaultWaves));
    let time = 0;
    let isAudioActive = false;
    let audioCtx = null;
    let oscillators = [];
    let gainNodes = [];
    let animationFrameId = null;
    let fpsTimer = 0;
    let frameCount = 0;
    let currentFps = 60;

    // DOM Elements
    const waveCanvas = document.getElementById('waveCanvas');
    const waveCtx = waveCanvas.getContext('2d');
    const lissajousCanvas = document.getElementById('lissajousCanvas');
    const lissajousCtx = lissajousCanvas.getContext('2d');
    const wavesContainer = document.getElementById('wavesContainer');
    const playAudioBtn = document.getElementById('playAudioBtn');
    const resetBtn = document.getElementById('resetBtn');
    const addWaveBtn = document.getElementById('addWaveBtn');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const interferenceStatus = document.getElementById('interferenceStatus');
    
    // Metric Elements
    const maxAmpVal = document.getElementById('maxAmpVal');
    const beatFreqVal = document.getElementById('beatFreqVal');
    const wavelengthVal = document.getElementById('wavelengthVal');
    const energyVal = document.getElementById('energyVal');

    // Color palette for dynamically added waves
    const waveColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

    // Initialize UI
    function init() {
        renderWaveControls();
        setupEventListeners();
        startAnimationLoop();
    }

    // Render Wave Control Cards
    function renderWaveControls() {
        wavesContainer.innerHTML = '';
        waves.forEach((wave, index) => {
            const card = document.createElement('div');
            card.className = 'wave-card';
            card.style.setProperty('--wave-color', wave.color);
            card.innerHTML = `
                <div class="wave-card-header">
                    <div class="wave-title">
                        <span class="wave-badge" style="background-color: ${wave.color}"></span>
                        <span>${wave.name}</span>
                    </div>
                    <div class="wave-actions">
                        <label class="toggle-switch" title="Toggle Wave Source">
                            <input type="checkbox" data-id="${wave.id}" class="wave-toggle" ${wave.active ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        ${waves.length > 1 ? `<button class="btn-small remove-wave" data-id="${wave.id}" title="Remove Wave">✕</button>` : ''}
                    </div>
                </div>
                <div class="control-group">
                    <div class="control-label-row">
                        <span>Frequency</span>
                        <span>${wave.freq} Hz</span>
                    </div>
                    <input type="range" min="50" max="880" step="1" value="${wave.freq}" data-id="${wave.id}" data-param="freq">
                </div>
                <div class="control-group">
                    <div class="control-label-row">
                        <span>Amplitude</span>
                        <span>${wave.amp.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.05" value="${wave.amp}" data-id="${wave.id}" data-param="amp">
                </div>
                <div class="control-group">
                    <div class="control-label-row">
                        <span>Phase Shift</span>
                        <span>${wave.phase}&deg;</span>
                    </div>
                    <input type="range" min="0" max="360" step="5" value="${wave.phase}" data-id="${wave.id}" data-param="phase">
                </div>
                <div class="control-group">
                    <div class="control-label-row">
                        <span>Waveform Type</span>
                        <select data-id="${wave.id}" data-param="type">
                            <option value="sine" ${wave.type === 'sine' ? 'selected' : ''}>Sine</option>
                            <option value="square" ${wave.type === 'square' ? 'selected' : ''}>Square</option>
                            <option value="triangle" ${wave.type === 'triangle' ? 'selected' : ''}>Triangle</option>
                        </select>
                    </div>
                </div>
            `;
            wavesContainer.appendChild(card);
        });

        attachCardListeners();
    }

    // Event Listeners for controls
    function setupEventListeners() {
        playAudioBtn.addEventListener('click', toggleAudioPreview);
        resetBtn.addEventListener('click', resetToDefaults);
        addWaveBtn.addEventListener('click', addWaveSource);

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                applyPreset(e.target.dataset.preset);
            });
        });
    }

    function attachCardListeners() {
        document.querySelectorAll('.wave-card input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = parseInt(e.target.dataset.id);
                const param = e.target.dataset.param;
                const val = parseFloat(e.target.value);
                updateWaveParam(id, param, val);
            });
        });

        document.querySelectorAll('.wave-card select').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const param = e.target.dataset.param;
                const val = e.target.value;
                updateWaveParam(id, param, val);
            });
        });

        document.querySelectorAll('.wave-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const wave = waves.find(w => w.id === id);
                if (wave) {
                    wave.active = e.target.checked;
                    if (isAudioActive) updateAudioNodes();
                }
            });
        });

        document.querySelectorAll('.remove-wave').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id);
                waves = waves.filter(w => w.id !== id);
                renderWaveControls();
                if (isAudioActive) updateAudioNodes();
            });
        });
    }

    function updateWaveParam(id, param, val) {
        const wave = waves.find(w => w.id === id);
        if (wave) {
            wave[param] = val;
            // Update displayed value instantly
            const card = document.querySelector(`.wave-card [data-id="${id}"][data-param="${param}"]`)?.closest('.control-group');
            if (card) {
                const labelSpan = card.querySelector('.control-label-row span:last-child');
                if (labelSpan && param !== 'type') {
                    if (param === 'phase') labelSpan.innerHTML = `${val}&deg;`;
                    else if (param === 'freq') labelSpan.innerHTML = `${val} Hz`;
                    else labelSpan.innerHTML = val.toFixed(2);
                }
            }
            if (isAudioActive) updateAudioNodes();
        }
    }

    function addWaveSource() {
        if (waves.length >= 4) return; // Limit to 4 waves for clarity
        const newId = waves.length > 0 ? Math.max(...waves.map(w => w.id)) + 1 : 1;
        const color = waveColors[waves.length % waveColors.length];
        waves.push({
            id: newId,
            name: `Wave ${String.fromCharCode(65 + waves.length)}`,
            freq: 330 + waves.length * 55,
            amp: 0.8,
            phase: 0,
            type: 'sine',
            color: color,
            active: true
        });
        renderWaveControls();
        if (isAudioActive) updateAudioNodes();
    }

    function resetToDefaults() {
        waves = JSON.parse(JSON.stringify(defaultWaves));
        renderWaveControls();
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.preset-btn[data-preset="unison"]').classList.add('active');
        if (isAudioActive) updateAudioNodes();
    }

    function applyPreset(presetName) {
        switch (presetName) {
            case 'unison':
                waves = [
                    { id: 1, name: 'Wave Alpha', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
                    { id: 2, name: 'Wave Beta', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#8b5cf6', active: true }
                ];
                break;
            case 'beats':
                waves = [
                    { id: 1, name: 'Wave Alpha', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
                    { id: 2, name: 'Wave Beta', freq: 223, amp: 1.0, phase: 0, type: 'sine', color: '#8b5cf6', active: true }
                ];
                break;
            case 'octave':
                waves = [
                    { id: 1, name: 'Wave Alpha', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
                    { id: 2, name: 'Wave Beta', freq: 440, amp: 0.5, phase: 0, type: 'sine', color: '#8b5cf6', active: true }
                ];
                break;
            case 'cancellation':
                waves = [
                    { id: 1, name: 'Wave Alpha', freq: 220, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
                    { id: 2, name: 'Wave Beta', freq: 220, amp: 1.0, phase: 180, type: 'sine', color: '#8b5cf6', active: true }
                ];
                break;
            case 'standing':
                waves = [
                    { id: 1, name: 'Wave Forward', freq: 300, amp: 1.0, phase: 0, type: 'sine', color: '#06b6d4', active: true },
                    { id: 2, name: 'Wave Reverse', freq: 300, amp: 1.0, phase: 90, type: 'sine', color: '#8b5cf6', active: true }
                ];
                break;
        }
        renderWaveControls();
        if (isAudioActive) updateAudioNodes();
    }

    // Web Audio API Synthesis
    function toggleAudioPreview() {
        if (!isAudioActive) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                setupAudioNodes();
                isAudioActive = true;
                playAudioBtn.textContent = '🔇 Disable Audio Preview';
                playAudioBtn.classList.add('active');
                playAudioBtn.setAttribute('aria-pressed', 'true');
            } catch (e) {
                console.error('Web Audio API not supported', e);
            }
        } else {
            stopAudioPreview();
        }
    }

    function setupAudioNodes() {
        if (!audioCtx) return;
        stopAudioPreviewNodes();

        waves.forEach(wave => {
            if (!wave.active) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = wave.type;
            osc.frequency.setValueAtTime(wave.freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(wave.amp * 0.1, audioCtx.currentTime); // Safe low gain

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();

            oscillators.push(osc);
            gainNodes.push(gain);
        });
    }

    function updateAudioNodes() {
        if (!audioCtx || !isAudioActive) return;
        setupAudioNodes();
    }

    function stopAudioPreviewNodes() {
        oscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {}
        });
        oscillators = [];
        gainNodes = [];
    }

    function stopAudioPreview() {
        stopAudioPreviewNodes();
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
        isAudioActive = false;
        playAudioBtn.textContent = '🔊 Enable Audio Preview';
        playAudioBtn.classList.remove('active');
        playAudioBtn.setAttribute('aria-pressed', 'false');
    }

    // Waveform math calculation
    function calculateWaveValue(x, t, wave) {
        const phaseRad = (wave.phase * Math.PI) / 180;
        const omega = 2 * Math.PI * wave.freq * 0.001;
        const k = 0.015;
        const angle = k * x - omega * t + phaseRad;

        switch (wave.type) {
            case 'square':
                let sumSq = 0;
                for (let n = 1; n <= 5; n += 2) {
                    sumSq += Math.sin(n * angle) / n;
                }
                return wave.amp * (4 / Math.PI) * sumSq;
            case 'triangle':
                let sumTri = 0;
                for (let n = 0; n < 3; n++) {
                    const sign = n % 2 === 0 ? 1 : -1;
                    sumTri += sign * Math.sin((2 * n + 1) * angle) / Math.pow(2 * n + 1, 2);
                }
                return wave.amp * (8 / (Math.PI * Math.PI)) * sumTri;
            case 'sine':
            default:
                return wave.amp * Math.sin(angle);
        }
    }

    // Canvas Animation Loop
    function startAnimationLoop() {
        function animate(timestamp) {
            // FPS Calculation
            frameCount++;
            if (timestamp - fpsTimer >= 1000) {
                currentFps = frameCount;
                frameCount = 0;
                fpsTimer = timestamp;
                fpsDisplay.textContent = `${currentFps} FPS`;
            }

            time += 1.5;
            renderWaveCanvas(time);
            renderLissajousCanvas(time);
            updateMetrics();

            animationFrameId = requestAnimationFrame(animate);
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    function renderWaveCanvas(t) {
        const width = waveCanvas.width;
        const height = waveCanvas.height;
        waveCtx.clearRect(0, 0, width, height);

        // Draw background grid lines
        waveCtx.strokeStyle = '#1e293b';
        waveCtx.lineWidth = 1;
        waveCtx.beginPath();
        for (let x = 0; x < width; x += 50) {
            waveCtx.moveTo(x, 0);
            waveCtx.lineTo(x, height);
        }
        for (let y = 0; y < height; y += 50) {
            waveCtx.moveTo(0, y);
            waveCtx.lineTo(width, y);
        }
        waveCtx.stroke();

        // Draw Center Axis
        waveCtx.strokeStyle = '#334155';
        waveCtx.lineWidth = 2;
        waveCtx.beginPath();
        waveCtx.moveTo(0, height / 2);
        waveCtx.lineTo(width, height / 2);
        waveCtx.stroke();

        const activeWaves = waves.filter(w => w.active);

        // Draw Individual Waves (Faded)
        activeWaves.forEach(wave => {
            waveCtx.strokeStyle = wave.color;
            waveCtx.globalAlpha = 0.35;
            waveCtx.lineWidth = 1.5;
            waveCtx.beginPath();

            for (let x = 0; x < width; x++) {
                const yVal = calculateWaveValue(x, t, wave);
                const screenY = (height / 2) - (yVal * 45);
                if (x === 0) waveCtx.moveTo(x, screenY);
                else waveCtx.lineTo(x, screenY);
            }
            waveCtx.stroke();
        });

        // Draw Combined Wave (Interference)
        if (activeWaves.length > 0) {
            waveCtx.strokeStyle = '#f0f4f8';
            waveCtx.globalAlpha = 1.0;
            waveCtx.lineWidth = 3;
            waveCtx.beginPath();

            for (let x = 0; x < width; x++) {
                let combinedY = 0;
                activeWaves.forEach(wave => {
                    combinedY += calculateWaveValue(x, t, wave);
                });
                const screenY = (height / 2) - (combinedY * 45);
                if (x === 0) waveCtx.moveTo(x, screenY);
                else waveCtx.lineTo(x, screenY);
            }
            waveCtx.stroke();
        }
    }

    function renderLissajousCanvas(t) {
        const width = lissajousCanvas.width;
        const height = lissajousCanvas.height;
        lissajousCtx.clearRect(0, 0, width, height);

        const activeWaves = waves.filter(w => w.active);
        if (activeWaves.length < 2) {
            lissajousCtx.fillStyle = '#94a3b8';
            lissajousCtx.font = '11px sans-serif';
            lissajousCtx.textAlign = 'center';
            lissajousCtx.fillText('Requires 2+ active waves', width / 2, height / 2);
            return;
        }

        const w1 = activeWaves[0];
        const w2 = activeWaves[1];

        lissajousCtx.strokeStyle = varColor('--accent-cyan', '#06b6d4');
        lissajousCtx.lineWidth = 1.5;
        lissajousCtx.beginPath();

        const pointsCount = 300;
        for (let i = 0; i < pointsCount; i++) {
            const sampleT = t + (i * 2);
            const xVal = calculateWaveValue(0, sampleT, w1);
            const yVal = calculateWaveValue(0, sampleT, w2);

            const screenX = (width / 2) + (xVal * (width / 3));
            const screenY = (height / 2) - (yVal * (height / 3));

            if (i === 0) lissajousCtx.moveTo(screenX, screenY);
            else lissajousCtx.lineTo(screenX, screenY);
        }
        lissajousCtx.stroke();
    }

    function varColor(name, fallback) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function updateMetrics() {
        const activeWaves = waves.filter(w => w.active);
        if (activeWaves.length === 0) {
            maxAmpVal.textContent = '0.00';
            beatFreqVal.textContent = '0.00 Hz';
            wavelengthVal.textContent = '-';
            energyVal.textContent = 'None';
            interferenceStatus.textContent = 'No Active Waves';
            return;
        }

        // Max Amplitude calculation estimation
        let maxAmp = 0;
        for (let x = 0; x < 200; x += 10) {
            let sum = 0;
            activeWaves.forEach(w => sum += Math.abs(calculateWaveValue(x, time, w)));
            if (sum > maxAmp) maxAmp = sum;
        }
        maxAmpVal.textContent = maxAmp.toFixed(2);

        // Beat Frequency (if 2 waves have different frequencies)
        if (activeWaves.length >= 2) {
            const f1 = activeWaves[0].freq;
            const f2 = activeWaves[1].freq;
            const beat = Math.abs(f1 - f2);
            beatFreqVal.textContent = `${beat.toFixed(2)} Hz`;

            if (beat === 0 && activeWaves[0].phase !== activeWaves[1].phase) {
                if (Math.abs(activeWaves[0].phase - activeWaves[1].phase) === 180) {
                    interferenceStatus.textContent = 'Destructive Interference (Cancellation)';
                } else {
                    interferenceStatus.textContent = 'Constructive Interference (In-Phase)';
                }
            } else if (beat > 0) {
                interferenceStatus.textContent = `Acoustic Beating (${beat. Hz})`;
            } else {
                interferenceStatus.textContent = 'Harmonic Superposition';
            }
        } else {
            beatFreqVal.textContent = '0.00 Hz';
            interferenceStatus.textContent = 'Single Wave Generator Active';
        }

        // Dominant Wavelength & Energy
        const avgFreq = activeWaves.reduce((acc, w) => acc + w.freq, 0) / activeWaves.length;
        const approxWavelength = (343 / avgFreq).toFixed(2);
        wavelengthVal.textContent = `${approxWavelength} m`;

        const totalAmp = activeWaves.reduce((acc, w) => acc + w.amp, 0);
        if (totalAmp > 3) energyVal.textContent = 'High (Intense)';
        else if (totalAmp > 1.5) energyVal.textContent = 'Moderate';
        else energyVal.textContent = 'Low (Soft)';
    }

    // Run initialization
    init();
});
