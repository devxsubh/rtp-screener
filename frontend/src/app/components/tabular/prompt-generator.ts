const PROMPT_PRESETS: Array<{
    matches: RegExp;
    prompt: (title: string) => string;
}> = [
    {
        matches: /\bentit(y|ies)\b|\bshareholder\b|\bowner\b/i,
        prompt: () =>
            "State the full legal name of this entity exactly as it appears in the cap table or entity roster.",
    },
    {
        matches: /\bsanctions match\b|\blist match\b/i,
        prompt: () =>
            "What is the closest sanctions list match for this entity? Include the matched name and list source, or state 'No match'.",
    },
    {
        matches: /\bownership path\b|\bownership chain\b/i,
        prompt: () =>
            "Describe the ownership chain from this entity to the portfolio company, including SPVs, offshore holdings, and trusts.",
    },
    {
        matches: /\bindirect\s*%|\beffective\s*%/i,
        prompt: () =>
            "What is the effective indirect ownership stake (%) in the portfolio company?",
    },
    {
        matches: /\brisk\b|\brisk level\b/i,
        prompt: () =>
            "Classify screening risk as Clear, Review, or Flagged. Decision support only — do not confirm a sanctions violation.",
    },
    {
        matches: /\bjurisdiction\b|\bcountry\b/i,
        prompt: () =>
            "State the country or jurisdiction of incorporation or residence, if known. If not addressed, state 'Not specified'.",
    },
    {
        matches: /\bultimate owner\b|\bubo\b|\bbeneficial owner\b/i,
        prompt: () =>
            "Is this entity the ultimate beneficial owner with no further owner above it in the ownership graph?",
    },
    {
        matches: /\bmatch score\b|\bconfidence\b/i,
        prompt: () =>
            "State the Watchman match confidence score (0–100%), or 'N/A' if no match.",
    },
];

export function getPresetTabularPrompt(title: string): string | null {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return null;

    const preset = PROMPT_PRESETS.find(({ matches }) => matches.test(trimmedTitle));
    return preset ? preset.prompt(trimmedTitle) : null;
}

export function buildFallbackTabularPrompt(title: string): string {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return "";

    return (
        `Review the screening data or document and extract the information relevant to "${trimmedTitle}". ` +
        `Provide a concise, entity-specific answer for this column. ` +
        `For sanctions-related fields, use only deterministic screening results — do not invent match scores or risk classifications. ` +
        `If the information is not available, return "Not specified".`
    );
}
