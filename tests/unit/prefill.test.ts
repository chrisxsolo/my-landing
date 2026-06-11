import { describe, it, expect } from "vitest";
import { sessionTypeToServiceType, firstNameOf } from "@/lib/contentEngine/prefill";

describe("prefill mapping (spec §7.2)", () => {
  it("maps free-text session types onto the taxonomy", () => {
    expect(sessionTypeToServiceType("Graduation Session")).toBe("grads");
    expect(sessionTypeToServiceType("grad photos")).toBe("grads");
    expect(sessionTypeToServiceType("Couples Golden Hour")).toBe("couples");
    expect(sessionTypeToServiceType("engagement")).toBe("couples");
    expect(sessionTypeToServiceType("Family mini")).toBe("families");
    expect(sessionTypeToServiceType("Maternity")).toBe("maternity");
    expect(sessionTypeToServiceType("Senior portraits")).toBe("portraits");
    expect(sessionTypeToServiceType("Corporate event")).toBe("events");
    expect(sessionTypeToServiceType("something else")).toBe("other");
    expect(sessionTypeToServiceType(null)).toBe("other");
  });

  it("extracts a public-safe first name", () => {
    expect(firstNameOf("Mia Rodriguez")).toBe("Mia");
    expect(firstNameOf("  leo  ")).toBe("Leo");
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf("")).toBeNull();
  });
});
