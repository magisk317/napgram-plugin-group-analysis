/**
 * Canvas 渲染器 - 使用 @napi-rs/canvas 绘制报告图片
 */

import { createCanvas, GlobalFonts, Image as CanvasImage } from '@napi-rs/canvas';
import type { PluginLogger } from '@napgram/sdk';
import type { GroupAnalysisResult } from '../types';

export class CanvasRenderer {
    private readonly width = 1200;
    private readonly height = 1800;

    constructor(private logger: PluginLogger) { }

    /**
     * 渲染群组分析报告
     */
    public async renderReport(
        result: GroupAnalysisResult,
        theme: 'light' | 'dark' = 'dark'
    ): Promise<Buffer> {
        try {
            this.logger.info('开始渲染报告图片...');

            const canvas = createCanvas(this.width, this.height);
            const ctx = canvas.getContext('2d');

            // 根据主题设置颜色
            const colors = this.getThemeColors(theme);

            // 清空画布并设置背景
            this.drawBackground(ctx, colors);

            // 绘制内容
            let yOffset = 60;

            // 标题
            yOffset = this.drawTitle(ctx, '群组分析报告', yOffset, colors);
            yOffset += 20;

            // 基础统计
            yOffset = this.drawBasicStats(ctx, result, yOffset, colors);
            yOffset += 30;

            // 活跃时段
            yOffset = this.drawActiveHours(ctx, result.activeHoursData, yOffset, colors);
            yOffset += 30;

            // 用户排行
            yOffset = this.drawTopUsers(ctx, result.userStats, yOffset, colors);
            yOffset += 30;

            // 话题和金句
            if (result.topics.length > 0) {
                yOffset = this.drawTopics(ctx, result.topics, yOffset, colors);
                yOffset += 20;
            }

            if (result.goldenQuotes.length > 0) {
                yOffset = this.drawGoldenQuotes(ctx, result.goldenQuotes, yOffset, colors);
            }

            // 页脚
            this.drawFooter(ctx, result.analysisDate, colors);

            // 转换为 PNG Buffer
            const pngBuffer = canvas.toBuffer('image/png');

            this.logger.info(`报告渲染完成，大小: ${pngBuffer.length} bytes`);

            return pngBuffer;
        } catch (error) {
            this.logger.error('渲染报告失败:', error);
            throw error;
        }
    }

    /**
     * 获取主题颜色
     */
    private getThemeColors(theme: 'light' | 'dark') {
        if (theme === 'light') {
            return {
                background: '#ffffff',
                cardBg: '#f5f5f5',
                primary: '#1976d2',
                text: '#212121',
                textSecondary: '#757575',
                border: '#e0e0e0',
                accent: '#ff6b6b'
            };
        }
        return {
            background: '#1a1a2e',
            cardBg: '#16213e',
            primary: '#4a9eff',
            text: '#ffffff',
            textSecondary: '#b0b0b0',
            border: '#2d3561',
            accent: '#ff6b6b'
        };
    }

    /**
     * 绘制背景
     */
    private drawBackground(ctx: any, colors: any) {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * 绘制标题
     */
    private drawTitle(ctx: any, title: string, y: number, colors: any): number {
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, this.width / 2, y);

        // 下划线
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.width / 2 - 150, y + 15);
        ctx.lineTo(this.width / 2 + 150, y + 15);
        ctx.stroke();

        return y + 50;
    }

    /**
     * 绘制基础统计卡片
     */
    private drawBasicStats(ctx: any, result: GroupAnalysisResult, y: number, colors: any): number {
        const stats = [
            { label: '总消息数', value: result.totalMessages.toLocaleString() },
            { label: '参与人数', value: result.totalParticipants.toLocaleString() },
            { label: '总字数', value: result.totalChars.toLocaleString() },
            { label: '表情数', value: result.emojiCount.toLocaleString() }
        ];

        const cardWidth = 260;
        const cardHeight = 120;
        const gap = 20;
        const totalWidth = cardWidth * 4 + gap * 3;
        const startX = (this.width - totalWidth) / 2;

        stats.forEach((stat, i) => {
            const x = startX + i * (cardWidth + gap);

            // 卡片背景
            ctx.fillStyle = colors.cardBg;
            this.roundRect(ctx, x, y, cardWidth, cardHeight, 12);
            ctx.fill();

            // 边框
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 2;
            this.roundRect(ctx, x, y, cardWidth, cardHeight, 12);
            ctx.stroke();

            // 数值
            ctx.fillStyle = colors.primary;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(stat.value, x + cardWidth / 2, y + 55);

            // 标签
            ctx.fillStyle = colors.textSecondary;
            ctx.font = '18px sans-serif';
            ctx.fillText(stat.label, x + cardWidth / 2, y + 90);
        });

        return y + cardHeight + 10;
    }

    /**
     * 绘制活跃时段图表
     */
    private drawActiveHours(ctx: any, data: Record<number, number>, y: number, colors: any): number {
        const chartHeight = 200;
        const chartWidth = 1000;
        const chartX = (this.width - chartWidth) / 2;

        // 标题
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('📊 活跃时段分析', chartX, y);

        y += 40;

        // 图表背景
        ctx.fillStyle = colors.cardBg;
        this.roundRect(ctx, chartX, y, chartWidth, chartHeight, 12);
        ctx.fill();

        // 绘制柱状图
        const maxValue = Math.max(...Object.values(data));
        const barWidth = chartWidth / 24 - 4;
        const barPadding = 4;

        Object.entries(data).forEach(([hour, count], i) => {
            const barHeight = (count / maxValue) * (chartHeight - 40);
            const barX = chartX + i * (barWidth + barPadding) + 10;
            const barY = y + chartHeight - barHeight - 20;

            // 柱子
            ctx.fillStyle = colors.primary;
            this.roundRect(ctx, barX, barY, barWidth, barHeight, 4);
            ctx.fill();

            // 小时标签（每4小时显示一次）
            if (parseInt(hour) % 4 === 0) {
                ctx.fillStyle = colors.textSecondary;
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(hour, barX + barWidth / 2, y + chartHeight - 5);
            }
        });

        return y + chartHeight + 10;
    }

    /**
     * 绘制用户排行
     */
    private drawTopUsers(ctx: any, users: any[], y: number, colors: any): number {
        const top5 = users.slice(0, 5);

        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('👥 发言排行榜', 100, y);

        y += 40;

        top5.forEach((user, i) => {
            const itemY = y + i * 50;

            // 排名
            ctx.fillStyle = i < 3 ? colors.accent : colors.primary;
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${i + 1}`, 120, itemY + 30);

            // 用户名
            ctx.fillStyle = colors.text;
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'left';
            const username = user.username.length > 15
                ? user.username.substring(0, 15) + '...'
                : user.username;
            ctx.fillText(username, 180, itemY + 30);

            // 消息数
            ctx.fillStyle = colors.textSecondary;
            ctx.font = '18px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${user.messageCount} 条消息`, 1100, itemY + 30);
        });

        return y + top5.length * 50 + 10;
    }

    /**
     * 绘制话题
     */
    private drawTopics(ctx: any, topics: any[], y: number, colors: any): number {
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('💡 热门话题', 100, y);

        y += 40;

        topics.slice(0, 3).forEach((topic, i) => {
            const itemY = y + i * 60;

            // 话题标题
            ctx.fillStyle = colors.primary;
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`• ${topic.title}`, 120, itemY + 10);

            // 话题描述
            ctx.fillStyle = colors.textSecondary;
            ctx.font = '16px sans-serif';
            const desc = topic.summary.length > 80
                ? topic.summary.substring(0, 80) + '...'
                : topic.summary;
            ctx.fillText(desc, 140, itemY + 35);
        });

        return y + topics.slice(0, 3).length * 60 + 10;
    }

    /**
     * 绘制金句
     */
    private drawGoldenQuotes(ctx: any, quotes: any[], y: number, colors: any): number {
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('✨ 群聊金句', 100, y);

        y += 40;

        quotes.slice(0, 2).forEach((quote, i) => {
            const itemY = y + i * 80;

            // 引用框
            ctx.fillStyle = colors.cardBg;
            this.roundRect(ctx, 100, itemY, 1000, 70, 8);
            ctx.fill();

            ctx.strokeStyle = colors.primary;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(105, itemY + 5);
            ctx.lineTo(105, itemY + 65);
            ctx.stroke();

            // 金句内容
            ctx.fillStyle = colors.text;
            ctx.font = 'italic 18px sans-serif';
            ctx.textAlign = 'left';
            const text = quote.content.length > 60
                ? quote.content.substring(0, 60) + '...'
                : quote.content;
            ctx.fillText(`"${text}"`, 130, itemY + 30);

            // 作者
            ctx.fillStyle = colors.textSecondary;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`— ${quote.username}`, 1080, itemY + 55);
        });

        return y + quotes.slice(0, 2).length * 80 + 10;
    }

    /**
     * 绘制页脚
     */
    private drawFooter(ctx: any, date: string, colors: any) {
        ctx.fillStyle = colors.textSecondary;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`生成时间: ${date}`, this.width / 2, this.height - 40);
        ctx.fillText('由 NapGram 群组分析插件生成', this.width / 2, this.height - 20);
    }

    /**
     * 绘制圆角矩形
     */
    private roundRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}
