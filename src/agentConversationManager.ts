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
   * Start a new conversation with a user
   */
  public async startConversation(userId: string, channelId: string, initialMessage: string, threadTs?: string) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant in a Slack workspace. Be concise and friendly in your responses.'
          },
          {
            role: 'user',
            content: initialMessage
          }
        ],
      });

      const reply = response.choices[0].message.content;
      
      // Store the conversation history
      this.conversationHistory.set(userId, [
        { role: 'user', content: initialMessage },
        { role: 'assistant', content: reply }
      ]);

      // Store thread timestamp if provided
      if (threadTs) {
        this.threadTimestamps.set(userId, threadTs);
      }

      // Send the response back to Slack
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: reply || 'I apologize, but I could not generate a response.',
        thread_ts: threadTs
      });

      return reply;
    } catch (error) {
      console.error('Error in startConversation:', error);
      throw error;
    }
  }

  /**
   * Continue an existing conversation
   */
  public async continueConversation(userId: string, channelId: string, message: string) {
    try {
      const history = this.conversationHistory.get(userId) || [];
      const threadTs = this.threadTimestamps.get(userId);
      
      // Add the new message to the history
      history.push({ role: 'user', content: message });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant in a Slack workspace. Be concise and friendly in your responses.'
          },
          ...history
        ],
      });

      const reply = response.choices[0].message.content;
      
      // Update the conversation history
      history.push({ role: 'assistant', content: reply });
      this.conversationHistory.set(userId, history);

      // Send the response back to Slack
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: reply || 'I apologize, but I could not generate a response.',
        thread_ts: threadTs
      });

      return reply;
    } catch (error) {
      console.error('Error in continueConversation:', error);
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