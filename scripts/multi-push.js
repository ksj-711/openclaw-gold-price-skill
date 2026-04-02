#!/usr/bin/env node
/**
 * 多目标推送脚本
 * 支持推送到多个微信，失败不影响其他推送
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
  return null;
}

// 从API获取数据
function fetchFromApi(priceCode) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
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

// 格式化消息
function formatMessage(priceData, config) {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const priceName = config.priceName || '黄金T+D';
  const priceUnit = config.priceUnit || '元/克';
  
  let output = `📊 ${priceName} 定时推送\n`;
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

// 推送到单个目标
function pushToTarget(message, target) {
  return new Promise((resolve) => {
    if (!target.enabled) {
      resolve({ success: false, target: target.name, error: '已禁用' });
      return;
    }
    
    const accountArg = target.account ? `--account ${target.account} ` : '';
    const cmd = `openclaw message send --channel ${target.channel} ${accountArg}-t "${target.to}" -m "${message.replace(/"/g, '\\"')}"`;
    
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ 推送到 ${target.name} 失败:`, error.message);
        resolve({ success: false, target: target.name, error: error.message });
      } else {
        console.log(`✅ 推送到 ${target.name} 成功`);
        resolve({ success: true, target: target.name });
      }
    });
  });
}

// 主函数
async function main() {
  const config = loadConfig();
  if (!config) {
    console.error('❌ 无法加载配置文件');
    process.exit(1);
  }
  
  if (!config.push.enabled) {
    console.log('推送功能已关闭');
    process.exit(0);
  }
  
  if (!config.push.targets || config.push.targets.length === 0) {
    console.error('❌ 没有配置推送目标');
    process.exit(1);
  }
  
  try {
    // 获取价格数据
    const apiData = await fetchFromApi(config.priceCode);
    const priceData = parsePrice(apiData);
    
    if (!priceData) {
      console.error('⚠️ 未能获取到价格数据');
      process.exit(1);
    }
    
    // 格式化消息
    const message = formatMessage(priceData, config);
    
    // 并行推送到所有目标
    console.log(`\n📤 开始推送到 ${config.push.targets.length} 个目标...\n`);
    
    const results = await Promise.all(
      config.push.targets.map(target => pushToTarget(message, target))
    );
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    console.log(`\n📊 推送结果: ${successCount} 成功, ${failCount} 失败`);
    
    if (failCount > 0) {
      console.log('\n❌ 失败详情:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.target}: ${r.error}`);
      });
    }
    
    // 只要有成功的就返回0，全部失败才返回1
    process.exit(successCount > 0 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ 推送失败:', error.message);
    process.exit(1);
  }
}

main();
