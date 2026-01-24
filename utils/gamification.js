export const calculateStreakMultiplier = (streak) => {
    if (streak <= 7) return 1.0;

    // Formula: 1.0 + (StreakDays - 7) * 0.05
    const bonus = (streak - 7) * 0.05;
    const multiplier = 1.0 + bonus;

    // Cap at 3.0x
    return Math.min(3.0, multiplier).toFixed(2); // String with 2 decimals
};

export const getMultiplierMessage = (streak) => {
    const mult = calculateStreakMultiplier(streak);
    if (parseFloat(mult) <= 1.0) return null;
    return `${mult}x Bonus!`;
};
