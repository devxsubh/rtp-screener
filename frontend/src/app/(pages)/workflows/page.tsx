"use client";

import { WorkflowList } from "@/app/components/workflows/WorkflowList";

export default function WorkflowsPage() {
    return (
        <div className="flex flex-col h-full min-h-0">
            <WorkflowList />
        </div>
    );
}
