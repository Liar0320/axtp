import path from "node:path";
import { toJsonStable, writeTextFile } from "../util.js";
export async function emitTestVectors(_spec, outDir) {
    const dir = path.join(outDir, "test_vectors");
    const vectors = [
        { name: "control_open", payloadType: "CONTROL", encoding: "binary_tlv", hexFile: "control_open.hex", expectDecode: { opcode: "OPEN" } },
        { name: "rpc_device_get_info_request", payloadType: "RPC", encoding: "binary_tlv", hexFile: "rpc_device_get_info.hex", expectDecode: { method: "device.getInfo" } },
        { name: "rpc_display_brightness_set_request", payloadType: "RPC", encoding: "binary_tlv", hexFile: "rpc_display_brightness_set.hex", expectDecode: { method: "display.setBrightness", value: 80 } },
        { name: "event_display_brightness_changed", payloadType: "RPC", encoding: "binary_tlv", hexFile: "event_display_brightness_changed.hex", expectDecode: { event: "display.brightnessChanged", value: 80 } },
        { name: "stream_ota_chunk", payloadType: "STREAM", encoding: "binary", hexFile: "stream_ota_chunk.hex", expectDecode: { streamProfile: "firmware.ota" } },
        { name: "compact_crc8_error", payloadType: "RPC", encoding: "binary_tlv", hexFile: "compact_crc8_error.hex", expectError: "FRAME_CRC_ERROR" },
        { name: "compact_message_id_overflow", payloadType: "RPC", encoding: "binary_tlv", hexFile: "compact_message_id_overflow.hex", expectError: "COMPACT_MESSAGE_ID_OVERFLOW" }
    ];
    const hexData = {
        "control_open.hex": "415801000C000110010000010101",
        "rpc_device_get_info.hex": "415801020B000110020000010207010000000101000000",
        "rpc_display_brightness_set.hex": "415801020E000110030000010207010000000205000001010150",
        "event_display_brightness_changed.hex": "415801020E000110040000010206000000000785000001010150",
        "stream_ota_chunk.hex": "415803001C010100050001010000000900000001000000000000000000000000AABBCCDD",
        "compact_crc8_error.hex": "121101020701000000020500000101015000",
        "compact_message_id_overflow.hex": "1211FF01020701000000020500000101015000"
    };
    await Promise.all([
        writeTextFile(path.join(dir, "manifest.json"), toJsonStable({ vectors })),
        ...Object.entries(hexData).map(([file, content]) => writeTextFile(path.join(dir, file), content))
    ]);
}
//# sourceMappingURL=testVectors.js.map