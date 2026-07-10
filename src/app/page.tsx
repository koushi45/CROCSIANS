import { CrocsiansGame } from "@/features/crocsians/CrocsiansGame";
import { requireUser } from "@/server/auth/session";

export default async function Home() {
  await requireUser();
  return <CrocsiansGame />;
}
