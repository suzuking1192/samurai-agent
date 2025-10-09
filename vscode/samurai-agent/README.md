# Samurai Agent

**Generate codebase-aware specs for complex features, refactoring, and hard bugs.**

When AI coding tools suggest generic solutions, Samurai Agent references YOUR existing code.

## 🎥 Quick Demo
![Samurai Agent Demo](https://raw.githubusercontent.com/suzuking1192/samurai-agent/main/samurai-agent-demo.gif)

---

## Why Samurai Agent?

**The Problem:**
Most AI coding tools don't truly understand your codebase. They use grep-based keyword search to find relevant code—fast, but shallow.

**Our Approach:**
We use LLMs to READ and UNDERSTAND your code, not just search for keywords. This foundationally different approach means we:
- ✅ Understand architecture and how components relate
- ✅ Find relevant code even without exact keyword matches
- ✅ Recognize patterns and conventions across your codebase
- ✅ Reference existing utilities by understanding what they do, not just their names

**Example:**
- ❌ Other tools: "Implement generic caching with localStorage"
- ✅ Samurai: "Use your existing DataStore at `src/persistence/dataStore.ts` which already handles persistence patterns"

**Why This Matters:**
Grep-based search finds code with matching keywords. LLM-based analysis understands what your code DOES. That's why we can suggest using your existing solutions instead of reinventing them.

---

## When to Use Samurai Agent

Use alongside your existing AI coding tools for:
- ✅ **Complex features** (touching 5+ files, architectural considerations)
- ✅ **Large refactoring** (cross-cutting changes, pattern updates)
- ✅ **Difficult bugs** (require understanding how systems interact)

For simple features, your usual tools work fine. For complex work, use Samurai first.

---

## How It Works

### 1️⃣ **Analyze Your Codebase**
**For exploring improvements/refactoring:**
Type: "Please read the latest code and suggest improvements for [area]..."

**For understanding existing code:**
Type: "Please read the latest code and explain how [feature/system] works..."

**For debugging:**
Type: "Please read the latest code and help me understand why [bug description]..."

You can skip step 1 if you already know what feature you want to build and just need a detailed spec.

### 2️⃣ **Discuss Your Feature**
Example: "I want to add LLM cost tracking with monthly stats..."
Samurai asks clarifying questions, identifies ambiguities, and references your existing code.

### 3️⃣ **Generate Spec**
Click "Create Spec" button or type: "create specs"

Get a detailed specification that:
- References YOUR existing utilities
- Follows YOUR conventions
- Lists files to modify
- Suggests implementation order

### 4️⃣ **Use with Your AI Tools**
Copy the spec to your preferred AI coding tool for code generation. The spec ensures generated code fits your architecture.

### 5️⃣ **Code Review** (Optional)
Return to Samurai Agent to review generated code against the spec.

---

## Setup (2 minutes)

### 1. Configure LLM Provider
- Go to Settings → Samurai Agent
- Add API key (Gemini, OpenAI, or Anthropic)
- **Recommended:** Gemini Flash 2.5 (optimized for performance)

### 2. Start Using
- Open your project
- Type: `"Please read the latest code and suggest..."`
- Watch Samurai analyze your codebase

### 3. Add Project Context (Optional)
- Go to Settings → Samurai Agent
- Scroll to bottom: "Context Information"
- Add project-specific documentation, conventions, or guidelines
- Samurai will consider this when generating specs

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

**Q: How is this different from other AI coding tools?**
A: Most tools use grep-based keyword search to find relevant code (fast but shallow). We use LLMs to READ and UNDERSTAND your code—recognizing architecture, patterns, and what utilities actually do. This lets us reference your existing solutions instead of suggesting generic ones.

**Q: Do I need to stop using my current AI coding tools?**
A: No! Use both. Samurai for complex planning, your existing tools for code generation.

**Q: How long does codebase analysis take?**
A: 10-30 seconds for most projects (up to 10,000 files).

**Q: What if I have a private codebase?**
A: All analysis uses your own API keys. Your code is processed according to your chosen LLM provider's policies.

**Q: Why is LLM-based analysis better than keyword search?**
A: Keyword search finds code with matching text. LLM-based analysis understands what code DOES—recognizing similar functionality even with different naming, understanding relationships between components, and finding relevant patterns across your codebase.

---

## Support

- 🐛 [Report issues](https://github.com/suzuking1192/samurai-agent/issues)

---