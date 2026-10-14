# 方舟关系图谱

《明日方舟》剧情人物关系的交互式图谱：谁和谁有交集、彼此态度如何，以及每个角色的性格画像。

**在线访问：<https://gar1ton.github.io/web_Arknights_SocialNetworkAnalysis_Database/>**

> An interactive map of character relationships in the *Arknights* story. Each story chapter, event and operator record has its own network, with interpersonal attitudes (IPC), network metrics and Big Five personality profiles inferred by a language model from the story dialogue. Unofficial fan research project; the interface is in Chinese.

非官方项目，与鹰角网络（Hypergryph）及其他权利方无关联。所有数值都是大模型对台词的解读，可能有误，**不是官方设定**。

## 能看到什么

收录 **417 段剧情**：主线第 0–17 章、76 个活动、323 篇干员密录。每段剧情一张关系图。

**人际态度（IPC）**
每组关系分 A 对 B、B 对 A 两个方向，各用两个数描述：

- **友善度**：−1 敌对 … +1 友善
- **支配度**：−1 顺从 … +1 主导

按所在区域归为八类：友好、热情主动、主导、傲慢算计、冷淡、疏离回避、顺从、友善配合。另附情感强度、可信度和依据的事件数。

**关系网络（SNA）**

- 角色：关系数、发言数、中介中心性（越高越常处在其他角色彼此联系的路径上）
- 社群：按互动紧密程度自动划分的圈子
- 整张图：关系数、双向关系比例、人均关系、网络密度、关系类型分布

**大五人格**
开放性、尽责性、外向性、宜人性、神经质五项，0–100 分，附性格简述和每项的评分依据。人格是该角色在全部剧情中的整体画像。

## 怎么用

1. 首页点「选择一段剧情」，在目录里按主线 / 活动 / 密录筛选，或搜索剧情名、章节、角色名。
2. 进入关系图后：
   - 点击角色：查看人格画像、IPC 坐标图（实心点是 TA 对别人，空心点是别人对 TA）和关系列表。
   - 点击连线或关系列表中的类型：查看两个方向的态度。
   - 顶部切换「全图 / 关系圈 / 环形图」。
3. 右侧「画布设置」可以调整布局、连线颜色（按社群、关系类型、友善度、支配度）、角色名大小、最少发言数、背景动效和配色，并导出 SVG 图片。设置保存在你的浏览器里。

拖拽移动角色或画布，滚轮缩放，左下角工具栏可一键显示全图。快捷键：目录页 `/` 搜索；`空格` 暂停动效；`Esc` 取消选择；`R` 重置布局。

角色较多的图默认隐藏发言少的角色（侧栏会注明隐藏了多少人），可以在「最少发言数」里调低。

## 数据从哪来

数据来自 Amiya SNA 项目：把《明日方舟》全部剧情台词整理成对话，由 Moirai 记忆流水线调用大模型（`arc:chat`，Qwen 系）逐段抽取事件、人物画像和人物间关系。本站使用其 v2 候选版本（2026-10-14）。

本站**只发布派生数据**：角色名、IPC 数值、网络指标、大五人格分数、性格简述和评分依据。**不含**剧情原文、台词引用、事件摘要或任何游戏素材。

几点说明：

- **发言数**：本段剧情中该角色的台词条数。
- **关系强度**：按两人同场出现的事件数计算，在每张图内换算到 0–1。
- **社群**：Louvain 算法，以同场事件数为权重；最大的至多 9 个社群单独着色，其余归入「其他」。
- **中介中心性**：无向、无权，归一化到 0–1。
- 「两人同场但未评估」的占位关系不收录。
- 无名角色（如「信使」）按场景区分，不同剧情里的同名角色是不同的人。
- 英文名来自官方角色表的 `appellation` 字段。

## 本地运行

需要 Node.js 22 或更高版本。

```sh
npm ci
npm run dev      # http://localhost:4178
npm test         # 数据一致性、布局、滚动、粒子模拟等测试
npm run build    # 输出到 dist/
```

### 重新生成数据

`public/data/` 由 [scripts/build_data.py](scripts/build_data.py) 生成。脚本只用 Python 标准库，以只读方式打开数据库，同样的输入会得到逐字节相同的输出。运行时需要 Amiya SNA 项目的原始文件（不在本仓库中）：

```sh
python3 -I scripts/build_data.py \
  --db         <v2>/realtime_test.db \
  --groups     <Arknights_SNA>/2.cleaned/snapshots/fullstory_20261011/groups.json \
  --fullgraph  <Arknights_SNA>/5.fullgraph/fullgraph_run_fg-20261014-aeecf5e2.json \
  --characters <Arknights_SNA>/1.raw/reference_tables/character_table.json
```

各输入文件的 sha256 记录在 `public/data/manifest.json` 的 `info.sources` 中。

脚本还会生成 5 张跨剧情合并总表和 6 季集成战略的数据，这一版前端暂不显示。恢复显示只需修改 [src/archives.ts](src/archives.ts) 中的 `categories`。

## 部署

推送到 `main` 后，[GitHub Actions](.github/workflows/pages.yml) 会自动安装依赖、运行测试、构建，并发布到 GitHub Pages。

## 代码结构

| 位置 | 内容 |
|---|---|
| `scripts/build_data.py` | 数据导出，社群与中心性计算 |
| `public/data/` | 生成的数据：`manifest.json` 目录与 `archives/<id>.json` 每张图 |
| `src/data.ts`、`src/archives.ts` | 数据类型、IPC 八类名称与颜色、数据加载与搜索 |
| `src/App.tsx` | 路由、关系图页、筛选 |
| `src/Landing.tsx`、`src/Library.tsx` | 首页、剧情目录 |
| `src/Details.tsx`、`src/IpcChart.tsx` | 角色与关系详情、IPC 坐标图 |
| `src/Graph.tsx`、`src/layout.ts`、`src/colors.ts` | SVG 关系图、布局、配色 |
| `src/FlowField.tsx`、`src/particles.ts`、`src/gravity.ts` | 背景流场 |
| `src/screenScroll.ts` | 首页两屏限位滚动 |
| `src/settings.ts`、`src/export.ts` | 设置校验与保存、SVG 导出 |
| `tests/` | 测试 |

技术栈：React、TypeScript、Vite、d3-force、SVG 与 Canvas 2D。字体随站点打包，运行时不请求任何外部服务。

## 已知局限

- 数据为 v2 候选版本，尚未正式发布，数字可能变化。
- 关系与人格由大模型推断，未经人工逐条核对；可信度较低的关系请谨慎看待。
- 「博士选项」都记作博士的话，不代表某一条正史分支。

## 团队与联系

- GitHub：[@Gar1ton](https://github.com/Gar1ton)、[@MKiyoaki](https://github.com/MKiyoaki)
- 联系：zefeng.1.wu@kcl.ac.uk

如果你是权利方，或发现数据有问题，请发邮件联系，我们会尽快处理。

## 声明

《明日方舟》的角色、名称、剧情与设定的权利归鹰角网络及其许可方所有，本项目不主张任何相关权利。IPC、大五人格与关系数值由大模型生成，可能有错误、遗漏或偏见，请勿当作原作事实引用。本仓库目前未附许可证。
