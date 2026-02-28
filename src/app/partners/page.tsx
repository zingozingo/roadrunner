export const dynamic = "force-dynamic";

import { getPartners } from "@/lib/db";
import PartnersClient from "./PartnersClient";

export default async function PartnersPage() {
  const partners = await getPartners();
  return <PartnersClient partners={partners} />;
}
