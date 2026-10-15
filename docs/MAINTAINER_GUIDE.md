# SubmitPilot · Maintainer and deployment guide

Internal setup, integrations, deployment, configuration and testing notes. The project homepage is the repository-root `README.md`.

SubmitPilot helps researchers explore *where related work is published*, screen a manuscript for reporting signals, and draft manuscript-grounded journal submission answers. It combines live OpenAlex publication metadata with optional Claude-powered analysis.

![SubmitPilot](https://img.shields.io/badge/Next.js-15-0e2926?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-779c7d?style=flat-square)

## Project capabilities at a glance

- Premium responsive landing, FAQ-style product information, About, privacy and terms pages.
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
GEMINI_API_KEY=your_free_google_ai_studio_key
GEMINI_MODEL=gemini-2.5-flash
AI_REQUESTS_PER_HOUR=30
OPENALEX_API_KEY=your_free_openalex_key
ELSEVIER_API_KEY=your_scopus_key_optional
NEXT_PUBLIC_CONTACT_EMAIL=your_real_business_email_optional
```

**API secrets must be used server-side only.** NEVER prefix them with `NEXT_PUBLIC_`, put them in GitHub, or paste them into public forms.

### AI providers

- **Google Gemini (recommended, free tier):** create a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY`. Free-tier requests are rate-limited, and Google may use free-tier content to improve its products, and the privacy page and upload form warn users about this.
- **Anthropic Claude (paid):** set `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_MODEL`. Used only when `GEMINI_API_KEY` is empty.

AI is available to every visitor, limited to `AI_REQUESTS_PER_HOUR` units per IP address (default 30; a topic search uses about 3, a manuscript analysis 2). When the limit or the Gemini free quota is reached, searches fall back to non-AI keywords instead of failing. The limiter is in memory, so it resets on restart and is per server instance; use a shared store such as Redis behind a load balancer or on serverless hosting.

### Journal discovery

Journal matching uses OpenAlex topics: a title/abstract search detects the manuscript's topics and subfield, two `group_by` queries count every journal's articles in those topics and keyword matches since 2019, and journals are ranked by scope focus (share of their output in those topics, subfield alignment) rather than raw volume. Each search makes about five OpenAlex requests; without `OPENALEX_API_KEY` all visitors share a small daily budget per server IP, so set a free key for public deployments. With Gemini configured, one AI call writes the search keywords and another re-ranks the top candidates.

### Journal metrics

- **Quartiles:** download the SCImago list once a year into `data/scimago.csv` (see `data/README.md`). Without it, quartiles show as "Q n/a".
- **CiteScore:** set `ELSEVIER_API_KEY` (free from dev.elsevier.com, non-commercial use) to add Scopus CiteScore and SNIP.
- OpenAlex supplies 2-year mean citedness, H-index and APC with no setup. The Clarivate Impact Factor has no free licence and is not shown.

### Conferences and workshops

Events come from ccf-deadlines (`ccfddl.github.io/conference/allconf.yml`, cached 12 h), CORE ranks (cached 7 days), WikiCFP category pages (cached 6 h, requests spaced 5 s apart as its robots.txt asks) and, with Gemini, a Google-Search-grounded AI call. AI-found events are labelled and link to their sources; deadlines are never estimated.

If your provider rejects the default model, update `GEMINI_MODEL` or `ANTHROPIC_MODEL` to one enabled on your account. If model calls fail, manuscript screening falls back to rules and displays the reason; the submission assistant returns a descriptive error.

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
  about/ privacy/ terms/
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
