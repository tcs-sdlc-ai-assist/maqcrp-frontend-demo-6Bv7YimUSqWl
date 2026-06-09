import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppProvider from './app/AppProvider';
import AppRouter from './app/AppRouter';
import ToastContainer from './components/shared/ToastContainer';
import { useAlertMonitor } from './hooks/useAlertMonitor';

const AlertMonitorInitializer = () => {
  useAlertMonitor(30000);
  return null;
};

const App = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <AlertMonitorInitializer />
        <AppRouter />
        <ToastContainer />
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;