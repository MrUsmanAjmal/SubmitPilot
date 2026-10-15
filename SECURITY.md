# Security notes

SubmitPilot is an open-source MVP. Do not assume the presence of a file upload limit and AI rate limit makes this an enterprise security product.

## API key protection

- Store `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `ELSEVIER_API_KEY` and `OPENALEX_API_KEY` **only in server-side environment variables**.
- AI requests are public and limited per IP address by an in-memory limiter (`AI_REQUESTS_PER_HOUR`). It is not abuse-proof: IPs can be rotated, and the limit resets on restart.
- Do not open a production deployment with paid keys to untrusted public traffic without proper authentication, abuse throttling, per-user quotas, observability, and payment limits.
- Set spending limits and monitor Anthropic usage in Claude Console.
- Rotate keys if disclosed.

## Untrusted documents

Uploaded manuscripts are treated as untrusted data and wrapped as such in LLM instructions. Prompt injection remains a risk and models may fail to respect instructions; do not treat generated answers as verified.

## Sensitive data

- The application does not store uploaded files in a backend database, but it does keep extracted document text in browser `sessionStorage` to support the workspace.
- Configure host-level logs and storage carefully; logs can be retained by the operator.
- Topics, abstracts and manuscript excerpts are shared with Google Gemini (or Anthropic, if configured instead) when AI is configured; Gemini's free tier may use them to improve Google's products. Journal search keywords/titles are sent to OpenAlex.
- Avoid sensitive or embargoed material until you understand service terms, data flow, consent and legal requirements.

## Reporting vulnerabilities

Use your GitHub repository's security advisory flow once published. Do not post credentials, sample confidential manuscripts, or exploits that expose user data in public issues.
