/**
 * LLM 服务 - 负责调用 OpenAI 兼容接口进行分析
 */

import { load as yamlLoad } from 'js-yaml';
import { PluginConfig, GoldenQuote, SummaryTopic, UserTitle, UserStats } from '../types';

interface ChatCompletionResponse {
    choices?: { message?: { content?: string } }[];
}

export class LLMService {
    private availableModels: string[] = [];
    private resolvedModel?: string;

    constructor(
        private config: PluginConfig,
        private logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string, ...args: any[]) => void }
    ) { }

    private get baseUrl() {
        return this.config.llm.baseUrl.replace(/\/+$/, '');
    }

    private buildUrl(path: string) {
        return `${this.baseUrl}/${path.replace(/^\//, '')}`;
    }

    private get headers() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this.config.llm.token) {
            headers.Authorization = `Bearer ${this.config.llm.token}`;
        }

        return headers;
    }

    /**
     * 选择或自动发现可用模型
     */
    private async resolveModel(): Promise<string> {
        if (this.resolvedModel) return this.resolvedModel;
        if (this.config.llm.model) {
            this.resolvedModel = this.config.llm.model;
            return this.resolvedModel;
        }

        // 自动获取模型列表
        if (!this.availableModels.length) {
            await this.fetchAvailableModels();
        }

        const selected = this.selectModel();
        if (!selected) {
            throw new Error('无可用模型，请检查 baseUrl/token 或配置模型名称。');
        }
        this.resolvedModel = selected;
        return selected;
    }

    /**
     * 从 API 获取可用模型列表
     */
    private async fetchAvailableModels(): Promise<void> {
        const url = this.buildUrl('models');
        this.logger.info(`未配置模型，正在从 ${url} 自动选择可用模型...`);

        const response = await fetch(url, { headers: this.headers });

        if (!response.ok) {
            const text = await response.text();
            this.logger.warn(`获取模型列表失败 (${response.status}): ${text}`);
            throw new Error('无法自动获取可用模型。请检查 baseUrl/token 配置或直接指定模型。');
        }

        const data = await response.json();
        const ids: string[] = Array.isArray(data?.data)
            ? data.data.map((item: any) => item?.id).filter((id: any) => typeof id === 'string')
            : [];

        this.availableModels = ids;
    }

    /**
     * 选择首选模型
     */
    private selectModel(): string | null {
        if (this.config.llm.model) return this.config.llm.model;
        if (!this.availableModels.length) return null;

        const preferred = [
            'gpt-4o',
            'gpt-4',
            'gpt-3.5',
            'qwen',
            'glm',
            'moonshot',
            'deepseek',
            'claude'
        ];

        for (const target of preferred) {
            const match = this.availableModels.find((id) => id.includes(target));
            if (match) return match;
        }

        return this.availableModels[0];
    }

    /**
     * 请求 LLM 补全
     */
    private async requestChatCompletion(prompt: string): Promise<string> {
        const model = await this.resolveModel();
        const url = this.buildUrl('chat/completions');
        const payload = {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.config.llm.temperature ?? 1.5
        };

        this.logger.info(`调用 LLM (模型: ${model})...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`LLM 请求失败: ${response.status} ${text || ''}`.trim());
        }

        const data: ChatCompletionResponse = await response.json();
        const rawContent = data?.choices?.[0]?.message?.content?.toString().trim() ?? '';

        this.logger.info(`LLM 响应长度: ${rawContent.length} 字符`);
        return rawContent;
    }

    /**
     * 清理 YAML 内容
     */
    private cleanYamlContent(yamlContent: string): string {
        return yamlContent.replace(
            /(\n\s+.*)\n\n+(\n- (?:topic|name|content|userId):\s)/g,
            '$1$2'
        );
    }

    /**
     * 调用 LLM 并解析 YAML 响应
     */
    private async callLLM<T>(prompt: string, taskName: string): Promise<T> {
        this.logger.info(`正在调用 LLM 进行 ${taskName}...`);

        const rawContent = await this.requestChatCompletion(prompt);

        if (!rawContent) {
            this.logger.warn('LLM 返回空内容。');
            return [] as any;
        }

        const yamlMatch = rawContent.match(/```ya?ml\s*([\s\S]*?)\s*```/);
        if (!yamlMatch) {
            this.logger.warn(`未找到 YAML 代码块，无法解析。`);
            throw new Error('未找到 YAML 响应。');
        }

        try {
            const cleanedYaml = this.cleanYamlContent(yamlMatch[1]);
            const data = yamlLoad(cleanedYaml) as T;
            if (Array.isArray(data)) {
                this.logger.info(`成功解析 ${data.length} 条数据。`);
            }
            return data;
        } catch (err) {
            this.logger.error('解析 YAML 失败:', err);
            this.logger.error('待解析的 YAML 字符串:', yamlMatch[1] || '[空字符串]');
            throw err;
        }
    }

    /**
     * 话题总结
     */
    public async summarizeTopics(messagesText: string): Promise<SummaryTopic[]> {
        const prompt = this.config.prompts.topic
            .replace('{messages}', messagesText)
            .replace('{maxTopics}', this.config.analysis.maxTopics.toString());
        return this.callLLM<SummaryTopic[]>(prompt, '话题分析').then((data) => data ?? []);
    }

    /**
     * 用户称号分析
     */
    public async analyzeUserTitles(users: UserStats[]): Promise<UserTitle[]> {
        const userSummaries = users
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, this.config.analysis.maxUserTitles)
            .map(
                (user) =>
                    `- ${user.nickname} (ID:${user.userId}): ` +
                    `发言${user.messageCount}条, 平均${user.avgChars}字, ` +
                    `表情比例${user.emojiRatio}, 夜间发言比例${user.nightRatio}, ` +
                    `回复比例${user.replyRatio}`
            )
            .join('\n');

        const prompt = this.config.prompts.userTitles.replace('{users}', userSummaries);
        return this.callLLM<UserTitle[]>(prompt, '用户称号分析').then((data) => data ?? []);
    }

    /**
     * 金句分析
     */
    public async analyzeGoldenQuotes(messagesText: string): Promise<GoldenQuote[]> {
        const prompt = this.config.prompts.goldenQuotes
            .replace('{messages}', messagesText)
            .replace('{maxGoldenQuotes}', String(this.config.analysis.maxGoldenQuotes));
        return this.callLLM<GoldenQuote[]>(prompt, '金句分析').then((data) => data ?? []);
    }
}
