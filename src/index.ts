import { App, SlackEventMiddlewareArgs } from '@slack/bolt';
import dotenv from 'dotenv';
import express from 'express';

// Load environment variables
dotenv.config();

// Initialize the Slack app with HTTP mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Create an Express app for health checks
const expressApp = express();

// Health check endpoint
expressApp.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Handle app_mention events (when the bot is mentioned)
app.event('app_mention', async ({ event, say }: SlackEventMiddlewareArgs<'app_mention'>) => {
  try {
    await say({
      text: `Hello <@${event.user}>! I heard you mention me.`,
      thread_ts: event.thread_ts || event.ts,
    });
  } catch (error) {
    console.error('Error handling app_mention:', error);
  }
});

// Handle message events in threads
app.event('message', async ({ event, say }: SlackEventMiddlewareArgs<'message'>) => {
  // Only respond to messages in threads
  if ('thread_ts' in event && event.thread_ts) {
    try {
      await say({
        text: `I see you're responding in a thread!`,
        thread_ts: event.thread_ts,
      });
    } catch (error) {
      console.error('Error handling thread message:', error);
    }
  }
});

// Start the app
const port = process.env.PORT || 8080;

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Start the Express server for health checks
expressApp.listen(port, () => {
  console.log(`Health check server running on port ${port}`);
});

// Start the Slack app
(async () => {
  try {
    await app.start(port);
    console.log(`⚡️ Bolt app is running on port ${port}!`);
  } catch (error) {
    console.error('Failed to start Slack app:', error);
    process.exit(1);
  }
})(); 