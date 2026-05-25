import path from "node:path";
import type { SpecModel } from "../models.js";
import { toJsonStable, writeTextFile } from "../util.js";

interface Vector {
  name: string;
  payloadType: string;
  encoding: string;
  hexFile: string;
  expectDecode?: Record<string, unknown>;
  expectError?: string;
}

export async function emitTestVectors(_spec: SpecModel, outDir: string): Promise<void> {
  const dir = path.join(outDir, "test_vectors");
  const vectors: Vector[] = [
    { name: "control_connect", payloadType: "CONTROL", encoding: "binary_tlv", hexFile: "control_connect.hex", expectDecode: { opcode: "CONNECT" } },
    { name: "rpc_device_get_info_request", payloadType: "RPC", encoding: "binary_tlv", hexFile: "rpc_device_get_info.hex", expectDecode: { method: "device.getInfo" } },
    { name: "rpc_brightness_set_request", payloadType: "RPC", encoding: "binary_tlv", hexFile: "rpc_brightness_set.hex", expectDecode: { method: "brightness.set", value: 80 } },
    { name: "event_brightness_changed", payloadType: "RPC", encoding: "binary_tlv", hexFile: "event_brightness_changed.hex", expectDecode: { event: "brightness.changed", value: 80 } },
    { name: "stream_ota_chunk", payloadType: "STREAM", encoding: "binary", hexFile: "stream_ota_chunk.hex", expectDecode: { streamProfile: "firmware.ota" } },
    { name: "compact_crc8_error", payloadType: "RPC", encoding: "binary_tlv", hexFile: "compact_crc8_error.hex", expectError: "CRC_ERROR" },
    { name: "compact_message_id_overflow", payloadType: "RPC", encoding: "binary_tlv", hexFile: "compact_message_id_overflow.hex", expectError: "COMPACT_MESSAGE_ID_OVERFLOW" }
  ];

  const hexData: Record<string, string> = {
    "control_connect.hex": "415801000C0101000100010101",
    "rpc_device_get_info.hex": "415802000A010100020001010000000101",
    "rpc_brightness_set.hex": "415802000D010100030001010000000206010150",
    "event_brightness_changed.hex": "415802000D100100040001030000000186010150",
    "stream_ota_chunk.hex": "415803001C010100050001010000000900000001000000000000000000000000AABBCCDD",
    "compact_crc8_error.hex": "120A010101000000020601015000",
    "compact_message_id_overflow.hex": "120A1FF01000000020601015000"
  };

  await Promise.all([
    writeTextFile(path.join(dir, "manifest.json"), toJsonStable({ vectors })),
    ...Object.entries(hexData).map(([file, content]) => writeTextFile(path.join(dir, file), content))
  ]);
}
