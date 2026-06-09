import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { debug } from '../../utils/logger';

const COMPONENT_NAME = 'ExposureSummary';

const ALLOWED_ROLES = ['risk-analyst', 'admin', 'executive'];

const AGING_BUCKETS = [
  { key: '0-30', label: '0–30 Days', minDays: 0, maxDays: 30 },
  { key: '31-60', label: '31–60 Days', minDays: 31, maxDays: 60 },
  { key: '61-90', label: '61–90 Days', minDays: 61, maxDays: 90 },
  { key: '91-180', label: '91–180 Days', minDays: 91, maxDays: 180 },
  { key: '180+', label: '180+ Days', minDays: 181, maxDays: Infinity },
];

const AGING_BUCKET_COLORS = {
  '0-30': 'bg-blue-100 text-blue-700 border-blue-200',
  '31-60': 'bg-amber-100 text-amber-700 border-amber-200',
  '61-90': 'bg-orange-100 text-orange-700 border-orange-200',
  '91-180': 'bg-red-100 text-red-700 border-red-200',
  '180+': 'bg-red-200 text-red-800 border-red-300',
};

const getAgingBucket = (createdAt, status) => {
  if (!createdAt) return null;
  if (status === 'closed') return null;

  try {
    const createdDate = new Date(createdAt);
    if (isNaN(createdDate.getTime())) return null;

    const now = new Date();
    const diffMs = now - createdDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    for (const bucket of AGING_BUCKETS) {
      if (diffDays >= bucket.minDays && diffDays <= bucket.maxDays) {
        return bucket.key;
      }
    }

    return '180+';
  } catch {
    return null;
  }
};

const calculateExposure = (repurchaseCase) => {
  if (!repurchaseCase) return 0;

  if (repurchaseCase.status === 'closed') {
    return repurchaseCase.finalOutcome?.settledAmount || 0;
  }

  if (repurchaseCase.status === 'draft') {
    return 0;
  }

  if (
    repurchaseCase.alternativeProposal?.status === 'accepted' &&
    repurchaseCase.alternativeProposal?.amount !== null &&
    repurchaseCase.alternativeProposal?.amount !== undefined
  ) {
    return repurchaseCase.alternativeProposal.amount;
  }

  return repurchaseCase.demandAmount || 0;
};

const ExposureSummary = ({ repurchaseCases, className = '' }) => {
  const { currentPersona } = useAuth();

  const personaId = currentPersona?.id || '';
  const canViewFinancialExposure = ALLOWED_ROLES.includes(personaId);

  const safeRepurchaseCases = useMemo(() => {
    if (!Array.isArray(repurchaseCases)) {
      return [];
    }
    return repurchaseCases;
  }, [repurchaseCases]);

  const totalOpenExposure = useMemo(() => {
    if (!canViewFinancialExposure) return 0;

    let total = 0;

    for (const repurchaseCase of safeRepurchaseCases) {
      if (!repurchaseCase) continue;
      if (repurchaseCase.status === 'closed') continue;

      total += calculateExposure(repurchaseCase);
    }

    return Math.round(total * 100) / 100;
  }, [safeRepurchaseCases, canViewFinancialExposure]);

  const exposureByCounterparty = useMemo(() => {
    if (!canViewFinancialExposure) return [];

    const counterpartyMap = new Map();

    for (const repurchaseCase of safeRepurchaseCases) {
      if (!repurchaseCase) continue;
      if (repurchaseCase.status === 'closed') continue;

      const sellerId = repurchaseCase.sellerId || 'Unknown';
      const exposure = calculateExposure(repurchaseCase);

      if (!counterpartyMap.has(sellerId)) {
        counterpartyMap.set(sellerId, {
          counterpartyId: sellerId,
          totalExposure: 0,
          caseCount: 0,
        });
      }

      const entry = counterpartyMap.get(sellerId);
      entry.totalExposure += exposure;
      entry.caseCount++;
    }

    const result = Array.from(counterpartyMap.values());
    result.sort((a, b) => b.totalExposure - a.totalExposure);

    return result;
  }, [safeRepurchaseCases, canViewFinancialExposure]);

  const exposureByAging = useMemo(() => {
    if (!canViewFinancialExposure) return [];

    const bucketMap = new Map();

    for (const key of AGING_BUCKETS.map((b) => b.key)) {
      bucketMap.set(key, {
        bucket: key,
        label: AGING_BUCKETS.find((b) => b.key === key)?.label || key,
        totalExposure: 0,
        caseCount: 0,
      });
    }

    for (const repurchaseCase of safeRepurchaseCases) {
      if (!repurchaseCase) continue;
      if (repurchaseCase.status === 'closed') continue;

      const bucket = getAgingBucket(repurchaseCase.createdAt, repurchaseCase.status);

      if (!bucket) continue;

      const exposure = calculateExposure(repurchaseCase);
      const entry = bucketMap.get(bucket);

      if (entry) {
        entry.totalExposure += exposure;
        entry.caseCount++;
      }
    }

    return Array.from(bucketMap.values()).filter((entry) => entry.caseCount > 0);
  }, [safeRepurchaseCases, canViewFinancialExposure]);

  const recoveryRate = useMemo(() => {
    if (!canViewFinancialExposure) return null;

    let totalDemanded = 0;
    let totalRecovered = 0;

    for (const repurchaseCase of safeRepurchaseCases) {
      if (!repurchaseCase) continue;

      totalDemanded += repurchaseCase.demandAmount || 0;

      if (repurchaseCase.status === 'closed' && repurchaseCase.finalOutcome?.settledAmount !== null && repurchaseCase.finalOutcome?.settledAmount !== undefined) {
        totalRecovered += repurchaseCase.finalOutcome.settledAmount;
      }
    }

    if (totalDemanded === 0) return null;

    return {
      totalDemanded,
      totalRecovered,
      rate: Math.round((totalRecovered / totalDemanded) * 10000) / 100,
    };
  }, [safeRepurchaseCases, canViewFinancialExposure]);

  const openCaseCount = useMemo(() => {
    return safeRepurchaseCases.filter(
      (c) => c && c.status !== 'closed' && c.status !== 'draft',
    ).length;
  }, [safeRepurchaseCases]);

  const closedCaseCount = useMemo(() => {
    return safeRepurchaseCases.filter((c) => c && c.status === 'closed').length;
  }, [safeRepurchaseCases]);

  if (!canViewFinancialExposure) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='text-center py-8'>
          <div className='mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 mb-3'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-6 h-6 text-gray-400'
            >
              <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
              <path d='M7 11V7a5 5 0 0 1 10 0v4' />
              <circle cx='12' cy='16' r='1' />
            </svg>
          </div>
          <p className='text-sm text-gray-500'>
            Financial exposure data is restricted to authorized personas.
          </p>
        </div>
      </div>
    );
  }

  if (safeRepurchaseCases.length === 0) {
    return (
      <div className={`card-enterprise ${className}`}>
        <div className='flex items-center justify-between mb-5'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>Financial Exposure</h2>
            <p className='text-sm text-gray-500 mt-0.5'>
              Aggregate exposure metrics across all repurchase cases.
            </p>
          </div>
        </div>

        <div className='text-center py-8'>
          <div className='mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 mb-3'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-6 h-6 text-gray-400'
            >
              <line x1='12' y1='1' x2='12' y2='23' />
              <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
            </svg>
          </div>
          <p className='text-sm text-gray-500'>No repurchase cases available for exposure analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-enterprise ${className}`}>
      <div className='flex items-center justify-between mb-5'>
        <div>
          <h2 className='text-lg font-semibold text-gray-900'>Financial Exposure</h2>
          <p className='text-sm text-gray-500 mt-0.5'>
            Aggregate exposure metrics across {safeRepurchaseCases.length} repurchase case
            {safeRepurchaseCases.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='p-4 rounded-xl bg-red-50 border border-red-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Total Open Exposure
          </p>
          <p className='text-2xl font-bold text-red-700'>
            {formatCurrency(totalOpenExposure)}
          </p>
          <p className='text-xs text-red-600 mt-1'>
            {openCaseCount} open case{openCaseCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Open Cases
          </p>
          <p className='text-2xl font-bold text-gray-900'>{openCaseCount}</p>
          <p className='text-xs text-gray-500 mt-1'>
            {closedCaseCount} closed
          </p>
        </div>

        <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
          <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
            Counterparties
          </p>
          <p className='text-2xl font-bold text-gray-900'>
            {exposureByCounterparty.length}
          </p>
          <p className='text-xs text-gray-500 mt-1'>with open exposure</p>
        </div>

        {recoveryRate && (
          <div className='p-4 rounded-xl bg-green-50 border border-green-200'>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
              Recovery Rate
            </p>
            <p className='text-2xl font-bold text-green-700'>{recoveryRate.rate}%</p>
            <p className='text-xs text-green-600 mt-1'>
              {formatCurrency(recoveryRate.totalRecovered)} of{' '}
              {formatCurrency(recoveryRate.totalDemanded)}
            </p>
          </div>
        )}
      </div>

      {exposureByCounterparty.length > 0 && (
        <div className='mb-6'>
          <h3 className='text-sm font-semibold text-gray-700 mb-3'>
            Exposure by Counterparty
          </h3>

          <div className='space-y-3'>
            {exposureByCounterparty.map((entry) => {
              const percentage =
                totalOpenExposure > 0
                  ? Math.round((entry.totalExposure / totalOpenExposure) * 10000) / 100
                  : 0;

              return (
                <div
                  key={entry.counterpartyId}
                  className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                >
                  <div className='flex items-center justify-between mb-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-mono text-gray-600'>
                        {entry.counterpartyId}
                      </span>
                      <span className='text-xs text-gray-400'>•</span>
                      <span className='text-xs text-gray-500'>
                        {entry.caseCount} case{entry.caseCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className='text-sm font-mono font-semibold text-gray-900'>
                      {formatCurrency(entry.totalExposure)}
                    </span>
                  </div>

                  <div className='w-full bg-gray-200 rounded-full h-2 overflow-hidden'>
                    <div
                      className='h-full rounded-full bg-red-500 transition-all duration-300'
                      style={{ width: `${Math.max(1, percentage)}%` }}
                    />
                  </div>

                  <div className='flex items-center justify-between mt-1'>
                    <span className='text-xs text-gray-400'>
                      {percentage}% of total open exposure
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {exposureByAging.length > 0 && (
        <div>
          <h3 className='text-sm font-semibold text-gray-700 mb-3'>
            Exposure by Aging Bucket
          </h3>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {exposureByAging.map((entry) => {
              const bucketColor =
                AGING_BUCKET_COLORS[entry.bucket] ||
                'bg-gray-100 text-gray-700 border-gray-200';

              return (
                <div
                  key={entry.bucket}
                  className={`p-4 rounded-xl border ${bucketColor}`}
                >
                  <div className='flex items-center justify-between mb-1'>
                    <span className='text-xs font-semibold uppercase tracking-wider'>
                      {entry.label}
                    </span>
                    <span className='text-xs font-medium opacity-75'>
                      {entry.caseCount} case{entry.caseCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className='text-lg font-bold mt-1'>
                    {formatCurrency(entry.totalExposure)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {exposureByCounterparty.length === 0 && exposureByAging.length === 0 && (
        <div className='text-center py-6'>
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
            <line x1='12' y1='1' x2='12' y2='23' />
            <path d='M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' />
          </svg>
          <p className='text-sm text-gray-500'>
            No open exposure to display. All repurchase cases are closed or in draft.
          </p>
        </div>
      )}
    </div>
  );
};

ExposureSummary.propTypes = {
  repurchaseCases: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      linkedDefectIds: PropTypes.arrayOf(PropTypes.string),
      sellerId: PropTypes.string,
      loanId: PropTypes.string,
      demandAmount: PropTypes.number,
      rationale: PropTypes.string,
      evidence: PropTypes.array,
      status: PropTypes.string,
      counterpartyResponse: PropTypes.shape({
        receivedAt: PropTypes.string,
        responseType: PropTypes.string,
        rationale: PropTypes.string,
        proposedAmount: PropTypes.number,
      }),
      alternativeProposal: PropTypes.shape({
        type: PropTypes.string,
        terms: PropTypes.string,
        amount: PropTypes.number,
        status: PropTypes.string,
      }),
      finalOutcome: PropTypes.shape({
        type: PropTypes.string,
        settledAmount: PropTypes.number,
        closedAt: PropTypes.string,
        notes: PropTypes.string,
      }),
      exposure: PropTypes.number,
      createdAt: PropTypes.string,
      updatedAt: PropTypes.string,
    }),
  ),
  className: PropTypes.string,
};

ExposureSummary.defaultProps = {
  repurchaseCases: [],
  className: '',
};

export default ExposureSummary;