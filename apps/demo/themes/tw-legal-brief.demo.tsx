import {
  type DesignSystem,
  type DocPage,
  useDocPageCount,
  useDocPageNumber,
} from '@open-document/core';
import type { CSSProperties, ReactNode } from 'react';

export const design: DesignSystem = {
  palette: {
    bg: '#ffffff',
    text: '#000000',
    muted: '#3f3f3f',
    accent: '#000000',
    rule: '#000000',
  },
  fonts: {
    heading: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    body: '"DFKai-SB", "BiauKai", "標楷體", "TW-Kai", "Kaiti TC", serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  },
  typeScale: { title: 28, h1: 21, h2: 21, h3: 21, body: 21, caption: 16 },
  margin: 85,
  leading: 1.7,
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

const BriefTitle = ({ children }: { children: ReactNode }) => (
  <h1
    style={{
      fontSize: 'var(--od-size-title)',
      fontWeight: 400,
      textAlign: 'center',
      letterSpacing: '0.3em',
      textIndent: '0.3em',
      margin: '0 0 14px',
    }}
  >
    {children}
  </h1>
);

const CaseNo = ({ no, division }: { no: string; division: string }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 24,
      fontSize: 'var(--od-size-caption)',
      marginBottom: 10,
    }}
  >
    <span>案　號：{no}</span>
    <span>股　別：{division}</span>
  </div>
);

const partyCell: CSSProperties = {
  border: '1px solid var(--od-rule)',
  padding: '5px 8px',
  fontSize: 18,
  verticalAlign: 'top',
};

const Party = ({
  title,
  name,
  id,
  address,
}: {
  title: string;
  name: string;
  id: string;
  address: string;
}) => (
  <tr>
    <td style={{ ...partyCell, width: 92, textAlign: 'center' }}>{title}</td>
    <td style={{ ...partyCell, width: 110 }}>{name}</td>
    <td style={{ ...partyCell, width: 150 }}>{id}</td>
    <td style={partyCell}>{address}</td>
  </tr>
);

const Head = ({ children }: { children: ReactNode }) => (
  <div style={{ marginTop: 18, marginBottom: 4 }}>{children}</div>
);

const Item = ({ no, children }: { no: string; children: ReactNode }) => (
  <div style={{ display: 'flex', marginBottom: 4 }}>
    <span style={{ flex: 'none', width: '2.6em' }}>{no}</span>
    <span style={{ flex: 1, textAlign: 'justify' }}>{children}</span>
  </div>
);

const ToCourt = ({ court }: { court: string }) => (
  <div style={{ marginTop: 20 }}>
    <div>此　致</div>
    <div style={{ paddingLeft: '2em' }}>{court}　公鑒</div>
  </div>
);

const Signer = ({ title, name }: { title: string; name: string }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
    <span>{title}</span>
    <span style={{ minWidth: '8em', borderBottom: '1px solid var(--od-rule)' }}>{name}</span>
    <span style={{ fontSize: 'var(--od-size-caption)', alignSelf: 'flex-end' }}>（簽名蓋章）</span>
  </div>
);

const DateLine = ({ children }: { children: ReactNode }) => (
  <div style={{ textAlign: 'center', marginTop: 22, letterSpacing: '0.15em' }}>{children}</div>
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
        bottom: 40,
        textAlign: 'center',
        fontSize: 'var(--od-size-caption)',
        color: 'var(--od-muted)',
      }}
    >
      第 {n} 頁／共 {total} 頁
    </div>
  );
};

const notice: CSSProperties = {
  border: '1px solid var(--od-rule)',
  padding: '5px 10px',
  fontSize: 'var(--od-size-caption)',
  textAlign: 'center',
  marginBottom: 12,
};

const First: DocPage = () => (
  <div style={page}>
    <div style={notice}>【格式預覽】當事人、案號與事實均為虛構，非真實書狀</div>
    <BriefTitle>民事起訴狀</BriefTitle>
    <CaseNo no="115年度訴字第○○○號" division="○股" />

    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
      <tbody>
        <Party title="原　告" name="王小明" id="A1234○○○○○" address="000範例市範例區範例路1號" />
        <Party title="被　告" name="陳大同" id="B2345○○○○○" address="000範例市範例區示範街2號" />
      </tbody>
    </table>

    <div style={{ marginTop: 14 }}>為請求返還借款事件，依法提起訴訟事：</div>

    <Head>訴之聲明</Head>
    <Item no="一、">
      被告應給付原告新臺幣參拾萬元，及自民國115年6月1日起至清償日止，按年息百分之五計算之利息。
    </Item>
    <Item no="二、">訴訟費用由被告負擔。</Item>
    <Item no="三、">原告願供擔保，請准宣告假執行。</Item>

    <Head>事實及理由</Head>
    <Item no="一、">
      兩造於民國114年12月1日訂立借款契約，原告於同日以匯款方式交付被告新臺幣參拾萬元，約定被告應於115年5月31日前一次清償（證一、證二）。
    </Item>

    <Footer />
  </div>
);

const Continued: DocPage = () => (
  <div style={page}>
    <Item no="二、">
      清償期屆至後，原告分別於115年6月10日、同年7月5日以存證信函催告被告履行，被告均未回應亦未為任何給付（證三）。
    </Item>
    <Item no="三、">
      按借用人應於約定期限內，返還與借用物種類、品質、數量相同之物，民法第478條定有明文。被告既未依約清償，原告自得請求返還借款並計付法定遲延利息。
    </Item>

    <Head>證物名稱及件數</Head>
    <Item no="證一">借款契約書影本1份。</Item>
    <Item no="證二">匯款交易明細影本1份。</Item>
    <Item no="證三">存證信函及回執影本各2份。</Item>

    <ToCourt court="臺灣範例地方法院民事庭" />

    <Signer title="具狀人" name="王小明" />
    <Signer title="撰狀人" name="王小明" />

    <DateLine>中　華　民　國　115　年　8　月　16　日</DateLine>

    <Footer />
  </div>
);

export default [First, Continued] satisfies DocPage[];
