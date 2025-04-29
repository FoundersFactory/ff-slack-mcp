import { App, LogLevel } from '@slack/bolt';
import { ExpressReceiver } from '@slack/bolt';
import express from 'express';
import dotenv from 'dotenv';
import { ConversationManager } from './conversationManager';

//
// Initilises express & Slack app (bolt)
//

dotenv.config();

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN || '',
  receiver,
  logLevel: LogLevel.DEBUG,
});

const conversationManager = new ConversationManager(app);

receiver.app.use(express.json());
receiver.app.use((req, res, next) => {
  if (req.body?.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }
  next();
});

//
// Handle events from Slack
//

app.event('app_mention', async ({ event, say }) => {
  console.log('Received app_mention event:', event);
  try {
    // Skip if this is a thread message or a DM
    if (event.thread_ts || event.channel.startsWith('D')) { return; }

    if (event.text && event.user && event.channel) {
      await conversationManager.handleMessage(
        event.user,
        event.channel,
        event.text.replace(/<@[^>]+>/, '').trim(),
        event.ts
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
  
  if ('thread_ts' in event && event.thread_ts && 'user' in event && 'text' in event) {
    const messageEvent = event as { user: string; text: string; channel: string; thread_ts: string };
    
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
  }
});

//
// Top level error handling
//

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

//
// Start the app & server
//

const port = process.env.PORT || 8080;

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