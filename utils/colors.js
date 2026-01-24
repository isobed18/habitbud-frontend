const pastelColors = [
    { bg: '#dcfce7', icon: '#22c55e', text: '#14532d' }, // Green
    { bg: '#fef9c3', icon: '#eab308', text: '#713f12' }, // Yellow
    { bg: '#f3e8ff', icon: '#a855f7', text: '#581c87' }, // Purple
    { bg: '#ffedd5', icon: '#f97316', text: '#7c2d12' }, // Orange
    { bg: '#fce7f3', icon: '#ec4899', text: '#831843' }, // Pink
    { bg: '#dbeafe', icon: '#3b82f6', text: '#1e3a8a' }, // Blue
];

const colorMap = {
    'green': 0,
    'yellow': 1,
    'purple': 2,
    'orange': 3,
    'pink': 4,
    'blue': 5
};

export const getHabitColor = (keyOrIndex) => {
    let index = 0;
    if (typeof keyOrIndex === 'string') {
        index = colorMap[keyOrIndex.toLowerCase()] || 0;
    } else if (typeof keyOrIndex === 'number') {
        index = Math.abs(keyOrIndex);
    }
    return pastelColors[index % pastelColors.length] || pastelColors[0];
};

export const THEME = {
    primary: '#eab308', // Orange/Yellow accent from image
    background: '#ffffff',
    text: '#1f2937',
    secondaryText: '#6b7280',
};
