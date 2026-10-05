// Merge individual preferences: never erase pack selections or voice settings.
export function readDeviceSettings(): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem("huella-settings") || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function updateDeviceSettings(patch: Record<string, unknown>): boolean {
  try {
    localStorage.setItem("huella-settings", JSON.stringify({ ...readDeviceSettings(), ...patch }));
    return true;
  } catch { return false; }
}
