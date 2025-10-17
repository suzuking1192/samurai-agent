# 🥋 Samurai Agent

**Deep Bug Analysis & Feature Planning for Complex Code**

When AI tools get stuck on complex bugs or struggle to plan intricate features, Samurai finds root causes and compares architectural trade-offs.

## 🎥 Quick Demo
![Samurai Agent Demo](https://raw.githubusercontent.com/suzuking1192/samurai-agent/main/samurai-agent-demo.gif)

---

## Why Samurai Agent?

### The Problem
**Complex bugs:** Quick AI tools guess at symptoms but can't trace system-wide interactions to find root causes.

**Complex features:** AI tools suggest generic solutions without comparing architectural trade-offs specific to your codebase.

### Our Approach

Unlike quick tools that use keyword search, we use **agentic code search** to read and understand your code:

**Deep Bug Analysis:** Traces execution paths across files to find root causes by analyzing how components interact.

**Spec Planning:** Reads your existing patterns to compare architectural options with trade-offs specific to your codebase.


### Example

**Other tools:**
```
❌ "Add caching with localStorage"
```

**Samurai:**
```
✅ "Use your existing DataStore at src/persistence/dataStore.ts

   Option A: Extend DataStore.cache
   Pros: Consistent with your patterns, handles errors
   Cons: Adds 2KB to session size
   
   Option B: New CacheService
   Pros: Isolated, lighter weight
   Cons: Another abstraction to maintain
   
   Recommendation: Option A - you already have 3 similar patterns"
```



---

## Two Core Modes

### 🔍 Deep Bug Analysis
**Finds root causes by analyzing system interactions**

**When to use:** When AI coding agents are stuck in a bug

**How it works:**
1. Select "Deep Bug Analysis" mode
2. Describe the bug: *"Progress banner appears after wrong message"*
3. Samurai traces data flow across 10+ files
4. Get root cause: *"Banner position set only once on creation, never updated"*

### 📋 Spec Planning Mode
**Compares architectural options before you build**

**When to use:** Feature requires architectural decisions

**How it works:**
1. Select "Spec Planning" mode
2. Describe feature: *"Add file pinning to LLM context"*
3. Answer clarifying questions: *"Should pins persist across sessions?"*
4. Review trade-offs: Session storage vs Workspace storage
5. Click "Create specs" → Get method-level implementation plan

**Use with any AI tool:**  
Copy specs to Cursor/Copilot for code generation. Specs ensure generated code fits your architecture.


---

## Quick Start

### 1. Install & Configure (2 minutes)
1. Install from VS Code Marketplace
2. Settings → Samurai Agent → Add API key
   - Gemini, OpenAI, or Anthropic
   - **Recommended:** Gemini Flash 2.5 (fastest)
   - **Free tier available** with daily limits

### 2. Optional: Add Project Context
Settings → Samurai Agent → "Context Information"  
Add conventions, docs, or guidelines Samurai should follow

### 3. Start Using
Open Samurai sidebar → Select mode → Describe your bug or feature

---

## Quick Commands

| Command | What It Does |
|---------|--------------|
| `"Please read the latest code"` | Analyzes your codebase using LLM-based understanding |
| `"create specs"` | Generates specification document |

---

## Privacy & Telemetry

- ✅ **Your code stays private** - analyzed using your own API keys
- ✅ **Chat content never collected** - only usage events (e.g., "spec created")
- ✅ **Full control** - disable telemetry in settings anytime

---

## FAQ

**Q: How is this different from Cursor/Copilot?**  
A: They generate code quickly. Samurai analyzes deeply for complex cases:
- **Bugs:** Traces system interactions to find root causes
- **Features:** Compares architectural trade-offs before building

Use both: Samurai for debugging/planning, Cursor/Copilot for coding.

**Q: When should I use Samurai vs quick AI tools?**  
A: Use Samurai when:
- Bug affects multiple files and quick tools can't find the cause
- Feature needs architectural decisions with trade-offs
- You want reviewable specs before coding

Use quick tools when:
- Simple bugs or features
- Speed matters more than understanding
- Just generating straightforward code

**Q: How long does analysis take?**  
A: 10-30 seconds for most projects (up to 10,000 files).

**Q: What about private codebases?**  
A: Analysis uses YOUR API keys. Code processed per your provider's policy (Gemini/OpenAI/Anthropic).

**Q: Does this replace my current AI coding tools?**  
A: No, complements them! Samurai for complex debugging/planning → Your tools for code generation.

---

## Support

- 🐛 [Report issues](https://github.com/suzuking1192/samurai-agent/issues)

---