#!/usr/bin/env node
/**
 * 黄金T+D历史记录
 * 每半小时记录一次价格，保存到CSV文件
 * 价格与上次相同时不记录（避免停市时段重复数据）
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LAST_PRICE_FILE = path.join(DATA_DIR, 'last-price.json');

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
    history: {
      enabled: true,
      intervalMinutes: 30,
      recordOnChangeOnly: true,
      priceChangeThreshold: 0.01
    }
  };
}

const config = loadConfig();

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 获取当前年月
function getYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 获取CSV文件路径
function getCsvFilePath() {
  const yearMonth = getYearMonth();
  return path.join(DATA_DIR, `gold-td-history-${yearMonth}.csv`);
}

// 读取上次记录的价格
function readLastPrice() {
  try {
    if (fs.existsSync(LAST_PRICE_FILE)) {
      const data = fs.readFileSync(LAST_PRICE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // 忽略错误
  }
  return null;
}

// 保存上次记录的价格
function saveLastPrice(priceData) {
  const data = {
    price: priceData.price,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(LAST_PRICE_FILE, JSON.stringify(data, null, 2));
}

// 检查价格是否变化
function hasPriceChanged(newPrice, lastPrice) {
  if (!lastPrice) return true;
  const threshold = config.history.priceChangeThreshold || 0.01;
  return Math.abs(newPrice - lastPrice.price) > threshold;
}

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

// 初始化CSV文件（如果不存在）
function initCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    const header = 'timestamp,date,time,price,change,change_percent,open,high,low\n';
    fs.writeFileSync(filePath, header, 'utf8');
  }
}

// 追加记录到CSV
function appendToCsv(filePath, priceData) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const timestamp = now.toISOString();
  
  const changeStr = priceData.change !== null ? priceData.change.toFixed(2) : '';
  const changePercentStr = priceData.changePercent !== null ? priceData.changePercent.toFixed(2) : '';
  const openStr = priceData.open !== null ? priceData.open.toFixed(2) : '';
  const highStr = priceData.high !== null ? priceData.high.toFixed(2) : '';
  const lowStr = priceData.low !== null ? priceData.low.toFixed(2) : '';
  
  const line = `${timestamp},${dateStr},${timeStr},${priceData.price.toFixed(2)},${changeStr},${changePercentStr},${openStr},${highStr},${lowStr}\n`;
  
  fs.appendFileSync(filePath, line, 'utf8');
}

// 格式化输出
function formatOutput(priceData, filePath, isNewRecord) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const priceName = config.priceName || '黄金T+D';
  const priceUnit = config.priceUnit || '元/克';
  
  if (!isNewRecord) {
    // 价格未变化，静默处理
    return null;
  }
  
  let output = `\n📝 ${priceName} 历史记录已保存\n`;
  output += `⏰ 记录时间: ${timeStr}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  const changeStr = priceData.change >= 0 ? `+${priceData.change.toFixed(2)}` : `${priceData.change.toFixed(2)}`;
  output += `💰 价格: ${priceData.price.toFixed(2)} ${priceUnit} (${changeStr})\n`;
  output += `📁 保存位置: ${filePath}\n`;
  
  return output;
}

// 主函数
async function main() {
  // 检查是否启用
  if (!config.history.enabled) {
    console.log('历史记录功能已关闭');
    process.exit(0);
  }
  
  try {
    ensureDataDir();
    
    const apiData = await fetchFromApi();
    const priceData = parsePrice(apiData);
    
    if (!priceData) {
      console.error('⚠️ 未能获取到价格数据');
      process.exit(1);
    }
    
    // 检查价格是否变化
    const lastPrice = readLastPrice();
    const recordOnChangeOnly = config.history.recordOnChangeOnly !== false;
    const isNewRecord = !recordOnChangeOnly || hasPriceChanged(priceData.price, lastPrice);
    
    if (isNewRecord) {
      const csvFile = getCsvFilePath();
      initCsvFile(csvFile);
      appendToCsv(csvFile, priceData);
      saveLastPrice(priceData);
      
      const output = formatOutput(priceData, csvFile, true);
      if (output) {
        console.log(output);
      }
    } else {
      // 价格未变化，静默退出
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ 记录失败:', error.message);
    process.exit(1);
  }
}

main();
