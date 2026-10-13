# Terra · Relation Atlas

明日方舟 SNA 功能的独立交互 demo。三层体验：**Landing / Node Navigation / Node Setting**。

使用 React、TypeScript、Vite、D3 force、Canvas 2D 与 SVG。所有字体本地打包，运行时没有外部 API 或字体请求。

## 本地运行

```sh
npm ci
npm run dev
```

打开 http://localhost:4178 。构建：`npm run build`；验证：`npm test`；生产预览：`npm run preview`。

## 已实现

- 原创丝状流场、沿关系流动的粒子、节点光晕、轨道网格与四套配色。
- 48 个演示角色、6 个预设社群、115 条演示关系；全部明确标注，**不是真实 SNA 结果，也不是原作关系断言**。
- 中英文搜索、社群筛选、关联度／消息数／名称排序。
- 节点档案、人格轮廓、方向性关系、强度、情感与权力维度。
- 全局网络、1／2 跳邻域、弦图；社群力导向、D3 force、环形布局。
- 节点拖拽、画布平移、缩放、复位、锁定与防重叠。
- 可生效的引力、斥力、边长、权重、透明度、大小、标签、方向、消息阈值、粒子参数。
- 本地设置持久化，键盘节点／关系操作，减少动态效果偏好，移动端适配。
- 当前可见网络的 SVG、JSON 和 CSV 导出。

快捷键：空格暂停／继续动效，Esc 取消选择，R 重置布局；在输入或交互控件聚焦时不抢占快捷键。

## 独立边界

本项目没有连接 8767 批处理服务，没有读取真实分析产物，也没有修改 moirai 或相关项目。仅只读参考其节点档案、关系属性和参数语义，前端独立实现。

本 demo 使用 D3 的弹簧布局，**不将它标称为 ForceAtlas2、FR、KK 或 SFDP**。社群是 fixture 中的预设分组，未运行 Leiden。Moirai 的后台编辑、删除、重分析、身份绑定与其他面板不属于本演示。

## 数据接入位置

`src/data.ts` 定义 `AtlasNode` 与 `AtlasEdge`。目前数据完全确定性生成。后续可在此边界接入分析产物，保留 UI、布局和导出层。

- `src/App.tsx`：三个页面、筛选、详情与状态
- `src/Graph.tsx`：SVG 图、交互、关系动效
- `src/FlowField.tsx`：原创流场粒子
- `src/layout.ts`：布局与曲线
- `src/settings.ts`：设置范围、校验与持久化
- `src/export.ts`：可见网络导出
- `tests/graph.test.ts`：图一致性、邻域、布局边界与设置恢复验证

## 视觉参考

[Currents — Flow Field Studio](https://miaai-lab.github.io/Claude-Opus-5.5-100-HTML-Files/034-flow-field-studio.html)：暖色丝状流场、衬线字体与工作室控制栏。本项目为独立原创实现，无参考页面代码复制。

此项目是非官方展示原型，与《明日方舟》权利方无关联。
