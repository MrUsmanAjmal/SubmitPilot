# SubmitPilot · Maintainer and deployment guide

Internal setup, integrations, deployment, configuration and testing notes. The project homepage is the repository-root `README.md`.

SubmitPilot helps researchers explore *where related work is published*, screen a manuscript for reporting signals, and draft manuscript-grounded journal submission answers. It combines live OpenAlex publication metadata with optional Claude-powered analysis.

![SubmitPilot](https://img.shields.io/badge/Next.js-15-0e2926?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-779c7d?style=flat-square)

## Project capabilities at a glance

- Premium responsive landing, FAQ-style product information, pricing/availability, About, privacy and terms pages.
- Real manuscript uploads: `.docx`, searchable `.pdf` or `.txt`, max 4 MB; or paste text.
- Clear rule-based screening without any paid API key; optional Claude research interpretation when configured.
- Live journal discovery via **OpenAlex** using recently published work, showing verifiable example articles with DOI/OpenAlex links. Manuscript sessions additionally receive a modest study-design-title signal, explicitly identified as a proxy rather than acceptance verification.
- Manuscript-grounded submission drafts with optional Claude. Missing information is explicitly flagged.
- Report export as Markdown, accessible input states, mobile-friendly layout and no login requirement.
- Consent confirmation is required before running document processing.
- No backend database; manuscript text is kept in **tab-scoped browser sessionStorage** for workspace continuity.
- Basic tests and automatic deployment support for Node-compatible Next.js hosts.

## 1. Quick start (Windows / Mac / Linux)

Install Node.js **20+**. In this directory, run:

```bash
npm install
cp .env.example .env.local  # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open **http://localhost:3000**.

**Without any API keys:** the website, document upload, rule-based manuscript screen, export, and general navigation work. Journal discovery requires an internet connection to OpenAlex; the free API may work without a key, subject to service limits. Claude-enhanced features require an Anthropic API key.

## 2. Optional integrations

Open `.env.local` and set:

```env
ANTHROPIC_API_KEY=your_claude_console_api_key
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
CLAUDE_ACCESS_CODE=your_private_random_16_plus_character_code
OPENALEX_API_KEY=your_openalex_key_optional
NEXT_PUBLIC_CONTACT_EMAIL=your_real_business_email_optional
```

**API secrets must be used server-side only.** NEVER prefix them with `NEXT_PUBLIC_`, put them in GitHub, or paste them into public forms.

### Claude Code vs Claude API

Claude Code is the development assistant, **not** the credential used by this application. The app's AI calls use the **Anthropic Messages API** and a separate API key billed to Claude Console. A Claude Team subscription does not automatically supply free API calls.

When Claude is configured, enter the `CLAUDE_ACCESS_CODE` on the research workspace to unlock private Claude calls. The app refuses paid Claude requests unless a **12+ character access code** is set server-side and entered by the user. The access code is held in the browser tab session, not committed to GitHub. This is a simple owner-level gate, **not** production-grade authentication or rate limiting.

If your API account does not support the default model, update `ANTHROPIC_MODEL` to one enabled on your account. If model calls fail, manuscript screening falls back to rules and displays the reason; the submission assistant returns a descriptive error.

## 3. Push the repository to GitHub

1. Create a **new empty GitHub repository** (do not initialize with README because the project already contains one).
2. Open a terminal inside the extracted `submitpilot` folder.
3. Run:

```bash
git init
git add .
git commit -m "Initial SubmitPilot platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/submitpilot.git
git push -u origin main
```

Or upload the project files using GitHub's web interface. **Do not upload the ZIP as a single file** — GitHub will not automatically extract it into a working repository. Upload the *contents* of the extracted folder, including `package.json`, `app`, `components`, `lib`, and `public`.

## 4. Deploy it to Vercel

1. Go to https://vercel.com/new and import your GitHub repository.
2. Select **Next.js** (Vercel typically detects it automatically).
3. Add optional environment variables in Project Settings → Environment Variables.
4. Deploy. A working website URL will be generated.
5. Test `/api/health`, `/workspace` with the included sample manuscript, and `/journals`.

On Vercel, documents are limited to **4 MB** because Vercel Functions have a 4.5 MB maximum request body. Larger files require a dedicated direct-upload architecture and secure storage handling. The browser displays this 4 MB limit and validates the file before posting.

Uploading to GitHub **does not itself host** this dynamic app. GitHub Pages cannot run the Next.js server routes for DOCX/PDF analysis, OpenAlex requests, or Claude API calls.

## 5. Project structure

```text
app/
  page.tsx                # premium landing
  workspace/              # upload, screen, match, submit
  journals/               # standalone discovery
  how-it-works/           # transparent product guide
  pricing/ about/ privacy/ terms/
  api/analyze/route.ts    # document extraction, rules, optional Claude
  api/journals/route.ts   # live OpenAlex discovery
  api/answer/route.ts     # grounded response drafting
  api/health/route.ts     # deployment smoke-check
components/               # landing elements, forms, cards
lib/                      # parsers, rule engine, API integration
public/                   # favicon
```

## 6. Testing

```bash
npm run typecheck
npm test
npm run build
```

## 7. What is *not* claimed or implemented

- **Not** a verified full journal-scope classifier. The current engine ranks journals appearing in a sample of topically similar OpenAlex works; it does *not* scrape or verify their current aims/scope, accepted article types, Scopus/Web of Science indexing, quartiles, APCs or editorial decisions. Users must confirm these independently.
- No fabricated journal impact factors, acceptance probabilities or publication turnaround times.
- No scientific validity/novelty certification. Detecting a section is not validating the method.
- No user login, organization/team accounts, payments, hosted history, scheduled crawls or e-mail sending.
- Scanned PDFs are not OCR-processed; use searchable PDFs or DOCX.
- No automatic uploads to journal submission systems.
- Not security-audited or privacy-certified. **Before public launch with a paid Claude key**, add individual user authentication and per-user rate limiting, request quotas, monitoring, user consent, applicable legal notices, retention policies and incident response procedures. Otherwise anonymous users can incur costs.

## Research and privacy principles

Manuscripts are not persisted to a server-side document database by this code. Requests are processed in memory and returned. The browser stores extracted manuscript text and analysis in `sessionStorage` for your tab session; clicking **Clear workspace** removes it. Hosting-provider logs and third-party privacy practices remain separate. Once unlocked, Claude-enabled screening shares document excerpts with Anthropic, and journal lookup sends title/topic queries to OpenAlex. Verify consent and intellectual-property rules before uploading sensitive manuscripts.

The software is not a substitute for editorial instructions, scholarly peer review, or author verification. It does not guarantee acceptance or journal eligibility.

## License

MIT. See [LICENSE](LICENSE).

## Dependencies / services

- Next.js and React (https://nextjs.org/)
- Mammoth for DOCX (https://www.npmjs.com/package/mammoth)
- pdf-parse for text PDFs (https://www.npmjs.com/package/pdf-parse)
- OpenAlex API (https://help.openalex.org/api/)
- Anthropic Messages API (https://platform.claude.com/docs/en/api/messages/create)
