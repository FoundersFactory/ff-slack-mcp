import { App, LogLevel } from '@slack/bolt';
import { ExpressReceiver } from '@slack/bolt';
import express from 'express';
import dotenv from 'dotenv';
import { ConversationManager } from './agentConversationManager';

// Load environment variables
dotenv.config();

// Initialize the Express receiver for Slack
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
});

// Initialize the Slack app with the Express receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN || '',
  receiver,
  logLevel: LogLevel.DEBUG,
});

// Initialize the conversation manager
const conversationManager = new ConversationManager(app);

// Add middleware to parse JSON bodies
receiver.app.use(express.json());

receiver.app.use((req, res, next) => {
  if (req.body?.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }
  next();
});

// Handle app_mention events
app.event('app_mention', async ({ event, say }) => {
  console.log('Received app_mention event:', event);
  try {
    if (event.text && event.user && event.channel) {
      await conversationManager.handleMessage(
        event.user,
        event.channel,
        event.text.replace(/<@[^>]+>/, '').trim(),
        event.thread_ts || event.ts
      );
    }
  } catch (error) {
    console.error('Error handling app_mention:', error);
    await say({
      text: `Sorry, I encountered an error. Please try again later.`,
      thread_ts: event.thread_ts || event.ts,
    });
  }
});

// Handle message events in threads and direct messages
app.event('message', async ({ event, say }) => {
  console.log('Received message event:', event);
  
  // Check if it's a direct message (channel starts with 'D')
  if (event.channel.startsWith('D') && 'user' in event && 'text' in event) {
    const messageEvent = event as { user: string; text: string; channel: string };
    try {
      await conversationManager.handleMessage(
        messageEvent.user,
        messageEvent.channel,
        messageEvent.text
      );
    } catch (error) {
      console.error('Error handling direct message:', error);
      await say({
        text: `Sorry, I encountered an error. Please try again later.`
      });
    }
  }
  // Handle thread messages
  else if ('thread_ts' in event && event.thread_ts && 'user' in event && 'text' in event) {
    const messageEvent = event as { user: string; text: string; channel: string; thread_ts: string };
    
    // Get bot's user ID
    const botInfo = await app.client.auth.test();
    const botUserId = botInfo.user_id || '';
    
    // Fetch thread history
    const threadHistory = await app.client.conversations.replies({
      channel: messageEvent.channel,
      ts: messageEvent.thread_ts,
      limit: 100
    });

    if (!threadHistory.messages) {
      console.log('No thread history found');
      return;
    }

    // Track the most recent mention timestamps
    let lastUserMentionTs: string | null = null;
    let lastBotMentionTs: string | null = null;

    for (const msg of threadHistory.messages) {
      if (msg.text && msg.ts) {
        const mentions = msg.text.match(/<@[^>]+>/g) || [];
        if (mentions.length > 0) {
          // Check if this message contains a bot mention
          const hasBotMention = mentions.some(mention => mention.includes(botUserId));
          if (hasBotMention) {
            lastBotMentionTs = msg.ts;
          } else {
            lastUserMentionTs = msg.ts;
          }
        }
      }
    }
    
    // Only respond if:
    // 1. There are no mentions at all, or
    // 2. The bot was mentioned more recently than any user
    const shouldRespond = !lastUserMentionTs || 
      (lastBotMentionTs && parseFloat(lastBotMentionTs) > parseFloat(lastUserMentionTs));

    if (shouldRespond) {
      try {
        await conversationManager.handleMessage(
          messageEvent.user,
          messageEvent.channel,
          messageEvent.text,
          messageEvent.thread_ts
        );
      } catch (error) {
        console.error('Error handling thread message:', error);
        await say({
          text: `Sorry, I encountered an error. Please try again later.`,
          thread_ts: messageEvent.thread_ts,
        });
      }
    } else {
      console.log('Skipping response: Last user mention is more recent than last bot mention');
    }
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Start the app
const port = process.env.PORT || 8080;

// Start the server
(async () => {
  try {
    await app.start(port);
    console.log(`⚡️ Bolt app is running on port ${port}!`);
  } catch (error) {
    console.error('Failed to start Slack app:', error);
    process.exit(1);
  }
})();

export default receiver.app; 