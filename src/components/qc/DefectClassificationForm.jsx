import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDefects } from '../../contexts/DefectContext';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'DefectClassificationForm';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'observation', label: 'Observation' },
];

const ROOT_CAUSE_OPTIONS = [
  { value: '', label: 'Select root cause...' },
  { value: 'Seller Error', label: 'Seller Error' },
  { value: 'Process Gap', label: 'Process Gap' },
  { value: 'System Issue', label: 'System Issue' },
  { value: 'Third-Party Error', label: 'Third-Party Error' },
  { value: 'Borrower Misrepresentation', label: 'Borrower Misrepresentation' },
  { value: 'Underwriter Error', label: 'Underwriter Error' },
  { value: 'Documentation Deficiency', label: 'Documentation Deficiency' },
  { value: 'Training Gap', label: 'Training Gap' },
];

const SOURCE_OF_DEFECT_OPTIONS = [
  { value: 'pre_closing', label: 'Pre-Closing' },
  { value: 'post_closing', label: 'Post-Closing' },
  { value: 'servicing', label: 'Servicing' },
];

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-amber-100 text-amber-700 border-amber-200',
  minor: 'bg-blue-100 text-blue-700 border-blue-200',
  observation: 'bg-gray-100 text-gray-600 border-gray-200',
};

const DefectClassificationForm = ({
  qcCaseId,
  loanId,
  sellerId,
  checklistItemId,
  onSave,
  onCancel,
}) => {
  const { taxonomy } = useDefects();

  const [formData, setFormData] = useState({
    taxonomyCode: '',
    category: '',
    subcategory: '',
    severity: 'major',
    rootCause: '',
    sourceOfDefect: 'pre_closing',
    description: '',
    requiresRemedy: false,
    evidence: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingEvidence, setIsAddingEvidence] = useState(false);
  const [newEvidenceFileName, setNewEvidenceFileName] = useState('');
  const [newEvidenceFileType, setNewEvidenceFileType] = useState('image/png');

  const taxonomyCodeRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (taxonomyCodeRef.current) {
      taxonomyCodeRef.current.focus();
    }
  }, []);

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

  const groupedTaxonomy = useMemo(() => {
    if (!taxonomy || !Array.isArray(taxonomy.categories)) {
      return [];
    }

    return taxonomy.categories.map((category) => ({
      code: category.code,
      name: category.name,
      subcategories: category.subcategories.map((subcategory) => ({
        code: subcategory.code,
        name: subcategory.name,
        defectTypes: subcategory.defectTypes.map((defectType) => ({
          code: defectType.code,
          name: defectType.name,
          defaultSeverity: defectType.defaultSeverity,
          fullCode: `${category.code}.${subcategory.code}.${defectType.code}`,
        })),
      })),
    }));
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

  const handleAddEvidence = useCallback(() => {
    if (!newEvidenceFileName || newEvidenceFileName.trim() === '') {
      return;
    }

    const newAttachment = {
      id: `EVD-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      fileName: newEvidenceFileName.trim(),
      fileType: newEvidenceFileType,
      uploadDate: new Date().toISOString(),
      uploadedBy: 'QC Reviewer',
    };

    setFormData((prev) => ({
      ...prev,
      evidence: [...prev.evidence, newAttachment],
    }));

    setNewEvidenceFileName('');
    setIsAddingEvidence(false);

    debug(COMPONENT_NAME, 'Evidence attachment added', {
      attachmentId: newAttachment.id,
      fileName: newAttachment.fileName,
    });
  }, [newEvidenceFileName, newEvidenceFileType]);

  const handleRemoveEvidence = useCallback((attachmentId) => {
    setFormData((prev) => ({
      ...prev,
      evidence: prev.evidence.filter((a) => a.id !== attachmentId),
    }));
  }, []);

  const handleEvidenceKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddEvidence();
      }
    },
    [handleAddEvidence],
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
        evidence: formData.evidence,
        requiresRemedy: formData.requiresRemedy,
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

  const severityColor = SEVERITY_COLORS[formData.severity] || SEVERITY_COLORS.major;

  return (
    <div className='p-5 rounded-xl bg-red-50 border border-red-200 animate-fade-in'>
      <div className='flex items-center justify-between mb-5'>
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

      <div className='space-y-5'>
        <div>
          <label
            htmlFor='defect-taxonomy-code'
            className='block text-sm font-medium text-gray-700 mb-1.5'
          >
            Defect Code
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <select
            ref={taxonomyCodeRef}
            id='defect-taxonomy-code'
            value={formData.taxonomyCode}
            onChange={handleTaxonomyCodeChange}
            disabled={isSubmitting}
            className={`input-enterprise ${errors.taxonomyCode ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Defect taxonomy code'
            aria-describedby={errors.taxonomyCode ? 'defect-taxonomy-error' : undefined}
            aria-invalid={errors.taxonomyCode ? 'true' : 'false'}
          >
            <option value=''>Select defect type...</option>
            {groupedTaxonomy.map((category) => (
              <optgroup key={category.code} label={category.name}>
                {category.subcategories.map((subcategory) =>
                  subcategory.defectTypes.map((defectType) => (
                    <option key={defectType.fullCode} value={defectType.fullCode}>
                      {defectType.fullCode} — {defectType.name}
                    </option>
                  )),
                )}
              </optgroup>
            ))}
          </select>
          {errors.taxonomyCode && (
            <p
              id='defect-taxonomy-error'
              className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3.5 h-3.5 flex-shrink-0'
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
          <div className='grid grid-cols-2 gap-3 p-4 rounded-xl bg-white border border-gray-200'>
            <div>
              <span className='text-xs text-gray-400 block mb-0.5'>Category</span>
              <span className='text-sm font-medium text-gray-700'>
                {formData.category || '—'}
              </span>
            </div>
            <div>
              <span className='text-xs text-gray-400 block mb-0.5'>Subcategory</span>
              <span className='text-sm font-medium text-gray-700'>
                {formData.subcategory || '—'}
              </span>
            </div>
          </div>
        )}

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div>
            <label
              htmlFor='defect-severity'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Severity
              <span className='text-red-500 ml-0.5'>*</span>
            </label>
            <select
              id='defect-severity'
              value={formData.severity}
              onChange={(e) => handleFieldChange('severity', e.target.value)}
              disabled={isSubmitting}
              className='input-enterprise'
              aria-label='Defect severity'
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor='defect-source'
              className='block text-sm font-medium text-gray-700 mb-1.5'
            >
              Source of Defect
            </label>
            <select
              id='defect-source'
              value={formData.sourceOfDefect}
              onChange={(e) => handleFieldChange('sourceOfDefect', e.target.value)}
              disabled={isSubmitting}
              className='input-enterprise'
              aria-label='Source of defect'
            >
              {SOURCE_OF_DEFECT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor='defect-root-cause'
            className='block text-sm font-medium text-gray-700 mb-1.5'
          >
            Root Cause
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <select
            id='defect-root-cause'
            value={formData.rootCause}
            onChange={(e) => handleFieldChange('rootCause', e.target.value)}
            disabled={isSubmitting}
            className={`input-enterprise ${errors.rootCause ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Root cause'
            aria-describedby={errors.rootCause ? 'defect-root-cause-error' : undefined}
            aria-invalid={errors.rootCause ? 'true' : 'false'}
          >
            {ROOT_CAUSE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.rootCause && (
            <p
              id='defect-root-cause-error'
              className='text-xs text-red-600 mt-1.5 flex items-center gap-1'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-3.5 h-3.5 flex-shrink-0'
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
            className='block text-sm font-medium text-gray-700 mb-1.5'
          >
            Description
            <span className='text-red-500 ml-0.5'>*</span>
          </label>
          <textarea
            id='defect-description'
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            disabled={isSubmitting}
            rows={4}
            placeholder='Describe the defect in detail, including what was found and why it is a defect...'
            className={`input-enterprise resize-none ${errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            aria-label='Defect description'
            aria-describedby={errors.description ? 'defect-description-error' : undefined}
            aria-invalid={errors.description ? 'true' : 'false'}
            maxLength={2000}
          />
          <div className='flex items-center justify-between mt-1.5'>
            {errors.description ? (
              <p
                id='defect-description-error'
                className='text-xs text-red-600 flex items-center gap-1'
              >
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-3.5 h-3.5 flex-shrink-0'
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
            <span className='text-xs text-gray-400'>{formData.description.length}/2000</span>
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={formData.requiresRemedy}
              onChange={(e) => handleFieldChange('requiresRemedy', e.target.checked)}
              disabled={isSubmitting}
              className='w-4 h-4 rounded border-gray-300 text-enterprise-600 focus:ring-enterprise-500'
            />
            <span className='text-sm text-gray-700'>Requires Remedy Action</span>
          </label>
        </div>

        {formData.requiresRemedy && (
          <div className='p-4 rounded-xl bg-amber-50 border border-amber-200'>
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
                  Remedy Case Will Be Auto-Generated
                </p>
                <p className='text-xs text-amber-700 mt-1'>
                  A remedy case will be automatically created for this defect upon submission.
                  The remedy case will be linked to this defect and assigned based on severity.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <div className='flex items-center justify-between mb-2'>
            <label className='block text-sm font-medium text-gray-700'>
              Evidence Attachments
            </label>
            {!isAddingEvidence && (
              <button
                type='button'
                onClick={() => setIsAddingEvidence(true)}
                disabled={isSubmitting}
                className='inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-enterprise-600 hover:text-enterprise-700 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
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

          {isAddingEvidence && (
            <div className='mb-3 p-4 rounded-xl bg-white border border-gray-200'>
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
                    value={newEvidenceFileName}
                    onChange={(e) => setNewEvidenceFileName(e.target.value)}
                    onKeyDown={handleEvidenceKeyDown}
                    placeholder='e.g., defect_screenshot.png'
                    disabled={isSubmitting}
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
                    value={newEvidenceFileType}
                    onChange={(e) => setNewEvidenceFileType(e.target.value)}
                    disabled={isSubmitting}
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
                    setIsAddingEvidence(false);
                    setNewEvidenceFileName('');
                  }}
                  disabled={isSubmitting}
                  className='btn-enterprise-secondary text-xs py-1 px-3'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={handleAddEvidence}
                  disabled={!newEvidenceFileName || newEvidenceFileName.trim() === '' || isSubmitting}
                  className='btn-enterprise-primary text-xs py-1 px-3'
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {formData.evidence.length === 0 && !isAddingEvidence && (
            <p className='text-xs text-gray-400 italic'>No evidence attached.</p>
          )}

          {formData.evidence.length > 0 && (
            <div className='space-y-2'>
              {formData.evidence.map((attachment) => (
                <div
                  key={attachment.id}
                  className='flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200'
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
                      {formatFileSize(attachment.fileType)}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => handleRemoveEvidence(attachment.id)}
                    disabled={isSubmitting}
                    className='flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
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

        {formData.taxonomyCode && formData.severity && (
          <div className='p-4 rounded-xl bg-white border border-gray-200'>
            <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-3'>
              Defect Summary
            </span>
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Defect Code</span>
                <span className='font-mono text-gray-700'>{formData.taxonomyCode}</span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Severity</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
                >
                  {SEVERITY_OPTIONS.find((s) => s.value === formData.severity)?.label || formData.severity}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Category</span>
                <span className='text-gray-700'>{formData.category || '—'}</span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Subcategory</span>
                <span className='text-gray-700'>{formData.subcategory || '—'}</span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Root Cause</span>
                <span className='text-gray-700'>{formData.rootCause || '—'}</span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Source</span>
                <span className='text-gray-700'>
                  {SOURCE_OF_DEFECT_OPTIONS.find((s) => s.value === formData.sourceOfDefect)?.label || formData.sourceOfDefect}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Remedy Required</span>
                <span className='text-gray-700'>
                  {formData.requiresRemedy ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className='text-xs text-gray-400 block mb-0.5'>Evidence</span>
                <span className='text-gray-700'>
                  {formData.evidence.length === 0
                    ? 'None'
                    : `${formData.evidence.length} attachment(s)`}
                </span>
              </div>
            </div>
          </div>
        )}

        {errors.submit && (
          <div className='p-3 bg-red-100 border border-red-200 rounded-lg animate-fade-in'>
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
      </div>

      <div className='flex items-center justify-end gap-3 mt-6 pt-4 border-t border-red-200'>
        <button
          type='button'
          onClick={onCancel}
          disabled={isSubmitting}
          className='btn-enterprise-secondary'
        >
          Cancel
        </button>

        <button
          type='button'
          onClick={handleSubmit}
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
                className='w-4 h-4 mr-2'
              >
                <polyline points='20 6 9 17 4 12' />
              </svg>
              Save Defect
            </>
          )}
        </button>
      </div>
    </div>
  );
};

DefectClassificationForm.propTypes = {
  qcCaseId: PropTypes.string.isRequired,
  loanId: PropTypes.string.isRequired,
  sellerId: PropTypes.string.isRequired,
  checklistItemId: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

DefectClassificationForm.defaultProps = {
  checklistItemId: null,
};

export default DefectClassificationForm;