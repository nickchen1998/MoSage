# 發佈到 npm

MoSage 用 GitHub Actions 自動測試與發佈：

- **CI**（`.github/workflows/ci.yml`）：每次 push 到 `main` 與每個 PR，執行 Biome、型別檢查、單元／API 測試，
  以及在 Linux、macOS、Windows（Node 20／22／24）上打包 → `npx mosage init` → CLI → 伺服器的端對端測試，
  其中一組還會用 Chromium 實際操作介面。
- **Release**（`.github/workflows/release.yml`）：推送 `v*.*.*` 版本 tag 時，重跑所有檢查後發佈到 npm
  （附 provenance 來源證明），並建立 GitHub Release。

## 第一次設定（只做一次）

### 1. 註冊 npm 帳號並開啟兩步驟驗證

1. 到 <https://www.npmjs.com/signup> 註冊。
2. 登入後到 **Account → Two-Factor Authentication** 開啟 2FA（建議用驗證器 App 或安全金鑰）。

套件名稱 `mosage` 目前在 npm 上沒有人使用，第一次發佈時就會登記在你的帳號下。

### 2. 建立發佈用的 Access Token

1. npm 右上角頭像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**。
2. 填寫：
   - **Token name**：`mosage-github-actions`
   - **Bypass two-factor authentication (2FA)**：勾選（GitHub Actions 無法輸入驗證碼）
   - **Expiration**：可選的最長期限
   - **Packages and scopes → Permissions**：`Read and write`，範圍選 **All packages**
     （套件還不存在，無法只選 `mosage`；第一次發佈後可以改成只限 `mosage`，或改用第 5 步的免 token 方式）
3. 產生後**立刻複製**，這個值只會顯示一次。

### 3. 把 token 存進 GitHub

1. 打開 <https://github.com/nickchen1998/MoSage/settings/secrets/actions>。
2. **New repository secret**：Name 填 `NPM_TOKEN`，Secret 貼上剛剛的 token。

### 4. 發佈第一個版本

把開發分支合併進 `main` 之後，任選一種：

- **在 GitHub 上按按鈕**：Actions → **Release** → **Run workflow**，分支選 `main`，
  **取消勾選 dry-run** 後執行。會發佈 `package.json` 裡的版本，並自動建立 `v0.1.0` tag 與 GitHub Release。
- **推送 tag**：

  ```bash
  git checkout main && git pull
  git tag v0.1.0            # package.json 已經是 0.1.0
  git push origin v0.1.0
  ```

到 <https://github.com/nickchen1998/MoSage/actions> 看 **Release** 流程，完成後：

```bash
npx mosage@latest init test-project
```

### 5.（建議）改用 Trusted Publishing，拿掉 token

npm 的 Trusted Publishing 用 GitHub 的 OIDC 身分直接驗證，不需要任何長期有效的 token，最安全。
套件第一次發佈之後：

1. 到 <https://www.npmjs.com/package/mosage/access>（套件頁 → **Settings**）。
2. **Trusted Publisher** → 選 **GitHub Actions**，填入：
   - Organization or user：`nickchen1998`
   - Repository：`MoSage`
   - Workflow filename：`release.yml`
   - Environment：留空
3. 同一頁的 **Publishing access** 建議改成 *Require two-factor authentication and disallow tokens*。
4. 刪除 GitHub 上的 `NPM_TOKEN` secret，並在 npm 撤銷剛才的 token。

之後的發佈完全不需要 secret，workflow 不用改。

## 之後每次發佈

```bash
npm version patch        # 修正：0.1.0 → 0.1.1
npm version minor        # 新功能：0.1.1 → 0.2.0
git push --follow-tags
```

`npm version` 會修改 `package.json`、建立 commit 與 tag；推上去後 GitHub Actions 自動完成其餘步驟。
也可以只把 `package.json` 的版本改好合併進 `main`，再用 Actions → **Release** → **Run workflow**（取消 dry-run）發佈。
保留 dry-run 勾選則只演練、不發佈。
