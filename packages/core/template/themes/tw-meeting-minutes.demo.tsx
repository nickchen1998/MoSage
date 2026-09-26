import { type DesignSystem, type DocPage, useDocPageCount, useDocPageNumber } from 'mosage';
import type { CSSProperties, ReactNode } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#444444',
    accent: '#000000',
    rule: '#000000',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 26, h1: 22, h2: 22, h3: 22, body: 22, caption: 16 },
  margin: 94,
  leading: 1.5,
  radius: 0,
};

const page: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 'var(--od-margin)',
  background: 'var(--od-bg)',
  color: 'var(--od-text)',
  fontFamily: 'var(--od-font-body)',
  fontSize: 'var(--od-size-body)',
  lineHeight: 'var(--od-leading)',
  position: 'relative',
};

const Title = ({ children }: { children: ReactNode }) => (
  <h1
    style={{
      fontFamily: 'var(--od-font-heading)',
      fontSize: 'var(--od-size-title)',
      fontWeight: 400,
      textAlign: 'center',
      letterSpacing: '0.2em',
      textIndent: '0.2em',
      margin: '0 0 24px',
    }}
  >
    {children}
  </h1>
);

const Entry = ({ no, label, children }: { no: string; label: string; children?: ReactNode }) => (
  <div style={{ display: 'flex', marginTop: 6 }}>
    <span style={{ flex: 'none', width: '2em' }}>{no}</span>
    <div style={{ flex: 1 }}>
      {label}：{children}
    </div>
  </div>
);

const ChairAndClerk = ({ chair, clerk }: { chair: string; clerk: string }) => (
  <div style={{ display: 'flex', marginTop: 6 }}>
    <span style={{ flex: 'none', width: '2em' }}>三、</span>
    <div style={{ flex: 1, display: 'flex' }}>
      <span style={{ flex: 1 }}>主持人：{chair}</span>
      <span style={{ flex: 1 }}>紀錄：{clerk}</span>
    </div>
  </div>
);

const Item = ({ no, children }: { no: string; children: ReactNode }) => (
  <div style={{ display: 'flex' }}>
    <span style={{ flex: 'none', minWidth: '2.6em' }}>{no}</span>
    <span style={{ flex: 1 }}>{children}</span>
  </div>
);

const Labeled = ({ name, children }: { name: string; children: ReactNode }) => (
  <div style={{ display: 'flex' }}>
    <span style={{ flex: 'none' }}>{name}：</span>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
);

const Motion = ({
  no,
  proposer,
  subject,
  notes,
  resolution,
}: {
  no: string;
  proposer: string;
  subject: ReactNode;
  notes?: ReactNode;
  resolution: ReactNode;
}) => (
  <div style={{ marginLeft: '2em', marginTop: 10 }}>
    <div style={{ display: 'flex' }}>
      <span style={{ flex: 1 }}>{no}</span>
      <span>提案單位：{proposer}</span>
    </div>
    <Labeled name="案由">{subject}</Labeled>
    {notes && <Labeled name="說明">{notes}</Labeled>}
    <Labeled name="決議">{resolution}</Labeled>
  </div>
);

const cell: CSSProperties = {
  border: '1px solid var(--od-rule)',
  padding: '4px 8px',
  verticalAlign: 'top',
};

const FollowUp = ({ rows }: { rows: { task: string; owner: string; due: string }[] }) => (
  <table
    style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 18,
      lineHeight: 1.5,
      marginTop: 8,
    }}
  >
    <thead>
      <tr>
        <th style={{ ...cell, width: '3em', fontWeight: 400 }}>項次</th>
        <th style={{ ...cell, fontWeight: 400 }}>決議事項</th>
        <th style={{ ...cell, width: '6em', fontWeight: 400 }}>負責單位</th>
        <th style={{ ...cell, width: '6em', fontWeight: 400 }}>完成期限</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={row.task}>
          <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
          <td style={cell}>{row.task}</td>
          <td style={{ ...cell, textAlign: 'center' }}>{row.owner}</td>
          <td style={{ ...cell, textAlign: 'center' }}>{row.due}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const Footer = () => {
  const n = useDocPageNumber();
  const total = useDocPageCount();
  return (
    <div
      style={{
        position: 'absolute',
        left: 'var(--od-margin)',
        right: 'var(--od-margin)',
        bottom: 44,
        textAlign: 'center',
        fontSize: 'var(--od-size-caption)',
      }}
    >
      第 {n} 頁，共 {total} 頁
    </div>
  );
};

const First: DocPage = () => (
  <div style={page}>
    <Title>範例機關115年第3次業務協調會議紀錄</Title>

    <Entry no="一、" label="時間">
      中華民國115年9月30日（星期三）下午2時
    </Entry>
    <Entry no="二、" label="地點">
      本機關3樓第一會議室
    </Entry>
    <ChairAndClerk chair="王○○ 主任秘書" clerk="李○○" />
    <Entry no="四、" label="出席人員">
      如簽到表
    </Entry>
    <Entry no="五、" label="列席人員">
      資訊室陳○○、會計室林○○
    </Entry>
    <Entry no="六、" label="主持人致詞">
      略
    </Entry>
    <Entry no="七、" label="報告事項">
      <Item no="（一）">秘書室：第2次會議決議事項共5項，已完成4項，餘1項列管追蹤。</Item>
      <Item no="（二）">資訊室：公文線上簽核系統於9月完成測試，預定10月上線。</Item>
    </Entry>
    <Entry no="八、" label="討論事項" />
    <Motion
      no="第一案"
      proposer="秘書室"
      subject="修正本機關會議室借用要點，提請討論。"
      notes={
        <>
          <Item no="1.">現行要點未規範線上預約之取消時限，時有重複預約情形。</Item>
          <Item no="2.">修正草案增列取消時限與違規停權規定，詳如附件。</Item>
        </>
      }
      resolution="照案通過，自115年11月1日起施行。"
    />

    <Footer />
  </div>
);

const Continued: DocPage = () => (
  <div style={page}>
    <Motion
      no="第二案"
      proposer="資訊室"
      subject="線上簽核系統上線後紙本公文之處理方式，提請討論。"
      resolution="10月至12月為雙軌並行期，自116年1月1日起全面線上簽核。"
    />
    <Entry no="九、" label="臨時動議">
      無
    </Entry>
    <Entry no="十、" label="散會">
      下午3時40分
    </Entry>

    <div style={{ marginTop: 28 }}>附表　決議事項追蹤</div>
    <FollowUp
      rows={[
        { task: '會議室借用要點修正發布', owner: '秘書室', due: '115/10/31' },
        { task: '線上簽核系統教育訓練', owner: '資訊室', due: '115/10/15' },
        { task: '紙本公文雙軌作業說明', owner: '文書科', due: '115/10/20' },
      ]}
    />

    <Footer />
  </div>
);

export default [First, Continued] satisfies DocPage[];
