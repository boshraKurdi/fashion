export function makeUploadsAbsolute(value: unknown, baseUrl: string): unknown {
  if (typeof value === "string") {
    return value.startsWith("/uploads/") ? new URL(value, baseUrl).toString() : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => makeUploadsAbsolute(item, baseUrl));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, makeUploadsAbsolute(item, baseUrl)]),
    );
  }

  return value;
}
