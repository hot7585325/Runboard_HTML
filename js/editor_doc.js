/**
 * Runboard - Office 文件檢視器專屬邏輯 (editor_doc.js)
 * 獨立模組：負責 Word (.docx) A4 擬真紙張與 Excel (.xlsx) 凍結表頭試算表唯讀檢視與搜尋
 */
(function () {
    let currentExt = '';
    let tabulatorTable = null;
    let rawTextLines = [];

    const ui = {
        emptyContainer: document.getElementById('empty-container'),
        wordContainer: document.getElementById('word-container'),
        wordPaper: document.getElementById('word-paper'),
        excelContainer: document.getElementById('excel-container'),
        excelGridContainer: document.getElementById('excel-grid-container'),
        fileNameDisplay: document.getElementById('file-name-display'),
        btnOpen: document.getElementById('btn-open'),
        btnOpenHero: document.getElementById('btn-open-hero'),
        btnOpenSearch: document.getElementById('btn-open-search'),
        btnCloseSearch: document.getElementById('btn-close-search'),
        searchDrawer: document.getElementById('search-drawer'),
        searchInput: document.getElementById('search-input'),
        filterStats: document.getElementById('filter-stats'),
        filterResults: document.getElementById('filter-results')
    };

    async function openFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Office 文件 (Word / Excel)',
                    accept: {
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                    }
                }]
            });
            if (handle) {
                const file = await handle.getFile();
                ui.fileNameDisplay.textContent = file.name;
                currentExt = file.name.split('.').pop().toLowerCase();
                await routeDoc(file);
            }
        } catch (e) {
            if (e.name !== 'AbortError') console.error('開啟文件失敗:', e);
        }
    }

    async function routeDoc(file) {
        ui.emptyContainer.style.display = 'none';
        ui.wordContainer.style.display = 'none';
        ui.excelContainer.style.display = 'none';
        ui.searchInput.value = '';
        ui.filterResults.innerHTML = '';
        ui.filterStats.textContent = '分析中...';
        rawTextLines = [];

        if (tabulatorTable) {
            tabulatorTable.destroy();
            tabulatorTable = null;
        }

        const arrayBuffer = await file.arrayBuffer();

        if (currentExt === 'docx') {
            ui.wordContainer.style.display = 'flex';
            try {
                const resultHtml = await mammoth.convertToHtml({ arrayBuffer });
                ui.wordPaper.innerHTML = resultHtml.value || '<p style="color:#888;">(空白文件)</p>';

                const resultText = await mammoth.extractRawText({ arrayBuffer });
                rawTextLines = resultText.value.split('\n');
                runFilter('');
            } catch (err) {
                console.error('Word 解析錯誤:', err);
                ui.wordPaper.innerHTML = '<p style="color:red">Word 文件解析失敗</p>';
            }
        } else if (currentExt === 'xlsx') {
            ui.excelContainer.style.display = 'block';
            try {
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (jsonData.length === 0) {
                    ui.excelGridContainer.innerHTML = '<div style="padding:20px; color:#888;">試算表為空</div>';
                    return;
                }

                renderExcelTabulator(jsonData);
                runFilter('');
            } catch (err) {
                console.error('Excel 解析錯誤:', err);
                ui.excelGridContainer.innerHTML = '<div style="padding:20px; color:red">Excel 試算表解析失敗</div>';
            }
        }
    }

    function renderExcelTabulator(matrix) {
        const headers = matrix[0] || [];
        const columns = headers.map((h, idx) => ({
            title: String(h || `欄位 ${idx + 1}`),
            field: `col_${idx}`,
            headerSort: true,
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

        tabulatorTable = new Tabulator(ui.excelGridContainer, {
            data: tableData,
            columns: columns,
            layout: "fitDataFill",
            maxHeight: "100%",
            placeholder: "無資料"
        });
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

        // Excel 表格過濾
        if (tabulatorTable && currentExt === 'xlsx') {
            if (!query) {
                tabulatorTable.clearFilter();
                const total = tabulatorTable.getData().length;
                ui.filterStats.textContent = `顯示全部 (共 ${total} 列)`;
            } else {
                tabulatorTable.setFilter(function (data) {
                    const q = query.toLowerCase();
                    return Object.values(data).some(val => String(val).toLowerCase().includes(q));
                });
                const count = tabulatorTable.getData("active").length;
                ui.filterStats.textContent = `符合 ${count} 列資料`;
            }
            return;
        }

        // Word 純文字段落過濾
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

                div.innerHTML = `<span class="result-line-num">P${i + 1}</span>${displayHtml}`;
                fragment.appendChild(div);
            }
        }

        ui.filterResults.appendChild(fragment);
        ui.filterStats.textContent = query ? `找到 ${matchCount} 筆結果` : `顯示全部 (共 ${matchCount} 段)`;
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') str = String(str);
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag]));
    }

    ui.btnOpen.addEventListener('click', openFile);
    if (ui.btnOpenHero) ui.btnOpenHero.addEventListener('click', openFile);

    ui.btnOpenSearch.addEventListener('click', () => toggleSearchDrawer(true));
    ui.btnCloseSearch.addEventListener('click', () => toggleSearchDrawer(false));
    ui.searchInput.addEventListener('input', (e) => runFilter(e.target.value));

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleSearchDrawer(true);
        } else if (e.key === 'Escape' && ui.searchDrawer.classList.contains('open')) {
            toggleSearchDrawer(false);
        }
    });
})();
