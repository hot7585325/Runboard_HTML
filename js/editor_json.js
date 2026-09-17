/**
 * Runboard - JSON 結構編輯器專屬邏輯 (editor_json.js)
 * 獨立模組：負責 JSONEditor 樹狀視覺化節點、CodeMirror JSON 代碼切換、格式化與儲存
 */
(function () {
    let currentHandle = null;
    let jsonEditor = null;
    let codeMirrorEditor = null;
    let isTreeView = true;
    let rawTextLines = [];

    const ui = {
        treeContainer: document.getElementById('json-tree-container'),
        rawContainer: document.getElementById('raw-json-container'),
        fileNameDisplay: document.getElementById('file-name-display'),
        btnNew: document.getElementById('btn-new'),
        btnLoadTemplate: document.getElementById('btn-load-template'),
        btnOpen: document.getElementById('btn-open'),
        btnSave: document.getElementById('btn-save'),
        btnToggleRaw: document.getElementById('btn-toggle-raw'),
        btnFormat: document.getElementById('btn-format'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterStats: document.getElementById('filter-stats'),
        filterResults: document.getElementById('filter-results')
    };

    const DEFAULT_TEMPLATE = {
        "title": "新建設定檔",
        "version": "1.0.0",
        "active": true,
        "database": {
            "host": "localhost",
            "port": 3306,
            "username": "root"
        },
        "tags": ["系統", "開發", "正式環境"]
    };

    // --- 初始化 JSONEditor ---
    function initTreeEditor(data) {
        ui.treeContainer.innerHTML = '';
        const options = {
            mode: 'tree',
            modes: ['tree', 'view'],
            onChangeText: function (jsonString) {
                if (codeMirrorEditor) {
                    codeMirrorEditor.setValue(jsonString);
                    rawTextLines = jsonString.split('\n');
                }
            }
        };
        jsonEditor = new JSONEditor(ui.treeContainer, options, data);
        jsonEditor.expandAll();
    }

    // --- 初始化 CodeMirror ---
    function initCodeMirror(text) {
        ui.rawContainer.innerHTML = '';
        codeMirrorEditor = CodeMirror(ui.rawContainer, {
            value: text,
            mode: 'javascript',
            lineNumbers: true,
            theme: 'monokai',
            lineWrapping: true
        });

        codeMirrorEditor.on('change', () => {
            const val = codeMirrorEditor.getValue();
            rawTextLines = val.split('\n');
            runFilter(ui.searchInput.value);
        });

        rawTextLines = text.split('\n');
        setTimeout(() => codeMirrorEditor.refresh(), 50);
    }

    // --- 載入 JSON 資料 ---
    function loadJson(jsonObj, jsonString) {
        const text = jsonString || JSON.stringify(jsonObj, null, 2);
        initTreeEditor(jsonObj);
        initCodeMirror(text);
        rawTextLines = text.split('\n');
        runFilter('');
    }

    // --- 建立全新空白 JSON ---
    function createNew() {
        currentHandle = null;
        ui.fileNameDisplay.textContent = '⚡ 未命名資料.json (尚未存檔)';
        isTreeView = true;
        ui.rawContainer.style.display = 'none';
        ui.treeContainer.style.display = 'block';
        ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
        loadJson({});
    }

    // --- 載入範本 ---
    function loadTemplate() {
        if (codeMirrorEditor && codeMirrorEditor.getValue().trim() !== '' && codeMirrorEditor.getValue().trim() !== '{}') {
            if (!confirm('載入範本將覆蓋目前編輯的資料，確定要繼續嗎？')) {
                return;
            }
        }
        currentHandle = null;
        ui.fileNameDisplay.textContent = '⚡ 範本資料.json (尚未存檔)';
        isTreeView = true;
        ui.rawContainer.style.display = 'none';
        ui.treeContainer.style.display = 'block';
        ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
        loadJson(DEFAULT_TEMPLATE);
    }

    // --- 開啟本機檔案 ---
    async function openFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON 資料檔',
                    accept: { 'application/json': ['.json', '.js', '.txt'] }
                }]
            });
            if (handle) {
                currentHandle = handle;
                const file = await handle.getFile();
                ui.fileNameDisplay.textContent = file.name;
                const text = await file.text();
                try {
                    const parsed = JSON.parse(text);
                    loadJson(parsed, text);
                } catch (err) {
                    alert('注意：此檔案非標準 JSON 格式，將以純代碼模式開啟。');
                    initCodeMirror(text);
                    switchToRawView();
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error('開啟檔案失敗:', e);
        }
    }

    // --- 切換樹狀與原始碼 ---
    function switchToRawView() {
        if (jsonEditor) {
            try {
                const jsonString = JSON.stringify(jsonEditor.get(), null, 2);
                if (codeMirrorEditor) codeMirrorEditor.setValue(jsonString);
            } catch (e) {}
        }
        ui.treeContainer.style.display = 'none';
        ui.rawContainer.style.display = 'block';
        if (codeMirrorEditor) codeMirrorEditor.refresh();
        ui.btnToggleRaw.innerHTML = '🌳 切換樹狀視圖';
        isTreeView = false;
    }

    function switchToTreeView() {
        if (codeMirrorEditor) {
            try {
                const jsonObj = JSON.parse(codeMirrorEditor.getValue());
                initTreeEditor(jsonObj);
                ui.rawContainer.style.display = 'none';
                ui.treeContainer.style.display = 'block';
                ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
                isTreeView = true;
            } catch (e) {
                alert('目前代碼非有效 JSON，無法切換為樹狀視圖：\n' + e.message);
            }
        }
    }

    function toggleRawView() {
        if (isTreeView) {
            switchToRawView();
        } else {
            switchToTreeView();
        }
    }

    // --- 一鍵格式化排版 ---
    function formatJson() {
        if (isTreeView && jsonEditor) {
            try {
                const obj = jsonEditor.get();
                const formatted = JSON.stringify(obj, null, 2);
                if (codeMirrorEditor) codeMirrorEditor.setValue(formatted);
                alert('排版已同步更新！');
            } catch (e) {
                alert('格式化失敗：' + e.message);
            }
        } else if (codeMirrorEditor) {
            try {
                const obj = JSON.parse(codeMirrorEditor.getValue());
                codeMirrorEditor.setValue(JSON.stringify(obj, null, 2));
            } catch (e) {
                alert('JSON 語法有誤，無法排版：\n' + e.message);
            }
        }
    }

    // --- 儲存檔案 ---
    async function saveFile() {
        try {
            if (!currentHandle) {
                currentHandle = await window.showSaveFilePicker({
                    suggestedName: '未命名資料.json',
                    types: [{
                        description: 'JSON 資料檔',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const file = await currentHandle.getFile();
                ui.fileNameDisplay.textContent = file.name;
            }

            let contentToSave = '';
            if (isTreeView && jsonEditor) {
                contentToSave = JSON.stringify(jsonEditor.get(), null, 2);
            } else if (codeMirrorEditor) {
                contentToSave = codeMirrorEditor.getValue();
            }

            const writable = await currentHandle.createWritable();
            await writable.write(contentToSave);
            await writable.close();

            const origText = ui.btnSave.innerHTML;
            ui.btnSave.innerHTML = '✅ 已儲存';
            setTimeout(() => ui.btnSave.innerHTML = origText, 2000);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('儲存失敗:', e);
                alert('儲存失敗：' + (e.message || e));
            }
        }
    }

    // --- 搜尋過濾抽屜 ---
    function toggleSearchDrawer(open) {
        if (open !== undefined) {
            ui.searchDrawer.classList.toggle('open', open);
        } else {
            ui.searchDrawer.classList.toggle('open');
        }
        if (ui.searchDrawer.classList.contains('open')) {
            ui.searchInput.focus();
        }
    }

    function runFilter(query) {
        ui.filterResults.innerHTML = '';
        if (rawTextLines.length === 0) {
            ui.filterStats.textContent = '共 0 筆結果';
            return;
        }

        let regex = null;
        if (query) {
            try { regex = new RegExp(query, 'i'); } catch (e) { regex = null; }
        }

        const fragment = document.createDocumentFragment();
        let matchCount = 0;

        for (let i = 0; i < rawTextLines.length; i++) {
            const line = rawTextLines[i];
            if (!line.trim()) continue;

            const isMatch = !query || (regex ? regex.test(line) : line.toLowerCase().includes(query.toLowerCase()));
            if (isMatch) {
                matchCount++;
                const div = document.createElement('div');
                div.className = 'result-item';

                let displayHtml = escapeHTML(line);
                if (query) {
                    try {
                        const hlRegex = regex ? new RegExp(`(${query})`, 'gi') : new RegExp(`(${escapeHTML(query)})`, 'gi');
                        displayHtml = displayHtml.replace(hlRegex, '<span class="result-highlight">$1</span>');
                    } catch (e) {}
                }

                div.innerHTML = `<span class="result-line-num">L${i + 1}</span>${displayHtml}`;
                div.addEventListener('click', () => {
                    // 若在樹狀模式，點擊可自動切換至代碼模式並跳轉該行
                    if (isTreeView) {
                        switchToRawView();
                    }
                    if (codeMirrorEditor) {
                        codeMirrorEditor.setCursor({ line: i, ch: 0 });
                        codeMirrorEditor.focus();
                        const t = codeMirrorEditor.charCoords({ line: i, ch: 0 }, "local").top;
                        const middleHeight = codeMirrorEditor.getScrollerElement().offsetHeight / 2;
                        codeMirrorEditor.scrollTo(null, t - middleHeight - 5);
                    }
                });
                fragment.appendChild(div);
            }
        }

        ui.filterResults.appendChild(fragment);
        ui.filterStats.textContent = query ? `找到 ${matchCount} 筆結果` : `顯示全部 (共 ${matchCount} 行)`;
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    // --- 事件監聽 ---
    ui.btnNew.addEventListener('click', createNew);
    if (ui.btnLoadTemplate) ui.btnLoadTemplate.addEventListener('click', loadTemplate);
    ui.btnOpen.addEventListener('click', openFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnToggleRaw.addEventListener('click', toggleRawView);
    ui.btnFormat.addEventListener('click', formatJson);

    ui.btnOpenSearch.addEventListener('click', () => toggleSearchDrawer(true));
    ui.btnCloseSearch.addEventListener('click', () => toggleSearchDrawer(false));
    ui.searchInput.addEventListener('input', (e) => runFilter(e.target.value));

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleSearchDrawer(true);
        } else if (e.key === 'Escape' && ui.searchDrawer.classList.contains('open')) {
            toggleSearchDrawer(false);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveFile();
        }
    });

    // 初始化
    createNew();
})();
