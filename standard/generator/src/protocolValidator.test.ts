import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitProtocolDocs } from "./emitters/index.js";
import { loadProtocolDefinition } from "./protocolLoader.js";
import type { ProtocolModel } from "./protocolModel.js";
import { validateProtocolDefinition } from "./protocolValidator.js";

const repoRoot = path.resolve("..", "..");

function cloneModel(model: ProtocolModel): ProtocolModel {
  return structuredClone(model);
}

async function loadCurrentProtocol(): Promise<ProtocolModel> {
  return loadProtocolDefinition(repoRoot);
}

describe("protocol definition loader", () => {
  it("loads and validates the current protocol definition", async () => {
    const model = await loadCurrentProtocol();
    expect(model.protocol.name).toBe("AXTP");
    expect(validateProtocolDefinition(model)).toContain("[OK] protocol/axtp.protocol.yaml: 8 methods checked");
  });
});

describe("protocol definition validator", () => {
  it("rejects duplicate method ids", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.methods.push({ ...model.methods[0], name: "device.duplicate" });
    expect(() => validateProtocolDefinition(model)).toThrow(/duplicate methodId/);
  });

  it("rejects duplicate event ids", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.events.push({ ...model.events[0], name: "display.duplicateChanged" });
    expect(() => validateProtocolDefinition(model)).toThrow(/duplicate eventId/);
  });

  it("rejects non-contiguous method bit offsets in the same domain", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.methods.find((method) => method.name === "display.setBrightness")!.bitOffset = 2;
    expect(() => validateProtocolDefinition(model)).toThrow(/bitOffset must be contiguous from 0/);
  });

  it("rejects non-contiguous event bit offsets in the same domain", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.events.find((event) => event.name === "firmware.updateCompleted")!.bitOffset = 3;
    expect(() => validateProtocolDefinition(model)).toThrow(/bitOffset must be contiguous from 0/);
  });

  it("rejects missing method type references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    const method = model.methods.find((item) => item.name === "display.setBrightness")!;
    method.request.type = "MissingRequest";
    expect(() => validateProtocolDefinition(model)).toThrow(/missing type: MissingRequest/);
  });

  it("rejects missing method error references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.methods.find((item) => item.name === "display.setBrightness")!.errors.push("MISSING_ERROR");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing error: MISSING_ERROR/);
  });

  it("rejects missing method event references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.methods.find((item) => item.name === "display.setBrightness")!.events.push("display.missingEvent");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing event: display.missingEvent/);
  });

  it("rejects missing profile method references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.profiles.find((item) => item.name === "AXTP-MVP")!.requiredMethods.push("missing.method");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing method: missing.method/);
  });

  it("rejects missing profile event references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.profiles.find((item) => item.name === "AXTP-MVP")!.requiredEvents.push("missing.event");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing event: missing.event/);
  });

  it("rejects missing profile error references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.profiles.find((item) => item.name === "AXTP-MVP")!.requiredErrors.push("MISSING_ERROR");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing error: MISSING_ERROR/);
  });

  it("rejects missing profile transport references", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.profiles.find((item) => item.name === "AXTP-MVP")!.transportProfiles.push("AXTP-MISSING");
    expect(() => validateProtocolDefinition(model)).toThrow(/missing transport: AXTP-MISSING/);
  });

  it("rejects forbidden legacy protocol definition fields", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    (model.raw as any).methods[0].bitmapId = 1;
    expect(() => validateProtocolDefinition(model)).toThrow(/forbidden legacy Protocol Definition field: bitmapId/);

    const requestsModel = cloneModel(await loadCurrentProtocol());
    (requestsModel.raw as any).profiles[0].requests = ["legacy.request"];
    expect(() => validateProtocolDefinition(requestsModel)).toThrow(/forbidden legacy Protocol Definition field: requests/);

    const requiredRequestsModel = cloneModel(await loadCurrentProtocol());
    (requiredRequestsModel.raw as any).profiles[0].requiredRequests = ["legacy.request"];
    expect(() => validateProtocolDefinition(requiredRequestsModel)).toThrow(/forbidden legacy Protocol Definition field: requiredRequests/);
  });
});

describe("protocol definition emitters", () => {
  it("generates stable protocol snapshots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "axtp-protocol-out-"));
    try {
      const model = await loadCurrentProtocol();
      await emitProtocolDocs(model, dir);
      await expect(await readFile(path.join(dir, "protocol.json"), "utf8")).toMatchFileSnapshot("./__snapshots__/protocol.generated.json");
      await expect(await readFile(path.join(dir, "protocol.md"), "utf8")).toMatchFileSnapshot("./__snapshots__/protocol.generated.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
