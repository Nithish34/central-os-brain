import React from 'react';
import { Check, RotateCcw, Loader2 } from 'lucide-react';

interface SettingsFormFooterProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveText?: string;
  cancelText?: string;
}

export const SettingsFormFooter: React.FC<SettingsFormFooterProps> = ({
  isDirty,
  isSaving,
  onSave,
  onCancel,
  saveText = 'Save Changes',
  cancelText = 'Cancel',
}) => {
  return (
    <footer className="settings-form-footer" aria-label="Form actions">
      <div className="settings-footer-status">
        {isDirty ? (
          <>
            <span className="settings-unsaved-dot" aria-hidden="true" />
            <span style={{ color: '#f59e0b', fontWeight: 500 }}>Unsaved changes</span>
          </>
        ) : (
          <>
            <span className="settings-saved-dot" aria-hidden="true" />
            <span style={{ color: '#10b981', fontWeight: 500 }}>All changes saved</span>
          </>
        )}
      </div>

      <div className="settings-footer-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={!isDirty || isSaving}
          aria-label="Discard unsaved changes"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <RotateCcw size={14} />
            {cancelText}
          </span>
        </button>

        <button
          type="button"
          className="btn-primary-save"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          aria-label="Save all form changes"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="spin-animate" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>{saveText}</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
