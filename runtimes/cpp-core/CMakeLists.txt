cmake_minimum_required(VERSION 3.16)

project(axtp_cpp_core_phase1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(axtp_cpp_core INTERFACE)

target_include_directories(axtp_cpp_core
    INTERFACE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

enable_testing()

add_executable(phase1_model_io_test
    tests/phase1_model_io_test.cpp
)

target_link_libraries(phase1_model_io_test PRIVATE axtp_cpp_core)

add_test(NAME phase1_model_io_test COMMAND phase1_model_io_test)

add_executable(phase2_inbound_test
    tests/phase2_inbound_test.cpp
)

target_link_libraries(phase2_inbound_test PRIVATE axtp_cpp_core)

add_test(NAME phase2_inbound_test COMMAND phase2_inbound_test)

add_executable(phase3_outbound_test
    tests/phase3_outbound_test.cpp
)

target_link_libraries(phase3_outbound_test PRIVATE axtp_cpp_core)

add_test(NAME phase3_outbound_test COMMAND phase3_outbound_test)
