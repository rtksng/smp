import { describe, expect, test } from "vitest";
import { getAssignmentIdFromNotificationData } from "./notification";

describe("native delivery helpers", () => {
  test("reads supported assignment notification identifiers", () => {
    expect(
      getAssignmentIdFromNotificationData({ assignmentId: " assignment-1 " })
    ).toBe("assignment-1");
    expect(
      getAssignmentIdFromNotificationData({
        deliveryAssignmentId: "assignment-2"
      })
    ).toBe("assignment-2");
  });

  test("ignores malformed notification identifiers", () => {
    expect(getAssignmentIdFromNotificationData(undefined)).toBeNull();
    expect(getAssignmentIdFromNotificationData({ assignmentId: 42 })).toBeNull();
    expect(getAssignmentIdFromNotificationData({ assignmentId: " " })).toBeNull();
  });
});
