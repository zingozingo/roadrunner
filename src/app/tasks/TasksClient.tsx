"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/layout/EmptyState";
import FilterBar from "@/components/layout/FilterBar";
import { NoteTask } from "@/lib/types";

type TaskWithContext = NoteTask & { partner_name: string | null; note_title: string | null };

const OWNER_FILTER_OPTIONS = [
  { label: "Me", value: "me" },
  { label: "Partner", value: "partner" },
  { label: "AWS Internal", value: "aws_internal" },
];

interface TasksClientProps {
  tasks: TaskWithContext[];
}

export default function TasksClient({ tasks }: TasksClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = task.description.toLowerCase().includes(q);
        const matchesPartner = task.partner_name?.toLowerCase().includes(q);
        const matchesOwner = task.owner_name?.toLowerCase().includes(q);
        const matchesNote = task.note_title?.toLowerCase().includes(q);
        if (!matchesDesc && !matchesPartner && !matchesOwner && !matchesNote) return false;
      }
      if (activeFilter && task.owner !== activeFilter) return false;
      return true;
    });
  }, [tasks, searchQuery, activeFilter]);

  const partnerGroups = useMemo(() => {
    const groupMap = new Map<string, TaskWithContext[]>();

    for (const task of filteredTasks) {
      const key = task.partner_name ?? "Unassigned";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(task);
    }

    // Sort groups alphabetically, Unassigned last
    const entries = [...groupMap.entries()].sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    // Within each group: due_date tasks first (ascending), then no due_date
    for (const [, groupTasks] of entries) {
      groupTasks.sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return 0;
      });
    }

    return entries;
  }, [filteredTasks]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} open task${tasks.length !== 1 ? "s" : ""}`}
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No open tasks"
          description="Tasks will appear here as they are created from meeting notes"
        />
      ) : (
        <>
          <FilterBar
            searchPlaceholder="Search tasks..."
            filterOptions={OWNER_FILTER_OPTIONS}
            activeFilter={activeFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setActiveFilter}
            resultCount={filteredTasks.length}
            totalCount={tasks.length}
            entityName="tasks"
          />

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="No matching tasks"
              description="Try adjusting your search or filters"
            />
          ) : (
            <div className="space-y-8">
              {partnerGroups.map(([partnerName, groupTasks]) => (
                <section key={partnerName}>
                  <h2 className="mb-4 text-lg font-semibold text-foreground">
                    {partnerName}
                    <span className="ml-2 text-sm font-normal text-muted">
                      ({groupTasks.length})
                    </span>
                  </h2>
                  {groupTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/notes/${task.meeting_note_id}`}
                      className="flex items-baseline gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {task.description}
                      </span>
                      {task.due_date && (
                        <span className="shrink-0 text-xs text-muted">
                          {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        task.owner === "me" ? "bg-accent/10 text-accent" :
                        task.owner === "partner" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-amber-500/10 text-amber-400"
                      }`}>
                        {task.owner === "me" ? "Me" : task.owner === "partner" ? "Partner" : "AWS"}
                      </span>
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
