/**
 * 工具函数
 */

import { BasicStatsResult, GroupAnalysisResult, StoredMessage, UserStats } from './types';

/**
 * 计算基础统计数据
 */
export function calculateBasicStats(messages: StoredMessage[]): BasicStatsResult {
    const userStats: Record<string, UserStats> = {};
    let totalChars = 0;
    let totalEmojiCount = 0;
    const allMessagesText: string[] = [];

    for (const msg of messages) {
        const userId = String(msg.userId);
        if (!userId) continue;

        if (!userStats[userId]) {
            userStats[userId] = getInitialUserStats(msg);
        }

        const stat = userStats[userId];
        stat.messageCount++;

        stat.lastActive = new Date(
            Math.max(stat.lastActive.getTime(), msg.timestamp.getTime())
        );

        const hour = msg.timestamp.getHours();
        stat.activeHours[hour] = (stat.activeHours[hour] || 0) + 1;
        if (hour >= 0 && hour < 6) {
            stat.nightMessages++;
        }

        // 解析消息元素
        let pureText = '';
        for (const el of msg.elements || []) {
            if (el.type === 'text') {
                pureText += el.data?.text || '';
            } else if (el.type === 'reply') {
                stat.replyCount++;
            } else if (el.type === 'at') {
                stat.atCount++;
            } else if (el.type === 'face' || el.type === 'image') {
                stat.emojiStats['emoji'] = (stat.emojiStats['emoji'] || 0) + 1;
                totalEmojiCount++;
            }
        }

        if (pureText) {
            allMessagesText.push(`${msg.username}(${msg.userId}): ${pureText.trim()}`);
        }

        stat.charCount += pureText.length || msg.content.length;
        totalChars += pureText.length || msg.content.length;
    }

    // 计算比率
    for (const userId in userStats) {
        const stat = userStats[userId];
        stat.avgChars = stat.messageCount
            ? parseFloat((stat.charCount / stat.messageCount).toFixed(1))
            : 0;
        stat.nightRatio = stat.messageCount
            ? parseFloat((stat.nightMessages / stat.messageCount).toFixed(2))
            : 0;
        stat.replyRatio = stat.messageCount
            ? parseFloat((stat.replyCount / stat.messageCount).toFixed(2))
            : 0;
        stat.emojiRatio = stat.messageCount
            ? parseFloat((totalEmojiCount / stat.messageCount).toFixed(2))
            : 0;
    }

    return { userStats, totalChars, totalEmojiCount, allMessagesText };
}

function getInitialUserStats(msg: StoredMessage): UserStats {
    return {
        userId: String(msg.userId),
        nickname: msg.username,
        messageCount: 0,
        charCount: 0,
        avatar: undefined,
        lastActive: new Date(0),
        replyCount: 0,
        atCount: 0,
        emojiRatio: 0,
        emojiStats: {},
        nightRatio: 0,
        avgChars: 0,
        replyRatio: 0,
        nightMessages: 0,
        activeHours: Object.fromEntries(
            Array.from({ length: 24 }, (_, i) => [i, 0])
        )
    };
}

/**
 * 生成活跃时段图表（SVG格式）
 */
export function generateActiveHoursChart(activeHours: Record<number, number>): string {
    const maxCount = Math.max(...Object.values(activeHours));
    const hourEntries = Object.entries(activeHours).map(([hour, count]) => ({
        hour: Number(hour),
        count,
        percentage: maxCount > 0 ? (count / maxCount) * 100 : 0
    }));

    // 简单的 SVG 柱状图
    let svg = '<svg width="600" height="120" xmlns="http://www.w3.org/2000/svg">';
    const barWidth = 600 / 24;

    hourEntries.forEach(({ hour, percentage }) => {
        const height = (percentage / 100) * 100;
        const x = hour * barWidth;
        const y = 100 - height;
        svg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${height}" fill="#667eea"/>`;
    });

    svg += '</svg>';
    return svg;
}

/**
 * 生成文本报告
 */
export function generateTextReport(result: GroupAnalysisResult): string {
    let report = `📊 群聊分析报告 (${result.analysisDate})\n`;
    report += `群组: ${result.groupName}\n\n`;
    report += `总消息: ${result.totalMessages} | 参与人数: ${result.totalParticipants} | 总字数: ${result.totalChars} | 表情: ${result.emojiCount}\n`;
    report += `最活跃时段: ${result.mostActivePeriod}\n\n`;

    report += `💬 热门话题:\n`;
    if (result.topics?.length) {
        result.topics.forEach((t) => {
            report += `- ${t.topic} (参与者: ${t.contributors.join(', ')})\n  ${t.detail}\n`;
        });
    } else {
        report += '无明显话题\n';
    }

    report += `\n🏆 群友称号:\n`;
    if (result.userTitles?.length) {
        result.userTitles.forEach((t) => {
            report += `- ${t.name}: ${t.title} ${t.mbti && t.mbti !== 'N/A' ? `(${t.mbti})` : ''} - ${t.reason}\n`;
        });
    } else {
        report += '无特殊称号\n';
    }

    report += `\n💬 群圣经:\n`;
    if (result.goldenQuotes?.length) {
        result.goldenQuotes.forEach((q) => {
            report += `- "${q.content}" —— ${q.sender}\n  理由: ${q.reason}\n`;
        });
    } else {
        report += '无金句记录\n';
    }

    return report;
}

/**
 * 获取 QQ 头像 URL
 */
export function getAvatarUrl(userId: string): string {
    return `http://q1.qlogo.cn/g?b=qq&nk=${userId}&s=640`;
}

/**
 * 根据天数计算起始时间
 */
export function getStartTimeByDays(days: number): Date {
    const now = new Date();
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const targetTime = now.getTime() - days * millisecondsPerDay;
    return new Date(targetTime);
}

/**
 * 查找最活跃时段
 */
export function findMostActivePeriod(activeHours: Record<number, number>): string {
    let maxHour = 0;
    let maxCount = 0;

    for (const [hour, count] of Object.entries(activeHours)) {
        if (count > maxCount) {
            maxCount = count;
            maxHour = Number(hour);
        }
    }

    return `${maxHour}:00-${maxHour + 1}:00`;
}
