# AXTP音效配置方案

请阅读当前 AXTP / 协议仓库，重点关注以下内容：



1. 协议域划分文档；

2. audio 域已有协议文档；

3. audio algorithm config 协议文档；

4. capability 能力查询与协商文档；

5. RPC 方法注册表；

6. 事件注册表；

7. ErrorCode / Result / State 命名规范；

8. JSON\-RPC / Binary\-RPC 映射示例。

    

目标：新增或完善一篇 **Audio EQ 配置协议文档**，用于配置音频上行/下行链路的 EQ 参数，并支持能力范围查询、当前值查询、设置、重置默认值、配置变化事件。



EQ 配置属于 `audio` 域。



---



# 一、文档目标



请新增或更新音频 EQ 协议文档，建议文件名为：



```Plain Text
docs/protocol/audio/AudioEqConfig.md
```



如果仓库已有 audio 协议目录，请放入现有目录；如果已有统一注册表文档，也需要同步补充方法、事件和 capability。



文档需要说明：



```Plain Text
1. EQ 配置属于 audio 域。
2. EQ 用于配置上行/下行音频链路的均衡参数。
3. 上行/下行不拆成两套协议，而是通过 path 字段区分。
4. 支持查询当前值、默认值、能力范围、设置、重置默认值。
5. 支持 preset 和 custom bands 两种模式。
6. 支持固定图示 EQ，也支持参数 EQ 的扩展表达。
```



---



# 二、核心接口清单



需要新增或更新以下方法：



```Plain Text
audio.getEqCapabilities
audio.getEqConfig
audio.setEqConfig
audio.resetEqConfig
```



需要新增或更新以下事件：



```Plain Text
audio.eqConfigChanged
```



建议新增 capability ID：



```Plain Text
audio.eq
```



---



# 三、核心概念



## 3\.1 path：区分上行和下行



EQ 配置必须使用 `path` 字段区分作用链路：



```Plain Text
uplink
  上行链路。
  通常指麦克风采集后，送给远端、UAC、网络会议、编码器之前的音频链路。

downlink
  下行链路。
  通常指远端/主机/网络收到后，送本地扬声器播放之前的音频链路。
```



不要拆成：



```Plain Text
audio.setUplinkEqConfig
audio.setDownlinkEqConfig
```



统一使用：



```Plain Text
audio.setEqConfig
```



并通过：



```JSON
{
  "path": "uplink"
}
```



区分。



---



# 四、audio\.getEqCapabilities



## 4\.1 用途



`audio.getEqCapabilities` 用于查询设备支持哪些 EQ path、preset、频段数量、频点、增益范围、Q 值范围、是否支持自定义 EQ 等能力。



它回答：



```Plain Text
设备是否支持 uplink EQ？
设备是否支持 downlink EQ？
每条链路支持多少段 EQ？
每段频点是什么？
gainDb 范围是多少？
是否支持 q？
是否支持 preset？
默认 preset 和默认 bands 是什么？
```



## 4\.2 请求



查询全部：



```JSON
{
  "method": "audio.getEqCapabilities",
  "params": {}
}
```



查询指定 path：



```JSON
{
  "method": "audio.getEqCapabilities",
  "params": {
    "paths": ["uplink", "downlink"]
  }
}
```



## 4\.3 返回结构



返回必须按 path 展开：



```JSON
{
  "result": {
    "uplink": {
      "supported": true,
      "displayName": "Uplink EQ",
      "presets": ["flat", "voice", "music", "custom"],
      "defaultPreset": "flat",
      "supportsCustomBands": true,
      "eqType": "graphic",
      "bandCount": 7,
      "gainRangeDb": {
        "min": -12,
        "max": 12,
        "step": 0.5
      },
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "defaultGainDb": 0
        }
      ]
    },
    "downlink": {
      "supported": true,
      "displayName": "Downlink EQ",
      "presets": ["flat", "voice", "music", "movie", "custom"],
      "defaultPreset": "flat",
      "supportsCustomBands": true,
      "eqType": "graphic",
      "bandCount": 7,
      "gainRangeDb": {
        "min": -12,
        "max": 12,
        "step": 0.5
      },
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "defaultGainDb": 0
        }
      ]
    }
  }
}
```



## 4\.4 字段说明



```Plain Text
supported:
  当前设备是否支持该 path 的 EQ。

displayName:
  面向 UI 的显示名称。

presets:
  支持的 EQ 预设，例如 flat / voice / music / movie / custom。

defaultPreset:
  默认预设。

supportsCustomBands:
  是否支持自定义频段增益。

eqType:
  graphic / parametric。
  graphic 表示固定频点图示 EQ。
  parametric 表示参数 EQ，可配置 frequencyHz、gainDb、q、filterType。

bandCount:
  频段数量。

gainRangeDb:
  增益范围，单位 dB。

bands:
  频段能力列表。
```



---



# 五、audio\.getEqConfig



## 5\.1 用途



`audio.getEqConfig` 用于查询当前 EQ 配置。



## 5\.2 请求



查询全部 path：



```JSON
{
  "method": "audio.getEqConfig",
  "params": {}
}
```



查询指定 path：



```JSON
{
  "method": "audio.getEqConfig",
  "params": {
    "paths": ["uplink"]
  }
}
```



## 5\.3 返回结构



返回当前最终生效值：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "custom",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": -2.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": -1.0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "gainDb": 0.0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "gainDb": 1.5
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "gainDb": 2.0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "gainDb": 1.0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "gainDb": 0.0
        }
      ]
    },
    "downlink": {
      "enabled": true,
      "preset": "flat",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": 0.0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "gainDb": 0.0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "gainDb": 0.0
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "gainDb": 0.0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "gainDb": 0.0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "gainDb": 0.0
        }
      ]
    }
  }
}
```



要求：



```Plain Text
1. getEqConfig 只返回当前值。
2. 默认值和范围由 getEqCapabilities 返回。
3. 不支持的 path 可以不返回，或返回 supported=false。推荐能力查询返回 supported=false，配置查询只返回支持的 path。
```



---



# 六、audio\.setEqConfig



## 6\.1 用途



`audio.setEqConfig` 用于设置上行/下行 EQ 配置。



必须支持：



```Plain Text
1. 设置单个 path；
2. 一次设置多个 path；
3. 只设置 preset；
4. 设置 custom bands；
5. 部分更新；
6. 返回最终生效值。
```



## 6\.2 设置 uplink preset



```JSON
{
  "method": "audio.setEqConfig",
  "params": {
    "uplink": {
      "enabled": true,
      "preset": "voice"
    }
  }
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "voice",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": -1.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": 0.0
        }
      ]
    },
    "state": "applied"
  }
}
```



文档里说明：preset 对应的 bands 由设备决定，返回中应给出最终生效 bands。如果设备不返回完整 bands，也必须至少返回 enabled、preset、state。



## 6\.3 设置 downlink custom bands



```JSON
{
  "method": "audio.setEqConfig",
  "params": {
    "downlink": {
      "enabled": true,
      "preset": "custom",
      "bands": [
        {
          "bandIndex": 0,
          "gainDb": -2.0
        },
        {
          "bandIndex": 1,
          "gainDb": -1.0
        },
        {
          "bandIndex": 2,
          "gainDb": 0.0
        },
        {
          "bandIndex": 3,
          "gainDb": 1.5
        },
        {
          "bandIndex": 4,
          "gainDb": 2.0
        },
        {
          "bandIndex": 5,
          "gainDb": 1.0
        },
        {
          "bandIndex": 6,
          "gainDb": 0.0
        }
      ]
    }
  }
}
```



返回：



```JSON
{
  "result": {
    "downlink": {
      "enabled": true,
      "preset": "custom",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": -2.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": -1.0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "gainDb": 0.0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "gainDb": 1.5
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "gainDb": 2.0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "gainDb": 1.0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "gainDb": 0.0
        }
      ]
    },
    "state": "applied"
  }
}
```



## 6\.4 一次设置 uplink 和 downlink



```JSON
{
  "method": "audio.setEqConfig",
  "params": {
    "uplink": {
      "enabled": true,
      "preset": "voice"
    },
    "downlink": {
      "enabled": true,
      "preset": "music"
    }
  }
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "voice"
    },
    "downlink": {
      "enabled": true,
      "preset": "music"
    },
    "state": "applied"
  }
}
```



## 6\.5 setEqConfig 规则



文档必须写明：



```Plain Text
1. setEqConfig 支持部分更新。
2. 未传入 path 不变。
3. 某个 path 内未传入字段保持不变。
4. 如果 preset != custom，bands 可以省略。
5. 如果 preset = custom，设备可以要求 bands 必须提供。
6. 设备必须根据 getEqCapabilities 中声明的 gainRangeDb、bandCount、presets 校验入参。
7. 设置成功后返回最终生效值，而不是只返回 accepted。
8. 如果修改需要重启音频链路，返回 state=pending_restart 和 requiresAudioRestart=true。
9. 如果一次设置 uplink/downlink，设备应尽量原子应用；如果无法原子应用，文档必须说明错误策略。
```



---



# 七、audio\.resetEqConfig



## 7\.1 用途



`audio.resetEqConfig` 用于恢复 EQ 默认配置。



必须支持：



```Plain Text
1. 重置全部 path；
2. 重置指定 path；
3. 重置指定 path 的部分字段；
4. 返回重置后的当前值。
```



## 7\.2 重置全部 EQ



```JSON
{
  "method": "audio.resetEqConfig",
  "params": {
    "paths": "all"
  }
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "flat",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        }
      ]
    },
    "downlink": {
      "enabled": true,
      "preset": "flat",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        }
      ]
    },
    "state": "applied"
  }
}
```



## 7\.3 重置指定 path



```JSON
{
  "method": "audio.resetEqConfig",
  "params": {
    "paths": ["uplink"]
  }
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "flat",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        }
      ]
    },
    "state": "applied"
  }
}
```



## 7\.4 重置指定字段



如果需要支持只重置某些字段，可以使用：



```JSON
{
  "method": "audio.resetEqConfig",
  "params": {
    "items": {
      "uplink": ["preset", "bands"],
      "downlink": ["bands"]
    }
  }
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "flat",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        }
      ]
    },
    "downlink": {
      "enabled": true,
      "preset": "custom",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 0.0
        }
      ]
    },
    "state": "applied"
  }
}
```



## 7\.5 reset 规则



文档必须写明：



```Plain Text
1. resetEqConfig 的默认值来自 audio.getEqCapabilities。
2. resetEqConfig 成功后必须返回重置后的当前值。
3. paths 和 items 不应同时出现。
4. paths="all" 表示重置所有支持的 EQ path。
5. 如果 path 不支持，返回 UnsupportedCapability 或 InvalidParams。
6. reset 同样可能返回 pending_restart。
```



---



# 八、audio\.eqConfigChanged 事件



## 8\.1 触发条件



当 EQ 配置变化时发送：



```Plain Text
1. setEqConfig 成功；
2. resetEqConfig 成功；
3. profile 切换导致 EQ 配置变化；
4. factory reset 导致 EQ 配置变化；
5. 设备内部策略导致 EQ 配置变化。
```



## 8\.2 事件格式



单个 path 变化：



```JSON
{
  "event": "audio.eqConfigChanged",
  "params": {
    "uplink": {
      "enabled": true,
      "preset": "voice"
    },
    "reason": "user_request"
  }
}
```



多个 path 变化：



```JSON
{
  "event": "audio.eqConfigChanged",
  "params": {
    "uplink": {
      "enabled": true,
      "preset": "voice"
    },
    "downlink": {
      "enabled": true,
      "preset": "music"
    },
    "reason": "user_request"
  }
}
```



reset 导致变化：



```JSON
{
  "event": "audio.eqConfigChanged",
  "params": {
    "uplink": {
      "enabled": true,
      "preset": "flat"
    },
    "reason": "reset_to_default"
  }
}
```



## 8\.3 reason 枚举



建议定义：



```Plain Text
user_request
reset_to_default
factory_reset
profile_changed
device_policy
restore_config
unknown
```



---



# 九、EQ 数据模型



## 9\.1 Graphic EQ



MVP 推荐优先支持图示 EQ：



```JSON
{
  "enabled": true,
  "preset": "custom",
  "bands": [
    {
      "bandIndex": 0,
      "frequencyHz": 125,
      "gainDb": -2.0
    },
    {
      "bandIndex": 1,
      "frequencyHz": 250,
      "gainDb": -1.0
    }
  ]
}
```



字段说明：



```Plain Text
enabled:
  是否启用 EQ。

preset:
  flat / voice / music / movie / custom。

bands:
  EQ 频段列表。

bandIndex:
  频段索引，从 0 开始。

frequencyHz:
  频点，单位 Hz。
  对固定图示 EQ，set 请求里可以省略，设备根据 bandIndex 决定。
  get 返回里建议带上 frequencyHz。

gainDb:
  当前频段增益，单位 dB。
```



## 9\.2 Parametric EQ 扩展



如果后续设备支持参数 EQ，可以扩展 band 结构：



```JSON
{
  "bandIndex": 0,
  "enabled": true,
  "filterType": "peaking",
  "frequencyHz": 1000,
  "gainDb": 2.5,
  "q": 1.0
}
```



字段说明：



```Plain Text
filterType:
  peaking / low_shelf / high_shelf / low_pass / high_pass。

q:
  Q 值。

frequencyHz:
  参数 EQ 的中心频点或截止频点。
```



MVP 不强制实现参数 EQ，但文档需要预留 `eqType = parametric` 和 `qRange` 字段。



---



# 十、完整能力示例



请在文档中加入完整但不要过长的 capabilities 示例，至少包含 uplink 和 downlink。



```JSON
{
  "method": "audio.getEqCapabilities",
  "params": {}
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "supported": true,
      "displayName": "Uplink EQ",
      "presets": ["flat", "voice", "custom"],
      "defaultPreset": "flat",
      "supportsCustomBands": true,
      "eqType": "graphic",
      "bandCount": 7,
      "gainRangeDb": {
        "min": -12,
        "max": 12,
        "step": 0.5
      },
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "defaultGainDb": 0
        }
      ]
    },
    "downlink": {
      "supported": true,
      "displayName": "Downlink EQ",
      "presets": ["flat", "voice", "music", "movie", "custom"],
      "defaultPreset": "flat",
      "supportsCustomBands": true,
      "eqType": "graphic",
      "bandCount": 7,
      "gainRangeDb": {
        "min": -12,
        "max": 12,
        "step": 0.5
      },
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 3,
          "frequencyHz": 1000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 4,
          "frequencyHz": 2000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 5,
          "frequencyHz": 4000,
          "defaultGainDb": 0
        },
        {
          "bandIndex": 6,
          "frequencyHz": 8000,
          "defaultGainDb": 0
        }
      ]
    }
  }
}
```



---



# 十一、完整配置示例



查询当前值：



```JSON
{
  "method": "audio.getEqConfig",
  "params": {}
}
```



返回：



```JSON
{
  "result": {
    "uplink": {
      "enabled": true,
      "preset": "voice",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": -1.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": 0.0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "gainDb": 1.0
        }
      ]
    },
    "downlink": {
      "enabled": true,
      "preset": "music",
      "bands": [
        {
          "bandIndex": 0,
          "frequencyHz": 125,
          "gainDb": 2.0
        },
        {
          "bandIndex": 1,
          "frequencyHz": 250,
          "gainDb": 1.0
        },
        {
          "bandIndex": 2,
          "frequencyHz": 500,
          "gainDb": 0.0
        }
      ]
    }
  }
}
```



---



# 十二、错误处理



请补充错误场景：



```Plain Text
UnsupportedCapability:
  设备不支持 audio.eq，或不支持某个 path 的 EQ。

InvalidParams:
  参数类型错误、范围越界、枚举值非法。

UnsupportedParameter:
  path 支持 EQ，但某个字段不支持，例如 q 不支持。

Conflict:
  参数组合冲突，例如 preset=custom 但 bands 为空，或 preset!=custom 却传入非法 bands。

ServerBusy:
  音频链路繁忙，暂时不能应用。

RequiresRestart:
  如果当前协议将 requires restart 作为 error，可以返回该错误；
  但更推荐成功返回 state=pending_restart。
```



错误示例：



```JSON
{
  "error": {
    "code": "InvalidParams",
    "message": "uplink.bands[0].gainDb out of range",
    "data": {
      "field": "uplink.bands[0].gainDb",
      "min": -12,
      "max": 12
    }
  }
}
```



---



# 十三、与 audio\.getAlgorithmCapabilities 的关系



请在文档中说明：



```Plain Text
audio.getAlgorithmCapabilities:
  用于通用音频算法配置，例如 noiseSuppression、echoCancellation、autoGainControl 等。

audio.getEqCapabilities:
  用于 EQ 的专用能力查询，因为 EQ 具有 path、preset、bands、gainDb、frequencyHz、q 等结构化参数。

EQ 可以被视为音频算法的一种，但由于 EQ 参数结构复杂、需要上下行 path，因此使用独立 EQ 协议更清晰。
```



不要把 EQ 强行塞进：



```JSON
{
  "audio.setAlgorithmConfig": {
    "eq": {}
  }
}
```



EQ 独立使用：



```Plain Text
audio.setEqConfig
```



---



# 十四、与 capability 域关系



请在文档中说明：



```Plain Text
capability.getAll 用于发现设备是否支持 audio.eq 能力块。

audio.getEqCapabilities 用于查询 EQ 的细粒度参数能力，包括 path、preset、bands、gainRangeDb、defaultPreset 等。

二者不是重复关系。

Capability ID 使用 domain.feature 能力块；eqConfig 是方法/事件或 schema 层面的配置对象名，
不作为独立 capability ID。
```



建议在 capability 中新增：



```Plain Text
audio.eq
```



对应方法：



```Plain Text
audio.getEqCapabilities
audio.getEqConfig
audio.setEqConfig
audio.resetEqConfig
```



事件：



```Plain Text
audio.eqConfigChanged
```



---



# 十五、Binary\-RPC / TLV 映射建议



如果仓库已有 Binary\-RPC/TLV 映射文档，请补充映射建议：



```Plain Text
JSON-RPC 中 path 使用 uplink/downlink 对象展开。
Binary-RPC 中可以为 path 分配 pathId：
  0x01 uplink
  0x02 downlink

每个 EQ band 可以使用 bandIndex 标识。
gainDb 可以使用定点数映射，例如 gainDbX10 表示 dB * 10。
```



示例：



```Plain Text
pathId:
  0x01 uplink
  0x02 downlink

presetId:
  0x00 flat
  0x01 voice
  0x02 music
  0x03 movie
  0xFF custom
```



但不要在 JSON 协议中暴露 pathId / presetId，数字 ID 只用于二进制映射或生成代码。



---



# 十六、验收标准



完成后应满足：



```Plain Text
1. 新增或更新 Audio EQ 配置协议文档。
2. 文档明确 EQ 属于 audio 域。
3. 文档明确上行/下行通过 uplink/downlink path 区分。
4. 文档包含 4 个方法：
   audio.getEqCapabilities
   audio.getEqConfig
   audio.setEqConfig
   audio.resetEqConfig
5. 文档包含事件：
   audio.eqConfigChanged
6. capabilities 示例包含默认值、范围、preset、bandCount、bands。
7. getEqConfig 示例返回当前值。
8. setEqConfig 示例支持单 path、双 path、preset、自定义 bands。
9. resetEqConfig 示例支持全部重置、指定 path 重置、指定字段重置。
10. eqConfigChanged 事件只用于 EQ 配置变化。
11. 文档说明与 audio.getAlgorithmCapabilities 的关系。
12. 文档说明与 capability.getAll 的关系。
13. 文档说明错误处理策略。
14. 如果有方法/事件注册表，请同步补充对应 method/event entries。
15. 如果有 capability 注册表，请补充 audio.eq 能力。
```



---



# 十七、不要做的事情



不要做：



```Plain Text
1. 不要拆成 audio.setUplinkEqConfig 和 audio.setDownlinkEqConfig。
2. 不要把 EQ 强行塞进 audio.setAlgorithmConfig 的通用算法对象里。
3. 不要只返回 accepted，set/reset 成功后必须返回最终生效配置。
4. 不要用 status 表示当前 EQ 开关；开关用 enabled，生命周期用 state，操作结果才用 status。
5. 不要在 JSON 协议里暴露 pathId、presetId 这类二进制 ID。
6. 不要把 EQ 事件命名为 audio.eqChanged；应使用 audio.eqConfigChanged。
7. 不要把周期性音频数据或 beam/DOA 结果放进 EQ 协议。
```



请按以上要求实现。修改完成后，请列出：



```Plain Text
1. 新增/修改的文件；
2. 新增的方法；
3. 新增的事件；
4. 新增的 capability ID；
5. 是否同步更新了方法注册表、事件注册表和 capability 注册表；
6. 采用的 EQ 配置结构示例。
```

