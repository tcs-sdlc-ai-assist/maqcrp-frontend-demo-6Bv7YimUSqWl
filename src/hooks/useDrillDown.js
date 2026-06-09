import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { debug, warn } from '../utils/logger';

const HOOK_NAME = 'useDrillDown';

const MAX_DRILL_DEPTH = 3;

const DEFAULT_BREADCRUMB_LABELS = {
  portfolio: 'Portfolio Overview',
  counterparty: 'Counterparty Detail',
  loan: 'Loan Detail',
  defect: 'Defect Detail',
  remedy: 'Remedy Case Detail',
  repurchase: 'Repurchase Case Detail',
  qcCase: 'QC Case Detail',
  alert: 'Alert Detail',
  watchlist: 'Watchlist Entry',
  report: 'Report',
};

/**
 * @typedef {Object} DrillStep
 * @property {string} id - Unique identifier for this drill step.
 * @property {string} type - The entity type (e.g., 'counterparty', 'loan', 'defect').
 * @property {string} label - Human-readable label for breadcrumb display.
 * @property {Object} [metadata] - Optional metadata associated with this step.
 */

/**
 * @typedef {Object} Breadcrumb
 * @property {string} id - Unique identifier for the breadcrumb.
 * @property {string} label - Display label.
 * @property {string} type - Entity type.
 * @property {boolean} isLast - Whether this is the last breadcrumb in the trail.
 * @property {boolean} isClickable - Whether this breadcrumb is clickable (not the current step).
 */

/**
 * @typedef {Object} DrillDownResult
 * @property {DrillStep[]} drillPath - The current drill-down path stack.
 * @property {Function} navigateToDetail - Navigate to a detail view, pushing a new step onto the path.
 * @property {Function} navigateBack - Navigate back one or more steps.
 * @property {Function} navigateToRoot - Navigate back to the root (clears the entire path).
 * @property {Breadcrumb[]} breadcrumbs - Generated breadcrumb trail for UI rendering.
 * @property {number} currentDepth - Current depth in the drill-down hierarchy.
 * @property {DrillStep|null} currentStep - The current (deepest) step in the drill path.
 * @property {boolean} canGoBack - Whether there is a previous step to navigate back to.
 * @property {Function} resetDrillPath - Reset the entire drill path to a new initial state.
 */

/**
 * Validates that a drill step object has the required fields.
 * @param {Object} step - The step to validate.
 * @returns {boolean} True if the step is valid.
 */
const validateDrillStep = (step) => {
  if (!step || typeof step !== 'object') {
    warn(HOOK_NAME, 'Invalid drill step: must be an object', { stepType: typeof step });
    return false;
  }

  if (!step.id || typeof step.id !== 'string') {
    warn(HOOK_NAME, 'Invalid drill step: missing or invalid id', { id: step.id });
    return false;
  }

  if (!step.type || typeof step.type !== 'string') {
    warn(HOOK_NAME, 'Invalid drill step: missing or invalid type', { type: step.type });
    return false;
  }

  if (!step.label || typeof step.label !== 'string') {
    warn(HOOK_NAME, 'Invalid drill step: missing or invalid label', { label: step.label });
    return false;
  }

  return true;
};

/**
 * Generates a label for a drill step based on its type and metadata.
 * Falls back to a default label if no specific label is provided.
 * @param {string} type - The entity type.
 * @param {string} id - The entity identifier.
 * @param {Object} [metadata] - Optional metadata.
 * @returns {string} The generated label.
 */
const generateLabel = (type, id, metadata) => {
  if (metadata && metadata.label && typeof metadata.label === 'string') {
    return metadata.label;
  }

  if (metadata && metadata.name && typeof metadata.name === 'string') {
    return metadata.name;
  }

  const defaultLabel = DEFAULT_BREADCRUMB_LABELS[type];

  if (defaultLabel) {
    return `${defaultLabel}: ${id}`;
  }

  return `${type}: ${id}`;
};

/**
 * Generates breadcrumb objects from the current drill path.
 * Each breadcrumb includes navigation metadata for UI rendering.
 * @param {DrillStep[]} drillPath - The current drill path.
 * @returns {Breadcrumb[]} Array of breadcrumb objects.
 */
const generateBreadcrumbs = (drillPath) => {
  if (!Array.isArray(drillPath) || drillPath.length === 0) {
    return [];
  }

  return drillPath.map((step, index) => {
    const isLast = index === drillPath.length - 1;

    return {
      id: step.id,
      label: step.label,
      type: step.type,
      isLast,
      isClickable: !isLast,
      depth: index,
    };
  });
};

/**
 * Custom hook that manages drill-down navigation state and breadcrumb trail generation.
 *
 * Provides a stack-based navigation model where each "drill" into a detail view
 * pushes a new step onto the path, and navigating back pops steps off the stack.
 * The maximum drill depth is capped at 3 levels to enforce NFR-012.
 *
 * @param {DrillStep} [initialStep] - Optional initial step to seed the drill path.
 * @returns {DrillDownResult}
 *
 * @example
 * const {
 *   drillPath,
 *   navigateToDetail,
 *   navigateBack,
 *   navigateToRoot,
 *   breadcrumbs,
 *   currentDepth,
 *   currentStep,
 *   canGoBack,
 * } = useDrillDown({ id: 'portfolio', type: 'portfolio', label: 'Portfolio Overview' });
 *
 * // Navigate to a counterparty detail
 * navigateToDetail({ id: 'SELL-0001', type: 'counterparty', label: 'First National Mortgage' });
 *
 * // Navigate to a loan detail from the counterparty
 * navigateToDetail({ id: 'LOAN-0001', type: 'loan', label: 'Loan LOAN-0001' });
 *
 * // Navigate back one level
 * navigateBack();
 *
 * // Navigate back to root
 * navigateToRoot();
 */
export const useDrillDown = (initialStep) => {
  const [drillPath, setDrillPath] = useState(() => {
    if (initialStep && validateDrillStep(initialStep)) {
      return [initialStep];
    }

    if (initialStep) {
      warn(HOOK_NAME, 'Initial step provided but failed validation, starting with empty path');
    }

    return [];
  });

  const previousPathRef = useRef(drillPath);

  useEffect(() => {
    previousPathRef.current = drillPath;
  }, [drillPath]);

  const navigateToDetail = useCallback(
    (step) => {
      if (!validateDrillStep(step)) {
        warn(HOOK_NAME, 'navigateToDetail called with invalid step, navigation aborted');
        return false;
      }

      setDrillPath((prevPath) => {
        const currentDepth = prevPath.length;

        if (currentDepth >= MAX_DRILL_DEPTH) {
          warn(HOOK_NAME, 'Maximum drill depth reached', {
            currentDepth,
            maxDepth: MAX_DRILL_DEPTH,
            attemptedStep: step.id,
          });
          return prevPath;
        }

        const existingIndex = prevPath.findIndex(
          (existingStep) => existingStep && existingStep.id === step.id && existingStep.type === step.type,
        );

        if (existingIndex !== -1) {
          debug(HOOK_NAME, 'Step already exists in path, truncating to existing step', {
            stepId: step.id,
            existingIndex,
          });
          return prevPath.slice(0, existingIndex + 1);
        }

        const label = step.label || generateLabel(step.type, step.id, step.metadata);

        const newStep = {
          id: step.id,
          type: step.type,
          label,
          metadata: step.metadata || {},
        };

        const newPath = [...prevPath, newStep];

        debug(HOOK_NAME, 'Navigated to detail', {
          stepId: newStep.id,
          stepType: newStep.type,
          newDepth: newPath.length,
        });

        return newPath;
      });

      return true;
    },
    [],
  );

  const navigateBack = useCallback(
    (steps = 1) => {
      if (typeof steps !== 'number' || isNaN(steps) || steps < 1) {
        warn(HOOK_NAME, 'navigateBack called with invalid steps count', { steps });
        return false;
      }

      setDrillPath((prevPath) => {
        if (prevPath.length === 0) {
          debug(HOOK_NAME, 'navigateBack called but path is already empty');
          return prevPath;
        }

        const safeSteps = Math.min(steps, prevPath.length - 1);

        if (safeSteps === 0) {
          debug(HOOK_NAME, 'navigateBack would remove root step, keeping root');
          return prevPath;
        }

        const newPath = prevPath.slice(0, prevPath.length - safeSteps);

        debug(HOOK_NAME, 'Navigated back', {
          stepsBack: safeSteps,
          previousDepth: prevPath.length,
          newDepth: newPath.length,
        });

        return newPath;
      });

      return true;
    },
    [],
  );

  const navigateToRoot = useCallback(() => {
    setDrillPath((prevPath) => {
      if (prevPath.length <= 1) {
        debug(HOOK_NAME, 'navigateToRoot called but already at or near root');
        return prevPath;
      }

      const rootStep = prevPath[0];

      debug(HOOK_NAME, 'Navigated to root', {
        previousDepth: prevPath.length,
      });

      return [rootStep];
    });
  }, []);

  const resetDrillPath = useCallback(
    (newInitialStep) => {
      if (newInitialStep && validateDrillStep(newInitialStep)) {
        const label = newInitialStep.label || generateLabel(newInitialStep.type, newInitialStep.id, newInitialStep.metadata);

        const step = {
          id: newInitialStep.id,
          type: newInitialStep.type,
          label,
          metadata: newInitialStep.metadata || {},
        };

        setDrillPath([step]);

        debug(HOOK_NAME, 'Drill path reset with new initial step', {
          stepId: step.id,
          stepType: step.type,
        });
      } else if (newInitialStep) {
        warn(HOOK_NAME, 'resetDrillPath called with invalid step, clearing path');
        setDrillPath([]);
      } else {
        setDrillPath([]);
        debug(HOOK_NAME, 'Drill path cleared');
      }
    },
    [],
  );

  const breadcrumbs = useMemo(() => {
    return generateBreadcrumbs(drillPath);
  }, [drillPath]);

  const currentDepth = drillPath.length;

  const currentStep = useMemo(() => {
    if (drillPath.length === 0) {
      return null;
    }
    return drillPath[drillPath.length - 1];
  }, [drillPath]);

  const canGoBack = drillPath.length > 1;

  return {
    drillPath,
    navigateToDetail,
    navigateBack,
    navigateToRoot,
    breadcrumbs,
    currentDepth,
    currentStep,
    canGoBack,
    resetDrillPath,
  };
};

export default useDrillDown;