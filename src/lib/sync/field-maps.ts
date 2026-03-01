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
  awsStakeholders: "fldLVPbg7iyz0Nli9",
  partnerStakeholders: "fldj6vaWwDKJy6aci",
  thirdParties: "flduajBotnT6x5ZXD",
} as const;

export const MF = {
  meetingName: "fldcbatIDunJ00dLp",
  event: "fldT96Imgc7CFDBEX",
  program: "fldqhPAGvYppRZgCS",
  partner: "fldubdX4ZYXFQ2sIZ",
  status: "fldpXlLugkUgQsjcr",
  meetingDate: "fldx9ZrIMundEMUko",
  awsContacts: "fldOVCmwhiisY8bDo",
  partnerContacts: "fldJira79g9xWNTte",
  notes: "fldzGUipu36EA9rax",
  engagement: "fld2TczwxJXZLUwpW",
  awsRelationships: "fldeDCWtZx7YoyYR6",
  startTime: "fldifWilEYICfifXz",
  endTime: "fldV78rQbzDhVK9NO",
  location: "fldTyiMYT48aCHttx",
  source: "fld2RW78vS1T91bab",
  roadrunnerId: "fldLveS95zGGVU4j1",
  icsUid: "fldNb83l5XLtz8J9k",
} as const;

// ── Notes constants ─────────────────────────────────────────
export const NOTES_MARKER = "=== Roadrunner Activity Summary ===";
export const NOTES_FOOTER = "(Auto-synced from Roadrunner)";
