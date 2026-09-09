/**
 * Runboard - 任務清單 (Tasks) 專屬邏輯
 */
const TasksApp = (function () {
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;

    function getTasks() {
        const data = Storage.getData();
        if (!data.tasks) data.tasks = [];
        return data.tasks;
    }

    function render() {
        const listContainer = document.getElementById('tasks-list');
        if (!listContainer) return;

        const categories = getTasks();
        let html = '';

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            html += `
            <div class="category" ondragover="TasksApp.handleDragOver(event)" ondragleave="TasksApp.handleDragLeave(event)" ondrop="TasksApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="TasksApp.handleCategoryDragStart(event, ${catIdx})" ondragend="TasksApp.handleCategoryDragEnd(event)" onclick="TasksApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">${cat.category}</div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="TasksApp.openAddTask(${catIdx})">＋新增任務</button>
                        <button class="btn btn-small" onclick="TasksApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="TasksApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="task-list ${isCollapsed}">
            `;

            if (cat.items) {
                cat.items.forEach((task, taskIdx) => {
                    const status = task.status || 'not_started';
                    const statusStr = status === 'done' ? '完成' : status === 'in_progress' ? '進行中' : '未開始';
                    const doneClass = status === 'done' ? 'status-done' : '';

                    html += `
                    <div class="task-item" draggable="true" ondragstart="TasksApp.handleDragStart(event, ${catIdx}, ${taskIdx})" ondragend="TasksApp.handleDragEnd(event)">
                        <div class="status-badge status-${status}" onclick="TasksApp.toggleTaskStatus(${catIdx}, ${taskIdx})">${statusStr}</div>
                        <div class="task-text ${doneClass}">${task.text || ''}</div>
                        <div class="task-actions">
                            <button class="btn btn-small" onclick="TasksApp.openEditTask(${catIdx}, ${taskIdx})">✏️</button>
                            <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="TasksApp.deleteTask(${catIdx}, ${taskIdx})">🗑️</button>
                        </div>
                    </div>
                    `;
                });
            }

            html += `</div></div>`;
        });

        listContainer.innerHTML = html;
    }

    // 切換任務狀態: not_started -> in_progress -> done -> not_started
    async function toggleTaskStatus(catIdx, taskIdx) {
        const task = getTasks()[catIdx]?.items[taskIdx];
        if (!task) return;

        if (task.status === 'not_started') task.status = 'in_progress';
        else if (task.status === 'in_progress') task.status = 'done';
        else task.status = 'not_started';

        await Storage.save();
        render();
    }

    // 收合分類
    async function toggleCategory(catIdx) {
        const cat = getTasks()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
    }

    // 拖曳處理
    function handleDragStart(event, catIdx, itemIdx) {
        event.stopPropagation();
        draggedItemInfo = { catIdx, itemIdx };
        draggedCategoryInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-task');
        setTimeout(() => {
            event.target.classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragStart(event, catIdx) {
        event.stopPropagation();
        draggedCategoryInfo = { catIdx };
        draggedItemInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-category');
        setTimeout(() => {
            event.target.closest('.category').classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragEnd(event) {
        event.target.closest('.category')?.classList.remove('dragging');
        draggedCategoryInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedItemInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(event) {
        const catEl = event.currentTarget;
        if (!catEl.contains(event.relatedTarget)) {
            catEl.classList.remove('drag-over');
        }
    }

    async function handleDrop(event, targetCatIdx) {
        event.preventDefault();
        event.stopPropagation();
        const catEl = event.currentTarget;
        catEl.classList.remove('drag-over');

        const categories = getTasks();

        if (draggedItemInfo) {
            const sourceCatIdx = draggedItemInfo.catIdx;
            const sourceItemIdx = draggedItemInfo.itemIdx;

            if (sourceCatIdx === targetCatIdx) return;

            const sourceList = categories[sourceCatIdx].items;
            const targetList = categories[targetCatIdx].items;

            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.push(movedItem);

            await Storage.save();
            render();
        } else if (draggedCategoryInfo) {
            const sourceCatIdx = draggedCategoryInfo.catIdx;
            if (sourceCatIdx === targetCatIdx) return;

            const [movedCat] = categories.splice(sourceCatIdx, 1);
            categories.splice(targetCatIdx, 0, movedCat);

            await Storage.save();
            render();
        }
    }

    // Modal 與 CRUD
    function openAddCategory() {
        Modal.open({
            title: '新增任務分類',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" placeholder="例如: 🚀 待辦衝刺"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                getTasks().push({ category: val, items: [], collapsed: false });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditCategory(catIdx) {
        const cat = getTasks()[catIdx];
        Modal.open({
            title: '編輯分類名稱',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" value="${cat.category}"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                cat.category = val;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteCategory(catIdx) {
        if (!confirm('確定要刪除此分類及所有任務嗎？')) return;
        getTasks().splice(catIdx, 1);
        await Storage.save();
        render();
    }

    function openAddTask(catIdx) {
        Modal.open({
            title: '新增任務',
            html: `<div class="form-group"><label>任務內容</label><input type="text" id="ipt-task" placeholder="輸入任務內容..."></div>`,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('內容為必填');
                    return false;
                }
                const cat = getTasks()[catIdx];
                if (!cat.items) cat.items = [];
                cat.items.push({ text, status: 'not_started' });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditTask(catIdx, taskIdx) {
        const task = getTasks()[catIdx].items[taskIdx];
        Modal.open({
            title: '編輯任務',
            html: `<div class="form-group"><label>任務內容</label><input type="text" id="ipt-task" value="${task.text || ''}"></div>`,
            onConfirm: async () => {
                const text = document.getElementById('ipt-task').value.trim();
                if (!text) {
                    alert('內容為必填');
                    return false;
                }
                task.text = text;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteTask(catIdx, taskIdx) {
        if (!confirm('確定要刪除此任務嗎？')) return;
        getTasks()[catIdx].items.splice(taskIdx, 1);
        await Storage.save();
        render();
    }

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        toggleTaskStatus,
        toggleCategory,
        handleDragStart,
        handleCategoryDragStart,
        handleCategoryDragEnd,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        openAddCategory,
        openEditCategory,
        deleteCategory,
        openAddTask,
        openEditTask,
        deleteTask
    };
})();

window.TasksApp = TasksApp;
