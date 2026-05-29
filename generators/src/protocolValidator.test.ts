import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitProtocolDocs } from "./emitters/index.js";
import { loadProtocolDocs, validateProtocolDocsConsistency } from "./protocolDocsValidator.js";
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

  it("rejects legacy stream header fields", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.stream.header.fields = [
      { name: "streamId", type: "uint32" },
      { name: "seq", type: "uint32" },
      { name: "position", type: "uint32" },
      { name: "chunkLength", type: "uint16" },
      { name: "flags", type: "uint16" }
    ];
    expect(() => validateProtocolDefinition(model)).toThrow(/legacy field: seq|STREAM header must contain/);
  });

  it("rejects stream headers that do not match streamId, seqId and cursor", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.stream.header.fields[2].type = "uint32";
    expect(() => validateProtocolDefinition(model)).toThrow(/STREAM header must be streamId:uint32, seqId:uint32, cursor:uint64/);
  });

  it("rejects old capability method mask derivation names", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    const response = model.types.find((type) => type.name === "CapabilitySupportedMethodsResponse")!;
    response.fields.find((field) => field.name === "methodMasks")!.derivedFrom = "methods.bitOffset";
    expect(() => validateProtocolDefinition(model)).toThrow(/methods\[\]\.bitOffset/);
  });

  it("rejects non-Empty empty request or response types", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.types.push({ name: "DeviceGetInfoRequest", kind: "object", fields: [] });
    model.methods.find((method) => method.name === "device.getInfo")!.request.type = "DeviceGetInfoRequest";
    expect(() => validateProtocolDefinition(model)).toThrow(/empty request must use Empty/);
  });

  it("rejects duplicate type field ids", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    const response = model.types.find((type) => type.name === "DeviceGetInfoResponse")!;
    response.fields[1].fieldId = response.fields[0].fieldId;
    expect(() => validateProtocolDefinition(model)).toThrow(/duplicate fieldId/);
  });

  it("rejects error categories outside their code range", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.errors.find((error) => error.name === "FW_VERIFY_FAILED")!.category = "firmware";
    expect(() => validateProtocolDefinition(model)).toThrow(/category must be business/);
  });

  it("rejects profile capabilities not defined by profile meta spec", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    (model.raw as any).profiles[0].requiredCapabilities = ["device.info"];
    expect(() => validateProtocolDefinition(model)).toThrow(/requiredCapabilities is not defined/);
  });

  it("rejects profile frame profiles not backed by transports", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    model.profiles.find((profile) => profile.name === "AXTP-MVP")!.frameProfiles.push("UNUSED_FRAME");
    model.frameProfiles.push({ name: "UNUSED_FRAME", l1: "STANDARD_L1", l2: "STANDARD_L2" });
    expect(() => validateProtocolDefinition(model)).toThrow(/not used by transportProfiles/);
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

describe("protocol docs consistency validator", () => {
  it("accepts the current protocol docs facts", async () => {
    const model = await loadCurrentProtocol();
    const docs = await loadProtocolDocs(repoRoot);
    expect(validateProtocolDocsConsistency(model, docs)).toContain("[OK] standard/docs/00-spec: STREAM header facts checked");
  });

  it("rejects missing stream header facts in docs", async () => {
    const model = await loadCurrentProtocol();
    const docs = await loadProtocolDocs(repoRoot);
    docs.streamSpec = docs.streamSpec.replace("cursor:uint64", "cursor:uint32");
    expect(() => validateProtocolDocsConsistency(model, docs)).toThrow(/cursor:uint64/);
  });

  it("rejects yaml that disagrees with docs facts", async () => {
    const model = cloneModel(await loadCurrentProtocol());
    const docs = await loadProtocolDocs(repoRoot);
    model.stream.header.fields[1].name = "seq";
    expect(() => validateProtocolDocsConsistency(model, docs)).toThrow(/legacy field: seq|seqId:uint32/);
  });
});

describe("protocol definition emitters", () => {
  it("generates stable protocol snapshots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "axtp-protocol-out-"));
    try {
      const model = await loadCurrentProtocol();
      await emitProtocolDocs(model, dir);
      const json = await readFile(path.join(dir, "protocol.json"), "utf8");
      const markdown = await readFile(path.join(dir, "protocol.md"), "utf8");
      expect(markdown).toContain("## Main Table of Contents");
      expect(markdown).toContain("**Request Fields:**");
      expect(markdown).toContain("**Response Fields:**");
      expect(markdown).toContain("**Payload Fields:**");
      expect(markdown).not.toContain("## Frame Profiles");
      expect(markdown).not.toContain("## Transport Profiles");
      expect(markdown).not.toContain("## Payload Types");
      expect(markdown).not.toContain("## Control Rules");
      expect(markdown).not.toContain("## Stream Transfer Model");
      expect(markdown).not.toContain("## Types Reference");
      await expect(json).toMatchFileSnapshot("./__snapshots__/protocol.generated.json");
      await expect(markdown).toMatchFileSnapshot("./__snapshots__/protocol.generated.md");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
