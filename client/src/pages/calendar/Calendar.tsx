import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  List, Plus, Clock, Flag
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, parseISO, getDay
} from 'date-fns';
import { cn, formatDate } from '../../utils/helpers';
import { useAppStore } from '../../context/appStore';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../app/constants';
import { TaskModal } from '../../components/TaskModal';
import type { Task } from '../../app/types';

import { useAuthStore } from '../../context/authStore';
import { AdminCalendarPage } from './admin/AdminCalendarPage';

export const CalendarPage: React.FC = () => {
    return <AdminCalendarPage />;
};

export default CalendarPage;
