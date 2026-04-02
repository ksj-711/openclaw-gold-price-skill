#!/usr/bin/env node
/**
 * 黄金T+D配置管理工具
 * 用于查看和修改配置
 * 
 * 用法:
 *   node config-manager.js                    # 显示当前配置
 *   node config-manager.js --show             # 显示当前配置
 *   node config-manager.js --set-history 60   # 设置历史记录间隔为60分钟
 *   node config-manager.js --set-alert 5      # 设置预警检查间隔为5分钟
 *   node config-manager.js --set-low 900      # 设置低价预警阈值为900
 *   node config-manager.js --set-high 1200    # 设置高价预警阈值为1200
 *   node config-manager.js --set-push "9:00,15:00,21:00"  # 设置推送时间
 *   node config-manager.js --toggle-history   # 开启/关闭历史记录
 *   node config-manager.js --toggle-alert     # 开启/关闭预警
 *   node config-manager.js --toggle-push      # 开启/关闭推送
 *   node config-manager.js --reset            # 重置为默认配置
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
  name: "黄金T+D价格监控",
  version: "1.0.0",
  priceCode: "JO_9753",
  priceName: "黄金T+D",
  priceUnit: "元/克",
  history: {
    enabled: true,
    intervalMinutes: 30,
    recordOnChangeOnly: true,
    priceChangeThreshold: 0.01
  },
  alert: {
    enabled: true,
    intervalMinutes: 10,
    lowThreshold: 950,
    highThreshold: 1150,
    oncePerDay: true
  },
  push: {
    enabled: true,
    times: ["10:00", "17:00"]
  },
  dataRetentionDays: 30
};

// 读取配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('读取配置文件失败:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('保存配置文件失败:', e.message);
    return false;
  }
}

// 显示配置
function showConfig(config) {
  let output = '\n📊 黄金T+D价格监控配置\n';
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  output += `📌 基本信息:\n`;
  output += `   名称: ${config.name}\n`;
  output += `   版本: ${config.version}\n`;
  output += `   价格代码: ${config.priceCode}\n`;
  output += `   价格名称: ${config.priceName}\n`;
  output += `   价格单位: ${config.priceUnit}\n\n`;
  
  output += `📝 历史记录配置:\n`;
  output += `   状态: ${config.history.enabled ? '✅ 开启' : '❌ 关闭'}\n`;
  output += `   记录间隔: ${config.history.intervalMinutes} 分钟\n`;
  output += `   仅记录变化: ${config.history.recordOnChangeOnly ? '是' : '否'}\n`;
  output += `   价格变化阈值: ${config.history.priceChangeThreshold} 元\n\n`;
  
  output += `🚨 预警配置:\n`;
  output += `   状态: ${config.alert.enabled ? '✅ 开启' : '❌ 关闭'}\n`;
  output += `   检查间隔: ${config.alert.intervalMinutes} 分钟\n`;
  output += `   低价预警: ${config.alert.lowThreshold} 元/克\n`;
  output += `   高价预警: ${config.alert.highThreshold} 元/克\n`;
  output += `   每日只提醒一次: ${config.alert.oncePerDay ? '是' : '否'}\n\n`;
  
  output += `📅 定时推送配置:\n`;
  output += `   状态: ${config.push.enabled ? '✅ 开启' : '❌ 关闭'}\n`;
  output += `   推送时间: ${config.push.times.join(', ')}\n\n`;
  
  output += `🗑️ 数据保留: ${config.dataRetentionDays} 天\n\n`;
  
  output += `📁 配置文件: ${CONFIG_FILE}\n`;
  
  return output;
}

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    show: false,
    setHistory: null,
    setAlert: null,
    setLow: null,
    setHigh: null,
    setPush: null,
    toggleHistory: false,
    toggleAlert: false,
    togglePush: false,
    reset: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--show':
        options.show = true;
        break;
      case '--set-history':
        options.setHistory = parseInt(args[++i]);
        break;
      case '--set-alert':
        options.setAlert = parseInt(args[++i]);
        break;
      case '--set-low':
        options.setLow = parseFloat(args[++i]);
        break;
      case '--set-high':
        options.setHigh = parseFloat(args[++i]);
        break;
      case '--set-push':
        options.setPush = args[++i];
        break;
      case '--toggle-history':
        options.toggleHistory = true;
        break;
      case '--toggle-alert':
        options.toggleAlert = true;
        break;
      case '--toggle-push':
        options.togglePush = true;
        break;
      case '--reset':
        options.reset = true;
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
黄金T+D配置管理工具

用法:
  node config-manager.js                    显示当前配置
  node config-manager.js --show             显示当前配置
  node config-manager.js --set-history 60   设置历史记录间隔为60分钟
  node config-manager.js --set-alert 5      设置预警检查间隔为5分钟
  node config-manager.js --set-low 900      设置低价预警阈值为900
  node config-manager.js --set-high 1200    设置高价预警阈值为1200
  node config-manager.js --set-push "9:00,15:00,21:00"  设置推送时间
  node config-manager.js --toggle-history   开启/关闭历史记录
  node config-manager.js --toggle-alert     开启/关闭预警
  node config-manager.js --toggle-push      开启/关闭推送
  node config-manager.js --reset            重置为默认配置
  node config-manager.js --help             显示帮助

示例:
  node config-manager.js --set-history 60 --set-alert 5
  node config-manager.js --set-low 900 --set-high 1200
`);
}

// 主函数
function main() {
  const options = parseArgs();
  
  // 如果没有参数，显示配置
  if (Object.values(options).every(v => v === false || v === null)) {
    options.show = true;
  }
  
  if (options.reset) {
    if (saveConfig(DEFAULT_CONFIG)) {
      console.log('\n✅ 配置已重置为默认值\n');
      console.log(showConfig(DEFAULT_CONFIG));
    }
    return;
  }
  
  const config = loadConfig();
  let modified = false;
  
  if (options.setHistory !== null) {
    if (options.setHistory < 1) {
      console.error('❌ 历史记录间隔不能小于1分钟');
      return;
    }
    config.history.intervalMinutes = options.setHistory;
    console.log(`✅ 历史记录间隔已设置为 ${options.setHistory} 分钟`);
    modified = true;
  }
  
  if (options.setAlert !== null) {
    if (options.setAlert < 1) {
      console.error('❌ 预警检查间隔不能小于1分钟');
      return;
    }
    config.alert.intervalMinutes = options.setAlert;
    console.log(`✅ 预警检查间隔已设置为 ${options.setAlert} 分钟`);
    modified = true;
  }
  
  if (options.setLow !== null) {
    config.alert.lowThreshold = options.setLow;
    console.log(`✅ 低价预警阈值已设置为 ${options.setLow} 元/克`);
    modified = true;
  }
  
  if (options.setHigh !== null) {
    config.alert.highThreshold = options.setHigh;
    console.log(`✅ 高价预警阈值已设置为 ${options.setHigh} 元/克`);
    modified = true;
  }
  
  if (options.setPush !== null) {
    const times = options.setPush.split(',').map(t => t.trim());
    // 验证时间格式
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const validTimes = times.filter(t => timeRegex.test(t));
    if (validTimes.length === 0) {
      console.error('❌ 推送时间格式错误，请使用 HH:MM 格式，多个时间用逗号分隔');
      return;
    }
    config.push.times = validTimes;
    console.log(`✅ 推送时间已设置为 ${validTimes.join(', ')}`);
    modified = true;
  }
  
  if (options.toggleHistory) {
    config.history.enabled = !config.history.enabled;
    console.log(`✅ 历史记录已${config.history.enabled ? '开启' : '关闭'}`);
    modified = true;
  }
  
  if (options.toggleAlert) {
    config.alert.enabled = !config.alert.enabled;
    console.log(`✅ 预警功能已${config.alert.enabled ? '开启' : '关闭'}`);
    modified = true;
  }
  
  if (options.togglePush) {
    config.push.enabled = !config.push.enabled;
    console.log(`✅ 定时推送已${config.push.enabled ? '开启' : '关闭'}`);
    modified = true;
  }
  
  if (modified) {
    if (saveConfig(config)) {
      console.log('\n💾 配置已保存\n');
      
      // 自动应用到定时任务
      console.log('🔄 正在应用配置到定时任务...\n');
      const applyScript = path.join(__dirname, 'apply-config.js');
      exec(`node "${applyScript}"`, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ 应用配置失败:', error.message);
        } else {
          console.log(stdout);
        }
      });
    }
  } else if (options.show) {
    console.log(showConfig(config));
  }
}

main();