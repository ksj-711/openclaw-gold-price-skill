#!/usr/bin/env node
/**
 * 金投网黄金价格抓取脚本
 * 从 api.jijinhao.com 获取实时黄金、白银价格
 */

const https = require('https');

// 价格代码映射
const PRICE_CODES = {
  'JO_9753': { name: '黄金T+D', unit: '元/克', category: '国内黄金' },
  'JO_92233': { name: '现货黄金', unit: '美元/盎司', category: '国际黄金' },
  'JO_42757': { name: '纸黄金(美元)', unit: '美元/盎司', category: '国际黄金' },
  'JO_9754': { name: '白银T+D', unit: '元/千克', category: '白银' },
  'JO_92232': { name: '现货白银', unit: '美元/盎司', category: '白银' },
  'JO_42758': { name: '纸白银(美元)', unit: '美元/盎司', category: '白银' },
};

// 从API获取数据
function fetchFromApi(codes) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const path = `/history/quotejs.htm?codes=${codes}&currentPage=1&pageSize=10&_=${timestamp}`;
    
    const options = {
      hostname: 'api.jijinhao.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
          // 解析 JavaScript 变量 quot_str
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
function parsePrices(apiData) {
  const prices = {};
  
  if (apiData && apiData.length > 0 && apiData[0].data) {
    const data = apiData[0].data;
    
    for (const item of data) {
      if (item.quote && item.quote.q124) {
        const code = item.quote.q124;
        const price = item.quote.q63; // 最新价
        const change = item.quote.q70; // 涨跌额
        const changePercent = item.quote.q80; // 涨跌幅
        const open = item.quote.q1; // 开盘价
        const high = item.quote.q3; // 最高价
        const low = item.quote.q4; // 最低价
        const time = item.quote.q59; // 时间
        
        prices[code] = {
          price: price,
          change: change,
          changePercent: changePercent,
          open: open,
          high: high,
          low: low,
          time: time
        };
      }
    }
  }
  
  return prices;
}

// 格式化输出
function formatOutput(prices) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  
  let output = `\n📊 金投网黄金价格行情\n`;
  output += `⏰ 更新时间: ${timeStr}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 国内黄金
  output += `🇨🇳 国内黄金\n`;
  if (prices['JO_9753']) {
    const item = PRICE_CODES['JO_9753'];
    const p = prices['JO_9753'];
    const changeStr = p.change ? ` (${p.change >= 0 ? '+' : ''}${p.change})` : '';
    const percentStr = p.changePercent ? ` ${p.changePercent}%` : '';
    const trend = p.change ? (p.change >= 0 ? '📈' : '📉') : '';
    output += `  ${item.name}: ${p.price} ${item.unit}${changeStr}${percentStr} ${trend}\n`;
  }
  
  output += `\n`;
  
  // 国际黄金
  output += `🌍 国际黄金\n`;
  if (prices['JO_92233']) {
    const item = PRICE_CODES['JO_92233'];
    const p = prices['JO_92233'];
    const changeStr = p.change ? ` (${p.change >= 0 ? '+' : ''}${p.change})` : '';
    const percentStr = p.changePercent ? ` ${p.changePercent}%` : '';
    const trend = p.change ? (p.change >= 0 ? '📈' : '📉') : '';
    output += `  ${item.name}: ${p.price} ${item.unit}${changeStr}${percentStr} ${trend}\n`;
  }
  if (prices['JO_42757']) {
    const item = PRICE_CODES['JO_42757'];
    const p = prices['JO_42757'];
    output += `  ${item.name}: ${p.price} ${item.unit}\n`;
  }
  
  output += `\n`;
  
  // 白银
  output += `🥈 白银价格\n`;
  if (prices['JO_9754']) {
    const item = PRICE_CODES['JO_9754'];
    const p = prices['JO_9754'];
    const changeStr = p.change ? ` (${p.change >= 0 ? '+' : ''}${p.change})` : '';
    const percentStr = p.changePercent ? ` ${p.changePercent}%` : '';
    const trend = p.change ? (p.change >= 0 ? '📈' : '📉') : '';
    output += `  ${item.name}: ${p.price} ${item.unit}${changeStr}${percentStr} ${trend}\n`;
  }
  if (prices['JO_92232']) {
    const item = PRICE_CODES['JO_92232'];
    const p = prices['JO_92232'];
    output += `  ${item.name}: ${p.price} ${item.unit}\n`;
  }
  if (prices['JO_42758']) {
    const item = PRICE_CODES['JO_42758'];
    const p = prices['JO_42758'];
    output += `  ${item.name}: ${p.price} ${item.unit}\n`;
  }
  
  output += `\n`;
  output += `数据来源: 金投网 www.cngold.org\n`;
  
  return output;
}

// 主函数
async function main() {
  try {
    const codes = 'JO_9753,JO_9754,JO_42757,JO_42758,JO_92233,JO_92232';
    const apiData = await fetchFromApi(codes);
    const prices = parsePrices(apiData);
    
    if (Object.keys(prices).length === 0) {
      console.log('⚠️ 未能获取到价格数据');
      process.exit(1);
    }
    
    console.log(formatOutput(prices));
  } catch (error) {
    console.error('❌ 获取失败:', error.message);
    process.exit(1);
  }
}

main();
