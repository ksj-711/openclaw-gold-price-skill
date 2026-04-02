---
name: gold-price
description: 查询金投网(www.cngold.org)的黄金T+D实时价格。当用户询问黄金价格、金价、黄金T+D价格或相关贵金属行情时使用此skill。
---

# 金投网黄金T+D价格监控

查询金投网(www.cngold.org)的黄金T+D实时价格，支持定时推送、价格预警和历史记录。

## 数据来源

- **黄金T+D代码**: JO_9753
- **数据来源**: https://api.jijinhao.com
- **价格单位**: 元/克

## 使用方法

### 1. 关键词触发（推荐）

直接发消息给我：

| 你想查什么 | 发这些关键词 |
|-----------|-------------|
| **实时价格** | "黄金价格"、"金价"、"黄金T+D"、"查一下黄金" |
| **历史记录** | "黄金历史"、"金价历史"、"黄金记录" |
| **趋势图表** | "黄金趋势"、"金价走势"、"黄金图表" |
| **查看配置** | "黄金配置"、"金价设置" |

### 2. 命令行查询

```bash
cd /home/openclaw/.openclaw/workspace/skills/gold-price

# 查询实时价格
node scripts/query-price.js

# 查询历史记录
node scripts/query-price.js --today
node scripts/query-price.js --date 2026-04-01
node scripts/query-price.js --days 7
node scripts/query-price.js --latest 20

# 查看趋势图表
node scripts/query-price-trend.js
node scripts/query-price-trend.js --days 7
```

### 3. 配置管理

配置文件位置: `config.json`

```bash
# 查看当前配置
node scripts/config-manager.js

# 修改历史记录间隔（分钟）
node scripts/config-manager.js --set-history 60

# 修改预警检查间隔（分钟）
node scripts/config-manager.js --set-alert 5

# 修改预警阈值
node scripts/config-manager.js --set-low 900
node scripts/config-manager.js --set-high 1200

# 修改推送时间
node scripts/config-manager.js --set-push "9:00,15:00,21:00"

# 开启/关闭功能
node scripts/config-manager.js --toggle-history
node scripts/config-manager.js --toggle-alert
node scripts/config-manager.js --toggle-push

# 重置为默认配置
node scripts/config-manager.js --reset

# 应用配置到定时任务
node scripts/apply-config.js
```

### 4. 配置项说明

```json
{
  "history": {
    "enabled": true,           // 是否启用历史记录
    "intervalMinutes": 30,     // 记录间隔（分钟）
    "recordOnChangeOnly": true // 仅价格变化时记录
  },
  "alert": {
    "enabled": true,           // 是否启用预警
    "intervalMinutes": 10,     // 检查间隔（分钟）
    "lowThreshold": 950,       // 低价预警阈值
    "highThreshold": 1150,     // 高价预警阈值
    "oncePerDay": true         // 每天只提醒一次
  },
  "push": {
    "enabled": true,           // 是否启用定时推送
    "times": ["10:00", "17:00"] // 推送时间
  }
}
```

### 5. 管理定时任务

```bash
# 查看所有定时任务
openclaw cron list

# 手动应用配置（修改配置后执行）
node scripts/apply-config.js
```

### 6. 查看历史数据

历史记录保存在：
```
/home/openclaw/.openclaw/workspace/skills/gold-price/data/gold-td-history-YYYY-MM.csv
```

用Excel打开即可查看，包含字段：
- timestamp: 时间戳
- date: 日期
- time: 时间
- price: 价格
- change: 涨跌额
- change_percent: 涨跌幅
- open: 开盘价
- high: 最高价
- low: 最低价

## 注意事项

- 价格为实时数据，可能有短暂延迟
- 历史记录只在价格变化时保存（避免停市时段重复数据）
- 预警每天每种类型只提醒一次
- 修改配置后需要运行 `apply-config.js` 才能生效
- 数据保存在本地CSV文件中，可随时导出分析
