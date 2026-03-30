export const dynamic = "force-dynamic";

import { getPartners } from "@/lib/db";
import PeopleClient from "./PeopleClient";

export default async function PeoplePage() {
  const partners = await getPartners();
  const partnerOptions = partners.map((p) => ({ id: p.id, name: p.name }));

  return <PeopleClient partners={partnerOptions} />;
}
