/**
 * 消息存储服务
 * 
 * 负责监听消息事件、持久化消息到数据库、提供历史消息查询功能
 */

import type { PluginContext, MessageEvent, MessageSegment } from '@napgram/sdk';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { messages, type NewMessage, type Message } from '../schema';
import { PluginConfig, StoredMessage } from '../types';

export class MessageStorageService {
    private messageCache = new Map<string, StoredMessage[]>();
    private readonly cacheSize = 1000;
    private readonly cacheExpiration = 1000 * 60 * 60 * 24; // 1 day

    constructor(
        private ctx: PluginContext,
        private config: PluginConfig
    ) { }

    /**
     * 启动消息监听和存储
     */
    public async start(): Promise<void> {
        // 监听消息事件
        this.ctx.on('message', async (event) => {
            await this.handleMessage(event);
        });

        // 定期清理过期缓存
        setInterval(() => {
            this.cleanExpiredCache();
        }, 5 * 60 * 1000); // 每5分钟清理一次

        // 定期清理过期数据库记录
        if (this.config.analysis.retentionDays > 0) {
            setInterval(() => {
                this.cleanExpiredMessages();
            }, 6 * 60 * 60 * 1000); // 每6小时清理一次
        }

        this.ctx.logger.info('消息存储服务已启动');
    }

    /**
     * 处理消息事件
     */
    private async handleMessage(event: MessageEvent): Promise<void> {
        try {
            // 检查是否应该存储此消息
            if (!this.shouldStoreMessage(event)) {
                return;
            }

            // 构造存储消息对象
            const storedMessage = this.buildStoredMessage(event);

            // 添加到缓存
            this.addToCache(storedMessage);

            // 持久化到数据库 - 传递完整的 event 信息
            await this.persistMessageWithEvent(storedMessage, event);

        } catch (error) {
            this.ctx.logger.error('处理消息失败:', error);
        }
    }

    /**
     * 判断是否应该存储消息
     */
    private shouldStoreMessage(event: MessageEvent): boolean {
        // 过滤包含敏感词的消息
        if (this.config.wordsFilter.some(word => event.message.text.includes(word))) {
            return false;
        }

        // 过滤特定用户的消息
        if (this.config.userFilter.includes(event.sender.userId)) {
            return false;
        }

        // 只存储群组消息
        if (event.channelType !== 'group') {
            return false;
        }

        return true;
    }

    /**
     * 构造存储消息对象
     */
    private buildStoredMessage(event: MessageEvent): StoredMessage {
        return {
            id: event.message.id,
            platform: event.platform,
            userId: event.sender.userId,
            username: event.sender.userName || event.sender.userNick || 'Unknown',
            content: event.message.text,
            timestamp: new Date(event.message.timestamp),
            messageId: event.message.id,
            elements: event.message.segments
        };
    }

    /**
     * 添加到本地缓存
     */
    private addToCache(message: StoredMessage): void {
        const cacheKey = `${message.platform}_${message.userId}`;
        let messages = this.messageCache.get(cacheKey) || [];

        messages.unshift(message);

        // 保持缓存大小限制
        if (messages.length > this.cacheSize) {
            messages = messages.slice(0, this.cacheSize);
        }

        this.messageCache.set(cacheKey, messages);
    }

    /**
     * 持久化消息到数据库（带 Event 信息）
     */
    private async persistMessageWithEvent(message: StoredMessage, event: MessageEvent): Promise<void> {
        try {
            const db = this.ctx.database;

            // 从 event 中提取 channelId 和 instanceId
            const channelId = event.channelId || 'unknown';
            const instanceId = String(event.instanceId || 0);
            const channelType = event.channelType || 'group';

            const newMessage: NewMessage = {
                messageId: message.messageId || message.id,
                platform: message.platform,
                instanceId,
                channelId,
                channelType,
                userId: message.userId,
                username: message.username,
                textContent: message.content,
                segmentsJson: JSON.stringify(message.elements || []),
                timestamp: message.timestamp,
            };

            await db.insert(messages).values(newMessage);
        } catch (error) {
            this.ctx.logger.warn('存储消息到数据库失败:', error);
        }
    }

    /**
     * 查询历史消息
     */
    public async getHistoricalMessages(
        channelId: string,
        platform: string,
        startTime: Date,
        endTime: Date,
        limit: number = 1000
    ): Promise<StoredMessage[]> {
        try {
            const db = this.ctx.database;

            const results = await db
                .select()
                .from(messages)
                .where(
                    and(
                        eq(messages.channelId, channelId),
                        eq(messages.platform, platform),
                        gte(messages.timestamp, startTime),
                        lte(messages.timestamp, endTime)
                    )
                )
                .orderBy(messages.timestamp)
                .limit(limit);

            return results.map((msg: Message) => ({
                id: msg.messageId,
                platform: msg.platform,
                userId: msg.userId,
                username: msg.username,
                content: msg.textContent,
                timestamp: msg.timestamp,
                messageId: msg.messageId,
                elements: this.parseSegments(msg.segmentsJson)
            }));
        } catch (error) {
            this.ctx.logger.error('查询历史消息失败:', error);
            return [];
        }
    }

    /**
     * 解析 JSON 序列化的消息片段
     */
    private parseSegments(segmentsJson: string | null): MessageSegment[] {
        if (!segmentsJson) return [];

        try {
            return JSON.parse(segmentsJson);
        } catch (error) {
            this.ctx.logger.warn('解析消息片段失败:', error);
            return [];
        }
    }

    /**
     * 清理过期缓存
     */
    private cleanExpiredCache(): void {
        const now = Date.now();

        for (const [key, messages] of this.messageCache.entries()) {
            const validMessages = messages.filter(
                msg => now - msg.timestamp.getTime() < this.cacheExpiration
            );

            if (validMessages.length === 0) {
                this.messageCache.delete(key);
            } else if (validMessages.length !== messages.length) {
                this.messageCache.set(key, validMessages);
            }
        }
    }

    /**
     * 清理过期数据库记录
     */
    private async cleanExpiredMessages(): Promise<void> {
        try {
            const retentionMs = this.config.analysis.retentionDays * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(Date.now() - retentionMs);

            const db = this.ctx.database;
            await db
                .delete(messages)
                .where(lte(messages.timestamp, cutoffDate));

            this.ctx.logger.info(`已清理 ${cutoffDate.toISOString()} 之前的消息`);
        } catch (error) {
            this.ctx.logger.error('清理过期消息失败:', error);
        }
    }
}
