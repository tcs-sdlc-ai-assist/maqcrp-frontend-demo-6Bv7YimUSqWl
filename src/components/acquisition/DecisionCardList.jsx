import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { usePagination } from '../../hooks/usePagination';
import { debug, warn } from '../../utils/logger';
import DecisionCard from './DecisionCard';
import Pagination from '../shared/Pagination';

const COMPONENT_NAME = 'DecisionCardList';

const OUTCOME_FILTERS = [
  { key: 'all', label: 'All Outcomes', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'pass', label: 'Pass', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'fail', label: 'Fail', color: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'exception', label: 'Exception', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'overridden', label: 'Overridden', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

const SORT_OPTIONS = [
  { key: 'score-desc', label: 'Score (High to Low)' },
  { key: 'score-asc', label: 'Score (Low to High)' },
  { key: 'date-desc', label: 'Date (Newest First)' },
  { key: 'date-asc', label: 'Date (Oldest First)' },
  { key: 'amount-desc', label: 'Amount (High to Low)' },
  { key: 'amount-asc', label: 'Amount (Low to High)' },
];

const DecisionCardList = ({ decisions, onOverride }) => {
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [sortOption, setSortOption] = useState('score-desc');
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeDecisions = useMemo(() => {
    if (!Array.isArray(decisions)) {
      return [];
    }
    return decisions;
  }, [decisions]);

  const filteredDecisions = useMemo(() => {
    let filtered = [...safeDecisions];

    if (outcomeFilter !== 'all') {
      filtered = filtered.filter((item) => {
        if (!item) return false;

        if (outcomeFilter === 'overridden') {
          return item.decision === 'overridden' || item.overridden === true;
        }

        return item.decision === outcomeFilter;
      });
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        if (!item) return false;

        const loan = item.loan;
        if (!loan) return false;

        return (
          (loan.id && loan.id.toLowerCase().includes(searchLower)) ||
          (loan.borrowerName && loan.borrowerName.toLowerCase().includes(searchLower)) ||
          (loan.propertyAddress && loan.propertyAddress.toLowerCase().includes(searchLower)) ||
          (loan.sellerId && loan.sellerId.toLowerCase().includes(searchLower))
        );
      });
    }

    filtered.sort((a, b) => {
      if (!a || !b) return 0;

      switch (sortOption) {
        case 'score-desc': {
          const aScore = a.totalScore ?? 0;
          const bScore = b.totalScore ?? 0;
          return bScore - aScore;
        }
        case 'score-asc': {
          const aScore = a.totalScore ?? 0;
          const bScore = b.totalScore ?? 0;
          return aScore - bScore;
        }
        case 'date-desc': {
          const aDate = a.executedAt ? new Date(a.executedAt) : new Date(0);
          const bDate = b.executedAt ? new Date(b.executedAt) : new Date(0);
          return bDate - aDate;
        }
        case 'date-asc': {
          const aDate = a.executedAt ? new Date(a.executedAt) : new Date(0);
          const bDate = b.executedAt ? new Date(b.executedAt) : new Date(0);
          return aDate - bDate;
        }
        case 'amount-desc': {
          const aAmount = a.loan?.loanAmount ?? 0;
          const bAmount = b.loan?.loanAmount ?? 0;
          return bAmount - aAmount;
        }
        case 'amount-asc': {
          const aAmount = a.loan?.loanAmount ?? 0;
          const bAmount = b.loan?.loanAmount ?? 0;
          return aAmount - bAmount;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [safeDecisions, outcomeFilter, sortOption, searchQuery]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(filteredDecisions, { initialPageSize: 25 });

  const handleOutcomeFilterChange = useCallback(
    (filterKey) => {
      setOutcomeFilter(filterKey);
      setPage(1);
    },
    [setPage],
  );

  const handleSortChange = useCallback(
    (e) => {
      setSortOption(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleSearchChange = useCallback(
    (e) => {
      setSearchQuery(e.target.value);
      setPage(1);
    },
    [setPage],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setPage(1);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [setPage]);

  const outcomeCounts = useMemo(() => {
    const counts = {
      all: safeDecisions.length,
      pass: 0,
      fail: 0,
      exception: 0,
      overridden: 0,
    };

    for (const item of safeDecisions) {
      if (!item) continue;

      if (item.decision === 'pass') {
        counts.pass++;
      } else if (item.decision === 'fail') {
        counts.fail++;
      } else if (item.decision === 'exception') {
        counts.exception++;
      }

      if (item.decision === 'overridden' || item.overridden === true) {
        counts.overridden++;
      }
    }

    return counts;
  }, [safeDecisions]);

  const hasActiveFilters = outcomeFilter !== 'all' || searchQuery.trim() !== '';

  const handleClearFilters = useCallback(() => {
    setOutcomeFilter('all');
    setSearchQuery('');
    setSortOption('score-desc');
    setPage(1);
  }, [setPage]);

  if (safeDecisions.length === 0) {
    return (
      <div className='card-enterprise'>
        <div className='text-center py-12'>
          <div className='mx-auto w