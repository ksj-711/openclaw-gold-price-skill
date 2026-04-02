#!/usr/bin/env node
/**
 * 黄金T+D价格预警
 * 价格低于或高于设定阈值时提醒
 * 每天只提醒一次（通过状态文件控制）
 * 只在需要预警时才推送消息
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'alert-state.json');

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
    alert: {
      enabled: true,
      intervalMinutes: 10,
      lowThreshold: 950,
      highThreshold: 1150,
      oncePerDay: true
    },
    push: {
      targets: []
    }
  };
}

const config = loadConfig();

// 确保数据目录存在
function ensureStateDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取状态
function readState() {
  ensureStateDir();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // 忽略读取错误
  }
  return {};
}

// 保存状态
function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// 获取今天的日期字符串
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// 检查今天是否已经提醒过
function hasAlertedToday(alertType) {
  const state = readState();
  const today = getTodayStr();
  return state[today] && state[today][alertType] === true;
}

// 标记今天已提醒
function markAlerted(alertType) {
  const state = readState();
  const today = getTodayStr();
  if (!state[today]) {
    state[today] = {};
  }
  state[today][alertType] = true;
  
  // 清理旧数据（保留最近7天）
  const dates = Object.keys(state).sort();
  if (dates.length > 7) {
    const toDelete = dates.slice(0, dates.length - 7);
    toDelete.forEach(d => delete state[d]);
  }
  
  saveState(state);
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

// 格式化预警消息
function formatAlertMessage(priceData, alertType) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const priceName = config.priceName || '黄金T+D';
  const priceUnit = config.priceUnit || '元/克';
  const lowThreshold = config.alert.lowThreshold || 950;
  const highThreshold = config.alert.highThreshold || 1150;
  
  let output = `🚨 ${priceName} 价格预警\n`;
  output += `⏰ 触发时间: ${timeStr}\n`;
  output += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  const changeStr = priceData.change >= 0 ? `+${priceData.change.toFixed(2)}` : `${priceData.change.toFixed(2)}`;
  const percentStr = `${priceData.changePercent.toFixed(2)}%`;
  const trend = priceData.change >= 0 ? '📈' : '📉';
  
  output += `💰 当前价格: ${priceData.price.toFixed(2)} ${priceUnit}\n`;
  output += `📊 涨跌: ${changeStr} (${percentStr}) ${trend}\n`;
  output += `📈 最高: ${priceData.high.toFixed(2)} ${priceUnit}\n`;
  output += `📉 最低: ${priceData.low.toFixed(2)} ${priceUnit}\n\n`;
  
  if (alertType === 'low') {
    output += `📉 价格已低于 ${lowThreshold} ${priceUnit}\n`;
    output += `💡 建议: 可以考虑买入了！\n`;
  } else if (alertType === 'high') {
    output += `📈 价格已高于 ${highThreshold} ${priceUnit}\n`;
    output += `💡 建议: 可以考虑卖出了！\n`;
  }
  
  output += `\n数据来源: 金投网 www.cngold.org`;
  
  return output;
}

// 推送到所有目标
async function pushAlert(message) {
  const targets = config.push.targets || [];
  
  for (const target of targets) {
    if (!target.enabled) continue;
    
    try {
      const accountArg = target.account ? `--account ${target.account} ` : '';
      const cmd = `openclaw message send --channel ${target.channel} ${accountArg}--to "${target.to}" --message "${message.replace(/"/g, '\\"')}"`;
      
      await new Promise((resolve) => {
        exec(cmd, { timeout: 30000 }, (error) => {
          if (error) {
            console.error(`推送到 ${target.name || target.to} 失败:`, error.message);
          }
          resolve();
        });
      });
    } catch (e) {
      console.error(`推送到 ${target.name || target.to} 失败:`, e.message);
    }
  }
}

// 主函数
async function main() {
  // 检查是否启用
  if (!config.alert.enabled) {
    process.exit(0);
  }
  
  try {
    const apiData = await fetchFromApi();
    const priceData = parsePrice(apiData);
    
    if (!priceData) {
      process.exit(1);
    }
    
    const lowThreshold = config.alert.lowThreshold || 950;
    const highThreshold = config.alert.highThreshold || 1150;
    const oncePerDay = config.alert.oncePerDay !== false;
    
    // 检查是否需要触发预警
    let shouldAlert = false;
    let alertType = null;
    
    if (priceData.price < lowThreshold) {
      if (!oncePerDay || !hasAlertedToday('low')) {
        shouldAlert = true;
        alertType = 'low';
      }
    } else if (priceData.price > highThreshold) {
      if (!oncePerDay || !hasAlertedToday('high')) {
        shouldAlert = true;
        alertType = 'high';
      }
    }
    
    if (shouldAlert) {
      const message = formatAlertMessage(priceData, alertType);
      
      // 输出到控制台（用于调试）
      console.log(message);
      
      // 推送到所有目标
      await pushAlert(message);
      
      if (oncePerDay) {
        markAlerted(alertType);
      }
    }
    
    // 静默退出（无论是否触发预警）
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    process.exit(1);
  }
}

main();
