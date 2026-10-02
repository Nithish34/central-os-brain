import React, { useState } from 'react';
import {
  User,
  Shield,
  Sliders,
  Bell,
  CreditCard,
  Users,
  LogOut,
  Settings as SettingsIcon,
  LucideIcon,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { ProfileSettingsTab } from './ProfileSettingsTab';
import { SecuritySettingsTab } from './SecuritySettingsTab';
import { NotificationsSettingsTab } from './NotificationsSettingsTab';
import { PreferencesSettingsTab } from './PreferencesSettingsTab';
import { BillingSettingsTab } from './BillingSettingsTab';
import { MembersSettingsTab } from './MembersSettingsTab';
import './Settings.css';

export type SettingsTabId =
  | 'profile'
  | 'security'
  | 'preferences'
  | 'notifications'
  | 'billing'
  | 'members';

interface NavItem {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

interface SettingsLayoutProps {
  currentUser?: UserProfile | null;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
  onSignOut?: () => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  currentUser,
  onUpdateProfile,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');

  const navGroups: NavGroup[] = [
    {
      groupTitle: 'Account',
      items: [
        { id: 'profile', label: 'Profile Settings', icon: User },
        { id: 'security', label: 'Security & Access', icon: Shield },
      ],
    },
    {
      groupTitle: 'Application',
      items: [
        { id: 'preferences', label: 'Preferences', icon: Sliders },
        { id: 'notifications', label: 'Notifications', icon: Bell },
      ],
    },
    {
      groupTitle: 'Organization',
      items: [
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'members', label: 'Members & Roles', icon: Users },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap((g) => g.items);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <ProfileSettingsTab
            currentUser={currentUser}
            onUpdateProfile={onUpdateProfile}
          />
        );
      case 'security':
        return <SecuritySettingsTab />;
      case 'preferences':
        return <PreferencesSettingsTab />;
      case 'notifications':
        return <NotificationsSettingsTab />;
      case 'billing':
        return <BillingSettingsTab />;
      case 'members':
        return <MembersSettingsTab />;
      default:
        return <ProfileSettingsTab currentUser={currentUser} onUpdateProfile={onUpdateProfile} />;
    }
  };

  const handleSignOutClick = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      localStorage.removeItem('cb_token');
      window.location.hash = '#auth';
      window.location.reload();
    }
  };

  return (
    <div className="settings-page-wrapper">
      {/* ── Top Header ── */}
      <header className="settings-header">
        <div className="settings-header-inner">
          <span className="settings-eyebrow">
            <SettingsIcon size={14} />
            Application Configuration &amp; Governance
          </span>
          <h1 className="settings-title">Workspace Settings</h1>
          <p className="settings-subtitle">
            Manage your personal profile, security credentials, notification channels, and team preferences.
          </p>
        </div>
      </header>

      {/* ── Two-Column Container ── */}
      <div className="settings-container">
        {/* ── Mobile Horizontal Pill Navigation ── */}
        <nav className="settings-mobile-nav" aria-label="Mobile Settings Tabs">
          <div className="settings-mobile-tabs-pill-list" role="tablist">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`tab-mobile-${item.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${item.id}`}
                  className={`settings-mobile-pill ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Desktop Left Sidebar (~260px) ── */}
        <aside className="settings-sidebar" aria-label="Settings Categories">
          <div className="settings-nav-groups" role="tablist" aria-orientation="vertical">
            {navGroups.map((group) => (
              <div key={group.groupTitle} className="settings-nav-group">
                <div className="settings-nav-group-title">{group.groupTitle}</div>
                <ul className="settings-nav-list">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="tab"
                          id={`tab-${item.id}`}
                          aria-selected={isActive}
                          aria-controls={`panel-${item.id}`}
                          className={`settings-nav-item-btn ${isActive ? 'is-active' : ''}`}
                          onClick={() => setActiveTab(item.id)}
                        >
                          <span className="settings-nav-icon">
                            <Icon size={16} />
                          </span>
                          <span>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* ── Sidebar Bottom: Sign Out ── */}
          <div className="settings-sidebar-bottom">
            <button
              type="button"
              className="settings-signout-btn"
              onClick={handleSignOutClick}
              aria-label="Sign out of current account"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Main Form Area (Max-Width 640px) ── */}
        <main className="settings-main">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};
