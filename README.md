# napgram-plugin-group-analysis

NapGram 群聊分析插件，支持多维度统计、智能话题总结、用户称号分析和金句提取。

## 功能特性

- ✅ **多维度统计** - 总消息数、参与人数、总字数、表情统计
- ✅ **活跃时段分析** - 识别群聊最活跃的时间段
- ✅ **用户发言排行** - 统计最活跃用户及其发言习惯
- ✅ **AI 话题总结** - 使用大语言模型自动提取核心讨论话题
- ✅ **用户称号分析** - 为活跃用户生成个性化称号和 MBTI 类型
- ✅ **金句提取** - 自动挑选群聊中最具冲击力的"逆天"发言

## 安装方法

### 1. 构建插件

```bash
cd /path/to/napgram-plugin-group-analysis
pnpm install
pnpm build
```

### 2. 安装到 NapGram

将构建产物安装到 NapGram 数据目录：

```bash
./scripts/install-local.sh /path/to/napgram/data
```

### 3. 配置插件

在 NapGram Web UI 中配置以下必填项：

- **LLM Token**: OpenAI 兼容接口的访问令牌（必填）
- **LLM Base URL**: API 地址，默认 `https://api.openai.com/v1`
- **允许的群组**: 可以使用插件的群组 ID 列表（留空表示全部允许）

## 使用方法

### 基本命令

```
群分析          # 分析最近 1 天的群聊记录
群分析 --天数 3  # 分析最近 3 天的群聊记录
```

### 配置说明

#### LLM 配置
- `llm.baseUrl`: OpenAI 兼容接口地址
- `llm.token`: API 访问令牌
- `llm.model`: 模型名称（留空自动选择）
- `llm.temperature`: 生成温度（0-2，默认 1.5）

#### 分析配置
- `analysis.maxMessages`: 单次分析最大消息数（默认 2000）
- `analysis.minMessages`: 最小消息数要求（默认 100）
- `analysis.maxTopics`: 最多生成话题数（默认 5）
- `analysis.maxUserTitles`: 最多生成用户称号数（默认 6）
- `analysis.maxGoldenQuotes`: 最多生成金句数（默认 3）

#### 输出配置
- `output.format`: 输出格式（text/image/pdf）
  - **text** - 纯文本报告
  - **image** - 图片报告（使用 Canvas 渲染，Material Design 3 风格）
  - **pdf** - PDF 报告（开发中）
- `output.theme`: 主题（light/dark/auto）
- `output.skin`: 皮肤（md3/anime/guofeng，当前仅支持 md3）

### 过滤设置
- `wordsFilter`: 过滤词列表，包含这些词的消息将被忽略
- `userFilter`: 过滤用户列表，这些用户的消息将被忽略

## 技术说明

### 架构

插件采用模块化设计：

- **src/index.ts** - 插件入口，命令注册
- **src/services/analysis.ts** - 核心分析服务
- **src/services/llm.ts** - LLM 调用服务
- **src/services/storage.ts** - 消息存储服务
- **src/services/renderer.ts** - Canvas 图片渲染
- **src/utils.ts** - 统计计算工具函数
- **src/config.ts** - 配置定义和验证
- **src/types.ts** - TypeScript 类型定义
- **src/schema.ts** - Drizzle ORM 数据库 Schema

### 消息获取

插件通过 NapGram SDK 的 API 获取历史消息，无需数据库持久化。支持：
- Telegram（通过 mtproto API）
- QQ（通过 NapCat API）

### LLM 集成

使用 OpenAI 兼容接口，支持：
- OpenAI GPT 系列
- 其他兼容 API（Qwen、GLM、Moonshot、DeepSeek、Claude 等）

Prompt 模板可在配置中自定义。

## 开发计划

### 当前版本 (v0.1.0)
- ✅ 群组消息统计
- ✅ 数据库消息存储
- ✅ 话题总结
- ✅ 用户称号分析  
- ✅ 金句提取
- ✅ 文本报告输出
- ✅ 图片报告渲染（Canvas + MD3 风格）

### 未来版本
- ⏳ 更多图片模板（anime、guofeng 风格）
- ⏳ PDF 报告导出
- ⏳ 定时任务支持
- ⏳ 跨群用户画像分析

## 许可证

MIT

## 致谢

本插件基于 [koishi-plugin-group-analysis](https://github.com/magisk317/group-analysis) 重写为 NapGram 版本。感谢原作者的贡献！
