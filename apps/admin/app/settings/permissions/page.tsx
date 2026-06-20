import {
  SettingsPermissionsPage,
  SettingsRoute
} from "../_components/settings-sections";

export default function PermissionsSettingsPage() {
  return (
    <SettingsRoute>
      <SettingsPermissionsPage />
    </SettingsRoute>
  );
}
