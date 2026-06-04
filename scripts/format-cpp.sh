#!/usr/bin/env bash
set -euo pipefail

find \
  runtimes/cpp/core \
  runtimes/cpp/sdk \
  runtimes/cpp/json-rpc \
  runtimes/cpp/transports \
  runtimes/cpp/tools \
  \( -path '*/build/*' -o -path '*/generated/*' -o -path '*/thirdparty/*' \) -prune -o \
  -type f \( -name '*.h' -o -name '*.hpp' -o -name '*.cc' -o -name '*.cpp' \) \
  -print0 | xargs -0 clang-format -i
