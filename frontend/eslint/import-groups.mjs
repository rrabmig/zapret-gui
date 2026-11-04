// Side effects keep their relative order; styles are always the final group.
export const importGroups = [
  ["^\\u0000(?!.*\\.(?:css|scss))"],
  ["^node:"],
  ["^@?\\w"],
  ["^@lib(?:/|$)"],
  ["^@components(?:/|$)"],
  ["^@screens(?:/|$)"],
  ["^\\."],
  ["^.*\\.(?:css|scss)(?:\\u0000)?$"],
];
