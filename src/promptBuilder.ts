//Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import { App } from '@slack/bolt';
// import { getRAGContext } from './getRAGContext';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_COLLECTION_NAME = process.env.MONGO_COLLECTION_NAME;

const orgChart = `**Henry Lane Fox — Chief Executive Officer - henry@ff.co**  
├── **Damian Routley — Chief Operating Officer - Damian@foundersfactory.co**  
│   ├── Ellie Slaght — Head of Accelerator Operations - ellie@foundersfactory.co
│   ├── Charlotta Kemp — Program & Community Lead, Western Australia - charlotta.kemp@foundersfactory.co
│   ├── **Olivia Brooks — Head of Investments, Blue Action & WA - olivia.brooks@foundersfactory.co**  
│   │   ├── Edo Gentili — Investor, Fastweb & Pico - edoardo.gentili@foundersfactory.co
│   │   ├── Elena Vittone — Investor, Mediobanca - elena.vittone@foundersfactory.co
│   │   └── Jack Kennedy — Investor, Rio Tinto - jack.kennedy@foundersfactory.co
│   ├── Chris Cadeo — Sector Director, Singapore - chris.cadeo@foundersfactory.co
│   ├── Andrea Guzzoni — Sector Director, Mediobanca & Fastweb - andrea.guzzoni@foundersfactory.co
│   ├── Levi Young — Sector Director, Pico - levi.young@foundersfactory.co
│   ├── Olly Betts — Sector Director, Aviva - olly.betts@foundersfactory.co
│   └── Tamryn Barker — Sector Director, Western Australia & Rio Tinto - tamryn.barker@foundersfactory.co

├── **Farah Kanji — Chief People Officer - farah.kanji@foundersfactory.co**  
│   └── **Raluca Ciobancan — Head of Talent - raluca.ciobancan@foundersfactory.co**  
│       └── Sara Foster — Talent & Community Lead - sara.foster@foundersfactory.co

├── **Claire Morris — Chief Studio Officer - claire@foundersfactory.co**  
│   ├── Ed Harding — Head of Studio Operations - ed.harding@foundersfactory.co
│   ├── Alberto Mucci — Studio Lead - alberto.mucci@foundersfactory.co
│   ├── Conny Reh — Studio Lead - conny.reh@foundersfactory.co
│   ├── **Jacob George (JG) — Director of Product - jacob.george@foundersfactory.co**  
│   │   └── Serena Rizzo — Product Coach - serena.rizzo@foundersfactory.co
│   ├── Jack Howell — Tech & Data Lead - jack.howell@foundersfactory.co
│   ├── **Sahil Sachdev — Director of New Ventures - sahil.sachdev@foundersfactory.co**  
│   │   ├── Alex Daish — Venture Designer - alex.daish@foundersfactory.co
│   │   └── Giulio Brugnaro — Venture Designer - giulio.brugnaro@foundersfactory.co
│   ├── Daniel Roden — Venture Builder - daniel.roden@foundersfactory.co
│   ├── Max Glintschert — Venture Builder - max.glintschert@foundersfactory.co
│   └── Michele Cipollone — Venture Builder - michele.cipollone@foundersfactory.co

├── **George Northcott — President, Expansion  - george@foundersfactory.co**
│   └── Nick le Fevre — Director of Partnerships - nick@foundersfactory.co

├── **Lee Bernasconi — Chief Marketing Officer - lee@foundersfactory.co**  
│   ├── Liam Nolan — Head of Growth - liam.nolan@foundersfactory.co
│   └── Simon Lovick — Content & Editorial Lead - simon.lovick@foundersfactory.co

├── **Frank Webster — General Counsel - frank@foundersfactory.co**
│   └── Peter Wilkie — Legal Counsel - peter.wilkie@foundersfactory.co

├── **Emma-Jane (EJ) Willan — Chief Finance Officer - emma-jane.willan@foundersfactory.co**
│   └── Simon Wheeldon — Head of Finance - simon.wheeldon@foundersfactory.co

├── David Hickson — Chief Strategic Development Officer - david@foundersfactory.co  
└── Kate Nussrainer — EA to Henry Lane Fox - kate@ff.co `

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