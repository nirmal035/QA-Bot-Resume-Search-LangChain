import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

/**
 * Schema for filtered results
 */
const FilteredResultSchema = z.object({
  name: z.string(),
  reasoning: z.string(),
  matches: z.boolean(),
});

const FilterResponseSchema = z.object({
  filteredResults: z.array(FilteredResultSchema),
  summary: z.string(),
});

type FilterResponse = z.infer<typeof FilterResponseSchema>;

/**
 * Conversational Filter
 * Uses LLM to filter cached search results based on follow-up queries
 * without re-querying the RAG system
 */
export class ConversationalFilter {
  private model: BaseChatModel;
  private promptTemplate: ChatPromptTemplate;

  constructor(model: BaseChatModel) {
    this.model = model;
    this.promptTemplate = this.createPromptTemplate();
  }

  /**
   * Create the filter prompt template
   */
  private createPromptTemplate(): ChatPromptTemplate {
    const systemPrompt = `## ROLE
You are an expert data filter that analyzes candidate resumes and filters them based on specific criteria.

## TASK
You will receive:
1. A list of candidate resumes (with their extracted information)
2. A user's filter criteria (e.g., "only from service-based companies", "only in Bengaluru", "with 10+ years experience")

Your job is to filter the candidates and return ONLY those that match the new criteria.

## INSTRUCTIONS
[CRITICAL] Analyze the extracted information carefully
[CRITICAL] For "service-based companies", look for companies like: TCS, Infosys, Wipro, Cognizant, HCL, Accenture, Capgemini, Tech Mahindra, L&T Infotech, Mphasis, Mindtree, etc.
[CRITICAL] For "product-based companies", look for companies like: Google, Microsoft, Amazon, Facebook, Apple, Uber, Flipkart, Zomato, Paytm, etc.
[IMPORTANT] Use ONLY the information provided in extractedInfo - do not make assumptions
[IMPORTANT] If information is not available (e.g., company not mentioned), set matches=false
[DO NOT] change or modify the candidate data
[DO NOT] add candidates that weren't in the original list

## FILTER CRITERIA EXAMPLES
- "service-based companies" → Filter by currentCompany in extractedInfo
- "from Bengaluru" → Filter by location in extractedInfo
- "with 10+ years" → Filter by experience in extractedInfo
- "knows Java" → Filter by skills in extractedInfo

## OUTPUT FORMAT
Return a JSON object with:
{{
  "filteredResults": [
    {{
      "name": "Candidate Name",
      "matches": true/false,
      "reasoning": "Brief explanation why it matches or doesn't match"
    }}
  ],
  "summary": "X out of Y candidates match the filter criteria"
}}

## TONE
Precise, factual, and concise.`;

    const humanPrompt = `## FILTER CRITERIA
{filterCriteria}

## CANDIDATES TO FILTER
{candidatesContext}

## YOUR TASK
Filter the candidates based on the criteria above. Return ONLY candidates where matches=true.
Provide clear reasoning for each decision.

Return your response as a JSON object.`;

    return ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", humanPrompt],
    ]);
  }

  /**
   * Filter cached search results based on new criteria
   */
  async filterResults(
    filterCriteria: string,
    cachedResults: any[],
    traceId: string
  ): Promise<{
    filtered: any[];
    summary: string;
  }> {
    if (cachedResults.length === 0) {
      return {
        filtered: [],
        summary: "No cached results to filter",
      };
    }

    console.log(`[${traceId}] [Filter] Filtering ${cachedResults.length} cached results`);
    console.log(`[${traceId}] [Filter] Criteria: "${filterCriteria}"`);

    // Format candidates for LLM
    const candidatesContext = cachedResults
      .map((result, index) => {
        return `
### Candidate ${index + 1}: ${result.name}
**Email:** ${result.email}
**Phone:** ${result.phoneNumber}
**Score:** ${result.score}
**Extracted Info:**
- Current Company: ${result.extractedInfo?.currentCompany || "Not mentioned"}
- Location: ${result.extractedInfo?.location || "Not mentioned"}
- Skills: ${result.extractedInfo?.skills?.join(", ") || "Not mentioned"}
- Experience: ${result.extractedInfo?.experience || "Not mentioned"}
- Key Highlights: ${result.extractedInfo?.keyHighlights?.join(", ") || "Not mentioned"}
`;
      })
      .join("\n" + "=".repeat(60) + "\n");

    // Invoke LLM
    const formattedPrompt = await this.promptTemplate.format({
      filterCriteria,
      candidatesContext,
    });

    console.log(`[${traceId}] [Filter] Invoking LLM for filtering...`);

    try {
      const response = await this.model.invoke(formattedPrompt);
      const responseText = typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON response
      let parsedResponse: FilterResponse;
      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
        const rawJson = JSON.parse(jsonStr.trim());
        parsedResponse = FilterResponseSchema.parse(rawJson);
      } catch (parseError) {
        console.error(`[${traceId}] [Filter] Failed to parse LLM response:`, parseError);
        console.error(`[${traceId}] [Filter] Raw response:`, responseText.slice(0, 500));

        // Fallback: return all results
        return {
          filtered: cachedResults,
          summary: "Failed to parse filter response. Returning all cached results.",
        };
      }

      // Filter results based on LLM response
      const filtered = cachedResults.filter((result) => {
        const filterDecision = parsedResponse.filteredResults.find(
          (fr) => fr.name === result.name
        );
        
        if (filterDecision) {
          if (!filterDecision.matches) {
            console.log(
              `[${traceId}] [Filter] ⛔ Excluded: ${result.name} - ${filterDecision.reasoning}`
            );
          }
          return filterDecision.matches;
        }
        
        return false;
      });

      console.log(
        `[${traceId}] [Filter] ✅ Filtered: ${cachedResults.length} → ${filtered.length} results`
      );
      console.log(`[${traceId}] [Filter] Summary: ${parsedResponse.summary}`);

      return {
        filtered,
        summary: parsedResponse.summary,
      };
    } catch (error) {
      console.error(`[${traceId}] [Filter] ❌ Error during filtering:`, error);

      // Return all results on error
      return {
        filtered: cachedResults,
        summary: `Error during filtering: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check if a query is a filter query (not a new search)
   */
  static isFilterQuery(query: string): boolean {
    const filterKeywords = [
      "only",
      "filter",
      "show me",
      "display",
      "from those",
      "from the above",
      "from previous",
      "from these",
      "among them",
      "out of these",
      "narrow down",
      "refine",
    ];

    const lowerQuery = query.toLowerCase();
    return filterKeywords.some((keyword) => lowerQuery.includes(keyword));
  }
}
