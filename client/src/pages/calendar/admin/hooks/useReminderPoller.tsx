/**
 * useReminderPoller
 *
 * Polls /admin/calendar/due-reminders every 30 seconds.
 * When a task whose `reminderAt` is within the next 60 s arrives,
 * it fires a browser Notification (if permitted) AND a toast alert.
 *
 * Place <ReminderPoller /> anywhere in the authenticated app tree.
 */
import { useEffect, useRef } from 'react';
import API from '../../../../api/axios.ts';
import { emitInfoToast } from '../../../../context/toastBus.ts';

const POLL_MS = 30_000;           // poll every 30 s
const ALERTED = new Set<string>(); // track already-alerted task IDs this session

async function requestBrowserPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

function fireBrowserNotification(title: string, body: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: '/favicon.ico' });
}

export function useReminderPoller() {
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        requestBrowserPermission();

        const poll = async () => {
            try {
                const res = await API.get('/admin/calendar/due-reminders');
                const tasks: Array<{ _id: string; title: string; startDateTime?: string }> = res.data;

                for (const task of tasks) {
                    if (ALERTED.has(task._id)) continue;
                    ALERTED.add(task._id);

                    const timeLabel = task.startDateTime
                        ? new Date(task.startDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : 'soon';

                    // Browser notification
                    fireBrowserNotification(
                        `⏰ Reminder: ${task.title}`,
                        `Your event starts at ${timeLabel}.`
                    );

                    // In-app toast
                    emitInfoToast(`⏰ Reminder: "${task.title}" starts at ${timeLabel}.`);
                }
            } catch {
                // silently ignore network errors
            }
        };

        poll(); // immediately on mount
        timerRef.current = setInterval(poll, POLL_MS);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);
}

/** Drop-in component — renders nothing, just activates the hook */
export const ReminderPoller: React.FC = () => {
    useReminderPoller();
    return null;
};

import React from 'react';
export default ReminderPoller;
