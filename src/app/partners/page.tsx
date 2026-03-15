export const dynamic = "force-dynamic";

import { getPartners, getContactsByPartnerBulk } from "@/lib/db";
import PartnersClient from "./PartnersClient";

export default async function PartnersPage() {
  const partners = await getPartners();

  const partnerIds = partners.map((p) => p.id);
  const contactsMap = await getContactsByPartnerBulk(partnerIds);
  const contactsByPartner = Object.fromEntries(
    [...contactsMap.entries()].map(([id, contacts]) => [
      id,
      contacts.map((c) => ({ name: c.name, email: c.email, role: c.role, org_type: c.org_type })),
    ])
  );

  return <PartnersClient partners={partners} contactsByPartner={contactsByPartner} />;
}
