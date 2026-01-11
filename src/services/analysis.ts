/**
 * 群组分析服务
 */

import type { PluginContext, MessageEvent } from '@napgram/sdk';
import { PluginConfig, GroupAnalysisResult, StoredMessage } from '../types';
import { LLMService } from './llm.js';
import { MessageStorageService } from './storage.js';
import { CanvasRenderer } from './renderer.js';
import {
    calculateBasicStats,
    generateActiveHoursChart,
    generateTextReport,
    getStartTimeByDays,
    findMostActivePeriod
} from '../utils';

export class GroupAnalysisService {
    private llmService: LLMService;
    private storageService: MessageStorageService;
    private renderer: CanvasRenderer;

    constructor(
        private ctx: PluginContext,
        private config: PluginConfig
    ) {
        this.llmService = new LLMService(config, ctx.logger);
        this.storageService = new MessageStorageService(ctx, config);
        this.renderer = new CanvasRenderer(ctx.logger);

        // 启动消息存储服务
        this.storageService.start().catch(error => {
            ctx.logger.error('消息存储服务启动失败:', error);
        });
    }

    /**
     * 执行群组分析
     */
    public async executeGroupAnalysis(event: MessageEvent, days: number): Promise<void> {
        // 尝试从 event 中获取群组/频道 ID
        const groupId = ((event as any).chatId || (event as any).guildId || (event as any).channelId || 'unknown') as string;
        const platform = event.platform;

        // 检查群组白名单
        if (this.config.allowedGroups.length > 0) {
            if (!this.config.allowedGroups.includes(groupId)) {
                await event.reply('此群组未启用分析功能');
                return;
            }
        }

        try {
            this.ctx.logger.info(`开始分析群组 ${groupId}，时间窗口 ${days} 天`);
            await event.reply('正在收集和分析群聊数据，请稍候...');

            // 收集消息（临时使用模拟数据示例）
            const messages = await this.collectMessages(groupId, platform, days);

            if (messages.length < this.config.analysis.minMessages) {
                await event.reply(
                    `消息数量（${messages.length}/${this.config.analysis.minMessages}）不足，无法进行有效分析`
                );
                return;
            }

            this.ctx.logger.info(`已收集 ${messages.length} 条消息，开始分析...`);

            // 进行分析
            const result = await this.analyzeGroupMessages(messages, groupId);

            // 发送报告
            await this.sendReport(event, result);
        } catch (error) {
            this.ctx.logger.error('群组分析失败:', error);
            await event.reply(`分析失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 收集历史消息
     */
    private async collectMessages(
        groupId: string,
        platform: string,
        days: number
    ): Promise<StoredMessage[]> {
        const startTime = getStartTimeByDays(days);
        const endTime = new Date();

        try {
            this.ctx.logger.info(`从数据库查询历史消息: ${groupId}, ${platform}, ${days} 天`);

            // 从数据库查询历史消息
            const messages = await this.storageService.getHistoricalMessages(
                groupId,
                platform,
                startTime,
                endTime,
                this.config.analysis.maxMessages
            );

            this.ctx.logger.info(`查询到 ${messages.length} 条消息`);
            return messages;
        } catch (error) {
            this.ctx.logger.error('查询历史消息失败:', error);
            return [];
        }
    }

    /**
     * 分析群组消息
     */
    private async analyzeGroupMessages(
        messages: StoredMessage[],
        groupId: string
    ): Promise<GroupAnalysisResult> {
        this.ctx.logger.info(`开始分析 ${messages.length} 条消息...`);

        // 基础统计
        const { userStats, totalChars, totalEmojiCount, allMessagesText } =
            calculateBasicStats(messages);

        const messagesText = allMessagesText.join('\n');
        const users = Object.values(userStats);

        // 并行调用 LLM 进行分析
        const [topics, userTitles, goldenQuotes] = await Promise.all([
            this.llmService.summarizeTopics(messagesText).catch((error) => {
                this.ctx.logger.error('话题分析失败:', error);
                return [];
            }),
            this.llmService.analyzeUserTitles(users).catch((error) => {
                this.ctx.logger.error('用户称号分析失败:', error);
                return [];
            }),
            this.llmService.analyzeGoldenQuotes(messagesText).catch((error) => {
                this.ctx.logger.error('金句分析失败:', error);
                return [];
            })
        ]);

        // 计算活跃时段
        const allActiveHours: Record<number, number> = {};
        for (const user of users) {
            for (const [hour, count] of Object.entries(user.activeHours)) {
                allActiveHours[Number(hour)] = (allActiveHours[Number(hour)] || 0) + count;
            }
        }

        const mostActivePeriod = findMostActivePeriod(allActiveHours);
        const activeHoursChart = generateActiveHoursChart(allActiveHours);

        // 排序用户统计
        const sortedUserStats = users
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, this.config.analysis.maxUsersInReport);

        const mostActiveUser = sortedUserStats[0] || null;

        return {
            totalMessages: messages.length,
            totalChars,
            totalParticipants: users.length,
            emojiCount: totalEmojiCount,
            mostActiveUser,
            mostActivePeriod,
            userStats: sortedUserStats,
            topics,
            userTitles,
            goldenQuotes,
            activeHoursChart,
            activeHoursData: allActiveHours,
            analysisDate: new Date().toLocaleString('zh-CN'),
            groupName: groupId
        };
    }

    /**
     * 发送报告
     */
    private async sendReport(event: MessageEvent, result: GroupAnalysisResult): Promise<void> {
        const format = this.config.output.format;

        try {
            if (format === 'image') {
                // 渲染为图片
                this.ctx.logger.info('正在渲染报告图片...');
                const imageBuffer = await this.renderer.renderReport(
                    result,
                    this.config.output.theme === 'auto' ? 'dark' : this.config.output.theme
                );

                // 发送图片
                await event.reply([
                    {
                        type: 'image',
                        data: {
                            base64: imageBuffer.toString('base64')
                        }
                    }
                ]);
            } else if (format === 'text') {
                // 文本报告
                const textReport = generateTextReport(result);
                await event.reply(textReport);
            } else {
                // PDF 格式
                await event.reply('PDF 报告功能开发中，当前仅支持文本和图片格式');
            }
        } catch (error) {
            this.ctx.logger.error('发送报告失败:', error);
            // 降级到文本报告
            const textReport = generateTextReport(result);
            await event.reply(`报告生成失败，以下是文本版本：\n\n${textReport}`);
        }
    }
}
