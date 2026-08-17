'use client';

import { FileText, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Per-session instructions prepended to each question. Kept as a bordered slab
 * at the top of the thread rather than a floating card, so it reads as part of
 * the conversation's setup rather than as a notification.
 */
export function CustomContext({
  value,
  onChange,
  editing,
  onEdit,
  onSave,
  onCancel,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  return (
    <div className="neo mb-4 rounded-card bg-pastel-chat p-4">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-on-pastel" />
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-on-pastel">
          Custom context
        </h3>

        <div className="ml-auto flex gap-1.5">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={onSave} aria-label="Save context">
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} aria-label="Cancel editing">
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onEdit} aria-label="Edit context">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              {value && (
                <Button size="sm" variant="outline" onClick={onClear} aria-label="Clear context">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Add instructions or project details the assistant should always know…"
          className="neo min-h-[80px] w-full rounded-chip bg-surface p-2.5 text-sm text-ink placeholder:text-ink-subtle"
        />
      ) : value ? (
        <p className="whitespace-pre-wrap text-sm text-on-pastel">{value}</p>
      ) : (
        <p className="text-sm italic text-on-pastel opacity-70">
          Add custom context to help the assistant understand your project.
        </p>
      )}
    </div>
  );
}
