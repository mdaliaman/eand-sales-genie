export const environment = {
  production: true,

  /**
   * When true, the Sales Genie replies come from a local mock (no network).
   * Flip to false once the USP `sales-genie/chat` endpoint is available.
   */
  useMockLlm: true,

  /** Base URL of the USP-Indirect backend. The app never calls the LLM directly. */
  uspBaseUrl: '/api/usp',
};
