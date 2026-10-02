import React, { useState, useRef } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { UserProfile } from '../../types';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

interface ProfileSettingsTabProps {
  currentUser?: UserProfile | null;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  currentUser,
  onUpdateProfile,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial State
  const initialForm = {
    displayName: currentUser?.display_name || 'David Chen',
    email: currentUser?.email || 'admin@companybrain.local',
    bio: 'Lead System Architect & Core Maintainer for Company Brain OS. Focusing on autonomous policy governance and multi-agent systems.',
    title: currentUser?.role ? currentUser.role.toUpperCase() : 'Principal Platform Engineer',
    department: 'Core Architecture',
    timezone: 'America/New_York (UTC-04:00)',
    avatarUrl: currentUser?.avatar_url || localStorage.getItem('cb_user_avatar') || '',
  };

  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image file size must be under 2MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setForm((prev) => ({ ...prev, avatarUrl: result }));
      showToast('Profile photo updated!', 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast('Profile photo removed', 'info');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call delay
      await new Promise((res) => setTimeout(res, 600));

      setSavedForm(form);
      if (form.avatarUrl) {
        localStorage.setItem('cb_user_avatar', form.avatarUrl);
      } else {
        localStorage.removeItem('cb_user_avatar');
      }

      if (onUpdateProfile) {
        onUpdateProfile({
          display_name: form.displayName,
          email: form.email,
          avatar_url: form.avatarUrl,
        });
      }
      showToast('Profile information successfully saved!', 'success');
    } catch {
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(savedForm);
    showToast('Profile changes discarded', 'info');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="settings-panel" role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
      <div>
        <div className="settings-section-head">
          <h2 className="settings-section-title">Profile Settings</h2>
          <p className="settings-section-desc">
            Manage your public personal identity, workspace display details, and avatar.
          </p>
        </div>

        {/* ── Avatar Upload Section ── */}
        <div className="settings-avatar-wrapper">
          <div className="settings-avatar-preview-box" aria-label="Avatar preview">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt={form.displayName} className="settings-avatar-img" />
            ) : (
              <span>{getInitials(form.displayName)}</span>
            )}
          </div>

          <div className="settings-avatar-actions">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFileChange}
              accept="image/png, image/jpeg, image/webp"
              style={{ display: 'none' }}
              aria-label="Upload avatar image"
            />
            <div className="settings-avatar-btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Upload size={14} />
                  Upload Photo
                </span>
              </button>

              {form.avatarUrl && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: '#ef4444' }}
                  onClick={handleRemoveAvatar}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Trash2 size={14} />
                    Remove
                  </span>
                </button>
              )}
            </div>
            <span className="settings-avatar-help">
              Recommended: 400×400px JPG, PNG or WebP. Max 2MB.
            </span>
          </div>
        </div>

        {/* ── Profile Details Form ── */}
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="settings-form-group">
            <label className="settings-label" htmlFor="profile-fullname">
              <span>Full Name</span>
              <span className="settings-label-hint">Required</span>
            </label>
            <input
              id="profile-fullname"
              type="text"
              className="settings-input"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="e.g. David Chen"
              required
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="profile-email">
              <span>Email Address</span>
              <span className="settings-label-hint">Verified Primary</span>
            </label>
            <input
              id="profile-email"
              type="email"
              className="settings-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="e.g. david@enterprise.com"
              required
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="profile-bio">
              <span>Biography</span>
              <span className="settings-label-hint">{form.bio.length} / 250 characters</span>
            </label>
            <textarea
              id="profile-bio"
              className="settings-textarea"
              rows={3}
              maxLength={250}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Brief description about your role and expertise…"
            />
            <span className="settings-hint-text">
              Displayed in team directory and conflict resolution history.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="settings-form-group">
              <label className="settings-label" htmlFor="profile-title">
                <span>Job Title / Role</span>
              </label>
              <input
                id="profile-title"
                type="text"
                className="settings-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Principal Architect"
              />
            </div>

            <div className="settings-form-group">
              <label className="settings-label" htmlFor="profile-department">
                <span>Department</span>
              </label>
              <input
                id="profile-department"
                type="text"
                className="settings-input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Engineering"
              />
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label" htmlFor="profile-timezone">
              <span>Timezone</span>
            </label>
            <select
              id="profile-timezone"
              className="settings-select"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              <option value="America/New_York (UTC-04:00)">Eastern Time (US &amp; Canada) UTC-04:00</option>
              <option value="America/Chicago (UTC-05:00)">Central Time (US &amp; Canada) UTC-05:00</option>
              <option value="America/Los_Angeles (UTC-07:00)">Pacific Time (US &amp; Canada) UTC-07:00</option>
              <option value="Europe/London (UTC+01:00)">London (UTC+01:00)</option>
              <option value="Europe/Berlin (UTC+02:00)">Berlin, Paris (UTC+02:00)</option>
              <option value="Asia/Tokyo (UTC+09:00)">Tokyo (UTC+09:00)</option>
              <option value="Asia/Kolkata (UTC+05:30)">India Standard Time (UTC+05:30)</option>
            </select>
          </div>
        </form>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};
