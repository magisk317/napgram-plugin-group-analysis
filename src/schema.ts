/**
 * 群组分析插件数据库 Schema
 * 
 * 定义消息存储表结构，用于持久化群聊消息以供后续分析使用
 */

import { pgSchema, serial, text, timestamp, index } from 'drizzle-orm/pg-core';

// 使用独立的 schema namespace 避免与其他插件冲突
export const groupAnalysisSchema = pgSchema('group_analysis');

/**
 * 群聊消息表
 * 
 * 存储群聊消息用于分析，支持按时间范围、用户等条件查询
 */
export const messages = groupAnalysisSchema.table('group_analysis_messages', {
    // 主键
    id: serial('id').primaryKey(),

    // 消息唯一标识
    messageId: text('messageId').notNull(),

    // 平台信息
    platform: text('platform').notNull(), // 'qq' | 'tg'
    instanceId: text('instanceId').notNull(),

    // 频道信息
    channelId: text('channelId').notNull(),
    channelType: text('channelType').notNull(), // 'group' | 'private' | 'channel'

    // 发送者信息
    userId: text('userId').notNull(),
    username: text('username').notNull(),

    // 消息内容
    textContent: text('textContent').notNull(),
    segmentsJson: text('segmentsJson'), // JSON 序列化的 MessageSegment[]

    // 时间戳
    timestamp: timestamp('timestamp').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
    // 索引：按频道和时间查询
    idxChannelTime: index('group_analysis_messages_channel_time_idx')
        .on(t.channelId, t.timestamp),

    // 索引：按用户查询
    idxUserId: index('group_analysis_messages_userId_idx')
        .on(t.userId),

    // 索引：按平台和实例查询
    idxPlatformInstance: index('group_analysis_messages_platform_instance_idx')
        .on(t.platform, t.instanceId),

    // 索引：按消息ID查询（用于去重）
    idxMessageId: index('group_analysis_messages_messageId_idx')
        .on(t.messageId),
}));

// 导出类型
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
