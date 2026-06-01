cmake_minimum_required(VERSION 3.16)

project(axtpctl LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT TARGET axtp_sdk)
    set(AXTP_CORE_BUILD_TESTS OFF CACHE BOOL "" FORCE)
    set(AXTP_BUILD_JSON_RPC ON CACHE BOOL "" FORCE)
    set(AXTP_BUILD_OPTIONAL_TRANSPORTS ON CACHE BOOL "" FORCE)
    add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../cpp-sdk ${CMAKE_CURRENT_BINARY_DIR}/cpp-sdk)
endif()

add_executable(axtpctl
    src/main.cpp
)

target_link_libraries(axtpctl
    PRIVATE
        axtp_sdk
        axtp_json_rpc
        axtp_transport_hidapi
        axtp_transport_tcp_boost
        axtp_transport_websocket_boost
)

enable_testing()

add_test(NAME axtpctl_help COMMAND axtpctl --help)
add_test(NAME axtpctl_capability_methods COMMAND axtpctl capability methods)
add_test(NAME axtpctl_list_methods COMMAND axtpctl list-methods)
add_test(NAME axtpctl_mock_call COMMAND axtpctl --transport mock call device.getInfo --json {})
add_test(NAME axtpctl_short_command
    COMMAND axtpctl -c device.getInfo -o json
)
add_test(NAME axtpctl_long_command
    COMMAND axtpctl --command device.getInfo --output json
)
add_test(NAME axtpctl_short_command_json
    COMMAND axtpctl -c display.setBrightness --json [=[{"value":80}]=] -o json
)
add_test(NAME axtpctl_short_command_json_file
    COMMAND axtpctl -c display.setBrightness --json-file ${CMAKE_CURRENT_SOURCE_DIR}/tests/params_brightness.json -o json
)
add_test(NAME axtpctl_raw_method_id
    COMMAND axtpctl --transport mock call --method-id 0x90010001 --raw-hex cafe --output hex
)
add_test(NAME axtpctl_custom_registry_json
    COMMAND axtpctl --transport mock --registry-file ${CMAKE_CURRENT_SOURCE_DIR}/tests/custom_registry.json call vendor.echo --json {"value":80}
)
add_test(NAME axtpctl_inspect_frame
    COMMAND axtpctl inspect frame --hex 415801020000000000000001a950
)

add_test(NAME axtpctl_unknown_method
    COMMAND axtpctl -c unknown.method
)
set_tests_properties(axtpctl_unknown_method PROPERTIES WILL_FAIL TRUE)

add_test(NAME axtpctl_bad_json
    COMMAND axtpctl -c display.setBrightness --json [=[{bad json}]=]
)
set_tests_properties(axtpctl_bad_json PROPERTIES WILL_FAIL TRUE)

add_test(NAME axtpctl_json_conflict
    COMMAND axtpctl -c display.setBrightness --json {} --json-file ${CMAKE_CURRENT_SOURCE_DIR}/tests/params_brightness.json
)
set_tests_properties(axtpctl_json_conflict PROPERTIES WILL_FAIL TRUE)
