/**
 * Runboard - 📻 即時電台 (Radio Player) 核心邏輯
 * 遵循 IIFE 模組化規範，整合 Storage、Modal 與 HTML5 Audio
 */
const RadioApp = (function () {
    // 音訊控制器與全域狀態
    let audio = new Audio();
    let currentStation = null;
    let playbackState = 'idle'; // 'idle' | 'buffering' | 'playing' | 'paused' | 'error'
    let currentVolume = 0.8;
    let isMuted = false;

    // 我的電台搜尋與分類過濾
    let mySearchKeyword = '';
    let selectedCategory = 'ALL';

    // 線上探索快取
    let exploreResults = [];
    let isExploring = false;

    // Radio Browser API 節點群 (具備備援切換能力)
    const RADIO_BROWSER_SERVERS = [
        'https://de1.api.radio-browser.info',
        'https://at1.api.radio-browser.info',
        'https://nl1.api.radio-browser.info'
    ];
    let currentServerIdx = 0;

    /**
     * 初始化音訊事件監聽
     */
    function initAudio() {
        audio.preload = 'none';
        audio.volume = currentVolume;

        audio.addEventListener('loadstart', () => {
            updatePlaybackState('buffering');
        });

        audio.addEventListener('waiting', () => {
            updatePlaybackState('buffering');
        });

        audio.addEventListener('canplay', () => {
            // 串流已可播放
        });

        audio.addEventListener('playing', () => {
            updatePlaybackState('playing');
        });

        audio.addEventListener('pause', () => {
            if (playbackState !== 'idle' && playbackState !== 'buffering') {
                updatePlaybackState('paused');
            }
        });

        audio.addEventListener('error', (e) => {
            console.warn('[RadioApp] 音訊串流載入錯誤:', e);
            updatePlaybackState('error');
        });
    }

    function updatePlaybackState(state) {
        playbackState = state;
        updateDeckUI();
        updateStationCardsUI();
    }

    /**
     * 讀取本機電台清單
     */
    function getStations() {
        const data = Storage.getData();
        if (!data.radios) {
            data.radios = [];
        }
        return data.radios;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 播放特定電台
     */
    function playStation(station) {
        if (!station || !station.url) return;

        // 若點擊正在播放的同一個電台，則切換暫停/播放
        if (currentStation && currentStation.url === station.url) {
            togglePlay();
            return;
        }

        currentStation = station;
        updatePlaybackState('buffering');

        try {
            audio.pause();
            audio.src = station.url;
            audio.load();
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    console.warn('[RadioApp] 自動播放被阻擋或串流失敗:', err);
                    updatePlaybackState('error');
                });
            }
        } catch (e) {
            console.error('[RadioApp] 播放異常:', e);
            updatePlaybackState('error');
        }
    }

    /**
     * 播放 / 暫停 切換
     */
    function togglePlay() {
        if (!currentStation) {
            // 若尚未選擇電台，預設播放第一首
            const list = getStations();
            if (list.length > 0) {
                playStation(list[0]);
            }
            return;
        }

        if (audio.paused) {
            audio.play().then(() => {
                updatePlaybackState('playing');
            }).catch(e => {
                console.warn('[RadioApp] 播放失敗:', e);
                updatePlaybackState('error');
            });
        } else {
            audio.pause();
            updatePlaybackState('paused');
        }
    }

    /**
     * 停止播放
     */
    function stop() {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        updatePlaybackState('idle');
    }

    /**
     * 設定音量 (0.0 ~ 1.0)
     */
    function setVolume(val) {
        currentVolume = parseFloat(val);
        if (isNaN(currentVolume)) currentVolume = 0.8;
        if (currentVolume < 0) currentVolume = 0;
        if (currentVolume > 1) currentVolume = 1;

        if (isMuted && currentVolume > 0) {
            isMuted = false;
        }

        audio.volume = isMuted ? 0 : currentVolume;

        const label = document.getElementById('deck-volume-label');
        if (label) label.innerText = `${Math.round(currentVolume * 100)}%`;

        const muteBtn = document.getElementById('deck-mute-btn');
        if (muteBtn) muteBtn.innerText = isMuted || currentVolume === 0 ? '🔇' : (currentVolume < 0.5 ? '🔉' : '🔊');
    }

    /**
     * 靜音切換
     */
    function toggleMute() {
        isMuted = !isMuted;
        audio.volume = isMuted ? 0 : currentVolume;

        const muteBtn = document.getElementById('deck-mute-btn');
        if (muteBtn) muteBtn.innerText = isMuted ? '🔇' : (currentVolume < 0.5 ? '🔉' : '🔊');
    }

    /**
     * 更新播放控制台 (Deck) 介面
     */
    function updateDeckUI() {
        const titleEl = document.getElementById('deck-station-title');
        const metaEl = document.getElementById('deck-station-meta');
        const statusTag = document.getElementById('deck-status-tag');
        const statusDot = document.getElementById('deck-status-dot');
        const statusText = document.getElementById('deck-status-text');
        const playBtn = document.getElementById('deck-play-btn');
        const eqEl = document.getElementById('deck-equalizer');
        const iconEl = document.getElementById('deck-icon');

        if (!titleEl) return;

        if (!currentStation) {
            titleEl.innerText = '尚未選取電台';
            metaEl.innerText = '點選下方電台卡片立即串流播放';
            statusDot.className = 'status-dot idle';
            statusText.innerText = '待機中';
            playBtn.innerText = '▶️';
            eqEl.className = 'deck-equalizer';
            iconEl.innerText = '📻';
            return;
        }

        titleEl.innerText = currentStation.name || '未知電台';
        const loc = currentStation.location || '全球';
        const cat = currentStation.category || '電台';
        metaEl.innerText = `📍 ${loc} · 🏷️ ${cat} · ${currentStation.desc || currentStation.tags || '即時音訊串流'}`;

        if (playbackState === 'playing') {
            statusDot.className = 'status-dot playing';
            statusText.innerText = '串流播放中';
            playBtn.innerText = '⏸️';
            eqEl.className = 'deck-equalizer playing';
            iconEl.innerText = '🎵';
        } else if (playbackState === 'buffering') {
            statusDot.className = 'status-dot buffering';
            statusText.innerText = '連線緩衝中...';
            playBtn.innerText = '⏳';
            eqEl.className = 'deck-equalizer';
            iconEl.innerText = '📡';
        } else if (playbackState === 'paused') {
            statusDot.className = 'status-dot idle';
            statusText.innerText = '已暫停';
            playBtn.innerText = '▶️';
            eqEl.className = 'deck-equalizer';
            iconEl.innerText = '📻';
        } else if (playbackState === 'error') {
            statusDot.className = 'status-dot error';
            statusText.innerText = '串流失敗 (來源可能暫時離線)';
            playBtn.innerText = '🔄';
            eqEl.className = 'deck-equalizer';
            iconEl.innerText = '⚠️';
        } else {
            statusDot.className = 'status-dot idle';
            statusText.innerText = '待機中';
            playBtn.innerText = '▶️';
            eqEl.className = 'deck-equalizer';
            iconEl.innerText = '📻';
        }
    }

    /**
     * 更新電台清單卡片狀態 (播放中高亮)
     */
    function updateStationCardsUI() {
        const cards = document.querySelectorAll('.station-card');
        cards.forEach(card => {
            const url = card.getAttribute('data-url');
            const playBtn = card.querySelector('.play-station-btn');
            if (currentStation && currentStation.url === url && playbackState === 'playing') {
                card.classList.add('is-playing');
                if (playBtn) playBtn.innerHTML = '⏸️ 暫停中';
            } else if (currentStation && currentStation.url === url && playbackState === 'buffering') {
                card.classList.add('is-playing');
                if (playBtn) playBtn.innerHTML = '⏳ 緩衝中';
            } else {
                card.classList.remove('is-playing');
                if (playBtn) playBtn.innerHTML = '▶️ 播放';
            }
        });
    }

    /**
     * 處理我的電台關鍵字搜尋
     */
    function handleMySearch(keyword) {
        mySearchKeyword = (keyword || '').trim().toLowerCase();
        renderMyStations();
    }

    /**
     * 點擊分類篩選晶片
     */
    function setCategoryFilter(category) {
        selectedCategory = category;
        renderMyStations();
    }

    /**
     * 渲染「我的收藏電台」
     */
    function renderMyStations() {
        const grid = document.getElementById('my-stations-grid');
        const badgeEl = document.getElementById('badge-my-count');
        const chipsContainer = document.getElementById('my-category-chips');
        if (!grid) return;

        const stations = getStations();
        if (badgeEl) badgeEl.innerText = stations.length;

        // 計算所有分類
        const categories = new Set();
        stations.forEach(s => {
            if (s.category) categories.add(s.category.trim());
        });

        // 渲染分類晶片
        if (chipsContainer) {
            let chipsHtml = `<button class="chip-btn ${selectedCategory === 'ALL' ? 'active' : ''}" onclick="RadioApp.setCategoryFilter('ALL')">全部 (${stations.length})</button>`;
            categories.forEach(cat => {
                const count = stations.filter(s => s.category && s.category.trim() === cat).length;
                chipsHtml += `<button class="chip-btn ${selectedCategory === cat ? 'active' : ''}" onclick="RadioApp.setCategoryFilter('${escapeHtml(cat)}')">${escapeHtml(cat)} (${count})</button>`;
            });
            chipsContainer.innerHTML = chipsHtml;
        }

        // 過濾條件
        const filtered = stations.filter(s => {
            if (selectedCategory !== 'ALL' && (!s.category || s.category.trim() !== selectedCategory)) {
                return false;
            }
            if (mySearchKeyword) {
                const text = `${s.name || ''} ${s.category || ''} ${s.location || ''} ${s.tags || ''} ${s.desc || ''}`.toLowerCase();
                return text.includes(mySearchKeyword);
            }
            return true;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: var(--text-secondary);">
                    <div style="font-size: 32px; margin-bottom: 10px;">📻</div>
                    <p style="font-size: 15px; margin-bottom: 12px;">沒有找到符合條件的收藏電台</p>
                    <button class="btn btn-small primary" onclick="RadioApp.openAddModal()">＋ 自訂新增電台</button>
                    <button class="btn btn-small" style="margin-left: 8px;" onclick="RadioApp.switchTab('explore')">🌐 前往線上電台庫探索</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(s => {
            const isPlayingThis = currentStation && currentStation.url === s.url && playbackState === 'playing';
            const isBufferingThis = currentStation && currentStation.url === s.url && playbackState === 'buffering';
            const cardClass = isPlayingThis || isBufferingThis ? 'station-card is-playing' : 'station-card';
            const btnText = isPlayingThis ? '⏸️ 暫停中' : (isBufferingThis ? '⏳ 緩衝中' : '▶️ 播放');

            return `
                <div class="${cardClass}" data-url="${escapeHtml(s.url)}">
                    <div>
                        <div class="station-card-header">
                            <span class="station-meta-badge">📍 ${escapeHtml(s.location || '台灣')} · ${escapeHtml(s.category || '電台')}</span>
                            <div class="station-actions">
                                <button class="action-icon-btn" title="編輯電台" onclick="RadioApp.openEditModal('${escapeHtml(s.id)}')">✏️</button>
                                <button class="action-icon-btn delete" title="刪除電台" onclick="RadioApp.deleteStation('${escapeHtml(s.id)}')">🗑️</button>
                            </div>
                        </div>
                        <div class="station-name">${escapeHtml(s.name)}</div>
                        <div class="station-desc">${escapeHtml(s.desc || s.tags || '即時廣播串流')}</div>
                    </div>
                    <div class="station-card-footer">
                        <div class="station-tags" title="${escapeHtml(s.tags || '')}">${escapeHtml(s.tags || s.location || '')}</div>
                        <button class="play-station-btn" onclick="RadioApp.handleCardPlay('${escapeHtml(s.id)}')">
                            ${btnText}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 卡片點擊播放/暫停
     */
    function handleCardPlay(stationId) {
        const stations = getStations();
        const station = stations.find(s => s.id === stationId);
        if (station) {
            playStation(station);
        }
    }

    /**
     * 切換分頁
     */
    function switchTab(tab) {
        const tabBtnMy = document.getElementById('tab-btn-my');
        const tabBtnExplore = document.getElementById('tab-btn-explore');
        const paneMy = document.getElementById('tab-content-my');
        const paneExplore = document.getElementById('tab-content-explore');

        if (tab === 'my') {
            tabBtnMy.classList.add('active');
            tabBtnExplore.classList.remove('active');
            paneMy.style.display = 'block';
            paneExplore.style.display = 'none';
        } else {
            tabBtnExplore.classList.add('active');
            tabBtnMy.classList.remove('active');
            paneMy.style.display = 'none';
            paneExplore.style.display = 'block';

            // 若尚未搜尋過，預設探索台灣熱門電台
            if (exploreResults.length === 0 && !isExploring) {
                exploreByTag('Taiwan');
            }
        }
    }

    /**
     * 線上探索：點擊熱門標籤
     */
    function exploreByTag(tag) {
        const input = document.getElementById('explore-query-input');
        if (input) input.value = tag;
        const select = document.getElementById('popular-station-select');
        if (select) select.value = '';
        searchOnline(tag);
    }

    /**
     * 線上探索：從推薦電台下拉選單選取
     */
    function handlePresetSelect(presetValue) {
        if (!presetValue) return;
        const input = document.getElementById('explore-query-input');
        if (input) input.value = presetValue;
        searchOnline(presetValue);
    }

    /**
     * 線上搜尋電台 (Radio-Browser API)
     */
    async function searchOnline(overrideQuery) {
        const input = document.getElementById('explore-query-input');
        const query = (overrideQuery || (input ? input.value : '')).trim();
        const statusBox = document.getElementById('explore-status-box');
        const grid = document.getElementById('explore-stations-grid');

        if (!statusBox || !grid) return;

        isExploring = true;
        statusBox.style.display = 'block';
        statusBox.innerHTML = `<span>⏳ 正在連線開源電台資料庫搜尋「<strong>${escapeHtml(query || '全部')}</strong>」...</span>`;
        grid.innerHTML = '';

        // 構建 API URL
        let apiUrl = '';
        const server = RADIO_BROWSER_SERVERS[currentServerIdx];

        if (!query || query.toLowerCase() === 'taiwan') {
            apiUrl = `${server}/json/stations/search?country=Taiwan&limit=40`;
        } else if (query.toLowerCase() === 'taichung') {
            apiUrl = `${server}/json/stations/search?name=Taichung&limit=30`;
        } else {
            apiUrl = `${server}/json/stations/search?name=${encodeURIComponent(query)}&limit=40`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'RunboardRadio/1.0'
                }
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            isExploring = false;

            if (!Array.isArray(data) || data.length === 0) {
                statusBox.innerHTML = `⚠️ 未找到與「${escapeHtml(query)}」相符的線上電台，建議嘗試英文關鍵字（如 Taiwan, Pop, Jazz, News）`;
                return;
            }

            exploreResults = data;
            statusBox.innerHTML = `✅ 搜尋完成！共找到 <strong>${data.length}</strong> 個線上電台頻道`;
            renderExploreResults();
        } catch (err) {
            console.warn('[RadioApp] 線上搜尋失敗:', err);
            isExploring = false;
            // 嘗試切換備援伺服器
            currentServerIdx = (currentServerIdx + 1) % RADIO_BROWSER_SERVERS.length;
            statusBox.innerHTML = `
                ⚠️ 線上電台連線暫時逾時或遭遇網路限制 (${escapeHtml(err.message || '')})。<br>
                <span style="font-size: 12px; color: var(--text-muted);">已自動切換備用伺服器節點，您可以點選上方「新增自訂電台」手動輸入常用電台串流。</span>
            `;
        }
    }

    /**
     * 渲染線上搜尋結果
     */
    function renderExploreResults() {
        const grid = document.getElementById('explore-stations-grid');
        if (!grid) return;

        const myStations = getStations();
        const myUrls = new Set(myStations.map(s => s.url));

        grid.innerHTML = exploreResults.map(item => {
            const streamUrl = item.url_resolved || item.url;
            const isAlreadyAdded = myUrls.has(streamUrl);
            const isPlayingThis = currentStation && currentStation.url === streamUrl && playbackState === 'playing';
            const isBufferingThis = currentStation && currentStation.url === streamUrl && playbackState === 'buffering';
            const cardClass = isPlayingThis || isBufferingThis ? 'station-card is-playing' : 'station-card';
            const btnText = isPlayingThis ? '⏸️ 暫停' : (isBufferingThis ? '⏳ 緩衝' : '▶️ 試聽');

            const bitrateInfo = item.bitrate ? `${item.bitrate} kbps` : '';
            const codecInfo = item.codec ? item.codec : 'Audio';
            const metaInfo = [item.country, bitrateInfo, codecInfo].filter(Boolean).join(' · ');

            return `
                <div class="${cardClass}" data-url="${escapeHtml(streamUrl)}">
                    <div>
                        <div class="station-card-header">
                            <span class="station-meta-badge">🌐 ${escapeHtml(metaInfo)}</span>
                        </div>
                        <div class="station-name">${escapeHtml(item.name || '未命名電台')}</div>
                        <div class="station-desc">${escapeHtml(item.tags || item.homepage || '開源電台串流')}</div>
                    </div>
                    <div class="station-card-footer">
                        <button class="play-station-btn" onclick="RadioApp.previewOnlineStation('${escapeHtml(item.stationuuid || '')}')">
                            ${btnText}
                        </button>
                        ${isAlreadyAdded ? 
                            `<span style="font-size: 12px; color: #10b981; font-weight: 600;">✓ 已在收藏中</span>` : 
                            `<button class="add-fav-btn" onclick="RadioApp.addFromOnline('${escapeHtml(item.stationuuid || '')}')">➕ 加入收藏</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 試聽線上電台
     */
    function previewOnlineStation(stationuuid) {
        const target = exploreResults.find(x => x.stationuuid === stationuuid);
        if (!target) return;

        const streamUrl = target.url_resolved || target.url;
        playStation({
            id: 'preview_' + (target.stationuuid || Date.now()),
            name: target.name,
            url: streamUrl,
            category: target.tags ? target.tags.split(',')[0] : '線上探索',
            location: target.country || '全球',
            tags: target.tags || '',
            desc: `線上探索來源 · 碼率: ${target.bitrate || 128}k (${target.codec || 'MP3'})`
        });
    }

    /**
     * 從線上探索加入到我的電台
     */
    async function addFromOnline(stationuuid) {
        const target = exploreResults.find(x => x.stationuuid === stationuuid);
        if (!target) return;

        const streamUrl = target.url_resolved || target.url;
        const stations = getStations();

        if (stations.some(s => s.url === streamUrl)) {
            alert('此電台已經在您的收藏清單中！');
            return;
        }

        const newStation = {
            id: 'station_' + Date.now(),
            name: target.name || '自訂電台',
            url: streamUrl,
            category: (target.tags ? target.tags.split(',')[0].trim() : '線上收錄') || '線上收錄',
            location: target.country || '全球',
            tags: target.tags || '',
            desc: `來自線上資料庫 (${target.codec || 'MP3'} ${target.bitrate || ''}k)`
        };

        stations.push(newStation);
        await Storage.save();

        renderMyStations();
        renderExploreResults();
    }

    /**
     * 打開新增電台對話框 (Modal)
     */
    function openAddModal() {
        const formHtml = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">電台名稱 *</label>
                    <input type="text" id="modal-station-name" class="search-input" placeholder="例如：ICRT 台北國際社區廣播電台" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">串流音訊網址 (Stream URL) *</label>
                    <input type="text" id="modal-station-url" class="search-input" placeholder="例如：https://.../stream.mp3 或 Icecast 網址" style="width: 100%;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">分類</label>
                        <input type="text" id="modal-station-cat" class="search-input" placeholder="例如：流行音樂、新聞知識、放鬆輕音樂" style="width: 100%;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">所在地區</label>
                        <input type="text" id="modal-station-loc" class="search-input" placeholder="例如：台灣、台中、全球" style="width: 100%;">
                    </div>
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">標籤 (以逗號分隔)</label>
                    <input type="text" id="modal-station-tags" class="search-input" placeholder="例如：華語流行, 爵士, 讀書放鬆" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">簡介 / 備註說明</label>
                    <input type="text" id="modal-station-desc" class="search-input" placeholder="選填，簡短說明電台內容" style="width: 100%;">
                </div>
            </div>
        `;

        Modal.open({
            title: '＋ 新增自訂電台',
            html: formHtml,
            onConfirm: async () => {
                const name = document.getElementById('modal-station-name').value.trim();
                const url = document.getElementById('modal-station-url').value.trim();
                const category = document.getElementById('modal-station-cat').value.trim() || '自訂電台';
                const location = document.getElementById('modal-station-loc').value.trim() || '台灣';
                const tags = document.getElementById('modal-station-tags').value.trim();
                const desc = document.getElementById('modal-station-desc').value.trim();

                if (!name || !url) {
                    alert('請務必填寫電台名稱與串流網址！');
                    return false;
                }

                const stations = getStations();
                stations.push({
                    id: 'station_' + Date.now(),
                    name,
                    url,
                    category,
                    location,
                    tags,
                    desc
                });

                await Storage.save();
                renderMyStations();
                return true;
            }
        });
    }

    /**
     * 打開編輯電台對話框 (Modal)
     */
    function openEditModal(stationId) {
        const stations = getStations();
        const station = stations.find(s => s.id === stationId);
        if (!station) return;

        const formHtml = `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">電台名稱 *</label>
                    <input type="text" id="modal-station-name" class="search-input" value="${escapeHtml(station.name)}" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">串流音訊網址 (Stream URL) *</label>
                    <input type="text" id="modal-station-url" class="search-input" value="${escapeHtml(station.url)}" style="width: 100%;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">分類</label>
                        <input type="text" id="modal-station-cat" class="search-input" value="${escapeHtml(station.category || '')}" style="width: 100%;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">所在地區</label>
                        <input type="text" id="modal-station-loc" class="search-input" value="${escapeHtml(station.location || '')}" style="width: 100%;">
                    </div>
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">標籤</label>
                    <input type="text" id="modal-station-tags" class="search-input" value="${escapeHtml(station.tags || '')}" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">簡介 / 備註說明</label>
                    <input type="text" id="modal-station-desc" class="search-input" value="${escapeHtml(station.desc || '')}" style="width: 100%;">
                </div>
            </div>
        `;

        Modal.open({
            title: '✏️ 編輯電台資訊',
            html: formHtml,
            onConfirm: async () => {
                const name = document.getElementById('modal-station-name').value.trim();
                const url = document.getElementById('modal-station-url').value.trim();
                const category = document.getElementById('modal-station-cat').value.trim() || '自訂電台';
                const location = document.getElementById('modal-station-loc').value.trim() || '台灣';
                const tags = document.getElementById('modal-station-tags').value.trim();
                const desc = document.getElementById('modal-station-desc').value.trim();

                if (!name || !url) {
                    alert('請務必填寫電台名稱與串流網址！');
                    return false;
                }

                station.name = name;
                station.url = url;
                station.category = category;
                station.location = location;
                station.tags = tags;
                station.desc = desc;

                // 若剛好在播放此電台，更新當前資訊
                if (currentStation && currentStation.id === station.id) {
                    currentStation = station;
                    updateDeckUI();
                }

                await Storage.save();
                renderMyStations();
                return true;
            }
        });
    }

    /**
     * 刪除電台
     */
    async function deleteStation(stationId) {
        const stations = getStations();
        const idx = stations.findIndex(s => s.id === stationId);
        if (idx === -1) return;

        const target = stations[idx];
        if (!confirm(`確定要刪除「${target.name}」電台嗎？`)) {
            return;
        }

        if (currentStation && currentStation.id === target.id) {
            stop();
            currentStation = null;
            updateDeckUI();
        }

        stations.splice(idx, 1);
        await Storage.save();
        renderMyStations();
    }

    // DOM 載入後初始化
    document.addEventListener('DOMContentLoaded', () => {
        initAudio();
        Storage.init(() => {
            renderMyStations();
            updateDeckUI();
        });
    });

    return {
        playStation,
        togglePlay,
        stop,
        setVolume,
        toggleMute,
        handleMySearch,
        setCategoryFilter,
        handleCardPlay,
        switchTab,
        exploreByTag,
        handlePresetSelect,
        searchOnline,
        previewOnlineStation,
        addFromOnline,
        openAddModal,
        openEditModal,
        deleteStation
    };
})();

window.RadioApp = RadioApp;
