---
name: current-position
description: 解讀作者目前在 MoSage 介面上看的位置 —— 哪本書、哪一章、哪一段、選取了什麼文字。當作者說「這本」「這章」「這段」「這裡」「我正在看的」「選取的這句」「剛剛那段」，或任何沒有指名的指示代詞時使用。每一輪都要重新讀 .mosage/current.json，因為作者會在對話之間切換位置。
---

# 作者現在在看哪裡？

作者說「改這段」「這章寫短一點」時，通常不會說出書名或檔名 —— 他指的是**瀏覽器裡正在看的位置**。
問「哪一段？」之前，先讀介面寫出的這個檔案：

```
.mosage/current.json
```

（路徑相對於專案根目錄，也就是有 `mosage.yaml` 的資料夾。）

## 每一輪都重新讀

作者會在你的回合之間換章、捲動、選取別的文字。**只要這一輪用到指示代詞就重新讀取**，
即使你剛剛才讀過、即使作者的話聽起來像是延續（「再短一點」「這段也是」）。
讀完與上次比對 `book`、`chapter`、`block`、`selection`，以新的為準。

## 內容

```json
{
  "book": "ai-writing-guide",
  "bookTitle": "和 AI 一起寫書",
  "chapter": "03-workflow.md",
  "path": "books/ai-writing-guide/chapters/03-workflow.md",
  "chapterTitle": "第三章　工作流程",
  "view": "read",
  "section": "3.2 留言與修改建議",
  "block": {
    "index": 14,
    "line": 52,
    "type": "paragraph",
    "text": "作者在介面上選取文字之後……"
  },
  "selection": {
    "text": "選取的那幾個字",
    "line": 52
  },
  "updatedAt": "2026-09-26T08:15:42.120Z"
}
```

- `path` — 直接交給 Read / Edit。
- `view` — `library`（書架）、`outline`（大綱編排頁）、`read`（閱讀單章）、`book`（全書預覽）、`source`（原始碼編輯）。
- `section` — 該位置所屬的最近一個小節標題。
- `block` — 作者最後點選、或畫面最上方正在閱讀的區塊：`line` 是它在檔案中的起始行（從 1 起算），`text` 是前 120 字，用來確認你找對地方。
- `selection` — 作者目前選取的文字；沒有選取時為 `null`。「這句」「這幾個字」指的就是它。
- 在書架或大綱頁時，`chapter`、`block` 可能是 `null`。

## 新舊判斷

- `updatedAt` 在 5 分鐘內 → 直接採用。
- 超過 5 分鐘 → 先向作者確認位置再動手（介面可能沒開，或作者已經在別處）。
- 好幾個小時以上 → 忽略，直接問作者。
- 檔案不存在 → 介面還沒開過。不要自己建立或猜測，請作者指名，或打開 `npm run dev` 後再試。

## 什麼時候不需要

- 作者明確指名了書、章或段落。
- `apply-comments` 用留言標記本身定位，不需要這個檔案。
