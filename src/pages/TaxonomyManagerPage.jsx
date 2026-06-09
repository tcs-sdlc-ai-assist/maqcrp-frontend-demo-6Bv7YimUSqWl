import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useDefects } from '../contexts/DefectContext';
import { useAuth } from '../contexts/AuthContext';
import { useAudit } from '../contexts/AuditContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePagination } from '../hooks/usePagination';
import { formatDate } from '../utils/dateUtils';
import { debug, info, warn } from '../utils/logger';
import RequireRole from '../components/shared/RequireRole';
import BreadcrumbTrail from '../components/shared/BreadcrumbTrail';
import Pagination from '../components/shared/Pagination';

const COMPONENT_NAME = 'TaxonomyManagerPage';

const ALLOWED_ROLES = ['admin'];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'observation', label: 'Observation' },
];

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  major: 'bg-amber-100 text-amber-700 border-amber-200',
  minor: 'bg-blue-100 text-blue-700 border-blue-200',
  observation: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_LABELS = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  observation: 'Observation',
};

const CategoryFormModal = ({ category, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    subcategories: [],
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const codeInputRef = useRef(null);
  const isMountedRef = useRef(true);

  const isEditing = category && category.code;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && category) {
        setFormData({
          code: category.code || '',
          name: category.name || '',
          subcategories: Array.isArray(category.subcategories)
            ? category.subcategories.map((sc) => ({
                code: sc.code || '',
                name: sc.name || '',
                defectTypes: Array.isArray(sc.defectTypes)
                  ? sc.defectTypes.map((dt) => ({
                      code: dt.code || '',
                      name: dt.name || '',
                      defaultSeverity: dt.defaultSeverity || 'major',
                    }))
                  : [],
              }))
            : [],
        });
      } else {
        setFormData({
          code: '',
          name: '',
          subcategories: [],
        });
      }

      setErrors({});
      setIsSubmitting(false);

      setTimeout(() => {
        if (codeInputRef.current) {
          codeInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, isEditing, category]);

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

  const handleSubcategoryChange = useCallback((index, field, value) => {
    setFormData((prev) => {
      const subcategories = [...prev.subcategories];
      subcategories[index] = { ...subcategories[index], [field]: value };
      return { ...prev, subcategories };
    });

    const errorKey = `subcategories[${index}].${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }, [errors]);

  const handleDefectTypeChange = useCallback((subIndex, defectIndex, field, value) => {
    setFormData((prev) => {
      const subcategories = [...prev.subcategories];
      const defectTypes = [...subcategories[subIndex].defectTypes];
      defectTypes[defectIndex] = { ...defectTypes[defectIndex], [field]: value };
      subcategories[subIndex] = { ...subcategories[subIndex], defectTypes };
      return { ...prev, subcategories };
    });

    const errorKey = `subcategories[${subIndex}].defectTypes[${defectIndex}].${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }, [errors]);

  const handleAddSubcategory = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      subcategories: [...prev.subcategories, { code: '', name: '', defectTypes: [] }],
    }));
  }, []);

  const handleRemoveSubcategory = useCallback((index) => {
    setFormData((prev) => {
      const subcategories = prev.subcategories.filter((_, i) => i !== index);
      return { ...prev, subcategories };
    });
  }, []);

  const handleAddDefectType = useCallback((subIndex) => {
    setFormData((prev) => {
      const subcategories = [...prev.subcategories];
      subcategories[subIndex] = {
        ...subcategories[subIndex],
        defectTypes: [
          ...subcategories[subIndex].defectTypes,
          { code: '', name: '', defaultSeverity: 'major' },
        ],
      };
      return { ...prev, subcategories };
    });
  }, []);

  const handleRemoveDefectType = useCallback((subIndex, defectIndex) => {
    setFormData((prev) => {
      const subcategories = [...prev.subcategories];
      subcategories[subIndex] = {
        ...subcategories[subIndex],
        defectTypes: subcategories[subIndex].defectTypes.filter((_, i) => i !== defectIndex),
      };
      return { ...prev, subcategories };
    });
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.code || formData.code.trim() === '') {
      newErrors.code = 'Category code is required.';
    } else if (formData.code.trim().length > 10) {
      newErrors.code = 'Category code must be 10 characters or fewer.';
    }

    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Category name is required.';
    }

    for (let i = 0; i < formData.subcategories.length; i++) {
      const sc = formData.subcategories[i];
      if (!sc.code || sc.code.trim() === '') {
        newErrors[`subcategories[${i}].code`] = 'Subcategory code is required.';
      }
      if (!sc.name || sc.name.trim() === '') {
        newErrors[`subcategories[${i}].name`] = 'Subcategory name is required.';
      }

      for (let j = 0; j < sc.defectTypes.length; j++) {
        const dt = sc.defectTypes[j];
        if (!dt.code || dt.code.trim() === '') {
          newErrors[`subcategories[${i}].defectTypes[${j}].code`] = 'Defect type code is required.';
        }
        if (!dt.name || dt.name.trim() === '') {
          newErrors[`subcategories[${i}].defectTypes[${j}].name`] = 'Defect type name is required.';
        }
      }
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
      const categoryData = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        subcategories: formData.subcategories.map((sc) => ({
          code: sc.code.trim(),
          name: sc.name.trim(),
          defectTypes: sc.defectTypes.map((dt) => ({
            code: dt.code.trim(),
            name: dt.name.trim(),
            defaultSeverity: dt.defaultSeverity,
          })),
        })),
      };

      if (isMountedRef.current) {
        onSave(categoryData);
      }
    } catch (err) {
      warn(COMPONENT_NAME, 'Category form submission threw an error', err);
      if (isMountedRef.current) {
        setErrors({ submit: 'An unexpected error occurred. Please try again.' });
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, validate, formData, onSave]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
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

  return (
    <div
      className='fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto'
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-labelledby='category-form-modal-title'
      aria-describedby='category-form-modal-description'
    >
      <div className='w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 my-8 animate-scale-in'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10'>
          <div>
            <h2 id='category-form-modal-title' className='text-lg font-semibold text-gray-900'>
              {isEditing ? 'Edit Category' : 'Add Category'}
            </h2>
            <p id='category-form-modal-description' className='text-sm text-gray-500 mt-0.5'>
              {isEditing
                ? 'Update the defect taxonomy category and its subcategories.'
                : 'Define a new defect taxonomy category with subcategories and defect types.'}
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            disabled={isSubmitting}
            className='p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Close category form'
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

        <div className='px-6 py-5 space-y-5'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='category-form-code'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Category Code
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                ref={codeInputRef}
                id='category-form-code'
                type='text'
                value={formData.code}
                onChange={(e) => handleFieldChange('code', e.target.value)}
                disabled={isSubmitting || isEditing}
                placeholder='e.g., DOC'
                className={`input-enterprise ${errors.code ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Category code'
                aria-describedby={errors.code ? 'category-form-code-error' : undefined}
                aria-invalid={errors.code ? 'true' : 'false'}
              />
              {errors.code && (
                <p id='category-form-code-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                  {errors.code}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor='category-form-name'
                className='block text-sm font-medium text-gray-700 mb-1.5'
              >
                Category Name
                <span className='text-red-500 ml-0.5'>*</span>
              </label>
              <input
                id='category-form-name'
                type='text'
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={isSubmitting}
                placeholder='e.g., Documentation'
                className={`input-enterprise ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                aria-label='Category name'
                aria-describedby={errors.name ? 'category-form-name-error' : undefined}
                aria-invalid={errors.name ? 'true' : 'false'}
              />
              {errors.name && (
                <p id='category-form-name-error' className='text-xs text-red-600 mt-1.5 flex items-center gap-1'>
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
                  {errors.name}
                </p>
              )}
            </div>
          </div>

          <div>
            <div className='flex items-center justify-between mb-3'>
              <label className='block text-sm font-medium text-gray-700'>
                Subcategories
              </label>
              <button
                type='button'
                onClick={handleAddSubcategory}
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
                Add Subcategory
              </button>
            </div>

            {formData.subcategories.length === 0 && (
              <div className='p-6 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center'>
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
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                  <polyline points='14 2 14 8 20 8' />
                </svg>
                <p className='text-sm text-gray-500'>
                  No subcategories defined. Click &ldquo;Add Subcategory&rdquo; to create one.
                </p>
              </div>
            )}

            <div className='space-y-4'>
              {formData.subcategories.map((subcategory, subIndex) => (
                <div
                  key={subIndex}
                  className='p-4 rounded-xl bg-gray-50 border border-gray-200'
                >
                  <div className='flex items-center justify-between mb-3'>
                    <span className='text-xs font-semibold text-gray-500 uppercase tracking-wider'>
                      Subcategory {subIndex + 1}
                    </span>
                    <button
                      type='button'
                      onClick={() => handleRemoveSubcategory(subIndex)}
                      disabled={isSubmitting}
                      className='p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                      aria-label={`Remove subcategory ${subIndex + 1}`}
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

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4'>
                    <div>
                      <label
                        htmlFor={`subcategory-code-${subIndex}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Code
                        <span className='text-red-500 ml-0.5'>*</span>
                      </label>
                      <input
                        id={`subcategory-code-${subIndex}`}
                        type='text'
                        value={subcategory.code}
                        onChange={(e) => handleSubcategoryChange(subIndex, 'code', e.target.value)}
                        disabled={isSubmitting}
                        placeholder='e.g., INC'
                        className={`input-enterprise py-1.5 text-sm ${errors[`subcategories[${subIndex}].code`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        aria-label={`Subcategory ${subIndex + 1} code`}
                      />
                      {errors[`subcategories[${subIndex}].code`] && (
                        <p className='text-xs text-red-600 mt-1'>
                          {errors[`subcategories[${subIndex}].code`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`subcategory-name-${subIndex}`}
                        className='block text-xs font-medium text-gray-600 mb-1'
                      >
                        Name
                        <span className='text-red-500 ml-0.5'>*</span>
                      </label>
                      <input
                        id={`subcategory-name-${subIndex}`}
                        type='text'
                        value={subcategory.name}
                        onChange={(e) => handleSubcategoryChange(subIndex, 'name', e.target.value)}
                        disabled={isSubmitting}
                        placeholder='e.g., Income Verification'
                        className={`input-enterprise py-1.5 text-sm ${errors[`subcategories[${subIndex}].name`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        aria-label={`Subcategory ${subIndex + 1} name`}
                      />
                      {errors[`subcategories[${subIndex}].name`] && (
                        <p className='text-xs text-red-600 mt-1'>
                          {errors[`subcategories[${subIndex}].name`]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-xs font-medium text-gray-600'>
                        Defect Types
                      </span>
                      <button
                        type='button'
                        onClick={() => handleAddDefectType(subIndex)}
                        disabled={isSubmitting}
                        className='inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium text-enterprise-600 hover:text-enterprise-700 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          viewBox='0 0 24 24'
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={2}
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          className='w-3 h-3'
                        >
                          <line x1='12' y1='5' x2='12' y2='19' />
                          <line x1='5' y1='12' x2='19' y2='12' />
                        </svg>
                        Add Defect Type
                      </button>
                    </div>

                    {subcategory.defectTypes.length === 0 && (
                      <p className='text-xs text-gray-400 italic py-2'>
                        No defect types defined for this subcategory.
                      </p>
                    )}

                    <div className='space-y-2'>
                      {subcategory.defectTypes.map((defectType, defectIndex) => (
                        <div
                          key={defectIndex}
                          className='flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200'
                        >
                          <div className='flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2'>
                            <div>
                              <label
                                htmlFor={`defect-type-code-${subIndex}-${defectIndex}`}
                                className='block text-2xs font-medium text-gray-500 mb-0.5'
                              >
                                Code
                              </label>
                              <input
                                id={`defect-type-code-${subIndex}-${defectIndex}`}
                                type='text'
                                value={defectType.code}
                                onChange={(e) =>
                                  handleDefectTypeChange(subIndex, defectIndex, 'code', e.target.value)
                                }
                                disabled={isSubmitting}
                                placeholder='e.g., 001'
                                className={`input-enterprise py-1 text-xs ${errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].code`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                                aria-label={`Defect type ${defectIndex + 1} code`}
                              />
                              {errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].code`] && (
                                <p className='text-2xs text-red-600 mt-0.5'>
                                  {errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].code`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label
                                htmlFor={`defect-type-name-${subIndex}-${defectIndex}`}
                                className='block text-2xs font-medium text-gray-500 mb-0.5'
                              >
                                Name
                              </label>
                              <input
                                id={`defect-type-name-${subIndex}-${defectIndex}`}
                                type='text'
                                value={defectType.name}
                                onChange={(e) =>
                                  handleDefectTypeChange(subIndex, defectIndex, 'name', e.target.value)
                                }
                                disabled={isSubmitting}
                                placeholder='e.g., Missing Pay Stub'
                                className={`input-enterprise py-1 text-xs ${errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].name`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                                aria-label={`Defect type ${defectIndex + 1} name`}
                              />
                              {errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].name`] && (
                                <p className='text-2xs text-red-600 mt-0.5'>
                                  {errors[`subcategories[${subIndex}].defectTypes[${defectIndex}].name`]}
                                </p>
                              )}
                            </div>

                            <div>
                              <label
                                htmlFor={`defect-type-severity-${subIndex}-${defectIndex}`}
                                className='block text-2xs font-medium text-gray-500 mb-0.5'
                              >
                                Default Severity
                              </label>
                              <select
                                id={`defect-type-severity-${subIndex}-${defectIndex}`}
                                value={defectType.defaultSeverity}
                                onChange={(e) =>
                                  handleDefectTypeChange(
                                    subIndex,
                                    defectIndex,
                                    'defaultSeverity',
                                    e.target.value,
                                  )
                                }
                                disabled={isSubmitting}
                                className='input-enterprise py-1 text-xs'
                                aria-label={`Defect type ${defectIndex + 1} default severity`}
                              >
                                {SEVERITY_OPTIONS.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <button
                            type='button'
                            onClick={() => handleRemoveDefectType(subIndex, defectIndex)}
                            disabled={isSubmitting}
                            className='flex-shrink-0 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
                            aria-label={`Remove defect type ${defectIndex + 1}`}
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
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errors.submit && (
            <div className='p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in'>
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

        <div className='flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl'>
          <button
            type='button'
            onClick={onClose}
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
                {isEditing ? 'Save Changes' : 'Add Category'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

CategoryFormModal.propTypes = {
  category: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

CategoryFormModal.defaultProps = {
  category: null,
};

const TaxonomyManagerPage = () => {
  const navigate = useNavigate();
  const { taxonomy, updateTaxonomy } = useDefects();
  const { currentPersona } = useAuth();
  const { logEvent } = useAudit();
  const { addNotification } = useNotifications();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState(new Set());

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeTaxonomy = useMemo(() => {
    if (!taxonomy || !Array.isArray(taxonomy.categories)) {
      return { version: 0, categories: [] };
    }
    return taxonomy;
  }, [taxonomy]);

  const flatDefectTypes = useMemo(() => {
    const flat = [];

    for (const category of safeTaxonomy.categories) {
      for (const subcategory of category.subcategories) {
        for (const defectType of subcategory.defectTypes) {
          flat.push({
            taxonomyCode: `${category.code}.${subcategory.code}.${defectType.code}`,
            categoryCode: category.code,
            categoryName: category.name,
            subcategoryCode: subcategory.code,
            subcategoryName: subcategory.name,
            defectCode: defectType.code,
            defectName: defectType.name,
            defaultSeverity: defectType.defaultSeverity,
          });
        }
      }
    }

    return flat;
  }, [safeTaxonomy]);

  const {
    currentPage,
    paginatedData,
    totalPages,
    pageControls,
    setPage,
    setPageSize,
    pageSize,
  } = usePagination(flatDefectTypes, { initialPageSize: 25 });

  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setIsFormOpen(true);
  }, []);

  const handleEditCategory = useCallback((category) => {
    if (!category) return;
    setEditingCategory(category);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingCategory(null);
  }, []);

  const handleSaveCategory = useCallback(
    (categoryData) => {
      if (!categoryData || typeof categoryData !== 'object') {
        return;
      }

      try {
        const currentCategories = Array.isArray(safeTaxonomy.categories)
          ? [...safeTaxonomy.categories]
          : [];

        let updatedCategories;

        if (editingCategory && editingCategory.code) {
          updatedCategories = currentCategories.map((cat) => {
            if (cat.code === editingCategory.code) {
              return {
                ...cat,
                name: categoryData.name,
                subcategories: categoryData.subcategories,
              };
            }
            return cat;
          });
        } else {
          const existingIndex = currentCategories.findIndex(
            (cat) => cat.code === categoryData.code,
          );

          if (existingIndex !== -1) {
            updatedCategories = [...currentCategories];
            updatedCategories[existingIndex] = {
              ...updatedCategories[existingIndex],
              name: categoryData.name,
              subcategories: categoryData.subcategories,
            };
          } else {
            updatedCategories = [
              ...currentCategories,
              {
                code: categoryData.code,
                name: categoryData.name,
                subcategories: categoryData.subcategories,
              },
            ];
          }
        }

        const updatedTaxonomy = {
          ...safeTaxonomy,
          categories: updatedCategories,
        };

        const result = updateTaxonomy(updatedTaxonomy);

        if (result.success) {
          logEvent(
            'TAXONOMY_UPDATE',
            'taxonomy',
            'defect-taxonomy',
            {
              action: editingCategory ? 'category_updated' : 'category_added',
              categoryCode: categoryData.code,
              categoryName: categoryData.name,
              subcategoryCount: categoryData.subcategories.length,
              version: result.taxonomy.version,
            },
            currentPersona?.label || 'Unknown',
          );

          addNotification(
            'success',
            editingCategory ? 'Category Updated' : 'Category Added',
            `Defect taxonomy category "${categoryData.name}" has been ${editingCategory ? 'updated' : 'added'} successfully.`,
          );

          handleCloseForm();
        } else {
          addNotification(
            'error',
            'Save Failed',
            result.errors && result.errors.length > 0
              ? result.errors[0].message
              : 'Failed to save taxonomy category. Please try again.',
          );
        }
      } catch (err) {
        warn(COMPONENT_NAME, 'Failed to save taxonomy category', err);
        addNotification(
          'error',
          'Error',
          'An unexpected error occurred while saving the taxonomy category.',
        );
      }
    },
    [safeTaxonomy, editingCategory, updateTaxonomy, logEvent, addNotification, currentPersona, handleCloseForm],
  );

  const handleDeleteCategory = useCallback(
    (category) => {
      if (!category || !category.code) return;

      const currentCategories = Array.isArray(safeTaxonomy.categories)
        ? [...safeTaxonomy.categories]
        : [];

      const updatedCategories = currentCategories.filter(
        (cat) => cat.code !== category.code,
      );

      const updatedTaxonomy = {
        ...safeTaxonomy,
        categories: updatedCategories,
      };

      const result = updateTaxonomy(updatedTaxonomy);

      if (result.success) {
        logEvent(
          'TAXONOMY_UPDATE',
          'taxonomy',
          'defect-taxonomy',
          {
            action: 'category_deleted',
            categoryCode: category.code,
            categoryName: category.name,
            version: result.taxonomy.version,
          },
          currentPersona?.label || 'Unknown',
        );

        addNotification(
          'success',
          'Category Deleted',
          `Defect taxonomy category "${category.name}" has been deleted.`,
        );
      } else {
        addNotification(
          'error',
          'Delete Failed',
          'Failed to delete taxonomy category. Please try again.',
        );
      }
    },
    [safeTaxonomy, updateTaxonomy, logEvent, addNotification, currentPersona],
  );

  const handleToggleCategory = useCallback((categoryCode) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryCode)) {
        next.delete(categoryCode);
      } else {
        next.add(categoryCode);
      }
      return next;
    });
  }, []);

  const handleToggleSubcategory = useCallback((subcategoryKey) => {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryKey)) {
        next.delete(subcategoryKey);
      } else {
        next.add(subcategoryKey);
      }
      return next;
    });
  }, []);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Defect Taxonomy', path: '/taxonomy' },
  ];

  const totalDefectTypes = flatDefectTypes.length;
  const totalCategories = safeTaxonomy.categories.length;
  const totalSubcategories = safeTaxonomy.categories.reduce(
    (sum, cat) => sum + (Array.isArray(cat.subcategories) ? cat.subcategories.length : 0),
    0,
  );

  return (
    <RequireRole allowedRoles={ALLOWED_ROLES}>
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <BreadcrumbTrail items={breadcrumbItems} className='mb-2' />
            <h1 className='text-2xl font-bold text-gray-900'>Defect Taxonomy</h1>
            <p className='text-sm text-gray-500 mt-1'>
              Manage defect categories, subcategories, and defect type codes used for QC
              classification.
            </p>
          </div>

          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={handleCreateCategory}
              className='btn-enterprise-primary'
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
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              Add Category
            </button>
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Categories
              </p>
              <p className='text-2xl font-bold text-gray-900'>{totalCategories}</p>
            </div>
          </div>

          <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                <polyline points='14 2 14 8 20 8' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Subcategories
              </p>
              <p className='text-2xl font-bold text-gray-900'>{totalSubcategories}</p>
            </div>
          </div>

          <div className='flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50'>
            <div className='flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
                className='w-5 h-5'
              >
                <line x1='8' y1='6' x2='21' y2='6' />
                <line x1='8' y1='12' x2='21' y2='12' />
                <line x1='8' y1='18' x2='21' y2='18' />
                <line x1='3' y1='6' x2='3.01' y2='6' />
                <line x1='3' y1='12' x2='3.01' y2='12' />
                <line x1='3' y1='18' x2='3.01' y2='18' />
              </svg>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 uppercase tracking-wider'>
                Defect Types
              </p>
              <p className='text-2xl font-bold text-gray-900'>{totalDefectTypes}</p>
            </div>
          </div>
        </div>

        <div className='card-enterprise'>
          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm text-gray-500'>
              {safeTaxonomy.categories.length === 0
                ? 'No taxonomy categories defined'
                : `${safeTaxonomy.categories.length} categor${safeTaxonomy.categories.length === 1 ? 'y' : 'ies'} defined`}
            </p>
            {safeTaxonomy.version > 0 && (
              <span className='text-xs text-gray-400'>
                Taxonomy Version {safeTaxonomy.version}
              </span>
            )}
          </div>

          {safeTaxonomy.categories.length === 0 ? (
            <div className='text-center py-16'>
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
                  <path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' />
                </svg>
              </div>
              <h3 className='text-lg font-semibold text-gray-900 mb-1'>No Taxonomy Defined</h3>
              <p className='text-sm text-gray-500 max-w-md mx-auto'>
                No defect taxonomy categories have been defined yet. Click &ldquo;Add Category&rdquo; to
                create the first category.
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {safeTaxonomy.categories.map((category) => {
                if (!category) return null;

                const isExpanded = expandedCategories.has(category.code);
                const subcategoryCount = Array.isArray(category.subcategories)
                  ? category.subcategories.length
                  : 0;
                const defectTypeCount = Array.isArray(category.subcategories)
                  ? category.subcategories.reduce(
                      (sum, sc) =>
                        sum + (Array.isArray(sc.defectTypes) ? sc.defectTypes.length : 0),
                      0,
                    )
                  : 0;

                return (
                  <div
                    key={category.code}
                    className='rounded-xl border border-gray-200 overflow-hidden'
                  >
                    <div className='flex items-center justify-between px-5 py-4 bg-gray-50/50'>
                      <div className='flex items-center gap-4 flex-1 min-w-0'>
                        <button
                          type='button'
                          onClick={() => handleToggleCategory(category.code)}
                          className='flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
                          aria-expanded={isExpanded}
                        >
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth={2}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          >
                            <polyline points='9 18 15 12 9 6' />
                          </svg>
                        </button>

                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-enterprise-100 text-enterprise-700 font-mono'>
                              {category.code}
                            </span>
                            <h3 className='text-sm font-semibold text-gray-900 truncate'>
                              {category.name || 'Unnamed Category'}
                            </h3>
                          </div>
                          <div className='flex items-center gap-3 mt-1'>
                            <span className='text-xs text-gray-500'>
                              {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'}
                            </span>
                            <span className='text-xs text-gray-400'>•</span>
                            <span className='text-xs text-gray-500'>
                              {defectTypeCount} defect type{defectTypeCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center gap-2 flex-shrink-0'>
                        <button
                          type='button'
                          onClick={() => handleEditCategory(category)}
                          className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-enterprise-600 hover:bg-enterprise-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={`Edit category ${category.name}`}
                          title='Edit category'
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
                            <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                            <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                          </svg>
                        </button>

                        <button
                          type='button'
                          onClick={() => handleDeleteCategory(category)}
                          className='inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-enterprise-500 transition-colors duration-150'
                          aria-label={`Delete category ${category.name}`}
                          title='Delete category'
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
                            <polyline points='3 6 5 6 21 6' />
                            <path d='M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className='px-5 py-4 border-t border-gray-100 bg-white animate-fade-in'>
                        {Array.isArray(category.subcategories) && category.subcategories.length > 0 ? (
                          <div className='space-y-3'>
                            {category.subcategories.map((subcategory) => {
                              if (!subcategory) return null;

                              const subcategoryKey = `${category.code}.${subcategory.code}`;
                              const isSubExpanded = expandedSubcategories.has(subcategoryKey);
                              const defectTypeCount = Array.isArray(subcategory.defectTypes)
                                ? subcategory.defectTypes.length
                                : 0;

                              return (
                                <div
                                  key={subcategoryKey}
                                  className='rounded-lg border border-gray-200 overflow-hidden'
                                >
                                  <button
                                    type='button'
                                    onClick={() => handleToggleSubcategory(subcategoryKey)}
                                    className='w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-inset transition-colors duration-150'
                                    aria-expanded={isSubExpanded}
                                    aria-label={`${isSubExpanded ? 'Collapse' : 'Expand'} subcategory ${subcategory.name}`}
                                  >
                                    <div className='flex items-center gap-3'>
                                      <svg
                                        xmlns='http://www.w3.org/2000/svg'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth={2}
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                                          isSubExpanded ? 'rotate-90' : ''
                                        }`}
                                      >
                                        <polyline points='9 18 15 12 9 6' />
                                      </svg>

                                      <span className='inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-bold bg-gray-100 text-gray-600 font-mono'>
                                        {subcategory.code}
                                      </span>
                                      <span className='text-sm font-medium text-gray-700'>
                                        {subcategory.name || 'Unnamed Subcategory'}
                                      </span>
                                    </div>

                                    <span className='text-xs text-gray-400'>
                                      {defectTypeCount} defect type{defectTypeCount === 1 ? '' : 's'}
                                    </span>
                                  </button>

                                  {isSubExpanded && (
                                    <div className='px-4 py-3 bg-white animate-fade-in'>
                                      {Array.isArray(subcategory.defectTypes) &&
                                      subcategory.defectTypes.length > 0 ? (
                                        <div className='space-y-2'>
                                          {subcategory.defectTypes.map((defectType) => {
                                            if (!defectType) return null;

                                            const severityColor =
                                              SEVERITY_COLORS[defectType.defaultSeverity] ||
                                              SEVERITY_COLORS.major;
                                            const severityLabel =
                                              SEVERITY_LABELS[defectType.defaultSeverity] ||
                                              defectType.defaultSeverity ||
                                              'Unknown';
                                            const fullCode = `${category.code}.${subcategory.code}.${defectType.code}`;

                                            return (
                                              <div
                                                key={fullCode}
                                                className='flex items-center gap-3 p-2 rounded-lg bg-gray-50 text-sm'
                                              >
                                                <span className='font-mono text-xs text-gray-500 flex-shrink-0'>
                                                  {fullCode}
                                                </span>
                                                <span className='flex-1 text-gray-700'>
                                                  {defectType.name || 'Unnamed Defect Type'}
                                                </span>
                                                <span
                                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium border ${severityColor}`}
                                                >
                                                  {severityLabel}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className='text-xs text-gray-400 italic py-2'>
                                          No defect types defined for this subcategory.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
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
                              <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                              <polyline points='14 2 14 8 20 8' />
                            </svg>
                            <p className='text-sm text-gray-500'>
                              No subcategories defined. Edit this category to add subcategories.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {flatDefectTypes.length > 0 && (
          <div className='card-enterprise'>
            <h2 className='text-lg font-semibold text-gray-900 mb-5'>
              All Defect Types ({flatDefectTypes.length})
            </h2>

            <div className='flex items-center justify-between mb-4'>
              <p className='text-sm text-gray-500'>
                Showing {pageControls.startIndex}–{pageControls.endIndex} of{' '}
                {pageControls.totalItems.toLocaleString()} defect types
              </p>
            </div>

            <div className='overflow-x-auto'>
              <table className='table-enterprise'>
                <thead>
                  <tr>
                    <th>Taxonomy Code</th>
                    <th>Category</th>
                    <th>Subcategory</th>
                    <th>Defect Name</th>
                    <th>Default Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((entry) => {
                    if (!entry) return null;

                    const severityColor =
                      SEVERITY_COLORS[entry.defaultSeverity] || SEVERITY_COLORS.major;
                    const severityLabel =
                      SEVERITY_LABELS[entry.defaultSeverity] ||
                      entry.defaultSeverity ||
                      'Unknown';

                    return (
                      <tr key={entry.taxonomyCode}>
                        <td>
                          <span className='text-sm font-mono text-gray-600'>
                            {entry.taxonomyCode}
                          </span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>{entry.categoryName}</span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-700'>{entry.subcategoryName}</span>
                        </td>
                        <td>
                          <span className='text-sm text-gray-900'>{entry.defectName}</span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${severityColor}`}
                          >
                            {severityLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {flatDefectTypes.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            totalRecords={flatDefectTypes.length}
          />
        )}

        <CategoryFormModal
          category={editingCategory}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveCategory}
        />
      </div>
    </RequireRole>
  );
};

TaxonomyManagerPage.propTypes = {};

export default TaxonomyManagerPage;