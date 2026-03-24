"use client";

import { useState } from "react";
import Link from "next/link";
import SlideOverPanel from "@/components/shared/SlideOverPanel";
import ContactGroup from "@/components/shared/ContactGroup";

interface PartnerReferencePanelProps {
  partner: {
    what_they_do: string | null;
    aws_stickiness: string | null;
    key_aws_services: string[];
    architecture: string | null;
    listing_types: string[] | null;
    pricing_model: string[] | null;
    isva_status: string | null;
    deployed_on_aws: string | null;
    prm_status: string | null;
    crm_status: string | null;
  };
  contacts: Array<{ name: string | null; email: string; title: string | null; role: string | null; org_type: string | null }>;
  currentUserEmail: string;
  relationships: Array<{ id: string; name: string; leadName: string | null }>;
}

export default function PartnerReferencePanel({
  partner,
  contacts,
  currentUserEmail,
  relationships,
}: PartnerReferencePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  function openTab(tabId: string) {
    setActiveTab(tabId);
    setIsOpen(true);
  }

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      content: (
        <div className="space-y-6">
          {/* Solution Profile */}
          {(partner.what_they_do || partner.aws_stickiness || partner.key_aws_services.length > 0) && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Solution profile</h2>
              {partner.what_they_do && (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {partner.what_they_do}
                </p>
              )}
              {(partner.aws_stickiness || partner.key_aws_services.length > 0) && (
                <div className={partner.what_they_do ? "mt-4" : ""}>
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-accent mb-1.5">AWS Stickiness</span>
                  {partner.aws_stickiness && (
                    <p className="text-xs text-muted leading-relaxed whitespace-pre-wrap mb-2">
                      {partner.aws_stickiness}
                    </p>
                  )}
                  {partner.key_aws_services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {partner.key_aws_services.map((svc) => (
                        <span key={svc} className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {svc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Deployment & Pricing */}
          {(partner.architecture || partner.listing_types?.length || partner.pricing_model?.length) && (
            <section className="pt-6 border-t border-border/20">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Deployment & pricing</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {partner.architecture && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Architecture</span>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                      {partner.architecture}
                    </span>
                  </div>
                )}
                {partner.listing_types && partner.listing_types.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Listing Types</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.listing_types.map((t) => (
                        <span key={t} className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {partner.pricing_model && partner.pricing_model.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Pricing</span>
                    <div className="flex flex-wrap gap-1">
                      {partner.pricing_model.map((m) => (
                        <span key={m} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      ),
    },
    {
      id: "status",
      label: "Status",
      content: (
        <div className="space-y-6">
          {/* Operational Status */}
          {/* Ring 3 future: program enrollments, funding wallets, goal progress */}
          {(partner.isva_status || partner.deployed_on_aws || partner.prm_status || partner.crm_status) && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Operational status</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {partner.isva_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">ISVa</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.isva_status === "Approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {partner.isva_status}
                    </span>
                  </div>
                )}
                {partner.deployed_on_aws && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">Deployed on AWS</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      partner.deployed_on_aws === "Approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"
                    }`}>
                      {partner.deployed_on_aws}
                    </span>
                  </div>
                )}
                {partner.prm_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">PRM</span>
                    <span className="text-sm text-foreground">{partner.prm_status}</span>
                  </div>
                )}
                {partner.crm_status && (
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted/50 mb-1">CRM</span>
                    <span className="text-sm text-foreground">{partner.crm_status}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Relationships */}
          <section className="pt-6 border-t border-border/20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Relationships</h2>
            {relationships.length > 0 ? (
              <div className="space-y-1">
                {relationships.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/relationships/${rel.id}`}
                    className="flex items-baseline gap-2 py-1 transition-colors hover:text-accent"
                  >
                    <span className="text-sm font-medium text-foreground">{rel.name}</span>
                    {rel.leadName && <span className="text-xs text-muted">{rel.leadName}</span>}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-muted">No linked relationships</p>
            )}
          </section>
        </div>
      ),
    },
    {
      id: "people",
      label: "People",
      content: (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">People</h2>
          {contacts.length > 0 ? (
            <ContactGroup contacts={contacts} currentUserEmail={currentUserEmail} />
          ) : (
            <p className="text-sm italic text-muted">No contacts in registry</p>
          )}
        </section>
      ),
    },
  ];

  const tabButtons = ["profile", "status", "people"] as const;
  const tabLabels: Record<string, string> = { profile: "Profile", status: "Status", people: "People" };

  return (
    <>
      {/* Tab trigger buttons — rendered inline in the identity bar */}
      <div className="flex items-center gap-1.5">
        {tabButtons.map((tabId) => (
          <button
            key={tabId}
            onClick={() => openTab(tabId)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              isOpen && activeTab === tabId
                ? "border-accent/50 text-accent bg-accent/5"
                : "border-border/30 text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {tabLabels[tabId]}
          </button>
        ))}
      </div>

      {/* Slide-over panel */}
      <SlideOverPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </>
  );
}
