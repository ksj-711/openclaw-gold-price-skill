#!/usr/bin/env node
/**
 * 应用配置到定时任务
 * 根据config.json更新cron任务
 * 支持多目标推送，每个目标独立任务，失败互不影响
 */

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

// 执行shell命令
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// 获取现有的黄金相关cron任务ID
async function getExistingJobIds() {
  try {
    const output = await runCommand('openclaw cron list --json');
    const data = JSON.parse(output);
    
    // openclaw cron list --json 返回 { jobs: [...] }
    const jobs = data.jobs || [];
    
    if (!Array.isArray(jobs)) {
      console.log('⚠️ 没有现有任务或格式错误');
      return [];
    }
    
    const goldJobs = jobs.filter(j => 
      j.name && (
        j.name.includes('黄金') || 
        j.name.includes('gold') || 
        j.name.includes('T+D')
      )
    );
    
    if (goldJobs.length > 0) {
      console.log(`📋 发现 ${goldJobs.length} 个现有任务`);
    }
    
    return goldJobs.map(j => j.id);
  } catch (e) {
    console.error('⚠️ 获取现有任务失败:', e.message);
    return [];
  }
}

// 删除现有任务
async function removeExistingJobs(ids) {
  for (const id of ids) {
    try {
      await runCommand(`openclaw cron remove ${id}`);
      console.log(`✅ 已删除旧任务: ${id}`);
    } catch (e) {
      console.error(`❌ 删除任务失败 ${id}:`, e.message);
    }
  }
}

// 创建新的定时任务
async function createJobs(config) {
  const scriptDir = '/home/openclaw/.openclaw/workspace/skills/gold-price/scripts';
  
  // 1. 历史记录任务（不需要推送，静默执行）
  if (config.history.enabled) {
    const interval = config.history.intervalMinutes || 30;
    try {
      let cmd = `openclaw cron add --name "黄金T+D历史记录" --cron "*/${interval} * * * *" --tz "Asia/Shanghai" --system-event "exec:node ${scriptDir}/gold-price-history.js"`;
      await runCommand(cmd);
      console.log(`✅ 已创建任务: 黄金T+D历史记录`);
      console.log(`   调度: */${interval} * * * *`);
    } catch (e) {
      console.error(`❌ 创建任务失败 黄金T+D历史记录:`, e.message);
    }
  }
  
  // 2. 预警任务 - 使用 system-event 静默执行，脚本内部决定是否推送
  if (config.alert.enabled) {
    const interval = config.alert.intervalMinutes || 10;
    try {
      let cmd = `openclaw cron add --name "黄金T+D价格预警" --cron "*/${interval} * * * *" --tz "Asia/Shanghai" --system-event "exec:node ${scriptDir}/gold-price-alert.js"`;
      await runCommand(cmd);
      console.log(`✅ 已创建任务: 黄金T+D价格预警`);
      console.log(`   调度: */${interval} * * * *`);
      console.log(`   说明: 只在价格超出阈值时才推送`);
    } catch (e) {
      console.error(`❌ 创建任务失败 黄金T+D价格预警:`, e.message);
    }
  }
  
  // 3. 每日推送任务 - 为每个启用的目标创建独立任务
  if (config.push.enabled && config.push.times && config.push.times.length > 0) {
    const times = config.push.times;
    const hours = times.map(t => parseInt(t.split(':')[0])).join(',');
    const minutes = times.map(t => parseInt(t.split(':')[1]));
    const minute = minutes[0] || 0;
    
    if (config.push.targets) {
      for (const target of config.push.targets) {
        if (!target.enabled) continue;
        
        try {
          const targetName = target.name || target.to;
          let cmd = `openclaw cron add --name "黄金T+D每日推送-${targetName}" --cron "${minute} ${hours} * * *" --tz "Asia/Shanghai" --message "查询黄金价格并推送" --session isolated --announce --channel ${target.channel} --to "${target.to}"`;
          
          if (target.account) {
            cmd += ` --account ${target.account}`;
          }
          
          await runCommand(cmd);
          console.log(`✅ 已创建任务: 黄金T+D每日推送-${targetName}`);
          console.log(`   调度: ${minute} ${hours} * * *`);
          console.log(`   目标: ${targetName}`);
        } catch (e) {
          console.error(`❌ 创建任务失败 黄金T+D每日推送-${target.name || target.to}:`, e.message);
        }
      }
    }
  }
}

// 主函数
async function main() {
  console.log('\n🔄 应用黄金T+D配置...\n');
  
  const config = loadConfig();
  if (!config) {
    console.error('❌ 无法加载配置文件');
    process.exit(1);
  }
  
  // 获取并删除现有任务
  console.log('📋 清理现有任务...');
  const existingIds = await getExistingJobIds();
  if (existingIds.length > 0) {
    await removeExistingJobs(existingIds);
  }
  
  // 创建新任务
  console.log('\n📋 创建新任务...');
  await createJobs(config);
  
  console.log('\n✅ 配置已应用\n');
  console.log('当前配置:');
  console.log(`  历史记录: ${config.history.enabled ? '✅' : '❌'} (${config.history.intervalMinutes}分钟)`);
  console.log(`  价格预警: ${config.alert.enabled ? '✅' : '❌'} (${config.alert.intervalMinutes}分钟)`);
  console.log(`  低价阈值: ${config.alert.lowThreshold}元/克`);
  console.log(`  高价阈值: ${config.alert.highThreshold}元/克`);
  console.log(`  定时推送: ${config.push.enabled ? '✅' : '❌'} (${config.push.times.join(', ')})`);
  if (config.push.targets) {
    console.log(`  推送目标:`);
    config.push.targets.forEach(t => {
      console.log(`    - ${t.name}: ${t.enabled ? '✅' : '❌'}`);
    });
  }
  console.log(`\n💡 每个目标都有独立的定时任务，失败互不影响`);
}

main().catch(e => {
  console.error('❌ 应用配置失败:', e.message);
  process.exit(1);
});
