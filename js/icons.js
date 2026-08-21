/**
 * One monoline icon set, used everywhere an icon appears.
 *
 * These were emoji. Emoji are a font, not a graphic: the same character renders
 * as a flat glyph on one machine, a glossy 3D sticker on another, and a hollow
 * box on a Linux box with no emoji font at all. Six of them sat in the form
 * labels inside gradient tiles, so the tile was consistent and the thing inside
 * it was not. The planner made it worse by icon-ing two of its three field
 * groups and leaving the third bare.
 *
 * 24x24 viewBox, 2px stroke, currentColor. Nothing here is meaningful on its
 * own - every icon sits beside its own text label - so callers mark them
 * aria-hidden and screen readers skip them entirely.
 */

const P = {
    // A vial of powder: the thing being reconstituted.
    peptide: '<path d="M9 3h6M10 3v5.2a2 2 0 01-.3 1L6.4 14a4 4 0 003.4 6h4.4a4 4 0 003.4-6l-3.3-4.8a2 2 0 01-.3-1V3"/><path d="M7 15h10"/>',
    // A capped vial, on its side in the rack.
    vial: '<rect x="7" y="2" width="10" height="4" rx="1"/><path d="M9 6v12a3 3 0 006 0V6"/><path d="M9 13h6"/>',
    // Bacteriostatic water.
    water: '<path d="M12 2.7l5 6.4a6.3 6.3 0 11-10 0z"/>',
    // The syringe you draw into.
    syringe: '<path d="M18 2l4 4M17.5 6.5l-11 11L3 21l3.5-3.5"/><path d="M14 5l5 5-2.5 2.5-5-5z"/><path d="M9 10l5 5M11.5 12.5l-1.5 1.5"/>',
    // Body weight - a balance, not a bathroom scale.
    weight: '<path d="M12 4v16M6 20h12"/><path d="M4 8h16"/><path d="M4 8l-2 5a3.2 3.2 0 004 0z"/><path d="M20 8l-2 5a3.2 3.2 0 004 0z"/><circle cx="12" cy="4" r="1.5"/>',
    // Age bracket.
    age: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    // Time in body.
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    // How often.
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
    // On/off cycle.
    cycle: '<path d="M21 12a9 9 0 11-2.6-6.4"/><path d="M21 3v6h-6"/>',
    // Vials or pens the run consumes.
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.5L12 12.5l8.7-5M12 12.5V21"/>',
    // The worked arithmetic.
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h4"/>',
    // The dose itself.
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    // Search / filter a list.
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    // The diluent poured in - a beaker, distinct from the droplet of volume.
    beaker: '<path d="M6 3h12M9 3v6.5L4.6 17A2.4 2.4 0 006.7 21h10.6a2.4 2.4 0 002.1-4L15 9.5V3"/><path d="M6.5 15h11"/>',
    // How much is left in the vial.
    level: '<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M6 13h12"/><path d="M9 17h6"/>',
    // Back to the answer.
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>'
};

/**
 * @param {keyof P} name
 * @param {string} [cls]
 * @returns {string} SVG markup, or '' for an unknown name so a typo degrades to
 *   a bare text label rather than throwing mid-render.
 */
export function icon(name, cls = '') {
    const path = P[name];
    if (!path) return '';
    return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
        + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
