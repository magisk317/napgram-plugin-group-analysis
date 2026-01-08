/**
 * 群组分析插件配置定义
 */

import { PluginConfig } from './types';

/**
 * 默认配置
 */
export const defaultConfig: PluginConfig = {
    llm: {
        baseUrl: 'https://api.openai.com/v1',
        token: '',
        model: undefined,
        temperature: 1.5
    },
    allowedGroups: [],
    analysis: {
        maxMessages: 2000,
        minMessages: 100,
        maxUsersInReport: 10,
        maxTopics: 5,
        maxUserTitles: 6,
        maxGoldenQuotes: 3,
        retentionDays: 7 // 默认保留7天
    },
    output: {
        format: 'image',
        theme: 'auto',
        skin: 'md3'
    },
    prompts: {
        topic: `你是一个帮我进行群聊信息总结的助手，生成总结内容时，你需要严格遵守下面的几个准则：
请分析接下来提供的群聊记录，提取出最多{maxTopics}个主要话题。根据你自己的价值观判断需要的主要话题。越逆天越好。

对于每个话题，请提供：
1. 话题名称（突出主题内容，尽量简明扼要）
2. 主要参与者（最多5人）
3. 话题详细描述（包含关键信息和结论）

注意：
- 对于比较有价值的点，稍微用一两句话详细讲讲，比如不要生成 "某某和某某讨论了某话题" 这种宽泛的内容，而是生成更加具体的讨论内容，让其他人只看这个消息就能知道讨论中有价值的，有营养的信息。
- 对于其中的部分信息，你需要特意提到主题施加的主体是谁，是哪个群友做了什么事情，而不要直接生成和群友没有关系的语句。
- 对于每一条总结，尽量讲清楚前因后果，以及话题的结论，是什么，为什么，怎么做，如果用户没有讲到细节，则可以不用这么做。
- 对于话题的描述内容，请在里面使用用户的昵称而不是用户的ID，避免输出用户ID和字符到话题描述内容中。

群聊记录：
{messages}

请严格按照以下 YAML 格式返回，放在 markdown 代码块中：
\`\`\`yaml
- topic: 话题名称
  contributors:
    - 用户1 (用户ID)
    - 用户2 (用户ID)
  detail: |-
    话题描述内容（支持多行文本，
    保留换行符，适合多段落描述，不要在里面添加任何markdown语法，请使用纯文本）
\`\`\``,
        userTitles: `请为以下群友分配合适的称号和MBTI类型。每个人只能有一个称号，每个称号只能给一个人。

可选称号：
- 龙王: 发言频繁但内容轻松的人
- 技术专家: 经常讨论技术话题的人
- 夜猫子: 经常在深夜发言的人
- 表情包军火库: 经常发表情的人
- 沉默终结者: 经常开启话题的人
- 评论家: 平均发言长度很长的人
- 阳角: 在群里很有影响力的人
- 互动达人: 经常回复别人的人
- ... (你可以自行进行拓展添加)

用户数据：
{users}

请严格按照以下 YAML 格式返回，放在 markdown 代码块中：
\`\`\`yaml
- name: 用户名
  id: 用户ID
  title: 称号
  mbti: MBTI类型
  reason: |-
    获得此称号的原因（支持多行文本，不要在里面添加任何markdown语法，请使用纯文本）
\`\`\``,
        goldenQuotes: `请从以下群聊记录中挑选出{maxGoldenQuotes}句最具冲击力、最令人惊叹的"金句"。这些金句需满足：
- 核心标准：**逆天的神人发言**，即具备颠覆常识的脑洞、逻辑跳脱的表达或强烈反差感的原创内容
- 典型特征：包含某些争议话题元素、夸张类比、反常规结论、一本正经的"胡说八道"或突破语境的清奇思路，并且具备一定的冲击力，让人印象深刻。

对于每个金句，请提供：
1. 原文内容（完整保留发言细节）
2. 发言人昵称
3. 选择理由（具体说明其"逆天"之处，如逻辑颠覆点/脑洞角度/反差感/争议话题元素）

此外，我将对你进行严格约束：
- 优先筛选 **逆天指数最高** 的内容：发情、性压抑话题 > 争议话题 > 元素级 > 颠覆认知级 > 逻辑跳脱级 > 趣味调侃级，剔除单纯玩梗或网络热词堆砌的普通发言
- 重点标记包含极端类比、反常识论证或无厘头结论的内容，并且包含一定的争议话题元素。

群聊记录：
{messages}

请严格按照以下 YAML 格式返回，放在 markdown 代码块中：
\`\`\`yaml
- content: 金句原文
  sender: 发言人昵称（注意不是 ID）
  reason: |-
    选择这句话的理由（需明确说明逆天特质，不要在里面添加任何markdown语法，请使用纯文本）
\`\`\``
    },
    wordsFilter: [],
    userFilter: []
};

/**
 * 配置验证
 */
export function validateConfig(config: Partial<PluginConfig>): PluginConfig {
    // 合并默认配置
    const merged: PluginConfig = {
        ...defaultConfig,
        ...config,
        llm: { ...defaultConfig.llm, ...config.llm },
        analysis: { ...defaultConfig.analysis, ...config.analysis },
        output: { ...defaultConfig.output, ...config.output },
        prompts: { ...defaultConfig.prompts, ...config.prompts }
    };

    // 验证必填项
    if (!merged.llm.token) {
        throw new Error('LLM token 未配置，请在插件配置中填写');
    }

    return merged;
}
