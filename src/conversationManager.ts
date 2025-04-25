import OpenAI from 'openai';
import { App } from '@slack/bolt';
import { PromptBuilder } from './promptBuilder';

export class ConversationManager {
  private openai: OpenAI;
  private promptBuilder: PromptBuilder;

  constructor(private app: App) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.promptBuilder = new PromptBuilder(app);
  }

  //
  // Analyze thread history to get user IDs and check if bot should respond
  //

  private async analyzeThreadHistory(
    channelId: string,
    botUserId: string,
    currentUserId: string,
    threadTs?: string
  ): Promise<{ shouldRespond: boolean; userIds: string[]; slackHistory: any[] }> {
    try {
      const result = threadTs
        ? await this.app.client.conversations.replies({ channel: channelId, ts: threadTs, limit: 100 })
        : await this.app.client.conversations.history({ channel: channelId, limit: 10 });
  
      const messages = threadTs ? result.messages : result.messages?.reverse();
      if (!messages) return { shouldRespond: false, userIds: [currentUserId], slackHistory: [] };
  
      const userIds = new Set<string>([currentUserId]);
      let lastUserMentionTs: string | null = null;
      let lastBotMentionTs: string | null = null;
  
      messages.forEach(msg => {
        if (msg.user) userIds.add(msg.user);
        if (msg.text && msg.ts) {
          const mentions = msg.text.match(/<@[^>]+>/g) || [];
          if (mentions.length > 0) {
            const hasBotMention = mentions.some(m => m.includes(botUserId));
            if (hasBotMention) lastBotMentionTs = msg.ts;
            else lastUserMentionTs = msg.ts;
          }
        }
      });
  
      const shouldRespond = !lastUserMentionTs ||
        (lastBotMentionTs !== null && parseFloat(lastBotMentionTs) > parseFloat(lastUserMentionTs || '0'));
  
      if (!shouldRespond) {
        return {
          shouldRespond: false,
          userIds: Array.from(userIds),
          slackHistory: []
        };
      }
  
      const userIdList = Array.from(userIds);
      const userNames = await Promise.all(
        userIdList.map(async (id) => {
          try {
            const { user } = await this.app.client.users.info({ user: id });
            return user?.real_name || '';
          } catch {
            return '';
          }
        })
      );
  
      const userIdToName = new Map<string, string>();
      userIdList.forEach((id, index) => {
        const realName = userNames[index] || `user_${id}`;
        const sanitized = realName.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
        userIdToName.set(id, sanitized);
      });
  
      const slackHistory = messages.map(msg => {
        const role = msg.user === botUserId ? 'assistant' : 'user';
        const name = msg.user ? userIdToName.get(msg.user) : undefined;
  
        return {
          role,
          content: msg.text || '',
          ...(name ? { name } : {})
        };
      });
  
      return {
        shouldRespond: true,
        userIds: userIdList,
        slackHistory
      };
    } catch (error) {
      console.error('Error analyzing history:', error);
      return {
        shouldRespond: false,
        userIds: [currentUserId],
        slackHistory: []
      };
    }
  }

  //
  // Handle a message from a user, whether it's a new conversation or continuing one
  //

  public async handleMessage(userId: string, channelId: string, message: string, threadTs?: string) {
    try {
      const botInfo = await this.app.client.auth.test();
      const botUserId = botInfo.user_id || '';
      const { shouldRespond, userIds: collectedUserIds, slackHistory } = await this.analyzeThreadHistory(channelId, botUserId, userId, threadTs);
      
      if (!shouldRespond) {
        console.log('Skipping response: Tagged another user');
        return null;
      }

      slackHistory.push({ role: 'user', content: message });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: await this.promptBuilder.buildSystemPrompt(threadTs, collectedUserIds)
          },
          ...slackHistory
        ],
      });

      const reply = response.choices[0].message.content;
      
      if (reply?.includes('NO_RESPONSE_NEEDED')) {
        console.log('Skipping response: No response needed');
        return null;
      }

      await this.app.client.chat.postMessage({
        channel: channelId,
        text: reply || 'I apologize, but I could not generate a response.',
        thread_ts: threadTs
      });

      return reply;
    } catch (error) {
      console.error('Error handling message:', error);
      throw error;
    }
  }
} 