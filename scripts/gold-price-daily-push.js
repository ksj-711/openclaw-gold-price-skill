#!/usr/bin/env node
/**
 * 黄金T+D每日定时推送
 * 每天指定时间推送实时价格
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取配置文件失败:', e.message);
  }
  // 默认配置
  return {
    priceCode: 'JO_9753',
    priceName: '黄金T+D',
    priceUnit: '元/克',
    push: {
      enabled: true,
      times: ['10:00', '17:00']
    }
  };
}

const config = loadConfig();

// 从API获取数据
function fetchFromApi() {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const priceCode = config.priceCode || 'JO_9753';
    const apiPath = `/history/quotejs.htm?codes=${priceCode}&currentPage=1&pageSize=1&_=${timestamp}`;
    
    const options = {
      hostname: 'api.jijinhao.com',
      port: 443,
      path: apiPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.cngold.org',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const match = data.match(/var quot_str = (.+);?$/);
          if (match) {
            const jsonStr = match[1];
            const parsed = JSON.parse(jsonStr);
            resolve(parsed);
          } else {
            reject(new Error('无法解析数据'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// 解析价格数据
function parsePrice(apiData) {
  if (apiData && apiData.length > 0 && apiData[0].data && apiData[0].data.length > 0) {
    const quote = apiData[0].data[0].quote;
    return {
      price: parseFloat(quote.q63),
      change: parseFloat(quote.q70),
      changePercent: parseFloat(quote.q80),
      open: parseFloat(quote.q1),
      high: parseFloat(quote.q3),
      low: parseFloat(quote.q4),
      time: quote.q59
    };
  }
  return null;
}

// 格式化输出
function formatOutput(priceData) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const priceName = config.priceName || '黄金T+D';
  const priceUnit = config.priceUnit || '元/克';
  
  let output = `\n📊 ${priceName} 定时推送\n`;
  output += `⏰ 更新时间: ${timeStr}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  const changeStr = priceData.change >= 0 ? `+${priceData.change.toFixed(2)}` : `${priceData.change.toFixed(2)}`;
  const percentStr = `${priceData.changePercent.toFixed(2)}%`;
  const trend = priceData.change >= 0 ? '📈' : '📉';
  
  output += `💰 ${priceName}: ${priceData.price.toFixed(2)} ${priceUnit}\n`;
  output += `📊 涨跌: ${changeStr} (${percentStr}) ${trend}\n`;
  output += `📈 最高: ${priceData.high.toFixed(2)} ${priceUnit}\n`;
  output += `📉 最低: ${priceData.low.toFixed(2)} ${priceUnit}\n`;
  output += `🕐 开盘: ${priceData.open.toFixed(2)} ${priceUnit}\n\n`;
  output += `数据来源: 金投网 www.cngold.org`;
  
  return output;
}

// 主函数
async function main() {
  // 检查是否启用
  if (!config.push.enabled) {
    console.log('定时推送功能已关闭');
    process.exit(0);
  }
  
  try {
    const apiData = await fetchFromApi();
    const priceData = parsePrice(apiData);
    
    if (!priceData) {
      console.error('⚠️ 未能获取到价格数据');
      process.exit(1);
    }
    
    console.log(formatOutput(priceData));
  } catch (error) {
    console.error('❌ 获取失败:', error.message);
    process.exit(1);
  }
}

main();
