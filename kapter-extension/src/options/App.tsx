import { useEffect, useState } from "react";
import { getStorage, setStorage } from "@/shared/lib/storage";
import type { StorageSchema } from "@/shared/lib/storage";

type Settings = StorageSchema["settings"];

const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  enabled: true,
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStorage("settings").then((stored) => {
      if (stored) setSettings(stored);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await setStorage("settings", settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleChange = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading)
    return <div className="p-8 text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Configure your extension preferences.
      </p>

      <div className="flex flex-col gap-6">
        {/* Theme */}
        <section className="border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Appearance
          </h2>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-800">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) =>
                handleChange("theme", e.target.value as Settings["theme"])
              }
              className="w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </section>

        {/* Behavior */}
        <section className="border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Behavior
          </h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleChange("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-800">
              Enable extension by default on all pages
            </span>
          </label>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Save changes
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium animate-fade-in">
              ✓ Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
