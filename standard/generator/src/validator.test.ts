import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { emitAll } from "./emitters/index.js";
import { loadSpec } from "./loader.js";
import type { SpecModel } from "./models.js";
import { normalizeId } from "./util.js";
import { validateSpec } from "./validator.js";

function baseSpec(): SpecModel {
  return {
    specRoot: "/tmp/spec",
    config: {},
    version: {},
    payloadTypes: [{ id: 1, value: 1, name: "CONTROL", domain: "protocol", status: "mvp" }],
    controlOpcodes: [{ id: 1, value: 1, name: "CONNECT", domain: "control", status: "mvp" }],
    rpcEncodings: [{ id: 2, value: 2, name: "BINARY", domain: "rpc", status: "mvp" }],
    rpcOps: [{ id: 1, value: 1, name: "REQUEST", domain: "rpc", status: "mvp" }],
    streamProfiles: [{ id: 1, value: 1, name: "firmware.ota", domain: "firmware", status: "mvp" }],
    methods: [{
      id: 0x0602,
      name: "brightness.set",
      domain: "brightness",
      status: "mvp",
      rpcOp: "request_response",
      requestSchema: "BrightnessSetRequest",
      responseSchema: "CommonEmptyResponse",
      recommendedEncoding: ["binary_tlv"],
      capabilities: ["brightness.set"],
      events: ["brightness.changed"],
      errors: ["SUCCESS"]
    }],
    events: [{
      id: 0x8601,
      name: "brightness.changed",
      domain: "brightness",
      status: "mvp",
      eventSchema: "BrightnessChangedEvent",
      trigger: ["brightness.set"],
      capabilities: ["brightness.event"]
    }],
    errors: [{ id: 0, name: "SUCCESS", domain: "common", status: "mvp", retryable: false }],
    capabilities: [
      { id: 0x0602, name: "brightness.set", domain: "brightness", status: "mvp", type: "bool" },
      { id: 0x0603, name: "brightness.event", domain: "brightness", status: "mvp", type: "bool" }
    ],
    legacyMappings: [{
      legacyProtocol: "axdp_hid",
      legacyCmdValue: 0x42,
      legacyName: "BetaBrightnessSet",
      axtpMethodId: 0x0602,
      axtpMethodName: "brightness.set",
      direction: "request_response",
      statusMapping: { "0x00": "SUCCESS" }
    }],
    schemas: [
      { name: "CommonEmptyResponse", type: "object", fields: [] },
      {
        name: "BrightnessSetRequest",
        type: "object",
        fields: [{ id: 1, name: "value", type: "uint8", required: true, deprecated: false, min: 0, max: 100 }]
      },
      {
        name: "BrightnessChangedEvent",
        type: "object",
        fields: [{ id: 1, name: "value", type: "uint8", required: true, deprecated: false, min: 0, max: 100 }]
      }
    ],
    mvpProfile: {
      methods: ["brightness.set"],
      events: ["brightness.changed"],
      errors: ["SUCCESS"],
      capabilities: ["brightness.set", "brightness.event"]
    }
  };
}

describe("normalizeId", () => {
  it("normalizes decimal and hex ids", () => {
    expect(normalizeId("0x0602", "test")).toBe(0x0602);
    expect(normalizeId(1538, "test")).toBe(0x0602);
  });
});

describe("validateSpec", () => {
  it("accepts a valid spec", () => {
    expect(validateSpec(baseSpec())).toContain("[OK] method_registry.yaml: 1 methods checked");
  });

  it("rejects duplicate method ids", () => {
    const spec = baseSpec();
    spec.methods.push({ ...spec.methods[0], name: "brightness.duplicate" });
    expect(() => validateSpec(spec)).toThrow(/AXTP-GEN-1002|duplicate methodId/);
  });

  it("rejects missing schema references", () => {
    const spec = baseSpec();
    spec.methods[0].requestSchema = "MissingSchema";
    expect(() => validateSpec(spec)).toThrow(/missing schema/);
  });

  it("rejects reserved references", () => {
    const spec = baseSpec();
    spec.capabilities[0].status = "reserved";
    expect(() => validateSpec(spec)).toThrow(/reserved capability/);
  });

  it("rejects missing MVP items", () => {
    const spec = baseSpec();
    spec.mvpProfile.methods.push("device.getInfo");
    expect(() => validateSpec(spec)).toThrow(/missing method/);
  });

  it("rejects invalid legacy targets", () => {
    const spec = baseSpec();
    spec.legacyMappings[0].axtpMethodId = 0xffff;
    expect(() => validateSpec(spec)).toThrow(/target method does not exist/);
  });
});

describe("loader", () => {
  it("reports YAML parse failures", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "axtp-gen-invalid-"));
    try {
      await writeFile(path.join(dir, "generator.yaml"), "generator: [");
      await expect(loadSpec(dir)).rejects.toThrow(/Flow sequence|parse/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("emitters", () => {
  it("generates stable output snapshots", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "axtp-gen-out-"));
    try {
      await mkdir(dir, { recursive: true });
      await emitAll(baseSpec(), dir);
      await expect(await readFile(path.join(dir, "cpp", "axtp_ids_generated.h"), "utf8")).toMatchFileSnapshot("./__snapshots__/axtp_ids_generated.h");
      await expect(await readFile(path.join(dir, "docs", "method_registry.generated.md"), "utf8")).toMatchFileSnapshot("./__snapshots__/method_registry.generated.md");
      await expect(await readFile(path.join(dir, "json", "method_registry.generated.json"), "utf8")).toMatchFileSnapshot("./__snapshots__/method_registry.generated.json");
      await expect(await readFile(path.join(dir, "test_vectors", "manifest.json"), "utf8")).toMatchFileSnapshot("./__snapshots__/manifest.json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
