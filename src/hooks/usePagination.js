import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'usePagination';

const DEFAULT_PAGE_SIZE = 25;
const VALID_PAGE_SIZES = [10, 25, 50, 100];

/**
 * @typedef {Object} PageControls
 * @property {Function} goToFirst - Navigate to the first page.
 * @property {Function} goToPrevious - Navigate to the previous page.
 * @property {Function} goToNext - Navigate to the next page.
 * @property {Function} goToLast - Navigate to the last page.
 * @property {boolean} canGoPrevious - Whether there is a previous page.
 * @property {boolean} canGoNext - Whether there is a next page.
 * @property {number[]} pageNumbers - Array of page numbers for rendering pagination controls.
 * @property {number} startIndex - The 1-based index of the first item on the current page.
 * @property {number} endIndex - The 1-based index of the last item on the current page.
 * @property {number} totalItems - Total number of items in the data array.
 */

/**
 * @typedef {Object} PaginationResult
 * @property {number} currentPage - The current page number (1-based).
 * @property {Array<*>} paginatedData - The slice of data for the current page.
 * @property {number} totalPages - Total number of pages.
 * @property {PageControls} pageControls - Navigation controls and metadata.
 * @property {Function} setPage - Set the current page number.
 * @property {Function} setPageSize - Set the page size.
 * @property {number} pageSize - The current page size.
 */

/**
 * Validates and clamps a page number to ensure it falls within valid bounds.
 * @param {number} page - The page number to validate.
 * @param {number} totalPages - The total number of pages.
 * @returns {number} The clamped page number.
 */
const clampPage = (page, totalPages) => {
  if (typeof page !== 'number' || isNaN(page) || page < 1) {
    return 1;
  }
  if (totalPages <= 0) {
    return 1;
  }
  return Math.min(page, totalPages);
};

/**
 * Validates and clamps a page size to one of the allowed values.
 * @param {number} pageSize - The page size to validate.
 * @returns {number} The clamped page size.
 */
const clampPageSize = (pageSize) => {
  if (typeof pageSize !== 'number' || isNaN(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }
  if (VALID_PAGE_SIZES.includes(pageSize)) {
    return pageSize;
  }
  const closest = VALID_PAGE_SIZES.reduce((prev, curr) =>
    Math.abs(curr - pageSize) < Math.abs(prev - pageSize) ? curr : prev,
  );
  return closest;
};

/**
 * Generates an array of page numbers for pagination controls.
 * Uses a sliding window approach to avoid rendering too many page buttons.
 * @param {number} currentPage - The current page number.
 * @param {number} totalPages - The total number of pages.
 * @param {number} [maxVisible=7] - Maximum number of page buttons to show.
 * @returns {number[]} Array of page numbers.
 */
const generatePageNumbers = (currentPage, totalPages, maxVisible = 7) => {
  if (totalPages <= 0) {
    return [];
  }

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const halfVisible = Math.floor(maxVisible / 2);
  let startPage = currentPage - halfVisible;
  let endPage = currentPage + halfVisible;

  if (startPage < 1) {
    startPage = 1;
    endPage = maxVisible;
  }

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = totalPages - maxVisible + 1;
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
};

/**
 * Custom hook that provides generic pagination for any array of data.
 *
 * Manages current page, page size, and provides a paginated slice of the data.
 * Includes navigation controls (first, previous, next, last) and page number
 * generation for rendering pagination UI components.
 *
 * The hook resets to page 1 whenever the data array reference changes or the
 * page size changes, preventing out-of-bounds page states.
 *
 * @param {Array<*>} data - The array of data to paginate.
 * @param {Object} [options] - Pagination options.
 * @param {number} [options.initialPage=1] - The initial page number.
 * @param {number} [options.initialPageSize=25] - The initial page size (must be one of 10, 25, 50, 100).
 * @param {number} [options.maxVisiblePages=7] - Maximum number of page buttons to show in controls.
 * @returns {PaginationResult}
 *
 * @example
 * const {
 *   currentPage,
 *   paginatedData,
 *   totalPages,
 *   pageControls,
 *   setPage,
 *   setPageSize,
 *   pageSize,
 * } = usePagination(loans, { initialPageSize: 25 });
 *
 * // Render paginated data
 * paginatedData.map(loan => <LoanRow key={loan.id} loan={loan} />);
 *
 * // Use page controls
 * <button onClick={pageControls.goToNext} disabled={!pageControls.canGoNext}>Next</button>
 */
export const usePagination = (data, options = {}) => {
  const {
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    maxVisiblePages = 7,
  } = options;

  const safeData = Array.isArray(data) ? data : [];

  if (!Array.isArray(data)) {
    warn(HOOK_NAME, 'usePagination called with non-array data', {
      dataType: typeof data,
    });
  }

  const [currentPage, setCurrentPageState] = useState(() => {
    const safeInitialPage = typeof initialPage === 'number' && initialPage >= 1 ? initialPage : 1;
    return safeInitialPage;
  });

  const [pageSize, setPageSizeState] = useState(() => {
    return clampPageSize(initialPageSize);
  });

  const previousDataRef = useRef(safeData);
  const previousPageSizeRef = useRef(pageSize);

  const totalItems = safeData.length;

  const totalPages = useMemo(() => {
    if (totalItems === 0) {
      return 0;
    }
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  useEffect(() => {
    const dataChanged = previousDataRef.current !== safeData;
    const pageSizeChanged = previousPageSizeRef.current !== pageSize;

    if (dataChanged || pageSizeChanged) {
      const clampedPage = clampPage(currentPage, totalPages);
      if (clampedPage !== currentPage) {
        setCurrentPageState(clampedPage);
        debug(HOOK_NAME, 'Page reset due to data or page size change', {
          previousPage: currentPage,
          newPage: clampedPage,
          dataChanged,
          pageSizeChanged,
        });
      }
      previousDataRef.current = safeData;
      previousPageSizeRef.current = pageSize;
    }
  }, [safeData, pageSize, totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    if (totalItems === 0) {
      return [];
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return safeData.slice(startIndex, endIndex);
  }, [safeData, currentPage, pageSize, totalItems]);

  const setPage = useCallback(
    (page) => {
      if (typeof page !== 'number' || isNaN(page)) {
        warn(HOOK_NAME, 'setPage called with invalid page number', { page });
        return;
      }

      const clampedPage = clampPage(page, totalPages);

      if (clampedPage !== currentPage) {
        setCurrentPageState(clampedPage);
        debug(HOOK_NAME, 'Page changed', {
          previousPage: currentPage,
          newPage: clampedPage,
        });
      }
    },
    [currentPage, totalPages],
  );

  const setPageSize = useCallback(
    (newPageSize) => {
      if (typeof newPageSize !== 'number' || isNaN(newPageSize)) {
        warn(HOOK_NAME, 'setPageSize called with invalid page size', { newPageSize });
        return;
      }

      const clampedSize = clampPageSize(newPageSize);

      if (clampedSize !== pageSize) {
        setPageSizeState(clampedSize);
        debug(HOOK_NAME, 'Page size changed', {
          previousPageSize: pageSize,
          newPageSize: clampedSize,
        });
      }
    },
    [pageSize],
  );

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const goToFirst = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPageState(1);
    }
  }, [currentPage]);

  const goToPrevious = useCallback(() => {
    if (canGoPrevious) {
      setCurrentPageState((prev) => prev - 1);
    }
  }, [canGoPrevious]);

  const goToNext = useCallback(() => {
    if (canGoNext) {
      setCurrentPageState((prev) => prev + 1);
    }
  }, [canGoNext]);

  const goToLast = useCallback(() => {
    if (totalPages > 0 && currentPage !== totalPages) {
      setCurrentPageState(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageNumbers = useMemo(() => {
    return generatePageNumbers(currentPage, totalPages, maxVisiblePages);
  }, [currentPage, totalPages, maxVisiblePages]);

  const pageControls = useMemo(
    () => ({
      goToFirst,
      goToPrevious,
      goToNext,
      goToLast,
      canGoPrevious,
      canGoNext,
      pageNumbers,
      startIndex,
      endIndex,
      totalItems,
    }),
    [
      goToFirst,
      goToPrevious,
      goToNext,
      goToLast,
      canGoPrevious,
      canGoNext,
      pageNumbers,
      startIndex,
      endIndex,
      totalItems,
    ],
  );

  return {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  };
};

export default usePagination;