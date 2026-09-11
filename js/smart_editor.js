(function() {
    // --- State ---
    let currentHandle = null;
    let currentExt = '';
    let editor = null; // CodeMirror instance
    
    // For filtering
    let rawTextLines = []; // Used for text/md/docx text extraction
    let excelRows = []; // Used for excel filtering

    // --- DOM Elements ---
    const ui = {
        appContainer: document.getElementById('app-container'),
        noDataMsg: document.getElementById('no-data-msg'),
        fileName: document.getElementById('file-name-display'),
        btnSave: document.getElementById('btn-save'),
        btnTogglePreview: document.getElementById('btn-toggle-preview'),
        editorContainer: document.getElementById('editor-container'),
        previewContainer: document.getElementById('preview-container'),
        excelContainer: document.getElementById('excel-container'),
        searchInput: document.getElementById('search-input'),
        filterResults: document.getElementById('filter-results'),
        filterStats: document.getElementById('filter-stats')
    };

    let isPreviewMode = false;

    // --- Core Routing & File Access ---
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
        // Reset UI
        ui.editorContainer.style.display = 'none';
        ui.previewContainer.style.display = 'none';
        ui.excelContainer.style.display = 'none';
        ui.btnSave.style.display = 'none';
        ui.btnTogglePreview.style.display = 'none';
        ui.searchInput.value = '';
        ui.filterResults.innerHTML = '';
        ui.filterStats.textContent = '分析中...';
        isPreviewMode = false;

        const textExtensions = ['txt', 'md', 'json', 'csv', 'js', 'html', 'css'];
        
        if (textExtensions.includes(currentExt)) {
            await handleTextFile(file);
        } else if (currentExt === 'xlsx') {
            await handleExcelFile(file);
        } else if (currentExt === 'docx') {
            await handleWordFile(file);
        } else {
            alert('不支援的檔案格式預覽');
        }
    }

    // --- Handlers ---
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
        runFilter(''); // init filter
    }

    async function handleExcelFile(file) {
        ui.excelContainer.style.display = 'block';
        const arrayBuffer = await file.arrayBuffer();
        
        try {
            const workbook = XLSX.read(arrayBuffer, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Render HTML table
            const htmlString = XLSX.utils.sheet_to_html(worksheet);
            ui.excelContainer.innerHTML = htmlString;
            
            // Extract raw rows for filtering
            excelRows = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            runFilter('');
        } catch (e) {
            console.error('Excel Parsing Error:', e);
            ui.excelContainer.innerHTML = '<div style="color:red">解析 Excel 失敗</div>';
        }
    }

    async function handleWordFile(file) {
        ui.previewContainer.style.display = 'block';
        const arrayBuffer = await file.arrayBuffer();
        
        try {
            // 1. Get HTML for preview
            const resultHtml = await mammoth.convertToHtml({arrayBuffer: arrayBuffer});
            ui.previewContainer.innerHTML = resultHtml.value;
            
            // 2. Get Raw text for filtering
            const resultText = await mammoth.extractRawText({arrayBuffer: arrayBuffer});
            rawTextLines = resultText.value.split('\n');
            runFilter('');
        } catch (e) {
            console.error('Word Parsing Error:', e);
            ui.previewContainer.innerHTML = '<div style="color:red">解析 Word 失敗</div>';
        }
    }

    // --- Editor Logic ---
    function initCodeMirror(text, ext) {
        if (!editor) {
            editor = CodeMirror(ui.editorContainer, {
                lineNumbers: true,
                theme: 'monokai',
                lineWrapping: true
            });
            
            editor.on('change', () => {
                if (['txt', 'md', 'json', 'csv', 'js', 'html', 'css'].includes(currentExt)) {
                    // Update rawTextLines so filter works on live edits
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
        
        // Timeout needed for CodeMirror to refresh properly if it was hidden
        setTimeout(() => editor.refresh(), 50);
    }

    async function saveFile() {
        if (!currentHandle || !editor) return;
        try {
            const writable = await currentHandle.createWritable();
            await writable.write(editor.getValue());
            await writable.close();
            
            const origText = ui.btnSave.innerHTML;
            ui.btnSave.innerHTML = '✅ 已儲存';
            setTimeout(() => ui.btnSave.innerHTML = origText, 2000);
        } catch (e) {
            console.error(e);
            alert('儲存失敗，可能是權限不足或檔案已被鎖定。');
        }
    }

    function togglePreview() {
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

    // --- Filtering Engine ---
    function runFilter(query) {
        ui.filterResults.innerHTML = '';
        
        if (!currentHandle) {
            ui.filterStats.textContent = '請先載入檔案';
            return;
        }

        let regex = null;
        if (query) {
            try {
                regex = new RegExp(query, 'i');
            } catch (e) {
                // invalid regex, use normal string match
                regex = null; 
            }
        }

        const fragment = document.createDocumentFragment();
        let matchCount = 0;

        if (['txt', 'md', 'json', 'csv', 'js', 'html', 'css', 'docx'].includes(currentExt)) {
            for (let i = 0; i < rawTextLines.length; i++) {
                const line = rawTextLines[i];
                if (!line.trim()) continue; // skip empty lines for cleaner results
                
                const isMatch = !query || (regex ? regex.test(line) : line.toLowerCase().includes(query.toLowerCase()));
                if (isMatch) {
                    matchCount++;
                    const div = document.createElement('div');
                    div.className = 'result-item';
                    
                    // Highlight match
                    let displayHtml = escapeHTML(line);
                    if (query) {
                        try {
                            const hlRegex = regex ? new RegExp(`(${query})`, 'gi') : new RegExp(`(${escapeHTML(query)})`, 'gi');
                            displayHtml = displayHtml.replace(hlRegex, '<span class="result-highlight">$1</span>');
                        } catch(e){}
                    }

                    div.innerHTML = `<span class="result-line-num">L${i + 1}</span>${displayHtml}`;
                    
                    // Click to jump (only works well for CodeMirror edits)
                    if (['txt', 'md', 'json', 'csv', 'js', 'html', 'css'].includes(currentExt) && !isPreviewMode) {
                        div.addEventListener('click', () => {
                            if (editor) {
                                editor.setCursor({line: i, ch: 0});
                                editor.focus();
                                // Scroll line to center
                                const t = editor.charCoords({line: i, ch: 0}, "local").top;
                                const middleHeight = editor.getScrollerElement().offsetHeight / 2;
                                editor.scrollTo(null, t - middleHeight - 5);
                            }
                        });
                    }
                    fragment.appendChild(div);
                }
            }
        } else if (currentExt === 'xlsx') {
            for (let i = 0; i < excelRows.length; i++) {
                const row = excelRows[i]; // Array of cell values
                if (!row || row.length === 0) continue;
                
                const rowText = row.join(' | ');
                const isMatch = !query || (regex ? regex.test(rowText) : rowText.toLowerCase().includes(query.toLowerCase()));
                
                if (isMatch) {
                    matchCount++;
                    const div = document.createElement('div');
                    div.className = 'result-item';
                    
                    let displayHtml = escapeHTML(rowText);
                    if (query) {
                        try {
                            const hlRegex = regex ? new RegExp(`(${query})`, 'gi') : new RegExp(`(${escapeHTML(query)})`, 'gi');
                            displayHtml = displayHtml.replace(hlRegex, '<span class="result-highlight">$1</span>');
                        } catch(e){}
                    }

                    div.innerHTML = `<span class="result-line-num">Row ${i + 1}</span>${displayHtml}`;
                    fragment.appendChild(div);
                }
            }
        }

        ui.filterResults.appendChild(fragment);
        ui.filterStats.textContent = query ? `找到 ${matchCount} 筆結果` : `顯示全部 (共 ${matchCount} 筆)`;
    }

    function escapeHTML(str) {
        if(typeof str !== 'string') str = String(str);
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    // --- Events ---
    document.getElementById('btn-initial-open').addEventListener('click', selectFile);
    document.getElementById('btn-open').addEventListener('click', selectFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnTogglePreview.addEventListener('click', togglePreview);
    
    ui.searchInput.addEventListener('input', (e) => {
        // Debounce for performance if large file? Currently synchronous.
        runFilter(e.target.value);
    });

})();
