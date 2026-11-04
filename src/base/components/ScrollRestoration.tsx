/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router-dom';
import { AppStorage } from '@/lib/storage/AppStorage.ts';

const STORAGE_KEY = 'scrollPositions';
const MAX_ENTRIES = 50;
/** Long enough for a page to render its cached content, short enough to not jump around after the user moved on. */
const RESTORE_TIMEOUT_MS = 3000;

type ScrollPositions = Record<string, { y: number; updatedAt: number }>;

const readPositions = (): ScrollPositions => {
    const positions: unknown = AppStorage.session.getItemParsed(STORAGE_KEY, {});
    return positions && typeof positions === 'object' ? (positions as ScrollPositions) : {};
};

const storePosition = (locationKey: string, y: number) => {
    const positions = readPositions();
    positions[locationKey] = { y, updatedAt: Date.now() };

    const limitedPositions = Object.fromEntries(
        Object.entries(positions)
            .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_ENTRIES),
    );

    try {
        AppStorage.session.setItem(STORAGE_KEY, limitedPositions, false);
    } catch {
        // the position is just not restored
    }
};

/**
 * Opening a page scrolls to the top, going back restores the scroll position the page had (e.g. the global search
 * results after going back from a manga).
 *
 * Pages that restore their position themselves (e.g. the virtualized grids) end up at the same position.
 * The positions are kept in the session storage, since iOS reloads installed web apps after evicting them in the
 * background.
 */
export const ScrollRestoration = () => {
    const location = useLocation();
    const navigationType = useNavigationType();

    const lastScrollYRef = useRef(window.scrollY);
    const currentLocationKeyRef = useRef(location.key);
    const previousPathnameRef = useRef(location.pathname);
    const cancelRestoreRef = useRef<() => void>(() => {});

    useEffect(() => {
        // the browser would otherwise also restore the position, before the page got rendered
        window.history.scrollRestoration = 'manual';

        let frame: number | null = null;

        const handleScroll = () => {
            lastScrollYRef.current = window.scrollY;

            if (frame !== null) {
                return;
            }

            frame = requestAnimationFrame(() => {
                frame = null;
                storePosition(currentLocationKeyRef.current, lastScrollYRef.current);
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frame !== null) {
                cancelAnimationFrame(frame);
            }
        };
    }, []);

    useLayoutEffect(() => {
        const previousLocationKey = currentLocationKeyRef.current;
        if (previousLocationKey === location.key) {
            return;
        }

        // the dom already shows the new page, its scroll position might have been clamped by the browser
        storePosition(previousLocationKey, lastScrollYRef.current);
        currentLocationKeyRef.current = location.key;

        const didPathnameChange = previousPathnameRef.current !== location.pathname;
        previousPathnameRef.current = location.pathname;

        cancelRestoreRef.current();

        const savedPosition = navigationType === NavigationType.Pop ? readPositions()[location.key] : undefined;
        if (!savedPosition) {
            if (didPathnameChange) {
                window.scrollTo(0, 0);
            }
            return;
        }

        const targetY = savedPosition.y;
        const startTime = performance.now();
        let frame: number | null = null;

        const cancel = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
                frame = null;
            }

            window.removeEventListener('touchstart', cancel);
            window.removeEventListener('wheel', cancel);
            window.removeEventListener('keydown', cancel);
        };
        cancelRestoreRef.current = cancel;

        // the user taking over ends the restoration
        window.addEventListener('touchstart', cancel, { passive: true });
        window.addEventListener('wheel', cancel, { passive: true });
        window.addEventListener('keydown', cancel);

        // the content might still be loading, retry until the page is tall enough
        const restore = () => {
            window.scrollTo(0, targetY);

            const isRestored = Math.abs(window.scrollY - targetY) < 2;
            const isTimedOut = performance.now() - startTime > RESTORE_TIMEOUT_MS;
            if (isRestored || isTimedOut) {
                cancel();
                return;
            }

            frame = requestAnimationFrame(restore);
        };

        restore();
    }, [location.key]);

    useEffect(() => () => cancelRestoreRef.current(), []);

    return null;
};
