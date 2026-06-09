import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PERSONAS } from '../config';
import { debug, info, warn } from '../utils/logger';

const COMPONENT_NAME = 'LoginPage';

const PERSONA_ICONS = {
  'risk-analyst': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-8 h-8'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
    </svg>
  ),
  'compliance-officer': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-8 h-8'
    >
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
      <polyline points='14 2 14 8 20 8' />
      <line x1='16' y1='13' x2='8' y2='13' />
      <line x1='16' y1='17' x2='8' y2='17' />
      <polyline points='10 9 9 9 8 9' />
    </svg>
  ),
  'fraud-investigator': (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-8 h-8'
    >
      <circle cx='11' cy='11' r='8' />
      <line x1='21' y1='21' x2='16.65' y2='16.65' />
    </svg>
  ),
  admin: (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-8 h-8'
    >
      <circle cx='12' cy='12' r='3' />
      <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' />
    </svg>
  ),
  executive: (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-8 h-8'
    >
      <polyline points='23 6 13.5 15.5 8.5 10.5 1 18' />
      <polyline points='17 6 23 6 23 12' />
    </svg>
  ),
};

const PERSONA_COLORS = {
  'risk-analyst': 'border-enterprise-200 hover:border-enterprise-400 bg-white hover:bg-enterprise-50/30',
  'compliance-officer': 'border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50/30',
  'fraud-investigator': 'border-amber-200 hover:border-amber-400 bg-white hover:bg-amber-50/30',
  admin: 'border-purple-200 hover:border-purple-400 bg-white hover:bg-purple-50/30',
  executive: 'border-emerald-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/30',
};

const PERSONA_ICON_BG = {
  'risk-analyst': 'bg-enterprise-100 text-enterprise-700',
  'compliance-officer': 'bg-blue-100 text-blue-700',
  'fraud-investigator': 'bg-amber-100 text-amber-700',
  admin: 'bg-purple-100 text-purple-700',
  executive: 'bg-emerald-100 text-emerald-700',
};

const PERSONA_BADGE_COLORS = {
  'risk-analyst': 'bg-enterprise-50 text-enterprise-700 border-enterprise-200',
  'compliance-officer': 'bg-blue-50 text-blue-700 border-blue-200',
  'fraud-investigator': 'bg-amber-50 text-amber-700 border-amber-200',
  admin: 'bg-purple-50 text-purple-700 border-purple-200',
  executive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, currentPersona } = useAuth();

  const [selectedPersonaId, setSelectedPersonaId] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectPersona = useCallback(
    (personaId) => {
      if (isLoggingIn) {
        return;
      }

      setSelectedPersonaId(personaId);
      setError(null);
    },
    [isLoggingIn],
  );

  const handleLogin = useCallback(() => {
    if (!selectedPersonaId) {
      setError('Please select a persona to continue.');
      return;
    }

    if (isLoggingIn) {
      return;
    }

    setIsLoggingIn(true);
    setError(null);

    try {
      const success = login(selectedPersonaId);

      if (!success) {
        setError('Failed to log in with the selected persona. Please try again.');
        setIsLoggingIn(false);
        warn(COMPONENT_NAME, 'Login failed for persona', { personaId: selectedPersonaId });
        return;
      }

      const persona = PERSONAS.find((p) => p.id === selectedPersonaId);

      if (!persona) {
        setError('Selected persona is no longer available. Please select another.');
        setIsLoggingIn(false);
        warn(COMPONENT_NAME, 'Persona not found after login', { personaId: selectedPersonaId });
        return;
      }

      info(COMPONENT_NAME, 'User logged in', { personaId: selectedPersonaId });

      const destination = persona.defaultDashboard || '/dashboard';

      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 300);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoggingIn(false);
      warn(COMPONENT_NAME, 'Login threw an unexpected error', err);
    }
  }, [selectedPersonaId, isLoggingIn, login, navigate]);

  const handleKeyDown = useCallback(
    (e, personaId) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelectPersona(personaId);
      }
    },
    [handleSelectPersona],
  );

  const handleLoginKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleLogin();
      }
    },
    [handleLogin],
  );

  if (currentPersona) {
    const destination = currentPersona.defaultDashboard || '/dashboard';
    navigate(destination, { replace: true });
    return null;
  }

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-12'>
      <div className='w-full max-w-5xl'>
        <div className='text-center mb-10'>
          <div className='inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-enterprise-600 text-white shadow-lg mb-6'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
              strokeLinecap='round'
              strokeLinejoin='round'
              className='w-8 h-8'
            >
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
            </svg>
          </div>

          <h1 className='text-3xl font-bold text-gray-900 mb-2'>MAQCrop Demo</h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Enterprise Risk Management Dashboard
          </p>
        </div>

        <div className='mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl'>
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
                <circle cx='12' cy='12' r='10' />
                <line x1='12' y1='16' x2='12' y2='12' />
                <line x1='12' y1='8' x2='12.01' y2='8' />
              </svg>
            </div>
            <div>
              <p className='text-sm font-medium text-amber-800 mb-1'>Demonstration Platform</p>
              <p className='text-sm text-amber-700'>
                This is a demonstration platform. Select a role to view persona-specific dashboards
                and workflows. No real authentication is performed.
              </p>
            </div>
          </div>
        </div>

        <div className='mb-8'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4 text-center'>
            Select a Persona
          </h2>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {PERSONAS.map((persona) => {
              const isSelected = selectedPersonaId === persona.id;
              const colorClass = PERSONA_COLORS[persona.id] || PERSONA_COLORS['risk-analyst'];
              const iconBgClass = PERSONA_ICON_BG[persona.id] || PERSONA_ICON_BG['risk-analyst'];
              const badgeColorClass =
                PERSONA_BADGE_COLORS[persona.id] || PERSONA_BADGE_COLORS['risk-analyst'];

              return (
                <button
                  key={persona.id}
                  type='button'
                  onClick={() => handleSelectPersona(persona.id)}
                  onKeyDown={(e) => handleKeyDown(e, persona.id)}
                  disabled={isLoggingIn}
                  className={`
                    relative flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${colorClass}
                    ${isSelected ? 'ring-2 ring-enterprise-500 border-enterprise-500 shadow-md scale-[1.02]' : 'shadow-sm'}
                  `}
                  aria-label={`Select ${persona.label} persona`}
                  aria-pressed={isSelected}
                  role='option'
                  aria-selected={isSelected}
                >
                  {isSelected && (
                    <div className='absolute top-3 right-3 w-6 h-6 rounded-full bg-enterprise-600 flex items-center justify-center'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth={3}
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        className='w-4 h-4 text-white'
                      >
                        <polyline points='20 6 9 17 4 12' />
                      </svg>
                    </div>
                  )}

                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${iconBgClass}`}
                  >
                    {PERSONA_ICONS[persona.id] || PERSONA_ICONS['risk-analyst']}
                  </div>

                  <h3 className='text-base font-semibold text-gray-900 mb-1'>{persona.label}</h3>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-medium border mb-3 ${badgeColorClass}`}
                  >
                    {persona.id}
                  </span>

                  <p className='text-sm text-gray-500 leading-relaxed'>{persona.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in'>
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
              <p className='text-sm text-red-700'>{error}</p>
            </div>
          </div>
        )}

        <div className='flex flex-col items-center gap-4'>
          <button
            type='button'
            onClick={handleLogin}
            onKeyDown={handleLoginKeyDown}
            disabled={!selectedPersonaId || isLoggingIn}
            className='btn-enterprise-primary px-8 py-3 text-base min-w-[200px]'
          >
            {isLoggingIn ? (
              <>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth={2}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='w-5 h-5 mr-2 animate-spin'
                >
                  <path d='M21 12a9 9 0 1 1-6.219-8.56' />
                </svg>
                Signing In...
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
                  className='w-5 h-5 mr-2'
                >
                  <path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' />
                  <polyline points='10 17 15 12 10 7' />
                  <line x1='15' y1='12' x2='3' y2='12' />
                </svg>
                Enter Dashboard
              </>
            )}
          </button>

          {!selectedPersonaId && !isLoggingIn && (
            <p className='text-sm text-gray-400'>Select a persona above to continue</p>
          )}
        </div>

        <div className='mt-12 text-center'>
          <p className='text-xs text-gray-400'>
            MAQCrop Demo &copy; {new Date().getFullYear()} &middot; Enterprise Risk Management
            Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;