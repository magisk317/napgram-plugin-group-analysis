/**
 * 群组分析插件类型定义
 */

import type { MessageSegment } from '@napgram/sdk';

/**
 * 用户统计信息
 */
export interface UserStats {
    userId: string;
    nickname: string;
    messageCount: number;
    charCount: number;
    lastActive: Date;
    avatar?: string;
    replyCount: number;
    emojiRatio: number;
    atCount: number;
    emojiStats: Record<string, number>;
    nightRatio: number;
    avgChars: number;
    replyRatio: number;
    nightMessages: number;
    activeHours: Record<number, number>;
}

/**
 * 话题总结
 */
export interface SummaryTopic {
    topic: string;
    contributors: string[];
    detail: string;
}

/**
 * 用户称号
 */
export interface UserTitle {
    name: string;
    id: string;
    title: string;
    mbti: string;
    reason: string;
    avatar?: string;
}

/**
 * 金句
 */
export interface GoldenQuote {
    content: string;
    sender: string;
    reason: string;
}

/**
 * 群聊分析报告数据结构
 */
export interface GroupAnalysisResult {
    totalMessages: number;
    totalChars: number;
    totalParticipants: number;
    emojiCount: number;
    mostActiveUser: UserStats | null;
    mostActivePeriod: string;
    userStats: UserStats[];
    topics: SummaryTopic[];
    userTitles: UserTitle[];
    goldenQuotes: GoldenQuote[];
    activeHoursChart: string;
    activeHoursData: Record<number, number>;
    analysisDate: string;
    groupName: string;
}

/**
 * 基础统计结果
 */
export interface BasicStatsResult {
    userStats: Record<string, UserStats>;
    totalChars: number;
    totalEmojiCount: number;
    allMessagesText: string[];
}

/**
 * 存储的消息
 */
export interface StoredMessage {
    id: string;
    platform: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
    messageId?: string;
    elements?: MessageSegment[];
}

/**
 * 插件配置
 */
export interface PluginConfig {
    llm: {
        baseUrl: string;
        token: string;
        model?: string;
        temperature?: number;
    };
    allowedGroups: string[];
    analysis: {
        maxMessages: number;
        minMessages: number;
        maxUsersInReport: number;
        maxTopics: number;
        maxUserTitles: number;
        maxGoldenQuotes: number;
        retentionDays: number; // 消息保留天数
    };
    output: {
        format: 'image' | 'pdf' | 'text';
        theme: 'light' | 'dark' | 'auto';
        skin: 'md3' | 'anime' | 'guofeng';
    };
    prompts: {
        topic: string;
        userTitles: string;
        goldenQuotes: string;
    };
    wordsFilter: string[];
    userFilter: string[];
}
