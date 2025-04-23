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

      // Fetch recent messages from Slack
      const slackHistory = await this.fetchSlackHistory(channelId, threadTs);
      
      // Combine Slack history with our stored history
      const history = this.conversationHistory.get(userId) || [];
      const combinedHistory = [...slackHistory, ...history];

      // Add the new message
      combinedHistory.push({ role: 'user', content: message });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant in a Slack workspace. Be ultra-concise but friendly in your responses. Answer using the fewest words possible without losing meaning. Avoid filler, repetition, and unnecessary detail.'
          },
          ...combinedHistory
        ],
      });

      const reply = response.choices[0].message.content;
      
      // Update the conversation history
      history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: reply }
      );
      this.conversationHistory.set(userId, history);

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
  public clearConversationHistory(userId: string) {
    this.conversationHistory.delete(userId);
    this.threadTimestamps.delete(userId);
  }
} 