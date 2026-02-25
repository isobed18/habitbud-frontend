/**
 * Unwrap DRF paginated response.
 * DRF returns { count, next, previous, results: [...] } for list endpoints.
 * This helper returns the results array, or the raw data if not paginated.
 */
export const unwrapPagination = (data) => {
    if (data && typeof data === 'object' && !Array.isArray(data) && 'results' in data) {
        return data.results;
    }
    return data;
};
