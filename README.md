# QA BOT — Resume Ingestion & Retrieval

Enterprise README for the QA BOT Resume LangChain project.

## Overview

QA BOT is a modular resume ingestion and retrieval system built with Node.js and TypeScript. It provides pipelines for document ingestion, vector indexing, hybrid retrieval, reranking, and conversational retrieval using LLMs and vector stores.

This repository includes production-ready patterns for configuration, logging, CI, testing, and deployment.

## Key Capabilities

- Ingest resumes and documents from `documents/`.
- Create/upsert vector indices (`scripts/createVectorIndex.ts`).
- Hybrid search with keyword + vector search and LLM reranking.
- Conversational memory and RAG-based conversational chains.

## Quick Start (Developer)

Prerequisites

- Node.js 18+ / 20 recommended
- npm or pnpm
- Optional: Docker for containerized runs

Install

```bash
npm install
```

Environment

1. Copy `.env.example` to `.env` (create one if absent).
2. Provide API keys and vector DB configuration (example keys below):

```
OPENAI_API_KEY=your_key_here
VECTOR_STORE_URL=your_vector_store_url
NODE_ENV=development
```

Run (development)

```bash
npm run dev
```

Build & Run (production)

```bash
npm run build
npm start
```

Run locally with Docker

```bash
docker build -t qa-bot .
docker run --env-file .env -p 3000:3000 qa-bot
```

## Repository Structure

- `src/` — application source code
  - `lib/` — core chains, loaders, embeddings, memory, models, and vectorstore adapters
  - `pipelines/` — ingestion and retrieval pipelines
  - `scripts/` — helper scripts (index creation, debug tools)
  - `config/` — configuration entry points
  - `utils/` — document loaders and extractors
- `documents/` — sample documents and test inputs
- `package.json` — scripts and dependencies

See the inline module README/comments for details on `conversationalRAGChain`, `resumeVectorStore`, and `hybridSearch` components.

## Architecture Overview

1. Document ingestion: `pipelines/ingestion/pipeline.ts` normalizes and splits documents.
2. Embeddings: `src/lib/embeddings/*` provides configurable embedding implementations.
3. Vector store: `src/lib/vectorstore/resumeVectorStore.ts` wraps the chosen vector DB.
4. Retrieval: `pipelines/retrieval/*` composes keyword search, vector search, and LLM reranking.
5. Conversational RAG: `lib/conversationalRAGChain.ts` composes retrieval + LLM for chat flows.

## Development & Testing

Scripts

- `npm run dev` — run in development mode (ts-node / nodemon)
- `npm run build` — compile TypeScript
- `npm start` — run compiled output
- `npm test` — run unit and integration tests
- `npm run lint` — run linters

Testing guidance

- Unit: mock vector store and LLM clients. Keep tests hermetic.
- Integration: use a small test dataset in `documents/` and a disposable vector DB (local or test namespace).

CI

- Ensure CI runs `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
- Protect `main`/`production` branches with required passing checks.

## Configuration & Secrets

- Keep secrets in environment variables or a secrets manager (AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault).
- Do not commit `.env` or secret files.

## Logging, Observability & Metrics

- Use structured JSON logging for production (winston/pino).
- Emit traces and spans to your APM (OpenTelemetry compatible) for LLM calls and pipeline runs.
- Capture metrics: ingestion count, vector index size, query latency, rerank latency, and error rates.

## Security Considerations

- Validate and sanitize uploaded documents to avoid injection in prompt templates.
- Rate-limit LLM and vector DB calls to prevent abuse.
- Rotate API keys and avoid long-lived credentials in code.

## Contribution Guide

1. Fork the repo and create a feature branch: `feature/<short-desc>`.
2. Follow the established code style and run linters locally.
3. Add tests for new behavior and update docs.
4. Open a PR describing the change, link related issues, and request reviewers.

Coding standards

- TypeScript: strict mode enabled (prefer `unknown` over `any`).
- Keep functions small and side-effect free where possible.

## Release & Changelog

- Use semantic versioning. Maintain a `CHANGELOG.md` with notable changes.

## License

This project is released under the MIT License — see `LICENSE`.

## Support & Contacts

For enterprise support or SLAs, contact the engineering lead or ops team listed in the internal directory.

## Acknowledgements

- Built with open-source LLM tooling and vector databases. Replace providers as needed via the `lib/embeddings` and `lib/vectorstore` adapters.

---

If you'd like, I can: add a `.env.example`, a `CONTRIBUTING.md`, or adapt this README for a public open-source release. Reply with which you'd prefer next.
