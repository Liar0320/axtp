# AXTP音频算法配置方案

请阅读当前 AXTP / 协议仓库，重点关注以下内容：



1. 协议域划分文档；

2. audio 域已有协议文档；

3. capability 能力查询与协商文档；

4. RPC 方法注册表；

5. 事件注册表；

6. ErrorCode / Result / State 命名规范；

7. 现有 JSON\-RPC 示例与 Binary\-RPC 映射示例。

    

目标：新增或完善一篇 **音频算法配置协议文档**，采用“配置对象按算法展开”的结构，覆盖以下算法配置：



```Plain Text
noiseSuppression
echoCancellation
autoGainControl
beamforming
dereverberation
voiceActivityDetection
directionOfArrival
howlingSuppression
```



需要实现并文档化以下接口：



```Plain Text
audio.getAlgorithmCapabilities
audio.getAlgorithmConfig
audio.setAlgorithmConfig
audio.resetAlgorithmConfig
audio.algorithmConfigChanged
```



注意：本协议不采用下面这种元模型：



```JSON
{
  "algorithm": "noise_suppression",
  "config": {
    "enabled": true,
    "level": 2
  }
}
```



而是采用“算法对象直接作为配置对象字段”的模型：



```JSON
{
  "noiseSuppression": {
    "enabled": true,
    "level": 2,
    "mode": "auto"
  }
}
```



---



# 一、文档目标



请新增或更新音频协议文档，建议文件名为：



```Plain Text
docs/protocol/audio/AudioAlgorithmConfig.md
```



如果仓库已有 audio 协议目录，请放入现有目录；如果已有统一注册表文档，也需要同步补充方法与事件。



文档需要说明：



```Plain Text
1. 音频算法配置属于 audio 域。
2. 本协议用于运行时音频算法参数配置。
3. 产测校准、算法 license 写入、工厂标定不属于本协议，应放入 diagnostic 域。
4. 本协议采用“配置对象按算法展开”的 JSON 结构。
5. 支持查询当前值、查询默认值与能力范围、设置部分参数、重置默认值、参数变化事件。
```



---



# 二、命名规则



所有算法对象名使用 lowerCamelCase：



```Plain Text
noiseSuppression
echoCancellation
autoGainControl
beamforming
dereverberation
voiceActivityDetection
directionOfArrival
howlingSuppression
```



不要使用：



```Plain Text
noise-suppression
noise_suppression
NS
AEC
AGC
BF
```



可以在文档中说明这些算法对象对应常见缩写：



```Plain Text
noiseSuppression = NS / ANS
echoCancellation = AEC
autoGainControl = AGC
beamforming = BF
dereverberation = DR
voiceActivityDetection = VAD
directionOfArrival = DOA
howlingSuppression = AHS / FBS
```



但协议字段必须使用完整 lowerCamelCase 名称。



---



# 三、核心接口清单



需要新增或更新以下方法：



```Plain Text
audio.getAlgorithmCapabilities
audio.getAlgorithmConfig
audio.setAlgorithmConfig
audio.resetAlgorithmConfig
```



需要新增或更新以下事件：



```Plain Text
audio.algorithmConfigChanged
```



这些接口全部属于 audio 域。



---



# 四、audio\.getAlgorithmCapabilities



## 4\.1 用途



`audio.getAlgorithmCapabilities` 用于查询设备支持的音频算法、每个算法支持的属性、默认值、范围、枚举值、是否需要重启音频链路后生效等信息。



它回答：



```Plain Text
这个设备支持哪些音频算法？
每个算法有哪些可配置属性？
属性类型是什么？
默认值是什么？
取值范围是什么？
是否支持当前产品？
修改后是否需要重启音频链路？
```



## 4\.2 请求



支持查询全部：



```JSON
{
  "method": "audio.getAlgorithmCapabilities",
  "params": {}
}
```



支持按算法对象查询：



```JSON
{
  "method": "audio.getAlgorithmCapabilities",
  "params": {
    "items": ["noiseSuppression", "echoCancellation"]
  }
}
```



## 4\.3 返回结构



返回结构必须按算法对象展开：



```JSON
{
  "result": {
    "noiseSuppression": {
      "supported": true,
      "displayName": "Noise Suppression",
      "properties": {
        "enabled": {
          "type": "boolean",
          "defaultValue": true,
          "description": "Enable or disable noise suppression."
        },
        "mode": {
          "type": "enum",
          "defaultValue": "auto",
          "values": ["off", "low", "medium", "high", "auto"]
        },
        "level": {
          "type": "uint8",
          "defaultValue": 2,
          "range": {
            "min": 0,
            "max": 3,
            "step": 1
          }
        }
      }
    }
  }
}
```



## 4\.4 能力字段定义



每个算法对象建议包含：



```Plain Text
supported: boolean
  当前设备是否支持该算法。

displayName: string
  面向 UI 的显示名称。

properties: object
  参数能力定义表。
```



每个属性能力对象可以包含：



```Plain Text
type:
  boolean / enum / uint8 / uint16 / uint32 / int32 / float / string / object / array

defaultValue:
  默认值。

range:
  数值范围。包含 min / max / step。

values:
  enum 可选值列表。

unit:
  单位，例如 ms / dB / degree。

requiresAudioRestart:
  修改该参数后是否需要重启音频链路。

description:
  简短说明。
```



---



# 五、audio\.getAlgorithmConfig



## 5\.1 用途



`audio.getAlgorithmConfig` 用于查询当前生效的算法参数值。



## 5\.2 请求



查询全部：



```JSON
{
  "method": "audio.getAlgorithmConfig",
  "params": {}
}
```



查询指定算法对象：



```JSON
{
  "method": "audio.getAlgorithmConfig",
  "params": {
    "items": ["noiseSuppression", "autoGainControl"]
  }
}
```



## 5\.3 返回结构



返回结构按算法对象展开：



```JSON
{
  "result": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 2
    },
    "autoGainControl": {
      "enabled": true,
      "targetLevelDb": -18,
      "maxGainDb": 24,
      "attackTimeMs": 10,
      "releaseTimeMs": 200
    }
  }
}
```



要求：



```Plain Text
1. 返回当前最终生效值。
2. 如果某个算法不支持，可以不返回，或返回 supported=false。推荐能力查询返回 supported=false，config 查询只返回支持的算法。
3. getAlgorithmConfig 不应返回默认值和范围；默认值和范围由 getAlgorithmCapabilities 返回。
```



---



# 六、audio\.setAlgorithmConfig



## 6\.1 用途



`audio.setAlgorithmConfig` 用于设置一个或多个算法对象的参数。



必须支持部分更新：



```Plain Text
只传入的字段会被更新；
未传入字段保持不变。
```



## 6\.2 请求示例：设置单个算法



```JSON
{
  "method": "audio.setAlgorithmConfig",
  "params": {
    "noiseSuppression": {
      "enabled": true,
      "level": 3
    }
  }
}
```



## 6\.3 请求示例：一次设置多个算法



```JSON
{
  "method": "audio.setAlgorithmConfig",
  "params": {
    "noiseSuppression": {
      "enabled": true,
      "level": 3
    },
    "echoCancellation": {
      "enabled": true,
      "tailLengthMs": 256
    },
    "autoGainControl": {
      "enabled": true,
      "targetLevelDb": -18,
      "maxGainDb": 24
    }
  }
}
```



## 6\.4 返回结构



返回最终生效值，并标明状态：



```JSON
{
  "result": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 3
    },
    "state": "applied"
  }
}
```



如果一次设置多个算法：



```JSON
{
  "result": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 3
    },
    "echoCancellation": {
      "enabled": true,
      "tailLengthMs": 256
    },
    "autoGainControl": {
      "enabled": true,
      "targetLevelDb": -18,
      "maxGainDb": 24
    },
    "state": "applied"
  }
}
```



如果修改后需要重启音频链路：



```JSON
{
  "result": {
    "echoCancellation": {
      "enabled": true,
      "tailLengthMs": 256
    },
    "state": "pending_restart",
    "requiresAudioRestart": true
  }
}
```



## 6\.5 setAlgorithmConfig 规则



文档必须写明：



```Plain Text
1. setAlgorithmConfig 支持部分更新。
2. 未传入字段保持当前值不变。
3. 设备必须根据 getAlgorithmCapabilities 中声明的类型、范围、枚举值校验入参。
4. 不支持的算法对象必须返回 UnsupportedCapability 或 InvalidParams。
5. 不支持的属性必须返回 InvalidParams 或 UnsupportedParameter。
6. 设置成功后返回最终生效值，而不是只返回 accepted。
7. 如果参数需要重启音频链路，返回 state=pending_restart 和 requiresAudioRestart=true。
8. 如果一次设置多个算法，设备应尽量采用原子更新；如果无法原子更新，文档必须说明错误返回策略。
```



---



# 七、audio\.resetAlgorithmConfig



## 7\.1 用途



`audio.resetAlgorithmConfig` 用于恢复算法参数默认值。



必须支持：



```Plain Text
1. 重置全部算法；
2. 重置指定算法；
3. 重置指定算法的部分属性。
```



## 7\.2 重置全部算法



```JSON
{
  "method": "audio.resetAlgorithmConfig",
  "params": {
    "items": "all"
  }
}
```



## 7\.3 重置指定算法



```JSON
{
  "method": "audio.resetAlgorithmConfig",
  "params": {
    "items": ["noiseSuppression", "echoCancellation"]
  }
}
```



## 7\.4 重置指定算法的部分属性



```JSON
{
  "method": "audio.resetAlgorithmConfig",
  "params": {
    "items": {
      "noiseSuppression": ["level", "mode"],
      "autoGainControl": ["targetLevelDb", "maxGainDb"]
    }
  }
}
```



## 7\.5 返回结构



返回重置后的当前值：



```JSON
{
  "result": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 2
    },
    "state": "applied"
  }
}
```



规则：



```Plain Text
1. reset 后返回最终生效值。
2. 默认值来自 audio.getAlgorithmCapabilities 中的 defaultValue。
3. reset 同样可能返回 pending_restart。
```



---



# 八、audio\.algorithmConfigChanged 事件



## 8\.1 触发条件



当任意音频算法配置发生变化时发送：



```Plain Text
1. setAlgorithmConfig 成功；
2. resetAlgorithmConfig 成功；
3. profile 切换导致算法参数变化；
4. factory reset 导致算法参数变化；
5. 设备内部策略导致配置变化。
```



## 8\.2 事件格式



事件参数按算法对象展开：



```JSON
{
  "event": "audio.algorithmConfigChanged",
  "params": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 3
    },
    "reason": "user_request"
  }
}
```



一次变化多个算法：



```JSON
{
  "event": "audio.algorithmConfigChanged",
  "params": {
    "noiseSuppression": {
      "enabled": true,
      "level": 3
    },
    "echoCancellation": {
      "enabled": true,
      "tailLengthMs": 256
    },
    "reason": "user_request"
  }
}
```



reset 导致变化：



```JSON
{
  "event": "audio.algorithmConfigChanged",
  "params": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 2
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



# 九、算法对象与参数建议



请在文档中为以下 8 个算法对象给出第一版推荐参数。注意这些参数是建议基线，设备可以通过 capabilities 声明实际支持情况。



## 9\.1 noiseSuppression



```JSON
{
  "noiseSuppression": {
    "enabled": true,
    "mode": "auto",
    "level": 2
  }
}
```



参数：



```Plain Text
enabled: boolean
mode: off | low | medium | high | auto
level: uint8, 建议范围 0-3
```



## 9\.2 echoCancellation



```JSON
{
  "echoCancellation": {
    "enabled": true,
    "mode": "auto",
    "tailLengthMs": 128,
    "nlpLevel": 2
  }
}
```



参数：



```Plain Text
enabled: boolean
mode: off | low | medium | high | auto
tailLengthMs: uint32, 建议范围 64-512，单位 ms
nlpLevel: uint8, 建议范围 0-3
```



## 9\.3 autoGainControl



```JSON
{
  "autoGainControl": {
    "enabled": true,
    "targetLevelDb": -18,
    "maxGainDb": 24,
    "attackTimeMs": 10,
    "releaseTimeMs": 200
  }
}
```



参数：



```Plain Text
enabled: boolean
targetLevelDb: int32，单位 dB
maxGainDb: uint8，单位 dB
attackTimeMs: uint32
releaseTimeMs: uint32
```



## 9\.4 beamforming



```JSON
{
  "beamforming": {
    "enabled": true,
    "mode": "adaptive",
    "lookDirectionDeg": 0,
    "beamWidthDeg": 60
  }
}
```



参数：



```Plain Text
enabled: boolean
mode: fixed | adaptive | auto
lookDirectionDeg: int32，单位 degree，范围 -180 到 180
beamWidthDeg: uint32，单位 degree
```



## 9\.5 dereverberation



```JSON
{
  "dereverberation": {
    "enabled": true,
    "level": 2,
    "mode": "auto"
  }
}
```



参数：



```Plain Text
enabled: boolean
level: uint8，建议范围 0-3
mode: off | low | medium | high | auto
```



## 9\.6 voiceActivityDetection



```JSON
{
  "voiceActivityDetection": {
    "enabled": true,
    "sensitivity": 2,
    "hangoverMs": 200
  }
}
```



参数：



```Plain Text
enabled: boolean
sensitivity: uint8，建议范围 0-3
hangoverMs: uint32
```



## 9\.7 directionOfArrival



```JSON
{
  "directionOfArrival": {
    "enabled": true,
    "reportingEnabled": true,
    "reportIntervalMs": 100,
    "smoothingMs": 300
  }
}
```



参数：



```Plain Text
enabled: boolean
reportingEnabled: boolean
reportIntervalMs: uint32
smoothingMs: uint32
```



说明：



```Plain Text
directionOfArrival 配置用于声源方向估计。
具体方向上报事件可以复用 audio.beamInfoReported 或 audio.beamDirectionChanged。
```



## 9\.8 howlingSuppression



```JSON
{
  "howlingSuppression": {
    "enabled": true,
    "mode": "auto",
    "level": 2
  }
}
```



参数：



```Plain Text
enabled: boolean
mode: off | low | medium | high | auto
level: uint8，建议范围 0-3
```



---



# 十、完整 capabilities 示例



请在文档中加入一个完整但不要过长的 capabilities 示例，至少包含 noiseSuppression、echoCancellation、autoGainControl 三个算法对象。



示例结构必须按对象展开：



```JSON
{
  "method": "audio.getAlgorithmCapabilities",
  "params": {}
}
```



返回：



```JSON
{
  "result": {
    "noiseSuppression": {
      "supported": true,
      "displayName": "Noise Suppression",
      "properties": {
        "enabled": {
          "type": "boolean",
          "defaultValue": true
        },
        "mode": {
          "type": "enum",
          "defaultValue": "auto",
          "values": ["off", "low", "medium", "high", "auto"]
        },
        "level": {
          "type": "uint8",
          "defaultValue": 2,
          "range": {
            "min": 0,
            "max": 3,
            "step": 1
          }
        }
      }
    },
    "echoCancellation": {
      "supported": true,
      "displayName": "Echo Cancellation",
      "properties": {
        "enabled": {
          "type": "boolean",
          "defaultValue": true
        },
        "mode": {
          "type": "enum",
          "defaultValue": "auto",
          "values": ["off", "low", "medium", "high", "auto"]
        },
        "tailLengthMs": {
          "type": "uint32",
          "unit": "ms",
          "defaultValue": 128,
          "range": {
            "min": 64,
            "max": 512,
            "step": 32
          },
          "requiresAudioRestart": true
        },
        "nlpLevel": {
          "type": "uint8",
          "defaultValue": 2,
          "range": {
            "min": 0,
            "max": 3,
            "step": 1
          }
        }
      }
    },
    "autoGainControl": {
      "supported": true,
      "displayName": "Auto Gain Control",
      "properties": {
        "enabled": {
          "type": "boolean",
          "defaultValue": true
        },
        "targetLevelDb": {
          "type": "int32",
          "unit": "dB",
          "defaultValue": -18,
          "range": {
            "min": -36,
            "max": -6,
            "step": 1
          }
        },
        "maxGainDb": {
          "type": "uint8",
          "unit": "dB",
          "defaultValue": 24,
          "range": {
            "min": 0,
            "max": 36,
            "step": 1
          }
        }
      }
    }
  }
}
```



---



# 十一、完整 config 示例



查询全部：



```JSON
{
  "method": "audio.getAlgorithmConfig",
  "params": {}
}
```



返回：



```JSON
{
  "result": {
    "noiseSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 2
    },
    "echoCancellation": {
      "enabled": true,
      "mode": "auto",
      "tailLengthMs": 128,
      "nlpLevel": 2
    },
    "autoGainControl": {
      "enabled": true,
      "targetLevelDb": -18,
      "maxGainDb": 24,
      "attackTimeMs": 10,
      "releaseTimeMs": 200
    },
    "beamforming": {
      "enabled": true,
      "mode": "adaptive",
      "lookDirectionDeg": 0,
      "beamWidthDeg": 60
    },
    "dereverberation": {
      "enabled": true,
      "level": 2,
      "mode": "auto"
    },
    "voiceActivityDetection": {
      "enabled": true,
      "sensitivity": 2,
      "hangoverMs": 200
    },
    "directionOfArrival": {
      "enabled": true,
      "reportingEnabled": true,
      "reportIntervalMs": 100,
      "smoothingMs": 300
    },
    "howlingSuppression": {
      "enabled": true,
      "mode": "auto",
      "level": 2
    }
  }
}
```



---



# 十二、错误处理



请补充错误场景：



```Plain Text
UnsupportedCapability:
  算法对象不支持，例如设备不支持 dereverberation。

InvalidParams:
  参数类型错误、范围越界、枚举值非法。

UnsupportedParameter:
  算法支持，但某个参数不支持。

Conflict:
  参数组合冲突，例如 beamforming.mode=fixed 但缺少 lookDirectionDeg。

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
    "message": "noiseSuppression.level out of range",
    "data": {
      "field": "noiseSuppression.level",
      "min": 0,
      "max": 3
    }
  }
}
```



---



# 十三、与 capability 域关系



请在文档中说明：



```Plain Text
audio.getAlgorithmCapabilities 是 audio 域内的细粒度算法参数能力查询。

capability.getAll 用于全局能力发现，可以声明设备是否支持 audio.algorithm 这个能力块，以及支持哪些方法。

二者不是重复关系：

capability.getAll:
  发现有没有 audio.algorithm 能力块。

audio.getAlgorithmCapabilities:
  查询每个算法和每个参数的详细默认值、范围和枚举。

Capability ID 使用 domain.feature 能力块；algorithmConfig 是方法/事件或 schema 层面的配置对象名，
不作为独立 capability ID。
```



建议在 capability 中增加能力 ID：



```Plain Text
audio.algorithm
```



对应方法：



```Plain Text
audio.getAlgorithmCapabilities
audio.getAlgorithmConfig
audio.setAlgorithmConfig
audio.resetAlgorithmConfig
```



事件：



```Plain Text
audio.algorithmConfigChanged
```



---



# 十四、与 audio beam / DOA 上报关系



请说明：



```Plain Text
directionOfArrival 是配置项，用于控制 DOA 算法是否启用、是否上报、上报间隔、平滑时间等。

实际 DOA / beam 结果上报不放在 algorithmConfigChanged 中。

实际 beam/DOA 结果应使用：

audio.beamInfoReported
audio.beamDirectionChanged

algorithmConfigChanged 只表示配置变化，不表示算法结果变化。
```



---



# 十五、Binary\-RPC / TLV 映射建议



如果仓库已有 Binary\-RPC/TLV 映射文档，请补充映射建议：



```Plain Text
JSON-RPC 中算法对象采用 lowerCamelCase 字段。
Binary-RPC 中可以为每个算法对象分配 algorithmId。
每个参数可以分配 parameterId。
但语义仍应与 JSON 对象结构保持一致。
```



示例：



```Plain Text
algorithmId:
  0x01 noiseSuppression
  0x02 echoCancellation
  0x03 autoGainControl
  0x04 beamforming
  0x05 dereverberation
  0x06 voiceActivityDetection
  0x07 directionOfArrival
  0x08 howlingSuppression
```



但不要在 JSON 协议中暴露这些数字 ID，数字 ID 只用于二进制映射或生成代码。



---



# 十六、验收标准



完成后应满足：



```Plain Text
1. 新增或更新音频算法配置协议文档。
2. 文档明确采用“配置对象按算法展开”模型。
3. 文档包含 8 个算法对象：
   noiseSuppression
   echoCancellation
   autoGainControl
   beamforming
   dereverberation
   voiceActivityDetection
   directionOfArrival
   howlingSuppression
4. 文档包含 4 个方法：
   audio.getAlgorithmCapabilities
   audio.getAlgorithmConfig
   audio.setAlgorithmConfig
   audio.resetAlgorithmConfig
5. 文档包含事件：
   audio.algorithmConfigChanged
6. 每个方法都有请求/响应示例。
7. capabilities 示例包含当前值之外的默认值、范围、枚举值、参数类型。
8. getAlgorithmConfig 示例返回当前值。
9. setAlgorithmConfig 示例支持部分更新和一次设置多个算法。
10. resetAlgorithmConfig 示例支持全部重置、指定算法重置、指定属性重置。
11. algorithmConfigChanged 事件只用于配置变化，不用于 DOA/beam 结果上报。
12. 文档说明与 capability.getAll 的关系。
13. 文档说明产测/校准/license 写入不属于 audio.algorithm 能力块，而属于 diagnostic。
14. 文档说明错误处理策略。
15. 如果有方法/事件注册表，请同步补充对应 method/event entries。
16. 如果有 capability 注册表，请补充 audio.algorithm 能力。
```



---



# 十七、不要做的事情



不要做：



```Plain Text
1. 不要采用 algorithm + config 这种元模型作为主协议结构。
2. 不要把算法对象命名成 noise_suppression 或 noise-suppression。
3. 不要为每个算法单独新增一套方法，比如 audio.setNoiseSuppressionConfig。
4. 不要把 DOA/beam 结果上报放到 algorithmConfigChanged。
5. 不要把算法 license、产测标定、工厂写入放到 audio.algorithm 能力块。
6. 不要用 status 表示当前启用状态；开关用 enabled，当前生命周期用 state，操作结果才用 status。
7. 不要只返回 accepted，set/reset 成功后必须返回最终生效配置。
```



请按以上要求实现。修改完成后，请列出：



```Plain Text
1. 新增/修改的文件；
2. 新增的方法；
3. 新增的事件；
4. 新增的 capability ID；
5. 是否同步更新了方法注册表、事件注册表和 capability 注册表；
6. 采用的配置结构示例。
```

