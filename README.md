# Slack Bot Application

This is a TypeScript Express.js application that connects to Slack to receive and send messages when mentioned or responded to in threads.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Slack workspace where you can create apps
- Slack app credentials (Bot Token and Signing Secret)

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_SIGNING_SECRET=your-signing-secret
   PORT=3000
   ```

4. To get your Slack credentials:
   - Go to [api.slack.com/apps](https://api.slack.com/apps)
   - Create a new app
   - Under "OAuth & Permissions", add the following bot token scopes:
     - `app_mentions:read`
     - `channels:history`
     - `chat:write`
     - `im:history`
     - `mpim:history`
   - Install the app to your workspace
   - Copy the Bot User OAuth Token and Signing Secret

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Features

- Responds to mentions of the bot
- Responds to messages in threads
- Basic Express server setup

## Testing

The bot will respond to:
1. Direct mentions of the bot
2. Messages in threads where the bot is present 