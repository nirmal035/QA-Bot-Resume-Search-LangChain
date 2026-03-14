/**
 * Re-export public search types from the main types module
 */
export {
  SearchRequestSchema,
  type SearchRequest,
  type SearchResultItem,
  type SearchResponse,
} from "../../types/search.js";

/**
 * Search metadata for internal use by retrieval engines
 */
export interface SearchMetadata {
  traceId: string;
  startTime: number;
  searchType: string;
}
