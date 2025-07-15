// X中文帖子过滤器 - Content Script
(function() {
    'use strict';

    // 配置
    const CONFIG = {
        hiddenCount: 0,
        adCount: 0,
        enableVisualEffects: true
    };

    // 存储键名
    const STORAGE_KEYS = {
        CHINESE_COUNT: 'chineseFilterCount',
        AD_COUNT: 'adFilterCount',
        VISUAL_EFFECTS: 'visualEffectsEnabled',
        LAST_ACTIVE: 'lastActiveTime'
    };

    // 中文检测正则表达式
    const CHINESE_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b920-\u2ceaf\uf900-\ufaff\u3300-\u33ff\ufe30-\ufe4f\uf900-\ufaff\u2f800-\u2fa1f]/;

    // 广告相关关键词
    const AD_KEYWORDS = [
        'Promoted', '推广', 'Sponsored', '赞助', 'Ad', '广告',
        'Promoted Tweet', '推广推文'
    ];

    // 帖子选择器（X/Twitter可能的帖子容器）
    const TWEET_SELECTORS = [
        '[data-testid="tweet"]',
        '[data-testid="tweetText"]',
        'article[data-testid="tweet"]',
        'div[data-testid="tweet"]',
        '[data-testid="primaryColumn"] > div > div > div > div'
    ];

    // 广告选择器
    const AD_SELECTORS = [
        '[data-testid="promotedIndicator"]',
        '[aria-label*="Promoted"]',
        '[aria-label*="推广"]',
        'span:contains("Promoted")',
        'span:contains("推广")'
    ];

    // 创建样式
    function createStyles() {
        const style = document.createElement('style');
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
        const result = CHINESE_REGEX.test(text);
        if (result) {
            console.log('中文检测结果: true, 示例文字:', text.match(CHINESE_REGEX)?.[0]);
        }
        return result;
    }

    // 检测是否为广告
    function isAd(element) {
        const text = element.textContent || '';
        const innerHTML = element.innerHTML || '';
        
        // 检查广告关键词
        for (const keyword of AD_KEYWORDS) {
            if (text.includes(keyword) || innerHTML.includes(keyword)) {
                return true;
            }
        }
        
        // 检查广告相关的aria-label
        const ariaLabel = element.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Promoted') || ariaLabel.includes('推广')) {
            return true;
        }
        
        // 检查是否有推广指示器
        for (const selector of AD_SELECTORS) {
            if (element.querySelector(selector)) {
                return true;
            }
        }
        
        // 检查父元素是否有广告标识
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            const parentText = parent.textContent || '';
            for (const keyword of AD_KEYWORDS) {
                if (parentText.includes(keyword)) {
                    return true;
                }
            }
            parent = parent.parentElement;
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
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 隐藏元素
    function hideElement(element, reason = 'chinese') {
        console.log('尝试隐藏元素，原因:', reason);
        
        if (element.classList.contains('chinese-filter-hidden')) {
            console.log('元素已经被隐藏，跳过');
            return;
        }
        
        console.log('开始隐藏元素');
        
        // 立即隐藏元素
        element.style.display = 'none !important';
        element.classList.add('chinese-filter-hidden');
        
        // 如果启用视觉效果，先显示动画再隐藏
        if (CONFIG.enableVisualEffects) {
            element.style.display = '';
            element.classList.add('chinese-filter-removing');
            
            // 延迟添加隐藏类以显示动画效果
            setTimeout(() => {
                console.log('应用隐藏样式');
                element.classList.remove('chinese-filter-removing');
                element.classList.add('chinese-filter-hidden');
            }, 500);
        }
        
        const message = reason === 'ad' ? 
            `🚫 已屏蔽广告 (${++CONFIG.adCount})` : 
            `🇨🇳 已隐藏中文帖子 (${++CONFIG.hiddenCount})`;
            
        console.log('显示通知:', message);
        showNotification(message, reason);
        
        // 保存统计数据
        saveStats();
    }

    // 获取帖子元素
    function getTweetElements() {
        const tweets = new Set();
        
        // 主要选择器：查找所有推文容器
        const tweetContainers = document.querySelectorAll('article[data-testid="tweet"]');
        tweetContainers.forEach(tweet => tweets.add(tweet));
        
        // 备用选择器
        for (const selector of TWEET_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => tweets.add(el));
        }
        
        // 通用方式：查找包含推文内容的article元素
        const articles = document.querySelectorAll('article');
        articles.forEach(article => {
            if (article.getAttribute('data-testid') === 'tweet' || 
                (article.textContent && article.textContent.length > 20 && 
                 article.querySelector('[data-testid="tweetText"]'))) {
                tweets.add(article);
            }
        });
        
        return Array.from(tweets);
    }

    // 处理帖子
    function processTweets() {
        const tweets = getTweetElements();
        console.log(`发现 ${tweets.length} 个帖子待处理`);
        
        tweets.forEach(tweet => {
            // 跳过已处理且已隐藏的元素
            if (tweet.classList.contains('chinese-filter-processed') && 
                tweet.classList.contains('chinese-filter-hidden')) {
                return;
            }
            
            const tweetText = tweet.textContent || '';
            console.log('检查帖子:', tweetText.substring(0, 50) + '...');
            
            // 检查是否为广告
            if (isAd(tweet)) {
                console.log('检测到广告，隐藏');
                tweet.classList.add('chinese-filter-processed');
                hideElement(tweet, 'ad');
                return;
            }
            
            // 检查是否包含中文
            if (containsChinese(tweetText)) {
                console.log('检测到中文帖子，隐藏:', tweetText.substring(0, 30));
                tweet.classList.add('chinese-filter-processed');
                hideElement(tweet, 'chinese');
                return;
            } else {
                console.log('不包含中文，保留');
                tweet.classList.add('chinese-filter-processed');
            }
        });
    }

    // 创建观察者来监控DOM变化
    function createObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查是否有新的推文内容
                            if (node.matches && (
                                node.matches('article') ||
                                node.matches('[data-testid="tweet"]') ||
                                node.querySelector('article') ||
                                node.querySelector('[data-testid="tweet"]')
                            )) {
                                shouldProcess = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldProcess) {
                // 延迟处理以确保DOM稳定
                setTimeout(processTweets, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        return observer;
    }

    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'updateSettings':
                CONFIG.enableVisualEffects = message.visualEffects;
                chrome.storage.sync.set({
                    [STORAGE_KEYS.VISUAL_EFFECTS]: message.visualEffects
                });
                sendResponse({ success: true });
                break;
                
            case 'refresh':
                processTweets();
                sendResponse({ success: true });
                break;
                
            case 'reset':
                CONFIG.hiddenCount = 0;
                CONFIG.adCount = 0;
                saveStats();
                // 移除所有隐藏标记
                document.querySelectorAll('.chinese-filter-processed').forEach(el => {
                    el.classList.remove('chinese-filter-processed', 'chinese-filter-hidden', 'chinese-filter-removing');
                });
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false });
        }
        return true; // 保持消息通道开启
    });

    // 初始化
    async function init() {
        console.log('X中文帖子过滤器已启动');
        
        // 加载设置
        await loadSettings();
        
        // 创建样式
        createStyles();
        
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    processTweets();
                    createObserver();
                }, 1000);
            });
        } else {
            setTimeout(() => {
                processTweets();
                createObserver();
            }, 1000);
        }
        
        // 显示启动通知
        setTimeout(() => {
            showNotification('🚀 X中文帖子过滤器已启动');
        }, 1500);
        
        // 定期检查（防止遗漏）
        setInterval(processTweets, 3000);
        
        // 定期更新活动时间
        setInterval(() => {
            chrome.storage.sync.set({
                [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
            });
        }, 5000);
    }

    // 启动插件
    init();

})(); 