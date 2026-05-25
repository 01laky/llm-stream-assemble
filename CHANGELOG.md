# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [Semantic Versioning](https://semver.org/).

## [0.0.1]

### Added

- Product and technical proposal in `docs/proposal.md`: defines the library scope
  (stream assembly only — no HTTP client, agent loop, or UI), unified `StreamEvent`
  model, provider adapter plan (OpenAI Chat, Anthropic Messages), v0.1/v0.2 roadmap,
  testing strategy, and publishing criteria.
- Root `README.md` with project positioning and links to documentation.
- `prompts/` directory placeholder for future incremental implementation prompts;
  canonical spec remains in `docs/proposal.md`.
- Cursor project rules under `.cursor/rules/`: no AI co-author in git, detailed
  CHANGELOG and semver after each completed part, long descriptive commit messages.
- `package.json` at `0.0.1` with repository metadata, description, and keywords
  aligned with the planned npm package identity.
