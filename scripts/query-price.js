#!/usr/bin/env node
/**
 * 黄金T+D价格查询工具
 * 支持查询实时价格和历史记录
 * 
 * 用法:
 *   node query-price.js              # 查询实时价格
 *   node query-price.js --today      # 查询今天的所有记录
 *   node query-price.js --date 2026-04-01  # 查询指定日期的记录
 *   node query-price.js --days 7     # 查询最近7天的记录
 *   node query-price.js --latest 10  # 查询最近10条记录
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PRICE_CODE = 'JO_9753';
const PRICE_NAME = '黄金T+D';
const PRICE_UNIT = '元/克';
const DATA_DIR = path.join(__dirname, '..', 'data');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    realtime: true,
    today: false,
    date: null,
    days: null,
    latest: null
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--today':
        options.realtime = false;
        options.today = true;
        break;
      case '--date':
        options.realtime = false;
        options.date = args[++i];
        break;
      case '--days':
        options.realtime = false;
        options.days = parseInt(args[++i]);
        break;
      case '--latest':
        options.realtime = false;
        options.latest = parseInt(args[++i]);
        break;
      case '--trend':
        options.realtime = false;
        options.trend = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
黄金T+D价格查询工具

用法:
  node query-price.js              查询实时价格
  node query-price.js --today      查询今天的所有记录
  node query-price.js --date 2026-04-01  查询指定日期的记录
  node query-price.js --days 7     查询最近7天的记录
  node query-price.js --latest 10  查询最近10条记录
  node query-price.js --trend      以图表形式显示趋势
  node query-price.js --help       显示帮助

示例:
  node query-price.js                    # 获取实时价格
  node query-price.js --date 2026-04-01  # 查询4月1日的记录
  node query-price.js --days 3           # 查询最近3天的记录
  node query-price.js --trend --days 7   # 查看最近7天趋势图
`);
}

// 从API获取实时数据
function fetchRealtimePrice() {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const path = `/history/quotejs.htm?codes=${PRICE_CODE}&currentPage=1&pageSize=1&_=${timestamp}`;
    
    const options = {
      hostname: 'api.jijinhao.com',
      port: 443,
      path: path,
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
            const parsed = JSON.parse(match[1]);
            if (parsed && parsed.length > 0 && parsed[0].data && parsed[0].data.length > 0) {
              const quote = parsed[0].data[0].quote;
              resolve({
                price: parseFloat(quote.q63),
                change: parseFloat(quote.q70),
                changePercent: parseFloat(quote.q80),
                open: parseFloat(quote.q1),
                high: parseFloat(quote.q3),
                low: parseFloat(quote.q4),
                time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
              });
            } else {
              reject(new Error('数据格式错误'));
            }
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

// 格式化实时价格输出
function formatRealtime(priceData) {
  let output = `\n📊 ${PRICE_NAME} 实时价格\n`;
  output += `⏰ 查询时间: ${priceData.time}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  const changeStr = priceData.change >= 0 ? `+${priceData.change.toFixed(2)}` : `${priceData.change.toFixed(2)}`;
  const percentStr = `${priceData.changePercent.toFixed(2)}%`;
  const trend = priceData.change >= 0 ? '📈' : '📉';
  
  output += `💰 当前价格: ${priceData.price.toFixed(2)} ${PRICE_UNIT}\n`;
  output += `📊 涨跌: ${changeStr} (${percentStr}) ${trend}\n`;
  output += `📈 最高: ${priceData.high.toFixed(2)} ${PRICE_UNIT}\n`;
  output += `📉 最低: ${priceData.low.toFixed(2)} ${PRICE_UNIT}\n`;
  output += `🕐 开盘: ${priceData.open.toFixed(2)} ${PRICE_UNIT}\n\n`;
  output += `数据来源: 金投网 www.cngold.org`;
  
  return output;
}

// 读取历史记录
function readHistory(dateFilter = null, daysFilter = null, latestFilter = null) {
  const records = [];
  
  if (!fs.existsSync(DATA_DIR)) {
    return records;
  }
  
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('gold-td-history-') && f.endsWith('.csv'));
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(1); // 跳过表头
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(',');
      if (parts.length >= 5) {
        const record = {
          timestamp: parts[0],
          date: parts[1],
          time: parts[2],
          price: parseFloat(parts[3]),
          change: parts[4] ? parseFloat(parts[4]) : null,
          changePercent: parts[5] ? parseFloat(parts[5]) : null,
          open: parts[6] ? parseFloat(parts[6]) : null,
          high: parts[7] ? parseFloat(parts[7]) : null,
          low: parts[8] ? parseFloat(parts[8]) : null
        };
        records.push(record);
      }
    }
  }
  
  // 按时间排序（最新的在前）
  records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // 应用过滤器
  if (dateFilter) {
    return records.filter(r => r.date === dateFilter);
  }
  
  if (daysFilter) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysFilter);
    return records.filter(r => new Date(r.timestamp) >= cutoff);
  }
  
  if (latestFilter) {
    return records.slice(0, latestFilter);
  }
  
  return records;
}

// 格式化历史记录输出
function formatHistory(records, title) {
  if (records.length === 0) {
    return '\n📭 没有找到历史记录\n';
  }
  
  let output = `\n📊 ${PRICE_NAME} ${title}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n`;
  output += `共 ${records.length} 条记录\n\n`;
  
  // 显示统计信息
  const prices = records.map(r => r.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  
  output += `📈 统计信息:\n`;
  output += `   最高: ${maxPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  output += `   最低: ${minPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  output += `   平均: ${avgPrice.toFixed(2)} ${PRICE_UNIT}\n\n`;
  
  // 显示最近的几条记录
  output += `📋 详细记录 (最近10条):\n`;
  output += `时间                  价格        涨跌\n`;
  output += `─────────────────────────────────────\n`;
  
  records.slice(0, 10).forEach(r => {
    const changeStr = r.change !== null 
      ? (r.change >= 0 ? `+${r.change.toFixed(2)}` : `${r.change.toFixed(2)}`)
      : '--';
    output += `${r.date} ${r.time}  ${r.price.toFixed(2)}  ${changeStr}\n`;
  });
  
  if (records.length > 10) {
    output += `\n... 还有 ${records.length - 10} 条记录 ...\n`;
  }
  
  return output;
}

// 主函数
async function main() {
  const options = parseArgs();
  
  try {
    if (options.realtime) {
      // 查询实时价格
      const priceData = await fetchRealtimePrice();
      console.log(formatRealtime(priceData));
    } else if (options.today) {
      // 查询今天的记录
      const today = new Date().toISOString().split('T')[0];
      const records = readHistory(today);
      console.log(formatHistory(records, `今日记录 (${today})`));
    } else if (options.date) {
      // 查询指定日期
      const records = readHistory(options.date);
      console.log(formatHistory(records, `${options.date} 的记录`));
    } else if (options.days) {
      // 查询最近N天
      const records = readHistory(null, options.days);
      console.log(formatHistory(records, `最近 ${options.days} 天的记录`));
    } else if (options.latest) {
      // 查询最近N条
      const records = readHistory(null, null, options.latest);
      console.log(formatHistory(records, `最近 ${options.latest} 条记录`));
    }
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

main();