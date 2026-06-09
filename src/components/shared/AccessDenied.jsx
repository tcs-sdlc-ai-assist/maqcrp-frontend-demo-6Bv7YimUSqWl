import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';
import { PERSONAS } from '../../config';

const ROLE_LABELS = PERSONAS.reduce((map, persona) => {
  map[persona.id] = persona.label;
  return map;
}, {});

const AccessDenied = ({ requiredRoles, currentRole, message }) => {
  const navigate = useNavigate();
  const { switchPersona, currentPersona } = useAuth();

  const effectiveCurrentRole = currentRole || currentPersona?.id || null;

  const currentRoleLabel = effectiveCurrentRole
    ? ROLE_LABELS[effectiveCurrentRole] || effectiveCurrentRole
    : 'None';

  const requiredRoleLabels = Array.isArray(requiredRoles)
    ? requiredRoles.map((role) => ROLE_LABELS[role] || role)
    : [];

  const displayMessage =
    message ||
    (effectiveCurrentRole
      ? `Your current persona (${currentRoleLabel}) does not have permission to access this page.`
      : 'You must be logged in to access this page.');

  const handleSwitchPersona = () => {
    navigate('/login');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className='min-h-[60vh] flex items-center justify-center px-4'>
      <div className='max-w-md w-full text-center'>
        <div className='mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-50 mb-6'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
            className='w-10 h-10 text-red-500'
          >
            <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
            <path d='M7 11V7a5 5 0 0 1 10 0v4' />
            <circle cx='12' cy='16' r='1' />
          </svg>
        </div>

        <h1 className='text-2xl font-bold text-gray-900 mb-2'>Access Denied</h1>

        <p className='text-sm text-gray-600 mb-6 leading-relaxed'>{displayMessage}</p>

        {requiredRoleLabels.length > 0 && (
          <div className='mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200'>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wider mb-2'>
              Required Personas
            </p>
            <ul className='space-y-1'>
              {requiredRoleLabels.map((label) => (
                <li key={label} className='text-sm text-gray-700 flex items-center gap-2'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={2}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-4 h-4 text-gray-400 flex-shrink-0'
                  >
                    <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                    <circle cx='12' cy='7' r='4' />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {effectiveCurrentRole && (
          <div className='mb-6 p-3 bg-amber-50 rounded-lg border border-amber-200'>
            <p className='text-xs text-amber-700'>
              Current persona:{' '}
              <span className='font-semibold'>{currentRoleLabel}</span>
            </p>
          </div>
        )}

        <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
          <button
            type='button'
            onClick={handleSwitchPersona}
            className='btn-enterprise-primary w-full sm:w-auto'
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
              <path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
              <circle cx='8.5' cy='7' r='4' />
              <polyline points='17 11 19 13 23 9' />
            </svg>
            Switch Persona
          </button>

          <button
            type='button'
            onClick={handleGoBack}
            className='btn-enterprise-secondary w-full sm:w-auto'
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
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

AccessDenied.propTypes = {
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  currentRole: PropTypes.string,
  message: PropTypes.string,
};

AccessDenied.defaultProps = {
  requiredRoles: [],
  currentRole: null,
  message: '',
};

export default AccessDenied;