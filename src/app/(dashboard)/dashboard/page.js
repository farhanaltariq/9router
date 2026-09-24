import { getMachineId } from "@/shared/utils/machine";
import DashboardPageClient from "./DashboardPageClient";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return <DashboardPageClient machineId={machineId} />;
}
