---
'mosage': minor
---

內建圖表與引用文獻

- `<Chart>`：長條圖（直式、橫式、群組、堆疊）、折線圖、圓餅圖，從 CSV 或內嵌資料畫出，顏色跟著文件配色，多系列使用色盲安全的固定順序；加上 `caption` 就編號成圖。PDF 裡是向量圖，Word 裡是圖片
- `<Cite>` 與 `<Bibliography>`：數字式（`[1]`、`[2，頁 12]`）或作者—年份式（（陳大文，2024））引用，參考文獻依 APA 排版，中文用全形標點；可以直接 `import refs from './refs.bib'` 匯入 Zotero、EndNote 匯出的 BibTeX
- `mosage check` 回報畫不出來的圖表、找不到的引用，並提醒列了但沒有引用的文獻
- 長的參考文獻清單在 `flow()` 裡會逐條分頁
