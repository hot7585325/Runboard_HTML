(function() {
    // --- State ---
    let currentHandle = null;
    let currentExt = '';
    let editor = null; // CodeMirror instance
    let tabulatorTable = null; // Tabulator instance
    
    // For filtering & storage
    let rawTextLines = [];
    let isCsvTableView = true; // For CSV: table vs raw CodeMirror
    let isPreviewMode = false; // For Markdown

    // --- DOM Elements ---
    const ui = {
        appContainer: document.getElementById('app-container'),
        noDataMsg: document.getElementById('no-data-msg'),
        fileName: document.getElementById('file-name-display'),
        btnSave: document.getElementById('btn-save'),
        btnTogglePreview: document.getElementById('btn-toggle-preview'),
        btnToggleCsvRaw: document.getElementById('btn-toggle-csv-raw'),
        editorContainer: document.getElementById('editor-container'),
        previewContainer: document.getElementById('preview-container'),
        wordContainer: document.getElementById('word-container'),
        wordPaper: document.getElementById('word-paper'),
        gridContainer: document.getElementById('grid-container'),
        searchInput: document.getElementById('search-input'),
        filterResults: document.getElementById('filter-results'),
        filterStats: document.getElementById('filter-stats')
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

    async function routeFile(file) {
        // Reset Views
        ui.editorContainer.style.display = 'none';
        ui.previewContainer.style.display = 'none';
        ui.wordContainer.style.display = 'none';
        ui.gridContainer.style.display = 'none';
        ui.btnSave.style.display = 'none';
        ui.btnTogglePreview.style.display = 'none';
        ui.btnToggleCsvRaw.style.display = 'none';
        ui.searchInput.value = '';
        ui.filterResults.innerHTML = '';
        ui.filterStats.textContent = '分析中...';
        isPreviewMode = false;
        isCsvTableView = true;

        if (tabulatorTable) {
            tabulatorTable.destroy();
            tabulatorTable = null;
        }

        if (['txt', 'md', 'json', 'js', 'html', 'css'].includes(currentExt)) {
            await handleTextFile(file);
        } else if (currentExt === 'csv') {
            await handleCsvFile(file);
        } else if (currentExt === 'xlsx') {
            await handleExcelFile(file);
        } else if (currentExt === 'docx') {
            await handleWordFile(file);
        } else {
            alert('不支援的檔案格式預覽');
        }
    }

    // --- 1. Text & Markdown Handler ---
    async function handleTextFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');
        
        ui.editorContainer.style.display = 'block';
        ui.btnSave.style.display = 'flex';
        
        if (currentExt === 'md') {
            ui.btnTogglePreview.style.display = 'flex';
            ui.btnTogglePreview.innerHTML = '👁️ 預覽 Markdown';
        }

        initCodeMirror(text, currentExt);
        runFilter('');
    }

    // --- 2. CSV Handler (Table Grid with direct Edit & Raw toggle) ---
    async function handleCsvFile(file) {
        const text = await file.text();
        rawTextLines = text.split('\n');
        
        // Show Table View by default
        ui.gridContainer.style.display = 'block';
        ui.btnSave.style.display = 'flex';
        ui.btnToggleCsvRaw.style.display = 'flex';
        ui.btnToggleCsvRaw.innerHTML = '📝 切換原始碼';

        initCodeMirror(text, 'csv');
        renderCsvToTabulator(text, true); // true = editable
        runFilter('');
    }

    // --- 3. Excel Handler (Modern Tabulator Read-Only View) ---
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

            renderArrayDataToTabulator(jsonData, false); // false = read-only
            runFilter('');
        } catch (e) {
            console.error('Excel Parsing Error:', e);
            ui.gridContainer.innerHTML = '<div style="padding:20px; color:red">解析 Excel 失敗</div>';
        }
    }

    // --- 4. Word Handler (A4 Paper View) ---
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
        // Robust CSV splitter considering quotes
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
        
        // Headers
        const headerRow = columns.map(col => `"${String(col.title).replace(/"/g, '""')}"`).join(',');
        
        // Rows
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

    // --- CodeMirror Editor Logic ---
    function initCodeMirror(text, ext) {
        if (!editor) {
            editor = CodeMirror(ui.editorContainer, {
                lineNumbers: true,
                theme: 'monokai',
                lineWrapping: true
            });
            
            editor.on('change', () => {
                if (['txt', 'md', 'json', 'js', 'html', 'css'].includes(currentExt)) {
                    rawTextLines = editor.getValue().split('\n');
                    runFilter(ui.searchInput.value);
                }
            });
        }
        
        let mode = 'null';
        if (ext === 'md') mode = 'markdown';
        else if (ext === 'js' || ext === 'json') mode = 'javascript';
        else if (ext === 'html') mode = 'xml';
        
        editor.setOption('mode', mode);
        editor.setValue(text);
        setTimeout(() => editor.refresh(), 50);
    }

    // --- Save File ---
    async function saveFile() {
        if (!currentHandle) return;
        try {
            let contentToSave = '';
            if (currentExt === 'csv' && isCsvTableView) {
                syncTabulatorToCodeMirror();
                contentToSave = editor.getValue();
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

    // --- View Toggles ---
    function toggleMarkdownPreview() {
        if (currentExt !== 'md') return;
        isPreviewMode = !isPreviewMode;
        if (isPreviewMode) {
            ui.editorContainer.style.display = 'none';
            ui.previewContainer.style.display = 'block';
            ui.previewContainer.innerHTML = marked.parse(editor.getValue());
            ui.btnTogglePreview.innerHTML = '✏️ 返回編輯';
        } else {
            ui.editorContainer.style.display = 'block';
            ui.previewContainer.style.display = 'none';
            ui.btnTogglePreview.innerHTML = '👁️ 預覽 Markdown';
            editor.refresh();
        }
    }

    function toggleCsvRawView() {
        if (currentExt !== 'csv') return;
        isCsvTableView = !isCsvTableView;
        if (isCsvTableView) {
            // Re-render table from CodeMirror
            ui.editorContainer.style.display = 'none';
            ui.gridContainer.style.display = 'block';
            renderCsvToTabulator(editor.getValue(), true);
            ui.btnToggleCsvRaw.innerHTML = '📝 切換原始碼';
        } else {
            // Show CodeMirror
            syncTabulatorToCodeMirror();
            ui.gridContainer.style.display = 'none';
            ui.editorContainer.style.display = 'block';
            editor.refresh();
            ui.btnToggleCsvRaw.innerHTML = '📊 切換表格視圖';
        }
    }

    // --- Right Pane Filter Engine ---
    function runFilter(query) {
        ui.filterResults.innerHTML = '';
        if (!currentHandle) {
            ui.filterStats.textContent = '請先載入檔案';
            return;
        }

        // 1. If Tabulator Table is active (CSV or Excel), filter the Table directly!
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
                ui.filterStats.textContent = `表格已過濾：符合 ${count} 列`;
            }
        }

        // 2. Populate Right Pane Results (for Text, MD, Docx, or CSV Raw)
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
                    if (editor && ui.editorContainer.style.display !== 'none') {
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
    ui.btnTogglePreview.addEventListener('click', toggleMarkdownPreview);
    ui.btnToggleCsvRaw.addEventListener('click', toggleCsvRawView);
    
    ui.searchInput.addEventListener('input', (e) => {
        runFilter(e.target.value);
    });

})();
