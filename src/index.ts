/**
 * NapGram 群组分析插件
 */

import { definePlugin, createCommand } from '@napgram/sdk';
import { GroupAnalysisService } from './services/analysis';
import { validateConfig } from './config';
import type { PluginConfig } from './types';

const plugin = definePlugin({
  id: 'group-analysis',
  name: '群组分析',
  version: '0.1.0',
  description: '群聊数据分析插件，支持多维度统计、智能话题总结、用户称号分析和金句提取',

  async install(ctx, config) {
    // 验证配置
    let validatedConfig: PluginConfig;
    try {
      validatedConfig = validateConfig(config as Partial<PluginConfig>);
    } catch (error) {
      ctx.logger.error('配置验证失败:', error);
      throw error;
    }

    ctx.logger.info('群组分析插件已加载');

    // 创建分析服务
    const analysisService = new GroupAnalysisService(ctx, validatedConfig);

    // 注册命令
    const groupAnalysisCommand = createCommand({
      name: '群分析',
      description: '分析群聊记录',
      handler: async (event, args) => {
        // 解析参数
        let days = 1;
        if (args.length > 0) {
          const parsed = parseInt(args[0]);
          if (!isNaN(parsed) && parsed > 0) {
            days = Math.min(parsed, 30); // 最多30天
          }
        }

        await analysisService.executeGroupAnalysis(event, days);
      }
    });

    ctx.command(groupAnalysisCommand);
    ctx.logger.info('群分析命令已注册');
  },

  async uninstall() {
    // 清理资源（如有）
  }
});

export default plugin;
