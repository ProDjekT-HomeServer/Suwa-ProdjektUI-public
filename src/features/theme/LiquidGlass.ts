/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Components, CSSObject, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/**
 * Approximation of Apples "Liquid Glass" material (iOS 26) for the web.
 *
 * Guidelines (WWDC25 "Meet Liquid Glass", "Get to know the new design system"):
 * - glass is only used for the navigation/control layer floating above the content, never for the content itself
 * - never stack glass on glass; elements on top of glass use fills and vibrancy instead
 * - tint only the primary action, color belongs into the content layer
 * - capsule shapes for controls, concentric radii for nested shapes
 * - respects "reduced transparency", "increased contrast" and "reduced motion"
 */

export const GLASS_BLUR = 18;
export const GLASS_SATURATION = 180;

/** used for large surfaces (menus, dialogs, sheets) */
export const GLASS_SURFACE_RADIUS = 28;
/** margin between floating bars and the screen edge */
export const GLASS_FLOATING_MARGIN = 12;

export const CAPSULE_RADIUS = 9999;

const PRESS_TRANSITION =
    'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease-out, background-color 200ms ease-out';

type GlassOptions = {
    /** tints the glass, should only be used for primary actions */
    tint?: string;
    /** larger surfaces cast deeper shadows */
    elevated?: boolean;
    /** adds the press feedback (scale + illumination) */
    interactive?: boolean;
    /**
     * the more transparent "clear" variant for controls floating above media (e.g. the reader), which should stay
     * visible through the glass
     */
    clear?: boolean;
};

const getBackdropFilter = () => `blur(${GLASS_BLUR}px) saturate(${GLASS_SATURATION}%)`;

const getShadows = (isDark: boolean, elevated: boolean) => {
    const specular = isDark
        ? 'inset 0 1px 0.5px rgba(255, 255, 255, 0.22), inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.06)'
        : 'inset 0 1px 0.5px rgba(255, 255, 255, 0.9), inset 0 -0.5px 0.5px rgba(255, 255, 255, 0.35)';
    const rim = isDark ? 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.14)' : 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)';
    const drop = elevated
        ? `0 12px 40px rgba(0, 0, 0, ${isDark ? 0.5 : 0.18})`
        : `0 4px 16px rgba(0, 0, 0, ${isDark ? 0.35 : 0.12})`;

    return `${specular}, ${rim}, ${drop}`;
};

const getBackgroundColor = (isDark: boolean, elevated: boolean, tint?: string, clear?: boolean) => {
    if (tint) {
        return alpha(tint, isDark ? 0.55 : 0.7);
    }

    // the clear variant relies on the blur to keep its content legible
    if (clear) {
        return isDark ? 'rgba(24, 24, 28, 0.5)' : 'rgba(255, 255, 255, 0.4)';
    }

    // large surfaces contain a lot of text, thus, they need to be more opaque to stay legible
    if (elevated) {
        return isDark ? 'rgba(36, 36, 40, 0.72)' : 'rgba(250, 250, 252, 0.78)';
    }

    return isDark ? 'rgba(40, 40, 44, 0.48)' : 'rgba(255, 255, 255, 0.55)';
};

export const liquidGlass = (
    theme: Theme,
    { tint, elevated = false, interactive = false, clear = false }: GlassOptions = {},
) =>
    ({
        backgroundColor: getBackgroundColor(false, elevated, tint, clear),
        backgroundImage: 'none',
        backdropFilter: getBackdropFilter(),
        WebkitBackdropFilter: getBackdropFilter(),
        boxShadow: getShadows(false, elevated),
        border: 'none',
        ...(theme.applyStyles('dark', {
            backgroundColor: getBackgroundColor(true, elevated, tint, clear),
            boxShadow: getShadows(true, elevated),
        }) as CSSObject),
        ...(interactive && {
            transition: PRESS_TRANSITION,
            '&:active': {
                transform: 'scale(0.95)',
                // the material "illuminates from within" on touch
                backgroundImage: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.22), transparent 70%)',
            },
            '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '&:active': {
                    transform: 'none',
                },
            },
        }),
        '@media (prefers-reduced-transparency: reduce)': {
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            backgroundColor: tint ?? theme.palette.background.paper,
        },
        '@media (prefers-contrast: more)': {
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            backgroundColor: tint ?? theme.palette.background.paper,
            outline: `1px solid ${theme.palette.text.primary}`,
        },
    }) satisfies CSSObject;

/**
 * "Soft scroll edge effect": content scrolling below a floating bar gets blurred and dissolved into the background
 * instead of using a hard divider.
 */
export const scrollEdgeEffect = (theme: Theme, edge: 'top' | 'bottom') => {
    const direction = edge === 'top' ? 'to bottom' : 'to top';

    return {
        content: '""',
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        backgroundImage: `linear-gradient(${direction}, ${alpha(theme.palette.background.default, 0.92)} 0%, ${alpha(theme.palette.background.default, 0.6)} 55%, transparent 100%)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        maskImage: `linear-gradient(${direction}, black 55%, transparent 100%)`,
        WebkitMaskImage: `linear-gradient(${direction}, black 55%, transparent 100%)`,
        '@media (prefers-reduced-transparency: reduce)': {
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            backgroundImage: 'none',
            backgroundColor: theme.palette.background.default,
            maskImage: 'none',
            WebkitMaskImage: 'none',
        },
    } satisfies CSSObject;
};

/**
 * Theme defaults; these get applied before the components of the selected app theme, thus, app themes can still
 * override them.
 */
export const LIQUID_GLASS_COMPONENTS: Components<Theme> = {
    MuiPopover: {
        styleOverrides: {
            paper: ({ theme }) => ({
                ...liquidGlass(theme, { elevated: true }),
                borderRadius: 20,
            }),
        },
    },
    MuiDialog: {
        styleOverrides: {
            paper: ({ theme }) => ({
                ...liquidGlass(theme, { elevated: true }),
                borderRadius: GLASS_SURFACE_RADIUS,
            }),
        },
    },
    MuiDrawer: {
        styleOverrides: {
            paper: ({ theme, ownerState }) => ({
                ...liquidGlass(theme, { elevated: true }),
                // the "anchorBottom" override key is not applied anymore since mui v9
                ...(ownerState.anchor === 'bottom' && {
                    borderTopLeftRadius: GLASS_SURFACE_RADIUS,
                    borderTopRightRadius: GLASS_SURFACE_RADIUS,
                    // a tall drawer would otherwise reach below the status bar, its top buttons could not be pressed
                    maxHeight: 'calc(100% - env(safe-area-inset-top) - 8px)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                }),
            }),
        },
    },
    MuiTooltip: {
        styleOverrides: {
            tooltip: ({ theme }) => ({
                ...liquidGlass(theme),
                color: theme.palette.text.primary,
                borderRadius: CAPSULE_RADIUS,
                paddingInline: theme.spacing(1.5),
            }),
        },
    },
    MuiFab: {
        styleOverrides: {
            root: ({ theme }) => ({
                ...liquidGlass(theme, { interactive: true }),
                color: theme.palette.text.primary,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                    backgroundColor: alpha(theme.palette.text.primary, 0.12),
                },
            }),
            primary: ({ theme }) => ({
                // primary actions are the only tinted glass elements
                ...liquidGlass(theme, { interactive: true, tint: theme.palette.primary.main }),
                color: theme.palette.primary.contrastText,
                '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.8),
                },
            }),
        },
    },
    MuiButton: {
        styleOverrides: {
            root: {
                borderRadius: CAPSULE_RADIUS,
                textTransform: 'none',
                fontWeight: 600,
            },
        },
    },
    MuiTab: {
        styleOverrides: {
            root: {
                textTransform: 'none',
                fontWeight: 600,
            },
        },
    },
    MuiToggleButton: {
        styleOverrides: {
            root: {
                textTransform: 'none',
            },
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                borderRadius: 16,
            },
        },
    },
    MuiBackdrop: {
        styleOverrides: {
            root: {
                variants: [
                    {
                        props: { invisible: false },
                        style: {
                            // dimming layer to center the attention on interrupting tasks
                            backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        },
                    },
                ],
            },
        },
    },
};
