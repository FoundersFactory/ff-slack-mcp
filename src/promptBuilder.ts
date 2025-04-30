//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { App } from '@slack/bolt';
// import { getRAGContext } from './getRAGContext';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

const orgChart = `**Henry Lane Fox — Chief Executive Officer**  
├── **Damian Routley — Chief Operating Officer**  
│   ├── Ellie Slaght — Head of Accelerator Operations  
│   ├── Charlotta Kemp — Program & Community Lead, Western Australia  
│   ├── **Liv — Head of Investments, Blue Action & WA**  
│   │   ├── Edo — Investor, Fastweb & Pico  
│   │   ├── Elena — Investor, Mediobanca  
│   │   └── Jack Kennedy — Investor, Rio Tinto  
│   ├── Chris Cadeo — Sector Director, Singapore  
│   ├── Andrea Guzzoni — Sector Director, Mediobanca & Fastweb  
│   ├── Levi Young — Sector Director, Pico  
│   ├── Olly Betts — Sector Director, Aviva  
│   └── Tamryn Barker — Sector Director, Western Australia & Rio Tinto  

├── **Farah Kanji — Chief People Officer**  
│   └── **Raluca Ciobancan — Head of Talent**  
│       └── Sara Foster — Talent & Community Lead  

├── **Claire Morris — Chief Studio Officer**  
│   ├── Ed Harding — Head of Studio Operations  
│   ├── Alberto Mucci — Studio Lead  
│   ├── Conny Reh — Studio Lead  
│   ├── **Jacob George — Director of Product**  
│   │   └── Serena Rizzo — Product Coach  
│   ├── Jack Howell — Tech & Data Lead  
│   ├── **Sahil Sachdev — Director of New Ventures**  
│   │   ├── Alex Daish — Venture Designer  
│   │   └── Giulio Brugnaro — Venture Designer  
│   ├── Daniel — Venture Builder  
│   ├── Max — Venture Builder  
│   └── Michele — Venture Builder  

├── **George Northcott — President, Expansion**  
│   └── Nick le Fevre — Director of Partnerships  

├── **Lee Bernasconi — Chief Marketing Officer**  
│   ├── Liam Nolan — Head of Growth  
│   └── Simon Lovick — Content & Editorial Lead  

├── **Frank Webster — General Counsel**  
│   └── Peter Wilkie — Legal Counsel  

├── **Emma-Jane (EJ) Willan — Chief Finance Officer**  
│   └── Simon Wheeldon — Head of Finance  

├── David Hickson — Chief Strategic Development Officer  
└── Kate Nussrainer — EA to Henry Lane Fox  `

export class PromptBuilder {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async buildSystemPrompt(threadTs?: string, userNames: string[] = [], message?: string): Promise<string> {
    const basePrompt = `You are a helpful assistant in a Slack workspace. Be concise but friendly in your responses. Answer using the fewest words possible without losing meaning. Avoid filler, repetition, and unnecessary detail.`;
    
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
    
    // if (message) {
    //   const ragContext = await getRAGContext(message);
    //   finalPrompt += `\n\nHere is some relevant context for your response: ${ragContext}`;
    // }

    return finalPrompt;
  }
}