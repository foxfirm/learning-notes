/**
 * SimpleTree - 纯树插件版（不含工具栏）
 */
(function ($) {
    'use strict';

    const defaults = {
        data: [],
        defaultCollapsed: true,
        treeType: 'right',
        icons: {
            folder: '📁',
            folderOpen: '📂',
            file: '📄',
            default: '•'
        },
        onCopy: null,
        onMove: null,
        onDragStart: null,
        onDragEnd: null,
        onAddNode: null,
        onDeleteNode: null,
        emptyText: '暂无数据，从左侧拖拽节点到这里',
        allowDropToEmpty: true,
        duplicateCheck: true,
        keepIdOnCopy: true
    };

    let dragState = {
        sourceNode: null,
        sourceTree: null,
        sourceTreeType: null,
        sourceId: null,
        clone: null,
        targetNode: null,
        targetPosition: null,
        targetTree: null,
        isDragging: false,
        isValidDrop: false
    };

    // 存储所有实例的配置和状态
    const instances = new Map();

    // ========== 工具函数 ==========

    function findNode(tree, id) {
        if (!tree) return null;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == id) return { node, parent: null, index: i, children: tree };
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) {
                    found.parent = node;
                    return found;
                }
            }
        }
        return null;
    }

    function findParentId(tree, nodeId, parentId = null) {
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == nodeId) {
                return parentId;
            }
            if (node.children) {
                const found = findParentId(node.children, nodeId, node.id);
                if (found !== undefined) return found;
            }
        }
        return null;
    }

    function isNodeNameExists(tree, name, excludeId = null) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.text === name && node.id !== excludeId) {
                return true;
            }
            if (node.children && isNodeNameExists(node.children, name, excludeId)) {
                return true;
            }
        }
        return false;
    }

    function isValidDropTarget(sourceNode, sourceType, targetType, targetNodeId, targetTreeData) {
        if (sourceType === 'left' && targetType === 'right') {
            return !isNodeNameExists(targetTreeData, sourceNode.text);
        }
        else if (sourceType === 'right' && targetType === 'right') {
            if (sourceNode.id == targetNodeId) return false;
            if (isDescendantOfNode(sourceNode, targetNodeId)) return false;
            return true;
        }
        return false;
    }

    function removeNode(tree, id) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == id) {
                tree.splice(i, 1);
                return true;
            }
            if (tree[i].children && removeNode(tree[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    function insertNode(tree, targetId, newNode, position) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == targetId) {
                if (position === 'inside') {
                    if (!node.children) node.children = [];
                    node.children.push(newNode);
                } else if (position === 'before') {
                    tree.splice(i, 0, newNode);
                } else if (position === 'after') {
                    tree.splice(i + 1, 0, newNode);
                }
                return true;
            }
            if (node.children && insertNode(node.children, targetId, newNode, position)) {
                return true;
            }
        }
        return false;
    }

    function cloneNode(node, keepId = false) {
        const cloned = JSON.parse(JSON.stringify(node));
        if (!keepId) {
            cloned.id = generateId();
        }
        return cloned;
    }

    function isDescendantOfNode(parentNode, childId) {
        if (!parentNode || !parentNode.children) return false;
        for (let child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendantOfNode(child, childId)) return true;
        }
        return false;
    }

    function collectCollapsedState($container) {
        const state = {};
        if (!$container) return state;
        $container.find('li').each(function () {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;

            const $children = $li.children('.node-children');
            if ($children.length && $children.is(':visible') === false) {
                state[nodeId] = true;
            } else if ($children.length) {
                state[nodeId] = false;
            }
        });
        return state;
    }

    function restoreCollapsedState($container, state) {
        if (!$container) return;
        $container.find('li').each(function () {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;

            const $children = $li.children('.node-children');
            const $icon = $li.find('.toggle-icon');

            if ($children.length && state.hasOwnProperty(nodeId)) {
                if (state[nodeId] === true) {
                    $children.hide();
                    $icon.text('▶');
                } else {
                    $children.show();
                    $icon.text('▼');
                }
            }
        });
    }

    function getDropPosition(e, targetEl) {
        if (!targetEl) return 'root';
        const rect = targetEl.getBoundingClientRect();
        const y = e.clientY;
        const height = rect.height;
        const ratio = (y - rect.top) / height;
        if (ratio < 0.33) return 'before';
        if (ratio > 0.66) return 'after';
        return 'inside';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function generateId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    function getNodeIcon(node, isCollapsed, icons) {
        const hasChildren = node.children && node.children.length > 0;
        if (hasChildren) {
            if (!isCollapsed && icons.folderOpen) {
                return icons.folderOpen;
            }
            return icons.folder;
        }
        return node.icon || icons.file || icons.default || '•';
    }

    // ========== 将树转换为带 pId 的数组 ==========

    function treeToArray(nodes, parentId = null, result = []) {
        if (!nodes) return result;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const item = {
                id: node.id,
                text: node.text,
                pId: parentId
            };
            if (node.icon) item.icon = node.icon;
            if (node.type) item.type = node.type;

            result.push(item);

            if (node.children && node.children.length > 0) {
                treeToArray(node.children, node.id, result);
            }
        }

        return result;
    }

    function treeToJson($container, pretty = false) {
        const treeData = $container.data('treeData');
        const flatArray = treeToArray(treeData);
        return pretty ? JSON.stringify(flatArray, null, 2) : JSON.stringify(flatArray);
    }

    // ========== 渲染函数 ==========

    function renderTree($container, data, options, preserveState = true) {
        const icons = options.icons;
        const isEmpty = !data || data.length === 0;
        const instance = instances.get($container[0]);

        let collapsedState = {};
        if (preserveState && !isEmpty && instance) {
            collapsedState = instance.collapsedState || {};
            if (Object.keys(collapsedState).length === 0) {
                collapsedState = collectCollapsedState($container);
            }
        }

        function buildHtml(nodes) {
            let html = '<ul>';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const hasChildren = node.children && node.children.length > 0;
                let isCollapsed = options.defaultCollapsed;
                if (preserveState && collapsedState.hasOwnProperty(node.id)) {
                    isCollapsed = collapsedState[node.id];
                }
                const collapsedStyle = (hasChildren && isCollapsed) ? 'display: none;' : '';

                const icon = getNodeIcon(node, isCollapsed, icons);
                const nodeTypeClass = hasChildren ? 'folder' : 'leaf';
                const isSelected = (instance && instance.selectedNodeId === node.id);
                const selectedClass = isSelected ? 'selected' : '';

                html += `<li data-id="${node.id}">`;
                html += `<div class="tree-node ${nodeTypeClass} ${selectedClass}" data-id="${node.id}">`;
                html += `<span class="toggle-icon ${hasChildren ? '' : 'empty'}" data-id="${node.id}">${hasChildren ? (isCollapsed ? '▶' : '▼') : ''}</span>`;
                html += `<span class="node-icon">${escapeHtml(icon)}</span>`;
                html += `<span class="node-content">${escapeHtml(node.text)}</span>`;
                html += `</div>`;
                if (hasChildren) {
                    html += `<div class="node-children" data-parent="${node.id}" style="${collapsedStyle}">${buildHtml(node.children)}</div>`;
                }
                html += `</li>`;
            }
            html += '</ul>';
            return html;
        }

        if (isEmpty && options.allowDropToEmpty && options.treeType === 'right') {
            $container.html(`
                <div class="simple-tree-empty" data-empty-area="true">
                    <div class="empty-placeholder">${escapeHtml(options.emptyText)}</div>
                </div>
            `);
            bindEmptyTreeEvents($container, options);
        } else if (isEmpty) {
            $container.html('<div class="tree-node">无数据</div>');
        } else {
            $container.html(buildHtml(data));
            if (preserveState && Object.keys(collapsedState).length > 0) {
                restoreCollapsedState($container, collapsedState);
            }
            bindEvents($container, options);
        }

        if (instance) {
            instance.collapsedState = collectCollapsedState($container);
        }
    }

    // ========== 公共方法 ==========

    function searchNodes($container, keyword) {
        const instance = instances.get($container[0]);
        if (!instance) return false;

        const options = instance.options;
        const treeData = $container.data('treeData');

        if (!keyword || keyword.trim() === '') {
            clearHighlights($container);
            instance.currentSearchKeyword = '';
            return false;
        }

        const lowerKeyword = keyword.toLowerCase();
        let hasMatch = false;
        const matchedIds = [];

        function collectMatches(nodes, parentPath) {
            if (!nodes) return;
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.text && node.text.toLowerCase().includes(lowerKeyword)) {
                    matchedIds.push(node.id);
                    hasMatch = true;
                    for (let j = 0; j < parentPath.length; j++) {
                        const pathNode = parentPath[j];
                        if (pathNode && pathNode.id) {
                            matchedIds.push(pathNode.id);
                        }
                    }
                }
                if (node.children) {
                    collectMatches(node.children, [...parentPath, node]);
                }
            }
        }

        collectMatches(treeData, []);

        matchedIds.forEach(id => {
            const $li = $container.find(`li[data-id="${id}"]`);
            if ($li.length) {
                const $children = $li.children('.node-children');
                const $icon = $li.find('.toggle-icon');
                if ($children.length && $children.is(':visible') === false) {
                    $children.show();
                    $icon.text('▼');
                    if (instance.collapsedState) {
                        instance.collapsedState[id] = false;
                    }
                }
            }
        });

        clearHighlights($container);
        $container.find('.tree-node').each(function () {
            const $node = $(this);
            const nodeId = $node.data('id');
            const nodeInfo = findNode(treeData, nodeId);
            if (nodeInfo && nodeInfo.node.text && nodeInfo.node.text.toLowerCase().includes(lowerKeyword)) {
                $node.addClass('highlight');
            }
        });

        instance.currentSearchKeyword = keyword;
        return hasMatch;
    }

    function clearHighlights($container) {
        $container.find('.tree-node').removeClass('highlight');
    }

    function clearSearch($container) {
        const instance = instances.get($container[0]);
        if (instance) {
            instance.currentSearchKeyword = '';
            clearHighlights($container);
        }
    }

    function addNode($container, nodeName, targetNodeId = null) {
        const instance = instances.get($container[0]);
        if (!instance) return null;

        const options = instance.options;
        const treeData = $container.data('treeData');

        if (!nodeName || nodeName.trim() === '') {
            console.warn('节点名称不能为空');
            return null;
        }

        if (options.duplicateCheck && isNodeNameExists(treeData, nodeName.trim())) {
            alert('节点 "' + nodeName.trim() + '" 已存在');
            return null;
        }

        const newNode = {
            id: generateId(),
            text: nodeName.trim(),
            children: []
        };

        let success = false;

        if (targetNodeId) {
            success = insertNode(treeData, targetNodeId, newNode, 'inside');
            if (success) {
                const $parentLi = $container.find(`li[data-id="${targetNodeId}"]`);
                if ($parentLi.length) {
                    const $children = $parentLi.children('.node-children');
                    const $icon = $parentLi.find('.toggle-icon');
                    if ($children.length && $children.is(':visible') === false) {
                        $children.show();
                        $icon.text('▼');
                        if (instance.collapsedState) {
                            instance.collapsedState[targetNodeId] = false;
                        }
                    }
                }
            }
        } else {
            treeData.push(newNode);
            success = true;
        }

        if (success) {
            $container.data('treeData', treeData);
            renderTree($container, treeData, options, true);

            if (options.onAddNode) {
                options.onAddNode(newNode, targetNodeId || null);
            }
            return newNode;
        }

        return null;
    }

    function deleteNode($container, nodeId) {
        const instance = instances.get($container[0]);
        if (!instance) return false;

        const options = instance.options;
        const treeData = $container.data('treeData');

        const nodeInfo = findNode(treeData, nodeId);
        if (!nodeInfo) return false;

        if (confirm(`确定要删除节点 "${nodeInfo.node.text}" 吗？`)) {
            removeNode(treeData, nodeId);
            $container.data('treeData', treeData);

            if (instance.selectedNodeId === nodeId) {
                instance.selectedNodeId = null;
            }

            renderTree($container, treeData, options, true);

            if (options.onDeleteNode) {
                options.onDeleteNode(nodeInfo.node);
            }
            return true;
        }

        return false;
    }

    function deleteSelectedNode($container) {
        const instance = instances.get($container[0]);
        if (!instance || !instance.selectedNodeId) {
            alert('请先点击选中要删除的节点');
            return false;
        }

        return deleteNode($container, instance.selectedNodeId);
    }

    function getSelectedNode($container) {
        const instance = instances.get($container[0]);
        if (!instance || !instance.selectedNodeId) return null;

        const treeData = $container.data('treeData');
        const nodeInfo = findNode(treeData, instance.selectedNodeId);
        return nodeInfo ? nodeInfo.node : null;
    }

    function setSelectedNode($container, nodeId) {
        const instance = instances.get($container[0]);
        if (!instance) return;

        instance.selectedNodeId = nodeId;
        renderTree($container, $container.data('treeData'), instance.options, true);
    }

    function getTreeData($container) {
        return $container.data('treeData');
    }

    function setTreeData($container, newData, preserveState = true) {
        const instance = instances.get($container[0]);
        if (!instance) return;

        $container.data('treeData', newData);
        renderTree($container, newData, instance.options, preserveState);
    }

    function expandAll($container) {
        $container.find('.node-children').each(function () {
            const $children = $(this);
            const $icon = $children.closest('li').find('.toggle-icon');
            if ($children.length && $children.is(':visible') === false) {
                $children.show();
                $icon.text('▼');
            }
        });

        const instance = instances.get($container[0]);
        if (instance && instance.collapsedState) {
            $container.find('li').each(function () {
                const nodeId = $(this).find('.tree-node').data('id');
                if (nodeId) instance.collapsedState[nodeId] = false;
            });
        }
    }

    function collapseAll($container) {
        $container.find('.node-children').each(function () {
            const $children = $(this);
            const $icon = $children.closest('li').find('.toggle-icon');
            if ($children.length && $children.is(':visible')) {
                $children.hide();
                $icon.text('▶');
            }
        });

        const instance = instances.get($container[0]);
        if (instance && instance.collapsedState) {
            $container.find('li').each(function () {
                const nodeId = $(this).find('.tree-node').data('id');
                if (nodeId) instance.collapsedState[nodeId] = true;
            });
        }
    }

    function refreshTree($container) {
        const instance = instances.get($container[0]);
        if (!instance) return;

        const treeData = $container.data('treeData');
        renderTree($container, treeData, instance.options, true);
    }

    // ========== 拖拽放置提示 ==========

    function updateCloneStatus(isValid) {
        if (dragState.clone) {
            if (isValid) {
                dragState.clone.removeClass('invalid').addClass('valid');
                const statusIcon = dragState.clone.find('.clone-status');
                if (statusIcon.length) {
                    statusIcon.text('✅');
                } else {
                    dragState.clone.prepend('<span class="clone-status">✅</span>');
                }
            } else {
                dragState.clone.removeClass('valid').addClass('invalid');
                const statusIcon = dragState.clone.find('.clone-status');
                if (statusIcon.length) {
                    statusIcon.text('❌');
                } else {
                    dragState.clone.prepend('<span class="clone-status">❌</span>');
                }
            }
        }
    }

    // ========== 空树事件 ==========

    function bindEmptyTreeEvents($container, options) {
        const $emptyArea = $container.find('.simple-tree-empty');

        $emptyArea.off('dragover dragleave drop');

        $emptyArea.on('dragover', function (e) {
            e.preventDefault();
            if (dragState.sourceNode && dragState.sourceTreeType === 'left' && options.treeType === 'right') {
                $(this).addClass('drag-over-empty');
                updateCloneStatus(true);
                dragState.isValidDrop = true;
                dragState.targetPosition = 'root';
                dragState.targetTree = $container;
            }
        });

        $emptyArea.on('dragleave', function (e) {
            $(this).removeClass('drag-over-empty');
            updateCloneStatus(false);
            dragState.isValidDrop = false;
        });

        $emptyArea.on('drop', function (e) {
            e.preventDefault();
            $(this).removeClass('drag-over-empty');
            if (dragState.sourceNode && dragState.sourceTreeType === 'left' && options.treeType === 'right' && dragState.isValidDrop) {
                performDropToEmpty(dragState.sourceTree, $container);
            }
        });

        bindEmptyTreeDragEvents($container, options);
    }

    function bindEmptyTreeDragEvents($container, options) {
        let emptyHighlightActive = false;

        $(document).on('mousemove.simpleTreeEmpty', function (e) {
            if (!dragState.isDragging) return;

            const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
            let isEmptyArea = false;
            for (let i = 0; i < elemUnderCursor.length; i++) {
                if ($(elemUnderCursor[i]).hasClass('simple-tree-empty') ||
                    $(elemUnderCursor[i]).closest('.simple-tree-empty').length) {
                    isEmptyArea = true;
                    break;
                }
            }

            const $emptyDiv = $container.find('.simple-tree-empty');
            if (isEmptyArea && !emptyHighlightActive && dragState.sourceTreeType === 'left' && options.treeType === 'right') {
                $emptyDiv.addClass('drag-over-empty');
                emptyHighlightActive = true;
                updateCloneStatus(true);
                dragState.isValidDrop = true;
                dragState.targetPosition = 'root';
                dragState.targetTree = $container;
            } else if (!isEmptyArea && emptyHighlightActive) {
                $emptyDiv.removeClass('drag-over-empty');
                emptyHighlightActive = false;
                updateCloneStatus(false);
                dragState.isValidDrop = false;
                dragState.targetPosition = null;
            }
        });

        $(document).off('mouseup.simpleTreeEmpty');
        $(document).on('mouseup.simpleTreeEmpty', function () {
            $container.find('.simple-tree-empty').removeClass('drag-over-empty');
        });
    }

    function performDropToEmpty(sourceTree, targetTree) {
        if (!dragState.sourceNode) return false;

        const sourceNode = dragState.sourceNode;
        const sourceOptions = sourceTree.data('simpleTreeOptions');
        const targetOptions = targetTree.data('simpleTreeOptions');

        if (!sourceOptions || !targetOptions) return false;

        if (sourceOptions.treeType === 'left' && targetOptions.treeType === 'right') {
            let targetData = targetTree.data('treeData') || [];

            if (sourceOptions.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) {
                updateCloneStatus(false);
                return false;
            }

            targetData = JSON.parse(JSON.stringify(targetData));

            const cloned = cloneNode(sourceNode, sourceOptions.keepIdOnCopy);

            targetData.push(cloned);

            targetTree.data('treeData', targetData);
            renderTree(targetTree, targetData, targetOptions, true);

            if (sourceOptions.onCopy) {
                sourceOptions.onCopy(sourceNode, cloned, null, 'root');
            }
            return true;
        }

        return false;
    }

    // ========== 事件绑定 ==========

    function bindEvents($container, options) {
        const instance = instances.get($container[0]);

        $container.off('click.simpleTree', '.toggle-icon');
        $container.on('click.simpleTree', '.toggle-icon', function (e) {
            e.stopPropagation();
            toggleNode($(this).closest('.tree-node'), options, $container);
        });

        $container.off('dblclick.simpleTree', '.tree-node.folder');
        $container.on('dblclick.simpleTree', '.tree-node.folder', function (e) {
            e.stopPropagation();
            e.preventDefault();
            toggleNode($(this), options, $container);
        });

        $container.off('click.simpleTree', '.tree-node');
        $container.on('click.simpleTree', '.tree-node', function (e) {
            e.stopPropagation();
            const $node = $(this);
            const nodeId = $node.data('id');

            if (instance && instance.selectedNodeId) {
                $container.find(`.tree-node[data-id="${instance.selectedNodeId}"]`).removeClass('selected');
            }

            if (instance) {
                instance.selectedNodeId = nodeId;
            }
            $node.addClass('selected');
        });

        $container.off('mousedown.simpleTree', '.tree-node');
        $container.on('mousedown.simpleTree', '.tree-node', function (e) {
            if (e.which !== 1) return;
            if ($(e.target).hasClass('toggle-icon')) return;
            if ($(e.target).hasClass('node-icon')) return;

            e.preventDefault();
            startDrag(e, this, $container, options);
        });
    }

    function toggleNode($node, options, $container) {
        const $li = $node.closest('li');
        const $children = $li.children('.node-children');
        const $icon = $li.find('.toggle-icon');
        const nodeId = $node.data('id');
        const instance = instances.get($container[0]);

        if ($children.length && $children.is(':visible')) {
            $children.hide();
            $icon.text('▶');
            const $iconSpan = $node.find('.node-icon');
            $iconSpan.text(options.icons.folder);
            if (instance && instance.collapsedState) {
                instance.collapsedState[nodeId] = true;
            }
        } else if ($children.length) {
            $children.show();
            $icon.text('▼');
            const $iconSpan = $node.find('.node-icon');
            $iconSpan.text(options.icons.folderOpen || options.icons.folder);
            if (instance && instance.collapsedState) {
                instance.collapsedState[nodeId] = false;
            }
        }
    }

    // ========== 拖拽逻辑 ==========

    function startDrag(e, nodeEl, $container, options) {
        if (dragState.isDragging) cleanupDrag();

        const $node = $(nodeEl);
        const nodeId = $node.data('id');

        if (!nodeId) return;

        const treeData = $container.data('treeData');
        if (!treeData) return;

        const nodeInfo = findNode(treeData, nodeId);
        if (!nodeInfo) return;

        dragState.sourceNode = nodeInfo.node;
        dragState.sourceTree = $container;
        dragState.sourceTreeType = options.treeType;
        dragState.sourceId = nodeId;
        dragState.isDragging = true;
        dragState.isValidDrop = false;

        $node.addClass('dragging');

        const hasChildren = nodeInfo.node.children && nodeInfo.node.children.length > 0;
        const icon = hasChildren ? options.icons.folder : options.icons.file;

        dragState.clone = $('<div class="simple-tree-clone invalid">')
            .html(`<span class="clone-status">❌</span><span>${escapeHtml(icon)}</span><span>${escapeHtml(nodeInfo.node.text)}</span>`)
            .css({ top: e.clientY + 10, left: e.clientX + 10 })
            .appendTo('body');

        if (options.onDragStart) {
            options.onDragStart(nodeInfo.node, options.treeType);
        }

        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).on('mousemove.simpleTree', function (me) {
            onDragMove(me);
        });
        $(document).on('mouseup.simpleTree', function (me) {
            onDragEnd(me);
        });
    }

    function onDragMove(e) {
        if (!dragState.isDragging) return;
        e.preventDefault();

        if (dragState.clone) {
            dragState.clone.css({ top: e.clientY + 10, left: e.clientX + 10 });
        }

        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeEl = null;
        for (let i = 0; i < elemUnderCursor.length; i++) {
            const el = elemUnderCursor[i];
            if ($(el).hasClass('tree-node') && el !== dragState.sourceNode) {
                targetNodeEl = el;
                break;
            }
        }

        let isEmptyArea = false;
        if (!targetNodeEl) {
            for (let i = 0; i < elemUnderCursor.length; i++) {
                if ($(elemUnderCursor[i]).hasClass('simple-tree-empty')) {
                    isEmptyArea = true;
                    break;
                }
            }
        }

        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
            dragState.targetNode = null;
        }

        if (isEmptyArea && dragState.sourceTreeType === 'left') {
            const $emptyDiv = $('.simple-tree-empty');
            const $targetTree = $emptyDiv.closest('.simple-tree');
            const targetOptions = $targetTree.data('simpleTreeOptions');
            if (targetOptions && targetOptions.treeType === 'right') {
                $emptyDiv.addClass('drag-over-empty');
                dragState.targetTree = $targetTree;
                dragState.targetPosition = 'root';
                dragState.isValidDrop = true;
                updateCloneStatus(true);
                return;
            }
        } else {
            $('.simple-tree-empty').removeClass('drag-over-empty');
        }

        if (targetNodeEl) {
            const $targetTree = $(targetNodeEl).closest('.simple-tree');
            const targetOptions = $targetTree.data('simpleTreeOptions');
            const sourceType = dragState.sourceTreeType;
            const targetType = targetOptions ? targetOptions.treeType : null;

            if (sourceType && targetType) {
                const targetTreeData = $targetTree.data('treeData') || [];
                const targetNodeId = $(targetNodeEl).data('id');
                const isValidDrop = isValidDropTarget(
                    dragState.sourceNode, sourceType, targetType, targetNodeId, targetTreeData
                );

                dragState.targetTree = $targetTree;
                dragState.isValidDrop = isValidDrop;
                updateCloneStatus(isValidDrop);

                if (isValidDrop) {
                    const position = getDropPosition(e, targetNodeEl);
                    dragState.targetNode = targetNodeEl;
                    dragState.targetPosition = position;

                    if (position === 'before') {
                        $(targetNodeEl).addClass('drag-over-before');
                    } else if (position === 'after') {
                        $(targetNodeEl).addClass('drag-over-after');
                    } else {
                        $(targetNodeEl).addClass('drag-over-inside');
                    }
                }
            } else {
                dragState.isValidDrop = false;
                updateCloneStatus(false);
            }
        } else {
            dragState.isValidDrop = false;
            updateCloneStatus(false);
        }
    }

    function onDragEnd(e) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }

        let success = false;

        if (dragState.isValidDrop) {
            if (dragState.targetPosition === 'root' && dragState.sourceTreeType === 'left') {
                success = performDropToEmpty(dragState.sourceTree, dragState.targetTree);
            } else if (dragState.targetNode && dragState.targetPosition) {
                const targetId = $(dragState.targetNode).data('id');
                success = performDrop(targetId, dragState.targetPosition);
            }
        }

        const sourceOptions = dragState.sourceTree ? dragState.sourceTree.data('simpleTreeOptions') : null;
        if (sourceOptions && sourceOptions.onDragEnd) {
            sourceOptions.onDragEnd(dragState.sourceNode, success);
        }

        cleanupDrag();
        $('.simple-tree-empty').removeClass('drag-over-empty');
    }

    function performDrop(targetId, position) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceId = dragState.sourceId;
        const targetTree = dragState.targetTree;

        if (!sourceTree || !targetTree) return false;

        const sourceOptions = sourceTree.data('simpleTreeOptions');
        const targetOptions = targetTree.data('simpleTreeOptions');

        if (!sourceOptions || !targetOptions) return false;

        const sourceType = sourceOptions.treeType;
        const targetType = targetOptions.treeType;

        let success = false;

        if (sourceType === 'left' && targetType === 'right') {
            let targetData = targetTree.data('treeData') || [];

            if (sourceOptions.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) {
                updateCloneStatus(false);
                return false;
            }

            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);

            const cloned = cloneNode(sourceNode, sourceOptions.keepIdOnCopy);

            if (insertNode(targetData, targetId, cloned, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOptions, true);
                if (sourceOptions.onCopy) {
                    sourceOptions.onCopy(sourceNode, cloned, targetId, position);
                }
                success = true;
            }
        }
        else if (sourceType === 'right' && targetType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);

            if (sourceId == targetId) return false;

            removeNode(targetData, sourceId);
            if (insertNode(targetData, targetId, sourceNode, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOptions, true);
                if (sourceOptions.onMove) {
                    sourceOptions.onMove(sourceNode, targetId, position);
                }
                success = true;
            }
        }

        return success;
    }

    function cleanupDrag() {
        if (dragState.sourceNode) {
            $('.tree-node.dragging').removeClass('dragging');
        }
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
        }
        if (dragState.clone) {
            dragState.clone.remove();
        }

        dragState = {
            sourceNode: null,
            sourceTree: null,
            sourceTreeType: null,
            sourceId: null,
            clone: null,
            targetNode: null,
            targetPosition: null,
            targetTree: null,
            isDragging: false,
            isValidDrop: false
        };

        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).off('mousemove.simpleTreeEmpty mouseup.simpleTreeEmpty');
    }

    // ========== 插件入口 ==========

    $.fn.simpleTree = function (userOptions) {
        if (typeof userOptions === 'string') {
            const method = userOptions;
            const args = Array.prototype.slice.call(arguments, 1);

            const results = [];
            this.each(function () {
                const $this = $(this);
                switch (method) {
                    case 'search':
                        results.push(searchNodes($this, args[0]));
                        break;
                    case 'clearSearch':
                        results.push(clearSearch($this));
                        break;
                    case 'addNode':
                        results.push(addNode($this, args[0], args[1]));
                        break;
                    case 'deleteNode':
                        results.push(deleteNode($this, args[0]));
                        break;
                    case 'deleteSelected':
                        results.push(deleteSelectedNode($this));
                        break;
                    case 'getSelected':
                        results.push(getSelectedNode($this));
                        break;
                    case 'setSelected':
                        results.push(setSelectedNode($this, args[0]));
                        break;
                    case 'getData':
                        results.push(getTreeData($this));
                        break;
                    case 'setData':
                        results.push(setTreeData($this, args[0], args[1]));
                        break;
                    case 'expandAll':
                        results.push(expandAll($this));
                        break;
                    case 'collapseAll':
                        results.push(collapseAll($this));
                        break;
                    case 'refresh':
                        results.push(refreshTree($this));
                        break;
                    case 'toJson':
                        const pretty = args[0] === true;
                        results.push(treeToJson($this, pretty));
                        break;
                    default:
                        console.warn('未知方法: ' + method);
                }
            });

            return results.length === 1 ? results[0] : results;
        }

        const options = $.extend(true, {}, defaults, userOptions);

        return this.each(function () {
            const $this = $(this);
            $this.addClass('simple-tree');

            $this.data('simpleTreeOptions', options);

            function ensureId(nodes) {
                if (!nodes) return;
                for (let i = 0; i < nodes.length; i++) {
                    if (!nodes[i].id) {
                        nodes[i].id = generateId();
                    }
                    if (nodes[i].children) {
                        ensureId(nodes[i].children);
                    }
                }
            }

            instances.set($this[0], {
                options: options,
                selectedNodeId: null,
                currentSearchKeyword: '',
                collapsedState: {}
            });

            let dataToRender = options.data;
            if (dataToRender && dataToRender.length) {
                const dataCopy = JSON.parse(JSON.stringify(dataToRender));
                ensureId(dataCopy);
                $this.data('treeData', dataCopy);
                renderTree($this, dataCopy, options, false);
            } else if (options.allowDropToEmpty && options.treeType === 'right') {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            } else {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            }
        });
    };

})(jQuery);