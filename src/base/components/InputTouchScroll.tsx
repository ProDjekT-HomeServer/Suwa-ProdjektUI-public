/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect } from 'react';

const AXIS_LOCK_DISTANCE = 8;
// a touch held this long before moving is the system text selection / caret loupe, which must keep working
const LONG_PRESS_DELAY_MS = 300;

/**
 * Swiping horizontally over the focused text field scrolls its text.
 *
 * iOS pans the whole page instead, so a text longer than the field could not be looked through by swiping.
 */
export const InputTouchScroll = () => {
    useEffect(() => {
        let state: {
            input: HTMLInputElement;
            startX: number;
            startY: number;
            startScrollLeft: number;
            startTime: number;
            isLocked: boolean;
        } | null = null;

        const handleTouchStart = (e: TouchEvent) => {
            state = null;

            const { target } = e;
            if (e.touches.length > 1 || !(target instanceof HTMLInputElement) || target !== document.activeElement) {
                return;
            }

            if (target.scrollWidth <= target.clientWidth) {
                return;
            }

            const [touch] = e.touches;
            state = {
                input: target,
                startX: touch.clientX,
                startY: touch.clientY,
                startScrollLeft: target.scrollLeft,
                startTime: e.timeStamp,
                isLocked: false,
            };
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!state) {
                return;
            }

            if (e.touches.length > 1) {
                state = null;
                return;
            }

            const [touch] = e.touches;
            const dx = touch.clientX - state.startX;
            const dy = touch.clientY - state.startY;

            if (!state.isLocked) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE) {
                    return;
                }

                const isLongPress = e.timeStamp - state.startTime > LONG_PRESS_DELAY_MS;
                const isHorizontal = Math.abs(dx) > Math.abs(dy);
                if (isLongPress || !isHorizontal) {
                    state = null;
                    return;
                }

                state.isLocked = true;
            }

            e.preventDefault();
            e.stopPropagation();
            state.input.scrollLeft = state.startScrollLeft - dx;
        };

        const handleTouchEnd = () => {
            state = null;
        };

        // capture phase, to handle the swipe before other gesture handlers (e.g. swipe back, tabs) see it
        document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
        document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: true });
        document.addEventListener('touchcancel', handleTouchEnd, { capture: true, passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart, { capture: true });
            document.removeEventListener('touchmove', handleTouchMove, { capture: true });
            document.removeEventListener('touchend', handleTouchEnd, { capture: true });
            document.removeEventListener('touchcancel', handleTouchEnd, { capture: true });
        };
    }, []);

    return null;
};
