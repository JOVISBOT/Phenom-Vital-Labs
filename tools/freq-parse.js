/**
 * Cadence parsers, shared by the verifier and the migration that writes ranges.
 *
 * Kept out of verify-data.js because that file audits on import and exits with
 * a status code -- importing it to borrow a regex would run the whole audit.
 */

/**
 * Read a doses-per-week RANGE out of the `freq` prose.
 *
 * The first version of this matched single cadences only, so "2-3x daily" fell
 * through to the bare /daily/ arm and reported a contradiction that was not
 * there. Ranges are the interesting case, not the awkward one: nine records
 * state a range or an either/or, and every one of them stores the ceiling in
 * `f`. Returns {min, max} in doses per week, or null when the prose is not a
 * countable cadence at all.
 */
export function parseFreqRange(freq = '') {
    const s = String(freq).toLowerCase();

    // "Multiple daily", "several times a day" -- reads like a cadence and is
    // not one. Caught before the /daily/ arm, which otherwise scores it 7/wk
    // and reports a contradiction against an f that is merely a guess.
    if (/\b(multiple|several|various|as needed|as directed|intermittent|research only)\b/.test(s)) return null;

    // "Every 2-3 days" is an INTERVAL, not a count -- 2-3 days apart is
    // 2.3-3.5 doses a week, not 14-21. Must be matched before the
    // "N-M x daily" arm, which reads the same digits the opposite way round.
    let m = s.match(/every\s+(\d+)\s*(?:-|to|–)\s*(\d+)\s*days?/);
    if (m) return { min: 7 / Number(m[2]), max: 7 / Number(m[1]) };
    m = s.match(/every\s+(\d+)\s*days?/);
    if (m) return { min: 7 / Number(m[1]), max: 7 / Number(m[1]) };

    // "2-3x daily", "1-3x daily", "2 to 3 times a day"
    m = s.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:x|times)?\s*(?:a\s+)?(daily|day|week)/);
    if (m) {
        const per = m[3].startsWith('day') || m[3] === 'daily' ? 7 : 1;
        return { min: Number(m[1]) * per, max: Number(m[2]) * per };
    }

    // "Daily or 3x weekly" / "3x weekly or daily" -- an either/or, not a ladder
    if (/\bdaily\b/.test(s) && /\bor\b/.test(s)) {
        const alt = s.match(/(\d+)\s*(?:x|times)?\s*(?:a\s+)?week/);
        if (alt) return { min: Number(alt[1]), max: 7 };
    }

    const single = [
        [/\bthree times\s+(?:daily|a day)|\b3x\s*(?:\/|per\s*)?\s*(?:a\s+)?day/, 21],
        [/\btwice\s+(?:daily|a day)|\b2x\s*(?:\/|per\s*)?\s*(?:a\s+)?day|\bbid\b/, 14],
        [/\bevery other day\b|\beod\b/, 3.5],
        [/\bdaily\b|\bevery day\b|\bonce a day\b/, 7],
        [/\b5\s*(?:x|days|times)\s*(?:\/|per\s*)?\s*week/, 5],
        [/\b(?:3|three)\s*(?:x|times|days)\s*(?:\/|per\s*)?\s*week/, 3],
        [/\b(?:2|twice|two)\s*(?:x|times)?\s*(?:\/|per\s*)?\s*week/, 2],
        [/\b(?:once|1x)?\s*(?:\/|per\s*)?\s*week(?:ly)?\b/, 1]
    ];
    for (const [re, f] of single) if (re.test(s)) return { min: f, max: f };
    return null;
}

/**
 * Read a weeks-on RANGE out of the `cycle` prose.
 *
 * "8-12 on, 4 off" -> {min:8,max:12}. Returns null when the prose names no
 * duration at all ("Continuous OK", "As needed") -- those records still carry a
 * `wks`, but it is an assumption rather than something the record states, and
 * the three that came from ranges had each collapsed a different way: ace031
 * took the midpoint of 4-8, dihexa the ceiling of 4-6, hmg near the floor of
 * 3-6. A point estimate picked three different ways is not a convention.
 */
export function parseCycleWeeks(cycle = '') {
    const s = String(cycle).toLowerCase();
    if (/\bday/.test(s)) return null;          // day-stated courses use dosesPerCycle
    if (/\bmonths?\b/.test(s)) return null;    // "6 months minimum" is not a week count

    // "8-12 on, 4 off" and "4-8 weeks" -- the trailing "off" period is a break,
    // never part of the dosing window, so only the leading figure is read.
    let m = s.match(/^(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:weeks?|wks?)?\s*(?:on\b|$)/);
    if (m) return { min: Number(m[1]), max: Number(m[2]) };
    m = s.match(/^(\d+)\s*(?:weeks?|wks?)?\s*(?:on\b|max\b|$)/) || s.match(/^(\d+)\s*(?:weeks?|wks?)\b/);
    if (m) return { min: Number(m[1]), max: Number(m[1]) };
    return null;
}
