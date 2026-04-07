// ── Airtable table IDs ──────────────────────────────────────
export const PROGRAMS_TABLE = "tblpnW8ibVmkWi5Dt";
export const EVENTS_TABLE = "tblPDGUSqSvn8mflJ";
export const PARTNERS_TABLE = "tbl9zC6nxfLEp8xUx";
export const ENGAGEMENTS_TABLE = "tblTC491AUVcrKvq2";
export const MEETINGS_TABLE = "tbl6LsEqSvEZgqBdW";

// ── Ring 3 table IDs ──────────────────────────────────────────
export const RING3_TABLES = {
  partnerGoals: "tblmboZKyBasfh5pV",
  partnerPrograms: "tbl1CPtbVzQvRN8LA",
  partnerEvents: "tblYljQDnXwjTDy2T",
  mpoppFunding: "tbl2ilHOaXYsgxqFY",
  mdfFunding: "tblRSsochM23QGQpS",
} as const;

// ── Airtable field IDs ──────────────────────────────────────

export const PF = {
  name: "fldlJgX0tVWwA516E",
  category: "fldB1x5c1mKfnI4wc",
  subtype: "fldHUaRMCXF2GbwJX",
  mdfValue: "fldKcSAyeQnFFqKeJ",
  scaStackable: "fldXOzJka0JaD3g6G",
  partnerPath: "fldRmJcmF5xgrwppo",
  parentProgram: "fldI4mLHW39Abk2c4",
  description: "fldHN5mCWH6lXmoY1",
  requirements: "fldxxsFFMc649nZft",
  whatItUnlocks: "fld4870bblJTGbAgn",
  notes: "fldzsmhcQ0Z6Rnjhk",
  lifecycle: "fldo04XmU7rQhwOVT",
  lifecycleDuration: "fldeExdR8irrzC5GV",
} as const;

export const EF = {
  name: "fld1hURggkL0DTHnC",
  date: "fld62hHfwpOJw7nyZ",
  endDate: "fldTUy6jHj4KpR6SZ",
  location: "fldwjmRq0saFpFHao",
  format: "fldpuxeQ5DRhMwizr",
  host: "fldaDlidcRmUCvxFK",
  description: "fldTMiRJ7mqMzGqXY",
  geo: "fld9idvQawFVNu5sa",
  sponsorOption: "fldyAVpfZbG1SaDJz",
  partnerDayDate: "fldo8mDJ5vvXK5bu7",
  eventUrl: "fld1i1Man1gLytyHo",
  internalLinks: "fldEqolJfYdvh6nBN",
  archived: "flddY9M5bISisWwRb",
} as const;

export const PTRF = {
  name: "fldlE5L12oES6IQSO",
  segment: "fldSoIAhWfmPgHzuc",
  focusArea: "fldeW5BvDgSp1bLNX",
  allianceLead: "fldLbBuiYhisMSqJu",
  psa: "fldp175r0XAz4Cwbj",
  accountManager: "fldLzr6Rn9hpciP70",
  pmm: "fldgGnuwXCM7EWOVq",
  contacts: "fldwnagXCUQ0QIHDg",
  awsStickiness: "fldlCzNjHA3Ziuqtv",
  keyAwsServices: "fldQwm8UtaNxAa9dI",
  whatTheyDo: "fldnoDB2la8oLgrqR",
  architecture: "fldjzkMqOVIaProi2",
  listingTypes: "fldV5OAuGxca1hDW8",
  pricingModel: "fldkStAdCBT16HJPS",
  isvaStatus: "fldHYucRg9ZIJ6PWI",
  deployedOnAws: "fldNtBO1Wlh9mOL0c",
  prmStatus: "fldDV1UhZjAuR1Xxl",
  crmPlatform: "fldkeO2nFpHoQIrLw",
  crmNotes: "fldyCmV4tyza0DNN8",
  crmContact: "fldq6edTVHpkupPVx",
  awsContacts: "fldlVCqjgWbXtd6ev",
  thirdPartyContacts: "fldWxSyo2pMcoXcpL",
  mpTcvGoal: "fldwOBjfqMJVz5KB0",
  larrGoal: "fldrKEYguCUVk3eAo",
  jointValueProposition: "fldxiGwoIWPDtAk7z",
  mpTcvYtd: "fldPjzGNolAHbLrlE",
  larrYtd: "fld9I88K1ijili8Af",
  mpTcv2024: "fld6BOKL7CmXdmR2D",
  larr2024: "fldjI3nMg5ich9DKL",
  mpTcv2025: "fldM1iuzmDdLT3axX",
  larr2025: "fld1uD9SHVZvnU5wR",
  mpTcvTarget2025: "fld5C6rHOzZVu6MXw",
  mpTcvProjectedAnnual: "fldQwP5RFGW3fhuAb",
  larrProjectedAnnual: "fldlw3f03ebKd5Jpf",
} as const;

export const ENF = {
  name: "fldxq7bsx8PuRvodp",
  pillar: "fldvxfxhOPDGr5jBA",
  status: "fldUAOu4GG1Wme5OJ",
  notes: "flduVQ9wp3XXVUiwo",
  roadrunnerId: "fldJJ8ZlwhePawiEl",
  partner: "fldkYNE9C0UcdnGCL",
  program: "fldZ4IqdSvuEXgp83",
  awsRelationships: "fldhVQTAP2wucnzNC",
  event: "fldscmkRoT65oa6Oy",
  awsStakeholders: "fldLVPbg7iyz0Nli9",
  partnerStakeholders: "fldj6vaWwDKJy6aci",
  thirdParties: "flduajBotnT6x5ZXD",
  topic: "fldDRMrtkVHOdDYVy",
} as const;

export const MF = {
  meetingName: "fldcbatIDunJ00dLp",
  status: "fldpXlLugkUgQsjcr",
  meetingDate: "fldx9ZrIMundEMUko",
  awsStakeholders: "fldOVCmwhiisY8bDo",
  partnerStakeholders: "fldJira79g9xWNTte",
  thirdParties: "fldhU8nE7uGE1agML",
  engagement: "fld2TczwxJXZLUwpW",
  startTime: "fldifWilEYICfifXz",
  endTime: "fldV78rQbzDhVK9NO",
  location: "fldTyiMYT48aCHttx",
  source: "fld2RW78vS1T91bab",
  roadrunnerId: "fldLveS95zGGVU4j1",
  icsUid: "fldNb83l5XLtz8J9k",
  meetingType: "fldGWa1MFoqoc89qC",
  notes: "fldzGUipu36EA9rax",
} as const;

// ── Ring 3 field IDs ────────────────────────────────────────

export const PARTNER_GOALS_FIELDS = {
  goal: "fldRBFWDIWthlAVcE",
  partner: "fldrxWrawLH3HbpcR",
  category: "fld4j48oV32q9iE83",
  year: "fldTR0rPelRFJ2agz",
  targetDate: "fldqwZ8lPVMouy2t3",
  status: "fldJNIlsAIsiVW8Uv",
  linkedProgram: "fld0B5PPg49c0m5CI",
  notes: "fld7kF9CQDxh5uIyM",
} as const;

export const PARTNER_PROGRAMS_FIELDS = {
  programId: "fldmaD6ZTY7XvXkjw",   // text shorthand (legacy)
  program: "flduk1vdlcOFmAnaa",      // linked record → Programs table
  partner: "fldXXpf6zyDLLAKOz",
  status: "flddDihdNtRaLgYqn",
  dateAchieved: "fldJNF6KO3Osq2AWg",
  notes: "fldqpulJjUKcro1xM",
} as const;

export const PARTNER_EVENTS_FIELDS = {
  partner: "fldFA6221VhsyXG1v",
  events: "fldIsEwvRqaszKMCh",
  status: "fldWjFeK3yyLo4N5U",
  notes: "fldQHj66TZ81TSaMc",
  sponsoring: "fldv8PMohQmCWIAu4",
} as const;

export const MPOPP_FIELDS = {
  partner: "fldc3HBSHS2Di8XLd",
  status: "fldoNQTpGZMd5Sfkx",
  half: "fld2TO49NsfmAwuZ2",
  track: "fldIbH2P4N7L3abAB",
  allocated: "fldTTVjneQKD2yrX0",
  spent: "fldll9GvapXWdsYvs",
  notes: "fldMo9eIV9KEGRdkE",
} as const;

export const MDF_FIELDS = {
  recordName: "fldz2AadUnmO0Ynoa",
  partners: "fld1L71zH44Z4Wrbx",
  allocated: "fldISPaiE4oJkekwb",
  utilized: "fldaF5qh9pcdDuS9g",
  dateAllocated: "flddUPAjoPAI3dENU",
  notes: "fldmypPKmpusuNOwA",
  source: "fld8Itb42n6GqCXRE",
  recurrence: "fldpxpkBoOGoLfcAa",
} as const;

// ── Meeting type display names (snake_case → Airtable display) ──
export const MEETING_TYPE_DISPLAY: Record<string, string> = {
  partner_cadence: "Partner Cadence",
  sca_review: "SCA Review",
  qbr: "QBR",
  executive: "Executive",
  event: "Event",
  internal: "Internal",
  support: "Support",
  demo: "Demo",
  enablement: "Enablement",
  ad_hoc: "Ad Hoc",
};

// ── Notes constants ─────────────────────────────────────────
export const NOTES_MARKER = "=== Roadrunner Activity Summary ===";
export const NOTES_FOOTER = "(Auto-synced from Roadrunner)";
