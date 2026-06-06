"use client";

import { use } from "react";
import { StartupScreenerPage } from "@/app/components/startups/StartupScreenerPage";

interface Props {
    params: Promise<{ id: string }>;
}

export default function ProjectDetailPage({ params }: Props) {
    const { id } = use(params);
    return <StartupScreenerPage startupId={id} />;
}
