/**
 * Runboard - CSV 試算表專屬邏輯 (editor_csv.js)
 * 獨立模組：負責 Tabulator 渲染、動態欄列增刪、表頭編輯、雙向同步與 RFC 4180 CSV 存取
 */
(function () {
    let currentHandle = null;
    let tabulatorTable = null;
    let isTableView = true;

    const ui = {
        gridContainer: document.getElementById('grid-container'),
        rawContainer: document.getElementById('raw-container'),
        rawTextarea: document.getElementById('raw-csv-textarea'),
        fileNameDisplay: document.getElementById('file-name-display'),
        btnNew: document.getElementById('btn-new'),
        btnLoadTemplate: document.getElementById('btn-load-template'),
        btnOpen: document.getElementById('btn-open'),
        btnSave: document.getElementById('btn-save'),
        btnAddRow: document.getElementById('btn-add-row'),
        btnAddCol: document.getElementById('btn-add-col'),
        btnToggleRaw: document.getElementById('btn-toggle-raw'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterStats: document.getElementById('filter-stats')
    };

    const BLANK_TEMPLATE = '欄位 1,欄位 2,欄位 3\n,,';
    const DEFAULT_TEMPLATE = '名稱,數量,單價,備註\n蘋果,10,25,新鮮到貨\n香蕉,5,15,特價中\n橘子,8,30,甜度高\n';

    // --- CSV 解析器 ---
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

    // --- 渲染 Tabulator 表格 ---
    function renderCsvToTabulator(csvText) {
        const matrix = parseCsvToRows(csvText);
        if (matrix.length === 0) {
            matrix.push(['欄位 1', '欄位 2', '欄位 3']);
            matrix.push(['', '', '']);
        }

        const headers = matrix[0] || [];
        const columns = headers.map((h, idx) => ({
            title: String(h || `欄位 ${idx + 1}`),
            field: `col_${idx}`,
            headerSort: true,
            editor: "input",
            editableTitle: true,
            resizable: true,
            headerContextMenu: [
                {
                    label: "🗑️ 刪除此欄",
                    action: function(e, column) {
                        const def = column.getDefinition();
                        const title = def.title || '此欄';
                        if (confirm(`確定要刪除「${title}」欄位嗎？`)) {
                            column.delete();
                            syncToTextarea();
                        }
                    }
                }
            ]
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

        if (tabulatorTable) {
            tabulatorTable.destroy();
        }

        tabulatorTable = new Tabulator(ui.gridContainer, {
            data: tableData,
            columns: columns,
            layout: "fitDataFill",
            maxHeight: "100%",
            placeholder: "無資料",
            rowContextMenu: [
                {
                    label: "➕ 在下方插入新列",
                    action: function(e, row) {
                        const newRow = { id: Date.now() };
                        tabulatorTable.getColumns().forEach(col => {
                            newRow[col.getField()] = '';
                        });
                        tabulatorTable.addRow(newRow, false, row).then(() => {
                            syncToTextarea();
                        });
                    }
                },
                {
                    label: "🗑️ 刪除此列",
                    action: function(e, row) {
                        row.delete();
                        syncToTextarea();
                    }
                }
            ],
            cellEdited: function() {
                syncToTextarea();
            },
            columnTitleChanged: function() {
                syncToTextarea();
            }
        });

        ui.rawTextarea.value = csvText;
    }

    // --- 序列化 Tabulator 回 CSV 字串 ---
    function syncToTextarea() {
        if (!tabulatorTable) return;
        const columns = tabulatorTable.getColumns();
        const data = tabulatorTable.getData();

        const headerRow = columns.map(col => {
            const def = col.getDefinition();
            let title = def.title;
            try {
                const titleEl = col.getElement().querySelector('.tabulator-col-title');
                if (titleEl && titleEl.textContent && titleEl.textContent.trim()) {
                    title = titleEl.textContent.trim();
                }
            } catch (e) {}
            if (title === undefined || title === null) title = String(col.getField());
            return `"${String(title).replace(/"/g, '""')}"`;
        }).join(',');

        const dataRows = data.map(row => {
            return columns.map(col => {
                const field = col.getField();
                const val = row[field] !== undefined && row[field] !== null ? String(row[field]) : '';
                return `"${val.replace(/"/g, '""')}"`;
            }).join(',');
        });

        ui.rawTextarea.value = [headerRow, ...dataRows].join('\n');
    }

    // --- 新增列與新增欄 ---
    function addRow() {
        if (!tabulatorTable) return;
        const newRow = { id: Date.now() };
        tabulatorTable.getColumns().forEach(col => {
            newRow[col.getField()] = '';
        });
        tabulatorTable.addRow(newRow, false).then(row => {
            if (row && typeof row.scrollTo === 'function') {
                row.scrollTo();
            }
            syncToTextarea();
        });
    }

    function addCol() {
        if (!tabulatorTable) return;
        const cols = tabulatorTable.getColumns();
        const colIndex = cols.length;
        const defaultTitle = `欄位 ${colIndex + 1}`;
        const title = prompt('請輸入新欄位名稱：', defaultTitle);
        if (title === null) return;

        const newField = `col_${Date.now()}_${colIndex}`;
        tabulatorTable.addColumn({
            title: title.trim() || defaultTitle,
            field: newField,
            headerSort: true,
            editor: "input",
            editableTitle: true,
            resizable: true,
            headerContextMenu: [
                {
                    label: "🗑️ 刪除此欄",
                    action: function(e, column) {
                        const def = column.getDefinition();
                        const colTitle = def.title || '此欄';
                        if (confirm(`確定要刪除「${colTitle}」欄位嗎？`)) {
                            column.delete();
                            syncToTextarea();
                        }
                    }
                }
            ]
        }, false).then(() => {
            syncToTextarea();
        });
    }

    // --- 切換表格與原始碼 ---
    function toggleRawView() {
        isTableView = !isTableView;
        if (isTableView) {
            // Raw -> Table
            renderCsvToTabulator(ui.rawTextarea.value);
            ui.rawContainer.style.display = 'none';
            ui.gridContainer.style.display = 'block';
            ui.btnAddRow.style.display = 'inline-flex';
            ui.btnAddCol.style.display = 'inline-flex';
            ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
        } else {
            // Table -> Raw
            syncToTextarea();
            ui.gridContainer.style.display = 'none';
            ui.rawContainer.style.display = 'block';
            ui.btnAddRow.style.display = 'none';
            ui.btnAddCol.style.display = 'none';
            ui.btnToggleRaw.innerHTML = '📊 切換表格視圖';
        }
    }

    // --- 建立全新空白 CSV ---
    function createNew() {
        currentHandle = null;
        ui.fileNameDisplay.textContent = '⚡ 未命名試算表.csv (尚未存檔)';
        isTableView = true;
        ui.rawContainer.style.display = 'none';
        ui.gridContainer.style.display = 'block';
        ui.btnAddRow.style.display = 'inline-flex';
        ui.btnAddCol.style.display = 'inline-flex';
        ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
        renderCsvToTabulator(BLANK_TEMPLATE);
    }

    // --- 載入範本 ---
    function loadTemplate() {
        if (ui.rawTextarea.value.trim() !== '' && ui.rawTextarea.value.trim() !== BLANK_TEMPLATE.trim()) {
            if (!confirm('載入範本將覆蓋目前編輯的試算表，確定要繼續嗎？')) {
                return;
            }
        }
        currentHandle = null;
        ui.fileNameDisplay.textContent = '⚡ 範本試算表.csv (尚未存檔)';
        isTableView = true;
        ui.rawContainer.style.display = 'none';
        ui.gridContainer.style.display = 'block';
        ui.btnAddRow.style.display = 'inline-flex';
        ui.btnAddCol.style.display = 'inline-flex';
        ui.btnToggleRaw.innerHTML = '📝 切換原始碼';
        renderCsvToTabulator(DEFAULT_TEMPLATE);
    }

    // --- 開啟本機檔案 ---
    async function openFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'CSV 試算表檔案',
                    accept: { 'text/csv': ['.csv', '.tsv', '.txt'] }
                }]
            });
            if (handle) {
                currentHandle = handle;
                const file = await handle.getFile();
                ui.fileNameDisplay.textContent = file.name;
                const text = await file.text();
                renderCsvToTabulator(text);
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error('開啟檔案失敗:', e);
        }
    }

    // --- 儲存檔案 ---
    async function saveFile() {
        try {
            if (!currentHandle) {
                currentHandle = await window.showSaveFilePicker({
                    suggestedName: '未命名試算表.csv',
                    types: [{
                        description: 'CSV 試算表',
                        accept: { 'text/csv': ['.csv'] }
                    }]
                });
                const file = await currentHandle.getFile();
                ui.fileNameDisplay.textContent = file.name;
            }

            if (isTableView) {
                syncToTextarea();
            }

            const writable = await currentHandle.createWritable();
            await writable.write(ui.rawTextarea.value);
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
        if (!tabulatorTable) return;
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

    // --- 事件監聽 ---
    ui.btnNew.addEventListener('click', createNew);
    if (ui.btnLoadTemplate) ui.btnLoadTemplate.addEventListener('click', loadTemplate);
    ui.btnOpen.addEventListener('click', openFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnAddRow.addEventListener('click', addRow);
    ui.btnAddCol.addEventListener('click', addCol);
    ui.btnToggleRaw.addEventListener('click', toggleRawView);

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

    // 初始化載入範本
    createNew();
})();
