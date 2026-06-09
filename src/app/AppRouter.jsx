import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/shared/AppLayout';
import LoginPage from '../pages/LoginPage';
import operationsRoutes from '../routes/operationsRoutes';
import oversightRoutes from '../routes/oversightRoutes';

const AppRouter = () => {
  return (
    <Routes>
      <Route path='/login' element={<LoginPage />} />

      <Route
        path='/operations/*'
        element={
          <AppLayout>
            <Routes>
              {operationsRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
            </Routes>
          </AppLayout>
        }
      />

      <Route
        path='/oversight/*'
        element={
          <AppLayout>
            <Routes>
              {oversightRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
            </Routes>
          </AppLayout>
        }
      />

      <Route path='/' element={<Navigate to='/login' replace />} />

      <Route
        path='*'
        element={
          <AppLayout>
            <div className='min-h-[60vh] flex items-center justify-center px-4'>
              <div className='max-w-md w-full text-center'>
                <div className='mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-gray-100 mb-6'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth={1.5}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='w-10 h-10 text-gray-400'
                  >
                    <circle cx='12' cy='12' r='10' />
                    <line x1='12' y1='8' x2='12' y2='12' />
                    <line x1='12' y1='16' x2='12.01' y2='16' />
                  </svg>
                </div>
                <h1 className='text-2xl font-bold text-gray-900 mb-2'>Page Not Found</h1>
                <p className='text-sm text-gray-600 mb-6 leading-relaxed'>
                  The page you are looking for does not exist or has been moved.
                </p>
                <a
                  href='/login'
                  className='btn-enterprise-primary inline-flex'
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
                  Return to Login
                </a>
              </div>
            </div>
          </AppLayout>
        }
      />
    </Routes>
  );
};

export default AppRouter;