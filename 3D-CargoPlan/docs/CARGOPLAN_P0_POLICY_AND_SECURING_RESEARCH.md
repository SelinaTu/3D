<!-- #created 11/08/2026 -->
# 一期加固与港口政策数据接入调研

核对日期：2026-10-30。公开资料与文档调研；未申请账户、调用需授权的接口、购买产品或对竞品做实测。

## 加固：竞品做到了什么

| 产品 | 公开资料 | 本轮判断 |
| --- | --- | --- |
| [MariLash](https://en.mariterm.se/cargo-securing/marilash/) | 专业货物固定规划，介绍按CSS/CTU规则计算 | 有现成工程工具；收费、接口及适用我国场景需询问，不能视为已接入 |
| [CargoStow](https://www.cargostow.com/) | 宣传3D装载、D-ring、绑扎强度和安全系数 | 页面标注产品开发中，未实测，不能当成已成熟可用能力 |
| [MacGregor Lashmate](https://www.macgregor.com/contentassets/0b58a00979d4485192849886f87e23e6/container-cargo-system-booklet-2025.pdf) | 船舶上集装箱与船体绑扎评估 | 船舶箱位与箱内件货加固是不同问题，不能直接等同 |
| [EasyCargo人工编辑](https://help.easycargo3d.com/article/60/manual-adjustments-of-an-automatically-calculated-load-plan-) | 自动结果可手动移动、旋转及提示无效位置 | 本轮查到编辑功能；未查到足够证据确认其具备通用绑扎工程计算，不能断言没有 |

一期按用户要求仅做**加固需求提醒和货单字段规范**：记录需不需要固定、原因、可接触/禁触面、固定方式或材料（如客户提供）、来源和人工确认状态。缺少强度、摩擦、锚点、工况等参数时标待确认；不计算绑带数量或出具工程结论。

## 政策/通关：可接什么，具体困难是什么

| 具体来源 | 实际数据/技术 | 接入路径与困难 | 一期建议 |
| --- | --- | --- | --- |
| [中国国际贸易单一窗口开放平台客户端手册](https://sc.singlewindow.cn/singlewindow/20241105/f10a99c1_1730793649637.pdf) | 货物申报、舱单、运输工具等报文导入及回执 | 这是企业业务数据交换，需实际企业身份、授权、签名/加密及对接测试；公开文档不等于开放匿名港口规则API；当前接口可用性需业务方确认 | 先建申报资料与回执数据映射，等待企业账户后联调 |
| [OpenInfoAPI-Ports](https://github.com/portdebarcelona/OpenInfoAPI-Ports) | 巴塞罗那港发起的港口数据API规范/开源定义；包含[港口通知](https://github.com/portdebarcelona/OpenInfoAPI-Ports/blob/main/docs/CatalogueIntroduction.md)等信息类别，规范为CC0 | 规范不是全球港口数据集或开箱即用的所有港口实时服务；各港是否实现、具体端点、访问权和更新频率需逐港核实 | 采用其分类/接口设计作适配参考；先验证一个实际实现 |
| [英国HMRC Trade Tariff API](https://hub.trade-tariff.service.gov.uk/) | 英国商品编码、关税、配额及贸易措施；官网提供密钥管理 | 需注册密钥；英国贸易税则≠全球港口政策或现场通关结果；本次网页403，未实际申请或调用 | 可作为单国结构化规则接入验证候选 |
| [美国ITA API](https://developer.trade.gov/apis) | 美国出口相关限制名单和部分自贸协定税率 | 注册、额度、适用国和名单版本需逐项核实；仅适合美国业务，不能套用其他国家 | 按用户实际贸易走廊再接入 |
| [DCSA Commercial Schedules](https://reference.dcsa.org/content/standards/releases/commercial-schedules/v1/cs-v1-endpoint-overview) | 点对点航程、港口船期、船舶船期接口规范 | 标准不是数据本身；需船司/数据方授权；船期不等于政策、报价或舱位 | 一期不做航线规划，需要时与外部工具衔接 |
| [WTO API](https://apiportal.wto.org/) | 国家层面的贸易指标和关税等数据 | 主要是统计/市场准入指标，字段、时效和细分不能假定满足每票货/港口合规判断 | 仅作研究与参考，不做自动放行依据 |
| 公开港口、海关、船司官网 | 适用规则公告、作业时间、收费、单证与截止通知 | 页面结构/PDF多样，发布与生效时间、国家/码头/船司适用范围不同；公开页面也要核查访问条款，私人订单/动态回执不能靠公开抓取获得 | 选择实际走廊的官方页面，保留原文链接、更新日期、适用主体、人工复核；再做自动更新与变更提示 |

工程上可以先做统一的“来源—规则—适用条件—有效期—证据—人工确认”数据结构，再逐项接API或合规抓取公开页面。**当前没有哪一个已验证的开源项目/API覆盖全球所有港口、国家规则、罚款、船期和企业真实通关状态。** 这是已调研范围的结论，不是断言不存在。

## 交互参考

[EasyCargo货物录入与编辑](https://help.easycargo3d.com/article/89/adding-items-to-the-load-plan-in-easycargo)：名称、颜色、尺寸、重量、数量、旋转/堆叠限制、分组；[手动布局](https://help.easycargo3d.com/article/60/manual-adjustments-of-an-automatically-calculated-load-plan-)支持移动和旋转并提示无效位置；[自定义货舱](https://help.easycargo3d.com/article/88/settings-options-when-optimising-a-load-plan)可调整空间。

CargoPlan一期：Excel导入、站点及顺序录入、货物列表与3D联动选择/颜色标记、编辑货物参数和规则、自定义车辆/柜体、自动求解及在模型支持范围内的手动调整。关键参数修改或拖动后重算或重新校验，保留版本并显示冲突。人工作业单是有序清单；同时输出可版本化的机器人友好任务数据。
