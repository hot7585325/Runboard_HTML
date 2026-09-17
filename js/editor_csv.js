/**
 * Runboard - CSV 試算表專屬邏輯 (editor_csv.js)
 * 獨立模組：負責 Tabulator 渲染、動態欄列增刪、表頭編輯、雙向同步與 RFC 4180 CSV 存取
 */
(function () {
    const DRAFT_KEY = 'runboard_draft_csv';
    let currentHandle = null;
    let tabulatorTable = null;
    let isTableView = true;
    let isDirty = false;

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
        btnToggleFilter: document.getElementById('btn-toggle-filter'),
        btnToggleRaw: document.getElementById('btn-toggle-raw'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterStats: document.getElementById('filter-stats')
    };

    const BLANK_TEMPLATE = '欄位 1,欄位 2,欄位 3\n,,';
    const DEFAULT_TEMPLATE = '名稱,數量,單價,備註\n蘋果,10,25,新鮮到貨\n香蕉,5,15,特價中\n橘子,8,30,甜度高\n';

    let isFilterVisible = false;
    let activeCell = null;
    const fillHandleEl = document.createElement('div');
    fillHandleEl.className = 'cell-fill-handle';
    fillHandleEl.title = '向下拖曳填滿（數字將自動遞增，按住 Ctrl 強制同值）';

    // --- 儲存格選取與掛載 Fill Handle ---
    function attachFillHandle(cell) {
        if (!cell) return;
        if (activeCell && activeCell !== cell) {
            try {
                activeCell.getElement().classList.remove('active-cell');
            } catch (e) {}
        }
        activeCell = cell;
        try {
            const cellEl = cell.getElement();
            cellEl.classList.add('active-cell');
            if (fillHandleEl.parentNode !== cellEl) {
                cellEl.appendChild(fillHandleEl);
            }
        } catch (e) {}
    }

    // --- Fill Handle 滑鼠拖拉互動 ---
    let isDraggingFill = false;
    let dragStartRowIdx = -1;
    let dragCurrentRowIdx = -1;
    let dragField = '';
    let dragBaseValue = '';
    let dragRows = [];

    fillHandleEl.addEventListener('mousedown', function (e) {
        if (!activeCell || !tabulatorTable) return;
        e.stopPropagation();
        e.preventDefault();

        isDraggingFill = true;
        dragRows = tabulatorTable.getRows();
        const startRow = activeCell.getRow();
        dragStartRowIdx = dragRows.indexOf(startRow);
        dragCurrentRowIdx = dragStartRowIdx;
        dragField = activeCell.getField();
        dragBaseValue = activeCell.getValue() !== undefined && activeCell.getValue() !== null ? String(activeCell.getValue()) : '';

        document.addEventListener('mousemove', onDragMouseMove);
        document.addEventListener('mouseup', onDragMouseUp);
    });

    function onDragMouseMove(e) {
        if (!isDraggingFill) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        const rowEl = el.closest('.tabulator-row');
        if (!rowEl) return;

        const targetRow = tabulatorTable.getRow(rowEl);
        if (!targetRow) return;
        const targetIdx = dragRows.indexOf(targetRow);
        if (targetIdx === -1) return;

        const newHoverIdx = Math.max(dragStartRowIdx, targetIdx);
        if (newHoverIdx !== dragCurrentRowIdx) {
            dragCurrentRowIdx = newHoverIdx;
            updateDragHighlight();
        }
    }

    function updateDragHighlight() {
        document.querySelectorAll('.fill-target-highlight, .fill-target-bottom').forEach(el => {
            el.classList.remove('fill-target-highlight', 'fill-target-bottom');
        });

        for (let i = dragStartRowIdx; i <= dragCurrentRowIdx; i++) {
            const r = dragRows[i];
            if (r) {
                const c = r.getCell(dragField);
                if (c) {
                    const el = c.getElement();
                    el.classList.add('fill-target-highlight');
                    if (i === dragCurrentRowIdx) {
                        el.classList.add('fill-target-bottom');
                    }
                }
            }
        }
    }

    function onDragMouseUp(e) {
        if (!isDraggingFill) return;
        isDraggingFill = false;
        document.removeEventListener('mousemove', onDragMouseMove);
        document.removeEventListener('mouseup', onDragMouseUp);

        document.querySelectorAll('.fill-target-highlight, .fill-target-bottom').forEach(el => {
            el.classList.remove('fill-target-highlight', 'fill-target-bottom');
        });

        if (dragCurrentRowIdx > dragStartRowIdx) {
            const isHoldingCtrl = e.ctrlKey || e.metaKey;
            const numMatch = dragBaseValue.match(/^(.*?)(\d+)$/);
            const prefix = numMatch ? numMatch[1] : '';
            const baseNum = numMatch ? parseInt(numMatch[2], 10) : 0;
            const numLen = numMatch ? numMatch[2].length : 0;

            const shouldIncrement = numMatch && !isHoldingCtrl;

            for (let i = dragStartRowIdx + 1; i <= dragCurrentRowIdx; i++) {
                const r = dragRows[i];
                let newVal = dragBaseValue;
                if (shouldIncrement) {
                    const offset = i - dragStartRowIdx;
                    const nextNum = baseNum + offset;
                    newVal = prefix + String(nextNum).padStart(numLen, '0');
                }
                r.update({ [dragField]: newVal });
            }
            syncToTextarea();

            const lastRow = dragRows[dragCurrentRowIdx];
            if (lastRow) {
                const lastCell = lastRow.getCell(dragField);
                if (lastCell) attachFillHandle(lastCell);
            }
        }
    }

    // --- 一鍵向下填滿直欄 (快捷右鍵選單) ---
    function fillDownColumn(cell, isIncrement) {
        if (!tabulatorTable || !cell) return;
        const currentVal = cell.getValue() !== undefined && cell.getValue() !== null ? String(cell.getValue()) : '';
        const field = cell.getField();
        const startRow = cell.getRow();
        const allRows = tabulatorTable.getRows();
        const startIdx = allRows.indexOf(startRow);
        if (startIdx === -1 || startIdx >= allRows.length - 1) return;

        let numMatch = null;
        let prefix = '';
        let baseNum = 0;
        let numLen = 0;
        if (isIncrement) {
            numMatch = currentVal.match(/^(.*?)(\d+)$/);
            if (numMatch) {
                prefix = numMatch[1];
                baseNum = parseInt(numMatch[2], 10);
                numLen = numMatch[2].length;
            }
        }

        for (let i = startIdx + 1; i < allRows.length; i++) {
            const row = allRows[i];
            let newVal = currentVal;
            if (isIncrement && numMatch) {
                const offset = i - startIdx;
                const nextNum = baseNum + offset;
                newVal = prefix + String(nextNum).padStart(numLen, '0');
            }
            row.update({ [field]: newVal });
        }
        syncToTextarea();
        const lastRow = allRows[allRows.length - 1];
        if (lastRow) {
            const lastCell = lastRow.getCell(field);
            if (lastCell) attachFillHandle(lastCell);
        }
    }

    // --- 建立符合 Excel 規範之欄位定義 ---
    function createColumnDef(title, field) {
        return {
            title: String(title),
            field: field,
            headerSort: true,
            headerFilter: "input",
            headerFilterPlaceholder: "🔍 篩選...",
            headerFilterLiveFilter: true,
            editor: "input",
            editableTitle: true,
            resizable: true,
            headerContextMenu: [
                {
                    label: "🗑️ 刪除此欄",
                    action: function (e, column) {
                        const def = column.getDefinition();
                        const colTitle = def.title || '此欄';
                        if (confirm(`確定要刪除「${colTitle}」欄位嗎？`)) {
                            column.delete();
                            syncToTextarea();
                        }
                    }
                }
            ],
            cellContextMenu: [
                {
                    label: "⬇️ 向下填滿相同內容 (至最後一列)",
                    action: function (e, cell) {
                        fillDownColumn(cell, false);
                    }
                },
                {
                    label: "🔢 向下自動遞增填滿 (+1, +2...)",
                    action: function (e, cell) {
                        fillDownColumn(cell, true);
                    }
                },
                {
                    label: "🗑️ 清空此儲存格",
                    action: function (e, cell) {
                        cell.setValue('');
                        syncToTextarea();
                    }
                }
            ]
        };
    }

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
        const columns = headers.map((h, idx) => createColumnDef(h || `欄位 ${idx + 1}`, `col_${idx}`));

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
            cellClick: function (e, cell) {
                attachFillHandle(cell);
            },
            cellEdited: function (cell) {
                syncToTextarea();
                attachFillHandle(cell);
            },
            columnTitleChanged: function () {
                syncToTextarea();
            },
            rowContextMenu: [
                {
                    label: "➕ 在下方插入新列",
                    action: function (e, row) {
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
                    action: function (e, row) {
                        row.delete();
                        syncToTextarea();
                    }
                }
            ]
        });

        ui.gridContainer.classList.toggle('filter-hidden', !isFilterVisible);
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

        const newCsv = [headerRow, ...dataRows].join('\n');
        ui.rawTextarea.value = newCsv;

        if (newCsv.trim() !== '' && newCsv.trim() !== BLANK_TEMPLATE.trim()) {
            isDirty = true;
            localStorage.setItem(DRAFT_KEY, newCsv);
        } else {
            isDirty = false;
            localStorage.removeItem(DRAFT_KEY);
        }
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
        const colDef = createColumnDef(title.trim() || defaultTitle, newField);
        tabulatorTable.addColumn(colDef, false).then(() => {
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
        isDirty = false;
        localStorage.removeItem(DRAFT_KEY);
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

            isDirty = false;
            localStorage.removeItem(DRAFT_KEY);

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

    // --- 標題篩選切換 ---
    function toggleHeaderFilter(visible) {
        if (visible === undefined) visible = !isFilterVisible;
        isFilterVisible = visible;
        ui.gridContainer.classList.toggle('filter-hidden', !isFilterVisible);
        if (ui.btnToggleFilter) {
            ui.btnToggleFilter.classList.toggle('active', isFilterVisible);
            ui.btnToggleFilter.title = isFilterVisible ? "隱藏標題篩選列" : "顯示標題篩選列";
        }
        if (!isFilterVisible && tabulatorTable) {
            tabulatorTable.clearHeaderFilter();
        }
    }

    // --- 事件監聽 ---
    ui.btnNew.addEventListener('click', createNew);
    if (ui.btnLoadTemplate) ui.btnLoadTemplate.addEventListener('click', loadTemplate);
    ui.btnOpen.addEventListener('click', openFile);
    ui.btnSave.addEventListener('click', saveFile);
    ui.btnAddRow.addEventListener('click', addRow);
    ui.btnAddCol.addEventListener('click', addCol);
    if (ui.btnToggleFilter) ui.btnToggleFilter.addEventListener('click', () => toggleHeaderFilter());
    ui.btnToggleRaw.addEventListener('click', toggleRawView);

    // 原始碼文字框輸入時自動更新草稿
    ui.rawTextarea.addEventListener('input', () => {
        const val = ui.rawTextarea.value;
        if (val.trim() !== '' && val.trim() !== BLANK_TEMPLATE.trim()) {
            isDirty = true;
            localStorage.setItem(DRAFT_KEY, val);
        } else {
            isDirty = false;
            localStorage.removeItem(DRAFT_KEY);
        }
    });

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

    // --- 離開頁面防呆警告與外部點擊取消選取 ---
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('click', (e) => {
        // 若點擊表格外部，取消儲存格選取與移除把手
        if (!e.target.closest('#grid-container') && !e.target.closest('.tabulator-menu')) {
            if (activeCell) {
                try {
                    activeCell.getElement().classList.remove('active-cell');
                } catch (err) {}
                activeCell = null;
                if (fillHandleEl.parentNode) {
                    fillHandleEl.parentNode.removeChild(fillHandleEl);
                }
            }
        }

        const link = e.target.closest('a[href]');
        if (link && isDirty) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                if (!confirm('⚠️ 您有尚未儲存的試算表修改！確定要離開此頁面嗎？\n（未儲存的內容已暫存為草稿，但尚未寫入實體檔案）')) {
                    e.preventDefault();
                }
            }
        }
    });

    // --- 初始化：檢查並還原草稿 ---
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft && savedDraft.trim() !== '' && savedDraft.trim() !== BLANK_TEMPLATE.trim()) {
        renderCsvToTabulator(savedDraft);
        ui.fileNameDisplay.textContent = '⚡ 未命名試算表.csv (已自動還原草稿)';
        isDirty = true;
    } else {
        createNew();
    }
})();
