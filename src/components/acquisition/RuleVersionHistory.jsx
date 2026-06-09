import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useRules } from '../../contexts/RulesContext';
import { formatDate } from '../../utils/dateUtils';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'RuleVersionHistory';

const RULE_TYPE_LABELS = {
  hard_stop: 'Hard Stop',
  weighted_score: 'Weighted Score',
};

const RULE_TYPE_COLORS = {
  hard_stop: 'bg-red-100 text-red-700 border-red-200',
  weighted_score: 'bg-blue-100 text-blue-700 border-blue-200',
};

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  archived: 'bg-gray-100 text-gray-500 border-gray-200',
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

const CONDITION_OPERATOR_LABELS = {
  gt: 'Greater Than',
  gte: 'Greater Than or Equal',
  lt: 'Less Than',
  lte: 'Less Than or Equal',
  eq: 'Equals',
  neq: 'Not Equals',
  in: 'In',
  not_in: 'Not In',
};

const CONDITION_FIELD_LABELS = {
  creditScore: 'Credit Score',
  ltv: 'LTV',
  dti: 'DTI',
  loanAmount: 'Loan Amount',
  borrowerIncome: 'Borrower Income',
  productType: 'Product Type',
  channel: 'Channel',
  sellerId: 'Seller ID',
  loanPurpose: 'Loan Purpose',
};

const formatConditionValue = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
};

const getDiffFields = (currentSnapshot, previousSnapshot) => {
  if (!currentSnapshot || !previousSnapshot) {
    return [];
  }

  const diffs = [];
  const compareFields = [
    'name',
    'description',
    'ruleType',
    'weight',
    'effectiveDate',
    'expirationDate',
    'status',
  ];

  for (const field of compareFields) {
    const currentVal = currentSnapshot[field];
    const previousVal = previousSnapshot[field];

    if (currentVal !== previousVal) {
      diffs.push({
        field,
        previous: previousVal,
        current: currentVal,
      });
    }
  }

  const currentProductTypes = Array.isArray(currentSnapshot.productTypes)
    ? [...currentSnapshot.productTypes].sort()
    : [];
  const previousProductTypes = Array.isArray(previousSnapshot.productTypes)
    ? [...previousSnapshot.productTypes].sort()
    : [];

  if (JSON.stringify(currentProductTypes) !== JSON.stringify(previousProductTypes)) {
    diffs.push({
      field: 'productTypes',
      previous: previousProductTypes,
      current: currentProductTypes,
    });
  }

  const currentChannels = Array.isArray(currentSnapshot.channels)
    ? [...currentSnapshot.channels].sort()
    : [];
  const previousChannels = Array.isArray(previousSnapshot.channels)
    ? [...previousSnapshot.channels].sort()
    : [];

  if (JSON.stringify(currentChannels) !== JSON.stringify(previousChannels)) {
    diffs.push({
      field: 'channels',
      previous: previousChannels,
      current: currentChannels,
    });
  }

  const currentSellerIds = Array.isArray(currentSnapshot.sellerIds)
    ? [...currentSnapshot.sellerIds].sort()
    : null;
  const previousSellerIds = Array.isArray(previousSnapshot.sellerIds)
    ? [...previousSnapshot.sellerIds].sort()
    : null;

  if (JSON.stringify(currentSellerIds) !== JSON.stringify(previousSellerIds)) {
    diffs.push({
      field: 'sellerIds',
      previous: previousSellerIds,
      current: currentSellerIds,
    });
  }

  const currentConditions = Array.isArray(currentSnapshot.conditions)
    ? currentSnapshot.conditions
    : [];
  const previousConditions = Array.isArray(previousSnapshot.conditions)
    ? previousSnapshot.conditions
    : [];

  if (JSON.stringify(currentConditions) !== JSON.stringify(previousConditions)) {
    diffs.push({
      field: 'conditions',
      previous: previousConditions,
      current: currentConditions,
    });
  }

  return diffs;
};

const formatDiffValue = (field, value) => {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (field) {
    case 'ruleType':
      return RULE_TYPE_LABELS[value] || value;
    case 'status':
      return value === 'active' ? 'Active' : value === 'archived' ? 'Archived' : value;
    case 'productTypes':
      return Array.isArray(value)
        ? value.map((pt) => PRODUCT_TYPE_LABELS[pt] || pt).join(', ')
        : '—';
    case 'channels':
      return Array.isArray(value)
        ? value.map((ch) => CHANNEL_LABELS[ch] || ch).join(', ')
        : '—';
    case 'sellerIds':
      return Array.isArray(value) && value.length > 0
        ? value.join(', ')
        : 'All Sellers';
    case 'effectiveDate':
    case 'expirationDate':
      return value ? formatDate(value, 'MMM d, yyyy') : '—';
    case 'conditions':
      return Array.isArray(value) ? `${value.length} condition(s)` : '—';
    default:
      return String(value);
  }
};

const DiffBadge = ({ field, previous, current }) => {
  const previousDisplay = formatDiffValue(field, previous);
  const currentDisplay = formatDiffValue(field, current);

  const fieldLabels = {
    name: 'Rule Name',
    description: 'Description',
    ruleType: 'Rule Type',
    weight: 'Weight',
    effectiveDate: 'Effective Date',
    expirationDate: 'Expiration Date',
    status: 'Status',
    productTypes: 'Product Types',
    channels: 'Channels',
    sellerIds: 'Seller Scope',
    conditions: 'Conditions',
  };

  const fieldLabel = fieldLabels[field] || field;

  return (
    <div className='flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200'>
      <div className='flex-shrink-0 mt-0.5'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-4 h-4 text-amber-600'
        >
          <path d='M17 1l4 4-4 4' />
          <path d='M3 11V9a4 4 0 0 1 4-4h14' />
          <path d='M7 23l-4-4 4-4' />
          <path d='M21 13v2a4 4 0 0 1-4 4H3' />
        </svg>
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-xs font-semibold text-amber-800 mb-1'>{fieldLabel}</p>
        <div className='flex items-center gap-2 text-xs'>
          <span className='inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono line-through'>
            {previousDisplay}
          </span>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-3.5 h-3.5 text-gray-400 flex-shrink-0'
          >
            <polyline points='9 18 15 12 9 6' />
          </svg>
          <span className='inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-mono'>
            {currentDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};

DiffBadge.propTypes = {
  field: PropTypes.string.isRequired,
  previous: PropTypes.any,
  current: PropTypes.any,
};

DiffBadge.defaultProps = {
  previous: null,
  current: null,
};

const RuleVersionHistory = ({ rule, isOpen, onClose }) => {
  const { getRuleVersions } = useRules();

  const [expandedVersions, setExpandedVersions] = useState(new Set());

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setExpandedVersions(new Set());
    }
  }, [isOpen]);

  const versions = useMemo(() => {
    if (!rule || !rule.id || !isOpen) {
      return [];
    }

    const allVersions = getRuleVersions(rule.id);

    if (!Array.isArray(allVersions)) {
      return [];
    }

    return [...allVersions].sort((a, b) => b.version - a.version);
  }, [rule, isOpen, getRuleVersions]);

  const handleToggleVersion = useCallback((versionId) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const ruleName = rule?.name || 'Unnamed Rule';
  const ruleId = rule?.id || 'Unknown';

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='version-history-modal-title'
      aria-describedby='version-history-modal-description'
    >
      <div className='w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0'>
          <div>
            <h2 id='version-history-modal-title' className='text-lg font-semibold text-gray-900'>
              Version History
            </h2>
            <p id='version-history-modal-description' className='text-sm text-gray-500 mt-0.5'>
              View all versions of rule{' '}
              <span className='font-mono text-gray-700'>{ruleId}</span>
              {ruleName && (
                <>
                  {' '}—{' '}
                  <span className='text-gray-700'>{ruleName}</span>
                </>
              )}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
            aria-label='Close version history'
          >
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
              <line x1='18' y1='6' x2='6' y2='18' />
              <line x1='6' y1='6' x2='18' y2='18' />
            </svg>
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-5'>
          {versions.length === 0 ? (
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
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Version History</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No version history is available for this rule. Version records are created when
                rules are created or modified.
              </p>
            </div>
          ) : (
            <div className='relative'>
              <div className='absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200' aria-hidden='true' />

              <div className='space-y-6'>
                {versions.map((version, index) => {
                  if (!version) return null;

                  const isExpanded = expandedVersions.has(version.id);
                  const isLatest = index === 0;
                  const previousVersion = index < versions.length - 1 ? versions[index + 1] : null;

                  const diffs =
                    isExpanded && previousVersion && version.snapshot && previousVersion.snapshot
                      ? getDiffFields(version.snapshot, previousVersion.snapshot)
                      : [];

                  const snapshot = version.snapshot;
                  const ruleType = snapshot?.ruleType;
                  const ruleTypeLabel = RULE_TYPE_LABELS[ruleType] || ruleType || 'Unknown';
                  const ruleTypeColor =
                    RULE_TYPE_COLORS[ruleType] || 'bg-gray-100 text-gray-700 border-gray-200';
                  const status = snapshot?.status;
                  const statusLabel =
                    status === 'active' ? 'Active' : status === 'archived' ? 'Archived' : status;
                  const statusColor =
                    STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-200';

                  return (
                    <div key={version.id} className='relative pl-10'>
                      <div
                        className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                          isLatest
                            ? 'bg-enterprise-600 border-enterprise-600 text-white'
                            : 'bg-white border-gray-300 text-gray-500'
                        }`}
                        aria-hidden='true'
                      >
                        {isLatest ? (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2.5}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className='w-4 h-4'
                          >
                            <polyline points='20 6 9 17 4 12' />
                          </svg>
                        ) : (
                          <span className='text-xs font-bold'>v{version.version}</span>
                        )}
                      </div>

                      <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                        <div className='flex items-center justify-between mb-3'>
                          <div className='flex items-center gap-3'>
                            <div className='flex items-center gap-2'>
                              <span className='inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-enterprise-100 text-enterprise-700 text-xs font-bold'>
                                v{version.version}
                              </span>
                              {isLatest && (
                                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium bg-green-100 text-green-700 border border-green-200'>
                                  Current
                                </span>
                              )}
                            </div>
                            <span className='text-xs text-gray-400'>
                              {formatDate(version.changedAt, 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>

                          <button
                            type='button'
                            onClick={() => handleToggleVersion(version.id)}
                            className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                            aria-label={isExpanded ? 'Collapse version details' : 'Expand version details'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              viewBox='0 0 24 24'
                              fill='none'
                              stroke='currentColor'
                              strokeWidth={2}
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            >
                              <polyline points='6 9 12 15 18 9' />
                            </svg>
                          </button>
                        </div>

                        <div className='grid grid-cols-2 gap-3 text-sm'>
                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-0.5'>
                              Changed By
                            </span>
                            <span className='text-gray-900'>
                              {version.changedBy || 'Unknown'}
                            </span>
                          </div>
                          <div>
                            <span className='text-xs font-medium text-gray-500 uppercase tracking-wider block mb-0.5'>
                              Reason
                            </span>
                            <span className='text-gray-900'>
                              {version.changeReason || '—'}
                            </span>
                          </div>
                        </div>

                        {isExpanded && snapshot && (
                          <div className='mt-4 space-y-4 animate-fade-in'>
                            <div className='border-t border-gray-200 pt-4'>
                              <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3'>
                                Rule Snapshot
                              </span>

                              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>Name</span>
                                  <span className='text-sm font-medium text-gray-900'>
                                    {snapshot.name || '—'}
                                  </span>
                                </div>

                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>Type</span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ruleTypeColor}`}
                                  >
                                    {ruleTypeLabel}
                                  </span>
                                </div>

                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>Status</span>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>

                                {snapshot.ruleType === 'weighted_score' && (
                                  <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                    <span className='text-xs text-gray-500 block mb-0.5'>Weight</span>
                                    <span className='text-sm font-medium text-gray-900'>
                                      {snapshot.weight ?? '—'}
                                    </span>
                                  </div>
                                )}

                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>
                                    Effective Date
                                  </span>
                                  <span className='text-sm font-medium text-gray-900'>
                                    {snapshot.effectiveDate
                                      ? formatDate(snapshot.effectiveDate, 'MMM d, yyyy')
                                      : '—'}
                                  </span>
                                </div>

                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>
                                    Expiration Date
                                  </span>
                                  <span className='text-sm font-medium text-gray-900'>
                                    {snapshot.expirationDate
                                      ? formatDate(snapshot.expirationDate, 'MMM d, yyyy')
                                      : 'No expiration'}
                                  </span>
                                </div>
                              </div>

                              {snapshot.description && (
                                <div className='mt-3 p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-0.5'>
                                    Description
                                  </span>
                                  <span className='text-sm text-gray-700'>
                                    {snapshot.description}
                                  </span>
                                </div>
                              )}

                              <div className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-1'>
                                    Product Types
                                  </span>
                                  <div className='flex flex-wrap gap-1'>
                                    {Array.isArray(snapshot.productTypes) &&
                                    snapshot.productTypes.length > 0 ? (
                                      snapshot.productTypes.map((pt) => (
                                        <span
                                          key={pt}
                                          className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'
                                        >
                                          {PRODUCT_TYPE_LABELS[pt] || pt}
                                        </span>
                                      ))
                                    ) : (
                                      <span className='text-xs text-gray-400'>All</span>
                                    )}
                                  </div>
                                </div>

                                <div className='p-3 rounded-lg bg-white border border-gray-200'>
                                  <span className='text-xs text-gray-500 block mb-1'>Channels</span>
                                  <div className='flex flex-wrap gap-1'>
                                    {Array.isArray(snapshot.channels) &&
                                    snapshot.channels.length > 0 ? (
                                      snapshot.channels.map((ch) => (
                                        <span
                                          key={ch}
                                          className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'
                                        >
                                          {CHANNEL_LABELS[ch] || ch}
                                        </span>
                                      ))
                                    ) : (
                                      <span className='text-xs text-gray-400'>All</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className='mt-3 p-3 rounded-lg bg-white border border-gray-200'>
                                <span className='text-xs text-gray-500 block mb-1'>
                                  Seller Scope
                                </span>
                                <span className='text-sm text-gray-900'>
                                  {Array.isArray(snapshot.sellerIds) &&
                                  snapshot.sellerIds.length > 0
                                    ? snapshot.sellerIds.join(', ')
                                    : 'All Sellers'}
                                </span>
                              </div>

                              {Array.isArray(snapshot.conditions) &&
                                snapshot.conditions.length > 0 && (
                                  <div className='mt-3'>
                                    <span className='text-xs text-gray-500 block mb-2'>
                                      Conditions ({snapshot.conditions.length})
                                    </span>
                                    <div className='space-y-2'>
                                      {snapshot.conditions.map((condition, condIdx) => {
                                        if (!condition) return null;

                                        return (
                                          <div
                                            key={condIdx}
                                            className='p-3 rounded-lg bg-white border border-gray-200'
                                          >
                                            <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs'>
                                              <div>
                                                <span className='text-gray-400 block'>Field</span>
                                                <span className='font-medium text-gray-700'>
                                                  {CONDITION_FIELD_LABELS[condition.field] ||
                                                    condition.field ||
                                                    '—'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className='text-gray-400 block'>Operator</span>
                                                <span className='font-medium text-gray-700'>
                                                  {CONDITION_OPERATOR_LABELS[condition.operator] ||
                                                    condition.operator ||
                                                    '—'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className='text-gray-400 block'>Value</span>
                                                <span className='font-medium text-gray-700 font-mono'>
                                                  {formatConditionValue(condition.value)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className='text-gray-400 block'>Message</span>
                                                <span className='font-medium text-gray-700'>
                                                  {condition.message || '—'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                            </div>

                            {diffs.length > 0 && (
                              <div className='border-t border-gray-200 pt-4'>
                                <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3'>
                                  Changes from v{previousVersion?.version || '?'}
                                </span>
                                <div className='space-y-2'>
                                  {diffs.map((diff) => (
                                    <DiffBadge
                                      key={diff.field}
                                      field={diff.field}
                                      previous={diff.previous}
                                      current={diff.current}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {isExpanded && !previousVersion && (
                              <div className='border-t border-gray-200 pt-4'>
                                <div className='p-3 rounded-lg bg-blue-50 border border-blue-200'>
                                  <div className='flex items-start gap-2'>
                                    <svg
                                      xmlns='http://www.w3.org/2000/svg'
                                      viewBox='0 0 24 24'
                                      fill='none'
                                      stroke='currentColor'
                                      strokeWidth={2}
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      className='w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5'
                                    >
                                      <circle cx='12' cy='12' r='10' />
                                      <line x1='12' y1='16' x2='12' y2='12' />
                                      <line x1='12' y1='8' x2='12.01' y2='8' />
                                    </svg>
                                    <p className='text-xs text-blue-700'>
                                      This is the initial version of the rule. No previous version
                                      to compare against.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className='flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex-shrink-0'>
          <button type='button' onClick={onClose} className='btn-enterprise-secondary'>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

RuleVersionHistory.propTypes = {
  rule: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    productTypes: PropTypes.arrayOf(PropTypes.string),
    channels: PropTypes.arrayOf(PropTypes.string),
    sellerIds: PropTypes.arrayOf(PropTypes.string),
    ruleType: PropTypes.string,
    conditions: PropTypes.arrayOf(
      PropTypes.shape({
        field: PropTypes.string,
        operator: PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
        message: PropTypes.string,
      }),
    ),
    weight: PropTypes.number,
    effectiveDate: PropTypes.string,
    expirationDate: PropTypes.string,
    status: PropTypes.string,
    version: PropTypes.number,
    createdBy: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

RuleVersionHistory.defaultProps = {
  rule: null,
};

export default RuleVersionHistory;