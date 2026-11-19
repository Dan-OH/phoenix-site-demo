// Media queries shared by the components. Each is a live MediaQueryList, so
// check `.matches` when needed and listen for `change` to react to updates.

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// A device that can hover (mouse or trackpad), even if it also has touch.
export const hoverPointer = matchMedia('(any-hover: hover)');

// A device with both hover and a precise pointer, for cursor effects.
export const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)');

export const mobileLayout = matchMedia('(max-width: 700px)');
