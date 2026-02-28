import { describe, it, expect, vi } from "vitest";
import { mapMeetingStatus } from "../sync";

describe("mapMeetingStatus", () => {
  it("maps 'scheduled' to 'Scheduled'", () => {
    expect(mapMeetingStatus("scheduled")).toBe("Scheduled");
  });

  it("maps 'completed' to 'Completed'", () => {
    expect(mapMeetingStatus("completed")).toBe("Completed");
  });

  it("maps 'cancelled' to 'Cancelled'", () => {
    expect(mapMeetingStatus("cancelled")).toBe("Cancelled");
  });

  it("maps 'did_not_occur' to 'Did Not Occur'", () => {
    expect(mapMeetingStatus("did_not_occur")).toBe("Did Not Occur");
  });

  it("logs warning and passes through unknown status", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = mapMeetingStatus("something_else");

    expect(result).toBe("something_else");
    expect(warnSpy).toHaveBeenCalledWith(
      'Unknown meeting status "something_else" — passing through unmapped'
    );
    warnSpy.mockRestore();
  });
});
