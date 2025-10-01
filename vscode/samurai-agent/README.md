# Samurai Agent 

We find flaws in your spec before AI writes code and makes a mess.

**Why us?**

We have a better code extraction agent and superior memory capabilities.

## When to use

You talk with Samurai Agent about specs or what features you want to add. We find ambiguity in specs while reading your codebase, then we will eventually craft a spec that you can copy and paste to AI coding agents like Cursor.

Then, you go back to Samurai Agent for code review to read our spec and code.

## How to use

### Initial setup

Please go to settings and first set your LLM API from Gemini, OpenAI, or Anthropic. We highly recommend Gemini Flash 2.5 as we optimize for it.

In settings, you can change the telemetry settings. We never collect your chat information regardless of those settings—we only collect the number of chat events.

In settings, you can also add your context information and edit memory directly when needed.

### How to talk to Samurai Agent

#### First test

Please type "Please read the latest code and suggest refactoring improvements about..." (you can add something here), then you can see our power immediately.

#### Common usage

1. **When you want to implement a new feature with Cursor**

   You can simply say "I would like to implement an LLM cost tracking system and show the monthly cost at the top of Chat Tab..."

   Then, our agent will ask you questions and follow up.

   Once you feel comfortable finalizing the spec, you can click the spec create button at the end of the chat or you can say "create specs based on the discussion so far."

   Then the spec will show up.

### Special commands for tool calling

#### Code extraction

If you add "Please read the latest code", regardless of context, our agent will read your latest code.

#### Spec creation

If you add "create specs", regardless of context, our agent will create specs.