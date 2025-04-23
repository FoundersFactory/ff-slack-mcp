import { App, LogLevel } from '@slack/bolt';
import { ExpressReceiver } from '@slack/bolt';
import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the Express receiver for Slack
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
});

// Initialize the Slack app with the Express receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
  logLevel: LogLevel.DEBUG,
});

// Add middleware to parse JSON bodies
receiver.app.use(express.json());

// Health check endpoint
receiver.app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Add URL verification endpoint
receiver.app.post('/', (req, res, next) => {
  console.log('Received request:', req.body);
  
  if (req.body.type === 'url_verification') {
    console.log('Handling URL verification');
    res.json({ challenge: req.body.challenge });
  } else {
    console.log('Forwarding to Slack receiver');
    next();
  }
});

// Handle app_mention events
app.event('app_mention', async ({ event, say }) => {
  console.log('Received app_mention event:', event);
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
app.event('message', async ({ event, say }) => {
  console.log('Received message event:', event);
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