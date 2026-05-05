export const parseCorsOrigins = (
  origins: string | string[] | "*",
): true | string[] => {
  if (origins === "*") {
    return true;
  }

  if (Array.isArray(origins)) {
    return origins.map((origin) => origin.trim()).filter(Boolean);
  }

  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};
