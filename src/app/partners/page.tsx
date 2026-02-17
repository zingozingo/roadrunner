export const dynamic = "force-dynamic";

import { getPartners } from "@/lib/supabase";
import PartnersClient from "./PartnersClient";

export default async function PartnersPage() {
  const partners = await getPartners();
  return <PartnersClient partners={partners} />;
}
