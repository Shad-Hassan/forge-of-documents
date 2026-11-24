# Forge of Documents II

Fullstack Next.js document generation harness. Configure precise dials, generate documents via headless Claude.

## Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Configure API key**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Anthropic API key.

3. **Run dev server**:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Architecture

- **Frontend**: React + Tailwind 4.0 with cosmology colors (ivory, bronze, slate, arcane, ember)
- **Backend**: Next.js API routes with Claude integration
- **Document Types**: Email, Proposal, Report, Brief, Case Study
- **Dials**: Configurable parameters per document type (tone, length, audience, etc.)

## Adding Document Types

Edit `/app/lib/config.ts` and add a new document type to `documentTypes`. Define its dials and system prompt. The API and UI will auto-detect it.

Example dial types:
- `select`: dropdown with options
- `text`: text input
- `number`: numeric input
- `slider`: range slider

## API Endpoint

**POST** `/api/generate`

Request:
```json
{
  "documentType": "email",
  "dials": {
    "tone": "formal",
    "length": "medium",
    "subject": "Project Update",
    "keyPoints": "timeline, budget"
  }
}
```

Response:
```json
{
  "success": true,
  "content": "...",
  "metadata": {
    "documentType": "email",
    "model": "claude-opus-4-1",
    "tokensUsed": 342
  }
}
```

## Deployment

Build for production:
```bash
npm run build
npm start
```

Or deploy to Vercel:
```bash
vercel
```

Set `ANTHROPIC_API_KEY` in production environment variables.
