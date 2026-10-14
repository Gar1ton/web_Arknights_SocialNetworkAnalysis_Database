# 方舟关系图谱

明日方舟剧情人物关系的交互式浏览页：**首页 → 剧情目录 → 关系图**。数据来自 Amiya SNA 项目（`D:\Arknights_SNA`）的 v2 构建结果，只移植三类内容：

- **人际态度（IPC）**：每组关系分 A→B、B→A 两个方向，各有友善度、支配度（−1…1）、情感强度、可信度、依据事件数，并归入八种类型（友好、热情主动、主导、傲慢算计、冷淡、疏离回避、顺从、友善配合）。
- **关系网络（SNA）**：关系数、主动/被动关系数、发言数、中介中心性、社群划分；每张图的关系数、双向比例、人均关系、网络密度和关系类型分布。
- **大五人格**：开放性、尽责性、外向性、宜人性、神经质，按 0–100 显示，附性格简述和每项评分依据。

台词原文、引用、事件摘要、说话风格和口头禅**不导出**。所有数值都是大模型对台词的解读，可能有误，不是官方设定。

React、TypeScript、Vite、D3 force、Canvas 2D 与 SVG。字体本地打包，运行时只读取本站的 `data/` 静态文件，没有外部请求。

## 本地运行

```sh
npm ci
npm run dev
```

打开 http://localhost:4178 。构建：`npm run build`；验证：`npm test`；生产预览：`npm run preview`。

## 数据

`public/data/` 由 `scripts/build_data.py` 生成（只用 Python 标准库，约 3 秒，结果逐字节可复现）：

```sh
python3 -I scripts/build_data.py \
  --db         <v2 库副本>/realtime_test.db \
  --groups     /mnt/d/Arknights_SNA/2.cleaned/snapshots/fullstory_20261011/groups.json \
  --fullgraph  /mnt/d/Arknights_SNA/5.fullgraph/fullgraph_run_fg-20261014-aeecf5e2.json \
  --characters /mnt/d/Arknights_SNA/1.raw/reference_tables/character_table.json
```

v2 库位于 `3.processed/fullstory_20261011-arc15-noeval/provenance/snapshots/stage3_tail_fix_final/realtime_test.db`。脚本以 `mode=ro&immutable=1` 只读打开；在 `/mnt/d` 上扫描很慢，建议先复制到 WSL 本地盘再运行。源目录不会被写入。各输入的 sha256 记录在 `manifest.json` 的 `info.sources` 中。

| 输出 | 内容 |
|---|---|
| `manifest.json` | 数据版本、总量、每张图的标题、分类、剧情顺序、角色数、关系数、关系最多的三人 |
| `archives/<id>.json` | 一张图的角色（含人格画像）、关系对、社群和网络概况 |

生成 428 张图；**这一版前端只显示主线、活动、密录三类，共 417 段剧情**。「总览」合并总表（数据还要调整）和集成战略暂时下线，数据文件仍保留在 `public/data/`，恢复时改 `src/archives.ts` 的 `categories` 即可：

| 分类 | 数量 | id | 来源 |
|---|---|---|---|
| 总览 | 5 | `all`、`all-main`、`all-event`、`all-record`、`all-rogue` | `5.fullgraph` 合成卡片：按剧情顺序跨章节合并计算，只含具名角色（「含全部 NPC」卡片有 5,694 个节点，浏览器渲染过重，未收录） |
| 主线 | 18 | `main-00` … `main-17` | 每章一张 |
| 活动 | 76 | `event-001` … | 按 `groups.json` 剧情顺序编号 |
| 密录 | 323 | `record-001` … | 同上；`密录 · ` 中有 1 段没有任何关系记录，未生成 |
| 集成战略 | 6 | `rogue-1` … `rogue-6` | 每季一张 |

处理规则：

- 关系取自 `impressions`，跳过 `confidence = 0` 的占位关系（两人同场但未评估，共 5,671 条）。同一方向有多条时取可信度最高的一条，与 Moirai 查看器一致。
- **发言数**：本图范围内该角色在 `raw_messages` 中的台词条数。
- **同场事件 / 关系强度**：两人同为 `events.participants` 的事件数；关系强度为 `log(1+n) / log(1+本图最大值)`，下限 0.08。
- **社群**：以 `1 + log(1+同场事件数)` 为权重做确定性 Louvain；最大的至多 9 个社群（不少于 3 人）单独着色，其余归入「其他」。
- **中介中心性**：无向、无权 Brandes 算法，归一化到 0–1。
- **大五人格**：库内为 −1…1，按 Moirai 的规则 `round((x+1)/2×100)` 换算；≥65 为高、≤34 为低。人格是全剧情画像，在每张图里相同。
- **英文名**：只从官方角色表取 `appellation` 字段。

## 界面

- 剧情目录：主线、活动、密录三类，按剧情顺序排列，可搜索剧情名、章节或角色名；一次显示 24 张，可继续加载。
- 关系图：全图、关系圈（直接相关 / 再往外一层）、环形图三种视图；按社群聚集、自由分布、环形排列三种布局。
- 连线颜色可按社群、关系类型（IPC 八类）、友善度或支配度显示，底部图例随之切换。
- 默认布局保证节点中位间距约为「连线长度」的 0.8 倍（默认 80），大图会超出画面，可拖动平移、滚轮缩小（最低 30%），或点「显示全图」按钮。
- 角色多于 120 人时，默认隐藏发言少的角色，侧栏会注明隐藏了多少人，可在「画布设置 → 最少发言数」调整。
- 背景流场在关系图页默认亮度为 0（不渲染，节省性能），可在「画布设置 → 背景动效」打开；首页和剧情目录固定保留背景。
- 角色名可在「画布设置」调整大小（0.6–2 倍）。
- 角色详情（头像处暂只显示图案）：性格简述、关系数、发言数、中介中心性、大五人格及评分依据、IPC 坐标图（实心点为 TA 对别人，空心点为别人对 TA）、关系列表。
- 关系详情：两个方向分别显示类型、友善度、支配度、情感强度、可信度和依据事件数，并画在同一张 IPC 坐标图上。
- 只提供图片导出：当前可见网络的 SVG，范围包含全部可见角色（不限于屏幕内的部分）。
- 背景流场、粒子、配色、拖拽、缩放、键盘操作和移动端适配沿用原有实现。

快捷键：剧情目录页 `/` 聚焦搜索；空格暂停/继续动效，Esc 取消选择，R 重置布局。侧栏标签支持方向键切换。

## 代码位置

- `scripts/build_data.py`：数据导出、社群和中心性计算
- `src/data.ts` / `src/archives.ts`：数据类型、IPC 八类名称和颜色、数据加载与搜索
- `src/App.tsx`：路由、关系图工作台、筛选
- `src/Landing.tsx` / `src/Library.tsx`：首页与剧情目录
- `src/Details.tsx` / `src/IpcChart.tsx`：角色与关系详情、IPC 坐标图
- `src/Graph.tsx` / `src/layout.ts` / `src/colors.ts`：SVG 关系图、布局与配色
- `src/FlowField.tsx` / `src/particles.ts` / `src/gravity.ts`：背景流场
- `src/settings.ts` / `src/export.ts`：设置校验、持久化与导出
- `tests/`：全部 428 个数据文件的一致性、无原文检查、布局、搜索、路由与长时粒子模拟

## 已知局限

- 总览合并图（本版未显示）来自离线合成重放，不含 LLM 复核，与单章节图中的同一对关系可能不同（详见 `D:\Arknights_SNA\5.fullgraph\README.md`）。
- 无名 NPC 是场景级节点，不同剧情里的同名 NPC 是不同的人。
- 数据为 v2 候选版本，尚未正式发布，数字可能变化。

## 团队与联系

GitHub：[@Gar1ton](https://github.com/Gar1ton)、[@MKiyoaki](https://github.com/MKiyoaki)　联系：zefeng.1.wu@kcl.ac.uk

## 声明

非官方项目，与鹰角网络（Hypergryph）及其他权利方无关联。角色名称与设定的权利归原权利人。IPC、大五人格与关系数值由大模型（`arc:chat`）生成，未经人工核对，请勿当作原作事实引用。
