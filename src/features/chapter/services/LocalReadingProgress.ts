/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
import type { ChapterType } from '@/lib/graphql/generated/graphql-base.types.ts';

export const LOCAL_READING_PROGRESS_KEY = 'incognitoReadingProgress';

/** Plenty for the chapters that are read in incognito mode, small enough to be parsed on every progress change. */
const MAX_ENTRIES = 1000;

type LocalChapterProgress = {
    lastPageRead: number;
    pageCount: number;
    updatedAt: number;
};

type LocalReadingProgressMap = Record<string, LocalChapterProgress>;

type ChapterProgress = Pick<ChapterType, 'id' | 'isRead'> & Partial<Pick<ChapterType, 'lastPageRead' | 'pageCount'>>;

const read = (): LocalReadingProgressMap => {
    const progress: unknown = AppStorage.local.getItemParsed(LOCAL_READING_PROGRESS_KEY, {});
    return progress && typeof progress === 'object' ? (progress as LocalReadingProgressMap) : {};
};

/**
 * The reading progress of the chapters read in incognito mode.
 *
 * Incognito mode does not update the chapters on the server, thus, the progress only lives on this device.
 */
export class LocalReadingProgress {
    static getAll(): LocalReadingProgressMap {
        return read();
    }

    static set(chapterId: ChapterType['id'], lastPageRead: number, pageCount: number): void {
        const progress = read();
        const existing = progress[chapterId];
        if (existing?.lastPageRead === lastPageRead && existing.pageCount === pageCount) {
            return;
        }

        progress[chapterId] = { lastPageRead, pageCount, updatedAt: Date.now() };

        const limitedProgress = Object.fromEntries(
            Object.entries(progress)
                .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
                .slice(0, MAX_ENTRIES),
        );

        try {
            AppStorage.local.setItem(LOCAL_READING_PROGRESS_KEY, limitedProgress);
        } catch {
            // storage full or unavailable, the progress is just not kept
        }
    }

    /**
     * The furthest progress of the server and of this device, "undefined" for chapters that are read or not started.
     */
    static getEffective(
        chapter: ChapterProgress,
        localProgress: LocalReadingProgressMap = read(),
    ): { lastPageRead: number; pageCount: number; isReadLocally: boolean } | undefined {
        if (chapter.isRead) {
            return undefined;
        }

        const local = localProgress[chapter.id];
        const serverLastPageRead = chapter.lastPageRead ?? 0;
        const serverPageCount = chapter.pageCount ?? 0;

        if (local && local.lastPageRead > serverLastPageRead) {
            return {
                lastPageRead: local.lastPageRead,
                pageCount: local.pageCount,
                isReadLocally: local.pageCount > 0 && local.lastPageRead >= local.pageCount - 1,
            };
        }

        if (serverLastPageRead <= 0) {
            return undefined;
        }

        return { lastPageRead: serverLastPageRead, pageCount: serverPageCount, isReadLocally: false };
    }
}

export const useLocalReadingProgress = (): LocalReadingProgressMap => {
    const [progress] = useLocalStorage<LocalReadingProgressMap>(LOCAL_READING_PROGRESS_KEY, {});
    return progress && typeof progress === 'object' ? progress : {};
};
