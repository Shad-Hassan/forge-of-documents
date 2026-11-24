# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
# Local development
npm run dev              # Start dev server on localhost:3000
npm run build           # Build for production
npm start               # Start production server

# Or use the shell script (from anywhere)
forge-document          # Spins up dev server (requires .env.local configured)
```

## Architecture

**Forge of Documents II** is a fullstack Next.js document generation harness. Users configure "dials" (parameters) for different document types, and Claude generates documents via the Anthropic API.

### Data Flow

1. **Frontend** (`/app/components/DocumentGenerator.tsx`): React UI with type selector and dial inputs
2. **API Route** (`/api/generate/route.ts`): POST endpoint that constructs prompts and calls Claude
3. **Config** (`/lib/config.ts`): Defines all document types, their dials, and system prompts
4. **Styling** (`/app/globals.css` + `tailwind.config.ts`): Cosmology colors (void, ivory, bronze, arcane, ember)

### Key Files

| File | Purpose |
|------|---------|
| `lib/config.ts` | Document type definitions and dial specifications. Add new types here. |
| `api/generate/route.ts` | Backend endpoint: validates request, builds prompt, calls Claude API, returns content + metadata |
| `components/DocumentGenerator.tsx` | UI component: document type picker, dial rendering, copy/download buttons, loading states |
| `tailwind.config.ts` | Tailwind theme with cosmology color palette |
| `app/globals.css` | CSS variables tied to cosmology colors (void, ivory, bronze, etc.) |
| `.env.example` | Template for environment variables; copy to `.env.local` and add `ANTHROPIC_API_KEY` |

## Extending: Add a Document Type

1. Open `lib/config.ts`
2. Add a new entry to the `documentTypes` object:
   ```typescript
   "new-type": {
     name: "Display Name",
     description: "Short description",
     dials: [
       { name: "Dial Name", key: "dial_key", type: "select", options: ["a", "b"], default: "a" },
       // ... more dials
     ],
     systemPrompt: "Claude instructions for this document type",
   }
   ```
3. Frontend and API will auto-detect the new type (TypeScript enforces the type union at compile time)

### Dial Types

- `select`: dropdown menu (requires `options` array)
- `text`: text input field
- `number`: numeric input
- `slider`: range input (requires `min`, `max`)

## Setup & Environment

- **API Key**: Set `ANTHROPIC_API_KEY` in `.env.local` (never commit)
- **Model**: Currently hardcoded to `claude-opus-4-1` in `api/generate/route.ts`; change the string to switch models
- **Max Tokens**: Set to 4096 in the API route; adjust per document type if needed

## Deployment

**Vercel** (recommended):
```bash
vercel
# Set ANTHROPIC_API_KEY in Vercel dashboard environment variables
```

**Self-hosted**:
```bash
npm run build
npm start
# Set ANTHROPIC_API_KEY in environment before running
```

## Styling Notes

- **Colors**: Dark void background (#0b0f1a), ivory text (#f5f1e8), bronze accent (#a67c52)
- **Typography**: JetBrains Mono for body, Cinzel Decorative available for titles
- **Contrast**: All text meets WCAG AA (4.5:1 minimum); no muted text
- **Borders**: Slate colors for borders only; never use slate on text
- **Components**: Sharp corners (border-radius: 0) unless explicitly designed otherwise

## Common Patterns

**To adjust Claude behavior**: Edit the `systemPrompt` field in `lib/config.ts` for the target document type.

**To add UI controls**: Edit `dials` array in `lib/config.ts` and they appear in the UI automatically.

**To change API endpoint response**: Modify `api/generate/route.ts` — the response includes content, model, and tokens used.

## Debugging

- **API errors**: Check browser console (Network tab) and server logs (`npm run dev` output)
- **Missing .env.local**: Script will catch this; create it and add your Anthropic API key
- **TypeScript errors**: The `DocumentType` union enforces valid types; if adding a type, update the type definition first
