#pragma once

#include "axtp/broker/broker_task.hpp"

namespace axtp {

class BrokerFlowControl {
public:
    bool allow(const BrokerTask&) const {
        return true;
    }
};

}  // namespace axtp
