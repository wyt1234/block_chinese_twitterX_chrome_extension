// X中文帖子过滤器 - Content Script (增强版)
(function() {
    'use strict';

    // 配置
    const CONFIG = {
        hiddenCount: 0,
        adCount: 0,
        enableVisualEffects: true,
        debugMode: false  // 生产版本关闭调试模式，如需调试请改为true
    };

    // 存储键名
    const STORAGE_KEYS = {
        CHINESE_COUNT: 'chineseFilterCount',
        AD_COUNT: 'adFilterCount',
        VISUAL_EFFECTS: 'visualEffectsEnabled',
        LAST_ACTIVE: 'lastActiveTime'
    };

    // 中文检测正则表达式（优化）
    const CHINESE_REGEX = /[\u4e00-\u9fff]/;

    // 广告相关关键词（更精确的检测）
    const AD_KEYWORDS = [
        'Promoted', '推广', 'Sponsored', '赞助', '广告',
        'Promoted Tweet', '推广推文'
    ];

    // 更精确的推文选择器
    const TWEET_SELECTORS = [
        'article[data-testid="tweet"]',
        'div[data-testid="tweet"]',
        'article[role="article"][tabindex="0"]',
        '[data-testid="cellInnerDiv"] article[role="article"]'
    ];

    // 已处理的推文集合（使用WeakSet避免内存泄漏）
    const processedTweets = new WeakSet();
    
    // 防抖处理器
    let processingTimeout = null;
    let observerTimeout = null;

    // 日志函数
    function log(...args) {
        if (CONFIG.debugMode) {
            console.log('[Chinese Filter]', ...args);
        }
    }

    // 创建样式
    function createStyles() {
        if (document.querySelector('#chinese-filter-styles')) {
            return; // 已存在
        }
        
        const style = document.createElement('style');
        style.id = 'chinese-filter-styles';
        style.textContent = `
            .chinese-filter-hidden {
                opacity: 0 !important;
                transform: scale(0.8) !important;
                transition: all 0.3s ease-out !important;
                pointer-events: none !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
            }
            
            .chinese-filter-removing {
                opacity: 0.3 !important;
                transform: scale(0.95) !important;
                transition: all 0.5s ease-out !important;
                border: 2px solid #ff4444 !important;
                background: linear-gradient(45deg, rgba(255,68,68,0.1), transparent) !important;
            }
            
            .chinese-filter-notification {
                position: fixed !important;
                top: 80px !important;
                right: 20px !important;
                background: linear-gradient(135deg, #1da1f2, #0084b4) !important;
                color: white !important;
                padding: 12px 20px !important;
                border-radius: 25px !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                z-index: 10000 !important;
                box-shadow: 0 4px 15px rgba(29, 161, 242, 0.3) !important;
                animation: slideIn 0.3s ease-out, slideOut 0.3s ease-in 2.7s forwards !important;
                backdrop-filter: blur(10px) !important;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // 显示通知
    function showNotification(message, type = 'filter') {
        if (!CONFIG.enableVisualEffects) return;
        
        // 清除已存在的通知
        const existingNotifications = document.querySelectorAll('.chinese-filter-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = 'chinese-filter-notification';
        notification.textContent = message;
        
        if (type === 'ad') {
            notification.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a24)';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // 检测是否包含中文
    function containsChinese(text) {
        if (!text || typeof text !== 'string') return false;
        const result = CHINESE_REGEX.test(text);
        if (result) {
            log('检测到中文内容:', text.substring(0, 50));
        }
        return result;
    }

    // 检测是否为广告
    function isAd(element) {
        if (!element) return false;
        
        // 检查推广指示器（最可靠的方法）
        const promotedIndicator = element.querySelector('[data-testid="promotedIndicator"]');
        if (promotedIndicator) {
            log('发现推广指示器');
            return true;
        }
        
        // 检查专门的广告标识元素
        const adLabel = element.querySelector('[data-testid*="promoted"], [data-testid*="ad"]');
        if (adLabel) {
            log('发现广告标识元素');
            return true;
        }
        
        // 检查aria-label中的推广标识
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Promoted') || ariaLabel.includes('推广')) {
            log('检测到推广aria-label');
            return true;
        }
        
        // 检查推文文本中是否直接包含广告标识
        const tweetTextElement = element.querySelector('[data-testid="tweetText"]');
        if (tweetTextElement) {
            const tweetText = tweetTextElement.textContent || '';
            for (const keyword of AD_KEYWORDS) {
                if (tweetText.includes(keyword)) {
                    log('在推文文本中检测到广告关键词:', keyword);
                    return true;
                }
            }
        }
        
        // 检查用户名旁的推广标签（更精确的检测）
        const userNameArea = element.querySelector('[data-testid="User-Name"]');
        if (userNameArea) {
            const userAreaText = userNameArea.textContent || '';
            if (userAreaText.includes('Promoted') || userAreaText.includes('推广')) {
                log('在用户名区域检测到推广标识');
                return true;
            }
        }
        
        // 检查时间戳区域的推广标识
        const timestampArea = element.querySelector('time');
        if (timestampArea && timestampArea.parentElement) {
            const timestampParent = timestampArea.parentElement;
            const timestampText = timestampParent.textContent || '';
            if (timestampText.includes('Promoted') || timestampText.includes('推广')) {
                log('在时间戳区域检测到推广标识');
                return true;
            }
        }
        
        return false;
    }

    // 保存统计数据
    async function saveStats() {
        try {
            await chrome.storage.sync.set({
                [STORAGE_KEYS.CHINESE_COUNT]: CONFIG.hiddenCount,
                [STORAGE_KEYS.AD_COUNT]: CONFIG.adCount,
                [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
            });
            log('统计数据已保存');
        } catch (error) {
            console.error('保存统计数据失败:', error);
        }
    }

    // 加载设置
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get([
                STORAGE_KEYS.CHINESE_COUNT,
                STORAGE_KEYS.AD_COUNT,
                STORAGE_KEYS.VISUAL_EFFECTS
            ]);
            
            CONFIG.hiddenCount = result[STORAGE_KEYS.CHINESE_COUNT] || 0;
            CONFIG.adCount = result[STORAGE_KEYS.AD_COUNT] || 0;
            CONFIG.enableVisualEffects = result[STORAGE_KEYS.VISUAL_EFFECTS] !== false;
            
            log('设置已加载:', CONFIG);
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 隐藏元素
    function hideElement(element, reason = 'chinese') {
        if (!element || element.classList.contains('chinese-filter-hidden')) {
            return;
        }
        
        log('隐藏元素，原因:', reason);
        
        // 立即应用隐藏样式
        if (CONFIG.enableVisualEffects) {
            element.classList.add('chinese-filter-removing');
            
            setTimeout(() => {
                element.classList.remove('chinese-filter-removing');
                element.classList.add('chinese-filter-hidden');
            }, 500);
        } else {
            element.classList.add('chinese-filter-hidden');
        }
        
        const message = reason === 'ad' ? 
            `🚫 已屏蔽广告 (${++CONFIG.adCount})` : 
            `🇨🇳 已隐藏中文帖子 (${++CONFIG.hiddenCount})`;
            
        showNotification(message, reason);
        saveStats();
    }

    // 获取推文文本内容
    function getTweetText(tweetElement) {
        // 最可靠的方法：查找推文文本元素
        const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
        if (tweetTextElement) {
            return tweetTextElement.textContent || '';
        }
        
        // 备用方法：查找推文文本的父容器
        const tweetTexts = tweetElement.querySelectorAll('[data-testid="tweetText"], [dir="auto"]');
        for (const textEl of tweetTexts) {
            const text = textEl.textContent || '';
            // 过滤掉用户名、时间戳、按钮等
            if (text.length > 5 && 
                !text.includes('Replying to') &&
                !text.includes('@') &&
                !text.match(/^\d+h$|^\d+m$|^\d+s$/) &&
                !text.match(/\d+\s+(Reply|Repost|Like|View|Share|replies|reposts|likes)/i)) {
                return text;
            }
        }
        
        return '';
    }

    // 获取所有推文元素
    function getTweetElements() {
        const tweets = new Set();
        
        // 使用多个选择器查找推文
        for (const selector of TWEET_SELECTORS) {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    // 验证是否为有效的推文元素
                    if (isValidTweet(el)) {
                        tweets.add(el);
                    }
                });
            } catch (error) {
                log('选择器错误:', selector, error);
            }
        }
        
        log(`找到 ${tweets.size} 个推文元素`);
        return Array.from(tweets);
    }

    // 验证是否为有效的推文元素
    function isValidTweet(element) {
        if (!element || processedTweets.has(element)) {
            return false;
        }
        
        // 检查是否已被隐藏
        if (element.classList.contains('chinese-filter-hidden')) {
            return false;
        }
        
        // 检查必要的推文特征
        const hasUserInfo = element.querySelector('[data-testid="User-Name"]');
        const hasTimeStamp = element.querySelector('time');
        const hasTweetTestId = element.hasAttribute('data-testid') && 
                              element.getAttribute('data-testid') === 'tweet';
        const isArticleRole = element.getAttribute('role') === 'article';
        
        // 至少需要有用户信息或时间戳，并且是推文元素
        const isValidStructure = (hasUserInfo || hasTimeStamp) && (hasTweetTestId || isArticleRole);
        
        if (isValidStructure) {
            log('有效推文元素已验证');
        }
        
        return isValidStructure;
    }

    // 处理单个推文
    function processTweet(tweet) {
        if (processedTweets.has(tweet)) {
            return;
        }
        
        processedTweets.add(tweet);
        
        const tweetText = getTweetText(tweet);
        log('处理推文:', tweetText.substring(0, 100));
        
        // 检查是否为广告
        if (isAd(tweet)) {
            log('检测到广告，准备隐藏');
            hideElement(tweet, 'ad');
            return;
        }
        
        // 检查是否包含中文
        if (containsChinese(tweetText)) {
            log('检测到中文推文，准备隐藏');
            hideElement(tweet, 'chinese');
            return;
        }
        
        log('推文通过检查，保留');
    }

    // 批量处理推文（防抖）
    function processTweets() {
        if (processingTimeout) {
            clearTimeout(processingTimeout);
        }
        
        processingTimeout = setTimeout(() => {
            try {
                const tweets = getTweetElements();
                log(`开始处理 ${tweets.length} 个推文`);
                
                tweets.forEach(processTweet);
                
                log('推文处理完成');
            } catch (error) {
                console.error('处理推文时出错:', error);
            }
        }, 200);
    }

    // 创建增强的DOM观察者
    function createObserver() {
        let isObserving = false;
        
        const observer = new MutationObserver((mutations) => {
            if (isObserving) return;
            isObserving = true;
            
            let hasNewContent = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查是否有新的推文内容
                            if (node.matches && 
                                (node.matches('article') || 
                                 node.matches('[data-testid*="tweet"]') ||
                                 node.querySelector('article') ||
                                 node.querySelector('[data-testid*="tweet"]'))) {
                                hasNewContent = true;
                                break;
                            }
                        }
                    }
                }
                if (hasNewContent) break;
            }
            
            if (hasNewContent) {
                log('检测到新内容，准备处理');
                if (observerTimeout) {
                    clearTimeout(observerTimeout);
                }
                observerTimeout = setTimeout(() => {
                    processTweets();
                    isObserving = false;
                }, 300);
            } else {
                isObserving = false;
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            attributeOldValue: false,
            characterData: false,
            characterDataOldValue: false
        });
        
        log('DOM观察者已创建');
        return observer;
    }

    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('收到消息:', message.type);
        
        switch (message.type) {
            case 'updateSettings':
                CONFIG.enableVisualEffects = message.visualEffects;
                chrome.storage.sync.set({
                    [STORAGE_KEYS.VISUAL_EFFECTS]: message.visualEffects
                });
                sendResponse({ success: true });
                break;
                
            case 'refresh':
                // 清除处理记录，重新处理所有推文
                processedTweets.clear?.() || (() => {
                    // WeakSet没有clear方法，创建新的WeakSet
                    Object.setPrototypeOf(processedTweets, WeakSet.prototype);
                })();
                processTweets();
                sendResponse({ success: true });
                break;
                
            case 'reset':
                CONFIG.hiddenCount = 0;
                CONFIG.adCount = 0;
                saveStats();
                // 移除所有隐藏样式
                document.querySelectorAll('.chinese-filter-hidden, .chinese-filter-removing').forEach(el => {
                    el.classList.remove('chinese-filter-hidden', 'chinese-filter-removing');
                });
                sendResponse({ success: true });
                break;
                
            case 'getStats':
                sendResponse({
                    hiddenCount: CONFIG.hiddenCount,
                    adCount: CONFIG.adCount
                });
                break;
                
            default:
                sendResponse({ success: false });
        }
        return true;
    });

    // 页面可见性变化监听
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            log('页面变为可见，重新处理推文');
            setTimeout(processTweets, 500);
        }
    });

    // 滚动监听（节流）
    let scrollTimeout = null;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) return;
        scrollTimeout = setTimeout(() => {
            processTweets();
            scrollTimeout = null;
        }, 1000);
    });

    // 初始化
    async function init() {
        log('X中文帖子过滤器启动中...');
        
        try {
            // 加载设置
            await loadSettings();
            
            // 创建样式
            createStyles();
            
            // 等待页面就绪
            const startProcessing = () => {
                log('开始初始处理');
                processTweets();
                createObserver();
                
                // 显示启动通知
                setTimeout(() => {
                    showNotification('🚀 X中文帖子过滤器已启动');
                }, 1000);
            };
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(startProcessing, 2000);
                });
            } else {
                setTimeout(startProcessing, 1000);
            }
            
            // 定期健康检查和处理（降低频率避免性能问题）
            setInterval(() => {
                log('定期检查执行');
                processTweets();
            }, 5000);
            
            // 定期更新活动时间
            setInterval(() => {
                chrome.storage.sync.set({
                    [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
                });
            }, 10000);
            
            log('X中文帖子过滤器初始化完成');
            
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }

    // 启动插件
    init();

})(); 