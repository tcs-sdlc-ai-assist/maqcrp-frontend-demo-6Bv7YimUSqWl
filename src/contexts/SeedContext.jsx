import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { checkAndSeed, resetData, getSeedStatus, DATA_VERSION } from '../data/seeds/seedOrchestrator';
import { debug, info, warn, error } from '../utils/logger';

const SeedContext = createContext(null);

const SEED_CONTEXT_NAME = 'SeedContext';

export const SeedProvider = ({ children }) => {
  const [isSeeded, setIsSeeded] = useState(false);
  const [isSeeding, setIsSeeding] = useState(true);
  const [seedError, setSeedError] = useState(null);
  const [seedStatus, setSeedStatus] = useState(null);

  const hasRunRef = useRef(false);

  const performSeed = useCallback(async () => {
    if (hasRunRef.current) {
      debug(SEED_CONTEXT_NAME, 'Seed already performed, skipping');
      return;
    }

    hasRunRef.current = true;
    setIsSeeding(true);
    setSeedError(null);

    try {
      info(SEED_CONTEXT_NAME, 'Starting seed data check');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const result = checkAndSeed();

      if (result.seeded) {
        setIsSeeded(true);
        info(SEED_CONTEXT_NAME, 'Seed data ready', { wasReset: result.wasReset });
      } else {
        const err = new Error('Seed data generation failed');
        setSeedError(err);
        error(SEED_CONTEXT_NAME, 'Seed data generation failed');
      }

      const status = getSeedStatus();
      setSeedStatus(status);
      debug(SEED_CONTEXT_NAME, 'Seed status retrieved', status);
    } catch (err) {
      setSeedError(err);
      error(SEED_CONTEXT_NAME, 'Unexpected error during seeding', err);
    } finally {
      setIsSeeding(false);
    }
  }, []);

  useEffect(() => {
    performSeed();
  }, [performSeed]);

  const handleResetData = useCallback(() => {
    try {
      info(SEED_CONTEXT_NAME, 'Resetting all data');
      setIsSeeding(true);
      setSeedError(null);

      const success = resetData();

      if (success) {
        setIsSeeded(true);
        const status = getSeedStatus();
        setSeedStatus(status);
        info(SEED_CONTEXT_NAME, 'Data reset complete');
      } else {
        const err = new Error('Data reset failed');
        setSeedError(err);
        error(SEED_CONTEXT_NAME, 'Data reset failed');
      }
    } catch (err) {
      setSeedError(err);
      error(SEED_CONTEXT_NAME, 'Unexpected error during data reset', err);
    } finally {
      setIsSeeding(false);
    }
  }, []);

  const handleRefreshStatus = useCallback(() => {
    try {
      const status = getSeedStatus();
      setSeedStatus(status);
      debug(SEED_CONTEXT_NAME, 'Seed status refreshed', status);
    } catch (err) {
      warn(SEED_CONTEXT_NAME, 'Failed to refresh seed status', err);
    }
  }, []);

  const value = {
    isSeeded,
    isSeeding,
    seedError,
    seedStatus,
    dataVersion: DATA_VERSION,
    resetData: handleResetData,
    refreshStatus: handleRefreshStatus,
  };

  return <SeedContext.Provider value={value}>{children}</SeedContext.Provider>;
};

SeedProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useSeed = () => {
  const context = useContext(SeedContext);

  if (!context) {
    throw new Error('useSeed must be used within a SeedProvider');
  }

  return context;
};

export default SeedContext;