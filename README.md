<div align="center">
  <img src="app/icon.svg" width="72" height="72" alt="SubmitPilot mark" />

  # SubmitPilot

  ### From manuscript to the right journal, with more confidence.

  **A modern research publication workspace for manuscript screening, evidence-led journal discovery, and submission preparation.**

  [![Next.js](https://img.shields.io/badge/Next.js-15-111827?style=flat-square)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-2563eb?style=flat-square)](https://www.typescriptlang.org/) [![OpenAlex](https://img.shields.io/badge/Discovery-OpenAlex-0c8c78?style=flat-square)](https://openalex.org/) [![MIT license](https://img.shields.io/badge/License-MIT-64748b?style=flat-square)](LICENSE)

  _Research deserves a better route to publication._
</div>

---

## The idea

Choosing a journal is more than finding a publication that shares a few keywords with your abstract. Researchers also need to understand how their study is presented, where comparable work appears, which claims require verification, and what information a submission portal will request.

**SubmitPilot brings those decisions into one focused workspace.** Upload a manuscript, review preliminary reporting signals, explore journals represented in relevant scholarly literature, and prepare submission answers based on the manuscript itself. The goal is **better-informed decisions**, not a promise of publication.

## The SubmitPilot experience

| 01 · Understand | 02 · Discover | 03 · Prepare |
| :--- | :--- | :--- |
| Upload your manuscript and receive an initial study profile and reporting screen. | Explore journals appearing in related literature, with links to representative papers. | Draft careful, manuscript-grounded answers to common submission questions. |
| **Manuscript workspace** | **Journal explorer** | **Submission assistant** |

### Manuscript intelligence

- Accepts **DOCX**, **searchable PDF**, and **TXT** manuscripts, as well as pasted text.
- Identifies preliminary signals about study type, discipline, keywords, document structure, and reporting considerations.
- Highlights potential omissions and review questions without claiming to certify scientific validity.
- Exports screening results in a portable Markdown report.
- Supports rule-based screening without paid AI access; optional Claude-assisted interpretation is available on configured, privately unlocked deployments.

### Journal discovery grounded in the literature

- Searches **OpenAlex** for scholarly works related to a manuscript title or research topic.
- Groups retrieved works by publishing journal and presents a **relative literature-overlap score**.
- Links to sample articles and identifiable scholarly records so researchers can inspect the evidence.
- Adds a limited study-design terminology signal when a manuscript profile is available.
- Explains the difference between topical overlap and verified editorial suitability.

> **A matching score is not an acceptance probability.** The current system does not independently verify a journal's latest aims and scope, permitted manuscript categories, quartile, indexing coverage, charges, or editorial decision times. Authors should confirm all such information directly with the journal and authoritative indexes.

### Submission preparation

- Ask a journal-form question using the uploaded manuscript as context.
- Get a draft answer through the optional Claude integration when available.
- Flag missing ethics, funding, consent, and other author declarations rather than inventing them.
- Review and copy draft answers before entering anything in a publisher's submission system.

### Designed for researchers

The responsive application includes a premium public landing page, research workspace, journal explorer, About, How It Works, pricing information, privacy notice, and terms pages. It is designed for independent researchers, postgraduate students, research teams, and academic writing professionals who want a clearer submission workflow.

## What sets SubmitPilot apart

**More than a keyword matcher.** SubmitPilot combines document-level screening, literature-linked discovery, and evidence-constrained submission assistance in one experience. Rather than fabricating journal statistics, it shows the basis of its preliminary recommendations and marks what still needs external verification.

**A transparent foundation.** The core screening workflow is usable without an AI subscription; Claude is an optional enhancement. The project is open source and can be extended with verified journal policy data, authentication, and production-grade publishing workflows.

## Data and research integrity

Research manuscripts may be unpublished or confidential. SubmitPilot asks users to confirm that they have permission to process the material. This repository does **not** include a persistent server-side manuscript database. Text and screening results are kept in the browser tab's `sessionStorage` to maintain workspace continuity; document processing also occurs in server requests. Hosting logs and external-provider handling depend on the deployment.

When optional Claude processing is enabled, relevant manuscript content is sent to the Anthropic API. Journal discovery sends search terms to OpenAlex. Authors remain responsible for permission, confidentiality, factual verification, and journal compliance.

## Current release and direction

| Available in this release | Future development opportunities |
| :--- | :--- |
| Responsive public website and research workspace | Individual researcher accounts and team collaboration |
| Manuscript upload and rule-based checks | More advanced, validated methodological assessments |
| OpenAlex-powered literature/journal discovery | Verified journal scope, indexing, policy and fee records |
| Optional private Claude integration | Public AI access with quotas and abuse prevention |
| Downloadable screening reports | Secure saved projects, structured exports and integrations |

The present release is a **working starter platform / public-beta candidate**, not an audited production service. It does not provide manuscript submission to publishers, guaranteed journal eligibility, peer review, editorial acceptance prediction, or plagiarism certification.

## Technology

**Next.js · React · TypeScript · Node.js · OpenAlex · Anthropic Messages API (optional)**

The user interface and API routes are implemented in a single application. Manuscript text extraction uses Mammoth for DOCX and `pdf-parse` for text-based PDFs.

## Open-source project

SubmitPilot is released under the [MIT License](LICENSE). Contributions, suggestions, and responsible issue reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

---

<div align="center">
  <strong>SubmitPilot</strong> · Research publication decisions, made more transparent.
</div>
