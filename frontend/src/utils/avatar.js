const AVATAR_COLORS = ['#5b6cf9', '#eb459e', '#3ba55d', '#faa61a', '#ed4245', '#00a8fc'];

export function colorForName(name = '') {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export function initialsForName(name = '') {
  return name.slice(0, 2).toUpperCase();
}
