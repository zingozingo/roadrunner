// ── Airtable table IDs ──────────────────────────────────────
export const PROGRAMS_TABLE = "tblpnW8ibVmkWi5Dt";
export const EVENTS_TABLE = "tblPDGUSqSvn8mflJ";
export const RELATIONSHIPS_TABLE = "tblqVBssFsUeAt9bj";
export const PARTNERS_TABLE = "tbl9zC6nxfLEp8xUx";
export const ENGAGEMENTS_TABLE = "tblTC491AUVcrKvq2";
export const MEETINGS_TABLE = "tbl6LsEqSvEZgqBdW";

// ── Airtable field IDs ──────────────────────────────────────

export const PF = {
  name: "fldlJgX0tVWwA516E",
  type: "fldCd7TnUOgxnWmNt",
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
  partnerDay: "fldTWZbQSEruQYdLe",
  partnerDayDate: "fldo8mDJ5vvXK5bu7",
} as const;

export const RF = {
  name: "fldeiFljVC5L61c3v",
  awsOrg: "fldKSmvO7Lhr5v9Fy",
  awsService: "fldiieBBkkAFYDOJC",
  type: "fld2cjVCECNIPGw2d",
  leadContact: "fldKELDdEYb8MsJCP",
  teamContacts: "fld472yolP2ujyJ5w",
  notes: "fldOcbNUrtfxjqiW5",
  orgType: "fldmShxggHOAuioR4",
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
  crmStatus: "fldPdisuSJruZqLbo",
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
  goal: "fld1yU46baF052MHd",
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
