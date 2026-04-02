#!/usr/bin/env node
/**
 * 黄金T+D价格趋势查询
 * 以图表形式展示价格走势
 * 
 * 用法:
 *   node query-price-trend.js              # 今天的趋势
 *   node query-price-trend.js --days 7     # 最近7天趋势
 *   node query-price-trend.js --date 2026-04-01  # 指定日期趋势
 */

const fs = require('fs');
const path = require('path');

const PRICE_NAME = '黄金T+D';
const PRICE_UNIT = '元/克';
const DATA_DIR = path.join(__dirname, '..', 'data');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    today: true,
    date: null,
    days: null
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--date':
        options.today = false;
        options.date = args[++i];
        break;
      case '--days':
        options.today = false;
        options.days = parseInt(args[++i]);
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
黄金T+D价格趋势查询

用法:
  node query-price-trend.js              今天的趋势
  node query-price-trend.js --days 7     最近7天趋势
  node query-price-trend.js --date 2026-04-01  指定日期趋势

示例:
  node query-price-trend.js                    # 今天的价格走势
  node query-price-trend.js --days 3           # 最近3天走势
`);
}

// 读取历史记录
function readHistory(dateFilter = null, daysFilter = null) {
  const records = [];
  
  if (!fs.existsSync(DATA_DIR)) {
    return records;
  }
  
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('gold-td-history-') && f.endsWith('.csv'));
  
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(1);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(',');
      if (parts.length >= 5) {
        const record = {
          timestamp: parts[0],
          date: parts[1],
          time: parts[2].substring(0, 5), // 只取 HH:MM
          price: parseFloat(parts[3]),
          change: parts[4] ? parseFloat(parts[4]) : null,
          changePercent: parts[5] ? parseFloat(parts[5]) : null
        };
        records.push(record);
      }
    }
  }
  
  // 按时间排序
  records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // 应用过滤器
  if (dateFilter) {
    return records.filter(r => r.date === dateFilter);
  }
  
  if (daysFilter) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysFilter);
    return records.filter(r => new Date(r.timestamp) >= cutoff);
  }
  
  return records;
}

// 生成ASCII趋势图
function generateTrendChart(records) {
  if (records.length === 0) {
    return '暂无数据';
  }
  
  const prices = records.map(r => r.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // 图表高度
  const chartHeight = 10;
  const chartWidth = Math.min(records.length, 40); // 最多显示40个点
  
  // 如果记录太多，进行采样
  let displayRecords = records;
  if (records.length > chartWidth) {
    const step = Math.floor(records.length / chartWidth);
    displayRecords = [];
    for (let i = 0; i < records.length; i += step) {
      displayRecords.push(records[i]);
    }
    displayRecords.push(records[records.length - 1]); // 确保包含最后一个点
  }
  
  // 生成图表
  let chart = '';
  
  // 标题
  chart += `\n📊 ${PRICE_NAME} 价格走势图\n`;
  chart += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // 统计信息
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const startPrice = records[0].price;
  const endPrice = records[records.length - 1].price;
  const totalChange = endPrice - startPrice;
  const totalChangePercent = (totalChange / startPrice) * 100;
  
  chart += `📈 统计:\n`;
  chart += `   起始: ${startPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  chart += `   结束: ${endPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  chart += `   最高: ${maxPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  chart += `   最低: ${minPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  chart += `   平均: ${avgPrice.toFixed(2)} ${PRICE_UNIT}\n`;
  chart += `   涨跌: ${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)} (${totalChangePercent >= 0 ? '+' : ''}${totalChangePercent.toFixed(2)}%)\n\n`;
  
  // 价格轴标签
  chart += `${maxPrice.toFixed(0)} ┤\n`;
  
  // 生成每一行
  for (let row = chartHeight - 1; row >= 0; row--) {
    const rowPrice = minPrice + (priceRange * row / chartHeight);
    let line = '     │';
    
    for (const record of displayRecords) {
      const normalizedPrice = (record.price - minPrice) / priceRange * chartHeight;
      if (Math.abs(normalizedPrice - row) < 0.5) {
        line += record.change >= 0 ? '●' : '○';
      } else if (normalizedPrice > row) {
        line += '│';
      } else {
        line += ' ';
      }
    }
    
    chart += line + '\n';
  }
  
  chart += `${minPrice.toFixed(0)} ┤`;
  chart += '─'.repeat(displayRecords.length) + '\n';
  chart += '     └' + '─'.repeat(displayRecords.length) + '> 时间\n\n';
  
  // 图例
  chart += `图例: ● 上涨  ○ 下跌\n`;
  chart += `数据点: ${records.length} 个\n`;
  
  return chart;
}

// 生成表格形式的历史记录
function generateTable(records) {
  if (records.length === 0) {
    return '';
  }
  
  let table = `\n📋 详细记录:\n`;
  table += `────────────────────────────────────────────\n`;
  table += `日期        时间    价格        涨跌        幅度\n`;
  table += `────────────────────────────────────────────\n`;
  
  // 显示最近20条，倒序
  const recentRecords = records.slice(-20).reverse();
  
  for (const r of recentRecords) {
    const changeStr = r.change !== null 
      ? (r.change >= 0 ? `+${r.change.toFixed(2)}` : `${r.change.toFixed(2)}`)
      : '----';
    const percentStr = r.changePercent !== null
      ? (r.changePercent >= 0 ? `+${r.changePercent.toFixed(2)}%` : `${r.changePercent.toFixed(2)}%`)
      : '----';
    table += `${r.date}  ${r.time}  ${r.price.toFixed(2).padStart(8)}  ${changeStr.padStart(8)}  ${percentStr.padStart(8)}\n`;
  }
  
  if (records.length > 20) {
    table += `\n... 还有 ${records.length - 20} 条记录 ...\n`;
  }
  
  return table;
}

// 主函数
function main() {
  const options = parseArgs();
  
  try {
    let records;
    let title;
    
    if (options.today) {
      const today = new Date().toISOString().split('T')[0];
      records = readHistory(today);
      title = `今日 (${today})`;
    } else if (options.date) {
      records = readHistory(options.date);
      title = `${options.date}`;
    } else if (options.days) {
      records = readHistory(null, options.days);
      title = `最近 ${options.days} 天`;
    }
    
    if (records.length === 0) {
      console.log(`\n📭 没有找到 ${title} 的历史记录\n`);
      return;
    }
    
    console.log(generateTrendChart(records));
    console.log(generateTable(records));
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }
}

main();
