//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { App } from '@slack/bolt';
// import { getRAGContext } from './getRAGContext';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

const orgChart = `CEO: Henry Lane Fox <henry@ff.co>
├─ COO: Damian Routley <damian@foundersfactory.co>
│  ├─ Head of Accelerator Operations: Ellie Slaght <ellie@foundersfactory.co>
│  ├─ Program & Community Lead WA: Charlotta Kemp <charlotta.kemp@foundersfactory.co>
│  ├─ Head of Investments Blue Action & WA: Olivia Brooks <olivia.brooks@foundersfactory.co>
│  │  ├─ Investor Fastweb & Pico: Edo Gentili <edoardo.gentili@foundersfactory.co>
│  │  ├─ Investor Mediobanca: Elena Vittone <elena.vittone@foundersfactory.co>
│  │  └─ Investor Rio Tinto: Jack Kennedy <jack.kennedy@foundersfactory.co>
│  ├─ Sector Director Singapore: Chris Cadeo <chris.cadeo@foundersfactory.co>
│  ├─ Sector Director Mediobanca & Fastweb: Andrea Guzzoni <andrea.guzzoni@foundersfactory.co>
│  ├─ Sector Director Pico: Levi Young <levi.young@foundersfactory.co>
│  ├─ Sector Director Aviva: Olly Betts <olly.betts@foundersfactory.co>
│  └─ Sector Director WA & Rio Tinto: Tamryn Barker <tamryn.barker@foundersfactory.co>
├─ Chief People Officer: Farah Kanji <farah.kanji@foundersfactory.co>
│  └─ Head of Talent: Raluca Ciobancan <raluca.ciobancan@foundersfactory.co>
│     └─ Talent & Community Lead: Sara Foster <sara.foster@foundersfactory.co>
├─ Chief Studio Officer: Claire Morris <claire@foundersfactory.co>
│  ├─ Head of Studio Operations: Ed Harding <ed.harding@foundersfactory.co>
│  ├─ Studio Lead: Alberto Mucci <alberto.mucci@foundersfactory.co>
│  ├─ Studio Lead: Conny Reh <conny.reh@foundersfactory.co>
│  ├─ Director of Product: Jacob George <jacob.george@foundersfactory.co>
│  │  └─ Product Coach: Serena Rizzo <serena.rizzo@foundersfactory.co>
│  ├─ Director of New Ventures: Sahil Sachdev <sahil.sachdev@foundersfactory.co>
│  │  ├─ Venture Designer: Alex Daish <alex.daish@foundersfactory.co>
│  │  └─ Venture Designer: Giulio Brugnaro <giulio.brugnaro@foundersfactory.co>
│  ├─ Venture Builder: Daniel Roden <daniel.roden@foundersfactory.co>
│  ├─ Venture Builder: Max Glintschert <max.glintschert@foundersfactory.co>
│  └─ Venture Builder: Michele Cipollone <michele.cipollone@foundersfactory.co>
├─ President Expansion: George Northcott <george@foundersfactory.co>
│  └─ Director of Partnerships: Nick le Fevre <nick@foundersfactory.co>
├─ Chief Marketing Officer: Lee Bernasconi <lee@foundersfactory.co>
│  ├─ Head of Growth: Liam Nolan <liam.nolan@foundersfactory.co>
│  └─ Content & Editorial Lead: Simon Lovick <simon.lovick@foundersfactory.co>
├─ General Counsel: Frank Webster <frank@foundersfactory.co>
│  └─ Legal Counsel: Peter Wilkie <peter.wilkie@foundersfactory.co>
├─ Chief Finance Officer: Emma-Jane Willan <emma-jane.willan@foundersfactory.co>
│  └─ Head of Finance: Simon Wheeldon <simon.wheeldon@foundersfactory.co>
├─ Chief Strategic Development Officer: David Hickson <david@foundersfactory.co>
└─ EA to CEO: Kate Nussrainer <kate@ff.co>`

export class PromptBuilder {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async buildSystemPrompt(
    threadTs?: string, 
    userNames: string[] = [], 
    message?: string,
    toolList: { name: string; webhookPath: string; }[] = []
  ): Promise<string> {
    const basePrompt = `You are a helpful assistant in a Slack workspace. Be concise but friendly in your responses. Answer using the fewest words possible without losing meaning. Avoid filler, repetition, and unnecessary detail. If a relevant n8n tool is available from the n8nToolList, include its name in your response with an <n8n> tag`;
    
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
      personalizedPrompt = `${personalizedPrompt}\n\nIf a message is just a general comment about you, isn't a question, or doesn't require a response (like "woah, it did it!"), simply respond with "NO_RESPONSE_NEEDED". Only respond with actual content when you can add value to the conversation.`;
    }

    const orgChartPrompt = `Here is the org chart of the company in which you are operating: ${orgChart}`;
    
    let finalPrompt = `${personalizedPrompt}\n\n${orgChartPrompt}`;

    // Add available tools to the prompt
    if (toolList.length > 0) {
      const toolsPrompt = `\n\nYour n8nToolList:\n${toolList.map(tool => `- ${tool.name}: ${tool.webhookPath}`).join('\n')}`;
      finalPrompt += toolsPrompt;
    }
    
    return finalPrompt;
  }
}