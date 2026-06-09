import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useNotifications } from '../../contexts/NotificationContext';
import { formatDate } from '../../utils/dateUtils';
import { debug, warn } from '../../utils/logger';

const COMPONENT_NAME = 'ToastContainer';

const AUTO_DISMISS_DELAY_MS = 8000;

const TOAST_ICONS = {
  info: (
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
      <circle cx='12' cy='12' r='10' />
      <line x1='12' y1='16' x2='12' y2='12' />
      <line x1='12' y1='8' x2='12.01' y2='8' />
    </svg>
  ),
  success: (
    <svg
      xmlns='http://www.w3.org/2000/s