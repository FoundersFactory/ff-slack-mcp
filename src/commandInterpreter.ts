import { App, SlackActionMiddlewareArgs, BlockAction, AllMiddlewareArgs } from '@slack/bolt';

interface Command {
  name: string;
  description: string;
  execute: (args: string[], userId: string, channelId: string, threadTs?: string) => Promise<void>;
}

interface TeamMember {
  id: string;
  name: string;
  checked: boolean;
}

interface Ticklist {
  expiryDate: Date;
  members: TeamMember[];
  createdBy: string;
  channelId: string;
  threadTs?: string;
}

export class CommandInterpreter {
  private commands: Map<string, Command>;
  private activeTicklists: Map<string, Ticklist>;

  constructor(private app: App) {
    this.commands = new Map();
    this.activeTicklists = new Map();
    this.registerDefaultCommands();
  }

  private async fetchTeamMembers(): Promise<TeamMember[]> {
    try {
      const response = await fetch('https://api.studio.foundersfactory.co/team?teamMembers=all');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.map((member: any) => ({
        id: member.id,
        name: member.fields["Name"],
        checked: false
      }));
    } catch (error) {
      console.error('Error fetching team members:', error);
      throw new Error('Failed to fetch team members');
    }
  }

  private formatTicklist(ticklist: Ticklist): string {
    const expiryDate = ticklist.expiryDate.toLocaleDateString();
    const membersList = ticklist.members
      .map(member => `${member.checked ? '✅' : '⬜️'} ${member.name}`)
      .join('\n');
    
    return `*Ticklist (Expires: ${expiryDate})*\n${membersList}`;
  }

  private registerDefaultCommands() {
    this.registerCommand({
      name: 'help',
      description: 'Shows all available commands',
      execute: async (args, userId, channelId, threadTs) => {
        const helpText = Array.from(this.commands.values())
          .map(cmd => `• \`${cmd.name}\`: ${cmd.description}`)
          .join('\n');
        
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: `Available commands:\n${helpText}`,
          thread_ts: threadTs
        });
      }
    });

    this.registerCommand({
      name: 'ping',
      description: 'Check if the bot is responsive',
      execute: async (args, userId, channelId, threadTs) => {
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: 'Pong! 🏓',
          thread_ts: threadTs
        });
      }
    });

    this.registerCommand({
      name: 'founder121',
      description: 'Create a team member ticklist with expiry date',
      execute: async (args, userId, channelId, threadTs) => {
        if (args.length === 0) {
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: 'Please provide an expiry date in YYYY-MM-DD format. Example: `!founder121 2024-03-31`',
            thread_ts: threadTs
          });
          return;
        }

        const expiryDate = new Date(args[0]);
        if (isNaN(expiryDate.getTime())) {
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: 'Invalid date format. Please use YYYY-MM-DD format.',
            thread_ts: threadTs
          });
          return;
        }

        try {
          const teamMembers = await this.fetchTeamMembers();
          const ticklist: Ticklist = {
            expiryDate,
            members: teamMembers,
            createdBy: userId,
            channelId,
            threadTs
          };

          const ticklistId = `${channelId}-${threadTs || 'main'}`;
          this.activeTicklists.set(ticklistId, ticklist);

          const message = this.formatTicklist(ticklist);
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: message,
            thread_ts: threadTs,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: message
                }
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'Submit Ticklist',
                      emoji: true
                    },
                    style: 'primary',
                    value: `submit_${ticklistId}`
                  }
                ]
              }
            ]
          });
        } catch (error) {
          console.error('Error creating ticklist:', error);
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: 'Failed to create ticklist. Please try again later.',
            thread_ts: threadTs
          });
        }
      }
    });

    // Add action handler for ticklist buttons
    this.app.action('submit_ticklist', async ({ ack, body, action }) => {
      await ack();
      
      const actionBody = body as BlockAction;
      const ticklistId = action.value.replace('submit_', '');
      const ticklist = this.activeTicklists.get(ticklistId);
      
      if (!ticklist || !actionBody.channel?.id) {
        await this.app.client.chat.postMessage({
          channel: actionBody.channel?.id || '',
          text: 'This ticklist is no longer active.',
          thread_ts: actionBody.message?.thread_ts
        });
        return;
      }

      const checkedMembers = ticklist.members.filter(m => m.checked);
      const message = `*Submitted Ticklist*\nChecked members:\n${checkedMembers.map(m => `• ${m.name}`).join('\n')}`;
      
      await this.app.client.chat.postMessage({
        channel: actionBody.channel.id,
        text: message,
        thread_ts: actionBody.message?.thread_ts
      });

      this.activeTicklists.delete(ticklistId);
    });

    // Add action handler for checkboxes
    this.app.action('check_member', async ({ ack, body, action }) => {
      await ack();
      
      const actionBody = body as BlockAction;
      const [, ticklistId, memberId] = action.value.match(/^check_(.+)_(.+)$/) || [];
      if (!ticklistId || !memberId || !actionBody.channel?.id) return;

      const ticklist = this.activeTicklists.get(ticklistId);
      if (!ticklist) return;

      const member = ticklist.members.find(m => m.id === memberId);
      if (member) {
        member.checked = !member.checked;
        const message = this.formatTicklist(ticklist);
        
        await this.app.client.chat.update({
          channel: actionBody.channel.id,
          ts: actionBody.message?.ts || '',
          text: message,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: message
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Submit Ticklist',
                    emoji: true
                  },
                  style: 'primary',
                  value: `submit_${ticklistId}`
                }
              ]
            }
          ]
        });
      }
    });
  }

  public registerCommand(command: Command) {
    this.commands.set(command.name, command);
  }

  public async interpretMessage(message: string, userId: string, channelId: string, threadTs?: string): Promise<boolean> {
    // Check if the message starts with a command
    const commandMatch = message.trim().match(/^!(\w+)(?:\s+(.+))?$/);
    if (!commandMatch) {
      return false; // Not a command
    }

    const [, commandName, argsString] = commandMatch;
    const command = this.commands.get(commandName);

    if (!command) {
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: `Unknown command: ${commandName}. Use \`!help\` to see available commands.`,
        thread_ts: threadTs
      });
      return true; // It was a command attempt, even if invalid
    }

    try {
      const args = argsString ? argsString.split(/\s+/) : [];
      await command.execute(args, userId, channelId, threadTs);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      await this.app.client.chat.postMessage({
        channel: channelId,
        text: `Error executing command ${commandName}. Please try again later.`,
        thread_ts: threadTs
      });
    }

    return true; // It was a command
  }
} 