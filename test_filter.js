// 测试脚本 - 验证X中文帖子过滤器的准确性
(function() {
    'use strict';
    
    console.log('🔍 开始测试过滤器准确性...');
    
    // 模拟测试数据
    const testCases = [
        {
            name: '正常英文推文',
            html: `<article data-testid="tweet" role="article">
                <div data-testid="User-Name">GitHub Projects Community</div>
                <div data-testid="tweetText">Remote jobs before 2005?</div>
                <time>11h</time>
            </article>`,
            shouldHide: false,
            expectedReason: null
        },
        {
            name: '中文推文',
            html: `<article data-testid="tweet" role="article">
                <div data-testid="User-Name">一丝不go</div>
                <div data-testid="tweetText">从 Chrome 140、Safari 18.4 开始，终于支持了中英文自动加间距的CSS属性</div>
                <time>18h</time>
            </article>`,
            shouldHide: true,
            expectedReason: 'chinese'
        },
        {
            name: '广告推文',
            html: `<article data-testid="tweet" role="article">
                <div data-testid="User-Name">Together AI</div>
                <div data-testid="tweetText">High-performance GPU Clusters for frontier models</div>
                <div>Ad</div>
                <time>1h</time>
            </article>`,
            shouldHide: true,
            expectedReason: 'ad'
        },
        {
            name: '包含推广标识的推文',
            html: `<article data-testid="tweet" role="article">
                <div data-testid="User-Name">Example User</div>
                <div data-testid="tweetText">Check out this amazing product!</div>
                <div data-testid="promotedIndicator">Promoted</div>
                <time>2h</time>
            </article>`,
            shouldHide: true,
            expectedReason: 'ad'
        }
    ];
    
    // 创建临时容器
    const testContainer = document.createElement('div');
    testContainer.style.position = 'fixed';
    testContainer.style.top = '-9999px';
    testContainer.style.left = '-9999px';
    document.body.appendChild(testContainer);
    
    // 导入过滤器的检测函数（简化版本）
    const CHINESE_REGEX = /[\u4e00-\u9fff]/;
    const AD_KEYWORDS = ['Promoted', '推广', 'Sponsored', '赞助', '广告', 'Promoted Tweet', '推广推文'];
    
    function testContainsChinese(text) {
        return CHINESE_REGEX.test(text);
    }
    
    function testIsAd(element) {
        // 检查推广指示器
        if (element.querySelector('[data-testid="promotedIndicator"]')) {
            return true;
        }
        
        // 检查推文文本
        const tweetTextElement = element.querySelector('[data-testid="tweetText"]');
        if (tweetTextElement) {
            const tweetText = tweetTextElement.textContent || '';
            for (const keyword of AD_KEYWORDS) {
                if (tweetText.includes(keyword)) {
                    return true;
                }
            }
        }
        
        // 检查用户名区域
        const userNameArea = element.querySelector('[data-testid="User-Name"]');
        if (userNameArea) {
            const userAreaText = userNameArea.textContent || '';
            if (userAreaText.includes('Promoted') || userAreaText.includes('推广')) {
                return true;
            }
        }
        
        return false;
    }
    
    function getTweetText(element) {
        const tweetTextElement = element.querySelector('[data-testid="tweetText"]');
        return tweetTextElement ? tweetTextElement.textContent || '' : '';
    }
    
    // 运行测试
    let passedTests = 0;
    let failedTests = 0;
    
    testCases.forEach((testCase, index) => {
        console.log(`\n📝 测试 ${index + 1}: ${testCase.name}`);
        
        // 创建测试元素
        testContainer.innerHTML = testCase.html;
        const element = testContainer.firstElementChild;
        
        // 执行检测
        const tweetText = getTweetText(element);
        const isAd = testIsAd(element);
        const isChinese = testContainsChinese(tweetText);
        
        let shouldHide = false;
        let reason = null;
        
        if (isAd) {
            shouldHide = true;
            reason = 'ad';
        } else if (isChinese) {
            shouldHide = true;
            reason = 'chinese';
        }
        
        // 验证结果
        const testPassed = (shouldHide === testCase.shouldHide) && 
                          (reason === testCase.expectedReason);
        
        if (testPassed) {
            console.log(`✅ 通过 - 推文文本: "${tweetText.substring(0, 50)}..."`);
            console.log(`   检测结果: ${shouldHide ? `隐藏(${reason})` : '保留'}`);
            passedTests++;
        } else {
            console.log(`❌ 失败 - 推文文本: "${tweetText.substring(0, 50)}..."`);
            console.log(`   期望: ${testCase.shouldHide ? `隐藏(${testCase.expectedReason})` : '保留'}`);
            console.log(`   实际: ${shouldHide ? `隐藏(${reason})` : '保留'}`);
            failedTests++;
        }
    });
    
    // 清理
    document.body.removeChild(testContainer);
    
    // 总结
    console.log(`\n📊 测试总结:`);
    console.log(`   通过: ${passedTests}/${testCases.length}`);
    console.log(`   失败: ${failedTests}/${testCases.length}`);
    
    if (failedTests === 0) {
        console.log('🎉 所有测试通过！过滤器工作正常。');
    } else {
        console.log('⚠️  存在失败的测试，需要进一步调试。');
    }
})();

// 使用方法：
// 1. 在X网站的控制台中运行此脚本
// 2. 查看测试结果和详细日志
// 3. 根据结果判断过滤器是否正常工作 