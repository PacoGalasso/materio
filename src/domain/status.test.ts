import { describe, expect, it } from "vitest";

import { assertTransition, canTransition, isEditable } from "./status";

describe("weighing status transitions", () => {
  it("allows open → completed and open → cancelled only", () => {
    expect(canTransition("open", "completed")).toBe(true);
    expect(canTransition("open", "cancelled")).toBe(true);
    expect(canTransition("completed", "open")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() => assertTransition("completed", "cancelled")).toThrowError(
      expect.objectContaining({ code: "INVALID_STATUS_TRANSITION" }),
    );
  });

  it("only open tickets are editable", () => {
    expect(isEditable("open")).toBe(true);
    expect(isEditable("completed")).toBe(false);
    expect(isEditable("cancelled")).toBe(false);
  });
});
