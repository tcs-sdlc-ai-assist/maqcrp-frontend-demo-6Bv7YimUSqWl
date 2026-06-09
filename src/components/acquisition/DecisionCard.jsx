import { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { formatCurrency, formatDate, formatPercentage, truncateText } from '../../utils/formatters';
import { debug } from '../../utils/logger';
import PIIField from '../shared/PIIField';

const COMPONENT_NAME = 'DecisionCard';

const DECISION_CONFIG = {
  pass: {
    label: 'Pass',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <polyline points='20 6 9 17 4 12' />
      </svg>
    ),
    description: 'Loan passed all eligibility rules.',
  },
  fail: {
    label: 'Fail',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <circle cx='12' cy='12' r='10' />
        <line x1='15' y1='9' x2='9' y2='15' />
        <line x1='9' y1='9' x2='15' y2='15' />
      </svg>
    ),
    description: 'Loan failed one or more hard-stop rules.',
  },
  exception: {
    label: 'Exception',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
        <line x1='12' y1='9' x2='12' y2='13' />
        <line x1='12' y1='17' x2='12.01' y2='17' />
      </svg>
    ),
    description: 'Loan requires manual review — weighted score below threshold.',
  },
  pending: {
    label: 'Pending',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: (
      <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='w-5 h-5'
      >
        <circle cx='12' cy='12' r='10' />
        <polyline points='12 6 12 12 16 14' />
      </svg>
    ),
    description: 'Decision has not yet been rendered.',
  },
};

const PRODUCT_TYPE_LABELS = {
  conventional: 'Conventional',
  FHA: 'FHA',
  VA: 'VA',
  jumbo: 'Jumbo',
  USDA: 'USDA',
};

const CHANNEL_LABELS = {
  retail: 'Retail',
  correspondent: 'Correspondent',
  broker: 'Broker',
  wholesale: 'Wholesale',
};

const DecisionCard = ({ loan, decisionResult }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const safeLoan = loan && typeof loan === 'object' ? loan : null;
  const safeDecisionResult =
    decisionResult && typeof decisionResult === 'object' ? decisionResult : null;

  const decision = useMemo(() => {
    if (!safeDecisionResult) {
      return 'pending';
    }

    if (safeDecisionResult.decision === 'pass') {
      return 'pass';
    }

    if (safeDecisionResult.decision === 'fail') {
      return 'fail';
    }

    if (safeDecisionResult.decision === 'exception') {
      return 'exception';
    }

    return 'pending';
  }, [safeDecisionResult]);

  const decisionConfig = DECISION_CONFIG[decision] || DECISION_CONFIG.pending;

  const ruleResults = useMemo(() => {
    if (!safeDecisionResult || !Array.isArray(safeDecisionResult.ruleResults)) {
      return [];
    }

    return safeDecisionResult.ruleResults;
  }, [safeDecisionResult]);

  const hardStopRules = useMemo(() => {
    return ruleResults.filter((r) => r && r.isHardStop);
  }, [ruleResults]);

  const weightedRules = useMemo(() => {
    return ruleResults.filter((r) => r && !r.isHardStop);
  }, [ruleResults]);

  const failedHardStops = useMemo(() => {
    return hardStopRules.filter((r) => r && !r.passed);
  }, [hardStopRules]);

  const passedWeightedRules = useMemo(() => {
    return weightedRules.filter((r) => r && r.passed);
  }, [weightedRules]);

  const failedWeightedRules = useMemo(() => {
    return weightedRules.filter((r) => r && !r.passed);
  }, [weightedRules]);

  const scorePercentage = useMemo(() => {
    if (!safeDecisionResult) {
      return 0;
    }

    const maxScore = safeDecisionResult.maxPossibleScore || 0;

    if (maxScore === 0) {
      return 0;
    }

    const totalScore = safeDecisionResult.totalScore || 0;

    return Math.round((totalScore / maxScore) * 100);
  }, [safeDecisionResult]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleExpand();
      }
    },
    [handleToggleExpand],
  );

  if (!safeLoan) {
    return (
      <div className='card-enterprise'>
        <div className='text-center py-8'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-10 h-10 text-gray-300 mx-auto mb-3'
          >
            <circle cx='12' cy='12' r='10' />
            <line x1='12' y1='8' x2='12' y2='12' />
            <line x1='12' y1='16' x2='12.01' y2='16' />
          </svg>
          <p className='text-sm text-gray-500'>No loan data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='card-enterprise animate-fade-in'>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Eligibility Decision</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Rule evaluation results for loan {safeLoan.id || 'Unknown'}.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${decisionConfig.color}`}
        >
          {decisionConfig.icon}
          {decisionConfig.label}
        </span>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Loan ID
          </p>
          <p className='text-sm font-mono text-gray-900'>{safeLoan.id || '—'}</p>
        </div>

        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Borrower
          </p>
          <PIIField
            fieldType='fullName'
            value={safeLoan.borrowerName}
            entityId={safeLoan.id}
          />
        </div>

        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Product / Channel
          </p>
          <p className='text-sm text-gray-900'>
            {PRODUCT_TYPE_LABELS[safeLoan.productType] || safeLoan.productType || '—'}
            {' / '}
            {CHANNEL_LABELS[safeLoan.channel] || safeLoan.channel || '—'}
          </p>
        </div>

        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Loan Amount
          </p>
          <p className='text-sm font-mono text-gray-900'>
            {safeLoan.loanAmount != null ? formatCurrency(safeLoan.loanAmount) : '—'}
          </p>
        </div>
      </div>

      {safeDecisionResult ? (
        <>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6'>
            <div className='p-4 rounded-xl bg-enterprise-50 border border-enterprise-200'>
              <p className='text-xs font-medium text-enterprise-600 uppercase tracking-wider mb-1'>
                Weighted Score
              </p>
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-bold text-enterprise-700'>
                  {safeDecisionResult.totalScore ?? 0}
                </span>
                <span className='text-sm text-enterprise-500'>
                  / {safeDecisionResult.maxPossibleScore ?? 0}
                </span>
              </div>
              <div className='mt-2 w-full bg-enterprise-200 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                  style={{ width: `${scorePercentage}%` }}
                />
              </div>
              <p className='text-xs text-enterprise-500 mt-1'>{scorePercentage}% of max score</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Hard-Stop Rules
              </p>
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-bold text-gray-900'>
                  {hardStopRules.filter((r) => r && r.passed).length}
                </span>
                <span className='text-sm text-gray-500'>
                  / {hardStopRules.length} passed
                </span>
              </div>
              {failedHardStops.length > 0 && (
                <p className='text-xs text-red-600 mt-1 font-medium'>
                  {failedHardStops.length} rule(s) failed
                </p>
              )}
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Weighted Rules
              </p>
              <div className='flex items-baseline gap-2'>
                <span className='text-2xl font-bold text-gray-900'>
                  {passedWeightedRules.length}
                </span>
                <span className='text-sm text-gray-500'>
                  / {weightedRules.length} passed
                </span>
              </div>
              {failedWeightedRules.length > 0 && (
                <p className='text-xs text-amber-600 mt-1 font-medium'>
                  {failedWeightedRules.length} rule(s) did not pass
                </p>
              )}
            </div>
          </div>

          {decision === 'fail' && failedHardStops.length > 0 && (
            <div className='p-4 bg-red-50 border border-red-200 rounded-xl mb-6'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-5 h-5 text-red-500'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='15' y1='9' x2='9' y2='15' />
                    <line x1='9' y1='9' x2='15' y2='15' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-red-800'>
                    Hard-Stop Rule Failure
                  </p>
                  <p className='text-xs text-red-600 mt-1'>
                    {failedHardStops.length === 1
                      ? '1 hard-stop rule failed. The loan cannot proceed until this issue is resolved.'
                      : `${failedHardStops.length} hard-stop rules failed. The loan cannot proceed until these issues are resolved.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {decision === 'exception' && (
            <div className='p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-5 h-5 text-amber-600'
                  >
                    <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                    <line x1='12' y1='9' x2='12' y2='13' />
                    <line x1='12' y1='17' x2='12.01' y2='17' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-amber-800'>
                    Exception — Manual Review Required
                  </p>
                  <p className='text-xs text-amber-600 mt-1'>
                    The weighted score ({scorePercentage}%) is below the 80% threshold. This loan
                    requires manual review and potential override before it can proceed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {decision === 'pass' && (
            <div className='p-4 bg-green-50 border border-green-200 rounded-xl mb-6'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 mt-0.5'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-5 h-5 text-green-600'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                </div>
                <div>
                  <p className='text-sm font-semibold text-green-800'>
                    All Rules Passed
                  </p>
                  <p className='text-xs text-green-600 mt-1'>
                    The loan passed all hard-stop rules and achieved a weighted score of{' '}
                    {scorePercentage}%, exceeding the 80% threshold.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className='border border-gray-200 rounded-xl overflow-hidden'>
            <button
              type='button'
              onClick={handleToggleExpand}
              onKeyDown={handleKeyDown}
              className='w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-inset transition-colors duration-150'
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse rule breakdown' : 'Expand rule breakdown'}
            >
              <div className='flex items-center gap-2'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4 text-gray-500'
                >
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
                <span className='text-sm font-semibold text-gray-700'>
                  Rule-by-Rule Breakdown
                </span>
                <span className='inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-2xs font-bold'>
                  {ruleResults.length}
                </span>
              </div>

              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              >
                <polyline points='6 9 12 15 18 9' />
              </svg>
            </button>

            {isExpanded && (
              <div className='divide-y divide-gray-100 animate-fade-in'>
                {ruleResults.length === 0 ? (
                  <div className='px-4 py-8 text-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={1.5}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='w-8 h-8 text-gray-300 mx-auto mb-2'
                    >
                      <circle cx='12' cy='12' r='10' />
                      <line x1='12' y1='16' x2='12' y2='12' />
                      <line x1='12' y1='8' x2='12.01' y2='8' />
                    </svg>
                    <p className='text-sm text-gray-500'>
                      No rule evaluation results available.
                    </p>
                  </div>
                ) : (
                  <>
                    {hardStopRules.length > 0 && (
                      <div className='px-4 py-3 bg-gray-50/50'>
                        <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
                          Hard-Stop Rules
                        </p>
                        <div className='space-y-2'>
                          {hardStopRules.map((rule, idx) => {
                            if (!rule) return null;

                            return (
                              <div
                                key={rule.ruleId || idx}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                  rule.passed
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                              >
                                <div className='flex-shrink-0 mt-0.5'>
                                  {rule.passed ? (
                                    <svg
                                      xmlns='http://www.w3.org/2000/svg'
                                      viewBox='0 0 24 24'
                                      fill='none'
                                      stroke='currentColor'
                                      strokeWidth={2}
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      className='w-5 h-5 text-green-600'
                                    >
                                      <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns='http://www.w3.org/2000/svg'
                                      viewBox='0 0 24 24'
                                      fill='none'
                                      stroke='currentColor'
                                      strokeWidth={2}
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      className='w-5 h-5 text-red-500'
                                    >
                                      <circle cx='12' cy='12' r='10' />
                                      <line x1='15' y1='9' x2='9' y2='15' />
                                      <line x1='9' y1='9' x2='15' y2='15' />
                                    </svg>
                                  )}
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <p className='text-sm font-semibold text-gray-900'>
                                    {rule.ruleName || 'Unnamed Rule'}
                                  </p>
                                  <p className='text-xs text-gray-600 mt-0.5'>
                                    {rule.message || 'No explanation provided.'}
                                  </p>
                                </div>
                                <span
                                  className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${
                                    rule.passed
                                      ? 'bg-green-100 text-green-700 border-green-200'
                                      : 'bg-red-100 text-red-700 border-red-200'
                                  }`}
                                >
                                  {rule.passed ? 'PASS' : 'FAIL'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {weightedRules.length > 0 && (
                      <div className='px-4 py-3'>
                        <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
                          Weighted Score Rules
                        </p>
                        <div className='space-y-2'>
                          {weightedRules.map((rule, idx) => {
                            if (!rule) return null;

                            return (
                              <div
                                key={rule.ruleId || idx}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${
                                  rule.passed
                                    ? 'bg-gray-50 border-gray-200'
                                    : 'bg-amber-50 border-amber-200'
                                }`}
                              >
                                <div className='flex-shrink-0 mt-0.5'>
                                  {rule.passed ? (
                                    <svg
                                      xmlns='http://www.w3.org/2000/svg'
                                      viewBox='0 0 24 24'
                                      fill='none'
                                      stroke='currentColor'
                                      strokeWidth={2}
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      className='w-5 h-5 text-green-600'
                                    >
                                      <polyline points='20 6 9 17 4 12' />
                                    </svg>
                                  ) : (
                                    <svg
                                      xmlns='http://www.w3.org/2000/svg'
                                      viewBox='0 0 24 24'
                                      fill='none'
                                      stroke='currentColor'
                                      strokeWidth={2}
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      className='w-5 h-5 text-amber-500'
                                    >
                                      <circle cx='12' cy='12' r='10' />
                                      <line x1='12' y1='8' x2='12' y2='12' />
                                      <line x1='12' y1='16' x2='12.01' y2='16' />
                                    </svg>
                                  )}
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2'>
                                    <p className='text-sm font-semibold text-gray-900'>
                                      {rule.ruleName || 'Unnamed Rule'}
                                    </p>
                                    <span className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold bg-enterprise-100 text-enterprise-700'>
                                      Weight: {rule.weight ?? 0}
                                    </span>
                                  </div>
                                  <p className='text-xs text-gray-600 mt-0.5'>
                                    {rule.message || 'No explanation provided.'}
                                  </p>
                                </div>
                                <span
                                  className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold border ${
                                    rule.passed
                                      ? 'bg-green-100 text-green-700 border-green-200'
                                      : 'bg-amber-100 text-amber-700 border-amber-200'
                                  }`}
                                >
                                  {rule.passed ? 'PASS' : 'DID NOT PASS'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {safeDecisionResult.executedAt && (
            <p className='text-xs text-gray-400 mt-4 text-right'>
              Rules executed at{' '}
              {formatDate(safeDecisionResult.executedAt, 'MMM d, yyyy HH:mm:ss')}
            </p>
          )}
        </>
      ) : (
        <div className='text-center py-12'>
          <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-4'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-8 h-8 text-gray-400'
            >
              <circle cx='12' cy='12' r='10' />
              <polyline points='12 6 12 12 16 14' />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Decision Yet</h3>
          <p className='text-sm text-gray-500 max-w-md mx-auto'>
            This loan has not been evaluated by the eligibility rules engine. Run the rules
            engine to generate a decision.
          </p>
        </div>
      )}
    </div>
  );
};

DecisionCard.propTypes = {
  loan: PropTypes.shape({
    id: PropTypes.string,
    borrowerName: PropTypes.string,
    ssn: PropTypes.string,
    propertyAddress: PropTypes.string,
    loanAmount: PropTypes.number,
    productType: PropTypes.string,
    channel: PropTypes.string,
    sellerId: PropTypes.string,
    borrowerAddress: PropTypes.string,
    borrowerIncome: PropTypes.number,
    creditScore: PropTypes.number,
    accountNumber: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    loanPurpose: PropTypes.string,
    ltv: PropTypes.number,
    dti: PropTypes.number,
    status: PropTypes.string,
    decisionResult: PropTypes.object,
    documents: PropTypes.array,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  decisionResult: PropTypes.shape({
    loanId: PropTypes.string,
    passed: PropTypes.bool,
    decision: PropTypes.string,
    totalScore: PropTypes.number,
    maxPossibleScore: PropTypes.number,
    ruleResults: PropTypes.arrayOf(
      PropTypes.shape({
        ruleId: PropTypes.string,
        ruleName: PropTypes.string,
        passed: PropTypes.bool,
        message: PropTypes.string,
        weight: PropTypes.number,
        isHardStop: PropTypes.bool,
      }),
    ),
    executedAt: PropTypes.string,
  }),
};

DecisionCard.defaultProps = {
  loan: null,
  decisionResult: null,
};

export default DecisionCard;