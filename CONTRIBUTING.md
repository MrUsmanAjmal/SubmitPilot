# Contributing

Thanks for helping improve SubmitPilot. Start with a focused bug report or feature proposal, including the problem it solves and how it can be tested.

## Development

1. Fork/clone the repository and install Node 20+.
2. Run `npm install` and `npm run dev`.
3. Avoid committing `.env.local`, secrets or confidential manuscript files.
4. Before opening a pull request, run `npm run typecheck`, `npm test` and `npm run build`.
5. Explain all data sources and the limits of claims made by new research/journal matching logic.

## Design principles

- Do not invent indexing, quartiles, fees, acceptance rates, study results, research methods or editorial decisions.
- Link findings to source evidence where practical.
- Make AI modes distinguishable from deterministic checks.
- Prefer a working, well-tested feature over a simulated one.
- Accessibility and mobile presentation matter.
