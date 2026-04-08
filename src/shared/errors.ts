export enum WikiErrorCode {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_PERMISSION = "FILE_PERMISSION",
  WIKI_EMPTY = "WIKI_EMPTY",
  API_ERROR = "API_ERROR",
  API_PARSE_ERROR = "API_PARSE_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CACHE_CORRUPT = "CACHE_CORRUPT",
}

export class WikiError extends Error {
  constructor(
    message: string,
    public readonly code: WikiErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WikiError";
  }
}
