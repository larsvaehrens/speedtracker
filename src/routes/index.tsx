import { createFileRoute } from "@tanstack/react-router";
import { SpeedTrackerApp } from "#/components/SpeedTrackerApp";

export const Route = createFileRoute("/")({ component: SpeedTrackerApp });
