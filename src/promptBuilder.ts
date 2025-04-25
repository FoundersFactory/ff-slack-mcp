import { App } from '@slack/bolt';

export class PromptBuilder {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async buildSystemPrompt(threadTs?: string, userNames: string[] = []): Promise<string> {
    const basePrompt = `You are a helpful assistant in a Slack workspace. Be ultra-concise but friendly in your responses. Answer using the fewest words possible without losing meaning. Avoid filler, repetition, and unnecessary detail.`;

    let personalizedPrompt = basePrompt;

    const uniqueNames = [...new Set(userNames.filter(Boolean))];
    if (uniqueNames.length === 1) {
      personalizedPrompt += `\n\nYou are talking to ${uniqueNames[0]}.`;
    } else if (uniqueNames.length === 2) {
      personalizedPrompt += `\n\nYou are talking to ${uniqueNames[0]} and ${uniqueNames[1]}.`;
    } else if (uniqueNames.length >= 3) {
      const last = uniqueNames.pop();
      personalizedPrompt += `\n\nYou are talking to ${uniqueNames.join(', ')}, and ${last}.`;
    }

    if (threadTs) {
      return `${personalizedPrompt}\n\nIf a message is just a general comment about you or doesn't require a response (like "woah, it did it!"), simply respond with "NO_RESPONSE_NEEDED". Only respond with actual content when you can add value to the conversation.`;
    }

    return personalizedPrompt;
  }
}