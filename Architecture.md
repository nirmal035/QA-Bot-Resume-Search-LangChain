1) Technical Architecture – RAG-based Resume Search (Node.js + Express)

    1.1. High-Level Overview

    Goal:

    Enterprise-grade, low–moderate traffic resume search API, focused on result quality over raw speed (~3–5s acceptable), implemented as a monolithic Node.js + Express app with MongoDB and Mistral for embeddings + LLM.

    I will use mistral API for vector embeddings (mistral-embed) with 1024 dimensions.
    I will use groq llm (meta-llama/llama-4-scout-17b-16e-instruct from groq api). 
    The api keys and models should be configurable in .env

    Key Decisions from Questionnaire

    - Traffic & Latency: Low traffic, quality-focused, P95 up to 3–5 seconds accepted.
    - Deployment: Single-node Express app, vertically scaled (can later be containerized).

    -  Embeddings:
    - Generated on-demand per query (not precomputed for resumes).
    - Mistral embedding API with configurable model (dimensions fixed in code/config).

    - Search:
    - BM25 over: full text + skills + job titles + experience summary.
    - Vector search: MongoDB Atlas Vector Search using ANN, with exact re-score on top-K.
    - Hybrid: BM25 & vector run independently; both result sets go to LLM re-ranker.

    - LLM Usage:
    - LLM re-ranking is the final authority on ranking.
    - Re-rank top  8-10 candidates (configurable).
    - Summarization length/style can be hardcoded.
    - Pipeline: Fully synchronous: BM25 → vector → merge → re-rank → optional summarize → response.
    - Resilience: Fallback priority: BM25 → vector → re-rank, graceful degradation.
    - Logging: Centralized JSON logging with request IDs + timings.
    - API Versioning: URL-based (/v1/...).
    - Payload Control: Strict request/response size limits.

    1.2. Logical Architecture

        Layers:
    
        - API Layer (Express Routes)
        Exposes HTTP endpoints (/v1/...), request validation, size limits, versioning.
        - Service Layer
        SearchService – orchestrates BM25, vector, hybrid, re-ranking, summarization.
        EmbeddingService – wraps Mistral embedding API (configurable model).
        LLMService – wraps Mistral (or other) LLM for re-ranking + summarization + metadata extraction.
        ResumeRepository – MongoDB CRUD, BM25 queries, vector queries.
        LoggingService – logging, request IDs, timing metrics.

    1.3. MongoDB Data Model

        Collection: resumes

            Example document:
            {
  "_id": {
    "$oid": "691db80aa895776f97b6eca6"
  },
  "text": "ASHWIN P is an experienced Automation QA Engineer with 3.3 years of hands-on experience in designing, developing, and executing automated test scripts for web and API applications. He is skilled in ensuring high-quality software delivery through robust automation frameworks and continuous integration processes. He has worked on projects involving automation testing of banking and retail applications, utilizing tools and technologies such as Selenium WebDriver, Java, TestNG, Maven, Jenkins, Git, Postman, and SQL. His responsibilities included analyzing business requirements, creating automation test strategies, developing automation scripts, integrating automation suites with Jenkins, validating API services, and maintaining version control using Git.",
  "embedding": [
  ],
  "name": "ASHWIN P",
  "email": "ashwinp@gmail.com",
  "phone": {
    Not Extracted
  },
  "location": "Chennai, India",
  "company": "Tcs",
  "role": "QA Engineer",
  "education": "B.E COMPUTER SCIENCE ENGINEERING",
  "total_Experience": 1.3,
  "relevant_Experience": 1.3,
  "skills": "[\"Selenium WebDriver\", \"TestNG\", \"Cucumber\", \"Maven\", \"Jenkins\", \"Java\", \"SQL\", \"Postman\", \"Git\", \"GitHub\", \"JIRA\", \"Agile\"]"
}

    1.4. Key Endpoints (v1)
        
        1. Health Check

        GET /v1/health
            Checks app status, DB connectivity, configuration sanity.
            Response includes service versions and basic health info.

        2. MongoDB Connectivity Check

        GET /v1/health/db
            Pings MongoDB, returns latency and status.

        3. Mistral Embedding API

        POST /v1/embeddings
            Body:

            {
            "model": "mistral-embed",  // optional, default from config
            "input": "search text or resume content"
            }
            Uses fixed internal embedding dimension; model is configurable.

    4.  BM25 Search Endpoint

        POST /v1/search/bm25
            Body:

            {
            "query": "senior node.js backend engineer",
            "topK": 20,
            "filters": { "minYearsExperience": 5 }
            }
            Uses Atlas Search BM25 pipeline across rawText + skills + titles + experienceSummary.

        5. Vector Search Endpoint

        POST /v1/search/vector
            Flow:

            Generate query embedding via EmbeddingService.
            Run ANN search on cachedEmbedding.vector.
            Optionally exact re-score top-K.

        6. Hybrid Search Endpoint

        POST /v1/search/hybrid
            Flow:

            Call BM25 and vector search independently (parallel in Node.js).
            Return both ranked lists (no score merging) for debugging / exploration.

        7. LLM Re-Ranking Endpoint

        POST /v1/search/rerank
            Body (example):
            {
            "query": "senior node.js backend engineer with MongoDB experience",
            "candidates": [ { "resumeId": "...", "snippet": "..." }, ... ],
            "topK": 30
            }
            LLM takes query + candidate snippets and returns final sorted list.
            Final ranking is purely LLM-driven.

        8. Summarization Endpoint

        POST /v1/search/summarize
            Body:
            {
            "query": "role description or JD",
            "candidate": { "resumeId": "...", "snippet": "..." },
            "style": "short|detailed",
            "maxTokens": 300
            }
            Client controls style and length via parameters.

        9. End-to-End Resume Search Pipeline

        POST /v1/search
            Synchronous flow:

            Validate & enforce size limits.
            Generate embedding for query (on-demand).
            Run BM25 search.
            Run vector search, with ANN + exact re-score.
            Deduplicate merged candidates.
            Call LLM re-ranking on combined top N (default  8-10, configurable).
            If requested, call summarization for each candidate or only top-K.
            Return final sorted list + optional summaries.

    1.5. Logging, Error Handling
    
        Logging:

            Structured JSON logs per request: requestId, endpoint, durationMs, statusCode, errorCode, componentTimings (bm25Ms, vectorMs, rerankMs, summarizeMs).

        Error Handling & Fallback:

            If re-ranking LLM fails: Fallback to hybrid heuristic: priority BM25, then vector.
            If vector search fails: Use BM25 only; mark in response vectorFallback: true.
            If BM25 fails: Use vector only; mark bm25Fallback: true.
            If LLM summarization fails: Return results without summaries and include warning.



    - Endpoints to implement:
        1. `GET /v1/health`
        2. `GET /v1/health/db`
        3. `POST /v1/embeddings`
        4. `POST /v1/search/bm25`
        5. `POST /v1/search/vector`
        6. `POST /v1/search/hybrid`
        7. `POST /v1/search/rerank`
        8. `POST /v1/search/summarize`
        9. `POST /v1/search` (end-to-end pipeline)

    Architectural Decisions (Follow These)

    1. Monolith + Layering
    - Use a clean layered structure:
        - `src/app.ts`, `src/server.ts`
        - `src/routes/` for Express routes
        - `src/services/` for business logic:
        - `SearchService`, `EmbeddingService`, `LLMService`
        - `src/repositories/` for MongoDB:
        - `ResumeRepository`
        - `src/config/` for env and constants
        - `src/middleware/` for logging, request ID, size limits, error handling
        - `src/types/` for shared TypeScript types/interfaces

2. Data Model (MongoDB)
   - Single collection: `resumes`.
   - Read from existing mongodb using connection to understand the schema and index

3. Embeddings
   - Implement `EmbeddingService`:
     - Uses Mistral embedding API.
     - Accepts a text input and a configurable model name (via request or config).
     - Embedding dimensions are determined by the model and not exposed to clients.
     - For queries: embeddings are generated on-demand (no batching for now).

4. LLM Service
   - Implement `LLMService` with three main methods:
     - `rerankCandidates(query, candidates, topK)`  
       - Accepts a list of candidate snippets and returns them sorted by relevance.
       - Final ranking should be purely based on LLM scoring.
     - `summarizeCandidateFit(query, candidate, options)`  
       - Generates fit summaries.
       - Options include `style` (`"short"` vs `"detailed"`) and `maxTokens`.
     - `extractMetadata(rawText)`  
       - Extracts `skills`, `jobTitles`, `experienceSummary`.
       - This is used as source-of-truth for metadata at query-time.

5. Search Service
   - Implement `SearchService` with methods:
     - `bm25Search(query, filters, topK)`
       - Uses Atlas Search BM25 across:
         - `rawText + derivedMetadataCache.skills + jobTitles + experienceSummary`.
     - `vectorSearch(query, filters, topK)`
       - Uses `EmbeddingService` to create query embedding.
       - Uses MongoDB vector search with top-K by cosine similarity.
     - `hybridSearch(query, filters, options)`
       - Runs `bm25Search` and `vectorSearch` in parallel.
       - Returns both result lists without merging scores.
     - `endToEndSearch(query, filters, options)`
       - Steps (synchronous):
         1. Generate query embedding (on-demand).
         2. `bm25Search`
         3. `vectorSearch` 
         4. Merge and deduplicate candidates.
         5. Call `LLMService.rerankCandidates` on top `N` (default 8-10, configurable).
         6. If `options.summarize === true`, call `LLMService.summarizeCandidateFit` on:
            - Only top-K or all candidates (configurable).
         7. Return final ranked list + summaries if requested.

   - Implement fallback logic:
     - If `rerankCandidates` fails → fallback to BM25/vector ordering with priority BM25.
     - If vector search fails → use BM25 only.
     - If BM25 fails → use vector only.

6. Endpoints (Implement in This Order)

   1. `GET /v1/health`
      - Returns: app name, version, uptime.
   2. `GET /v1/health/db`
      - Checks MongoDB ping + latency.
   3. `POST /v1/embeddings`
      - Body: `{ model?, input }`
      - Returns: `{ embedding: number[], model: string }`
   4. `POST /v1/search/bm25`
      - Body: `{ query: string, topK?: number, filters?: object }`
   5. `POST /v1/search/vector`
      - Body: same as bm25.
   6. `POST /v1/search/hybrid`
      - Returns both BM25 and vector lists for debugging.
   7. `POST /v1/search/rerank`
      - Body: `{ query, candidates: [...], topK?: number }`
   8. `POST /v1/search/summarize`
      - Body: `{ query, candidate, style?: "short" | "detailed", maxTokens?: number }`
   9. `POST /v1/search`
      - Orchestrates the full pipeline described above.

7. Logging
   - Implement middleware to:
     - Assign a `requestId` for each request.
     - Log structured JSON:
       ```json
       {
         "requestId": "...",
         "endpoint": "/v1/search",
         "method": "POST",
         "durationMs": 1234,
         "statusCode": 200,
         "componentTimings": {
           "embeddingMs": 200,
           "bm25Ms": 300,
           "vectorMs": 250,
           "rerankMs": 450,
           "summarizeMs": 0
         }
       }
       ```
   - Enforce request size limits and return 413 for oversized payloads.

8. Incremental Implementation Strategy
   - Step 1: Project scaffold + health endpoints + MongoDB connection.
   - Step 2: Implement Vector Embedding + `/v1/embeddings`
   - Step 3: Atlas Search BM25 config + `/v1/search/bm25`.
   - Step 4: Vector index + `EmbeddingService` + `/v1/search/vector`.
   - Step 5: `SearchService.hybridSearch` + `/v1/search/hybrid`.
   - Step 6: `LLMService.rerankCandidates` + `/v1/search/rerank`.
   - Step 7: `LLMService.summarizeCandidateFit` + `/v1/search/summarize`.
   - Step 8: Full `/v1/search` pipeline with fallbacks + logging.
   - Step 9: Add tests (unit + integration) for each service and endpoint.

Generate the code and configuration step by step based on the above requirements. Start with the project scaffold, TypeScript setup, basic Express server, and health endpoints.

If you want, next we can go deeper into exact Atlas Search index JSON, or sample LLM prompts for re-ranking and summarization.


