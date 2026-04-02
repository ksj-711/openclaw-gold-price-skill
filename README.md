# 黄金价格监控 Skill for OpenClaw

一个用于 OpenClaw 的黄金 T+D 价格监控技能，支持实时查询、定时推送、价格预警和历史记录。

## 功能特性

- 📊 **实时价格查询** - 获取黄金 T+D 最新价格
- 📅 **定时推送** - 每天指定时间自动推送价格
- 🚨 **价格预警** - 价格超出阈值时自动提醒
- 📝 **历史记录** - 自动记录价格变化到 CSV
- 📈 **趋势图表** - ASCII 图表展示价格走势
- ⚙️ **灵活配置** - 所有参数可配置
- 👥 **多目标推送** - 支持推送到多个微信

## 数据来源

- **黄金 T+D 代码**: JO_9753
- **数据来源**: [金投网](https://www.cngold.org) API
- **价格单位**: 元/克

## 安装

1. 将本 skill 复制到 OpenClaw 的 skills 目录：

```bash
cp -r gold-price-skill /home/openclaw/.openclaw/workspace/skills/gold-price
```

2. 进入 skill 目录：

```bash
cd /home/openclaw/.openclaw/workspace/skills/gold-price
```

3. 应用配置（创建定时任务）：

```bash
node scripts/apply-config.js
```

## 使用方法

### 关键词触发

在 OpenClaw 中直接发送：

| 关键词 | 功能 |
|--------|------|
| "黄金价格"、"金价" | 查询实时价格 |
| "黄金历史"、"金价历史" | 查看历史记录 |
| "黄金趋势"、"金价走势" | 查看趋势图表 |
| "黄金配置" | 显示当前配置 |

### 命令行使用

```bash
# 查询实时价格
node scripts/query-price.js

# 查看历史记录
node scripts/query-price.js --today
node scripts/query-price.js --days 7

# 查看趋势图表
node scripts/query-price-trend.js --days 7

# 管理配置
node scripts/config-manager.js
node scripts/config-manager.js --set-low 900
node scripts/config-manager.js --set-high 1200
```

## 配置说明

编辑 `config.json` 文件：

```json
{
  "history": {
    "enabled": true,
    "intervalMinutes": 30,
    "recordOnChangeOnly": true
  },
  "alert": {
    "enabled": true,
    "intervalMinutes": 10,
    "lowThreshold": 950,
    "highThreshold": 1150,
    "oncePerDay": true
  },
  "push": {
    "enabled": true,
    "times": ["10:00", "12:00", "17:00"],
    "targets": [
      {
        "name": "主微信",
        "channel": "openclaw-weixin",
        "account": "your-account-id",
        "to": "your-wechat-id@im.wechat",
        "enabled": true
      }
    ]
  }
}
```

修改配置后自动应用：

```bash
node scripts/config-manager.js --set-history 60
```

## 文件结构

```
gold-price/
├── config.json                    # 配置文件
├── SKILL.md                       # OpenClaw skill 文档
├── README.md                      # 本文件
├── .gitignore                     # Git 忽略规则
├── scripts/                       # 所有脚本
│   ├── query-price.js             # 查询实时价格
│   ├── query-price-trend.js       # 趋势图表
│   ├── config-manager.js          # 配置管理
│   ├── apply-config.js            # 应用配置到定时任务
│   ├── gold-price-daily-push.js   # 每日推送
│   ├── gold-price-alert.js        # 价格预警
│   ├── gold-price-history.js      # 历史记录
│   └── fetch-gold-price.js        # 基础查询
├── cron/                          # 定时任务配置
└── data/                          # 数据目录（自动生成）
    ├── gold-td-history-YYYY-MM.csv
    └── alert-state.json
```

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 每日推送 | 10:00, 12:00, 17:00 | 推送实时价格 |
| 价格预警 | 每 10 分钟 | 检查价格阈值（只在异常时推送） |
| 历史记录 | 每 30 分钟 | 保存价格到 CSV |

## 管理定时任务

```bash
# 查看所有定时任务
openclaw cron list

# 应用配置（更新定时任务）
node scripts/apply-config.js
```

## 注意事项

- 价格为实时数据，可能有短暂延迟
- 历史记录只在价格变化时保存（避免停市时段重复数据）
- 预警每天每种类型只提醒一次
- 修改配置后自动应用，无需手动运行 `apply-config.js`
- 支持多目标推送，每个目标独立任务，失败互不影响

## License

MIT License

## 作者

Created by ksj-711
