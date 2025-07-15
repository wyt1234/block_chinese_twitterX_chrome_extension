// X中文帖子过滤器 - Popup Script (增强版)
(function() {
    'use strict';

    // DOM元素
    const chineseCountEl = document.getElementById('chineseCount');
    const adCountEl = document.getElementById('adCount');
    const statusEl = document.getElementById('status');
    const visualToggle = document.getElementById('visualToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const resetBtn = document.getElementById('resetBtn');

    // 存储键名
    const STORAGE_KEYS = {
        CHINESE_COUNT: 'chineseFilterCount',
        AD_COUNT: 'adFilterCount',
        VISUAL_EFFECTS: 'visualEffectsEnabled',
        LAST_ACTIVE: 'lastActiveTime'
    };

    // 初始化
    async function init() {
        await loadSettings();
        await updateStats();
        bindEvents();
        setInterval(updateStats, 1000); // 每秒更新状态
    }

    // 加载设置
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                STORAGE_KEYS.VISUAL_EFFECTS,
                STORAGE_KEYS.CHINESE_COUNT,
                STORAGE_KEYS.AD_COUNT
            ]);

            // 设置视觉效果开关
            const visualEnabled = result[STORAGE_KEYS.VISUAL_EFFECTS] !== false;
            updateToggle(visualToggle, visualEnabled);

            // 显示统计数据
            chineseCountEl.textContent = result[STORAGE_KEYS.CHINESE_COUNT] || 0;
            adCountEl.textContent = result[STORAGE_KEYS.AD_COUNT] || 0;
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 获取实时统计数据
    async function getRealTimeStats() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'getStats' });
                return response;
            }
        } catch (error) {
            // 如果content script没有响应，返回null
            return null;
        }
        return null;
    }

    // 更新统计数据
    async function updateStats() {
        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || (!tab.url.includes('twitter.com') && !tab.url.includes('x.com'))) {
                statusEl.textContent = '未在X';
                statusEl.style.background = 'rgba(255, 255, 255, 0.3)';
                return;
            }

            // 首先尝试从content script获取实时数据
            const realTimeStats = await getRealTimeStats();
            
            // 获取存储的统计数据作为备份
            const result = await chrome.storage.sync.get([
                STORAGE_KEYS.CHINESE_COUNT,
                STORAGE_KEYS.AD_COUNT,
                STORAGE_KEYS.LAST_ACTIVE
            ]);

            // 使用实时数据或存储数据
            const chineseCount = realTimeStats?.hiddenCount ?? result[STORAGE_KEYS.CHINESE_COUNT] ?? 0;
            const adCount = realTimeStats?.adCount ?? result[STORAGE_KEYS.AD_COUNT] ?? 0;
            
            chineseCountEl.textContent = chineseCount;
            adCountEl.textContent = adCount;

            // 检查最后活动时间
            const lastActive = result[STORAGE_KEYS.LAST_ACTIVE];
            const now = Date.now();
            
            if (realTimeStats) {
                statusEl.textContent = '活跃';
                statusEl.style.background = 'rgba(76, 175, 80, 0.8)';
            } else if (lastActive && (now - lastActive) < 15000) { // 15秒内有活动
                statusEl.textContent = '待机';
                statusEl.style.background = 'rgba(255, 193, 7, 0.8)';
            } else {
                statusEl.textContent = '离线';
                statusEl.style.background = 'rgba(156, 156, 156, 0.8)';
            }

        } catch (error) {
            console.error('更新统计失败:', error);
            statusEl.textContent = '错误';
            statusEl.style.background = 'rgba(244, 67, 54, 0.8)';
        }
    }

    // 绑定事件
    function bindEvents() {
        // 视觉效果开关
        visualToggle.addEventListener('click', async () => {
            const isActive = !visualToggle.classList.contains('active');
            updateToggle(visualToggle, isActive);
            
            try {
                await chrome.storage.sync.set({
                    [STORAGE_KEYS.VISUAL_EFFECTS]: isActive
                });
                
                // 通知content script更新设置
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'updateSettings',
                            visualEffects: isActive
                        });
                    } catch (error) {
                        // content script可能还没加载，忽略错误
                        console.log('Content script未响应，设置已保存');
                    }
                }
            } catch (error) {
                console.error('保存设置失败:', error);
            }
        });

        // 刷新按钮
        refreshBtn.addEventListener('click', async () => {
            try {
                refreshBtn.style.transform = 'rotate(360deg)';
                refreshBtn.style.transition = 'transform 0.6s ease';
                
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { type: 'refresh' });
                        await updateStats();
                        
                        // 显示成功反馈
                        statusEl.textContent = '已刷新';
                        statusEl.style.background = 'rgba(76, 175, 80, 0.8)';
                    } catch (error) {
                        statusEl.textContent = '刷新失败';
                        statusEl.style.background = 'rgba(244, 67, 54, 0.8)';
                    }
                }
                
                setTimeout(() => {
                    refreshBtn.style.transform = '';
                    refreshBtn.style.transition = '';
                }, 600);
            } catch (error) {
                console.error('刷新失败:', error);
            }
        });

        // 重置按钮
        resetBtn.addEventListener('click', async () => {
            if (confirm('确定要重置所有统计数据并恢复隐藏的推文吗？')) {
                try {
                    await chrome.storage.sync.set({
                        [STORAGE_KEYS.CHINESE_COUNT]: 0,
                        [STORAGE_KEYS.AD_COUNT]: 0
                    });
                    
                    chineseCountEl.textContent = '0';
                    adCountEl.textContent = '0';
                    
                    // 通知content script重置
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, { type: 'reset' });
                            statusEl.textContent = '已重置';
                            statusEl.style.background = 'rgba(76, 175, 80, 0.8)';
                        } catch (error) {
                            statusEl.textContent = '重置失败';
                            statusEl.style.background = 'rgba(244, 67, 54, 0.8)';
                        }
                    }
                } catch (error) {
                    console.error('重置失败:', error);
                }
            }
        });
    }

    // 更新开关状态
    function updateToggle(toggle, active) {
        if (active) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
    }

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'updatePopupStats') {
            chineseCountEl.textContent = message.chineseCount || 0;
            adCountEl.textContent = message.adCount || 0;
            sendResponse({ success: true });
        }
    });

    // 当popup打开时初始化
    document.addEventListener('DOMContentLoaded', init);

})(); 