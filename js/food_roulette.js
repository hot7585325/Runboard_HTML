/**
 * Runboard - 美食大轉盤 (Food Roulette)
 * 支援 OpenStreetMap (Overpass API) 免費抓取周邊店家、自訂範圍半徑與數量、
 * Canvas 幸運輪盤物理減速旋轉、Web Audio API 合成音效、與 data.json 口袋名單持久化。
 */
const FoodRouletteApp = (function () {
    // 扇形多彩調色盤 (現代高對比度且護眼)
    const PALETTE = [
        '#ef4444', '#f97316', '#f59e0b', '#10b981', 
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
        '#ec4899', '#14b8a6', '#84cc16', '#e11d48'
    ];

    // 狀態
    let currentMode = 'nearby'; // 'nearby' | 'favorites'
    let userCoords = null; // { lat, lon, label }
    let radius = 800; // 公尺
    let maxCount = 12; // 輪盤名額
    let currentCategory = 'all';
    let candidates = []; // 候選店家清單
    let soundEnabled = true;

    // 輪盤動畫狀態
    let wheelAngle = 0; // 當前弧度
    let isSpinning = false;
    let spinStartTime = 0;
    let spinDuration = 0;
    let startAngle = 0;
    let totalSpinAngle = 0;
    let lastSegmentIndex = -1;
    let selectedPlace = null;

    // 音效 Context
    let audioCtx = null;

    // ================= 音效模組 (Web Audio API 合成音效，免外部音訊檔) =================
    function initAudio() {
        if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playTickSound() {
        if (!soundEnabled) return;
        try {
            initAudio();
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800 + Math.random() * 200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        } catch (e) {
            // 忽略音效異常
        }
    }

    function playWinSound() {
        if (!soundEnabled) return;
        try {
            initAudio();
            if (!audioCtx) return;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const startTime = audioCtx.currentTime + idx * 0.09;
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.3);
            });
        } catch (e) {
            // 忽略音效異常
        }
    }

    // ================= 經緯度距離運算 (Haversine Formula) =================
    function calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371e3; // 地球半徑 (公尺)
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c); // 返回整數公尺
    }

    function formatDistance(meters) {
        if (meters === null || meters === undefined) return '未知距離';
        if (meters < 1000) {
            const walkMins = Math.max(1, Math.round(meters / 80)); // 步行約 80m/min
            return `🚶 約 ${meters}m (步行 ${walkMins} 分鐘)`;
        }
        const km = (meters / 1000).toFixed(1);
        const walkMins = Math.round(meters / 80);
        return `🚶 約 ${km}km (步行 ${walkMins} 分鐘)`;
    }

    // ================= 定位與地理反查 (Geolocation & Nominatim) =================
    function getCurrentLocation() {
        const statusEl = document.getElementById('location-status-badge');
        const btn = document.getElementById('btn-get-location');
        if (!navigator.geolocation) {
            alert('您的瀏覽器不支援地理定位 API，請手動輸入地標或地址。');
            return;
        }

        statusEl.className = 'status-badge';
        statusEl.innerText = '📍 正在定位您的位置...';
        btn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                btn.disabled = false;
                userCoords = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    label: '目前 GPS 定位'
                };
                statusEl.className = 'status-badge active';
                statusEl.innerText = `📍 目前定位 (${userCoords.lat.toFixed(4)}, ${userCoords.lon.toFixed(4)})`;
                
                // 自動發起搜尋
                fetchNearbyPlaces();
            },
            (err) => {
                btn.disabled = false;
                statusEl.className = 'status-badge';
                let msg = '無法取得定位';
                if (err.code === 1) msg = '定位授權遭拒絕，請改用下方地址搜尋';
                else if (err.code === 2) msg = '無法偵測位置訊號，請改用地址搜尋';
                else if (err.code === 3) msg = '定位逾時，請重試或改用地址搜尋';
                statusEl.innerText = `⚠️ ${msg}`;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }

    async function searchAddressGeocode() {
        const input = document.getElementById('input-search-place');
        const query = input.value.trim();
        if (!query) {
            alert('請輸入地標或地址名稱');
            return;
        }

        const statusEl = document.getElementById('location-status-badge');
        statusEl.className = 'status-badge';
        statusEl.innerText = `🔍 正在搜尋地點「${query}」...`;

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
                headers: { 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                userCoords = {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon),
                    label: data[0].display_name.split(',')[0] || query
                };
                statusEl.className = 'status-badge active';
                statusEl.innerText = `📍 定位至：${userCoords.label}`;
                fetchNearbyPlaces();
            } else {
                statusEl.innerText = `⚠️ 找不到「${query}」的地理座標，請嘗試更具體地名`;
            }
        } catch (e) {
            console.error('地點反查失敗:', e);
            statusEl.innerText = '⚠️ 查詢地點連線異常，請檢查網路狀態';
        }
    }

    // ================= 取得周邊店家 (OpenStreetMap Nominatim API) =================
    async function fetchNearbyPlaces() {
        if (!userCoords) {
            alert('請先點擊「📍 取得目前位置」或在搜尋框輸入地點以設定中心位置！');
            return;
        }

        const loadingEl = document.getElementById('places-loading');
        const loadingText = document.getElementById('loading-text');
        const resultCard = document.getElementById('result-card');
        const placeholderEl = document.getElementById('result-placeholder');
        const searchBtn = document.getElementById('btn-search-nearby');

        loadingEl.style.display = 'flex';
        if (loadingText) loadingText.innerText = `正在搜尋半徑 ${radius}m 內的周邊美食...`;
        resultCard.style.display = 'none';
        placeholderEl.style.display = 'none';
        searchBtn.disabled = true;

        // 計算半徑涵蓋的經緯度範圍 (Viewbox: minLon, maxLat, maxLon, minLat)
        const deltaLat = radius / 111320;
        const deltaLon = radius / (111320 * Math.cos(userCoords.lat * Math.PI / 180));
        const minLon = (userCoords.lon - deltaLon).toFixed(5);
        const maxLat = (userCoords.lat + deltaLat).toFixed(5);
        const maxLon = (userCoords.lon + deltaLon).toFixed(5);
        const minLat = (userCoords.lat - deltaLat).toFixed(5);
        const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;

        // 決定要搜尋的關鍵字清單
        let searchQueries = ['restaurant'];
        if (currentCategory === 'restaurant') {
            searchQueries = ['restaurant'];
        } else if (currentCategory === 'fast_food') {
            searchQueries = ['fast_food', 'food'];
        } else if (currentCategory === 'cafe') {
            searchQueries = ['cafe'];
        } else {
            // 全部美食：結合餐廳與咖啡/小吃
            searchQueries = ['restaurant', 'cafe', 'fast_food'];
        }

        try {
            const rawPlaces = [];
            const seenNames = new Set();

            for (const q of searchQueries) {
                const limit = Math.max(15, Math.ceil(maxCount * 1.5));
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&viewbox=${viewbox}&bounded=1`;
                
                try {
                    const res = await fetch(url, {
                        headers: {
                            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
                        }
                    });
                    if (!res.ok) continue;
                    const items = await res.json();
                    
                    if (Array.isArray(items)) {
                        items.forEach(item => {
                            const name = item.name;
                            if (!name || seenNames.has(name.toLowerCase())) return;
                            seenNames.add(name.toLowerCase());

                            const itemLat = parseFloat(item.lat);
                            const itemLon = parseFloat(item.lon);
                            const dist = calculateDistance(userCoords.lat, userCoords.lon, itemLat, itemLon);

                            // 嚴格排除超過半徑的店家 (viewbox 方形角落)
                            if (dist > radius * 1.15) return;

                            // 分類標籤
                            let catLabel = '🍽️ 餐廳';
                            if (item.type === 'cafe') catLabel = '☕ 咖啡飲料';
                            else if (item.type === 'fast_food') catLabel = '🍔 小吃速食';

                            rawPlaces.push({
                                id: 'osm_' + item.place_id,
                                name: name,
                                lat: itemLat,
                                lon: itemLon,
                                distance: dist,
                                category: catLabel,
                                address: item.display_name ? item.display_name.split(',').slice(1, 4).join(', ').trim() : '地圖周邊',
                                active: true,
                                isCustom: false
                            });
                        });
                    }
                } catch (subErr) {
                    console.warn(`[Nominatim] 查詢 ${q} 異常:`, subErr);
                }
            }

            // 依距離由近到遠排序
            rawPlaces.sort((a, b) => (a.distance || 0) - (b.distance || 0));

            if (rawPlaces.length === 0) {
                alert(`在半徑 ${radius} 公尺範圍內未找到符合的美食店家。\n建議您：\n1. 擴大搜尋範圍半徑 (例：1000m 或 1500m)\n2. 切換店家類型為「全部美食類型」\n3. 或使用「我的口袋名單」功能！`);
                placeholderEl.style.display = 'flex';
            } else {
                candidates = rawPlaces.slice(0, maxCount);
                placeholderEl.style.display = 'flex';
                updateCandidatesCountDisplay();
                renderCandidatesList();
                drawWheel();
            }

        } catch (e) {
            console.error('抓取店家失敗:', e);
            alert('抓取周遭店家時發生網路問題，請檢查網路連線或稍後再試。');
            placeholderEl.style.display = 'flex';
        } finally {
            loadingEl.style.display = 'none';
            searchBtn.disabled = false;
        }
    }

    // ================= 模式切換 =================
    function switchMode(mode) {
        currentMode = mode;
        const tabNearby = document.getElementById('tab-nearby');
        const tabFav = document.getElementById('tab-favorites');
        const panelNearby = document.getElementById('panel-nearby-controls');
        const panelFav = document.getElementById('panel-favorites-controls');

        if (mode === 'nearby') {
            tabNearby.classList.add('active');
            tabFav.classList.remove('active');
            panelNearby.style.display = 'flex';
            panelFav.style.display = 'none';
            if (candidates.length === 0 && userCoords) {
                fetchNearbyPlaces();
            } else {
                updateCandidatesCountDisplay();
                renderCandidatesList();
                drawWheel();
            }
        } else {
            tabFav.classList.add('active');
            tabNearby.classList.remove('active');
            panelNearby.style.display = 'none';
            panelFav.style.display = 'flex';
            loadFavoritesAsCandidates();
        }
    }

    function loadFavoritesAsCandidates() {
        const data = Storage.getData();
        const favs = data.foodPlaces || [];
        
        candidates = favs.map(f => {
            const dist = (userCoords && f.lat && f.lon) 
                ? calculateDistance(userCoords.lat, userCoords.lon, f.lat, f.lon) 
                : (f.distance || null);
            return {
                id: f.id,
                name: f.name,
                lat: f.lat || null,
                lon: f.lon || null,
                distance: dist,
                category: f.category || '⭐ 口袋美食',
                address: f.address || f.note || '自訂收藏店家',
                active: true,
                isCustom: true
            };
        });

        updateCandidatesCountDisplay();
        renderCandidatesList();
        drawWheel();

        const placeholderEl = document.getElementById('result-placeholder');
        const resultCard = document.getElementById('result-card');
        resultCard.style.display = 'none';
        placeholderEl.style.display = 'flex';
    }

    function updateFavoriteBadge() {
        const data = Storage.getData();
        const count = (data.foodPlaces || []).length;
        const badge = document.getElementById('fav-count-badge');
        if (badge) badge.innerText = count;
    }

    // ================= 候選清單與卡片管理 =================
    function getActiveCandidates() {
        return candidates.filter(c => c.active);
    }

    function updateCandidatesCountDisplay() {
        const activeList = getActiveCandidates();
        const activeCountEl = document.getElementById('active-candidate-count');
        const totalCountEl = document.getElementById('total-candidate-count');
        const candCountDisplay = document.getElementById('candidate-count-display');
        
        if (activeCountEl) activeCountEl.innerText = activeList.length;
        if (totalCountEl) totalCountEl.innerText = candidates.length;
        if (candCountDisplay) candCountDisplay.innerText = activeList.length;
    }

    function renderCandidatesList() {
        const container = document.getElementById('candidates-grid');
        if (!container) return;

        if (candidates.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 30px;">
                    ${currentMode === 'favorites' ? '目前口袋名單是空的，點擊上方「＋新增口袋店家」添加您的愛店吧！' : '目前尚無候選店家，請點擊上方按鈕定位並搜尋。'}
                </div>
            `;
            return;
        }

        container.innerHTML = candidates.map((place, idx) => {
            const isFav = isPlaceInFavorites(place.name);
            return `
                <div class="candidate-card ${place.active ? '' : 'inactive'}" id="candidate-card-${idx}">
                    <input type="checkbox" ${place.active ? 'checked' : ''} onchange="FoodRouletteApp.toggleCandidateActive(${idx}, this.checked)" title="勾選/取消以加入或移出當前轉盤">
                    <div class="candidate-card-info">
                        <div class="candidate-card-name" title="${place.name}">${place.name}</div>
                        <div class="candidate-card-meta">
                            <span>${place.category}</span>
                            <span>·</span>
                            <span>${formatDistance(place.distance)}</span>
                        </div>
                    </div>
                    <div class="candidate-card-actions">
                        <button onclick="FoodRouletteApp.toggleFavorite(${idx})" title="${isFav ? '已在口袋名單中' : '收藏至口袋名單'}">
                            ${isFav ? '⭐' : '☆'}
                        </button>
                        ${currentMode === 'favorites' ? `
                            <button onclick="FoodRouletteApp.deleteFavoritePlace('${place.id}')" title="從口袋名單刪除">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    function toggleCandidateActive(index, isActive) {
        if (candidates[index]) {
            candidates[index].active = isActive;
            const card = document.getElementById(`candidate-card-${index}`);
            if (card) {
                if (isActive) card.classList.remove('inactive');
                else card.classList.add('inactive');
            }
            updateCandidatesCountDisplay();
            drawWheel();
        }
    }

    function selectAllCandidates(selectAll) {
        candidates.forEach(c => c.active = selectAll);
        renderCandidatesList();
        updateCandidatesCountDisplay();
        drawWheel();
    }

    function shuffleCandidates() {
        if (isSpinning) return;
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        renderCandidatesList();
        drawWheel();
    }

    // ================= Canvas 幸運大轉盤繪製 =================
    function drawWheel() {
        const canvas = document.getElementById('roulette-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 14;

        ctx.clearRect(0, 0, width, height);

        const activeList = getActiveCandidates();
        const numSegments = activeList.length;

        // 若無任何選取項目
        if (numSegments === 0) {
            ctx.save();
            ctx.fillStyle = '#22252f';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.fillStyle = '#888';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('請至少勾選一家候選店家', centerX, centerY);
            ctx.restore();
            return;
        }

        const anglePerSegment = (Math.PI * 2) / numSegments;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(wheelAngle);

        for (let i = 0; i < numSegments; i++) {
            const place = activeList[i];
            const startAng = i * anglePerSegment;
            const endAng = startAng + anglePerSegment;
            const color = PALETTE[i % PALETTE.length];

            // 繪製扇形
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAng, endAng);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // 扇形格邊框
            ctx.strokeStyle = '#1e222d';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // 繪製放射狀文字
            ctx.save();
            const textAngle = startAng + anglePerSegment / 2;
            ctx.rotate(textAngle);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px Inter, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 4;

            // 限制文字長度
            let displayName = place.name;
            if (displayName.length > 9) {
                displayName = displayName.substring(0, 8) + '...';
            }
            ctx.fillText(displayName, radius - 20, 0);

            ctx.restore();
        }

        // 外圈立體質感金屬環
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 5;
        ctx.stroke();

        // 外圍發光小鉚釘圓點
        for (let i = 0; i < numSegments; i++) {
            const dotAng = i * anglePerSegment;
            const dotX = Math.cos(dotAng) * (radius - 5);
            const dotY = Math.sin(dotAng) * (radius - 5);
            ctx.beginPath();
            ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        ctx.restore();
    }

    // ================= 旋轉抽籤邏輯 (物理 ease-out 動畫) =================
    function spin() {
        const activeList = getActiveCandidates();
        if (activeList.length < 1) {
            alert('轉盤上沒有啟用的店家，請先勾選至少一家！');
            return;
        }

        if (isSpinning) return;
        isSpinning = true;

        const spinBtn = document.getElementById('wheel-spin-btn');
        if (spinBtn) spinBtn.disabled = true;

        // 隱藏前次結果，顯示初始提示
        document.getElementById('result-card').style.display = 'none';
        document.getElementById('result-placeholder').style.display = 'flex';

        initAudio();

        startAngle = wheelAngle % (Math.PI * 2);
        // 隨機旋轉圈數 (6 ~ 10 圈) + 隨機角度
        const randomRounds = 6 + Math.random() * 4;
        totalSpinAngle = randomRounds * Math.PI * 2 + Math.random() * Math.PI * 2;
        spinDuration = 4500 + Math.random() * 1000; // 4.5 ~ 5.5 秒
        spinStartTime = performance.now();
        lastSegmentIndex = -1;

        requestAnimationFrame(animateSpin);
    }

    // 經典 Ease-Out Cubic 緩動函數
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function animateSpin(currentTime) {
        const elapsed = currentTime - spinStartTime;
        const progress = Math.min(1, elapsed / spinDuration);
        const easedProgress = easeOutCubic(progress);

        wheelAngle = startAngle + totalSpinAngle * easedProgress;

        // 計算目前指針位置指向的扇區（指針位於頂端，即 -PI/2）
        const activeList = getActiveCandidates();
        const numSegments = activeList.length;
        const anglePerSegment = (Math.PI * 2) / numSegments;
        
        // 歸一化當前角度
        let normalizedAngle = (wheelAngle) % (Math.PI * 2);
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

        // 指針位於正上方 (3 * PI / 2 或 -PI / 2)
        const pointerPos = (3 * Math.PI / 2);
        let relativeAngle = (pointerPos - normalizedAngle) % (Math.PI * 2);
        if (relativeAngle < 0) relativeAngle += Math.PI * 2;

        const currentSegment = Math.floor(relativeAngle / anglePerSegment);

        // 每當扇區切換時播放 Tick 音效與指針微動
        if (currentSegment !== lastSegmentIndex) {
            playTickSound();
            lastSegmentIndex = currentSegment;
            const pointer = document.getElementById('wheel-pointer');
            if (pointer) {
                pointer.classList.add('tick-bump');
                setTimeout(() => pointer.classList.remove('tick-bump'), 60);
            }
        }

        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animateSpin);
        } else {
            isSpinning = false;
            const spinBtn = document.getElementById('wheel-spin-btn');
            if (spinBtn) spinBtn.disabled = false;

            // 確定選中店家
            selectedPlace = activeList[currentSegment] || activeList[0];
            onSpinFinished(selectedPlace);
        }
    }

    function onSpinFinished(place) {
        playWinSound();
        triggerConfetti();

        // 呈現右側結果卡片
        const placeholderEl = document.getElementById('result-placeholder');
        const resultCard = document.getElementById('result-card');
        const nameEl = document.getElementById('result-name');
        const distEl = document.getElementById('result-distance');
        const typeEl = document.getElementById('result-type');
        const addrEl = document.getElementById('result-address');
        const gmapLink = document.getElementById('result-gmap-link');

        placeholderEl.style.display = 'none';
        resultCard.style.display = 'flex';

        nameEl.innerText = place.name;
        distEl.innerText = formatDistance(place.distance);
        typeEl.innerText = place.category || '🍽️ 美食店家';
        addrEl.innerText = `📍 地址資訊：${place.address || '地圖附近商圈'}`;

        // 構建 Google Maps 搜尋連結
        let gmapQuery = place.name;
        if (place.lat && place.lon) {
            gmapQuery = `${place.name} ${place.lat},${place.lon}`;
        }
        gmapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gmapQuery)}`;

        updateResultFavoriteButton(place);
    }

    function updateResultFavoriteButton(place) {
        const favBtn = document.getElementById('result-fav-btn');
        if (!favBtn) return;
        const isFav = isPlaceInFavorites(place.name);
        if (isFav) {
            favBtn.innerText = '⭐ 已在口袋名單中';
            favBtn.classList.add('primary');
        } else {
            favBtn.innerText = '⭐ 收藏到口袋名單';
            favBtn.classList.remove('primary');
        }
    }

    // ================= 口袋名單 (data.json) 儲存與管理 =================
    function isPlaceInFavorites(name) {
        const data = Storage.getData();
        const favs = data.foodPlaces || [];
        return favs.some(f => f.name.trim().toLowerCase() === name.trim().toLowerCase());
    }

    async function toggleFavorite(index) {
        const place = candidates[index];
        if (!place) return;

        const data = Storage.getData();
        if (!data.foodPlaces) data.foodPlaces = [];

        const existingIdx = data.foodPlaces.findIndex(f => f.name.trim().toLowerCase() === place.name.trim().toLowerCase());
        if (existingIdx >= 0) {
            data.foodPlaces.splice(existingIdx, 1);
        } else {
            data.foodPlaces.push({
                id: 'fav_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: place.name,
                lat: place.lat,
                lon: place.lon,
                distance: place.distance,
                category: place.category,
                address: place.address
            });
        }

        await Storage.save();
        updateFavoriteBadge();
        renderCandidatesList();
        if (selectedPlace && selectedPlace.name === place.name) {
            updateResultFavoriteButton(place);
        }
    }

    async function toggleFavoriteFromCurrentResult() {
        if (!selectedPlace) return;
        const data = Storage.getData();
        if (!data.foodPlaces) data.foodPlaces = [];

        const existingIdx = data.foodPlaces.findIndex(f => f.name.trim().toLowerCase() === selectedPlace.name.trim().toLowerCase());
        if (existingIdx >= 0) {
            data.foodPlaces.splice(existingIdx, 1);
        } else {
            data.foodPlaces.push({
                id: 'fav_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: selectedPlace.name,
                lat: selectedPlace.lat,
                lon: selectedPlace.lon,
                distance: selectedPlace.distance,
                category: selectedPlace.category,
                address: selectedPlace.address
            });
        }

        await Storage.save();
        updateFavoriteBadge();
        renderCandidatesList();
        updateResultFavoriteButton(selectedPlace);
    }

    async function deleteFavoritePlace(id) {
        if (!confirm('確定要將此店家從口袋名單中移除嗎？')) return;
        const data = Storage.getData();
        if (!data.foodPlaces) return;
        data.foodPlaces = data.foodPlaces.filter(f => f.id !== id);
        await Storage.save();
        updateFavoriteBadge();
        if (currentMode === 'favorites') {
            loadFavoritesAsCandidates();
        } else {
            renderCandidatesList();
        }
    }

    // 手動新增口袋店家彈窗
    function openAddCustomModal() {
        Modal.open({
            title: '＋ 新增自訂店家至口袋名單',
            html: `
                <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="display:block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">店家名稱 *</label>
                    <input type="text" id="modal-place-name" class="search-input" style="width: 100%;" placeholder="例：阿堂牛肉麵、星巴克" required>
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="display:block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">店家類型</label>
                    <input type="text" id="modal-place-category" class="search-input" style="width: 100%;" placeholder="例：🍜 台灣小吃、☕ 咖啡甜點" value="🍜 美食">
                </div>
                <div class="form-group" style="margin-bottom: 12px;">
                    <label class="form-label" style="display:block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">地址或備註</label>
                    <input type="text" id="modal-place-address" class="search-input" style="width: 100%;" placeholder="例：和平東路二段100號 / 推薦麻醬麵">
                </div>
            `,
            onConfirm: async () => {
                const name = document.getElementById('modal-place-name').value.trim();
                const category = document.getElementById('modal-place-category').value.trim() || '🍜 美食';
                const address = document.getElementById('modal-place-address').value.trim() || '自訂備註';

                if (!name) {
                    alert('請輸入店家名稱');
                    return false;
                }

                const data = Storage.getData();
                if (!data.foodPlaces) data.foodPlaces = [];

                data.foodPlaces.push({
                    id: 'custom_' + Date.now(),
                    name: name,
                    category: category,
                    address: address,
                    distance: null
                });

                await Storage.save();
                updateFavoriteBadge();

                if (currentMode === 'favorites') {
                    loadFavoritesAsCandidates();
                } else {
                    // 若在附近模式，也同時附加到當前轉盤
                    candidates.unshift({
                        id: 'custom_' + Date.now(),
                        name: name,
                        category: category,
                        address: address,
                        distance: null,
                        active: true,
                        isCustom: true
                    });
                    updateCandidatesCountDisplay();
                    renderCandidatesList();
                    drawWheel();
                }
                return true;
            }
        });
    }

    // ================= 滑桿與控制列事件 =================
    function updateRadiusDisplay(val) {
        radius = parseInt(val, 10);
        const radiusEl = document.getElementById('radius-val');
        if (radiusEl) radiusEl.innerText = `${radius} 公尺`;
    }

    function updateCountDisplay(val) {
        maxCount = parseInt(val, 10);
        const countEl = document.getElementById('count-val');
        if (countEl) countEl.innerText = `${maxCount} 間`;
    }

    function onFilterChange() {
        const select = document.getElementById('select-category');
        currentCategory = select.value;
        if (userCoords && currentMode === 'nearby') {
            fetchNearbyPlaces();
        }
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        const btn = document.getElementById('btn-toggle-sound');
        if (btn) {
            btn.innerText = soundEnabled ? '🔊 音效：開' : '🔇 音效：關';
        }
    }

    // ================= 彩帶 Confetti 特效 (純原生 Canvas) =================
    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const count = 70;
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];

        for (let i = 0; i < count; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 200,
                y: canvas.height * 0.45 + (Math.random() - 0.5) * 100,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 1.2) * 10 - 3,
                size: Math.random() * 8 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }

        let animationFrame = null;
        function updateParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = 0;

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.25; // 重力
                p.rotation += p.rotSpeed;
                p.opacity -= 0.012;

                if (p.opacity > 0) {
                    alive++;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation * Math.PI / 180);
                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.max(0, p.opacity);
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                }
            });

            if (alive > 0) {
                animationFrame = requestAnimationFrame(updateParticles);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
            }
        }

        updateParticles();
    }

    // ================= 初始化 =================
    document.addEventListener('DOMContentLoaded', () => {
        // 設定 Canvas 高清渲染
        const canvas = document.getElementById('roulette-canvas');
        if (canvas) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = 460 * dpr;
            canvas.height = 460 * dpr;
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
        }

        // 初始化 Storage
        Storage.init(() => {
            updateFavoriteBadge();

            // 預設示範清單 (避免使用者未授權定位時輪盤全黑)
            const demoPlaces = [
                { id: 'd1', name: '日式拉麵館', category: '🍜 餐廳', distance: 180, address: '商圈美食街', active: true },
                { id: 'd2', name: '老牌牛肉麵', category: '🍜 台灣小吃', distance: 320, address: '站前路', active: true },
                { id: 'd3', name: '義大利麵坊', category: '🍽️ 義式料理', distance: 450, address: '光復路', active: true },
                { id: 'd4', name: '炸雞漢堡吧', category: '🍔 美式漢堡', distance: 260, address: '大同街', active: true },
                { id: 'd5', name: '手作石鍋拌飯', category: '🍲 韓式料理', distance: 510, address: '中央路', active: true },
                { id: 'd6', name: '精品手沖咖啡', category: '☕ 咖啡輕食', distance: 150, address: '巷口轉角', active: true },
                { id: 'd7', name: '鐵板燒牛排', category: '🥩 鐵板料理', distance: 620, address: '東門街', active: true },
                { id: 'd8', name: '港式燒臘便當', category: '🍱 港式燒臘', distance: 390, address: '南門路', active: true }
            ];

            const data = Storage.getData();
            if (data.foodPlaces && data.foodPlaces.length > 0) {
                // 若已有口袋名單，預設載入口袋名單
                loadFavoritesAsCandidates();
            } else {
                candidates = demoPlaces;
                updateCandidatesCountDisplay();
                renderCandidatesList();
                drawWheel();
            }
        });
    });

    return {
        switchMode,
        getCurrentLocation,
        searchAddressGeocode,
        fetchNearbyPlaces,
        updateRadiusDisplay,
        updateCountDisplay,
        onFilterChange,
        toggleCandidateActive,
        selectAllCandidates,
        shuffleCandidates,
        spin,
        toggleSound,
        toggleFavorite,
        toggleFavoriteFromCurrentResult,
        deleteFavoritePlace,
        openAddCustomModal
    };
})();

window.FoodRouletteApp = FoodRouletteApp;
