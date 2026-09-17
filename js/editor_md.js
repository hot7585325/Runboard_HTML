/**
 * Runboard - Markdown 筆記專屬邏輯 (editor_md.js)
 * 獨立模組：負責 CodeMirror Markdown 模式、雙欄拖拉 Resizer、Marked.js 即時渲染與行號跳轉
 */
(function () {
    let currentHandle = null;
    let editor = null;
    let rawTextLines = [];
    let isSplitView = true;

    const ui = {
        mdEditorContainer: document.getElementById('md-editor-container'),
        mdPreviewPaper: document.getElementById('md-preview-paper'),
        splitContainer: document.getElementById('split-container'),
        splitLeft: document.getElementById('split-left'),
        splitResizer: document.getElementById('split-resizer'),
        splitRight: document.getElementById('split-right'),
        fileNameDisplay: document.getElementById('file-name-display'),
        btnNew: document.getElementById('btn-new'),
        btnOpen: document.getElementById('btn-open'),
        btnSave: document.getElementById('btn-save'),
        btnToggleView: document.getElementById('btn-toggle-view'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterStats: document.getElementById('filter-stats'),
        filterResults: document.getElementById('filter-results')
    };

    const DEFAULT_TEMPLATE = '# 未命名筆記\n\n開始在此書寫你的 Markdown 筆記內容...\n\n### 常用標籤範例\n- **粗體文字** 與 *斜體文字*\n- [超連結](https://google.com)\n\n```javascript\nconsole.log("Hello Runboard!");\n```\n';

    // --- 初始化 CodeMirror ---
    function initEditor(text) {
        ui.mdEditorContainer.innerHTML = '';
        editor = CodeMirror(ui.mdEditorContainer, {
            value: text,
            mode: 'markdown',
            lineNumbers: true,
            theme: 'monokai',
            lineWrapping: true
        });

        editor.on('change', () => {
            const val = editor.getValue();
            ui.mdPreviewPaper.innerHTML = marked.parse(val);
            rawTextLines = val.split('\n');
            runFilter(ui.searchInput.value);
        });

        ui.mdPreviewPaper.innerHTML = marked.parse(text);
        rawTextLines = text.split('\n');
        setTimeout(() => editor.refresh(), 50);
    }

    // --- 建立全新筆記 ---
    function createNew() {
        currentHandle = null;
        ui.fileNameDisplay.textContent = '⚡ 未命名筆記.md (尚未存檔)';
        initEditor(DEFAULT_TEMPLATE);
    }

    // --- 開啟本機檔案 ---
    async function openFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Markdown 筆記檔案',
                    accept: { 'text/markdown': ['.md', '.markdown', '.txt'] }
                }]
            });
            if (handle) {
                currentHandle = handle;
                const file = await handle.getFile();
                ui.fileNameDisplay.textContent = file.name;
                const text = await file.text();
                initEditor(text);
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error('開啟檔案失敗:', e);
        }
    }

    // --- 儲存檔案 ---
    async function saveFile() {
        if (!editor) return;
        try {
            if (!currentHandle) {
                currentHandle = await window.showSaveFilePicker({
                    suggestedName: '未命名筆記.md',
                    types: [{
                        description: 'Markdown 筆記',
                        accept: { 'text/markdown': ['.md'] }
                    }]
                });
                const file = await currentHandle.getFile();
                ui.fileNameDisplay.textContent = file.name;
            }

            const writable = await currentHandle.createWritable();
            await writable.write(editor.getValue());
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

    // --- 單/雙欄切換 ---
    function toggleView() {
        isSplitView = !isSplitView;
        if (isSplitView) {
            ui.splitRight.style.display = 'block';
            ui.splitResizer.style.display = 'block';
            ui.splitLeft.style.width = '50%';
            ui.btnToggleView.innerHTML = '👁️ 隱藏預覽';
        } else {
            ui.splitRight.style.display = 'none';
            ui.splitResizer.style.display = 'none';
            ui.splitLeft.style.width = '100%';
            ui.btnToggleView.innerHTML = '👁️ 展開雙欄';
        }
        if (editor) editor.refresh();
    }

    // --- 左右拖拉 Resizer ---
    let isResizing = false;
    ui.splitResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        ui.splitResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const containerRect = ui.splitContainer.getBoundingClientRect();
        let newLeftWidth = e.clientX - containerRect.left;
        let percentage = (newLeftWidth / containerRect.width) * 100;
        if (percentage < 15) percentage = 15;
        if (percentage > 85) percentage = 85;
        ui.splitLeft.style.width = percentage + '%';
        if (editor) editor.refresh();
    });

    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            ui.splitResizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
        }
    });

    // --- 搜尋過濾與行號跳轉 ---
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
                    if (editor) {
                        editor.setCursor({ line: i, ch: 0 });
                        editor.focus();
                        const t = editor.charCoords({ line: i, ch: 0 }, "local").top;
                        const middleHeight = editor.getScrollerElement().offsetHeight / 2;
                        editor.scrollTo(null, t - middleHeight - 5);
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

    // --- 事件綁定 ---
    ui.btnNew.addEventListener('click', createNew);
    ui.btnOpen.addEventListener('click', openFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnToggleView.addEventListener('click', toggleView);

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
