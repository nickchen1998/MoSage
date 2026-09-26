import { CodeExcerpt, CodeList, type DocEntry, type DocMeta, flow, Ref } from 'mosage';
import transform from '../../code/etl/transform.py?code';
import revenue from '../../code/sql/monthly_revenue.sql?code';

export const meta: DocMeta = {
  title: 'Code Listing',
  createdAt: '2026-01-06T00:00:00.000Z',
  labels: { code: '程式', codeLines: '第 {range} 行', codeOmitted: '省略第 {range} 行' },
};

const Body = flow(
  <>
    <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Cleaning orders</h1>
    <p style={{ margin: '0 0 14px', lineHeight: 1.55 }}>
      The rules live in one file; <Ref to="clean" /> shows the main steps, and the monthly total
      comes from <Ref to="revenue" />.
    </p>
    <CodeExcerpt id="clean" src={transform} lines="4-16" omit="8-12" caption="Order cleaning" />
    <CodeExcerpt id="revenue" src={revenue} caption="Monthly revenue" />
    <h2 style={{ fontSize: 20, margin: '12px 0 8px' }}>Code listed</h2>
    <CodeList />
  </>,
);

export default [Body] satisfies DocEntry[];
