import React, { useState } from 'react';
import { UserPlus, Search, UserX, Shield, X, Mail } from 'lucide-react';
import { SettingsFormFooter } from './SettingsFormFooter';
import { useToast } from '../ui/ToastContainer';

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Member' | 'Auditor';
  avatar: string;
  avatarBg: string;
  status: 'Active' | 'Invited';
}

export const MembersSettingsTab: React.FC = () => {
  const { showToast } = useToast();

  const initialMembers: MemberItem[] = [
    {
      id: 'usr-1',
      name: 'David Chen',
      email: 'admin@companybrain.local',
      role: 'Admin',
      avatar: 'DC',
      avatarBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      status: 'Active',
    },
    {
      id: 'usr-2',
      name: 'Sarah Jenkins',
      email: 'sarah.j@enterprise.com',
      role: 'Manager',
      avatar: 'SJ',
      avatarBg: 'linear-gradient(135deg, #10b981, #059669)',
      status: 'Active',
    },
    {
      id: 'usr-3',
      name: 'Elena Rostova',
      email: 'elena.r@enterprise.com',
      role: 'Manager',
      avatar: 'ER',
      avatarBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
      status: 'Active',
    },
    {
      id: 'usr-4',
      name: 'Marcus Vance',
      email: 'marcus.v@enterprise.com',
      role: 'Auditor',
      avatar: 'MV',
      avatarBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      status: 'Active',
    },
    {
      id: 'usr-5',
      name: 'Alex Rivera',
      email: 'alex.r@enterprise.com',
      role: 'Member',
      avatar: 'AR',
      avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      status: 'Active',
    },
  ];

  const [members, setMembers] = useState<MemberItem[]>(initialMembers);
  const [savedMembers, setSavedMembers] = useState<MemberItem[]>(initialMembers);
  const [searchFilter, setSearchFilter] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Manager' | 'Member' | 'Auditor'>('Member');
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(members) !== JSON.stringify(savedMembers);

  const handleRoleChange = (id: string, newRole: MemberItem['role']) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
    );
  };

  const handleRemoveMember = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from this organization?`)) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      showToast(`${name} removed from organization`, 'info');
    }
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newMember: MemberItem = {
      id: `usr-${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      avatar: inviteEmail.slice(0, 2).toUpperCase(),
      avatarBg: 'linear-gradient(135deg, #64748b, #475569)',
      status: 'Invited',
    };

    setMembers((prev) => [newMember, ...prev]);
    setIsInviteOpen(false);
    setInviteEmail('');
    showToast(`✉️ Invitation link sent to ${inviteEmail}`, 'success');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((res) => setTimeout(res, 500));
      setSavedMembers(members);
      showToast('Team member role changes saved!', 'success');
    } catch {
      showToast('Failed to save team member roles.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setMembers(savedMembers);
    showToast('Member changes discarded', 'info');
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.email.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="settings-panel" role="tabpanel" id="panel-members" aria-labelledby="tab-members">
      <div>
        <div className="settings-section-head">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 className="settings-section-title">Organization Members</h2>
              <p className="settings-section-desc">
                Invite teammates and govern role-based access permissions.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary-save"
              style={{ fontSize: '0.8125rem', padding: '0.45rem 0.85rem' }}
              onClick={() => setIsInviteOpen(true)}
            >
              <UserPlus size={15} />
              <span>Invite Member</span>
            </button>
          </div>
        </div>

        {/* ── Search Bar ── */}
        <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="settings-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search by name or email…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        {/* ── Members List ── */}
        <div className="members-list">
          {filteredMembers.map((member) => (
            <div key={member.id} className="member-row">
              <div className="member-info-col">
                <div className="member-avatar-pill" style={{ background: member.avatarBg }}>
                  {member.avatar}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#ffffff' }}>{member.name}</strong>
                    {member.status === 'Invited' && (
                      <span className="badge warning" style={{ fontSize: '9px', padding: '1px 5px' }}>
                        Pending
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{member.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select
                  className="settings-select"
                  style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.id, e.target.value as MemberItem['role'])}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Member">Member</option>
                  <option value="Auditor">Auditor</option>
                </select>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ color: '#ef4444', padding: '0.35rem 0.5rem' }}
                  onClick={() => handleRemoveMember(member.id, member.name)}
                  aria-label={`Remove ${member.name}`}
                >
                  <UserX size={14} />
                </button>
              </div>
            </div>
          ))}

          {filteredMembers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              No members found matching "{searchFilter}".
            </div>
          )}
        </div>
      </div>

      <SettingsFormFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {/* ── Invite Member Modal ── */}
      {isInviteOpen && (
        <div className="settings-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-invite-title">
          <div className="settings-modal-card">
            <div className="settings-modal-head">
              <h3 id="modal-invite-title" className="settings-modal-title">
                Invite Team Member
              </h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setIsInviteOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendInvite}>
              <div className="settings-form-group">
                <label className="settings-label" htmlFor="invite-email-input">
                  Email Address
                </label>
                <input
                  id="invite-email-input"
                  type="email"
                  className="settings-input"
                  placeholder="colleague@enterprise.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="settings-form-group">
                <label className="settings-label" htmlFor="invite-role-select">
                  Role Permission Level
                </label>
                <select
                  id="invite-role-select"
                  className="settings-select"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MemberItem['role'])}
                >
                  <option value="Admin">Admin (Full Access &amp; Workspace Management)</option>
                  <option value="Manager">Manager (Domain Lead &amp; Spec Approvals)</option>
                  <option value="Member">Member (Standard Workspace Contributor)</option>
                  <option value="Auditor">Auditor (Read-Only Compliance Logs)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsInviteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-save"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
