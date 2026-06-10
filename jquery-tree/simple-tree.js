/**
 * SimpleTree - 简洁拖拽树插件
 * 用法: $('#tree').simpleTree({ data: [...], onCopy: fn, onMove: fn })
 */
(function($) {
    'use strict';

    // 默认配置
    const defaults = {
        data: [],           // 树数据 [{ id, text, children }]
        defaultCollapsed: true,  // 默认折叠
        onCopy: null,       // 复制回调 (sourceNode, clonedNode, targetId, position)
        onMove: null,       // 移动回调 (node, targetId, position)
        onDragStart: null,
        onDragEnd: null
    };

    // 全局拖拽状态
    let dragState = {
        sourceNode: null,    // 源节点数据
        sourceTree: null,    // 源树容器
        sourceId: null,      // 源节点ID
        clone: null,         // 克隆元素
        targetNode: null,    // 目标节点
        isDragging: false
    };

    // ========== 工具函数 ==========
    
    // 根据ID查找节点
    function findNode(tree, id) {
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

    // 删除节点
    function removeNode(tree, id) {
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

    // 插入节点
    function insertNode(tree, targetId, newNode, position) {
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

    // 复制节点
    function cloneNode(node) {
        return JSON.parse(JSON.stringify(node));
    }

    // 检查是否是后代
    function isDescendant(parentNode, childId) {
        if (!parentNode.children) return false;
        for (let child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendant(child, childId)) return true;
        }
        return false;
    }

    // 获取放置位置
    function getDropPosition(e, targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const y = e.clientY;
        const height = rect.height;
        const ratio = (y - rect.top) / height;
        if (ratio < 0.33) return 'before';
        if (ratio > 0.66) return 'after';
        return 'inside';
    }

    // 转义HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    // ========== 渲染函数 ==========
    
    function renderTree($container, data, options) {
        if (!data || !data.length) {
            $container.html('<div class="tree-node">无数据</div>');
            return;
        }

        function buildHtml(nodes) {
            let html = '<ul>';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const hasChildren = node.children && node.children.length > 0;
                const collapsedClass = (options.defaultCollapsed && hasChildren) ? 'collapsed' : '';
                const collapsedStyle = (options.defaultCollapsed && hasChildren) ? 'display: none;' : '';
                
                html += `<li data-id="${node.id}">`;
                html += `<div class="tree-node" data-id="${node.id}">`;
                html += `<span class="toggle-icon ${hasChildren ? '' : 'empty'}" data-id="${node.id}">${hasChildren ? (options.defaultCollapsed ? '▶' : '▼') : ''}</span>`;
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

        $container.html(buildHtml(data));
        bindEvents($container, options);
    }

    // ========== 事件绑定 ==========
    
    function bindEvents($container, options) {
        // 折叠/展开
        $container.off('click', '.toggle-icon');
        $container.on('click', '.toggle-icon', function(e) {
            e.stopPropagation();
            const $icon = $(this);
            const $node = $icon.closest('.tree-node');
            const $li = $node.closest('li');
            const $children = $li.children('.node-children');
            const nodeId = $node.data('id');
            
            if ($children.length && $children.is(':visible')) {
                $children.hide();
                $icon.text('▶');
            } else if ($children.length) {
                $children.show();
                $icon.text('▼');
            }
        });

        // 拖拽开始
        $container.off('mousedown', '.tree-node');
        $container.on('mousedown', '.tree-node', function(e) {
            if (e.which !== 1) return;
            if ($(e.target).hasClass('toggle-icon')) return;
            
            e.preventDefault();
            startDrag(e, this, $container, options);
        });
    }

    // ========== 拖拽逻辑 ==========
    
    function startDrag(e, nodeEl, $container, options) {
        if (dragState.isDragging) cleanupDrag();
        
        const $node = $(nodeEl);
        const nodeId = $node.data('id');
        const treeData = $container.data('treeData');
        const nodeInfo = findNode(treeData, nodeId);
        
        if (!nodeInfo) return;
        
        dragState.sourceNode = nodeInfo.node;
        dragState.sourceTree = $container;
        dragState.sourceId = nodeId;
        dragState.isDragging = true;
        
        $node.addClass('dragging');
        
        // 创建克隆体
        dragState.clone = $('<div class="simple-tree-clone">')
            .text(nodeInfo.node.text)
            .css({ top: e.clientY + 10, left: e.clientX + 10 })
            .appendTo('body');
        
        if (options.onDragStart) {
            options.onDragStart(nodeInfo.node, $container.attr('id'));
        }
        
        $(document).on('mousemove.simpleTree', function(me) {
            onDragMove(me, options);
        });
        $(document).on('mouseup.simpleTree', function(me) {
            onDragEnd(me, options);
        });
    }
    
    function onDragMove(e, options) {
        if (!dragState.isDragging) return;
        e.preventDefault();
        
        if (dragState.clone) {
            dragState.clone.css({ top: e.clientY + 10, left: e.clientX + 10 });
        }
        
        // 查找目标节点
        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeEl = null;
        for (let i = 0; i < elemUnderCursor.length; i++) {
            const el = elemUnderCursor[i];
            if ($(el).hasClass('tree-node') && el !== dragState.sourceNode) {
                targetNodeEl = el;
                break;
            }
        }
        
        // 清除旧高亮
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over');
            dragState.targetNode = null;
        }
        
        // 高亮新目标
        if (targetNodeEl) {
            const $targetTree = $(targetNodeEl).closest('.simple-tree');
            const $sourceTree = dragState.sourceTree;
            const sourceId = $sourceTree.attr('id');
            const targetId = $targetTree.attr('id');
            
            // 允许：左→右 或 右→右
            const isValid = (sourceId === 'leftTree' && targetId === 'rightTree') ||
                           (sourceId === 'rightTree' && targetId === 'rightTree');
            
            if (isValid) {
                dragState.targetNode = targetNodeEl;
                $(targetNodeEl).addClass('drag-over');
                $(targetNodeEl).data('dropPos', getDropPosition(e, targetNodeEl));
            }
        }
    }
    
    function onDragEnd(e, options) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }
        
        let success = false;
        
        if (dragState.targetNode) {
            const dropPos = $(dragState.targetNode).data('dropPos') || 'inside';
            const targetId = $(dragState.targetNode).data('id');
            success = performDrop(targetId, dropPos, options);
        }
        
        if (options.onDragEnd) {
            options.onDragEnd(dragState.sourceNode, success);
        }
        
        cleanupDrag();
    }
    
    function performDrop(targetId, position, options) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceId = dragState.sourceId;
        
        // 获取目标树
        const targetTree = $('.simple-tree').filter(function() {
            return $(this).find(`[data-id="${targetId}"]`).length > 0;
        }).first();
        
        if (!targetTree.length) return false;
        
        const sourceTreeId = sourceTree.attr('id');
        const targetTreeId = targetTree.attr('id');
        
        let success = false;
        
        // 左 -> 右（复制）
        if (sourceTreeId === 'leftTree' && targetTreeId === 'rightTree') {
            const targetData = targetTree.data('treeData');
            const cloned = cloneNode(sourceNode);
            cloned.id = sourceNode.id + '_copy_' + Date.now();
            
            if (insertNode(targetData, targetId, cloned, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, { 
                    defaultCollapsed: options.defaultCollapsed,
                    onCopy: options.onCopy,
                    onMove: options.onMove,
                    onDragStart: options.onDragStart,
                    onDragEnd: options.onDragEnd,
                    renderNode: options.renderNode
                });
                if (options.onCopy) {
                    options.onCopy(sourceNode, cloned, targetId, position);
                }
                success = true;
            }
        }
        // 右 -> 右（移动）
        else if (sourceTreeId === 'rightTree' && targetTreeId === 'rightTree') {
            const targetData = targetTree.data('treeData');
            
            if (sourceId == targetId) return false;
            
            const targetNodeInfo = findNode(targetData, targetId);
            if (targetNodeInfo && isDescendant(sourceNode, targetId)) return false;
            
            // 删除源节点
            removeNode(targetData, sourceId);
            // 插入到新位置
            if (insertNode(targetData, targetId, sourceNode, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, { 
                    defaultCollapsed: options.defaultCollapsed,
                    onCopy: options.onCopy,
                    onMove: options.onMove,
                    onDragStart: options.onDragStart,
                    onDragEnd: options.onDragEnd,
                    renderNode: options.renderNode
                });
                if (options.onMove) {
                    options.onMove(sourceNode, targetId, position);
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
            $(dragState.targetNode).removeClass('drag-over');
        }
        if (dragState.clone) {
            dragState.clone.remove();
        }
        
        dragState = {
            sourceNode: null,
            sourceTree: null,
            sourceId: null,
            clone: null,
            targetNode: null,
            isDragging: false
        };
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
    }
    
    // ========== 插件入口 ==========
    
    $.fn.simpleTree = function(userOptions) {
        const options = $.extend({}, defaults, userOptions);
        
        return this.each(function() {
            const $this = $(this);
            $this.addClass('simple-tree');
            
            // 确保每个节点都有id
            function ensureId(nodes) {
                for (let i = 0; i < nodes.length; i++) {
                    if (!nodes[i].id) {
                        nodes[i].id = 'node_' + Date.now() + '_' + i + '_' + Math.random();
                    }
                    if (nodes[i].children) {
                        ensureId(nodes[i].children);
                    }
                }
            }
            
            if (options.data && options.data.length) {
                const dataCopy = JSON.parse(JSON.stringify(options.data));
                ensureId(dataCopy);
                $this.data('treeData', dataCopy);
                renderTree($this, dataCopy, options);
            }
        });
    };
    
})(jQuery);