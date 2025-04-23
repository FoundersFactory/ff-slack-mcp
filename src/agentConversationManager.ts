import OpenAI from 'openai';
import { App } from '@slack/bolt';

export class ConversationManager {
  private openai: OpenAI;
  private conversationHistory: Map<string, any[]> = new Map();
  private threadTimestamps: Map<string, string> = new Map();

  constructor(private app: App) {
    // Initialize the OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get the conversation key based on user ID and thread timestamp
   */
  private getConversationKey(userId: string, threadTs?: string): string {
    return threadTs ? `${userId}-${threadTs}` : userId;
  }

  /**
   * Fetch conversation history from Slack
   */
  private async fetchSlackHistory(channelId: string, threadTs?: string): Promise<any[]> {
    try {
      let result;
      if (threadTs) {
        // Fetch thread history
        result = await this.app.client.conversations.replies({
          channel: channelId,
          ts: threadTs,
          limit: 100
        });
      } else {
        // Fetch DM history
        result = await this.app.client.conversations.history({
          channel: channelId,
          limit: 10
        });
      }

      if (!result.messages) return [];

      // Get the bot's user ID
      const botInfo = await this.app.client.auth.test();
      const botUserId = botInfo.user_id;

      return result.messages.map(msg => ({
        role: msg.user === botUserId ? 'assistant' : 'user',
        content: msg.text || ''
      }));
    } catch (error) {
      console.error('Error fetching Slack history:', error);
      return [];
    }
  }

  /**
   * Handle a message from a user, whether it's a new conversation or continuing one
   */
  public async handleMessage(userId: string, channelId: string, message: string, threadTs?: string) {
    try {
      // Store thread timestamp if provided
      if (threadTs) {
        this.threadTimestamps.set(userId, threadTs);
      }

      // Get the conversation key
      const conversationKey = this.getConversationKey(userId, threadTs);
      
      // Fetch recent messages from Slack
      const slackHistory = await this.fetchSlackHistory(channelId, threadTs);
      
      // Get the stored history for this specific conversation
      const history = this.conversationHistory.get(conversationKey) || [];
      
      // Add the new message
      history.push({ role: 'user', content: message });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant in a Slack workspace. Be ultra-concise but friendly in your responses. Answer using the fewest words possible without losing meaning. Avoid filler, repetition, and unnecessary detail.

If a message is just a general comment about you or doesn't require a response (like "woah, it did it!"), simply respond with "NO_RESPONSE_NEEDED". Only respond with actual content when you can add value to the conversation.`
          },
          ...slackHistory,
          ...history
        ],
      });

      const reply = response.choices[0].message.content;
      
      // If the agent indicates no response is needed, return early
      if (reply?.includes('NO_RESPONSE_NEEDED')) {
        console.log('Agent determined no response was needed');
        return null;
      }
      
      // Update the conversation history
      history.push({ role: 'assistant', content: reply });
      this.conversationHistory.set(conversationKey, history);

      // Send the response back to Slack
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

  /**
   * Clear conversation history for a user
   */
  public clearConversationHistory(userId: string, threadTs?: string) {
    const conversationKey = this.getConversationKey(userId, threadTs);
    this.conversationHistory.delete(conversationKey);
    if (!threadTs) {
      this.threadTimestamps.delete(userId);
    }
  }
} 