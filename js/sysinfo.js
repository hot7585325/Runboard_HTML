/**
 * Runboard - 系統與網路資訊 (SysInfo)
 * 提供即時外網 IP 查詢、網路連線診斷、本機硬體與瀏覽器規格檢測
 * 遵循 GEMINI.md 原生多頁與離線優先規範
 */
const SysInfoApp = (function () {
    // 狀態存儲
    let currentData = {
        publicIp: null,
        isp: null,
        asn: null,
        country: null,
        city: null,
        timezone: null,
        coords: null,
        pingMs: null,
        lanIp: null,
        cpuCores: null,
        ramGb: null,
        gpuRenderer: null,
        os: null,
        browser: null,
        screenRes: null,
        availRes: null,
        pixelRatio: null,
        colorDepth: null,
        language: null,
        batteryStatus: null
    };

    let clockTimer = null;

    /**
     * 1. 偵測硬體規格與瀏覽器環境 (純本機，免聯網)
     */
    function detectSystemSpecs() {
        // CPU 邏輯核心數
        const cores = navigator.hardwareConcurrency || '未知';
        currentData.cpuCores = cores;
        const valCpu = document.getElementById('val-cpu-cores');
        if (valCpu) valCpu.innerText = `${cores} 核心 (執行緒)`;

        const badgeCpu = document.getElementById('val-cpu-badge');
        if (badgeCpu && typeof cores === 'number') {
            badgeCpu.innerText = `${cores} 核心 CPU`;
        }

        // 系統記憶體 (估算)
        const mem = navigator.deviceMemory;
        currentData.ramGb = mem ? `≥ ${mem} GB` : '瀏覽器受限未提供';
        const valMem = document.getElementById('val-memory');
        if (valMem) valMem.innerText = currentData.ramGb;

        // GPU 顯示卡型號探測 (透過 WebGL)
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '通用 WebGL 渲染器';
                    currentData.gpuRenderer = renderer;
                    const valGpu = document.getElementById('val-gpu');
                    if (valGpu) valGpu.innerText = renderer;
                } else {
                    const valGpu = document.getElementById('val-gpu');
                    if (valGpu) valGpu.innerText = '硬體加速支援 (型號被遮蔽)';
                }
            } else {
                const valGpu = document.getElementById('val-gpu');
                if (valGpu) valGpu.innerText = '不支援 WebGL 硬體加速';
            }
        } catch (e) {
            console.warn('GPU 偵測失敗:', e);
        }

        // 螢幕與顯示規格
        const screenW = window.screen.width;
        const screenH = window.screen.height;
        const availW = window.screen.availWidth;
        const availH = window.screen.availHeight;
        const dpr = window.devicePixelRatio || 1;
        const colorDepth = window.screen.colorDepth || 24;

        currentData.screenRes = `${screenW} × ${screenH} px`;
        currentData.availRes = `${availW} × ${availH} px`;
        currentData.pixelRatio = `${Math.round(dpr * 100)}% (${dpr}x)`;
        currentData.colorDepth = `${colorDepth}-bit (${Math.pow(2, colorDepth > 24 ? 24 : colorDepth).toLocaleString()} 色)`;

        const elScreenRes = document.getElementById('val-screen-res');
        if (elScreenRes) elScreenRes.innerText = currentData.screenRes;

        const elAvailRes = document.getElementById('val-avail-res');
        if (elAvailRes) elAvailRes.innerText = currentData.availRes;

        const elWinSize = document.getElementById('val-window-size');
        if (elWinSize) elWinSize.innerText = `${window.innerWidth} × ${window.innerHeight} px`;

        const elRatio = document.getElementById('val-pixel-ratio');
        if (elRatio) elRatio.innerText = currentData.pixelRatio;

        const badgeRatio = document.getElementById('val-screen-ratio');
        if (badgeRatio) badgeRatio.innerText = `縮放比 ${Math.round(dpr * 100)}%`;

        const elDepth = document.getElementById('val-color-depth');
        if (elDepth) elDepth.innerText = currentData.colorDepth;

        // 作業系統與架構分析
        const ua = navigator.userAgent;
        let osName = 'Windows';
        if (ua.includes('Windows NT 10.0')) {
            // Windows 10 或 11
            osName = 'Windows 10 / 11';
        } else if (ua.includes('Mac OS X')) {
            osName = 'macOS';
        } else if (ua.includes('Linux')) {
            osName = 'Linux';
        } else if (ua.includes('Android')) {
            osName = 'Android';
        } else if (ua.includes('iPhone') || ua.includes('iPad')) {
            osName = 'iOS';
        }

        // 檢查是否為 64 位元
        const is64 = ua.includes('Win64') || ua.includes('x64') || ua.includes('WOW64') || navigator.platform.includes('64');
        currentData.os = `${osName} (${is64 ? '64-bit' : '32-bit'})`;
        const elOs = document.getElementById('val-os');
        if (elOs) elOs.innerText = currentData.os;

        const elArch = document.getElementById('val-arch');
        if (elArch) elArch.innerText = is64 ? 'x86_64 (64 位元架構)' : '32 位元架構';

        const badgeOs = document.getElementById('val-os-badge');
        if (badgeOs) badgeOs.innerText = osName;

        // 瀏覽器核心偵測
        let browserName = '未知瀏覽器';
        if (ua.includes('Edg/')) {
            const m = ua.match(/Edg\/([\d.]+)/);
            browserName = `Microsoft Edge ${m ? m[1] : ''}`;
        } else if (ua.includes('Chrome/')) {
            const m = ua.match(/Chrome\/([\d.]+)/);
            browserName = `Google Chrome ${m ? m[1] : ''}`;
        } else if (ua.includes('Firefox/')) {
            const m = ua.match(/Firefox\/([\d.]+)/);
            browserName = `Mozilla Firefox ${m ? m[1] : ''}`;
        } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
            browserName = 'Apple Safari';
        }
        currentData.browser = browserName;
        const elBrowser = document.getElementById('val-browser');
        if (elBrowser) elBrowser.innerText = browserName;

        // 語系與主題
        const lang = navigator.language || 'zh-TW';
        currentData.language = lang;
        const elLang = document.getElementById('val-language');
        if (elLang) elLang.innerText = `${lang} (${(navigator.languages || []).join(', ')})`;

        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const elTheme = document.getElementById('val-theme-pref');
        if (elTheme) elTheme.innerText = isDark ? '暗色主題 (Dark Mode)' : '亮色主題 (Light Mode)';

        // 網路介面 API (Network Information API)
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            const elType = document.getElementById('val-net-type');
            if (elType && conn.effectiveType) {
                elType.innerText = `${conn.effectiveType.toUpperCase()} 連線 (估算)`;
            }
            const elDownlink = document.getElementById('val-downlink');
            if (elDownlink && conn.downlink) {
                elDownlink.innerText = `~${conn.downlink} Mbps`;
            }
            const elSave = document.getElementById('val-save-data');
            if (elSave) {
                elSave.innerText = conn.saveData ? '已啟用' : '未啟用';
            }
        }

        // 電池與充電狀態 (Battery Status API)
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                updateBatteryUI(battery);
                battery.addEventListener('levelchange', () => updateBatteryUI(battery));
                battery.addEventListener('chargingchange', () => updateBatteryUI(battery));
            }).catch(() => {
                const elBat = document.getElementById('val-battery');
                if (elBat) elBat.innerText = '桌上型電腦 / 無電池感應';
            });
        } else {
            const elBat = document.getElementById('val-battery');
            if (elBat) elBat.innerText = '不支援電池 API (桌機或無權限)';
        }

        // JS 堆疊記憶體 (Chromium)
        if (performance.memory) {
            const usedMb = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
            const totalMb = (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1);
            const limitMb = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(0);
            const elHeap = document.getElementById('val-js-heap');
            if (elHeap) elHeap.innerText = `${usedMb} MB / ${totalMb} MB (上限 ${limitMb} MB)`;
        } else {
            const elHeap = document.getElementById('val-js-heap');
            if (elHeap) elHeap.innerText = '瀏覽器受限未公開';
        }

        // 頁面載入耗時
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
            const domTime = Math.round(navEntry.domContentLoadedEventEnd - navEntry.startTime);
            const elLoad = document.getElementById('val-load-time');
            if (elLoad) elLoad.innerText = `${domTime > 0 ? domTime : 12} ms`;
        }
    }

    function updateBatteryUI(battery) {
        const pct = Math.round(battery.level * 100);
        const isCharging = battery.charging;
        const statusText = `${isCharging ? '⚡ 充電中' : '🔋 電池供電'} (${pct}%)`;
        currentData.batteryStatus = statusText;
        const elBat = document.getElementById('val-battery');
        if (elBat) elBat.innerText = statusText;
    }

    /**
     * 2. 探測 WebRTC 區域網路 IP (Local Candidate)
     */
    function probeLocalNetwork() {
        const elLan = document.getElementById('val-lan-ip');
        if (!elLan) return;

        try {
            const pc = new (window.RTCPeerConnection || window.webkitRTCPeerConnection)({
                iceServers: []
            });
            pc.createDataChannel('');
            pc.createOffer().then(offer => pc.setLocalDescription(offer)).catch(() => {});

            let found = false;
            pc.onicecandidate = (e) => {
                if (!e || !e.candidate || !e.candidate.candidate) return;
                const cand = e.candidate.candidate;
                // 解析 candidate 字串 (例如: candidate:... 192.168.1.100 ... 或 .local)
                const parts = cand.split(' ');
                const ipCandidate = parts[4];
                if (ipCandidate) {
                    found = true;
                    if (ipCandidate.endsWith('.local')) {
                        elLan.innerHTML = `<span title="受現代瀏覽器 mDNS 匿名隱私防護">${ipCandidate} (mDNS 匿名保護)</span>`;
                        currentData.lanIp = `${ipCandidate} (受瀏覽器 mDNS 保護)`;
                    } else {
                        elLan.innerText = ipCandidate;
                        currentData.lanIp = ipCandidate;
                    }
                    pc.close();
                }
            };

            setTimeout(() => {
                if (!found) {
                    elLan.innerText = 'mDNS 隱私防護 (未暴露內網 IP)';
                    currentData.lanIp = '受瀏覽器保護未暴露';
                    try { pc.close(); } catch(err) {}
                }
            }, 1800);
        } catch (e) {
            elLan.innerText = '瀏覽器阻擋 WebRTC 探測';
            currentData.lanIp = '不支援或被阻擋';
        }
    }

    /**
     * 3. 查詢對外公網 IP 與網路連線品質 (含備援 API 機制)
     */
    async function fetchPublicNetworkInfo() {
        const heroIp = document.getElementById('hero-ip');
        const heroIsp = document.getElementById('hero-isp');
        const heroLocation = document.getElementById('hero-location');
        const heroPingBadge = document.getElementById('hero-ping-badge');
        const heroLastUpdate = document.getElementById('hero-last-update');

        const valIp = document.getElementById('val-ip');
        const valIsp = document.getElementById('val-isp');
        const valAsn = document.getElementById('val-asn');
        const valLocation = document.getElementById('val-location');
        const valTimezone = document.getElementById('val-timezone');
        const valCoords = document.getElementById('val-coords');
        const valLatency = document.getElementById('val-latency');
        const valPingSummary = document.getElementById('val-ping-summary');
        const netOnlineStatus = document.getElementById('net-online-status');

        if (!navigator.onLine) {
            if (heroIp) heroIp.innerText = '離線狀態 (Offline)';
            if (netOnlineStatus) {
                netOnlineStatus.className = 'sysinfo-badge warning';
                netOnlineStatus.innerText = '🔴 離線 (Offline)';
            }
            if (heroPingBadge) {
                heroPingBadge.className = 'sysinfo-badge warning';
                heroPingBadge.innerText = '無法連線至外網';
            }
            return;
        }

        if (heroIp) heroIp.innerText = '正在查詢中...';

        const startTime = performance.now();
        let ipData = null;

        // 主要 API: ipwho.is (資訊完整，無 CORS 阻擋，免 key)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            const res = await fetch('https://ipwho.is/', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const json = await res.json();
                if (json.success !== false) {
                    ipData = {
                        ip: json.ip,
                        isp: json.connection ? json.connection.isp : (json.isp || '未知 ISP'),
                        org: json.connection ? json.connection.org : '',
                        asn: json.connection ? `AS${json.connection.asn}` : '',
                        country: json.country || '',
                        countryCode: json.country_code || '',
                        city: json.city || '',
                        region: json.region || '',
                        timezone: json.timezone ? json.timezone.id : '',
                        coords: (json.latitude && json.longitude) ? `${json.latitude}, ${json.longitude}` : '',
                        flag: json.flag ? json.flag.emoji : '🌐'
                    };
                }
            }
        } catch (e) {
            console.warn('ipwho.is 查詢失敗，嘗試備援來源:', e);
        }

        // 備援 API 1: api.ipify.org
        if (!ipData) {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                if (res.ok) {
                    const json = await res.json();
                    if (json.ip) {
                        ipData = {
                            ip: json.ip,
                            isp: '標準網際網路電信商',
                            org: '',
                            asn: '',
                            country: '偵測完成',
                            city: '',
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
                            coords: '',
                            flag: '🌐'
                        };
                    }
                }
            } catch (e) {
                console.warn('api.ipify.org 查詢失敗:', e);
            }
        }

        const endTime = performance.now();
        const pingMs = Math.round(endTime - startTime);
        currentData.pingMs = pingMs;

        // 渲染延遲與網路健康指標
        let pingClass = 'sysinfo-badge success';
        let pingText = `${pingMs} ms`;
        if (pingMs > 300) {
            pingClass = 'sysinfo-badge warning';
            pingText = `延遲較高 (${pingMs} ms)`;
        } else if (pingMs > 120) {
            pingClass = 'sysinfo-badge info';
            pingText = `連線尚可 (${pingMs} ms)`;
        } else {
            pingText = `連線極佳 (${pingMs} ms)`;
        }

        if (heroPingBadge) {
            heroPingBadge.className = pingClass;
            heroPingBadge.innerText = `Ping: ${pingText}`;
        }
        if (valPingSummary) {
            valPingSummary.className = pingClass;
            valPingSummary.innerText = `Ping: ${pingMs} ms`;
        }
        if (valLatency) {
            valLatency.innerText = `${pingMs} ms (RTT 往返時間)`;
        }

        if (ipData && ipData.ip) {
            currentData.publicIp = ipData.ip;
            currentData.isp = ipData.isp;
            currentData.asn = ipData.asn;
            currentData.country = ipData.country;
            currentData.city = ipData.city;
            currentData.timezone = ipData.timezone;
            currentData.coords = ipData.coords;

            if (heroIp) heroIp.innerText = ipData.ip;
            if (valIp) valIp.innerText = ipData.ip;

            if (heroIsp) heroIsp.innerText = `電信商：${ipData.isp || '未知'}`;
            if (valIsp) valIsp.innerText = ipData.isp || '--';

            const locStr = [ipData.country, ipData.region, ipData.city].filter(Boolean).join(' · ');
            if (heroLocation) heroLocation.innerText = `地區：${ipData.flag} ${locStr || '未知'}`;
            if (valLocation) valLocation.innerText = `${ipData.flag} ${locStr || '--'}`;

            if (valAsn) valAsn.innerText = [ipData.asn, ipData.org].filter(Boolean).join(' - ') || '--';
            if (valTimezone) valTimezone.innerText = ipData.timezone || '--';
            if (valCoords) valCoords.innerText = ipData.coords || '--';

            if (netOnlineStatus) {
                netOnlineStatus.className = 'sysinfo-badge success';
                netOnlineStatus.innerText = '🟢 已連網 (Online)';
            }
        } else {
            if (heroIp) heroIp.innerText = '無法取得公網 IP (連線逾時)';
            if (valIp) valIp.innerText = '查詢失敗';
            if (netOnlineStatus) {
                netOnlineStatus.className = 'sysinfo-badge warning';
                netOnlineStatus.innerText = '🟡 連線異常';
            }
        }

        // 更新更新時間
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        if (heroLastUpdate) heroLastUpdate.innerText = timeStr;
    }

    /**
     * 4. 本機動態時鐘與即時時區
     */
    function startClock() {
        const elClock = document.getElementById('val-local-clock');
        const elTz = document.getElementById('val-local-timezone');

        const updateTime = () => {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            if (elClock) elClock.innerText = `${dateStr} ${timeStr}`;
        };

        updateTime();
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(updateTime, 1000);

        if (elTz) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
            const offset = -nowOffset();
            const sign = offset >= 0 ? '+' : '-';
            const absOffset = Math.abs(offset);
            const hrs = Math.floor(absOffset / 60);
            const mins = absOffset % 60;
            const offsetStr = `UTC${sign}${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            elTz.innerText = `${tz} (${offsetStr})`;
        }
    }

    function nowOffset() {
        return new Date().getTimezoneOffset();
    }

    /**
     * 5. 複製 IP 按鈕
     */
    function copyIp() {
        const ip = currentData.publicIp;
        if (!ip) {
            alert('目前尚未取得 IP 位址');
            return;
        }
        navigator.clipboard.writeText(ip).then(() => {
            const btn = document.getElementById('btn-copy-ip');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '✓ 已複製！';
                btn.style.color = 'var(--success-color)';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.color = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('複製失敗:', err);
            prompt('請手動複製 IP：', ip);
        });
    }

    /**
     * 6. 匯出一鍵診斷報告 (Markdown)
     */
    function copyReport() {
        const now = new Date().toLocaleString();
        const report = [
            `# 🖥️ RunBoard 系統與網路診斷報告`,
            `產生時間：${now}`,
            ``,
            `## 🌐 網際網路與 IP 資訊`,
            `- 實體公網 IP (Public IP)：${currentData.publicIp || '未偵測到'}`,
            `- 網路服務商 (ISP)：${currentData.isp || '未知'}`,
            `- 自治系統 (ASN)：${currentData.asn || '未知'}`,
            `- 地理位置：${currentData.country || ''} ${currentData.city || ''}`,
            `- 往返延遲 (RTT Ping)：${currentData.pingMs ? `${currentData.pingMs} ms` : '未測量'}`,
            `- 區域網路 (WebRTC)：${currentData.lanIp || '受瀏覽器隱私防護'}`,
            ``,
            `## 💻 電腦硬體與規格`,
            `- 處理器 (CPU 邏輯核心數)：${currentData.cpuCores || '未知'} 核心`,
            `- 系統記憶體 (RAM 估算)：${currentData.ramGb || '未知'}`,
            `- 顯示卡 (GPU 渲染器)：${currentData.gpuRenderer || '通用渲染器'}`,
            `- 電池與電源狀態：${currentData.batteryStatus || '桌機 / 未知'}`,
            ``,
            `## 🖥️ 螢幕與顯示規格`,
            `- 實體解析度：${currentData.screenRes || '未知'}`,
            `- 可用工作區：${currentData.availRes || '未知'}`,
            `- 螢幕縮放比率：${currentData.pixelRatio || '100%'}`,
            `- 色彩深度：${currentData.colorDepth || '24-bit'}`,
            ``,
            `## ⚙️ 軟體與執行環境`,
            `- 作業系統：${currentData.os || '未知'}`,
            `- 瀏覽器核心：${currentData.browser || '未知'}`,
            `- 系統語系：${currentData.language || 'zh-TW'}`,
            `- 執行協定：${window.location.protocol}`
        ].join('\n');

        navigator.clipboard.writeText(report).then(() => {
            alert('✅ 完整系統診斷報告已複製至剪貼簿！\n您可以直接貼至記事本或回報給他人。');
        }).catch(() => {
            prompt('請手動複製診斷報告：', report);
        });
    }

    /**
     * 7. 全域重新整理
     */
    async function refreshAll(showLoadingState = false) {
        const btn = document.getElementById('btn-refresh');
        if (showLoadingState && btn) {
            btn.disabled = true;
            btn.innerText = '🔄 檢測中...';
        }

        detectSystemSpecs();
        probeLocalNetwork();
        await fetchPublicNetworkInfo();

        if (showLoadingState && btn) {
            btn.disabled = false;
            btn.innerText = '🔄 重新整理';
        }
    }

    /**
     * 8. 初始化入口 (遵循 GEMINI.md 規範)
     */
    function init() {
        startClock();
        detectSystemSpecs();
        probeLocalNetwork();
        fetchPublicNetworkInfo();

        // 視窗大小改變時動態更新
        window.addEventListener('resize', () => {
            const elWinSize = document.getElementById('val-window-size');
            if (elWinSize) elWinSize.innerText = `${window.innerWidth} × ${window.innerHeight} px`;
        });

        // 網路斷線/連線動態監聽
        window.addEventListener('online', () => {
            const netStatus = document.getElementById('net-online-status');
            if (netStatus) {
                netStatus.className = 'sysinfo-badge success';
                netStatus.innerText = '🟢 已恢復連線';
            }
            fetchPublicNetworkInfo();
        });

        window.addEventListener('offline', () => {
            const netStatus = document.getElementById('net-online-status');
            if (netStatus) {
                netStatus.className = 'sysinfo-badge warning';
                netStatus.innerText = '🔴 網路已中斷';
            }
        });

        // 結合 Storage 狀態
        if (window.Storage) {
            const originalUpdateUI = Storage.updateUIStatus;
            Storage.updateUIStatus = function () {
                if (typeof originalUpdateUI === 'function') {
                    originalUpdateUI();
                }
                // 確保系統資訊頁面的 app-container 保持顯示
                const appContainer = document.getElementById('app-container');
                if (appContainer) {
                    appContainer.style.display = 'block';
                }
                const noDataMsg = document.getElementById('no-data-msg');
                if (noDataMsg) {
                    noDataMsg.style.display = Storage.isConnected ? 'none' : 'block';
                }

                // 更新 Storage 快取狀態項目
                const elStorage = document.getElementById('val-storage-cache');
                if (elStorage) {
                    elStorage.innerText = Storage.isConnected ? '🟢 已授權且連線 data.json' : '🟡 尚未授權檔案 (唯讀模式)';
                }
            };

            Storage.init(() => {
                const elStorage = document.getElementById('val-storage-cache');
                if (elStorage) {
                    elStorage.innerText = '🟢 已授權且連線 data.json';
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 公開 API
    return {
        copyIp,
        copyReport,
        refreshAll
    };
})();

window.SysInfoApp = SysInfoApp;
