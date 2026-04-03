"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RecurrenceEditor from "./RecurrenceEditor";

interface MakeRecurringButtonProps {
  meetingId: string;
  meetingDate: string | null;
}

/**
 * Simple button that opens RecurrenceEditor modal for standalone (non-recurring) meetings.
 */
export default function MakeRecurringButton({ meetingId, meetingDate }: MakeRecurringButtonProps) {
  const router = useRouter();
  const [showEditor, setShowEditor] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowEditor(true)}
        className="text-sm text-muted hover:text-accent transition-colors"
      >
        Make recurring
      </button>

      {showEditor && (
        <RecurrenceEditor
          meetingId={meetingId}
          meetingDate={meetingDate}
          initialPattern={null}
          initialEnd={null}
          initialSeriesId={null}
          initialAnchorDay={null}
          onSave={() => { setShowEditor(false); router.refresh(); }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
}
