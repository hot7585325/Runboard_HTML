(function() {
    // --- State ---
    let currentHandle = null;
    let currentExt = '';
    let editor = null; // CodeMirror instance
    let tabulatorTable = null; // Tabulator instance
    let jsonEditor = null; // JSONEditor instance
    
    // Mode toggles
    let isCsvTableView = true; // CSV: Table vs Raw CodeMirror
    let isJsonTreeView = true; // JSON: Tree vs Raw CodeMirror
    let rawTextLines = [];

    // --- DOM Elements ---
    const ui = {
        appContainer: document.getElementById('app-container'),
        noDataMsg: document.getElementById('no-data-msg'),
        fileName: document.getElementById('file-name-display'),
        btnSave: document.getElementById('btn-save'),
        btnToggleCsvRaw: document.getElementById('btn-toggle-csv-raw'),
        btnToggleJsonRaw: document.getElementById('btn-toggle-json-raw'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterResults: document.getElementById('filter-results'),
        filterStats: document.getElementById('filter-stats'),
        
        // Panels
        singleEditorContainer: document.getElementById('single-editor-container'),
        editorContainer: document.getElementById('editor-container'),
        splitContainer: document.getElementById('split-container'),
        splitLeft: document.getElementById('split-left'),
        splitResizer: document.getElementById('split-resizer'),
        splitRight: document.getElementById('split-right'),
        mdEditorContainer: document.getElementById('md-editor-container'),
        mdPreviewPaper: document.getElementById('md-preview-paper'),
        wordContainer: document.getElementById('word-container'),
        wordPaper: document.getElementById('word-paper'),
        gridContainer: document.getElementById('grid-container'),
        jsonTreeContainer: document.getElementById('json-tree-container')
    };

    // --- Core File Picker ---
    async function selectFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Supported Files',
                    accept: {
                        'text/plain': ['.txt', '.md', '.csv', '.json', '.js', '.html', '.css'],
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                    }
                }]
            });
            if (handle) {
                currentHandle = handle;
                const file = await handle.getFile();
                ui.fileName.textContent = file.name;
                currentExt = file.name.split('.').pop().toLowerCase();
                
                ui.noDataMsg.style.display = 'none';
                ui.appContainer.style.display = 'block';
                
                await routeFile(file);
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
        }
    }

    // --- Route by Extension ---
    async function routeFile(file) {
        // Hide all view panels
        ui.singleEditorContainer.style.display = 'none';
        ui.splitContainer.style.display = 'none';
        ui.wordContainer.style.display = 'none';
        ui.gridContainer.style.display = 'none';
        ui.jsonTreeContainer.style.display = 'none';

        // Reset Toolbar Buttons
        ui.btnSave.style.display = 'none';
        ui.btnToggleCsvRaw.style.display = 'none';
        ui.btnToggleJsonRaw.style.display = 'none';
        ui.searchInput.value = '';
        ui.filterResults.innerHTML = '';
        ui.filterStats.textContent = '共 0 筆結果';

        isCsvTableView = true;
        isJsonTreeView = true;

        if (tabulatorTable) {
            tabulatorTable.destroy();
            tabulatorTable = null;
        }
        if (jsonEditor) {
            jsonEditor.destroy();
            jsonEditor = null;
        }

        if (currentExt === 'md') {
            await handleMarkdownFile(file);
        } else if (currentExt === 'json') {
            await handleJsonFile(file);
        } else if (currentExt === 'csv') {
            await handleCsvFile(file);
        } else if (currentExt === 'xlsx') {
            await handleExcelFile(file);
        } else if (currentExt === 'docx') {
            await handleWordFile(file);
        } else if (['txt', 'js', 'html', 'css'].includes(currentExt)) {
            await handleSingleTextFile(file);
        } else {
            alert('不支援的檔案格式預覽');
        }
    }

    // --- 1. Markdown Handler (Draggable Split View) ---
    async function handleMarkdownFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');

        ui.splitContainer.style.display = 'flex';
        ui.btnSave.style.display = 'flex';

        initCodeMirror(ui.mdEditorContainer, text, 'md', (newVal) => {
            ui.mdPreviewPaper.innerHTML = marked.parse(newVal);
            rawTextLines = newVal.split('\n');
            runFilter(ui.searchInput.value);
        });

        ui.mdPreviewPaper.innerHTML = marked.parse(text);
        runFilter('');
    }

    // --- 2. JSON Handler (Tree Editor by default) ---
    async function handleJsonFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');

        ui.jsonTreeContainer.style.display = 'block';
        ui.btnSave.style.display = 'flex';
        ui.btnToggleJsonRaw.style.display = 'flex';
        ui.btnToggleJsonRaw.innerHTML = '📝 切換原始碼';

        try {
            const jsonObj = JSON.parse(text);
            initJSONEditor(jsonObj);
        } catch (e) {
            console.warn('JSON 語法有誤，降級切換至 CodeMirror 代碼模式:', e);
            toggleJsonRawView();
        }

        initCodeMirror(ui.editorContainer, text, 'json', (newVal) => {
            rawTextLines = newVal.split('\n');
            runFilter(ui.searchInput.value);
        });

        runFilter('');
    }

    function initJSONEditor(initialData) {
        ui.jsonTreeContainer.innerHTML = '';
        const options = {
            mode: 'tree',
            modes: ['tree', 'view'],
            onChangeText: function(jsonString) {
                if (editor) {
                    editor.setValue(jsonString);
                    rawTextLines = jsonString.split('\n');
                }
            }
        };
        jsonEditor = new JSONEditor(ui.jsonTreeContainer, options, initialData);
        jsonEditor.expandAll();
    }

    // --- 3. CSV Handler (Table Grid by default) ---
    async function handleCsvFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');

        ui.gridContainer.style.display = 'block';
        ui.btnSave.style.display = 'flex';
        ui.btnToggleCsvRaw.style.display = 'flex';
        ui.btnToggleCsvRaw.innerHTML = '📝 切換原始碼';

        initCodeMirror(ui.editorContainer, text, 'csv', (newVal) => {
            rawTextLines = newVal.split('\n');
            runFilter(ui.searchInput.value);
        });

        renderCsvToTabulator(text, true);
        runFilter('');
    }

    // --- 4. Single Text / Code Handler ---
    async function handleSingleTextFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');

        ui.singleEditorContainer.style.display = 'block';
        ui.btnSave.style.display = 'flex';

        initCodeMirror(ui.editorContainer, text, currentExt, (newVal) => {
            rawTextLines = newVal.split('\n');
            runFilter(ui.searchInput.value);
        });

        runFilter('');
    }

    // --- 5. Excel Handler (Modern Tabulator) ---
    async function handleExcelFile(file) {
        ui.gridContainer.style.display = 'block';
        const arrayBuffer = await file.arrayBuffer();

        try {
            const workbook = XLSX.read(arrayBuffer, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});

            if (jsonData.length === 0) {
                ui.gridContainer.innerHTML = '<div style="padding:20px; color:#888;">試算表為空</div>';
                return;
            }

            renderArrayDataToTabulator(jsonData, false);
            runFilter('');
        } catch (e) {
            console.error('Excel Parsing Error:', e);
            ui.gridContainer.innerHTML = '<div style="padding:20px; color:red">解析 Excel 失敗</div>';
        }
    }

    // --- 6. Word Handler (A4 Paper View) ---
    async function handleWordFile(file) {
        ui.wordContainer.style.display = 'flex';
        const arrayBuffer = await file.arrayBuffer();

        try {
            const resultHtml = await mammoth.convertToHtml({arrayBuffer: arrayBuffer});
            ui.wordPaper.innerHTML = resultHtml.value || '<p style="color:#888;">(空白文件)</p>';

            const resultText = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
            rawTextLines = resultText.value.split('\n');
            runFilter('');
        } catch (e) {
            console.error('Word Parsing Error:', e);
            ui.wordPaper.innerHTML = '<p style="color:red">解析 Word 失敗</p>';
        }
    }

    // --- Tabulator Helpers ---
    function parseCsvToRows(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
        return lines.map(line => {
            const row = [];
            let inQuotes = false;
            let current = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    row.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            row.push(current.trim());
            return row;
        });
    }

    function renderCsvToTabulator(csvText, isEditable) {
        const rows = parseCsvToRows(csvText);
        if (rows.length === 0) {
            ui.gridContainer.innerHTML = '<div style="padding:20px; color:#888;">CSV 為空</div>';
            return;
        }
        renderArrayDataToTabulator(rows, isEditable);
    }

    function renderArrayDataToTabulator(matrix, isEditable) {
        const headers = matrix[0] || [];
        const columns = headers.map((h, idx) => ({
            title: String(h || `欄位 ${idx + 1}`),
            field: `col_${idx}`,
            headerSort: true,
            editor: isEditable ? "input" : false,
            resizable: true
        }));

        const tableData = [];
        for (let r = 1; r < matrix.length; r++) {
            const rowObj = { id: r };
            const rowValues = matrix[r];
            headers.forEach((_, idx) => {
                rowObj[`col_${idx}`] = rowValues ? (rowValues[idx] !== undefined ? rowValues[idx] : '') : '';
            });
            tableData.push(rowObj);
        }

        tabulatorTable = new Tabulator(ui.gridContainer, {
            data: tableData,
            columns: columns,
            layout: "fitDataFill",
            maxHeight: "100%",
            placeholder: "無資料",
            cellEdited: function() {
                if (currentExt === 'csv') {
                    syncTabulatorToCodeMirror();
                }
            }
        });
    }

    function syncTabulatorToCodeMirror() {
        if (!tabulatorTable || currentExt !== 'csv') return;
        const columns = tabulatorTable.getColumnDefinitions();
        const data = tabulatorTable.getData();
        
        const headerRow = columns.map(col => `"${String(col.title).replace(/"/g, '""')}"`).join(',');
        const dataRows = data.map(row => {
            return columns.map(col => {
                const val = row[col.field] !== undefined ? String(row[col.field]) : '';
                return `"${val.replace(/"/g, '""')}"`;
            }).join(',');
        });

        const newCsv = [headerRow, ...dataRows].join('\n');
        if (editor) {
            editor.setValue(newCsv);
            rawTextLines = newCsv.split('\n');
        }
    }

    // --- CodeMirror Initializer ---
    function initCodeMirror(mountNode, text, ext, onChangeCallback) {
        mountNode.innerHTML = '';
        let mode = 'null';
        if (ext === 'md') mode = 'markdown';
        else if (ext === 'js' || ext === 'json') mode = 'javascript';
        else if (ext === 'html') mode = 'xml';

        editor = CodeMirror(mountNode, {
            value: text,
            mode: mode,
            lineNumbers: true,
            theme: 'monokai',
            lineWrapping: true
        });

        editor.on('change', () => {
            if (typeof onChangeCallback === 'function') {
                onChangeCallback(editor.getValue());
            }
        });

        setTimeout(() => editor.refresh(), 50);
    }

    // --- Save File Handler ---
    async function saveFile() {
        if (!currentHandle) return;
        try {
            let contentToSave = '';
            if (currentExt === 'csv' && isCsvTableView) {
                syncTabulatorToCodeMirror();
                contentToSave = editor.getValue();
            } else if (currentExt === 'json' && isJsonTreeView && jsonEditor) {
                contentToSave = JSON.stringify(jsonEditor.get(), null, 2);
            } else if (editor) {
                contentToSave = editor.getValue();
            }

            const writable = await currentHandle.createWritable();
            await writable.write(contentToSave);
            await writable.close();

            const origText = ui.btnSave.innerHTML;
            ui.btnSave.innerHTML = '✅ 已儲存';
            setTimeout(() => ui.btnSave.innerHTML = origText, 2000);
        } catch (e) {
            console.error(e);
            alert('儲存失敗，可能是權限不足或檔案已被鎖定。');
        }
    }

    // --- Toggle Functions ---
    function toggleCsvRawView() {
        if (currentExt !== 'csv') return;
        isCsvTableView = !isCsvTableView;
        if (isCsvTableView) {
            ui.singleEditorContainer.style.display = 'none';
            ui.gridContainer.style.display = 'block';
            renderCsvToTabulator(editor.getValue(), true);
            ui.btnToggleCsvRaw.innerHTML = '📝 切換原始碼';
        } else {
            syncTabulatorToCodeMirror();
            ui.gridContainer.style.display = 'none';
            ui.singleEditorContainer.style.display = 'block';
            editor.refresh();
            ui.btnToggleCsvRaw.innerHTML = '📊 切換表格視圖';
        }
    }

    function toggleJsonRawView() {
        if (currentExt !== 'json') return;
        isJsonTreeView = !isJsonTreeView;
        if (isJsonTreeView) {
            // Raw -> Tree
            try {
                const jsonObj = JSON.parse(editor.getValue());
                ui.singleEditorContainer.style.display = 'none';
                ui.jsonTreeContainer.style.display = 'block';
                initJSONEditor(jsonObj);
                ui.btnToggleJsonRaw.innerHTML = '📝 切換原始碼';
            } catch (e) {
                alert('目前代碼非有效 JSON，無法切換為樹狀視圖：' + e.message);
                isJsonTreeView = false;
            }
        } else {
            // Tree -> Raw
            if (jsonEditor) {
                const jsonString = JSON.stringify(jsonEditor.get(), null, 2);
                editor.setValue(jsonString);
            }
            ui.jsonTreeContainer.style.display = 'none';
            ui.singleEditorContainer.style.display = 'block';
            editor.refresh();
            ui.btnToggleJsonRaw.innerHTML = '🌳 切換樹狀視圖';
        }
    }

    // --- Resizer Logic for Markdown Split View ---
    let isResizing = false;
    ui.splitResizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        ui.splitResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const containerRect = ui.splitContainer.getBoundingClientRect();
        let newLeftWidth = e.clientX - containerRect.left;
        let percentage = (newLeftWidth / containerRect.width) * 100;
        if (percentage < 15) percentage = 15;
        if (percentage > 85) percentage = 85;
        ui.splitLeft.style.width = percentage + '%';
        if (editor) editor.refresh();
    });

    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            ui.splitResizer.classList.remove('resizing');
            document.body.style.cursor = 'default';
        }
    });

    // --- Search & Filter Drawer ---
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

    ui.btnOpenSearch.addEventListener('click', () => toggleSearchDrawer(true));
    ui.btnCloseSearch.addEventListener('click', () => toggleSearchDrawer(false));

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleSearchDrawer(true);
        } else if (e.key === 'Escape' && ui.searchDrawer.classList.contains('open')) {
            toggleSearchDrawer(false);
        }
    });

    function runFilter(query) {
        ui.filterResults.innerHTML = '';
        if (!currentHandle) {
            ui.filterStats.textContent = '請先載入檔案';
            return;
        }

        // Table Mode filtering (CSV/Excel)
        if (tabulatorTable && ((currentExt === 'csv' && isCsvTableView) || currentExt === 'xlsx')) {
            if (!query) {
                tabulatorTable.clearFilter();
                const total = tabulatorTable.getData().length;
                ui.filterStats.textContent = `顯示全部 (共 ${total} 列)`;
            } else {
                tabulatorTable.setFilter(function(data) {
                    const q = query.toLowerCase();
                    return Object.values(data).some(val => String(val).toLowerCase().includes(q));
                });
                const count = tabulatorTable.getData("active").length;
                ui.filterStats.textContent = `符合 ${count} 列資料`;
            }
        }

        // Text & Line-based filtering
        let regex = null;
        if (query) {
            try { regex = new RegExp(query, 'i'); } catch (e) { regex = null; }
        }

        const fragment = document.createDocumentFragment();
        let matchCount = 0;

        if (rawTextLines.length > 0) {
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
                        } catch(e){}
                    }

                    div.innerHTML = `<span class="result-line-num">L${i + 1}</span>${displayHtml}`;

                    // Click to jump in CodeMirror
                    if (editor) {
                        div.addEventListener('click', () => {
                            editor.setCursor({line: i, ch: 0});
                            editor.focus();
                            const t = editor.charCoords({line: i, ch: 0}, "local").top;
                            const middleHeight = editor.getScrollerElement().offsetHeight / 2;
                            editor.scrollTo(null, t - middleHeight - 5);
                        });
                    }
                    fragment.appendChild(div);
                }
            }
        }

        ui.filterResults.appendChild(fragment);
        if (!tabulatorTable || (currentExt === 'csv' && !isCsvTableView)) {
            ui.filterStats.textContent = query ? `找到 ${matchCount} 筆結果` : `顯示全部 (共 ${matchCount} 行)`;
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    // --- Event Listeners ---
    document.getElementById('btn-initial-open').addEventListener('click', selectFile);
    document.getElementById('btn-open').addEventListener('click', selectFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnToggleCsvRaw.addEventListener('click', toggleCsvRawView);
    ui.btnToggleJsonRaw.addEventListener('click', toggleJsonRawView);

    ui.searchInput.addEventListener('input', (e) => {
        runFilter(e.target.value);
    });

})();
