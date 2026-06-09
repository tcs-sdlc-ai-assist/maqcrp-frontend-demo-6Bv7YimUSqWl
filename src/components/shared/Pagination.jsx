import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'Pagination';

const VALID_PAGE_SIZES = [25, 50, 100];

const MAX_VISIBLE_PAGES = 7;

const generatePageNumbers = (currentPage, totalPages, maxVisible = MAX_VISIBLE_PAGES) => {
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

const Pagination = ({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  totalRecords,
}) => {
  const safeCurrentPage = typeof currentPage === 'number' && currentPage >= 1 ? currentPage : 1;
  const safeTotalPages = typeof totalPages === 'number' && totalPages >= 0 ? totalPages : 0;
  const safePageSize = VALID_PAGE_SIZES.includes(pageSize) ? pageSize : 25;
  const safeTotalRecords = typeof totalRecords === 'number' && totalRecords >= 0 ? totalRecords : 0;

  const canGoPrevious = safeCurrentPage > 1;
  const canGoNext = safeCurrentPage < safeTotalPages;

  const startRecord = safeTotalRecords === 0 ? 0 : (safeCurrentPage - 1) * safePageSize + 1;
  const endRecord = safeTotalRecords === 0 ? 0 : Math.min(safeCurrentPage * safePageSize, safeTotalRecords);

  const pageNumbers = useMemo(() => {
    return generatePageNumbers(safeCurrentPage, safeTotalPages);
  }, [safeCurrentPage, safeTotalPages]);

  const handlePageChange = useCallback(
    (page) => {
      if (typeof page !== 'number' || isNaN(page) || page < 1) {
        return;
      }

      if (page > safeTotalPages) {
        return;
      }

      if (page === safeCurrentPage) {
        return;
      }

      debug(COMPONENT_NAME, 'Page change requested', {
        from: safeCurrentPage,
        to: page,
      });

      if (typeof onPageChange === 'function') {
        onPageChange(page);
      }
    },
    [safeCurrentPage, safeTotalPages, onPageChange],
  );

  const handlePageSizeChange = useCallback(
    (e) => {
      const newSize = parseInt(e.target.value, 10);

      if (!VALID_PAGE_SIZES.includes(newSize)) {
        return;
      }

      if (newSize === safePageSize) {
        return;
      }

      debug(COMPONENT_NAME, 'Page size change requested', {
        from: safePageSize,
        to: newSize,
      });

      if (typeof onPageSizeChange === 'function') {
        onPageSizeChange(newSize);
      }
    },
    [safePageSize, onPageSizeChange],
  );

  const handlePrevious = useCallback(() => {
    if (canGoPrevious) {
      handlePageChange(safeCurrentPage - 1);
    }
  }, [canGoPrevious, handlePageChange, safeCurrentPage]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      handlePageChange(safeCurrentPage + 1);
    }
  }, [canGoNext, handlePageChange, safeCurrentPage]);

  const handleFirst = useCallback(() => {
    if (safeCurrentPage !== 1) {
      handlePageChange(1);
    }
  }, [safeCurrentPage, handlePageChange]);

  const handleLast = useCallback(() => {
    if (safeTotalPages > 0 && safeCurrentPage !== safeTotalPages) {
      handlePageChange(safeTotalPages);
    }
  }, [safeCurrentPage, safeTotalPages, handlePageChange]);

  if (safeTotalRecords === 0) {
    return (
      <div className='flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6'>
        <div className='flex-1 flex items-center justify-between'>
          <div>
            <p className='text-sm text-gray-500'>
              No records to display
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6'>
      <div className='flex-1 flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <label htmlFor='pagination-page-size' className='text-sm text-gray-600'>
              Show
            </label>
            <select
              id='pagination-page-size'
              value={safePageSize}
              onChange={handlePageSizeChange}
              className='input-enterprise w-20 py-1 text-sm'
              aria-label='Page size selector'
            >
              {VALID_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className='text-sm text-gray-600'>per page</span>
          </div>

          <div className='hidden sm:block'>
            <p className='text-sm text-gray-600'>
              Showing{' '}
              <span className='font-medium text-gray-900'>{startRecord}</span>
              {' '}to{' '}
              <span className='font-medium text-gray-900'>{endRecord}</span>
              {' '}of{' '}
              <span className='font-medium text-gray-900'>{safeTotalRecords.toLocaleString()}</span>
              {' '}results
            </p>
          </div>
        </div>

        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={handleFirst}
            disabled={!canGoPrevious}
            className='relative inline-flex items-center px-2 py-2 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white'
            aria-label='Go to first page'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <polyline points='11 17 6 12 11 7' />
              <polyline points='18 17 13 12 18 7' />
            </svg>
          </button>

          <button
            type='button'
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            className='relative inline-flex items-center px-2 py-2 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white'
            aria-label='Go to previous page'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <polyline points='15 18 9 12 15 6' />
            </svg>
          </button>

          <div className='hidden sm:flex items-center gap-1'>
            {pageNumbers.map((page) => {
              const isActive = page === safeCurrentPage;

              return (
                <button
                  key={page}
                  type='button'
                  onClick={() => handlePageChange(page)}
                  className={`
                    relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1
                    ${isActive
                      ? 'bg-enterprise-600 text-white shadow-sm hover:bg-enterprise-700'
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                  aria-label={`Go to page ${page}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <div className='flex sm:hidden items-center'>
            <span className='text-sm font-medium text-gray-700 px-2'>
              {safeCurrentPage} / {safeTotalPages}
            </span>
          </div>

          <button
            type='button'
            onClick={handleNext}
            disabled={!canGoNext}
            className='relative inline-flex items-center px-2 py-2 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white'
            aria-label='Go to next page'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <polyline points='9 18 15 12 9 6' />
            </svg>
          </button>

          <button
            type='button'
            onClick={handleLast}
            disabled={!canGoNext}
            className='relative inline-flex items-center px-2 py-2 rounded-lg text-sm font-medium text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-1 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white'
            aria-label='Go to last page'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-4 h-4'
            >
              <polyline points='13 17 18 12 13 7' />
              <polyline points='6 17 11 12 6 7' />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

Pagination.propTypes = {
  currentPage: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  totalRecords: PropTypes.number.isRequired,
};

export default Pagination;