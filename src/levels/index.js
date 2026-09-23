// Every level, in play order. A level unlocks once the one before it has
// been finished (its "reach home" star).
import canopy from './canopy.js'
import rainy from './rainy.js'

export const LEVELS = [canopy, rainy]
