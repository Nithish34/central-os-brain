import React from 'react';
import { UserProfile } from '../../types';
import { SettingsLayout } from '../settings/SettingsLayout';

interface SettingsViewProps {
  currentUser?: UserProfile | null;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onSignOut?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateProfile,
  onSignOut,
}) => {
  return (
    <SettingsLayout
      currentUser={currentUser}
      onUpdateProfile={onUpdateProfile}
      onSignOut={onSignOut}
    />
  );
};
