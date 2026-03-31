'use client';

import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';
import { SettingsNav } from '@/components/settings/settings-nav';

export function ProfileSettingsPageContent() {
  return (
    <div className="space-y-section">
      <SettingsNav />
      <ProfileSettingsForm />
    </div>
  );
}
