import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useQC } from '../contexts/QCContext';
import { useLoans } from '../contexts/LoanContext';
import { useDefects } from '../contexts/DefectContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { formatCurrency, formatDate, truncateText } from '../utils/formatters';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import PIIField from '../components/shared/PIIField';

const COMPONENT_NAME = 'QCCaseReview';

const ALLOWED_ROLES = ['risk-analyst', 'admin'];

const CHECKLIST_RESPONSES = [
  { value: 'pass', label: 'Pass', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'fail', label: 'Fail', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'na', label: 'N/A', color: 'bg-gray-100 text-gray-500 border-gray-200' },
];

const DEFECT_SEVERITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'observation', label: 'Observation' },
];

const DEFECT_ROOT_CAUSES = [
  'Seller Error',
  'Process Gap',
  'System Issue',
  'Third-Party Error',
  'Borrower Misrepresentation',
  'Underwriter Error',
  'Documentation Deficiency',
  'Training Gap',
];

const DEFECT_SOURCES = [
  { value: 'pre_closing', label: 'Pre-Closing' },
  { value: 'post_closing', label: 'Post-Closing' },
  { value: 'servicing', label: 'Servicing' },
];

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

const QC_STATUS_LABELS = {
  pending: 'Pending',
  in_review: 'In Review',
  completed: 'Completed',
  escalated: 'Escalated',
};

const QC_STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  escalated: 'bg-red-100 text-red-700 border-red-200',
};

const DefectForm = ({ checklistItem, qcCaseId, loanId, sellerId, taxonomy, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    taxonomyCode: '',
    category: '',
    subcategory: '',
    severity: 'major',
    rootCause: '',
    sourceOfDefect: 'pre_closing',
    description: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (checklistItem && checklistItem.notes) {
      setFormData((prev) => ({
        ...prev,
        description: checklistItem.notes || '',
      }));
    }
  }, [checklistItem]);

  const flatTaxonomy = useMemo(() => {
    if (!taxonomy || !Array.isArray(taxonomy.categories)) {
      return [];
    }

    const flat = [];

    for (const category of taxonomy.categories) {
      for (const subcategory of category.subcategories) {
        for (const defectType of subcategory.defectTypes) {
          flat.push({
            taxonomyCode: `${category.code}.${subcategory.code}.${defectType.code}`,
            category: category.name,
            subcategory: subcategory.name,
            defectName: defectType.name,
            defaultSeverity: defectType.defaultSeverity,
          });
        }
      }
    }

    return flat;
  }, [taxonomy]);

  const handleTaxonomyCodeChange = useCallback(
    (e) => {
      const code = e.target.value;
      const entry = flatTaxonomy.find((t) => t.taxonomyCode === code);

      if (entry) {
        setFormData((prev) => ({
          ...prev,
          taxonomyCode: code,
          category: entry.category,
          subcategory: entry.subcategory,
          severity: entry.defaultSeverity || 'major',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          taxonomyCode: code,
          category: '',
          subcategory: '',
        }));
      }

      if (errors.taxonomyCode) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.taxonomyCode;
          return next;
        });
      }
    },
    [flatTaxonomy, errors.taxonomyCode],
  );

  const handleFieldChange = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors],
  );

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.taxonomyCode || formData.taxonomyCode.trim() === '') {
      newErrors.taxonomyCode = 'Please select a defect taxonomy code.';
    }

    if (!formData.rootCause || formData.rootCause.trim() === '') {
      newErrors.rootCause = 'Please select a root cause.';
    }

    if (!formData.description || formData.description.trim() === '') {
      newErrors.description = 'Description is required.';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const defectData = {
        qcCaseId,
        loanId,
        sellerId,
        taxonomyCode: formData.taxonomyCode,
        category: formData.category,
        subcategory: formData.subcategory,
        severity: formData.severity,
        rootCause: formData.rootCause,
        sourceOfDefect: formData.sourceOfDefect,
        description: formData.description,
        evidence: [],
      };

      if (isMountedRef.current) {
        onSave(defectData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Defect form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, qcCaseId, loanId, sellerId, onSave]);

  return (
    <div className='p-4 rounded-xl bg-red-50 border border-red-200 animate-fade-in'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
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
          <h4 className='text-sm font-semibold text-red-800'>Log Defect</h4>
        </div>
        <button
          type='button'
          onClick={onCancel}
          disabled={isSubmitting}
          className='p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
          aria-label='Cancel defect form'
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
            <line x1='18' y1='6' x2='6' y2='18' />
            <line x1='6' y1='6' x2='18' y2='18' />
          </svg>
        </button>
      </div>

      <div className='space-y-4'>
        <div>
          <label
            htmlFor='defect-taxonomy-code'
            className='block text-xs font-medium text-gray-700 mb-1'
          >
            Defect Type
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <select
            id='defect-taxonomy-code'
            value={formData.taxonomyCode}
            onChange={handleTaxonomyCodeChange}
            disabled={isSubmitting}
            className={`input-enterprise py-1.5 text-sm ${errors.taxonomyCode ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Defect taxonomy code'
            aria-describedby={errors.taxonomyCode ? 'defect-taxonomy-error' : undefined}
            aria-invalid={errors.taxonomyCode ? 'true' : 'false'}
          >
            <option value=''>Select defect type...</option>
            {flatTaxonomy.map((entry) => (
              <option key={entry.taxonomyCode} value={entry.taxonomyCode}>
                {entry.taxonomyCode} — {entry.defectName}
              </option>
            ))}
          </select>
          {errors.taxonomyCode && (
            <p id='defect-taxonomy-error' className='text-xs text-red-600 mt-1 flex items-center gap-1'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3 h-3 flex-shrink-0'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
              {errors.taxonomyCode}
            </p>
          )}
        </div>

        {formData.taxonomyCode && (
          <div className='grid grid-cols-2 gap-3 p-3 rounded-lg bg-white border border-gray-200'>
            <div>
              <span className='text-xs text-gray-400 block'>Category</span>
              <span className='text-sm font-medium text-gray-700'>{formData.category || '—'}</span>
            </div>
            <div>
              <span className='text-xs text-gray-400 block'>Subcategory</span>
              <span className='text-sm font-medium text-gray-700'>{formData.subcategory || '—'}</span>
            </div>
          </div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label
              htmlFor='defect-severity'
              className='block text-xs font-medium text-gray-700 mb-1'
            >
              Severity
            </label>
            <select
              id='defect-severity'
              value={formData.severity}
              onChange={(e) => handleFieldChange('severity', e.target.value)}
              disabled={isSubmitting}
              className='input-enterprise py-1.5 text-sm'
              aria-label='Defect severity'
            >
              {DEFECT_SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor='defect-source'
              className='block text-xs font-medium text-gray-700 mb-1'
            >
              Source of Defect
            </label>
            <select
              id='defect-source'
              value={formData.sourceOfDefect}
              onChange={(e) => handleFieldChange('sourceOfDefect', e.target.value)}
              disabled={isSubmitting}
              className='input-enterprise py-1.5 text-sm'
              aria-label='Source of defect'
            >
              {DEFECT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor='defect-root-cause'
            className='block text-xs font-medium text-gray-700 mb-1'
          >
            Root Cause
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <select
            id='defect-root-cause'
            value={formData.rootCause}
            onChange={(e) => handleFieldChange('rootCause', e.target.value)}
            disabled={isSubmitting}
            className={`input-enterprise py-1.5 text-sm ${errors.rootCause ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Root cause'
            aria-describedby={errors.rootCause ? 'defect-root-cause-error' : undefined}
            aria-invalid={errors.rootCause ? 'true' : 'false'}
          >
            <option value=''>Select root cause...</option>
            {DEFECT_ROOT_CAUSES.map((rc) => (
              <option key={rc} value={rc}>
                {rc}
              </option>
            ))}
          </select>
          {errors.rootCause && (
            <p id='defect-root-cause-error' className='text-xs text-red-600 mt-1 flex items-center gap-1'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3 h-3 flex-shrink-0'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
              {errors.rootCause}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor='defect-description'
            className='block text-xs font-medium text-gray-700 mb-1'
          >
            Description
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <textarea
            id='defect-description'
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            disabled={isSubmitting}
            rows={3}
            placeholder='Describe the defect in detail...'
            className={`input-enterprise py-1.5 text-sm resize-none ${errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Defect description'
            aria-describedby={errors.description ? 'defect-description-error' : undefined}
            aria-invalid={errors.description ? 'true' : 'false'}
            maxLength={2000}
          />
          <div className='flex items-center justify-between mt-1'>
            {errors.description ? (
              <p id='defect-description-error' className='text-xs text-red-600 flex items-center gap-1'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3 h-3 flex-shrink-0'
                >
                  <circle cx='12' cy='12' r='10' />
                  <line x1='15' y1='9' x2='9' y2='15' />
                  <line x1='9' y1='9' x2='15' y2='15' />
                </svg>
                {errors.description}
              </p>
            ) : (
              <span />
            )}
            <span className='text-xs text-gray-400'>
              {formData.description.length}/2000
            </span>
          </div>
        </div>

        {errors.submit && (
          <div className='p-3 bg-red-100 border border-red-200 rounded-lg'>
            <div className='flex items-start gap-2'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5'
              >
                <circle cx='12' cy='12' r='10' />
                <line x1='15' y1='9' x2='9' y2='15' />
                <line x1='9' y1='9' x2='15' y2='15' />
              </svg>
              <p className='text-sm text-red-700'>{errors.submit}</p>
            </div>
          </div>
        )}

        <div className='flex items-center justify-end gap-3 pt-2'>
          <button
            type='button'
            onClick={onCancel}
            disabled={isSubmitting}
            className='btn-enterprise-secondary text-xs'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={handleSubmit}
            disabled={isSubmitting}
            className='btn-enterprise-primary text-xs'
          >
            {isSubmitting ? (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 mr-1.5 animate-spin'
                >
                  <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 mr-1.5'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
                Save Defect
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

DefectForm.propTypes = {
  checklistItem: PropTypes.shape({
    id: PropTypes.string,
    category: PropTypes.string,
    question: PropTypes.string,
    response: PropTypes.string,
    notes: PropTypes.string,
    evidenceAttached: PropTypes.bool,
  }),
  qcCaseId: PropTypes.string.isRequired,
  loanId: PropTypes.string.isRequired,
  sellerId: PropTypes.string.isRequired,
  taxonomy: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

DefectForm.defaultProps = {
  checklistItem: null,
  taxonomy: null,
};

const EvidenceAttachmentPanel = ({ checklistItemId, onAttach }) => {
  const [attachments, setAttachments] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState('image/png');

  const fileInputRef = useRef(null);

  const handleAddAttachment = useCallback(() => {
    if (!newFileName || newFileName.trim() === '') {
      return;
    }

    const newAttachment = {
      id: `EVD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: newFileName.trim(),
      fileType: newFileType,
      uploadDate: new Date().toISOString(),
      uploadedBy: 'QC Reviewer',
    };

    setAttachments((prev) => [...prev, newAttachment]);
    setNewFileName('');
    setIsAdding(false);

    if (typeof onAttach === 'function') {
      onAttach(checklistItemId, newAttachment);
    }

    debug(COMPONENT_NAME, 'Evidence attachment added', {
      checklistItemId,
      attachmentId: newAttachment.id,
    });
  }, [newFileName, newFileType, checklistItemId, onAttach]);

  const handleRemoveAttachment = useCallback((attachmentId) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddAttachment();
      }
    },
    [handleAddAttachment],
  );

  const formatFileSize = (fileType) => {
    const sizes = {
      'image/png': '245 KB',
      'image/jpeg': '180 KB',
      'application/pdf': '1.2 MB',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '95 KB',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '320 KB',
    };
    return sizes[fileType] || '150 KB';
  };

  return (
    <div className='mt-3 p-4 rounded-xl bg-gray-50 border border-gray-200'>
      <div className='flex items-center justify-between mb-3'>
        <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
          Evidence Attachments
        </span>
        {!isAdding && (
          <button
            type='button'
            onClick={() => setIsAdding(true)}
            className='inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-enterprise-600 hover:text-enterprise-700 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-3.5 h-3.5'
            >
              <line x1='12' y1='5' x2='12' y2='19' />
              <line x1='5' y1='12' x2='19' y2='12' />
            </svg>
            Add Evidence
          </button>
        )}
      </div>

      {isAdding && (
        <div className='mb-3 p-3 rounded-lg bg-white border border-gray-200'>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            <div className='sm:col-span-2'>
              <label
                htmlFor='evidence-file-name'
                className='block text-xs font-medium text-gray-600 mb-1'
              >
                File Name
              </label>
              <input
                id='evidence-file-name'
                type='text'
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='e.g., checklist_screenshot.png'
                className='input-enterprise py-1.5 text-sm'
                aria-label='Evidence file name'
              />
            </div>
            <div>
              <label
                htmlFor='evidence-file-type'
                className='block text-xs font-medium text-gray-600 mb-1'
              >
                File Type
              </label>
              <select
                id='evidence-file-type'
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                className='input-enterprise py-1.5 text-sm'
                aria-label='Evidence file type'
              >
                <option value='image/png'>PNG Image</option>
                <option value='image/jpeg'>JPEG Image</option>
                <option value='application/pdf'>PDF Document</option>
                <option value='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'>
                  Excel Spreadsheet
                </option>
                <option value='application/vnd.openxmlformats-officedocument.wordprocessingml.document'>
                  Word Document
                </option>
              </select>
            </div>
          </div>
          <div className='flex items-center justify-end gap-2 mt-3'>
            <button
              type='button'
              onClick={() => {
                setIsAdding(false);
                setNewFileName('');
              }}
              className='btn-enterprise-secondary text-xs py-1 px-3'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleAddAttachment}
              disabled={!newFileName || newFileName.trim() === ''}
              className='btn-enterprise-primary text-xs py-1 px-3'
            >
              Add
            </button>
          </div>
        </div>
      )}

      {attachments.length === 0 && !isAdding && (
        <p className='text-xs text-gray-400 italic'>No evidence attached.</p>
      )}

      {attachments.length > 0 && (
        <div className='space-y-2'>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className='flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-200'
            >
              <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-enterprise-50 text-enterprise-600'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-4 h-4'
                >
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                </svg>
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-xs font-medium text-gray-700 truncate'>
                  {attachment.fileName}
                </p>
                <p className='text-2xs text-gray-400'>
                  {formatFileSize(attachment.fileType)} •{' '}
                  {formatDate(attachment.uploadDate, 'MMM d, yyyy HH:mm')}
                </p>
              </div>
              <button
                type='button'
                onClick={() => handleRemoveAttachment(attachment.id)}
                className='flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                aria-label={`Remove attachment ${attachment.fileName}`}
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5'
                >
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

EvidenceAttachmentPanel.propTypes = {
  checklistItemId: PropTypes.string.isRequired,
  onAttach: PropTypes.func,
};

EvidenceAttachmentPanel.defaultProps = {
  onAttach: null,
};

const QCCaseReview = () => {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const { getQCCaseById, updateChecklistItem, completeReview, escalateQCCase } = useQC();
  const { getLoanById } = useLoans();
  const { createDefect, taxonomy } = useDefects();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [checklistState, setChecklistState] = useState({});
  const [activeDefectForm, setActiveDefectForm] = useState(null);
  const [activeEvidencePanel, setActiveEvidencePanel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState([]);
  const [createdDefects, setCreatedDefects] = useState([]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const qcCase = useMemo(() => {
    if (!caseId) return null;
    return getQCCaseById(caseId) || null;
  }, [caseId, getQCCaseById]);

  const loan = useMemo(() => {
    if (!qcCase || !qcCase.loanId) return null;
    return getLoanById(qcCase.loanId) || null;
  }, [qcCase, getLoanById]);

  useEffect(() => {
    if (qcCase && Array.isArray(qcCase.checklist)) {
      const initialState = {};
      for (const item of qcCase.checklist) {
        if (item && item.id) {
          initialState[item.id] = {
            response: item.response || null,
            notes: item.notes || '',
            evidenceAttached: item.evidenceAttached || false,
          };
        }
      }
      setChecklistState(initialState);
    }
  }, [qcCase]);

  const handleResponseChange = useCallback(
    (itemId, response) => {
      setChecklistState((prev) => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          response,
        },
      }));

      if (response === 'fail' && activeDefectForm !== itemId) {
        setActiveDefectForm(itemId);
      }

      if (response !== 'fail' && activeDefectForm === itemId) {
        setActiveDefectForm(null);
      }

      setSubmitErrors([]);
    },
    [activeDefectForm],
  );

  const handleNotesChange = useCallback((itemId, notes) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes,
      },
    }));
  }, []);

  const handleEvidenceAttached = useCallback((itemId) => {
    setChecklistState((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        evidenceAttached: true,
      },
    }));
  }, []);

  const handleSaveDefect = useCallback(
    (defectData) => {
      if (!qcCase || !qcCase.id) return;

      const result = createDefect({
        ...defectData,
        createdBy: currentPersona?.label || 'Unknown',
      });

      if (result.success) {
        setCreatedDefects((prev) => [...prev, result.defect]);

        logEvent(
          'DEFECT_CREATE',
          'defect',
          result.defect.id,
          {
            qcCaseId: qcCase.id,
            loanId: defectData.loanId,
            taxonomyCode: defectData.taxonomyCode,
            severity: defectData.severity,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Defect Created',
          `Defect ${result.defect.id} has been logged for this QC case.`,
        );

        setActiveDefectForm(null);

        debug(COMPONENT_NAME, 'Defect created from QC review', {
          defectId: result.defect.id,
          qcCaseId: qcCase.id,
        });
      } else {
        addNotification(
          'error',
          'Defect Creation Failed',
          result.errors && result.errors.length > 0
            ? result.errors[0].message
            : 'Failed to create defect. Please try again.',
        );
      }
    },
    [qcCase, createDefect, logEvent, addNotification, currentPersona],
  );

  const handleSaveChecklistItem = useCallback(
    (itemId) => {
      if (!qcCase || !qcCase.id) return;

      const itemState = checklistState[itemId];

      if (!itemState || !itemState.response) {
        return;
      }

      const success = updateChecklistItem(
        qcCase.id,
        itemId,
        itemState.response,
        itemState.notes || null,
      );

      if (success) {
        logEvent(
          'QC_CHECKLIST_UPDATE',
          'qc_case',
          qcCase.id,
          {
            checklistItemId: itemId,
            response: itemState.response,
          },
          currentPersona?.label || 'Unknown',
        );

        debug(COMPONENT_NAME, 'Checklist item saved', {
          caseId: qcCase.id,
          itemId,
          response: itemState.response,
        });
      }
    },
    [qcCase, checklistState, updateChecklistItem, logEvent, currentPersona],
  );

  const validateAllItems = useCallback(() => {
    if (!qcCase || !Array.isArray(qcCase.checklist)) {
      return [];
    }

    const errors = [];

    for (const item of qcCase.checklist) {
      if (!item || !item.id) continue;

      const itemState = checklistState[item.id];

      if (!itemState || !itemState.response) {
        errors.push({
          itemId: item.id,
          category: item.category,
          question: item.question,
          message: 'This item has not been reviewed. Please select Pass, Fail, or N/A.',
        });
        continue;
      }

      if (itemState.response === 'fail') {
        const hasDefect = createdDefects.some(
          (d) =>
            d &&
            d.qcCaseId === qcCase.id &&
            d.description &&
            d.description.includes(item.question?.substring(0, 30)),
        );

        if (!hasDefect && activeDefectForm !== item.id) {
          errors.push({
            itemId: item.id,
            category: item.category,
            question: item.question,
            message: 'This item was marked as Fail. Please log a defect before submitting.',
          });
        }
      }
    }

    return errors;
  }, [qcCase, checklistState, createdDefects, activeDefectForm]);

  const handleSubmitReview = useCallback(() => {
    if (!qcCase || !qcCase.id) return;

    if (isSubmitting) return;

    const validationErrors = validateAllItems();

    if (validationErrors.length > 0) {
      setSubmitErrors(validationErrors);
      warn(COMPONENT_NAME, 'QC review validation failed', {
        caseId: qcCase.id,
        errorCount: validationErrors.length,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitErrors([]);

    try {
      const totalItems = qcCase.checklist.length;
      const passedItems = Object.values(checklistState).filter(
        (s) => s && s.response === 'pass',
      ).length;
      const failedItems = Object.values(checklistState).filter(
        (s) => s && s.response === 'fail',
      ).length;

      let overallResult = 'pass';
      if (failedItems > 0) {
        overallResult = 'fail';
      } else if (passedItems < totalItems) {
        overallResult = 'conditional_pass';
      }

      const findings = {
        overallResult,
        notes: `Review completed. ${passedItems} passed, ${failedItems} failed, ${totalItems - passedItems - failedItems} N/A. ${createdDefects.length} defect(s) logged.`,
      };

      const result = completeReview(qcCase.id, findings);

      if (result) {
        logEvent(
          'QC_REVIEW_COMPLETE',
          'qc_case',
          qcCase.id,
          {
            overallResult,
            passedItems,
            failedItems,
            defectsCreated: createdDefects.length,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'QC Review Completed',
          `QC case ${qcCase.id} has been completed. Result: ${overallResult.replace(/_/g, ' ')}. ${createdDefects.length} defect(s) logged.`,
          `/qc/cases/${qcCase.id}`,
        );

        info(COMPONENT_NAME, 'QC review completed', {
          caseId: qcCase.id,
          overallResult,
          defectCount: createdDefects.length,
        });

        if (isMountedRef.current) {
          navigate(`/qc/cases/${qcCase.id}`);
        }
      } else {
        addNotification(
          'error',
          'Review Submission Failed',
          'Failed to complete the QC review. Please try again.',
        );
        setIsSubmitting(false);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'QC review submission threw an error', err);
      addNotification(
        'error',
        'Error',
        'An unexpected error occurred while submitting the review.',
      );
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [
    qcCase,
    isSubmitting,
    checklistState,
    createdDefects,
    validateAllItems,
    completeReview,
    logEvent,
    addNotification,
    currentPersona,
    navigate,
  ]);

  const handleEscalate = useCallback(() => {
    if (!qcCase || !qcCase.id) return;

    const success = escalateQCCase(qcCase.id, 'Escalated during review due to critical findings.');

    if (success) {
      logEvent(
        'QC_CASE_ASSIGN',
        'qc_case',
        qcCase.id,
        {
          action: 'escalated',
          reason: 'Escalated during review',
        },
        currentPersona?.label || 'Unknown',
      );

      addNotification(
        'warning',
        'QC Case Escalated',
        `QC case ${qcCase.id} has been escalated for further review.`,
        `/qc/cases/${qcCase.id}`,
      );

      if (isMountedRef.current) {
        navigate(`/qc/cases/${qcCase.id}`);
      }
    }
  }, [qcCase, escalateQCCase, logEvent, addNotification, currentPersona, navigate]);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!caseId) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'QC Review', path: `/qc/review/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>QC Case Review</h1>
            </div>
          </div>

          <div className='card-enterprise'>
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
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Invalid Case ID</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No QC case ID was provided. Please select a case from the QC queue.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  if (!qcCase) {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'QC Review', path: `/qc/review/${caseId}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>QC Case Review</h1>
            </div>
          </div>

          <div className='card-enterprise'>
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
                  <line x1='12' y1='8' x2='12' y2='12' />
                  <line x1='12' y1='16' x2='12.01' y2='16' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Case Not Found</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                QC case with ID <span className='font-mono text-gray-700'>{caseId}</span> was not
                found.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  if (qcCase.status === 'completed') {
    return (
      <RequireRole allowedRoles={ALLOWED_ROLES}>
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div>
              <BreadcrumbTrail
                items={[
                  { label: 'Dashboard', path: '/dashboard' },
                  { label: 'QC Queue', path: '/qc/queue' },
                  { label: qcCase.id, path: `/qc/review/${qcCase.id}` },
                ]}
                className='mb-2'
              />
              <h1 className='text-2xl font-bold text-gray-900'>QC Case Review</h1>
            </div>
          </div>

          <div className='card-enterprise'>
            <div className='text-center py-12'>
              <div className='mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100 mb-4'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={1.5}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-8 h-8 text-green-600'
                >
                  <polyline points='20 6 9 17 4 12' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Review Already Completed</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                This QC case has already been reviewed and completed. No further changes can be
                made.
              </p>
              <button
                type='button'
                onClick={handleGoBack}
                className='btn-enterprise-secondary mt-4'
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </RequireRole>
    );
  }

  const statusColor = QC_STATUS_COLORS[qcCase.status] || 'bg-gray-100 text-gray-700 border-gray-200';
  const statusLabel = QC_STATUS_LABELS[qcCase.status] || qcCase.status || 'Unknown';

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'QC Queue', path: '/qc/queue' },
    { label: qcCase.id, path: `/qc/review/${qcCase.id}` },
  ];

  const checklistItems = Array.isArray(qcCase.checklist) ? qcCase.checklist : [];

  const checklistProgress = checklistItems.length > 0
    ? Math.round(
        (Object.values(checklistState).filter((s) => s && s.response !== null).length /
          checklistItems.length) *
          100,
      )
    : 0;

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>QC Case Review</h1>
              <span className='text-sm font-mono text-gray-400'>{qcCase.id}</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleGoBack}
              className='btn-enterprise-secondary'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 mr-2'
              >
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Back
            </button>

            <button
              type='button'
              onClick={handleEscalate}
              className='btn-enterprise-secondary text-red-600 hover:text-red-700 hover:bg-red-50'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-4 h-4 mr-2'
              >
                <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                <line x1='12' y1='9' x2='12' y2='13' />
                <line x1='12' y1='17' x2='12.01' y2='17' />
              </svg>
              Escalate
            </button>
          </div>
        </div>

        <div className='card-enterprise'>
          <h2 className='text-lg font-semibold text-gray-900 mb-5'>Loan Summary</h2>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Loan ID
              </p>
              <p className='text-sm font-mono text-gray-900'>{qcCase.loanId || '—'}</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Borrower
              </p>
              {loan ? (
                <PIIField
                  fieldType='fullName'
                  value={loan.borrowerName}
                  entityId={loan.id}
                />
              ) : (
                <span className='text-sm text-gray-400 italic'>Unknown</span>
              )}
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Product / Channel
              </p>
              <p className='text-sm text-gray-900'>
                {loan
                  ? `${PRODUCT_TYPE_LABELS[loan.productType] || loan.productType || '—'} / ${CHANNEL_LABELS[loan.channel] || loan.channel || '—'}`
                  : '—'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Loan Amount
              </p>
              <p className='text-sm font-mono text-gray-900'>
                {loan ? formatCurrency(loan.loanAmount) : '—'}
              </p>
            </div>
          </div>

          {loan && (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4'>
              <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                  Seller ID
                </p>
                <p className='text-sm font-mono text-gray-900'>{loan.sellerId || '—'}</p>
              </div>

              {loan.creditScore !== undefined && loan.creditScore !== null && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    Credit Score
                  </p>
                  <p className='text-sm text-gray-900'>{loan.creditScore}</p>
                </div>
              )}

              {loan.ltv !== undefined && loan.ltv !== null && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    LTV
                  </p>
                  <p className='text-sm text-gray-900'>{loan.ltv}%</p>
                </div>
              )}

              {loan.dti !== undefined && loan.dti !== null && (
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
                  <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                    DTI
                  </p>
                  <p className='text-sm text-gray-900'>{loan.dti}%</p>
                </div>
              )}
            </div>
          )}

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4'>
            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Methodology
              </p>
              <p className='text-sm text-gray-900 capitalize'>
                {qcCase.methodology ? qcCase.methodology.replace(/_/g, ' ') : '—'}
              </p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Priority
              </p>
              <p className='text-sm text-gray-900 capitalize'>{qcCase.priority || '—'}</p>
            </div>

            <div className='p-4 rounded-xl bg-gray-50 border border-gray-200'>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-1'>
                Due Date
              </p>
              <p className='text-sm text-gray-900'>
                {qcCase.dueDate ? formatDate(qcCase.dueDate, 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className='card-enterprise'>
          <div className='flex items-center justify-between mb-5'>
            <div>
              <h2 className='text-lg font-semibold text-gray-900'>QC Checklist</h2>
              <p className='text-sm text-gray-500 mt-0.5'>
                Review each item and mark as Pass, Fail, or N/A. Failed items require a defect to be
                logged.
              </p>
            </div>

            <div className='flex items-center gap-3'>
              <div className='flex items-center gap-2'>
                <span className='text-xs text-gray-500'>
                  {Object.values(checklistState).filter((s) => s && s.response !== null).length}/
                  {checklistItems.length} reviewed
                </span>
                <div className='w-24 bg-gray-200 rounded-full h-2 overflow-hidden'>
                  <div
                    className='h-full rounded-full bg-enterprise-600 transition-all duration-300'
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {checklistItems.length === 0 ? (
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                  <line x1='16' y1='13' x2='8' y2='13' />
                  <line x1='16' y1='17' x2='8' y2='17' />
                  <polyline points='10 9 9 9 8 9' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Checklist Items</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                This QC case does not have any checklist items configured.
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {checklistItems.map((item, index) => {
                if (!item) return null;

                const itemState = checklistState[item.id] || {
                  response: null,
                  notes: '',
                  evidenceAttached: false,
                };

                const isDefectFormOpen = activeDefectForm === item.id;
                const isEvidencePanelOpen = activeEvidencePanel === item.id;
                const hasError = submitErrors.some((e) => e.itemId === item.id);

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-xl border transition-colors duration-200 ${
                      hasError
                        ? 'border-red-300 bg-red-50/30'
                        : itemState.response === 'fail'
                          ? 'border-red-200 bg-red-50/20'
                          : itemState.response === 'pass'
                            ? 'border-green-200 bg-green-50/20'
                            : itemState.response === 'na'
                              ? 'border-gray-200 bg-gray-50/50'
                              : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className='flex items-start gap-4'>
                      <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-bold'>
                        {index + 1}
                      </div>

                      <div className='flex-1 min-w-0'>
                        <div className='flex items-start justify-between gap-4'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 mb-1'>
                              <span className='inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-gray-100 text-gray-600'>
                                {item.category || 'Uncategorized'}
                              </span>
                            </div>
                            <p className='text-sm font-medium text-gray-900'>
                              {item.question || 'No question defined'}
                            </p>
                          </div>

                          <div className='flex items-center gap-1 flex-shrink-0'>
                            {CHECKLIST_RESPONSES.map((resp) => {
                              const isSelected = itemState.response === resp.value;
                              return (
                                <button
                                  key={resp.value}
                                  type='button'
                                  onClick={() => handleResponseChange(item.id, resp.value)}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 ${
                                    isSelected
                                      ? resp.color
                                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                  }`}
                                  aria-label={`Mark as ${resp.label}`}
                                  aria-pressed={isSelected}
                                >
                                  {resp.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {itemState.response && (
                          <div className='mt-3 space-y-3'>
                            <div>
                              <label
                                htmlFor={`checklist-notes-${item.id}`}
                                className='block text-xs font-medium text-gray-600 mb-1'
                              >
                                Notes
                              </label>
                              <textarea
                                id={`checklist-notes-${item.id}`}
                                value={itemState.notes}
                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                rows={2}
                                placeholder='Add review notes...'
                                className='input-enterprise py-1.5 text-sm resize-none'
                                aria-label={`Notes for checklist item ${index + 1}`}
                              />
                            </div>

                            <div className='flex items-center gap-3'>
                              <button
                                type='button'
                                onClick={() => handleSaveChecklistItem(item.id)}
                                className='btn-enterprise-secondary text-xs py-1 px-3'
                              >
                                <svg
                                  xmlns='http://www.w3.org/2000/svg'
                                  viewBox='0 0 24 24'
                                  fill='none'
                                  stroke='currentColor'
                                  strokeWidth={2}
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  className='w-3.5 h-3.5 mr-1.5'
                                >
                                  <polyline points='20 6 9 17 4 12' />
                                </svg>
                                Save Response
                              </button>

                              <button
                                type='button'
                                onClick={() =>
                                  setActiveEvidencePanel((prev) =>
                                    prev === item.id ? null : item.id,
                                  )
                                }
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-enterprise-500 ${
                                  isEvidencePanelOpen || itemState.evidenceAttached
                                    ? 'text-enterprise-700 bg-enterprise-50 border border-enterprise-200'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                              >
                                <svg
                                  xmlns='http://www.w3.org/2000/svg'
                                  viewBox='0 0 24 24'
                                  fill='none'
                                  stroke='currentColor'
                                  strokeWidth={2}
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  className='w-3.5 h-3.5'
                                >
                                  <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
                                  <polyline points='17 8 12 3 7 8' />
                                  <line x1='12' y1='3' x2='12' y2='15' />
                                </svg>
                                {itemState.evidenceAttached
                                  ? 'Evidence Attached'
                                  : 'Attach Evidence'}
                              </button>

                              {itemState.response === 'fail' && !isDefectFormOpen && (
                                <button
                                  type='button'
                                  onClick={() => setActiveDefectForm(item.id)}
                                  className='inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                                >
                                  <svg
                                    xmlns='http://www.w3.org/2000/svg'
                                    viewBox='0 0 24 24'
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth={2}
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    className='w-3.5 h-3.5'
                                  >
                                    <line x1='12' y1='5' x2='12' y2='19' />
                                    <line x1='5' y1='12' x2='19' y2='12' />
                                  </svg>
                                  Log Defect
                                </button>
                              )}
                            </div>

                            {isEvidencePanelOpen && (
                              <EvidenceAttachmentPanel
                                checklistItemId={item.id}
                                onAttach={handleEvidenceAttached}
                              />
                            )}

                            {isDefectFormOpen && (
                              <DefectForm
                                checklistItem={item}
                                qcCaseId={qcCase.id}
                                loanId={qcCase.loanId}
                                sellerId={loan ? loan.sellerId : ''}
                                taxonomy={taxonomy}
                                onSave={handleSaveDefect}
                                onCancel={() => setActiveDefectForm(null)}
                              />
                            )}
                          </div>
                        )}

                        {hasError && (
                          <div className='mt-3 p-3 rounded-lg bg-red-50 border border-red-200'>
                            <div className='flex items-start gap-2'>
                              <svg
                                xmlns='http://www.w3.org/2000/svg'
                                viewBox='0 0 24 24'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth={2}
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                className='w-4 h-4 text-red-500 flex-shrink-0 mt-0.5'
                              >
                                <circle cx='12' cy='12' r='10' />
                                <line x1='15' y1='9' x2='9' y2='15' />
                                <line x1='9' y1='9' x2='15' y2='15' />
                              </svg>
                              <p className='text-sm text-red-700'>
                                {submitErrors.find((e) => e.itemId === item.id)?.message ||
                                  'This item requires attention.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {submitErrors.length > 0 && (
            <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in'>
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
                    Cannot Submit Review
                  </p>
                  <p className='text-xs text-red-600 mt-1'>
                    {submitErrors.length === 1
                      ? '1 item requires attention before the review can be submitted.'
                      : `${submitErrors.length} items require attention before the review can be submitted.`}
                  </p>
                  <ul className='mt-2 space-y-1'>
                    {submitErrors.map((error, idx) => (
                      <li key={idx} className='text-xs text-red-600 flex items-start gap-1.5'>
                        <span className='flex-shrink-0 mt-0.5'>•</span>
                        <span>
                          <span className='font-medium'>{error.category}:</span> {error.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {checklistItems.length > 0 && (
            <div className='flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200'>
              <button
                type='button'
                onClick={handleGoBack}
                disabled={isSubmitting}
                className='btn-enterprise-secondary'
              >
                Save & Exit
              </button>

              <button
                type='button'
                onClick={handleSubmitReview}
                disabled={isSubmitting}
                className='btn-enterprise-primary'
              >
                {isSubmitting ? (
                  <>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='w-4 h-4 mr-2 animate-spin'
                    >
                      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='w-4 h-4 mr-2'
                    >
                      <polyline points='20 6 9 17 4 12' />
                    </svg>
                    Submit Review
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {createdDefects.length > 0 && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>
              Defects Logged ({createdDefects.length})
            </h2>

            <div className='space-y-3'>
              {createdDefects.map((defect, idx) => {
                if (!defect) return null;

                return (
                  <div
                    key={defect.id || idx}
                    className='flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200'
                  >
                    <div className='flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600'>
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
                        <circle cx='12' cy='12' r='10' />
                        <line x1='15' y1='9' x2='9' y2='15' />
                        <line x1='9' y1='9' x2='15' y2='15' />
                      </svg>
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='text-sm font-mono text-gray-600'>{defect.id}</span>
                        <span className='text-xs text-gray-400'>•</span>
                        <span className='text-xs font-medium text-gray-500'>
                          {defect.taxonomyCode}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-medium border ${
                            defect.severity === 'critical'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : defect.severity === 'major'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : defect.severity === 'minor'
                                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {defect.severity}
                        </span>
                      </div>
                      <p className='text-sm text-gray-700'>{defect.description}</p>
                      <div className='flex items-center gap-3 mt-1'>
                        <span className='text-xs text-gray-400'>
                          Category: {defect.category} / {defect.subcategory}
                        </span>
                        <span className='text-xs text-gray-400'>•</span>
                        <span className='text-xs text-gray-400'>
                          Root Cause: {defect.rootCause}
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
    </RequireRole>
  );
};

QCCaseReview.propTypes = {};

export default QCCaseReview;